import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body || {};
    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 });

    if (!supabase) return NextResponse.json({ error: 'DB no configurada' }, { status: 500 });

    const { data, error: fetchError } = await supabase
      .from('form_submissions')
      .select('responses, status')
      .eq('token', token)
      .single();

    if (fetchError || !data) {
      return NextResponse.json({ error: 'Token inválido o no encontrado' }, { status: 404 });
    }

    // Check if submission already completed
    if (data.status === 'completed') {
      return NextResponse.json({ claimed: false, reason: 'completed' });
    }

    const existingResponses = (data.responses && typeof data.responses === 'object') ? data.responses as any : {};
    const existingClaimId = existingResponses._claim && existingResponses._claim.id ? existingResponses._claim.id : null;

    // If already claimed, verify cookie
    if (existingClaimId) {
      const cookie = request.cookies.get('submission_claim')?.value || null;
      if (cookie && cookie === existingClaimId) {
        return NextResponse.json({ claimed: true });
      }
      return NextResponse.json({ claimed: false, reason: 'claimed_elsewhere' });
    }

    // Otherwise create a claim and save it inside responses._claim to avoid schema changes
    const claimId = uuidv4();
    const claimMeta = {
      id: claimId,
      claimed_at: new Date().toISOString(),
      user_agent: request.headers.get('user-agent') || null,
      ip: (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null),
    };

    const newResponses = { ...existingResponses, _claim: claimMeta };

    const { error: updateError } = await supabase
      .from('form_submissions')
      .update({ responses: newResponses })
      .eq('token', token);

    if (updateError) {
      console.warn('Error saving claim info:', updateError.message || updateError);
      return NextResponse.json({ error: 'No se pudo crear claim' }, { status: 500 });
    }

    const res = NextResponse.json({ claimed: true });
    res.cookies.set('submission_claim', claimId, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  } catch (err: any) {
    console.error('Error in claim-submission API:', err);
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 });
  }
}
