import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPersonas } from '@/lib/personas';
import { generateReaction, aggregateReactions, aggregateReactionsV2 } from '@/lib/gemini';
import { normalizeAudienceAggregates } from '@/lib/scoring';
import { type AudienceProfile } from '@/lib/linkedin-analytics';
import { type UserBrandProfile } from '@/lib/simulation-v2';
import { v4 as uuidv4 } from 'uuid';
import { getServiceSupabase } from '@/lib/supabase';
import { ensureAppUserRecord } from '@/lib/app-user';

const SIGNED_IN_SIMULATION_LIMIT = 5;

function isMissingColumnError(error: any, columnName: string) {
  return error?.code === 'PGRST204' && String(error?.message || '').includes(`'${columnName}'`);
}

async function enforceSignedInQuota(supabase: ReturnType<typeof getServiceSupabase>, userId: string) {
  const { count, error } = await supabase
    .from('simulations')
    .select('id', { count: 'exact', head: true })
    .eq('clerk_user_id', userId);

  if (error) {
    throw new Error(`Failed to read signed-in quota: ${error.message}`);
  }

  if ((count || 0) >= SIGNED_IN_SIMULATION_LIMIT) {
    throw new Error('You have used all 5 message creator credits. Message creator for more credits.');
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Sign in to create a simulation.' }, { status: 401 });
    }

    const body = await req.json();
    const { post_text, selected_audiences, platform } = body;

    if (!post_text || !selected_audiences || selected_audiences.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const simulationId = uuidv4();
    const supabase = getServiceSupabase();
    const simulationPromptVersion = process.env.SIMULATION_PROMPT_VERSION || 'v2';
    let audienceProfile: AudienceProfile | null = null;
    let latestImportId: string | null = null;
    let cachedPersonaPack: Record<string, any[]> | null = null;
    let userProfile: UserBrandProfile | null = null;
    let appUserId: string | null = null;

    try {
      await enforceSignedInQuota(supabase, userId);
      const appUser = await ensureAppUserRecord(userId);
      appUserId = appUser.id;
    } catch (quotaError: any) {
      return NextResponse.json({ error: quotaError.message }, { status: 429 });
    }

    const { data: profileData, error: profileError } = await supabase
      .from('user_brand_profiles')
      .select('*')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Error loading user profile', profileError);
    } else if (profileData) {
      userProfile = {
        ...(profileData as Record<string, any>),
        current_role: (profileData as Record<string, any>).current_role || (profileData as Record<string, any>).current_job_role || '',
      } as UserBrandProfile;
    }

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

    // Create simulation record
    const { error: simError } = await supabase.from('simulations').insert({
      id: simulationId,
      user_id: appUserId,
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

          sendEvent('progress', { message: 'Rewriting your post for each audience...', step: 3 });

          // Aggregate reactions
          const llmAggregate = simulationPromptVersion === 'v2'
            ? await aggregateReactionsV2(reactionsByAudience, post_text, {
                audienceProfile,
                userProfile,
                personasByAudience,
              })
            : await aggregateReactions(reactionsByAudience, post_text);
          const aggregate = normalizeAudienceAggregates(reactionsByAudience, llmAggregate);

          sendEvent('progress', { message: 'Finalizing your coaching report...', step: 4 });

          // Save results
          let { error: resultError } = await supabase.from('simulation_results').insert({
            simulation_id: simulationId,
            personas_json: personasByAudience,
            reactions_json: reactionsByAudience,
            aggregate_json: aggregate,
            prompt_version: simulationPromptVersion,
            report_v2_json: simulationPromptVersion === 'v2' ? llmAggregate : null,
          });

          if (resultError && (
            isMissingColumnError(resultError, 'prompt_version') ||
            isMissingColumnError(resultError, 'report_v2_json')
          )) {
            const legacyInsert = await supabase.from('simulation_results').insert({
              simulation_id: simulationId,
              personas_json: personasByAudience,
              reactions_json: reactionsByAudience,
              aggregate_json: aggregate,
            });

            resultError = legacyInsert.error;
          }

          if (resultError) {
            console.error('Error saving results', resultError);
          }

          // Update simulation status
          await supabase.from('simulations').update({ status: 'complete' }).eq('id', simulationId);

          sendEvent('complete', {
            id: simulationId,
            prompt_version: simulationPromptVersion,
            personas: personasByAudience,
            reactions: reactionsByAudience,
            aggregate,
          });
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
