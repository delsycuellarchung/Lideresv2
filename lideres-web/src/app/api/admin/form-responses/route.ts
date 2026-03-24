import { NextResponse } from 'next/server';
import { supabase as clientSupabase } from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    let supabase = clientSupabase as any;
    console.debug('api/admin/form-responses - supabase client present?', !!supabase);
    console.debug('api/admin/form-responses - env present', {
      has_NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_SUPABASE_URL: !!process.env.SUPABASE_URL,
      has_service_key: !!process.env.SUPABASE_SERVICE_KEY || !!process.env.SUPABASE_SERVICE_ROLE || !!process.env.SUPABASE_KEY,
    });

    // If clientSupabase is not configured (client-side envs missing), try server service key
    if (!supabase) {
      const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) {
        supabase = createClient(url, key);
      }
    }

    let data: any[] | null = null;
    if (supabase) {
      const { data: sbData, error } = await supabase.from('form_responses').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching form_responses from Supabase:', error);
      } else {
        data = Array.isArray(sbData) ? sbData : [];
        console.debug('api/admin/form-responses - rows fetched from supabase', data.length);
      }
    } else {
      console.debug('api/admin/form-responses - supabase not available, will try file fallback');
    }

    // If supabase returned no rows, try fallback to local uploads-debug JSON (useful for local dev)
    if (!data || data.length === 0) {
      try {
        const candidates = [
          path.resolve(process.cwd(), 'uploads-debug', 'last-import.json'),
          path.resolve(process.cwd(), 'src', 'uploads-debug', 'last-import.json'),
          path.resolve(process.cwd(), 'uploads-debug', 'formulario.json'),
        ];
        let fileContent: string | null = null;
        for (const p of candidates) {
          try {
            if (fs.existsSync(p)) {
              fileContent = fs.readFileSync(p, 'utf8');
              console.debug('api/admin/form-responses - using fallback file', p);
              break;
            }
          } catch (e) {}
        }
        if (fileContent) {
          const parsed = JSON.parse(fileContent);
          // try to extract rows property or raw array
          const rows = Array.isArray(parsed.rows) ? parsed.rows : (Array.isArray(parsed.data) ? parsed.data : (Array.isArray(parsed) ? parsed : []));

          // If the fallback file comes from the spreadsheet import, its columns
          // use localized headers like 'Código del Evaluado', 'Nombre Evaluador', etc.
          // Normalize those rows into the same shape the app expects so pages
          // like reportes can map fields consistently.
          if (rows.length && Object.prototype.hasOwnProperty.call(rows[0], 'Código del Evaluado')) {
            const metaKeys = new Set([
              'Código del Evaluado','Nombre del Evaluado','Cargo del Evaluado','Correo del Evaluado','Área del Evaluado','Gerencia del Evaluado',
              'Código del Evaluador','Nombre Evaluador','Correo del Evaluador','Cargo del Evaluador','Área del Evaluador','Gerencia del Evaluador','Regional del Evaluador',
              '__EMPTY','__EMPTY_1','filename','savedAt'
            ]);
            const normalized = rows.map((r: any) => {
              const codigo = String(r['Código del Evaluado'] ?? r['evaluado_codigo'] ?? r['evaluadoCodigo'] ?? r['Código'] ?? '').trim();
              const nombre = String(r['Nombre del Evaluado'] ?? r['evaluado_nombre'] ?? r['evaluadoNombre'] ?? '').trim();
              const evaluatorName = String(r['Nombre Evaluador'] ?? r['Nombre del Evaluador'] ?? r['evaluator_name'] ?? r['evaluatorName'] ?? '').trim();
              const createdAt = parsed.savedAt || r['savedAt'] || r['Fecha'] || '';
              const responses: Record<string, any> = {};
              Object.keys(r).forEach(k => {
                if (!metaKeys.has(k) && r[k] != null) {
                  responses[String(k).trim()] = r[k];
                }
              });
              return {
                evaluado_codigo: codigo,
                evaluado_nombre: nombre,
                evaluator_name: evaluatorName,
                created_at: createdAt,
                responses,
                token: ''
              };
            });
            data = normalized;
          } else {
            data = rows;
          }
        }
      } catch (e) {
        console.error('Fallback file read failed', e);
      }
    }

    if (!data) data = [];
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Unexpected error in admin/form-responses:', err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
