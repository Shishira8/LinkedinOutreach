'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, Clock3, Flame, Lightbulb, Loader2, Megaphone, Sparkles, Target, TrendingUp, TriangleAlert, Wrench } from 'lucide-react';
import { useSimulationAuth } from '@/hooks/use-simulation-auth';
import { normalizeAudienceAggregates } from '@/lib/scoring';
import { LinkedInTrendsPanel } from '@/app/simulate/linkedin-trends-panel';
import type { AudienceProfile, EngagementSeriesPoint, PerformanceInsight, TopPost } from '@/lib/linkedin-analytics';
import { weeklyLinkedInSignals } from '@/data/linkedin_weekly_signals';
import { defiButtonVariants } from '@/components/ui/defi/button';
import { DefiPanel } from '@/components/ui/defi/panel';
import { DefiBadge } from '@/components/ui/defi/badge';

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
  const [activeView, setActiveView] = useState<'overview' | 'trending' | 'history'>('overview');

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
      <div className="defi-page flex items-center justify-center text-[#94A3B8]">
        <Loader2 className="h-8 w-8 animate-spin text-[#F7931A]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="defi-page flex flex-col items-center justify-center px-6 text-center">
        <DefiPanel className="max-w-md" variant="glass" padding="md">
          <h1 className="text-xl font-semibold font-heading">Dashboard unavailable</h1>
          <p className="mt-2 text-sm text-[#fbbf24]">{error}</p>
          <div className="mt-5 flex justify-center gap-4">
            <Link href="/simulate" className={defiButtonVariants({ size: 'md' })}>Back to simulate</Link>
          </div>
        </DefiPanel>
      </div>
    );
  }

  const strongestAudience = dashboardSummary?.strongest_audience;
  const topTrendingTopic = weeklyLinkedInSignals.topics[0];

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
    <div className="defi-page pb-24">
      <header className="defi-nav">
        <div className="defi-container py-6 flex justify-between items-center">
        <Link href="/" className="text-xl defi-logo">ReplyMind</Link>
        <div className="flex items-center gap-5 font-mono">
          <Link href="/simulate" className="text-sm font-medium defi-link uppercase tracking-wider">
            New simulation
          </Link>
        </div>
        </div>
      </header>

      <main className="defi-container pt-8 space-y-8">
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#08090f] via-[#111217] to-[#0f1115] p-8 text-white shadow-[0_0_40px_-10px_rgba(247,147,26,0.15)]">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <DefiBadge variant="orange" className="gap-2">
                <Sparkles className="h-3.5 w-3.5" /> Dashboard phase 1
              </DefiBadge>
              <h1 className="mt-4 text-4xl font-heading font-bold tracking-tight">See what consistently works in your LinkedIn drafts.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#cbd5e1]">
                This view rolls up your saved coaching across runs so you can spot the audiences that respond best, the strengths that keep showing up, and the fixes worth applying next.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link href="/simulate" className={defiButtonVariants()}>
                Run another simulation <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => setActiveView('trending')}
                className="inline-flex items-center gap-2 rounded-full border-2 border-white/20 bg-transparent px-5 py-3 text-sm font-semibold uppercase tracking-wider text-white hover:border-[#F7931A] hover:text-[#F7931A] transition-all duration-300"
              >
                View trending signals <Flame className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
            {summaryCards.map(card => {
              const Icon = card.icon;
              return (
                <DefiPanel key={card.title} variant="glass" padding="sm" className="rounded-2xl">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300">
                    <Icon className="h-4 w-4" /> {card.title}
                  </div>
                  <div className="mt-3 text-2xl font-semibold leading-tight">{card.value}</div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{card.detail}</p>
                </DefiPanel>
              );
            })}

            <button
              type="button"
              onClick={() => setActiveView('trending')}
              className="text-left rounded-2xl border border-orange-300/30 bg-orange-500/10 p-4 hover:bg-orange-500/20 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-orange-100">
                <Flame className="h-4 w-4" /> Trending this week
              </div>
              <div className="mt-3 text-lg font-semibold leading-tight text-white">
                {topTrendingTopic?.name || 'LinkedIn trends'}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-200 line-clamp-3">
                {topTrendingTopic?.why_it_is_hot || 'Open trending signals to see what topics and angles are currently performing.'}
              </p>
            </button>
          </div>
        </section>

        <DefiPanel padding="sm">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setActiveView('overview')}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                activeView === 'overview'
                  ? 'bg-gradient-to-r from-[#EA580C] to-[#F7931A] text-white shadow-[0_0_20px_-5px_rgba(234,88,12,0.45)]'
                  : 'bg-[#0b0d12] text-[#94A3B8] border border-white/10 hover:text-[#F7931A] hover:border-[#F7931A]/50'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveView('trending')}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                activeView === 'trending'
                  ? 'bg-gradient-to-r from-[#EA580C] to-[#F7931A] text-white shadow-[0_0_20px_-5px_rgba(234,88,12,0.45)]'
                  : 'bg-[#0b0d12] text-[#94A3B8] border border-white/10 hover:text-[#F7931A] hover:border-[#F7931A]/50'
              }`}
            >
              Trending on LinkedIn
            </button>
            <button
              type="button"
              onClick={() => setActiveView('history')}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                activeView === 'history'
                  ? 'bg-gradient-to-r from-[#EA580C] to-[#F7931A] text-white shadow-[0_0_20px_-5px_rgba(234,88,12,0.45)]'
                  : 'bg-[#0b0d12] text-[#94A3B8] border border-white/10 hover:text-[#F7931A] hover:border-[#F7931A]/50'
              }`}
            >
              Recent saved runs
            </button>
          </div>
        </DefiPanel>

        {activeView === 'overview' ? (
          <DefiPanel className="rounded-3xl" variant="surface" padding="md">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-heading font-bold tracking-tight text-white">Your cross-run patterns</h2>
              <p className="mt-1 max-w-3xl text-sm text-[#94A3B8]">
                These analytics are derived from your saved simulations and the coaching attached to them, not from raw activity counts.
              </p>
            </div>
            {dashboardSummary?.sparse_data ? (
              <div className="rounded-full border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#FBBF24]">
                Add more saved runs for stronger patterns
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[0.95fr_1.05fr]">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Target className="h-4 w-4 text-[#F7931A]" /> Audience affinity
              </div>
              <div className="mt-4 space-y-4">
                {(dashboardSummary?.audience_affinity || []).length > 0 ? dashboardSummary?.audience_affinity.map(item => (
                  <div key={item.audience} className="rounded-2xl border border-white/10 bg-[#0B0D12] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-white">{formatAudienceLabel(item.audience)}</h3>
                        <p className="mt-1 text-sm text-[#94A3B8]">Strongest on {formatSignalLabel(item.strongest_signal)} across {item.run_count} completed runs.</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-semibold text-white">{item.average_engagement_score}</div>
                        <div className="text-xs uppercase tracking-wider text-[#94A3B8]">avg engagement</div>
                      </div>
                    </div>
                    <div className="mt-4 h-2 w-full rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-gradient-to-r from-[#EA580C] to-[#F7931A]" style={{ width: `${(item.average_engagement_score / affinityBarMax) * 100}%` }} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[#94A3B8] md:grid-cols-3">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-[#64748B]">Attention</div>
                        <div className="mt-1 font-semibold text-white">{item.average_attention}%</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-[#64748B]">Approval</div>
                        <div className="mt-1 font-semibold text-white">{item.average_approval}%</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-[#64748B]">Conversation</div>
                        <div className="mt-1 font-semibold text-white">{item.average_conversation}%</div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-white/20 bg-[#0B0D12] p-6 text-sm text-[#94A3B8]">
                    Save at least a couple of completed simulations to see which audience consistently responds best.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <TrendingUp className="h-4 w-4" /> What keeps working
                </div>
                <div className="mt-4 space-y-3">
                  {(dashboardSummary?.top_strengths || []).length > 0 ? dashboardSummary?.top_strengths.map(item => (
                    <div key={item.label} className="rounded-xl border border-emerald-300/20 bg-[#0B0D12] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-medium text-white">{item.label}</div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">{item.count}x</div>
                      </div>
                      <div className="mt-2 text-xs text-[#94A3B8]">Seen with {item.audiences.map(formatAudienceLabel).join(', ')}</div>
                    </div>
                  )) : (
                    <p className="text-sm text-[#94A3B8]">Your recurring strengths will appear here once enough coaching data accumulates.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                  <TriangleAlert className="h-4 w-4" /> What keeps losing them
                </div>
                <div className="mt-4 space-y-3">
                  {(dashboardSummary?.top_weak_spots || []).length > 0 ? dashboardSummary?.top_weak_spots.map(item => (
                    <div key={item.label} className="rounded-xl border border-amber-300/20 bg-[#0B0D12] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-medium text-white">{item.label}</div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">{item.count}x</div>
                      </div>
                      <div className="mt-2 text-xs text-[#94A3B8]">Seen with {item.audiences.map(formatAudienceLabel).join(', ')}</div>
                    </div>
                  )) : (
                    <p className="text-sm text-[#94A3B8]">Repeated weak spots will show up here once you save more completed runs.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#F7931A]/30 bg-[#F7931A]/10 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#FBBF24]">
                  <Wrench className="h-4 w-4" /> Draft fixes to apply next
                </div>
                <div className="mt-4 space-y-3">
                  {(dashboardSummary?.top_fixes || []).length > 0 ? dashboardSummary?.top_fixes.map(item => (
                    <div key={item.label} className="rounded-xl border border-[#F7931A]/20 bg-[#0B0D12] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-medium text-white">{item.label}</div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-[#FBBF24]">{item.count}x</div>
                      </div>
                      <div className="mt-2 text-xs text-[#94A3B8]">Recommended across {item.audiences.map(formatAudienceLabel).join(', ')}</div>
                    </div>
                  )) : (
                    <p className="text-sm text-[#94A3B8]">Frequent draft edits will appear here once your saved simulations start repeating patterns.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          </DefiPanel>
        ) : null}

        {activeView === 'trending' ? (
          analyticsImport ? (
            <LinkedInTrendsPanel
              engagementSeries={analyticsImport.engagement_series_json || []}
              topPosts={analyticsImport.top_posts_json || []}
              insights={analyticsImport.performance_insights_json || []}
            />
          ) : (
            <DefiPanel className="rounded-3xl text-center" variant="subtle" padding="lg">
              <BarChart3 className="mx-auto h-8 w-8 text-[#94A3B8]" />
              <h2 className="mt-4 text-xl font-semibold font-heading text-white">Import your LinkedIn analytics to unlock trends</h2>
              <p className="mt-2 text-sm text-[#94A3B8]">Your dashboard will show daily performance curves, top posts, and posting recommendations once you upload your creator export.</p>
              <div className="mt-5">
                <Link href="/simulate" className={defiButtonVariants()}>
                  Upload analytics <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </DefiPanel>
          )
        ) : null}

        {activeView === 'trending' ? (
          <DefiPanel className="rounded-3xl" variant="surface" padding="md">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#F97316]/30 bg-[#F97316]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#FDBA74]">
                <Megaphone className="h-3.5 w-3.5" /> Weekly LinkedIn signals
              </div>
              <h2 className="mt-3 text-2xl font-heading font-bold tracking-tight text-white">What is hot on LinkedIn this week</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">{weeklyLinkedInSignals.editor_note}</p>
            </div>
            <div className="text-xs font-medium uppercase tracking-wider text-[#64748B]">{weeklyLinkedInSignals.week_label}</div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Flame className="h-4 w-4 text-[#F97316]" /> Trending topics and angles
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {weeklyLinkedInSignals.topics.map(topic => (
                  <div key={topic.name} className="rounded-2xl border border-white/10 bg-[#0B0D12] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-semibold text-white">{topic.name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${topic.momentum === 'surging' ? 'bg-red-50 text-red-700' : topic.momentum === 'rising' ? 'bg-amber-50 text-amber-700' : 'bg-slate-200 text-slate-700'}`}>
                        {topic.momentum}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">{topic.why_it_is_hot}</p>
                    <div className="mt-4 rounded-xl border border-[#F7931A]/30 bg-[#F7931A]/10 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#FBBF24]">Angle to try</div>
                      <p className="mt-1 text-sm text-white">{topic.angle_to_try}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Lightbulb className="h-4 w-4 text-[#F7931A]" /> Generic reach tips
              </div>
              <div className="mt-4 space-y-4">
                {weeklyLinkedInSignals.reach_tips.map(tip => (
                  <div key={tip.title} className="rounded-2xl border border-white/10 bg-[#0B0D12] p-4">
                    <h3 className="text-base font-semibold text-white">{tip.title}</h3>
                    <p className="mt-2 text-sm font-medium text-[#FBBF24]">{tip.guidance}</p>
                    <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{tip.why_it_helps}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </DefiPanel>
        ) : null}

        {activeView === 'history' ? (
          <DefiPanel className="rounded-3xl" variant="surface" padding="md">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-heading font-bold tracking-tight text-white">Recent saved runs</h2>
                <p className="mt-1 text-sm text-[#94A3B8]">Keep this lightweight. Use it to jump back into the latest result pages when you need the full breakdown.</p>
              </div>
              {analyticsImport?.created_at ? (
                <div className="text-xs text-[#94A3B8]">Latest audience import: {new Date(analyticsImport.created_at).toLocaleString()}</div>
              ) : null}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {recentRuns.length > 0 ? recentRuns.map(simulation => {
                const bestAudience = getBestAudience(simulation);

                return (
                  <Link
                    key={simulation.id}
                    href={`/results/${simulation.id}`}
                    className="group rounded-3xl border border-white/10 bg-[#0B0D12] p-5 transition-colors hover:border-[#F7931A]/40"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-[#94A3B8]">
                          <span>{simulation.platform}</span>
                          <span>•</span>
                          <span>{new Date(simulation.created_at).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className={simulation.status === 'complete' ? 'text-emerald-400' : 'text-amber-400'}>{simulation.status}</span>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-[#E2E8F0]">{truncatePost(simulation.post_text)}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {simulation.selected_audiences.map(audience => (
                            <span key={audience} className="rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-[#94A3B8] border border-white/15">
                              {formatAudienceLabel(audience)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex min-w-[180px] flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div>
                          <div className="text-xs uppercase tracking-wider text-[#64748B]">Best audience in run</div>
                          <div className="mt-1 text-sm font-semibold text-white">{bestAudience ? formatAudienceLabel(bestAudience.audience) : 'No score yet'}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wider text-[#64748B]">Top score in run</div>
                          <div className="mt-1 text-2xl font-semibold text-white">{bestAudience ? `${bestAudience.score}/100` : '—'}</div>
                        </div>
                        <div className="inline-flex items-center gap-2 text-sm font-medium text-[#F7931A]">
                          View full breakdown <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              }) : (
                <div className="rounded-3xl border border-dashed border-white/20 bg-[#0B0D12] p-8 text-center text-[#94A3B8] lg:col-span-2">
                  <Clock3 className="mx-auto h-8 w-8 text-[#64748B]" />
                  <p className="mt-4 text-sm">You do not have any saved simulations yet. Save a few completed runs and this dashboard will start surfacing patterns that actually matter.</p>
                </div>
              )}
            </div>
          </DefiPanel>
        ) : null}
      </main>
    </div>
  );
}