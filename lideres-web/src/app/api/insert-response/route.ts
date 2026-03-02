import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, evaluatorName, evaluadoNombre, evaluadoCodigo, responses } = body || {};

    if (!responses) {
      return NextResponse.json({ error: 'Missing responses' }, { status: 400 });
    }

    const disableDb = String(process.env.NEXT_PUBLIC_DISABLE_DB || process.env.DISABLE_DB || '').toLowerCase() === 'true';

    if (!supabase || disableDb) {
      // DB disabled — return success so client can continue using localStorage fallback
      return NextResponse.json({ success: true, id: `local_${Date.now()}`, message: 'DB disabled; not persisted server-side' });
    }

    const payload: any = {
      token: token || null,
      evaluator_name: evaluatorName || null,
      evaluado_nombre: evaluadoNombre || null,
      evaluado_codigo: evaluadoCodigo || null,
      responses: responses || {},
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('form_responses').insert([payload]).select('id').single();

    if (error) {
      console.error('Error inserting form_responses:', error);
      // Do not fail the whole flow for the client; return a non-2xx with message so client can fallback if desired
      return NextResponse.json({ error: error.message || 'DB insert failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id || null });
  } catch (err: any) {
    console.error('Unexpected error in insert-response:', err);
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
