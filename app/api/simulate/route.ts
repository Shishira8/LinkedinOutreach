import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createHash } from 'crypto';
import { getPersonas } from '@/lib/personas';
import { generateReaction, aggregateReactions } from '@/lib/gemini';
import { normalizeAudienceAggregates } from '@/lib/scoring';
import { type AudienceProfile } from '@/lib/linkedin-analytics';
import { v4 as uuidv4 } from 'uuid';
import { getServiceSupabase } from '@/lib/supabase';

const ANONYMOUS_SIMULATION_LIMIT = 1;
const ANONYMOUS_WINDOW_HOURS = 24;

function getAnonymousIdentityHash(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  return createHash('sha256')
    .update(`${forwardedFor}:${userAgent}`)
    .digest('hex');
}

async function enforceAnonymousQuota(supabase: ReturnType<typeof getServiceSupabase>, req: Request) {
  const identityHash = getAnonymousIdentityHash(req);
  const now = new Date();
  const windowMs = ANONYMOUS_WINDOW_HOURS * 60 * 60 * 1000;

  const { data: existingQuota, error: readError } = await supabase
    .from('anonymous_usage_quotas')
    .select('identity_hash, usage_count, window_started_at')
    .eq('identity_hash', identityHash)
    .maybeSingle();

  if (readError) {
    throw new Error(`Failed to read anonymous quota: ${readError.message}`);
  }

  const windowStartedAt = existingQuota?.window_started_at ? new Date(existingQuota.window_started_at) : null;
  const isWindowExpired = !windowStartedAt || now.getTime() - windowStartedAt.getTime() >= windowMs;

  if (!existingQuota || isWindowExpired) {
    const { error: upsertError } = await supabase
      .from('anonymous_usage_quotas')
      .upsert({
        identity_hash: identityHash,
        usage_count: 1,
        window_started_at: now.toISOString(),
        last_seen_at: now.toISOString(),
      });

    if (upsertError) {
      throw new Error(`Failed to reset anonymous quota: ${upsertError.message}`);
    }

    return;
  }

  if (existingQuota.usage_count >= ANONYMOUS_SIMULATION_LIMIT) {
    throw new Error('Anonymous demo limit reached. Sign in to continue simulating and save your results.');
  }

  const { error: updateError } = await supabase
    .from('anonymous_usage_quotas')
    .update({
      usage_count: existingQuota.usage_count + 1,
      last_seen_at: now.toISOString(),
    })
    .eq('identity_hash', identityHash);

  if (updateError) {
    throw new Error(`Failed to update anonymous quota: ${updateError.message}`);
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const body = await req.json();
    const { post_text, selected_audiences, platform } = body;

    if (!post_text || !selected_audiences || selected_audiences.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const simulationId = uuidv4();
    const supabase = getServiceSupabase();
    let audienceProfile: AudienceProfile | null = null;
    let latestImportId: string | null = null;
    let cachedPersonaPack: Record<string, any[]> | null = null;

    if (!userId) {
      try {
        await enforceAnonymousQuota(supabase, req);
      } catch (quotaError: any) {
        return NextResponse.json({ error: quotaError.message }, { status: 429 });
      }
    } else {
      const { data: latestImport, error: importError } = await supabase
        .from('linkedin_audience_imports')
        .select('id, audience_profile_json')
        .eq('clerk_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (importError) {
        console.error('Error loading LinkedIn audience profile', importError);
      } else if (latestImport?.audience_profile_json) {
        audienceProfile = latestImport.audience_profile_json as AudienceProfile;
        latestImportId = latestImport.id;

        const { data: cachedPackRow, error: cachedPackError } = await supabase
          .from('user_persona_packs')
          .select('persona_pack_json')
          .eq('clerk_user_id', userId)
          .eq('linkedin_import_id', latestImportId)
          .maybeSingle();

        if (cachedPackError) {
          console.error('Error loading cached persona pack', cachedPackError);
        } else if (cachedPackRow?.persona_pack_json) {
          cachedPersonaPack = cachedPackRow.persona_pack_json as Record<string, any[]>;
        }
      }
    }

    // Create simulation record
    const { error: simError } = await supabase.from('simulations').insert({
      id: simulationId,
      clerk_user_id: userId || null,
      post_text,
      platform: platform || 'linkedin',
      selected_audiences,
      status: 'pending',
    });

    if (simError) {
      console.error('Error creating simulation', simError);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          sendEvent('progress', {
            message: cachedPersonaPack
              ? 'Using your cached personalized persona pack...'
              : audienceProfile
                ? 'Personalizing personas from your LinkedIn audience...'
                : 'Generating your audience personas...',
            step: 1,
          });

          // Generate default personas first, then layer cache where available.
          const personasByAudience = getPersonas(selected_audiences, 5, audienceProfile);

          if (cachedPersonaPack) {
            for (const audience of selected_audiences) {
              const cachedAudiencePersonas = cachedPersonaPack[audience];
              if (Array.isArray(cachedAudiencePersonas) && cachedAudiencePersonas.length > 0) {
                personasByAudience[audience] = cachedAudiencePersonas.slice(0, 5);
              }
            }
          } else if (userId && latestImportId && audienceProfile) {
            const { error: cacheWriteError } = await supabase
              .from('user_persona_packs')
              .upsert(
                {
                  clerk_user_id: userId,
                  linkedin_import_id: latestImportId,
                  persona_pack_json: personasByAudience,
                  source: 'linkedin_import',
                  generated_at: new Date().toISOString(),
                },
                { onConflict: 'clerk_user_id,linkedin_import_id' },
              );

            if (cacheWriteError) {
              console.error('Error caching persona pack', cacheWriteError);
            }
          }

          const reactionsByAudience: Record<string, any[]> = {};

          // Generate reactions in parallel
          const promises = [];
          for (const audience of Object.keys(personasByAudience)) {
            reactionsByAudience[audience] = [];
            sendEvent('progress', { message: `Simulating ${audience} reactions...`, step: 2 });
            for (const persona of personasByAudience[audience]) {
              promises.push(
                generateReaction(persona, post_text, platform || 'linkedin').then(reaction => {
                  reactionsByAudience[audience].push({
                    persona,
                    reaction,
                  });
                }),
              );
            }
          }

          await Promise.all(promises);

          sendEvent('progress', { message: 'Analyzing patterns...', step: 3 });

          // Aggregate reactions
          const llmAggregate = await aggregateReactions(reactionsByAudience, post_text);
          const aggregate = normalizeAudienceAggregates(reactionsByAudience, llmAggregate);

          sendEvent('progress', { message: 'Writing your coaching report...', step: 4 });

          // Save results
          const { error: resultError } = await supabase.from('simulation_results').insert({
            simulation_id: simulationId,
            personas_json: personasByAudience,
            reactions_json: reactionsByAudience,
            aggregate_json: aggregate,
          });

          if (resultError) {
            console.error('Error saving results', resultError);
          }

          // Update simulation status
          await supabase.from('simulations').update({ status: 'complete' }).eq('id', simulationId);

          sendEvent('complete', { id: simulationId, reactions: reactionsByAudience, aggregate });
          controller.close();
        } catch (err) {
          console.error('Stream error:', err);
          sendEvent('error', { message: 'An error occurred during simulation' });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Simulation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
