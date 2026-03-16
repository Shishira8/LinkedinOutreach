import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';
import { ensureAppUserRecord } from '@/lib/app-user';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getServiceSupabase();
    const appUser = await ensureAppUserRecord(userId);
    
    // Claim the simulation if it currently has no owner
    const { error } = await supabase
      .from('simulations')
      .update({
        clerk_user_id: userId,
        user_id: appUser.id,
      })
      .eq('id', id)
      .is('clerk_user_id', null);

    if (error) {
      console.error("Error claiming simulation:", error);
      return NextResponse.json({ error: 'Failed to claim simulation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Claim simulation error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
