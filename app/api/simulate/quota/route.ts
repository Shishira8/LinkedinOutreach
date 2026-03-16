import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getServiceSupabase } from '@/lib/supabase';

const SIGNED_IN_SIMULATION_LIMIT = 5;

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({
        limit: SIGNED_IN_SIMULATION_LIMIT,
        used: 0,
        remaining: SIGNED_IN_SIMULATION_LIMIT,
        isSignedIn: false,
      });
    }

    const supabase = getServiceSupabase();
    const { count, error } = await supabase
      .from('simulations')
      .select('id', { count: 'exact', head: true })
      .eq('clerk_user_id', userId);

    if (error) {
      console.error('Failed to load simulation quota', error);
      return NextResponse.json({ error: 'Failed to load simulation quota' }, { status: 500 });
    }

    const used = count || 0;
    const remaining = Math.max(0, SIGNED_IN_SIMULATION_LIMIT - used);

    return NextResponse.json({
      limit: SIGNED_IN_SIMULATION_LIMIT,
      used,
      remaining,
      isSignedIn: true,
    });
  } catch (error) {
    console.error('Simulation quota GET error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
