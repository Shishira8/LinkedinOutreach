import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

function isMissingColumnError(error: any, columnName: string) {
  return error?.code === 'PGRST204' && String(error?.message || '').includes(`'${columnName}'`);
}

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

    let { data: results, error: resError } = await supabase
      .from('simulation_results')
      .select('id, simulation_id, personas_json, reactions_json, aggregate_json, prompt_version, report_v2_json, created_at')
      .eq('simulation_id', id)
      .single();

    if (resError && (
      isMissingColumnError(resError, 'prompt_version') ||
      isMissingColumnError(resError, 'report_v2_json')
    )) {
      const legacyRead = await supabase
        .from('simulation_results')
        .select('id, simulation_id, personas_json, reactions_json, aggregate_json, created_at')
        .eq('simulation_id', id)
        .single();

      results = legacyRead.data
        ? {
            ...legacyRead.data,
            prompt_version: 'v1',
            report_v2_json: null,
          }
        : null;
      resError = legacyRead.error;
    }

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
