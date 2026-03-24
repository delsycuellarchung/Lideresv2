import { NextResponse } from 'next/server';
import { supabase as clientSupabase } from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const codigo = String(url.searchParams.get('codigo') || '').trim();
    if (!codigo) return NextResponse.json({ error: 'codigo query param required' }, { status: 400 });

    let supabase = clientSupabase as any;
    if (!supabase) {
      const sUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (sUrl && key) supabase = createClient(sUrl, key);
    }
    if (!supabase) return NextResponse.json({ error: 'Supabase not configured on server' }, { status: 500 });

    // try exact match first, then ilike
    const { data: exact, error: errExact } = await supabase.from('personas').select('id,codigo,nombre,correo,cargo').eq('codigo', codigo).limit(1).maybeSingle();
    if (!errExact && exact) return NextResponse.json({ data: exact });

    const { data, error } = await supabase.from('personas').select('id,codigo,nombre,correo,cargo').ilike('codigo', codigo).limit(1).maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message || error }, { status: 500 });
    }
    return NextResponse.json({ data: data || null });
  } catch (err: any) {
    console.error('Error in admin/personas:', err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
