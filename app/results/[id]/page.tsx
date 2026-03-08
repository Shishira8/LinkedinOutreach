'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft, AlertTriangle, CheckCircle2, PencilLine } from 'lucide-react';
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

  const { results } = data;
  const reactions_json = results?.reactions_json || {};
  const aggregate_json = normalizeAudienceAggregates(reactions_json, results?.aggregate_json || {});
  const audienceSet = new Set<string>(Object.keys(aggregate_json));
  Object.keys(reactions_json).forEach(aud => audienceSet.add(aud));
  const audiences = Array.from(audienceSet);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center border-b border-slate-200">
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

      <main className="w-full max-w-7xl mx-auto px-6 pt-8">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Simulation Results</h1>
        <p className="text-sm text-slate-500 mb-8 max-w-3xl">
          Engagement scores are normalized from simulated attention, likes, comments, and sentiment so you can compare future runs on the same scale.
        </p>

        {/* SECTION 1 - Engagement Scores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
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
                    <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${agg.would_comment_pct || 0}%` }}></div>
                  </div>

                  <div className="flex justify-between items-center text-sm pt-2">
                    <span className="text-slate-500">Sentiment</span>
                    <span className="font-semibold text-slate-700">{agg.sentiment_score || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-slate-700 h-1.5 rounded-full" style={{ width: `${agg.sentiment_score || 0}%` }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* SECTION 2 - Coaching Panel */}
        <h2 className="text-2xl font-bold tracking-tight mb-2">What To Change In The Draft</h2>
        <p className="text-sm text-slate-500 mb-6 max-w-3xl">
          Each card highlights what to keep, what to cut, and the exact lines or additions to test in your next draft.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {audiences.map(aud => {
            const agg = aggregate_json[aud];
            if (!agg || !agg.coaching) return null;
            const coaching = coachingForAudience(agg);
            const keepList = toBulletList(coaching.whats_working || agg.coaching.whats_working, 3);
            const loseList = toBulletList(coaching.whats_losing_them || agg.coaching.whats_losing_them, 3);
            const editList = toBulletList(coaching.edits_to_add || coaching.suggested_fix || agg.coaching.suggested_fix, 5);
            const suggestedFix = toBulletList(coaching.suggested_fix, 1)[0];
            const whatsWorkingSummary = coaching.whats_working_summary || toBulletList(agg.coaching.whats_working, 1)[0];
            const whatsLosingSummary = coaching.whats_losing_them_summary || toBulletList(agg.coaching.whats_losing_them, 1)[0];
            return (
              <div key={aud} className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                    {formatAudienceLabel(aud)}
                  </h3>
                  {suggestedFix ? (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {suggestedFix}
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">What&apos;s working</div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      {whatsWorkingSummary || 'This audience sees a few strong signals, but nothing distinct enough to summarize yet.'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">What&apos;s not working</div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      {whatsLosingSummary || 'There is no clear drop-off pattern yet for this audience.'}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <PencilLine className="h-4 w-4 text-blue-600" />
                    <h4 className="font-semibold text-slate-900">Add these to the draft</h4>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {editList.length > 0 ? editList.map(item => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-600" />
                        <span>{item}</span>
                      </li>
                    )) : (
                      <li className="text-slate-500">No concrete draft edits were generated.</li>
                    )}
                  </ul>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <h4 className="font-semibold text-slate-900">Keep</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-slate-700">
                      {keepList.length > 0 ? keepList.map(item => (
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
                      {loseList.length > 0 ? loseList.map(item => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-600" />
                          <span>{item}</span>
                        </li>
                      )) : (
                        <li className="text-slate-500">No major drop-off risk detected.</li>
                      )}
                    </ul>
                  </div>
                </div>

                {agg.dangerous_reply && (
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <h4 className="font-semibold text-red-800 text-sm">Risky reaction this draft could trigger</h4>
                    </div>
                    <p className="text-sm text-red-700 italic">&quot;{agg.dangerous_reply}&quot;</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-center gap-4">
          <Link 
            href="/simulate" 
            className="px-8 py-4 bg-white text-slate-700 border border-slate-300 rounded-full font-semibold hover:bg-slate-50 transition-colors"
          >
            Revise & Simulate Again
          </Link>
          <button 
            className={`px-8 py-4 rounded-full font-semibold transition-colors shadow-lg flex items-center gap-2 ${
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
    </div>
  );
}
