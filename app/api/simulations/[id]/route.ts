import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getServiceSupabase();
    
    const { data: simulation, error: simError } = await supabase
      .from('simulations')
      .select('*')
      .eq('id', id)
      .single();

    if (simError || !simulation) {
      return NextResponse.json({ error: 'Simulation not found' }, { status: 404 });
    }

    const { data: results, error: resError } = await supabase
      .from('simulation_results')
      .select('*')
      .eq('simulation_id', id)
      .single();

    if (resError || !results) {
      return NextResponse.json({ error: 'Results not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...simulation,
      results
    });

  } catch (error) {
    console.error("Fetch simulation error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
