import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getServiceSupabase } from '@/lib/supabase';

type AggregatePayload = {
  engagement_score?: number;
  would_stop_scrolling_pct?: number;
  would_like_pct?: number;
  would_comment_pct?: number;
  score_breakdown?: {
    attention?: number;
    approval?: number;
    conversation?: number;
  };
  coaching?: {
    whats_working_summary?: string;
    whats_working?: string[] | string;
    whats_losing_them_summary?: string;
    whats_losing_them?: string[] | string;
    edits_to_add?: string[] | string;
    suggested_fix?: string[] | string;
  };
};

type ThemeEntry = {
  label: string;
  count: number;
  audiences: string[];
};

type AudienceStats = {
  audience: string;
  run_count: number;
  average_engagement_score: number;
  median_engagement_score: number;
  average_attention: number;
  average_approval: number;
  average_conversation: number;
  strongest_signal: string;
};

function roundMetric(value: number, digits = 1) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
  }

  return sorted[midpoint];
}

function normalizeThemeLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/[^a-z0-9\s&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBulletList(value: string[] | string | undefined, limit = 5) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, limit);
  }

  return value
    .split(/\n|(?<=[.!?])\s+(?=[A-Z])|;\s+/)
    .map(item => item.replace(/^[-•\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

function addThemeEntry(
  store: Map<string, { label: string; count: number; audiences: Set<string> }>,
  value: string,
  audience: string,
) {
  const canonical = normalizeThemeLabel(value);
  if (!canonical || canonical.length < 4) {
    return;
  }

  const existing = store.get(canonical);
  if (existing) {
    existing.count += 1;
    existing.audiences.add(audience);
    return;
  }

  store.set(canonical, {
    label: value.trim(),
    count: 1,
    audiences: new Set([audience]),
  });
}

function finalizeThemeEntries(store: Map<string, { label: string; count: number; audiences: Set<string> }>, limit = 5): ThemeEntry[] {
  return Array.from(store.values())
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label);
    })
    .slice(0, limit)
    .map(entry => ({
      label: entry.label,
      count: entry.count,
      audiences: Array.from(entry.audiences).sort(),
    }));
}

