'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useSimulationAuth } from '@/hooks/use-simulation-auth';
import { DefiPanel } from '@/components/ui/defi/panel';
import { DefiInput } from '@/components/ui/defi/input';
import { defiButtonVariants } from '@/components/ui/defi/button';

type UserProfile = {
  full_name?: string;
  current_role?: string;
  target_roles?: string[];
  target_industries?: string[];
  years_experience?: number | null;
  expertise_areas?: string[];
  personal_brand_keywords?: string[];
  writing_tone?: string;
  career_goals?: string;
  call_to_action_preference?: string;
};

function toCsv(list: string[] | undefined) {
  return (list || []).join(', ');
}

function fromCsv(value: string) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export default function ProfilePage() {
  const { isLoaded, isSignedIn } = useSimulationAuth();
  const [form, setForm] = useState<UserProfile>({});
  const [targetRolesCsv, setTargetRolesCsv] = useState('');
  const [targetIndustriesCsv, setTargetIndustriesCsv] = useState('');
  const [expertiseAreasCsv, setExpertiseAreasCsv] = useState('');
  const [brandKeywordsCsv, setBrandKeywordsCsv] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const response = await fetch('/api/user-profile');
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load profile');
        }

        if (payload.profile) {
          setForm(payload.profile);
          setTargetRolesCsv(toCsv(payload.profile.target_roles));
          setTargetIndustriesCsv(toCsv(payload.profile.target_industries));
          setExpertiseAreasCsv(toCsv(payload.profile.expertise_areas));
          setBrandKeywordsCsv(toCsv(payload.profile.personal_brand_keywords));
        }
      } catch (caughtError: any) {
        setError(caughtError.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [isLoaded, isSignedIn]);

  const updateField = (field: keyof UserProfile, value: string | number | null) => {
    setSaved(false);
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/user-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          target_roles: fromCsv(targetRolesCsv),
          target_industries: fromCsv(targetIndustriesCsv),
          expertise_areas: fromCsv(expertiseAreasCsv),
          personal_brand_keywords: fromCsv(brandKeywordsCsv),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save profile');
      }

      setForm(payload.profile || form);
      setTargetRolesCsv(toCsv(payload.profile?.target_roles));
      setTargetIndustriesCsv(toCsv(payload.profile?.target_industries));
      setExpertiseAreasCsv(toCsv(payload.profile?.expertise_areas));
      setBrandKeywordsCsv(toCsv(payload.profile?.personal_brand_keywords));
      setSaved(true);
    } catch (caughtError: any) {
      setError(caughtError.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="defi-page flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F7931A]" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="defi-page flex items-center justify-center px-4">
        <DefiPanel variant="surface" padding="md" className="max-w-lg text-center">
          <h1 className="text-2xl font-heading font-bold text-white">Sign in to set your profile</h1>
          <p className="text-sm text-[#94A3B8] mt-2">Your profile improves audience simulation quality and recommendation relevance.</p>
          <div className="mt-5 flex justify-center">
            <Link href="/sign-in?redirect_url=/profile" className={defiButtonVariants()}>Sign in</Link>
          </div>
        </DefiPanel>
      </div>
    );
  }

  return (
    <div className="defi-page pb-24">
      <header className="defi-nav">
        <div className="defi-container py-6 flex justify-between items-center">
          <Link href="/" className="text-xl defi-logo">ReplyMind</Link>
          <Link href="/simulate" className="text-sm font-medium uppercase tracking-wider defi-link">
            Back to simulate
          </Link>
        </div>
      </header>

      <main className="defi-container pt-8 max-w-3xl">
        <h1 className="text-3xl font-heading font-bold tracking-tight mb-2">Personal Brand Profile</h1>
        <p className="text-[#94A3B8] mb-8">This context is injected into simulation prompts to align feedback with your career goals.</p>

        <DefiPanel variant="surface" padding="md" className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Full name</label>
              <DefiInput value={form.full_name || ''} onChange={(event) => updateField('full_name', event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Current role</label>
              <DefiInput value={form.current_role || ''} onChange={(event) => updateField('current_role', event.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Target roles (comma-separated)</label>
              <DefiInput value={targetRolesCsv} onChange={(event) => {
                setSaved(false);
                setTargetRolesCsv(event.target.value);
              }} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Target industries (comma-separated)</label>
              <DefiInput value={targetIndustriesCsv} onChange={(event) => {
                setSaved(false);
                setTargetIndustriesCsv(event.target.value);
              }} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Years of experience</label>
              <DefiInput
                type="number"
                value={form.years_experience ?? ''}
                onChange={(event) => updateField('years_experience', event.target.value ? Number(event.target.value) : null)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Preferred writing tone</label>
              <DefiInput value={form.writing_tone || ''} onChange={(event) => updateField('writing_tone', event.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Expertise areas (comma-separated)</label>
            <DefiInput value={expertiseAreasCsv} onChange={(event) => {
              setSaved(false);
              setExpertiseAreasCsv(event.target.value);
            }} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Personal brand keywords (comma-separated)</label>
            <DefiInput value={brandKeywordsCsv} onChange={(event) => {
              setSaved(false);
              setBrandKeywordsCsv(event.target.value);
            }} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Career goals</label>
            <textarea
              className="w-full h-24 p-4 bg-black/40 border border-white/15 rounded-xl focus:ring-2 focus:ring-[#F7931A] focus:border-[#F7931A] text-white outline-none resize-none transition-all placeholder:text-[#64748B]"
              value={form.career_goals || ''}
              onChange={(event) => updateField('career_goals', event.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">CTA preference</label>
            <DefiInput
              value={form.call_to_action_preference || ''}
              onChange={(event) => updateField('call_to_action_preference', event.target.value)}
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {saved ? (
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Profile saved. New simulations will use this context.
            </div>
          ) : null}

          <div className="flex justify-end">
            <button type="button" className={defiButtonVariants()} onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </DefiPanel>
      </main>
    </div>
  );
}
