import { NextRequest, NextResponse } from 'next/server';
import { supabase as clientSupabase } from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, evaluatorName, evaluadoNombre, evaluadoCodigo, responses } = body || {};

    if (!responses) {
      return NextResponse.json({ error: 'Missing responses' }, { status: 400 });
    }

    const disableDb = String(process.env.NEXT_PUBLIC_DISABLE_DB || process.env.DISABLE_DB || '').toLowerCase() === 'true';

    if (disableDb) {
      return NextResponse.json({ success: true, id: `local_${Date.now()}`, message: 'DB disabled via env; not persisted server-side' });
    }

    // Ensure we have a server-side Supabase client. Prefer imported client, otherwise try to create one with service key.
    let supabase = clientSupabase as any;
    if (!supabase) {
      const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) {
        supabase = createClient(url, key);
      }
    }

    if (!supabase) {
      return NextResponse.json({ error: 'No Supabase client available on server' }, { status: 500 });
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
