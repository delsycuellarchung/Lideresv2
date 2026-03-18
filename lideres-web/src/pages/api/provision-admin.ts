import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const secret = String(body.secret || '');
  const email = String(body.email || '').trim();
  const password = String(body.password || '');
  const role = String(body.role || 'Admin');

  if (!secret || secret !== String(process.env.PROVISION_ADMIN_SECRET || '')) {
    return res.status(401).json({ error: 'Invalid secret' });
  }
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Server misconfiguration: supabase keys missing' });

  const client = createClient(supabaseUrl, serviceKey);

  try {
    // Create auth user via admin API. Cast to any to avoid strict typings differences.
    const createRes = await (client as any).auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: email.split('@')[0] },
      app_metadata: { role },
    } as any);

    const user = (createRes?.data && createRes.data.user) || createRes?.user || null;
    if (!user) {
      const errMsg = createRes?.error?.message || JSON.stringify(createRes);
      return res.status(500).json({ error: 'Could not create user', details: errMsg });
    }

    // Provision user in DB (best-effort) if helper exists
    try {
      const { provisionUserInDB } = await import('@/lib/serverAuth');
      await provisionUserInDB(user);
    } catch (provErr) {
      // ignore provisioning errors, user exists in auth at least
    }

    return res.status(200).json({ ok: true, id: user.id, email: user.email });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
