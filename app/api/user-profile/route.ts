import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getServiceSupabase } from '@/lib/supabase';
import { type UserBrandProfile } from '@/lib/simulation-v2';

type UserProfilePayload = Omit<UserBrandProfile, 'clerk_user_id' | 'updated_at'>;

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map(item => String(item || '').trim())
    .filter(Boolean);
}

function isMissingColumnError(error: any, columnName: string) {
  return error?.code === 'PGRST204' && String(error?.message || '').includes(`'${columnName}'`);
}

function normalizeProfileShape(profile: any) {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    current_role: profile.current_role || profile.current_job_role || '',
  };
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('user_brand_profiles')
      .select('*')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load user profile', error);
      return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
    }

    return NextResponse.json({ profile: normalizeProfileShape(data) });
  } catch (error) {
    console.error('User profile GET error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json() as UserProfilePayload;

    const baseProfile = {
      clerk_user_id: userId,
      full_name: String(payload.full_name || '').trim(),
      target_roles: toStringArray(payload.target_roles),
      target_industries: toStringArray(payload.target_industries),
      years_experience: typeof payload.years_experience === 'number' ? payload.years_experience : null,
      expertise_areas: toStringArray(payload.expertise_areas),
      personal_brand_keywords: toStringArray(payload.personal_brand_keywords),
      writing_tone: String(payload.writing_tone || '').trim(),
      career_goals: String(payload.career_goals || '').trim(),
      call_to_action_preference: String(payload.call_to_action_preference || '').trim(),
      updated_at: new Date().toISOString(),
    };

    const supabase = getServiceSupabase();
    let { data, error } = await supabase
      .from('user_brand_profiles')
      .upsert(
        {
          ...baseProfile,
          current_role: String(payload.current_role || '').trim(),
        },
        { onConflict: 'clerk_user_id' },
      )
      .select('*')
      .single();

    if (error && isMissingColumnError(error, 'current_role')) {
      const fallbackWrite = await supabase
        .from('user_brand_profiles')
        .upsert(
          {
            ...baseProfile,
            current_job_role: String(payload.current_role || '').trim(),
          },
          { onConflict: 'clerk_user_id' },
        )
        .select('*')
        .single();

      data = fallbackWrite.data;
      error = fallbackWrite.error;
    }

    if (error) {
      console.error('Failed to save user profile', error);
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
    }

    return NextResponse.json({ profile: normalizeProfileShape(data) });
  } catch (error) {
    console.error('User profile POST error', error);
    return NextResponse.json({ error: 'Invalid profile payload' }, { status: 400 });
  }
}
