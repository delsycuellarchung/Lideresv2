import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Server misconfiguration: SUPABASE URL or service key missing' });

  const client = createClient(supabaseUrl, serviceKey);

  try {
    // require auth for list/create
    const { getUserFromAuthHeader } = await import('../../../lib/serverAuth');
    const { user, error: authErr } = await getUserFromAuthHeader(req as any);
    if (authErr) return res.status(401).json({ error: 'Unauthorized: ' + authErr });
    const authUserId = (user as any).id || null;

    if (req.method === 'GET') {
      const { data, error } = await client.from('forms').select('id, name, slug, current_version_id, created_at, deleted_at').order('created_at', { ascending: false }).limit(100);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ forms: data });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const name = String(body.name || 'Untitled');
      const slug = body.slug ? String(body.slug) : null;
      const content = body.content || {};
      const created_by = body.created_by || null;

      // Insert form
      // Use authenticated user as creator
      const { data: formData, error: formError } = await client.from('forms').insert([{ name, slug, created_by: authUserId }]).select('id').single();
      if (formError || !formData) {
        return res.status(500).json({ error: formError?.message || 'Failed creating form' });
      }

      const formId = (formData as any).id;

      // Insert initial version using authenticated user
      const versionRow = { form_id: formId, version_number: 1, content, created_by: authUserId };
      const { data: verData, error: verError } = await client.from('form_versions').insert([versionRow]).select('id').single();
      if (verError || !verData) {
        return res.status(500).json({ error: verError?.message || 'Failed creating initial version' });
      }

      const versionId = (verData as any).id;
      // Update form current_version_id
      const { error: updErr } = await client.from('forms').update({ current_version_id: versionId }).eq('id', formId);
      if (updErr) {
        return res.status(500).json({ error: updErr.message || 'Failed updating form current_version_id' });
      }

      return res.status(200).json({ ok: true, formId, versionId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('/api/forms error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
