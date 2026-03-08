'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useSimulationAuth } from '@/hooks/use-simulation-auth';
import { useRouter } from 'next/navigation';
import { normalizeAudienceAggregates } from '@/lib/scoring';

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

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getToneColor = (tone: string) => {
    switch (tone?.toLowerCase()) {
      case 'positive': return 'border-emerald-500 bg-emerald-50 text-emerald-700';
      case 'neutral': return 'border-amber-500 bg-amber-50 text-amber-700';
      case 'negative':
      case 'skeptical': return 'border-red-500 bg-red-50 text-red-700';
      default: return 'border-slate-300 bg-slate-50 text-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center border-b border-slate-200">
        <Link href="/" className="text-xl font-bold text-[#0A66C2] tracking-tight">ReplyMind</Link>
        <Link href="/simulate" className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> New Simulation
        </Link>
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

        {/* SECTION 2 - Reply Threads */}
        <h2 className="text-2xl font-bold tracking-tight mb-6">Simulated Reactions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {audiences.map(aud => {
            const reactions = reactions_json[aud] || [];
            return (
              <div key={aud} className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                  {aud.replace('_', ' ')}
                </h3>
                {reactions.map((r: any, i: number) => {
                  const toneClass = getToneColor(r.reaction.tone);
                  return (
                    <div key={i} className={`bg-white rounded-xl shadow-sm border-l-4 ${toneClass.split(' ')[0]} border-y border-r border-slate-200 p-4`}>
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm shrink-0">
                          {getInitials(r.persona.name)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{r.persona.name}</div>
                          <div className="text-xs text-slate-500 line-clamp-1">{r.persona.role}</div>
                        </div>
                      </div>
                      
                      <div className="text-xs font-semibold uppercase tracking-wider mb-2 opacity-70">
                        {r.reaction.action === 'scroll_past' ? 'Scrolled Past' : r.reaction.action}
                      </div>
                      
                      {r.reaction.comment && (
                        <p className="text-sm text-slate-700 mb-3">&quot;{r.reaction.comment}&quot;</p>
                      )}
                      
                      <div className="text-xs italic text-slate-500 bg-slate-50 p-2 rounded">
                        💭 &quot;{r.reaction.almost_changed_mind_because}&quot;
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* SECTION 3 - Coaching Panel */}
        <h2 className="text-2xl font-bold tracking-tight mb-6">Coaching & Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {audiences.map(aud => {
            const agg = aggregate_json[aud];
            if (!agg || !agg.coaching) return null;
            return (
              <div key={aud} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                  {aud.replace('_', ' ')}
                </h3>
                
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-emerald-500">✅</span>
                    <h4 className="font-semibold text-slate-800">What&apos;s working</h4>
                  </div>
                  <p className="text-sm text-slate-600">{agg.coaching.whats_working || 'N/A'}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-amber-500">⚠️</span>
                    <h4 className="font-semibold text-slate-800">What&apos;s losing them</h4>
                  </div>
                  <p className="text-sm text-slate-600">{agg.coaching.whats_losing_them || 'N/A'}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-500">✏️</span>
                    <h4 className="font-semibold text-slate-800">Suggested fix</h4>
                  </div>
                  <p className="text-sm text-slate-600">{agg.coaching.suggested_fix || 'N/A'}</p>
                </div>

                {agg.dangerous_reply && (
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-red-500">☠️</span>
                      <h4 className="font-semibold text-red-800 text-sm">Dangerous Reply</h4>
                    </div>
                    <p className="text-xs text-red-700 italic">&quot;{agg.dangerous_reply}&quot;</p>
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
