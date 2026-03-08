type ReactionAction = 'like' | 'comment' | 'scroll_past';
type ReactionTone = 'positive' | 'neutral' | 'skeptical' | 'negative';

type ReactionEnvelope = {
  reaction?: {
    action?: ReactionAction | string;
    tone?: ReactionTone | string;
    comment?: string;
  };
};

const TONE_WEIGHTS: Record<ReactionTone, number> = {
  positive: 1,
  neutral: 0.6,
  skeptical: 0.3,
  negative: 0.1,
};

const clampPercentage = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function deriveAudienceMetrics(reactions: ReactionEnvelope[]) {
  const total = reactions.length;

  if (total === 0) {
    return {
      engagement_score: 0,
      would_stop_scrolling_pct: 0,
      would_like_pct: 0,
      would_comment_pct: 0,
      sentiment_score: 0,
      score_breakdown: {
        attention: 0,
        approval: 0,
        conversation: 0,
        sentiment: 0,
      },
      scoring_version: 'v1',
    };
  }

  let stopScrollingCount = 0;
  let likeCount = 0;
  let commentCount = 0;
  let sentimentTotal = 0;

  for (const item of reactions) {
    const action = item.reaction?.action;
    const tone = (item.reaction?.tone || 'neutral') as ReactionTone;

    if (action === 'like' || action === 'comment') {
      stopScrollingCount += 1;
    }

    if (action === 'like') {
      likeCount += 1;
    }

    if (action === 'comment') {
      commentCount += 1;
    }

    sentimentTotal += TONE_WEIGHTS[tone] ?? TONE_WEIGHTS.neutral;
  }

  const wouldStopScrollingPct = clampPercentage((stopScrollingCount / total) * 100);
  const wouldLikePct = clampPercentage((likeCount / total) * 100);
  const wouldCommentPct = clampPercentage((commentCount / total) * 100);
  const sentimentScore = clampPercentage((sentimentTotal / total) * 100);

  const weightedScore =
    wouldStopScrollingPct * 0.35 +
    wouldLikePct * 0.25 +
    wouldCommentPct * 0.2 +
    sentimentScore * 0.2;

  return {
    engagement_score: clampPercentage(weightedScore),
    would_stop_scrolling_pct: wouldStopScrollingPct,
    would_like_pct: wouldLikePct,
    would_comment_pct: wouldCommentPct,
    sentiment_score: sentimentScore,
    score_breakdown: {
      attention: wouldStopScrollingPct,
      approval: wouldLikePct,
      conversation: wouldCommentPct,
      sentiment: sentimentScore,
    },
    scoring_version: 'v1',
  };
}

export function normalizeAudienceAggregates(
  reactionsByAudience: Record<string, ReactionEnvelope[]>,
  aggregateByAudience: Record<string, any> = {},
) {
  const normalized: Record<string, any> = {};
  const audienceKeys = new Set([
    ...Object.keys(reactionsByAudience || {}),
    ...Object.keys(aggregateByAudience || {}),
  ]);

  for (const audience of audienceKeys) {
    const reactions = reactionsByAudience?.[audience] || [];
    const aggregate = aggregateByAudience?.[audience] || {};
    const metrics = deriveAudienceMetrics(reactions);

    normalized[audience] = {
      ...aggregate,
      ...metrics,
    };
  }

  return normalized;
}