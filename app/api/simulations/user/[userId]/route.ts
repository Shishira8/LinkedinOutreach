import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const supabase = getServiceSupabase();
    
    const { data: simulations, error } = await supabase
      .from('simulations')
      .select('*')
      .eq('clerk_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch simulations' }, { status: 500 });
    }

    return NextResponse.json(simulations);

  } catch (error) {
    console.error("Fetch user simulations error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
