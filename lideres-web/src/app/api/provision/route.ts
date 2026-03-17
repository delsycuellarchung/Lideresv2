import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateSSOToken, provisionUserInDB } from '@/lib/serverAuth';

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || '';
    if (!auth.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }
    const token = auth.split(' ')[1];

    const res = await validateSSOToken(token);
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 403 });
    }

    // Provision user in DB (best-effort). If provisioning fails, return warning but allow flow to continue.
    const prov = await provisionUserInDB(res.user);
    if (prov.error) {
      return NextResponse.json({ error: prov.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user: res.user, provision: prov }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ info: 'POST only endpoint to validate SSO token and provision user.' });
}
