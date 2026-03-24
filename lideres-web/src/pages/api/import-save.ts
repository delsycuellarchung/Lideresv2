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

    // Upsert behavior: update existing evaluator rows (match by codigo_evaluado or correo_evaluado), insert new ones
    // Check whether the `created_by` column exists in `evaluators` table.
    // Some deployments may not have this column; avoid referencing it if missing.
    let supportsCreatedBy = true;
    try {
      // Try a harmless select for the column to see if schema knows about it.
      // We limit to 1 row to keep it cheap. Supabase client returns { data, error }.
      const { data: testData, error: testErr } = await client.from('evaluators').select('created_by').limit(1);
      if (testErr) {
        // If Supabase returns an error (for example schema cache missing the column), treat as unsupported.
        console.warn('/api/import-save: created_by column check returned error, skipping created_by injection', testErr?.message || testErr);
        supportsCreatedBy = false;
      }
      // If no error, assume column exists (even if testData is empty).
    } catch (e) {
      console.warn('/api/import-save: created_by column not present (exception), skipping created_by injection', e);
      supportsCreatedBy = false;
    }

    // Ensure created_by is present for RLS and auditing when supported
    const preparedRows: Record<string, any>[] = rows.map((r: Record<string, any>) => (supportsCreatedBy ? ({ created_by: authUserId, ...r }) : ({ ...r })));

    // Collect possible matching keys
    const codes = Array.from(new Set(preparedRows.map(r => (r.codigo_evaluado || '').toString().trim()).filter(Boolean)));
    const emails = Array.from(new Set(preparedRows.map(r => (r.correo_evaluado || '').toString().trim()).filter(Boolean)));

    // Fetch existing records matching codes or emails
    const existingMapByCode: Record<string, any> = {};
    const existingMapByEmail: Record<string, any> = {};
    try {
      if (codes.length > 0) {
        const { data: byCode } = await client.from('evaluators').select('id,codigo_evaluado,correo_evaluador,created_at').in('codigo_evaluado', codes);
        for (const r of (byCode || [])) {
          if (r.codigo_evaluado) existingMapByCode[String(r.codigo_evaluado)] = r;
        }
      }
      if (emails.length > 0) {
        const { data: byEmail } = await client.from('evaluators').select('id,codigo_evaluado,correo_evaluador,created_at').in('correo_evaluador', emails);
        for (const r of (byEmail || [])) {
          if (r.correo_evaluador) existingMapByEmail[String(r.correo_evaluador)] = r;
        }
      }
    } catch (fetchErr) {
      console.error('/api/import-save fetch existing error', fetchErr);
      return res.status(500).json({ error: 'Error fetching existing evaluators', details: String(fetchErr?.message || fetchErr) });
    }

    const toInsert: Record<string, any>[] = [];
    const toUpdate: { id: any; row: Record<string, any> }[] = [];

    for (const r of preparedRows) {
      const code = (r.codigo_evaluado || '').toString().trim();
      const email = (r.correo_evaluado || '').toString().trim();
      const existingByCode = code ? existingMapByCode[code] : null;
      const existingByEmail = email ? existingMapByEmail[email] : null;

      const match = existingByCode || existingByEmail;
      if (match && match.id) {
        // prepare update (do not overwrite created_at or id)
        const upd = { ...r };
        delete upd.id;
        toUpdate.push({ id: match.id, row: upd });
      } else {
        toInsert.push(r);
      }
    }

    let insertedCount = 0;
    let updatedCount = 0;
    try {
      if (toInsert.length > 0) {
        const { data: insData, error: insErr } = await client.from('evaluators').insert(toInsert).select('id');
        if (insErr) {
          console.error('/api/import-save insert error', insErr);
          return res.status(500).json({ error: insErr.message || insErr });
        }
        insertedCount = Array.isArray(insData) ? insData.length : (insData ? 1 : 0);
      }

      // Update rows one by one (could be batched if needed)
      for (const u of toUpdate) {
        const { error: updErr } = await client.from('evaluators').update(u.row).eq('id', u.id);
        if (updErr) {
          console.warn('/api/import-save update warning for id', u.id, updErr.message || updErr);
        } else {
          updatedCount += 1;
        }
      }
    } catch (dbErr) {
      console.error('/api/import-save DB operation error', dbErr);
      return res.status(500).json({ error: 'Error saving import data', details: String(dbErr?.message || dbErr) });
    }

    return res.status(200).json({ success: true, inserted: insertedCount, updated: updatedCount });
  } catch (err: unknown) {
    console.error('/api/import-save exception', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
