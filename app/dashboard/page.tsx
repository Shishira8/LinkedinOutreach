'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, Clock3, Flame, Lightbulb, Loader2, Megaphone, Sparkles, Target, TrendingUp, TriangleAlert, Wrench } from 'lucide-react';
import { useSimulationAuth } from '@/hooks/use-simulation-auth';
import { normalizeAudienceAggregates } from '@/lib/scoring';
import { LinkedInTrendsPanel } from '@/app/simulate/linkedin-trends-panel';
import type { AudienceProfile, EngagementSeriesPoint, PerformanceInsight, TopPost } from '@/lib/linkedin-analytics';
import { weeklyLinkedInSignals } from '@/data/linkedin_weekly_signals';

type AnalyticsImportResponse = {
  import: {
    id: string;
    file_name: string;
    created_at: string;
    audience_profile_json: AudienceProfile;
    engagement_series_json: EngagementSeriesPoint[];
    top_posts_json: TopPost[];
    performance_insights_json: PerformanceInsight[];
  } | null;
};

type DashboardSimulation = {
  id: string;
  post_text: string;
  platform: string;
  selected_audiences: string[];
  created_at: string;
  status: string;
  results: {
    simulation_id: string;
    aggregate_json: Record<string, any>;
    created_at: string;
  } | null;
};

type DashboardTheme = {
  label: string;
  count: number;
  audiences: string[];
};

type AudienceAffinity = {
  audience: string;
  run_count: number;
  average_engagement_score: number;
  median_engagement_score: number;
  average_attention: number;
  average_approval: number;
  average_conversation: number;
  average_sentiment: number;
  strongest_signal: string;
};

type DashboardSummary = {
  completed_runs: number;
  total_runs: number;
  strongest_audience: AudienceAffinity | null;
  sparse_data: boolean;
  audience_affinity: AudienceAffinity[];
  top_strengths: DashboardTheme[];
  top_weak_spots: DashboardTheme[];
  top_fixes: DashboardTheme[];
};

type DashboardResponse = {
  summary: DashboardSummary;
  recent_runs: DashboardSimulation[];
};

function formatAudienceLabel(audience: string) {
  return audience.replace(/_/g, ' ');
}

function formatSignalLabel(signal: string) {
  if (signal === 'approval') return 'approval';
  if (signal === 'conversation') return 'conversation';
  if (signal === 'sentiment') return 'sentiment';
  return 'attention';
}

function getBestAudience(simulation: DashboardSimulation) {
  const aggregate = normalizeAudienceAggregates({}, simulation.results?.aggregate_json || {});
  const entries = Object.entries(aggregate as Record<string, any>)
    .map(([audience, payload]) => ({
      audience,
      score: payload?.engagement_score || 0,
    }))
    .sort((left, right) => right.score - left.score);

  return entries[0] || null;
}

