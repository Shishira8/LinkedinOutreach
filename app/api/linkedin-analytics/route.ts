import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getServiceSupabase } from '@/lib/supabase';
import { extractAudienceProfile } from '@/lib/linkedin-analytics';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('linkedin_audience_imports')
      .select('id, file_name, file_type, audience_profile_json, created_at')
      .eq('clerk_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching LinkedIn analytics import', error);
      return NextResponse.json({ error: 'Failed to load LinkedIn analytics import' }, { status: 500 });
    }

    return NextResponse.json({ import: data || null });
  } catch (error) {
    console.error('LinkedIn analytics GET error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Sign in to upload LinkedIn analytics.' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing analytics file.' }, { status: 400 });
    }

    const fileName = file.name || 'linkedin-audience-export';
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const audienceProfile = extractAudienceProfile(fileBuffer, fileName);

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('linkedin_audience_imports')
      .insert({
        clerk_user_id: userId,
        file_name: fileName,
        file_type: file.type || 'application/octet-stream',
        row_count: audienceProfile.total_rows,
        raw_columns: audienceProfile.raw_columns,
        audience_profile_json: audienceProfile,
      })
      .select('id, file_name, file_type, audience_profile_json, created_at')
      .single();

    if (error) {
      console.error('Error saving LinkedIn analytics import', error);
      return NextResponse.json({ error: 'Failed to save LinkedIn analytics import' }, { status: 500 });
    }

    return NextResponse.json({ import: data });
  } catch (error: any) {
    console.error('LinkedIn analytics POST error', error);
    return NextResponse.json({ error: error.message || 'Failed to parse LinkedIn analytics file' }, { status: 400 });
  }
}