function strongestSignalLabel(stats: AudienceStats) {
  const signals = [
    { label: 'attention', value: stats.average_attention },
    { label: 'approval', value: stats.average_approval },
    { label: 'conversation', value: stats.average_conversation },
  ].sort((left, right) => right.value - left.value);

  return signals[0]?.label || 'attention';
}

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const { userId: authenticatedUserId } = await auth();

    if (!authenticatedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authenticatedUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    const { data: simulations, error } = await supabase
      .from('simulations')
      .select('id, post_text, platform, selected_audiences, created_at, status')
      .eq('clerk_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch simulations' }, { status: 500 });
    }

    const simulationIds = (simulations || []).map(simulation => simulation.id);

    if (simulationIds.length === 0) {
      return NextResponse.json({
        summary: {
          completed_runs: 0,
          total_runs: 0,
          strongest_audience: null,
          sparse_data: true,
          audience_affinity: [],
          top_strengths: [],
          top_weak_spots: [],
          top_fixes: [],
        },
        recent_runs: [],
      });
    }

    const { data: simulationResults, error: resultsError } = await supabase
      .from('simulation_results')
      .select('simulation_id, aggregate_json, created_at')
      .in('simulation_id', simulationIds);

    if (resultsError) {
      return NextResponse.json({ error: 'Failed to fetch simulation results' }, { status: 500 });
    }

    const resultsBySimulationId = new Map(
      (simulationResults || []).map(result => [result.simulation_id, result]),
    );

    const audienceScores = new Map<string, number[]>();
    const audienceBreakdowns = new Map<string, { attention: number[]; approval: number[]; conversation: number[] }>();
    const strengths = new Map<string, { label: string; count: number; audiences: Set<string> }>();
    const weakSpots = new Map<string, { label: string; count: number; audiences: Set<string> }>();
    const fixes = new Map<string, { label: string; count: number; audiences: Set<string> }>();
    let completedRuns = 0;

    for (const simulation of simulations || []) {
      const result = resultsBySimulationId.get(simulation.id);
      const aggregateJson = (result?.aggregate_json || {}) as Record<string, AggregatePayload>;
      const audienceEntries = Object.entries(aggregateJson);

      if (simulation.status === 'complete' && audienceEntries.length > 0) {
        completedRuns += 1;
      }

      for (const [audience, aggregate] of audienceEntries) {
        const scores = audienceScores.get(audience) || [];
        const breakdowns = audienceBreakdowns.get(audience) || {
          attention: [],
          approval: [],
          conversation: [],
        };

        if (typeof aggregate.engagement_score === 'number') {
          scores.push(aggregate.engagement_score);
          audienceScores.set(audience, scores);
        }

        const scoreBreakdown = aggregate.score_breakdown || {};
        if (typeof scoreBreakdown.attention === 'number') breakdowns.attention.push(scoreBreakdown.attention);
        if (typeof scoreBreakdown.approval === 'number') breakdowns.approval.push(scoreBreakdown.approval);
        if (typeof scoreBreakdown.conversation === 'number') breakdowns.conversation.push(scoreBreakdown.conversation);
        audienceBreakdowns.set(audience, breakdowns);

        const coaching = aggregate.coaching || {};
        const workingThemes = [
          coaching.whats_working_summary,
          ...extractBulletList(coaching.whats_working),
        ];
        const losingThemes = [
          coaching.whats_losing_them_summary,
          ...extractBulletList(coaching.whats_losing_them),
        ];
        const fixThemes = [
          ...extractBulletList(coaching.edits_to_add),
          ...extractBulletList(coaching.suggested_fix, 1),
        ];

        workingThemes.forEach(theme => {
          if (theme) addThemeEntry(strengths, theme, audience);
        });
        losingThemes.forEach(theme => {
          if (theme) addThemeEntry(weakSpots, theme, audience);
        });
        fixThemes.forEach(theme => {
          if (theme) addThemeEntry(fixes, theme, audience);
        });
      }
    }

    const audienceAffinity: AudienceStats[] = Array.from(audienceScores.entries())
      .map(([audience, scores]) => {
        const breakdowns = audienceBreakdowns.get(audience) || {
          attention: [],
          approval: [],
          conversation: [],
        };

        const stats: AudienceStats = {
          audience,
          run_count: scores.length,
          average_engagement_score: roundMetric(scores.reduce((sum, score) => sum + score, 0) / scores.length),
          median_engagement_score: roundMetric(median(scores)),
          average_attention: roundMetric(breakdowns.attention.reduce((sum, value) => sum + value, 0) / Math.max(breakdowns.attention.length, 1)),
          average_approval: roundMetric(breakdowns.approval.reduce((sum, value) => sum + value, 0) / Math.max(breakdowns.approval.length, 1)),
          average_conversation: roundMetric(breakdowns.conversation.reduce((sum, value) => sum + value, 0) / Math.max(breakdowns.conversation.length, 1)),
          strongest_signal: 'attention',
        };

        stats.strongest_signal = strongestSignalLabel(stats);
        return stats;
      })
      .sort((left, right) => right.average_engagement_score - left.average_engagement_score);

    const strongestAudience = audienceAffinity[0] || null;
    const recentRuns = (simulations || []).slice(0, 4).map(simulation => ({
      ...simulation,
      results: resultsBySimulationId.get(simulation.id) || null,
    }));

    return NextResponse.json({
      summary: {
        completed_runs: completedRuns,
        total_runs: (simulations || []).length,
        strongest_audience: strongestAudience,
        sparse_data: completedRuns < 2,
        audience_affinity: audienceAffinity,
        top_strengths: finalizeThemeEntries(strengths),
        top_weak_spots: finalizeThemeEntries(weakSpots),
        top_fixes: finalizeThemeEntries(fixes),
      },
      recent_runs: recentRuns,
    });

  } catch (error) {
    console.error("Fetch user simulations error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