function truncatePost(postText: string, maxLength = 170) {
  const normalized = postText.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export default function DashboardPage() {
  const { isLoaded, isSignedIn, userId } = useSimulationAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsImport, setAnalyticsImport] = useState<AnalyticsImportResponse['import']>(null);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [recentRuns, setRecentRuns] = useState<DashboardSimulation[]>([]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) {
      return;
    }

    const loadDashboard = async () => {
      try {
        const [analyticsResponse, simulationsResponse] = await Promise.all([
          fetch('/api/linkedin-analytics'),
          fetch(`/api/simulations/user/${userId}`),
        ]);

        if (!analyticsResponse.ok) {
          throw new Error('Failed to load your LinkedIn analytics snapshot.');
        }

        if (!simulationsResponse.ok) {
          throw new Error('Failed to load your simulation history.');
        }

        const analyticsPayload: AnalyticsImportResponse = await analyticsResponse.json();
        const simulationsPayload: DashboardResponse = await simulationsResponse.json();

        setAnalyticsImport(analyticsPayload.import);
        setDashboardSummary(simulationsPayload.summary);
        setRecentRuns(simulationsPayload.recent_runs || []);
      } catch (caughtError: any) {
        setError(caughtError.message || 'Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [isLoaded, isSignedIn, userId]);

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
        <Loader2 className="h-8 w-8 animate-spin text-[#0A66C2]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-md rounded-3xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-slate-900">Dashboard unavailable</h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <div className="mt-5 flex justify-center gap-4">
            <Link href="/simulate" className="rounded-full bg-[#0A66C2] px-5 py-3 text-sm font-semibold text-white hover:bg-[#004182] transition-colors">
              Back to simulate
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const strongestAudience = dashboardSummary?.strongest_audience;

  const summaryCards = [
    {
      title: 'Audience that responds best',
      value: strongestAudience ? formatAudienceLabel(strongestAudience.audience) : 'Not enough runs yet',
      detail: strongestAudience ? `Average engagement ${strongestAudience.average_engagement_score}/100 across ${strongestAudience.run_count} runs.` : 'Run and save a few simulations to reveal this pattern.',
      icon: Target,
    },
    {
      title: 'Most repeated strength',
      value: dashboardSummary?.top_strengths[0]?.label || 'No repeated strength yet',
      detail: dashboardSummary?.top_strengths[0] ? `Appears in ${dashboardSummary.top_strengths[0].count} coaching notes.` : 'Your repeated strengths will show up here once enough runs accumulate.',
      icon: TrendingUp,
    },
    {
      title: 'Most repeated blocker',
      value: dashboardSummary?.top_weak_spots[0]?.label || 'No repeated blocker yet',
      detail: dashboardSummary?.top_weak_spots[0] ? `Appears in ${dashboardSummary.top_weak_spots[0].count} coaching notes.` : 'Weak spots will appear here once you have enough completed runs.',
      icon: TriangleAlert,
    },
  ];

  const affinityBarMax = Math.max(...(dashboardSummary?.audience_affinity || []).map(item => item.average_engagement_score), 1);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center border-b border-slate-200">
        <Link href="/" className="text-xl font-bold text-[#0A66C2] tracking-tight">ReplyMind</Link>
        <div className="flex items-center gap-5">
          <Link href="/simulate" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            New simulation
          </Link>
        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto px-6 pt-8 space-y-8">
        <section className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0A66C2] p-8 text-white shadow-xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-100">
                <Sparkles className="h-3.5 w-3.5" /> Dashboard phase 1
              </div>
              <h1 className="mt-4 text-4xl font-bold tracking-tight">See what consistently works in your LinkedIn drafts.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-200">
                This view rolls up your saved coaching across runs so you can spot the audiences that respond best, the strengths that keep showing up, and the fixes worth applying next.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link href="/simulate" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
                Run another simulation <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {summaryCards.map(card => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300">
                    <Icon className="h-4 w-4" /> {card.title}
                  </div>
                  <div className="mt-3 text-2xl font-semibold leading-tight">{card.value}</div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{card.detail}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Your cross-run patterns</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                These analytics are derived from your saved simulations and the coaching attached to them, not from raw activity counts.
              </p>
            </div>
            {dashboardSummary?.sparse_data ? (
              <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700">
                Add more saved runs for stronger patterns
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[0.95fr_1.05fr]">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Target className="h-4 w-4 text-blue-600" /> Audience affinity
              </div>
              <div className="mt-4 space-y-4">
                {(dashboardSummary?.audience_affinity || []).length > 0 ? dashboardSummary?.audience_affinity.map(item => (
                  <div key={item.audience} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{formatAudienceLabel(item.audience)}</h3>
                        <p className="mt-1 text-sm text-slate-500">Strongest on {formatSignalLabel(item.strongest_signal)} across {item.run_count} completed runs.</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-semibold text-slate-900">{item.average_engagement_score}</div>
                        <div className="text-xs uppercase tracking-wider text-slate-400">avg engagement</div>
                      </div>
                    </div>
                    <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-[#0A66C2]" style={{ width: `${(item.average_engagement_score / affinityBarMax) * 100}%` }} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 md:grid-cols-4">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-slate-400">Attention</div>
                        <div className="mt-1 font-semibold text-slate-900">{item.average_attention}%</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-slate-400">Approval</div>
                        <div className="mt-1 font-semibold text-slate-900">{item.average_approval}%</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-slate-400">Conversation</div>
                        <div className="mt-1 font-semibold text-slate-900">{item.average_conversation}%</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-slate-400">Sentiment</div>
                        <div className="mt-1 font-semibold text-slate-900">{item.average_sentiment}%</div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    Save at least a couple of completed simulations to see which audience consistently responds best.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                  <TrendingUp className="h-4 w-4" /> What keeps working
                </div>
                <div className="mt-4 space-y-3">
                  {(dashboardSummary?.top_strengths || []).length > 0 ? dashboardSummary?.top_strengths.map(item => (
                    <div key={item.label} className="rounded-xl border border-emerald-100 bg-white/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-medium text-slate-900">{item.label}</div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{item.count}x</div>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">Seen with {item.audiences.map(formatAudienceLabel).join(', ')}</div>
                    </div>
                  )) : (
                    <p className="text-sm text-slate-600">Your recurring strengths will appear here once enough coaching data accumulates.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <TriangleAlert className="h-4 w-4" /> What keeps losing them
                </div>
                <div className="mt-4 space-y-3">
                  {(dashboardSummary?.top_weak_spots || []).length > 0 ? dashboardSummary?.top_weak_spots.map(item => (
                    <div key={item.label} className="rounded-xl border border-amber-100 bg-white/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-medium text-slate-900">{item.label}</div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">{item.count}x</div>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">Seen with {item.audiences.map(formatAudienceLabel).join(', ')}</div>
                    </div>
                  )) : (
                    <p className="text-sm text-slate-600">Repeated weak spots will show up here once you save more completed runs.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                  <Wrench className="h-4 w-4" /> Draft fixes to apply next
                </div>
                <div className="mt-4 space-y-3">
                  {(dashboardSummary?.top_fixes || []).length > 0 ? dashboardSummary?.top_fixes.map(item => (
                    <div key={item.label} className="rounded-xl border border-blue-100 bg-white/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-medium text-slate-900">{item.label}</div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">{item.count}x</div>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">Recommended across {item.audiences.map(formatAudienceLabel).join(', ')}</div>
                    </div>
                  )) : (
                    <p className="text-sm text-slate-600">Frequent draft edits will appear here once your saved simulations start repeating patterns.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {analyticsImport ? (
          <LinkedInTrendsPanel
            engagementSeries={analyticsImport.engagement_series_json || []}
            topPosts={analyticsImport.top_posts_json || []}
            insights={analyticsImport.performance_insights_json || []}
          />
        ) : (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <BarChart3 className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">Import your LinkedIn analytics to unlock trends</h2>
            <p className="mt-2 text-sm text-slate-500">Your dashboard will show daily performance curves, top posts, and posting recommendations once you upload your creator export.</p>
            <Link href="/simulate" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#0A66C2] px-5 py-3 text-sm font-semibold text-white hover:bg-[#004182] transition-colors">
              Upload analytics <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-700">
                <Megaphone className="h-3.5 w-3.5" /> Weekly LinkedIn signals
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">What is hot on LinkedIn this week</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">{weeklyLinkedInSignals.editor_note}</p>
            </div>
            <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{weeklyLinkedInSignals.week_label}</div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Flame className="h-4 w-4 text-orange-500" /> Trending topics and angles
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {weeklyLinkedInSignals.topics.map(topic => (
                  <div key={topic.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-semibold text-slate-900">{topic.name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${topic.momentum === 'surging' ? 'bg-red-50 text-red-700' : topic.momentum === 'rising' ? 'bg-amber-50 text-amber-700' : 'bg-slate-200 text-slate-700'}`}>
                        {topic.momentum}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{topic.why_it_is_hot}</p>
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">Angle to try</div>
                      <p className="mt-1 text-sm text-slate-800">{topic.angle_to_try}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Lightbulb className="h-4 w-4 text-blue-500" /> Generic reach tips
              </div>
              <div className="mt-4 space-y-4">
                {weeklyLinkedInSignals.reach_tips.map(tip => (
                  <div key={tip.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-base font-semibold text-slate-900">{tip.title}</h3>
                    <p className="mt-2 text-sm font-medium text-slate-800">{tip.guidance}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{tip.why_it_helps}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Recent saved runs</h2>
              <p className="mt-1 text-sm text-slate-500">Keep this lightweight. Use it to jump back into the latest result pages when you need the full breakdown.</p>
            </div>
            {analyticsImport?.created_at ? (
              <div className="text-xs text-slate-500">Latest audience import: {new Date(analyticsImport.created_at).toLocaleString()}</div>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {recentRuns.length > 0 ? recentRuns.map(simulation => {
              const bestAudience = getBestAudience(simulation);

              return (
                <Link
                  key={simulation.id}
                  href={`/results/${simulation.id}`}
                  className="group rounded-3xl border border-slate-200 bg-slate-50 p-5 transition-colors hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
                        <span>{simulation.platform}</span>
                        <span>•</span>
                        <span>{new Date(simulation.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className={simulation.status === 'complete' ? 'text-emerald-600' : 'text-amber-600'}>{simulation.status}</span>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-slate-700">{truncatePost(simulation.post_text)}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {simulation.selected_audiences.map(audience => (
                          <span key={audience} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
                            {formatAudienceLabel(audience)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex min-w-[180px] flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-slate-400">Best audience in run</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{bestAudience ? formatAudienceLabel(bestAudience.audience) : 'No score yet'}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-slate-400">Top score in run</div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">{bestAudience ? `${bestAudience.score}/100` : '—'}</div>
                      </div>
                      <div className="inline-flex items-center gap-2 text-sm font-medium text-[#0A66C2]">
                        View full breakdown <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            }) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500 lg:col-span-2">
                <Clock3 className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-4 text-sm">You do not have any saved simulations yet. Save a few completed runs and this dashboard will start surfacing patterns that actually matter.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}