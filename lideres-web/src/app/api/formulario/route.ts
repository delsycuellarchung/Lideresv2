import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { afirmaciones, competencias, estilos, instrucciones } = body || {};

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Buscar si ya existe un formulario "default"
    const { data: existing } = await supabase
      .from('forms')
      .select('id, content')
      .eq('name', 'default')
      .single();

    const currentContent = existing?.content || {};

    const newContent = {
      ...currentContent,
      ...(Array.isArray(afirmaciones) && afirmaciones.length > 0 ? { afirmaciones } : {}),
      ...(Array.isArray(competencias) && competencias.length > 0 ? { competencias } : {}),
      ...(Array.isArray(estilos) && estilos.length > 0 ? { estilos } : {}),
      ...(Array.isArray(instrucciones) && instrucciones.length > 0 ? { instrucciones } : {}),
    };

    if (existing?.id) {
      // Actualizar el existente
      const { error } = await supabase
        .from('forms')
        .update({ content: newContent, version: (existing as any).version + 1 || 1 })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      // Crear nuevo
      const { error } = await supabase
        .from('forms')
        .insert({ name: 'default', version: 1, content: newContent });
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error en POST /api/formulario:', err);
    return NextResponse.json({ error: err?.message || 'Error inesperado' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('forms')
      .select('content')
      .eq('name', 'default')
      .single();

    if (error || !data) {
      return NextResponse.json({
        afirmaciones: [],
        competencias: [],
        estilos: [],
        instrucciones: [],
      });
    }

    const content = data.content || {};
    return NextResponse.json({
      afirmaciones: content.afirmaciones || [],
      competencias: content.competencias || [],
      estilos: content.estilos || [],
      instrucciones: content.instrucciones || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error inesperado' }, { status: 500 });
  }
}