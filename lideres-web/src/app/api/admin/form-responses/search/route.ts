import { NextResponse } from 'next/server';
import { supabase as clientSupabase } from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const codigo = (url.searchParams.get('codigo') || url.searchParams.get('q') || '').toString().trim();

    let supabase = clientSupabase as any;
    if (!supabase) {
      const urlEnv = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (urlEnv && key) supabase = createClient(urlEnv, key);
    }

    if (!supabase) return NextResponse.json({ error: 'Supabase not configured on server' }, { status: 500 });

    let data: any[] = [];
    // Try exact matches first on evaluado_codigo or token
    if (codigo) {
      try {
        const { data: d1, error: err1 } = await supabase.from('form_responses').select('*').or(`evaluado_codigo.eq.${codigo},token.eq.${codigo}`);
        if (!err1 && Array.isArray(d1) && d1.length) data = d1;
      } catch (e) {
        // continue to name search
      }

      // Fallback: ilike search on evaluado_nombre
      if (!data.length) {
        try {
          const { data: d2, error: err2 } = await supabase.from('form_responses').select('*').ilike('evaluado_nombre', `%${codigo}%`).limit(1000);
          if (!err2 && Array.isArray(d2) && d2.length) data = d2;
        } catch (e) {
          // ignore
        }
      }
    } else {
      // no codigo provided -> return empty
      return NextResponse.json({ rows: [] });
    }

    // normalize
    const normalized = (Array.isArray(data) ? data : []).map((r: any, idx: number) => ({
      id: r.id ?? r._id ?? String(idx),
      createdAt: r.createdAt ?? r.created_at ?? r.created ?? '',
      evaluadoCodigo: r.evaluado_codigo ?? r.evaluadoCodigo ?? r.codigo_evaluado ?? r.codigo ?? '',
      evaluadoNombre: r.evaluado_nombre ?? r.evaluadoNombre ?? r.nombre_evaluado ?? r.nombre ?? '',
      evaluatorName: r.evaluatorName ?? r.evaluator_name ?? r.evaluador ?? r.evaluator ?? '',
      token: r.token ?? r.token_id ?? null,
      responses: r.responses ?? r.respuestas ?? r.answers ?? r.responses ?? {},
    }));

    const evaluadores = new Set(normalized.map((e: any) => ((e.evaluatorName || e.token || e.id || e.createdAt) || '').toString().trim()).filter((x: any) => x));
    const foundCode = normalized.find((e: any) => e.evaluadoCodigo)?.evaluadoCodigo || (normalized[0] && normalized[0].token) || codigo;
    const name = normalized.find((e: any) => e.evaluadoNombre)?.evaluadoNombre || '';

    return NextResponse.json({ codigo: foundCode, nombre: name, evaluadores: evaluadores.size, rows: normalized });
  } catch (err: any) {
    console.error('Error in search route', err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
