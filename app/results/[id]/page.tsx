'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft, AlertTriangle, CheckCircle2, PencilLine, ChevronDown, ChevronUp, Info, X } from 'lucide-react';
import { useSimulationAuth } from '@/hooks/use-simulation-auth';
import { useRouter } from 'next/navigation';
import { normalizeAudienceAggregates } from '@/lib/scoring';

type CoachingShape = {
  whats_working_summary?: string;
  whats_working?: string[] | string;
  whats_losing_them_summary?: string;
  whats_losing_them?: string[] | string;
  edits_to_add?: string[] | string;
  suggested_fix?: string[] | string;
  rewritten_post?: string;
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="text-red-500 mb-4">{error || 'Results not found'}</div>
        <Link href="/simulate" className="text-blue-500 hover:underline">Try again</Link>
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
  const activeRewrite = activeCoaching?.rewritten_post?.trim() || data?.post_text?.trim() || '';
  const formulaScore = activeAggregate
    ? Math.round(
        (activeAggregate.would_stop_scrolling_pct || 0) * 0.4 +
        (activeAggregate.would_like_pct || 0) * 0.3 +
        (activeAggregate.would_comment_pct || 0) * 0.3,
      )
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      <header className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 flex justify-between items-center border-b border-slate-200">
        <Link href="/" className="text-xl font-bold text-[#0A66C2] tracking-tight">ReplyMind</Link>
        <div className="flex items-center gap-5">
          {isSignedIn ? (
            <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Dashboard
            </Link>
          ) : null}
          <Link href="/simulate" className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" /> New Simulation
          </Link>
        </div>
      </header>

      <main className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 pt-8">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Simulation Results</h1>
        <p className="text-sm text-slate-500 mb-8 max-w-3xl">
          Engagement scores are normalized from simulated attention, likes, and comments so you can compare future runs on the same scale.
        </p>

        {/* SECTION 1 - Engagement Scores */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => setShowPerformanceDetails(prev => !prev)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {showPerformanceDetails ? 'Hide performance breakdown' : 'Show performance breakdown'}
            {showPerformanceDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {!showPerformanceDetails && audiences.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Top audience snapshot</div>
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
                  <div className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">{formatAudienceLabel(topAudience)}</span>
                    <span className="mx-2 text-slate-400">•</span>
                    <span>{topAgg.engagement_score || 0}/100</span>
                    <span className="mx-2 text-slate-400">•</span>
                    <span>Stop: {topAgg.would_stop_scrolling_pct || 0}%</span>
                    <span className="mx-2 text-slate-400">•</span>
                    <span>Like: {topAgg.would_like_pct || 0}%</span>
                    <span className="mx-2 text-slate-400">•</span>
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
                  <div key={aud} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                      {aud.replace('_', ' ')}
                    </h3>
                    <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 mb-4">
                      Normalized score
                    </div>
                    <div className="flex items-end gap-2 mb-6">
                      <div className="text-5xl font-light text-slate-800">{agg.engagement_score || 0}</div>
                      <div className="text-lg text-slate-400 mb-1">/100</div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Stop Scrolling</span>
                        <span className="font-semibold text-slate-700">{agg.would_stop_scrolling_pct || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${agg.would_stop_scrolling_pct || 0}%` }}></div>
                      </div>

                      <div className="flex justify-between items-center text-sm pt-2">
                        <span className="text-slate-500">Would Like</span>
                        <span className="font-semibold text-slate-700">{agg.would_like_pct || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${agg.would_like_pct || 0}%` }}></div>
                      </div>

                      <div className="flex justify-between items-center text-sm pt-2">
                        <span className="text-slate-500">Would Comment</span>
                        <span className="font-semibold text-slate-700">{agg.would_comment_pct || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
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
            <h2 className="text-2xl font-bold tracking-tight mb-2">Audience Rewrite Studio</h2>
            <p className="text-sm text-slate-500 mb-2 max-w-3xl">
              View one audience at a time. The rewritten version below already incorporates draft upgrades so you can iterate faster.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMethodology(true)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
                    : 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                {formatAudienceLabel(aud)}
              </button>
            );
          })}
        </div>

        {activeAggregate && activeCoaching ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-12">
            <div className="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Rewritten post for {formatAudienceLabel(activeAudience || '')}</h3>
                {activeSuggestedFix ? (
                  <span className="inline-flex items-center rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                    {activeSuggestedFix}
                  </span>
                ) : null}
              </div>

              <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5">
                <p className="text-sm leading-7 text-slate-800 whitespace-pre-wrap">
                  {activeRewrite || 'A rewritten post is not available for this saved result. Expand detailed edits to apply the same upgrades manually.'}
                </p>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDetailedEdits(prev => !prev)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
                >
                  <PencilLine className="h-4 w-4" />
                  {showDetailedEdits ? 'Hide detailed edit plan' : 'Show detailed edit plan'}
                  {showDetailedEdits ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showDetailedEdits ? (
                  <ul className="mt-4 space-y-2 text-sm text-slate-700">
                    {activeEditList.length > 0 ? activeEditList.map(item => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-600" />
                        <span>{item}</span>
                      </li>
                    )) : (
                      <li className="text-slate-500">No concrete draft edits were generated.</li>
                    )}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">What&apos;s working</div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {activeWorkingSummary || 'This audience sees a few strong signals, but nothing distinct enough to summarize yet.'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">What&apos;s not working</div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {activeLosingSummary || 'There is no clear drop-off pattern yet for this audience.'}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <h4 className="font-semibold text-slate-900">Keep</h4>
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
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
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

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link 
            href="/simulate" 
            className="px-8 py-4 bg-white text-slate-700 border border-slate-300 rounded-full font-semibold hover:bg-slate-50 transition-colors text-center"
          >
            Revise & Simulate Again
          </Link>
          <button 
            className={`px-8 py-4 rounded-full font-semibold transition-colors shadow-lg flex items-center justify-center gap-2 ${
              isSaved 
                ? 'bg-emerald-500 text-white shadow-emerald-500/30 cursor-default'
                : 'bg-[#0A66C2] text-white hover:bg-[#004182] shadow-blue-500/30'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">How This Simulation Works</h2>
                <p className="mt-2 text-sm text-slate-600 max-w-2xl">
                  These are simulated audience reactions based on persona profiles and weighted scoring logic. They are directional guidance, not guaranteed outcomes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMethodology(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
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
