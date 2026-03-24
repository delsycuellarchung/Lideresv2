import { NextResponse } from 'next/server';
import { supabase as clientSupabase } from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    let supabase = clientSupabase as any;
    // try to create server client if client not configured
    if (!supabase) {
      const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) supabase = createClient(url, key);
    }
    if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    // read optional search param
    const url = new URL(req.url);
    const q = url.searchParams.get('q') || undefined;

    let res;
    if (q) {
      // try simple equality on common code fields, fallback to full select
      try {
        res = await supabase.from('evaluators').select('*').or(`codigo_evaluado.eq.${q},codigo_evaluador.eq.${q}`);
      } catch (e) {
        res = await supabase.from('evaluators').select('*');
      }
    } else {
      res = await supabase.from('evaluators').select('*').limit(10000);
    }

    if (res.error) {
      console.error('Error fetching evaluators:', res.error);
      return NextResponse.json({ error: res.error.message || String(res.error) }, { status: 500 });
    }

    return NextResponse.json({ data: res.data || [] });
  } catch (err: any) {
    console.error('Unexpected error in admin/evaluators:', err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
