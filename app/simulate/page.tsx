'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useSimulationAuth } from '@/hooks/use-simulation-auth';
import { LinkedInTrendsPanel } from './linkedin-trends-panel';
import type { EngagementSeriesPoint, PerformanceInsight, TopPost } from '@/lib/linkedin-analytics';
import { DefiPanel } from '@/components/ui/defi/panel';
import { DefiBadge } from '@/components/ui/defi/badge';
import { DefiInput } from '@/components/ui/defi/input';
import { defiButtonVariants } from '@/components/ui/defi/button';

const LINKEDIN_ANALYTICS_URL = 'https://www.linkedin.com/analytics/creator/audience/?timeRange=past_90_days';

type AudienceProfile = {
  summary: string;
  top_industries: Array<{ label: string; weight: number }>;
  top_job_functions: Array<{ label: string; weight: number }>;
  top_seniority: Array<{ label: string; weight: number }>;
  audience_biases: string[];
};

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

export default function SimulatePage() {
  const [postText, setPostText] = useState('');
  const [audiences, setAudiences] = useState({
    hiring_managers: true,
    peers: true,
    domain_experts: true,
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyticsProfile, setAnalyticsProfile] = useState<AudienceProfile | null>(null);
  const [engagementSeries, setEngagementSeries] = useState<EngagementSeriesPoint[]>([]);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [performanceInsights, setPerformanceInsights] = useState<PerformanceInsight[]>([]);
  const [analyticsFileName, setAnalyticsFileName] = useState<string | null>(null);
  const [analyticsImportedAt, setAnalyticsImportedAt] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsLoadNotice, setAnalyticsLoadNotice] = useState<string | null>(null);
  const [isUploadingAnalytics, setIsUploadingAnalytics] = useState(false);
  const [showOptionalImport, setShowOptionalImport] = useState(false);
  const router = useRouter();

  const handleAudienceChange = (key: keyof typeof audiences) => {
    setAudiences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hasSelectedAudience = Object.values(audiences).some(v => v);
  const isValid = postText.trim().length > 0 && hasSelectedAudience;

  const { isLoaded, isSignedIn } = useSimulationAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    const loadLatestAnalyticsImport = async () => {
      try {
        const response = await fetch('/api/linkedin-analytics');
        if (!response.ok) {
          throw new Error('Failed to load your latest LinkedIn audience import.');
        }

        const payload: AnalyticsImportResponse = await response.json();
        if (!payload.import) {
          return;
        }

        setAnalyticsProfile(payload.import.audience_profile_json);
        setEngagementSeries(payload.import.engagement_series_json || []);
        setTopPosts(payload.import.top_posts_json || []);
        setPerformanceInsights(payload.import.performance_insights_json || []);
        setAnalyticsFileName(payload.import.file_name);
        setAnalyticsImportedAt(payload.import.created_at);
      } catch (error: any) {
        setAnalyticsLoadNotice(error.message || 'Failed to load your latest LinkedIn audience import.');
      }
    };

    loadLatestAnalyticsImport();
  }, [isLoaded, isSignedIn]);

  const handleAnalyticsUpload = async () => {
    if (!selectedFile) {
      setAnalyticsError('Choose your exported LinkedIn analytics file first.');
      return;
    }

    setAnalyticsError(null);
    setIsUploadingAnalytics(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/linkedin-analytics', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to upload LinkedIn analytics.');
      }

      setAnalyticsProfile(payload.import.audience_profile_json);
      setEngagementSeries(payload.import.engagement_series_json || []);
      setTopPosts(payload.import.top_posts_json || []);
      setPerformanceInsights(payload.import.performance_insights_json || []);
      setAnalyticsFileName(payload.import.file_name);
      setAnalyticsImportedAt(payload.import.created_at);
      setAnalyticsLoadNotice(null);
      setSelectedFile(null);
    } catch (error: any) {
      setAnalyticsError(error.message || 'Failed to upload LinkedIn analytics.');
    } finally {
      setIsUploadingAnalytics(false);
    }
  };

  const handleSimulate = async () => {
    if (!isValid) return;
    
    setIsSimulating(true);
    
    // Store data in sessionStorage to pass to loading screen
    const selectedAudiences = Object.entries(audiences)
      .filter(([_, isSelected]) => isSelected)
      .map(([key]) => key);
      
    sessionStorage.setItem('simulationData', JSON.stringify({
      post_text: postText,
      selected_audiences: selectedAudiences,
      platform: 'linkedin',
    }));

    router.push('/simulate/loading');
  };

  const formatTopLabels = (entries: Array<{ label: string }> = []) => entries.map(entry => entry.label).join(', ');

  return (
    <div className="defi-page">
      <header className="defi-nav">
        <div className="defi-container py-6 flex justify-between items-center">
        <Link href="/" className="text-xl defi-logo">ReplyMind</Link>
        {isSignedIn ? (
          <Link href="/dashboard" className="text-sm font-medium uppercase tracking-wider defi-link">
            Dashboard
          </Link>
        ) : null}
        </div>
      </header>

      <main className="defi-container pt-8 pb-24">
        <h1 className="text-3xl font-heading font-bold tracking-tight mb-2">New Simulation</h1>
        <p className="text-[#94A3B8] mb-8">Paste your draft and select who you want to test it with.</p>

        <div className="space-y-8">
          <DefiPanel variant="surface" padding="md" className="rounded-2xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <DefiBadge variant="orange" className="mb-2">Optional personalization</DefiBadge>
                <h2 className="text-lg font-heading font-bold tracking-tight text-white">LinkedIn Audience Import</h2>
                <p className="text-sm text-[#94A3B8] leading-relaxed mt-1">
                  Skip this to simulate immediately, or connect your audience export to generate personalized personas.
                </p>
                {analyticsProfile ? (
                  <p className="text-xs font-semibold text-emerald-400 mt-2">Audience profile connected and ready.</p>
                ) : (
                  <p className="text-xs text-[#94A3B8] mt-2">No audience file connected yet.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowOptionalImport(prev => !prev)}
                className={defiButtonVariants({ variant: 'outline' })}
              >
                {showOptionalImport ? 'Hide import setup' : 'Set up personalization'}
                {showOptionalImport ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {showOptionalImport ? (
              <div className="mt-6 border-t border-white/10 pt-6 space-y-4">
                <div className="flex justify-start">
                  <a
                    href={LINKEDIN_ANALYTICS_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={defiButtonVariants({ size: 'md' })}
                  >
                    Open LinkedIn Analytics
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

              {isSignedIn ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Upload exported analytics file</label>
                    <DefiInput
                      type="file"
                      accept=".csv,.xlsx,.xls,.xlsm,.xlsb,.xlxs,.json"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                      className="block h-auto border border-white/20 file:mr-4 file:rounded-full file:border-0 file:bg-[#F7931A] file:px-4 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-wider file:text-white hover:file:bg-[#EA580C]"
                    />
                    <p className="text-xs text-[#94A3B8] mt-2">
                      Supported formats: CSV and spreadsheet exports (.xlsx, .xls, .xlsm, .xlsb, .xlxs). We detect content server-side, so odd LinkedIn extensions are still accepted.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <button
                      type="button"
                      onClick={handleAnalyticsUpload}
                      disabled={!selectedFile || isUploadingAnalytics}
                      className={defiButtonVariants()}
                    >
                      {isUploadingAnalytics ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {isUploadingAnalytics ? 'Uploading analytics...' : 'Upload Analytics File'}
                    </button>
                    {selectedFile ? (
                      <span className="text-sm text-[#94A3B8]">Selected: {selectedFile.name}</span>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-4 text-sm text-amber-200">
                  Sign in to upload your LinkedIn audience export and generate personalized persona packs.
                  <div className="mt-3">
                    <Link href="/sign-in?redirect_url=/simulate" className="font-semibold text-amber-300 underline underline-offset-4">
                      Sign in to personalize simulations
                    </Link>
                  </div>
                </div>
              )}

              {analyticsError ? (
                <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-300">
                  {analyticsError}
                </div>
              ) : null}

              {analyticsLoadNotice ? (
                <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-4 text-sm text-amber-200">
                  {analyticsLoadNotice}
                </div>
              ) : null}

              {analyticsProfile ? (
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm font-bold text-emerald-300 uppercase tracking-wider">Audience profile ready</div>
                      <h3 className="text-lg font-bold text-white mt-1">Personalized persona pack will be used in your next simulation</h3>
                      <p className="text-sm text-[#D1FAE5] mt-2">{analyticsProfile.summary}</p>
                    </div>
                    <div className="text-xs text-emerald-100/80">
                      {analyticsFileName ? <div>File: {analyticsFileName}</div> : null}
                      {analyticsImportedAt ? <div>Imported: {new Date(analyticsImportedAt).toLocaleString()}</div> : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 text-sm">
                    <div>
                      <div className="font-semibold text-white">Top industries</div>
                      <div className="text-emerald-100/85 mt-1">{formatTopLabels(analyticsProfile.top_industries) || 'Not detected'}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">Top job functions</div>
                      <div className="text-emerald-100/85 mt-1">{formatTopLabels(analyticsProfile.top_job_functions) || 'Not detected'}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">Top seniority</div>
                      <div className="text-emerald-100/85 mt-1">{formatTopLabels(analyticsProfile.top_seniority) || 'Not detected'}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">Audience biases</div>
                      <div className="text-emerald-100/85 mt-1">{analyticsProfile.audience_biases.join(', ') || 'Not detected'}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              {analyticsProfile ? (
                <LinkedInTrendsPanel
                  engagementSeries={engagementSeries}
                  topPosts={topPosts}
                  insights={performanceInsights}
                />
              ) : null}
              </div>
            ) : null}
          </DefiPanel>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Text Area */}
            <DefiPanel className="xl:col-span-2" variant="surface" padding="md">
              <label className="block text-sm font-semibold text-white mb-2">LinkedIn Post Draft</label>
              <textarea
                className="w-full h-72 p-4 bg-black/40 border border-white/15 rounded-xl focus:ring-2 focus:ring-[#F7931A] focus:border-[#F7931A] text-white outline-none resize-none transition-all placeholder:text-[#64748B]"
                placeholder="Paste your LinkedIn post draft here..."
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                maxLength={3000}
              />
              <div className="flex justify-end mt-2 text-xs text-[#94A3B8] font-medium">
                {postText.length} / 3000
              </div>
            </DefiPanel>

            {/* Audiences */}
            <DefiPanel className="xl:col-span-1" variant="surface" padding="md">
              <label className="block text-sm font-semibold text-white mb-4">Select Audiences</label>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/15">
                  <input 
                    type="checkbox" 
                    className="mt-1 w-5 h-5 rounded border-white/30 bg-black/40 text-[#F7931A] focus:ring-[#F7931A]"
                    checked={audiences.hiring_managers}
                    onChange={() => handleAudienceChange('hiring_managers')}
                  />
                  <div>
                    <div className="font-semibold text-white">Hiring Managers (Tech)</div>
                    <div className="text-sm text-[#94A3B8]">How recruiters and EMs evaluate your post</div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/15">
                  <input 
                    type="checkbox" 
                    className="mt-1 w-5 h-5 rounded border-white/30 bg-black/40 text-[#F7931A] focus:ring-[#F7931A]"
                    checked={audiences.peers}
                    onChange={() => handleAudienceChange('peers')}
                  />
                  <div>
                    <div className="font-semibold text-white">Peers</div>
                    <div className="text-sm text-[#94A3B8]">How fellow engineers and professionals see you</div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/15">
                  <input 
                    type="checkbox" 
                    className="mt-1 w-5 h-5 rounded border-white/30 bg-black/40 text-[#F7931A] focus:ring-[#F7931A]"
                    checked={audiences.domain_experts}
                    onChange={() => handleAudienceChange('domain_experts')}
                  />
                  <div>
                    <div className="font-semibold text-white">Domain Experts</div>
                    <div className="text-sm text-[#94A3B8]">How senior leaders and influencers react</div>
                  </div>
                </label>
              </div>
            </DefiPanel>
          </div>

          <div className="flex justify-stretch sm:justify-end">
            <button
              onClick={handleSimulate}
              disabled={!isValid || isSimulating}
              className={`${defiButtonVariants({ size: 'lg' })} w-full sm:w-auto`}
            >
              {isSimulating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Preparing...
                </>
              ) : (
                'Simulate Reactions →'
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
