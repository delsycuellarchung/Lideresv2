import { supabase } from './supabaseClient';

export async function persistFormularioToServer(payload: {
  afirmaciones?: any[];
  competencias?: any[];
  estilos?: any[];
  instrucciones?: any[];
}) {
  try {
    const body: any = {};
    if (Array.isArray(payload.afirmaciones) && payload.afirmaciones.length > 0) body.afirmaciones = payload.afirmaciones;
    if (Array.isArray(payload.competencias) && payload.competencias.length > 0) body.competencias = payload.competencias;
    if (Array.isArray(payload.estilos) && payload.estilos.length > 0) body.estilos = payload.estilos;
    if (Array.isArray(payload.instrucciones) && payload.instrucciones.length > 0) body.instrucciones = payload.instrucciones;
    if (Object.keys(body).length === 0) return;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Attempt to include Authorization header with user's access token when available
    try {
      if (supabase && typeof supabase.auth?.getSession === 'function') {
        const sessRes: any = await supabase.auth.getSession();
        const token = sessRes?.data?.session?.access_token || sessRes?.data?.access_token || null;
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      // ignore session read errors
    }

    await fetch('/api/formulario', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    }).catch((e) => {
      console.warn('persistFormularioToServer: POST failed', e);
    });
  } catch (e) {
    console.warn('persistFormularioToServer error', e);
  }
}
