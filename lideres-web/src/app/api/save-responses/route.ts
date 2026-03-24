import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const { token, responses } = await request.json();

    if (!token || !responses) {
      return NextResponse.json(
        { error: 'Missing token or responses' },
        { status: 400 }
      );
    }

    const disableDb = String(process.env.NEXT_PUBLIC_DISABLE_DB || '').toLowerCase() === 'true';

    if (!supabase || disableDb) {
      return NextResponse.json({
        success: true,
        message: 'Respuestas guardadas localmente',
        id: `local_${Date.now()}`,
      });
    }

    const { data: submission, error: fetchError } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('token', token)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json(
        { error: 'Token invalido o expirado' },
        { status: 404 }
      );
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from('form_submissions')
      .update({
        responses: typeof responses === 'object' && !Array.isArray(responses) 
          ? { ...responses, evaluado_nombre: (submission as any).responses?.evaluado_nombre || (submission as any).form_data?.evaluado_nombre || null }
          : responses,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('token', token)
      .eq('status', 'pending')
      .select('id');

    if (updateError) {
      throw updateError;
    }

    // If no rows were updated, the token was already completed/expired
    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      return NextResponse.json({ error: 'Este formulario ya fue respondido o no está disponible' }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      message: 'Respuestas guardadas correctamente',
      id: submission.id,
    });
  } catch (error: any) {
    console.error('Error saving responses:', error);
    return NextResponse.json(
      { error: error.message || 'Error saving responses' },
      { status: 500 }
    );
  }
}
