export async function saveFormulario(payload: {
  afirmaciones?: any[];
  competencias?: any[];
  estilos?: any[];
  instrucciones?: any[];
}) {
  try {
    // keep local copy for quick UI feedback / offline fallback
    if (typeof window !== 'undefined') {
      try {
        if (Array.isArray(payload.afirmaciones)) window.localStorage.setItem('formulario_afirmaciones', JSON.stringify(payload.afirmaciones));
        if (Array.isArray(payload.competencias)) window.localStorage.setItem('formulario_competencias', JSON.stringify(payload.competencias));
        if (Array.isArray(payload.estilos)) window.localStorage.setItem('formulario_estilos', JSON.stringify(payload.estilos));
        if (Array.isArray(payload.instrucciones)) window.localStorage.setItem('formulario_instrucciones', JSON.stringify(payload.instrucciones));
      } catch (e) {
        // non-fatal: localStorage may fail on some browsers/origins
        // eslint-disable-next-line no-console
        console.warn('saveFormulario: localStorage write failed', e);
      }
    }

    // persist to server (best-effort)
    try {
      const m = await import('./formularioService');
      await m.persistFormularioToServer({
        afirmaciones: Array.isArray(payload.afirmaciones) && payload.afirmaciones.length > 0 ? payload.afirmaciones : undefined,
        competencias: Array.isArray(payload.competencias) && payload.competencias.length > 0 ? payload.competencias : undefined,
        estilos: Array.isArray(payload.estilos) && payload.estilos.length > 0 ? payload.estilos : undefined,
        instrucciones: Array.isArray(payload.instrucciones) && payload.instrucciones.length > 0 ? payload.instrucciones : undefined,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('saveFormulario: server persist failed', e);
    }
  } catch (err) {
    // eslint-disable-next-line no-consoleafirmaciones:
    console.warn('saveFormulario error', err);
  }
}
