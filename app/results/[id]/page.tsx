'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft, AlertTriangle, CheckCircle2, PencilLine, ChevronDown, ChevronUp, Info, X } from 'lucide-react';
import { useSimulationAuth } from '@/hooks/use-simulation-auth';
import { useRouter } from 'next/navigation';
import { normalizeAudienceAggregates } from '@/lib/scoring';
import { DefiPanel } from '@/components/ui/defi/panel';
import { DefiBadge } from '@/components/ui/defi/badge';
import { defiButtonVariants } from '@/components/ui/defi/button';

type CoachingShape = {
  whats_working_summary?: string;
  whats_working?: string[] | string;
  whats_losing_them_summary?: string;
  whats_losing_them?: string[] | string;
  edits_to_add?: string[] | string;
  suggested_fix?: string[] | string;
  rewritten_post?: string;
};

type V2Persona = {
  title?: string;
  description?: string;
  likely_reaction?: string;
  influencing_elements?: string;
  relationship_to_goals?: string;
};

type V2Recommendation = {
  action?: string;
  why?: string;
  example?: string;
};

function formatAudienceLabel(audience: string) {
  return audience.replace(/_/g, ' ');
}

function toBulletList(value: string[] | string | undefined, limit = 4) {
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

function coachingForAudience(aggregate: any): CoachingShape {
  return aggregate?.coaching || {};
}

function toSafeArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [activeAudience, setActiveAudience] = useState<string | null>(null);
  const [showDetailedEdits, setShowDetailedEdits] = useState(false);
  const [showPerformanceDetails, setShowPerformanceDetails] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [showV2DeepDive, setShowV2DeepDive] = useState(false);
  const [activePersonaAudience, setActivePersonaAudience] = useState<string | null>(null);
  
  const { isSignedIn, isLoaded } = useSimulationAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchResults = async () => {
      try {
        // First try fetching from Supabase
        const res = await fetch(`/api/simulations/${id}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
          if (json.clerk_user_id) {
            setIsSaved(true);
          }
          return;
        }

        // Fallback: use sessionStorage data from the SSE stream
        const cached = sessionStorage.getItem(`simulation_results_${id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          setData({
            id,
            results: {
              personas_json: parsed.personas || {},
              reactions_json: parsed.reactions || {},
              aggregate_json: parsed.aggregate || {},
            },
          });
          return;
        }

        throw new Error('Results not found');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [id]);

  const results = data?.results;
  const personas_json = results?.personas_json || {};
  const reactions_json = results?.reactions_json || {};
  const aggregate_json = normalizeAudienceAggregates(reactions_json, results?.aggregate_json || {});
  const audienceSet = new Set<string>(Object.keys(aggregate_json));
  Object.keys(reactions_json).forEach(aud => audienceSet.add(aud));
  const audiences = Array.from(audienceSet);
  const audienceScoreKey = audiences
    .map(aud => `${aud}:${aggregate_json[aud]?.engagement_score || 0}`)
    .join('|');

  useEffect(() => {
    if (audiences.length === 0) {
      return;
    }

    if (activeAudience && audiences.includes(activeAudience)) {
      return;
    }

    const rankedAudiences = [...audiences].sort(
      (a, b) => (aggregate_json[b]?.engagement_score || 0) - (aggregate_json[a]?.engagement_score || 0),
    );
    setActiveAudience(rankedAudiences[0]);
    setShowDetailedEdits(false);
  }, [activeAudience, audienceScoreKey, audiences, aggregate_json]);

  useEffect(() => {
    if (!showMethodology) {
      return;
    }

    if (activePersonaAudience && audiences.includes(activePersonaAudience)) {
      return;
    }

    setActivePersonaAudience(activeAudience || audiences[0] || null);
  }, [showMethodology, activePersonaAudience, activeAudience, audiences]);

  const handleSave = async () => {
    if (!isLoaded) return;
    
    if (!isSignedIn) {
      // Redirect to sign in, then back to this page
      router.push(`/sign-in?redirect_url=/results/${id}`);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/simulations/${id}/claim`, {
        method: 'POST',
      });
      
      if (res.ok) {
        setIsSaved(true);
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save simulation. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="defi-page flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#F7931A] animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="defi-page flex flex-col items-center justify-center px-4">
        <DefiPanel variant="glass" padding="md" className="text-center">
          <div className="text-red-300 mb-4">{error || 'Results not found'}</div>
          <Link href="/simulate" className="defi-link hover:underline">Try again</Link>
        </DefiPanel>
      </div>
    );
  }

  const activeAggregate = activeAudience ? aggregate_json[activeAudience] : null;
  const activeCoaching = activeAggregate ? coachingForAudience(activeAggregate) : null;
  const personaInspectorAudience = activePersonaAudience && audiences.includes(activePersonaAudience)
    ? activePersonaAudience
    : audiences[0] || null;
  const inspectedPersonas = personaInspectorAudience ? personas_json[personaInspectorAudience] || [] : [];
  const activeKeepList = toBulletList(activeCoaching?.whats_working || activeAggregate?.coaching?.whats_working, 3);
  const activeLoseList = toBulletList(activeCoaching?.whats_losing_them || activeAggregate?.coaching?.whats_losing_them, 3);
  const activeEditList = toBulletList(
    activeCoaching?.edits_to_add || activeCoaching?.suggested_fix || activeAggregate?.coaching?.suggested_fix,
    5,
  );
  const activeSuggestedFix = toBulletList(activeCoaching?.suggested_fix, 1)[0];
  const activeWorkingSummary = activeCoaching?.whats_working_summary || toBulletList(activeAggregate?.coaching?.whats_working, 1)[0];
  const activeLosingSummary = activeCoaching?.whats_losing_them_summary || toBulletList(activeAggregate?.coaching?.whats_losing_them, 1)[0];
  const activeRewrite =
    activeCoaching?.rewritten_post?.trim() ||
    String(activeAggregate?.revised_post_example?.revised || '').trim() ||
    data?.post_text?.trim() ||
    '';
  const activePromptVersion = String(activeAggregate?.prompt_version || 'v1');
  const v2Personas = toSafeArray<V2Persona>(activeAggregate?.audience_simulation?.personas);
  const v2Strengths = toSafeArray<{ title?: string; why?: string }>(activeAggregate?.strengths);
  const v2Weaknesses = toSafeArray<{ issue?: string; impact?: string }>(activeAggregate?.weaknesses);
  const v2Recommendations = toSafeArray<V2Recommendation>(activeAggregate?.recommendations);
  const v2LikelySegments = toSafeArray<string>(activeAggregate?.engagement_prediction?.likely_segments);
  const v2KeyFactors = toSafeArray<string>(activeAggregate?.engagement_prediction?.key_factors);
  const v2Analysis = String(activeAggregate?.analysis || '').trim();
  const v2OriginalExcerpt = String(activeAggregate?.revised_post_example?.original || '').trim();
  const v2RevisedExcerpt = String(activeAggregate?.revised_post_example?.revised || '').trim();
  const v2StrengthHighlights = v2Strengths.map(item => item.title || '').filter(Boolean).slice(0, 3);
  const v2WeaknessHighlights = v2Weaknesses.map(item => item.issue || '').filter(Boolean).slice(0, 3);
  const v2RecommendationHighlights = v2Recommendations.map(item => item.action || '').filter(Boolean).slice(0, 3);
  const formulaScore = activeAggregate
    ? Math.round(
        (activeAggregate.would_stop_scrolling_pct || 0) * 0.4 +
        (activeAggregate.would_like_pct || 0) * 0.3 +
        (activeAggregate.would_comment_pct || 0) * 0.3,
      )
    : 0;

  return (
    <div className="defi-page pb-24">
      <header className="defi-nav">
        <div className="defi-container py-6 flex justify-between items-center">
        <Link href="/" className="text-xl defi-logo">ReplyMind</Link>
        <div className="flex items-center gap-5">
          {isSignedIn ? (
            <Link href="/dashboard" className="text-sm font-medium uppercase tracking-wider defi-link">
              Dashboard
            </Link>
          ) : null}
          <Link href="/simulate" className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider defi-link">
            <ArrowLeft className="w-4 h-4" /> New Simulation
          </Link>
        </div>
        </div>
      </header>

      <main className="defi-container pt-8">
        <h1 className="text-3xl font-heading font-bold tracking-tight mb-8">Simulation Results</h1>
        <p className="text-sm text-[#94A3B8] mb-8 max-w-3xl">
          Engagement scores are normalized from simulated attention, likes, and comments so you can compare future runs on the same scale.
        </p>

        {/* SECTION 1 - Engagement Scores */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => setShowPerformanceDetails(prev => !prev)}
            className={defiButtonVariants({ variant: 'outline', size: 'sm' })}
          >
            {showPerformanceDetails ? 'Hide performance breakdown' : 'Show performance breakdown'}
            {showPerformanceDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {!showPerformanceDetails && audiences.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-[#0B0D12] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">Top audience snapshot</div>
              {(() => {
                const rankedAudiences = [...audiences].sort(
                  (a, b) => (aggregate_json[b]?.engagement_score || 0) - (aggregate_json[a]?.engagement_score || 0),
                );
                const topAudience = rankedAudiences[0];
                const topAgg = topAudience ? aggregate_json[topAudience] : null;
                if (!topAudience || !topAgg) {
                  return <p className="text-sm text-slate-500">Run another simulation to populate audience performance.</p>;
                }

                return (
                  <div className="text-sm text-[#CBD5E1]">
                    <span className="font-semibold text-white">{formatAudienceLabel(topAudience)}</span>
                    <span className="mx-2 text-[#64748B]">•</span>
                    <span>{topAgg.engagement_score || 0}/100</span>
                    <span className="mx-2 text-[#64748B]">•</span>
                    <span>Stop: {topAgg.would_stop_scrolling_pct || 0}%</span>
                    <span className="mx-2 text-[#64748B]">•</span>
                    <span>Like: {topAgg.would_like_pct || 0}%</span>
                    <span className="mx-2 text-[#64748B]">•</span>
                    <span>Comment: {topAgg.would_comment_pct || 0}%</span>
                  </div>
                );
              })()}
            </div>
          ) : null}
          {showPerformanceDetails ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              {audiences.map(aud => {
                const agg = aggregate_json[aud];
                if (!agg) return null;
                return (
                  <div key={aud} className="bg-[#0B0D12] rounded-2xl shadow-sm border border-white/10 p-6">
                    <h3 className="text-sm font-bold text-[#94A3B8] uppercase tracking-wider mb-4">
                      {aud.replace('_', ' ')}
                    </h3>
                    <div className="inline-flex items-center rounded-full border border-[#F7931A]/30 bg-[#F7931A]/10 px-3 py-1 text-xs font-semibold text-[#FBBF24] mb-4">
                      Normalized score
                    </div>
                    <div className="flex items-end gap-2 mb-6">
                      <div className="text-5xl font-light text-white">{agg.engagement_score || 0}</div>
                      <div className="text-lg text-[#94A3B8] mb-1">/100</div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[#94A3B8]">Stop Scrolling</span>
                        <span className="font-semibold text-white">{agg.would_stop_scrolling_pct || 0}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5">
                        <div className="bg-[#F7931A] h-1.5 rounded-full" style={{ width: `${agg.would_stop_scrolling_pct || 0}%` }}></div>
                      </div>

                      <div className="flex justify-between items-center text-sm pt-2">
                        <span className="text-[#94A3B8]">Would Like</span>
                        <span className="font-semibold text-white">{agg.would_like_pct || 0}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${agg.would_like_pct || 0}%` }}></div>
                      </div>

                      <div className="flex justify-between items-center text-sm pt-2">
                        <span className="text-[#94A3B8]">Would Comment</span>
                        <span className="font-semibold text-white">{agg.would_comment_pct || 0}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5">
                        <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${agg.would_comment_pct || 0}%` }}></div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* SECTION 2 - Rewrite Studio */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-heading font-bold tracking-tight mb-2">Audience Rewrite Studio</h2>
            <p className="text-sm text-[#94A3B8] mb-2 max-w-3xl">
              View one audience at a time. The rewritten version below already incorporates draft upgrades so you can iterate faster.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMethodology(true)}
            className={defiButtonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Info className="h-4 w-4" />
            How this simulation works
          </button>
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {audiences.map(aud => {
            const isActive = aud === activeAudience;
            return (
              <button
                key={aud}
                type="button"
                onClick={() => {
                  setActiveAudience(aud);
                  setShowDetailedEdits(false);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-black/30 text-[#94A3B8] border border-white/20 hover:border-[#F7931A] hover:text-[#F7931A]'
                }`}
              >
                {formatAudienceLabel(aud)}
              </button>
            );
          })}
        </div>

        {activeAggregate && activeCoaching ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-12">
            <DefiPanel className="lg:col-span-3 rounded-3xl" variant="surface" padding="md">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-sm font-bold text-[#94A3B8] uppercase tracking-wider">Rewritten post for {formatAudienceLabel(activeAudience || '')}</h3>
                {activeSuggestedFix ? (
                  <span className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                    {activeSuggestedFix}
                  </span>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-5">
                <p className="text-sm leading-7 text-[#E2E8F0] whitespace-pre-wrap">
                  {activeRewrite || 'A rewritten post is not available for this saved result. Expand detailed edits to apply the same upgrades manually.'}
                </p>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDetailedEdits(prev => !prev)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#CBD5E1] hover:text-white"
                >
                  <PencilLine className="h-4 w-4" />
                  {showDetailedEdits ? 'Hide detailed edit plan' : 'Show detailed edit plan'}
                  {showDetailedEdits ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showDetailedEdits ? (
                  <ul className="mt-4 space-y-2 text-sm text-[#CBD5E1]">
                    {activeEditList.length > 0 ? activeEditList.map(item => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-600" />
                        <span>{item}</span>
                      </li>
                    )) : (
                      <li className="text-[#94A3B8]">No concrete draft edits were generated.</li>
                    )}
                  </ul>
                ) : null}
              </div>
            </DefiPanel>

            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#0B0D12] p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">What&apos;s working</div>
                <p className="mt-2 text-sm leading-relaxed text-[#CBD5E1]">
                  {activeWorkingSummary || 'This audience sees a few strong signals, but nothing distinct enough to summarize yet.'}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0B0D12] p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">What&apos;s not working</div>
                <p className="mt-2 text-sm leading-relaxed text-[#CBD5E1]">
                  {activeLosingSummary || 'There is no clear drop-off pattern yet for this audience.'}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <h4 className="font-semibold text-[#064E3B]">Keep</h4>
                </div>
                <ul className="space-y-2 text-sm text-slate-700">
                  {activeKeepList.length > 0 ? activeKeepList.map(item => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      <span>{item}</span>
                    </li>
                  )) : (
                    <li className="text-slate-500">No standout strengths detected.</li>
                  )}
                </ul>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <h4 className="font-semibold text-slate-900">Trim or clarify</h4>
                </div>
                <ul className="space-y-2 text-sm text-slate-700">
                  {activeLoseList.length > 0 ? activeLoseList.map(item => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-600" />
                      <span>{item}</span>
                    </li>
                  )) : (
                    <li className="text-slate-500">No major drop-off risk detected.</li>
                  )}
                </ul>
              </div>

              {activeAggregate.dangerous_reply ? (
                <div className="p-4 bg-red-500/10 rounded-2xl border border-red-400/30">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <h4 className="font-semibold text-red-800 text-sm">Risky reaction this draft could trigger</h4>
                  </div>
                  <p className="text-sm text-red-700 italic">&quot;{activeAggregate.dangerous_reply}&quot;</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeAggregate && activePromptVersion === 'v2' ? (
          <div className="mb-12 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-heading font-bold tracking-tight mb-1">Audience Simulation Breakdown</h2>
                <p className="text-sm text-[#94A3B8]">Compact highlights are shown first. Expand full report only when needed.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowV2DeepDive(prev => !prev)}
                className={defiButtonVariants({ variant: 'outline', size: 'sm' })}
              >
                {showV2DeepDive ? 'Hide full report' : 'Show full report'}
                {showV2DeepDive ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DefiPanel variant="surface" padding="md" className="rounded-2xl">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Predicted engagement</div>
                <p className="text-sm text-white mt-2">
                  {activeAggregate?.engagement_prediction?.estimated_engagement_rate || 'Not generated'}
                </p>
                <p className="text-xs text-[#94A3B8] mt-2">{activeAggregate?.engagement_prediction?.potential_reach || 'Potential reach was not generated.'}</p>
              </DefiPanel>

              <DefiPanel variant="surface" padding="md" className="rounded-2xl">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Most likely segments</div>
                <ul className="mt-2 space-y-1 text-sm text-[#CBD5E1]">
                  {v2LikelySegments.length > 0 ? v2LikelySegments.slice(0, 3).map(item => <li key={item}>- {item}</li>) : <li>No segment breakdown available.</li>}
                </ul>
              </DefiPanel>

              <DefiPanel variant="surface" padding="md" className="rounded-2xl">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Top strengths</div>
                <ul className="mt-2 space-y-1 text-sm text-[#CBD5E1]">
                  {v2StrengthHighlights.length > 0 ? v2StrengthHighlights.map(item => <li key={item}>- {item}</li>) : <li>No strengths section was generated.</li>}
                </ul>
              </DefiPanel>

              <DefiPanel variant="surface" padding="md" className="rounded-2xl">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Top risks</div>
                <ul className="mt-2 space-y-1 text-sm text-[#CBD5E1]">
                  {v2WeaknessHighlights.length > 0 ? v2WeaknessHighlights.map(item => <li key={item}>- {item}</li>) : <li>No weaknesses section was generated.</li>}
                </ul>
              </DefiPanel>
            </div>

            <DefiPanel variant="surface" padding="md" className="rounded-2xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Top recommendations</div>
              <ol className="mt-3 space-y-2 text-sm text-[#CBD5E1] list-decimal pl-5">
                {v2RecommendationHighlights.length > 0 ? v2RecommendationHighlights.map((action, index) => (
                  <li key={`${action}-${index}`}>
                    <div className="font-semibold text-white">{action}</div>
                  </li>
                )) : <li>No recommendations section was generated.</li>}
              </ol>
            </DefiPanel>

            {showV2DeepDive ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DefiPanel variant="surface" padding="md" className="rounded-2xl">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Engagement factors</div>
                    <ul className="mt-2 space-y-2 text-sm text-[#CBD5E1]">
                      {v2KeyFactors.length > 0 ? v2KeyFactors.map(item => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-500" />
                          <span>{item}</span>
                        </li>
                      )) : <li>No factor analysis available.</li>}
                    </ul>
                  </DefiPanel>

                  <DefiPanel variant="surface" padding="md" className="rounded-2xl">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Detailed recommendations</div>
                    <ol className="mt-3 space-y-3 text-sm text-[#CBD5E1] list-decimal pl-5">
                      {v2Recommendations.length > 0 ? v2Recommendations.map((item, index) => (
                        <li key={`${item.action}-${index}`}>
                          <div className="font-semibold text-white">{item.action || 'Recommendation'}</div>
                          {item.why ? <div className="text-[#94A3B8] mt-1">Why: {item.why}</div> : null}
                          {item.example ? <div className="text-[#94A3B8] mt-1">Example: {item.example}</div> : null}
                        </li>
                      )) : <li>No recommendations section was generated.</li>}
                    </ol>
                  </DefiPanel>
                </div>

                {v2Personas.length > 0 ? (
                  <DefiPanel variant="surface" padding="md" className="rounded-2xl">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Persona reactions from target audience</div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {v2Personas.map((persona, index) => (
                        <div key={`${persona.title}-${index}`} className="rounded-xl border border-white/10 bg-black/25 p-4">
                          <div className="font-semibold text-white">{persona.title || `Persona ${index + 1}`}</div>
                          {persona.description ? <p className="text-sm text-[#CBD5E1] mt-2">{persona.description}</p> : null}
                          {persona.likely_reaction ? <p className="text-xs text-[#94A3B8] mt-2"><span className="font-semibold">Likely reaction:</span> {persona.likely_reaction}</p> : null}
                          {persona.influencing_elements ? <p className="text-xs text-[#94A3B8] mt-1"><span className="font-semibold">Influencing elements:</span> {persona.influencing_elements}</p> : null}
                          {persona.relationship_to_goals ? <p className="text-xs text-[#94A3B8] mt-1"><span className="font-semibold">Relationship to goals:</span> {persona.relationship_to_goals}</p> : null}
                        </div>
                      ))}
                    </div>
                  </DefiPanel>
                ) : null}

                {(v2OriginalExcerpt || v2RevisedExcerpt) ? (
                  <DefiPanel variant="surface" padding="md" className="rounded-2xl">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Revised post example</div>
                    {v2OriginalExcerpt ? (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-[#94A3B8] uppercase">Original excerpt</div>
                        <p className="mt-1 text-sm text-[#CBD5E1] whitespace-pre-wrap">{v2OriginalExcerpt}</p>
                      </div>
                    ) : null}
                    {v2RevisedExcerpt ? (
                      <div className="mt-4">
                        <div className="text-xs font-semibold text-[#94A3B8] uppercase">Revised excerpt</div>
                        <p className="mt-1 text-sm text-white whitespace-pre-wrap">{v2RevisedExcerpt}</p>
                      </div>
                    ) : null}
                  </DefiPanel>
                ) : null}

                {v2Analysis ? (
                  <DefiPanel variant="surface" padding="md" className="rounded-2xl">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Detailed analysis (stored, hidden by default)</div>
                      <button
                        type="button"
                        onClick={() => setShowFullAnalysis(prev => !prev)}
                        className={defiButtonVariants({ variant: 'outline', size: 'sm' })}
                      >
                        {showFullAnalysis ? 'Hide analysis' : 'Show analysis'}
                      </button>
                    </div>
                    {showFullAnalysis ? (
                      <pre className="mt-4 whitespace-pre-wrap text-xs text-[#CBD5E1] bg-black/25 p-4 rounded-xl border border-white/10">
                        {v2Analysis}
                      </pre>
                    ) : null}
                  </DefiPanel>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link 
            href="/simulate" 
            className={defiButtonVariants({ variant: 'outline', size: 'lg' })}
          >
            Revise & Simulate Again
          </Link>
          <button 
            className={`px-8 py-4 rounded-full font-semibold transition-colors shadow-lg flex items-center justify-center gap-2 uppercase tracking-wider ${
              isSaved 
                ? 'bg-emerald-500 text-white shadow-emerald-500/30 cursor-default'
                : 'bg-gradient-to-r from-[#EA580C] to-[#F7931A] text-white hover:brightness-110 shadow-orange-500/35'
            }`}
            onClick={handleSave}
            disabled={isSaved || isSaving}
          >
            {isSaving && <Loader2 className="w-5 h-5 animate-spin" />}
            {isSaved ? 'Results Saved ✓' : 'Save Results'}
          </button>
        </div>
      </main>

      {showMethodology ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#07080D] p-6 md:p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-heading font-bold tracking-tight text-white">How This Simulation Works</h2>
                <p className="mt-2 text-sm text-[#94A3B8] max-w-2xl">
                  These are simulated audience reactions based on persona profiles and weighted scoring logic. They are directional guidance, not guaranteed outcomes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMethodology(false)}
                className="rounded-full p-2 text-[#94A3B8] hover:bg-white/10 hover:text-white"
                aria-label="Close methodology"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Pipeline</h3>
                <ol className="mt-3 space-y-2 text-sm text-slate-700 list-decimal pl-4">
                  <li>Generate 5 personas per selected audience from persona libraries.</li>
                  <li>Personalize personas using your LinkedIn audience profile (if available).</li>
                  <li>Simulate one reaction per persona (like/comment/scroll + tone).</li>
                  <li>Calculate deterministic metrics from all simulated reactions.</li>
                  <li>Generate coaching + rewritten post for each audience.</li>
                </ol>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Engagement Score Formula</h3>
                <p className="mt-3 text-sm text-slate-700 leading-6">
                  Engagement = 0.40 x Stop Scrolling + 0.30 x Would Like + 0.30 x Would Comment
                </p>
                {activeAggregate ? (
                  <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-slate-700">
                    <div className="font-semibold text-slate-900 mb-1">For {formatAudienceLabel(activeAudience || '')}</div>
                    <div>
                      0.40 x {activeAggregate.would_stop_scrolling_pct || 0} + 0.30 x {activeAggregate.would_like_pct || 0} + 0.30 x {activeAggregate.would_comment_pct || 0} = <span className="font-semibold">{formulaScore}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">Displayed score: {activeAggregate.engagement_score || 0}</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Persona Counts Used</h3>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                {audiences.map(aud => {
                  const personaCount = (personas_json[aud] || []).length;
                  const reactionCount = (reactions_json[aud] || []).length;
                  return (
                    <div key={aud} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="font-semibold text-slate-900">{formatAudienceLabel(aud)}</div>
                      <div className="mt-1 text-slate-600">Personas: {personaCount}</div>
                      <div className="text-slate-600">Reactions: {reactionCount}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Persona Attributes</h3>
              <p className="mt-2 text-sm text-slate-600">
                Inspect the exact persona profiles used to simulate reactions.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {audiences.map(aud => (
                  <button
                    key={aud}
                    type="button"
                    onClick={() => setActivePersonaAudience(aud)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      aud === personaInspectorAudience
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {formatAudienceLabel(aud)}
                  </button>
                ))}
              </div>

              {inspectedPersonas.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {inspectedPersonas.map((persona: any) => (
                    <div key={persona.id || persona.name} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-slate-900">{persona.name || 'Unnamed persona'}</div>
                        {persona.role ? <span className="text-xs rounded-full bg-slate-200 px-2 py-0.5 text-slate-700">{persona.role}</span> : null}
                        {typeof persona.audience_match_score === 'number' ? (
                          <span className="text-xs rounded-full bg-cyan-100 px-2 py-0.5 text-cyan-800">Match score: {persona.audience_match_score}</span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-xs text-slate-600">
                        {[persona.specialization, persona.career_stage, persona.mindset].filter(Boolean).join(' • ')}
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
                        <div>
                          <div className="font-semibold text-slate-900 mb-1">Resonates with</div>
                          <div>{Array.isArray(persona.what_resonates) ? persona.what_resonates.join(', ') : 'N/A'}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 mb-1">Ignores</div>
                          <div>{Array.isArray(persona.what_they_ignore) ? persona.what_they_ignore.join(', ') : 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-500">Persona details are unavailable for this cached result.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
