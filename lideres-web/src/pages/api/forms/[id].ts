import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Server misconfiguration: SUPABASE URL or service key missing' });

  const client = createClient(supabaseUrl, serviceKey);
  const { id } = req.query as { id: string };

  try {
    // require auth for read/update/delete
    const { getUserFromAuthHeader } = await import('../../../lib/serverAuth');
    const { user, error: authErr } = await getUserFromAuthHeader(req as any);
    if (authErr) return res.status(401).json({ error: 'Unauthorized: ' + authErr });
    const authUserId = (user as any).id || null;

    if (req.method === 'GET') {
      // fetch form
      const { data: forms, error: fErr } = await client.from('forms').select('id, name, slug, current_version_id, created_at, deleted_at').eq('id', id).limit(1).maybeSingle();
      if (fErr) return res.status(500).json({ error: fErr.message });
      if (!forms) return res.status(404).json({ error: 'Form not found' });

      const currentVersionId = (forms as any).current_version_id;
      let versionContent = null;

      if (currentVersionId) {
        const { data: ver, error: verErr } = await client.from('form_versions').select('id, version_number, content, created_at, created_by').eq('id', currentVersionId).limit(1).maybeSingle();
        if (verErr) console.warn('Could not fetch current version', verErr.message);
        if (ver) versionContent = ver;
      }

      // fallback: latest version
      if (!versionContent) {
        const { data: latest, error: latErr } = await client.from('form_versions').select('id, version_number, content, created_at, created_by').eq('form_id', id).order('version_number', { ascending: false }).limit(1).maybeSingle();
        if (latErr) console.warn('Could not fetch latest version', latErr.message);
        if (latest) versionContent = latest;
      }

      return res.status(200).json({ form: forms, version: versionContent });
    }

    if (req.method === 'PUT') {
      // create a new version for this form and update current_version_id
      const body = req.body || {};
      const content = body.content || {};
      const note = body.note || null;
      const created_by = authUserId;

      // compute next version number
      const { data: last, error: lastErr } = await client.from('form_versions').select('version_number').eq('form_id', id).order('version_number', { ascending: false }).limit(1).maybeSingle();
      if (lastErr) return res.status(500).json({ error: lastErr.message });
      const nextNumber = last && (last as any).version_number ? (last as any).version_number + 1 : 1;

      const { data: verData, error: verErr } = await client.from('form_versions').insert([{ form_id: id, version_number: nextNumber, content, note, created_by }]).select('id').single();
      if (verErr || !verData) return res.status(500).json({ error: verErr?.message || 'Failed creating version' });

      const versionId = (verData as any).id;
      const { error: updErr } = await client.from('forms').update({ current_version_id: versionId }).eq('id', id);
      if (updErr) return res.status(500).json({ error: updErr.message });

      return res.status(200).json({ ok: true, versionId, versionNumber: nextNumber });
    }

    if (req.method === 'DELETE') {
      const { error } = await client.from('forms').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('/api/forms/[id] error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
