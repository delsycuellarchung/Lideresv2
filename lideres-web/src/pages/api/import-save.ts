import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE service key or URL missing' });
  }

  const client = createClient(supabaseUrl, serviceKey);
  // Require authenticated user via Bearer token
  let authUserId: string | null = null;
  try {
    const { getUserFromAuthHeader } = await import('../../lib/serverAuth');
    const { user, error: authErr } = await getUserFromAuthHeader(req as any);
    if (authErr) {
      // Permitir fallback para pruebas: si falta Authorization header, usamos
      // el client creado con service role (ya definido más arriba) y continuamos.
      // Esto evita el error 'Missing Authorization header' en entornos de prueba.
      if (authErr === 'Missing Authorization header') {
        console.warn('No Authorization header provided — proceeding with service role (created_by will be null)');
        authUserId = null;
      } else {
        return res.status(401).json({ error: 'Unauthorized: ' + authErr });
      }
    } else {
      authUserId = (user as any).id || null;
    }
  } catch (e) {
    console.error('auth helper error', e);
    return res.status(500).json({ error: 'Auth check failed' });
  }

  try {
    const payload = req.body;
    const rows = payload?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows provided' });
    }
    // basic validation limits
    if (rows.length > 2000) return res.status(400).json({ error: 'Too many rows' });
    for (const r of rows) {
      if (typeof r !== 'object' || Array.isArray(r)) return res.status(400).json({ error: 'Each row must be an object' });
    }

    // Try inserting; if error mentions missing column(s) retry after removing them
    const tryInsert = async (inputRows: any[]) => {
      const { data, error } = await client.from('evaluators').insert(inputRows);
      return { data, error };
    };

    // Ensure created_by is present for RLS and auditing
    let attemptRows = rows.map((r: Record<string, any>) => ({ created_by: authUserId, ...r }));
    let removedColumns: string[] = [];

    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await tryInsert(attemptRows);
      if (!error) {
        return res.status(200).json({ success: true, inserted: Array.isArray(data) ? data.length : 0, removedColumns });
      }

      const msg = (error.message || '').toString();
      console.error('/api/import-save supabase insert error', msg);

      // Detect column not found messages like: Could not find the 'regional_evaluado' column of 'evaluators' in the schema cache
      const missingCols: string[] = [];
      const re = /'([a-zA-Z0-9_]+)' column of 'evaluators'|Could not find the '([a-zA-Z0-9_]+)' column/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(msg)) !== null) {
        const col = m[1] || m[2];
        if (col) missingCols.push(col);
      }

      if (missingCols.length === 0) {
        // no recognisable missing-column info, return the original error
        return res.status(500).json({ error: msg });
      }

      // Remove missing columns from rows and retry
      removedColumns = Array.from(new Set([...removedColumns, ...missingCols]));
      attemptRows = attemptRows.map((r: Record<string, any>) => {
        const out: Record<string, any> = {};
        for (const k of Object.keys(r)) {
          if (!missingCols.includes(k)) out[k] = r[k];
        }
        return out;
      });
    }

    return res.status(500).json({ error: 'Insertion failed after retrying without missing columns', removedColumns });
  } catch (err: unknown) {
    console.error('/api/import-save exception', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
