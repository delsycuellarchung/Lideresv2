"use client";
import React from 'react';

export default function LocalStorageImportPage() {
  const [text, setText] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);

  const handlePasteRestore = () => {
    try {
      const obj = JSON.parse(text);
      if (typeof obj !== 'object' || obj === null) throw new Error('JSON inválido');
      Object.keys(obj).forEach(k => {
        try {
          const v = obj[k];
          window.localStorage.setItem(k, JSON.stringify(v));
        } catch (e) {
          console.warn('no se pudo setear', k, e);
        }
      });
      setMessage('Restauración aplicada. Recarga la página principal para ver cambios.');
    } catch (e: any) {
      setMessage('Error al parsear JSON: ' + (e?.message || String(e)));
    }
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setText(String(ev.target?.result || ''));
    };
    reader.readAsText(file);
  };

  const handleDownloadBackup = () => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('form_') || k.startsWith('formulario_'));
      const out: Record<string, any> = {};
      keys.forEach(k => {
        try { out[k] = JSON.parse(localStorage.getItem(k) || 'null'); } catch { out[k] = localStorage.getItem(k); }
      });
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'localstorage-backup.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage('Backup descargado.');
    } catch (e) {
      setMessage('Error creando backup. Revisa la consola.');
      console.error(e);
    }
  };

  const handleReconstructFromResponses = () => {
    try {
      const raw = window.localStorage.getItem('form_responses') || '[]';
      const responses = JSON.parse(raw) || [];
      const existingA = (() => { try { return JSON.parse(window.localStorage.getItem('formulario_afirmaciones') || '[]') || []; } catch { return []; } })();
      const existingC = (() => { try { return JSON.parse(window.localStorage.getItem('formulario_competencias') || '[]') || []; } catch { return []; } })();

      const afirmMap: Record<string, any> = {};
      existingA.forEach((a: any) => { if (a && a.codigo) afirmMap[String(a.codigo)] = a; });
      const compMap: Record<string, any> = {};
      existingC.forEach((c: any) => { if (c && c.codigo) compMap[String(c.codigo)] = c; });

      for (const r of responses) {
        const keys = Object.keys(r.responses || {});
        for (const k of keys) {
          if (!k) continue;
          if (k.startsWith('comp-')) {
            if (!compMap[k]) compMap[k] = { codigo: k, nombre: `Competencia ${k.replace(/comp-?/, '')}` };
          } else if (k.startsWith('est-') || k.match(/^A\d+/i) || k.match(/^[a-z]+-\d+/i) || k.length > 0) {
            if (!afirmMap[k]) afirmMap[k] = { codigo: k, pregunta: `Pregunta ${k}`, tipo: null, categoria: k.startsWith('est-') ? 'estilo' : 'competencia' };
          }
        }
      }

      const newA = Object.values(afirmMap).sort((x: any, y: any) => String(x.codigo).localeCompare(String(y.codigo)));
      const newC = Object.values(compMap).sort((x: any, y: any) => String(x.codigo).localeCompare(String(y.codigo)));

      window.localStorage.setItem('formulario_afirmaciones', JSON.stringify(newA));
      window.localStorage.setItem('formulario_competencias', JSON.stringify(newC));

      setMessage(`Reconstruidos ${newA.length} afirmaciones y ${newC.length} competencias. Recarga la página de resultados para ver los cambios.`);
      setText(JSON.stringify({ formulario_afirmaciones: newA, formulario_competencias: newC }, null, 2));
    } catch (e: any) {
      setMessage('Error reconstruyendo desde respuestas: ' + (e?.message || String(e)));
    }
  };

  const handleRestoreFromAttachment = () => {
    try {
      // Restore the exact set shown in your last attachment
      const afirmaciones = [
        { codigo: 'est-0', pregunta: 'Comunica claramente', tipo: 'comunic', categoria: 'competencia' },
        { codigo: 'est-1', pregunta: 'Motiva al equipo', tipo: 'motiv', categoria: 'competencia' },
        { codigo: 'est-2', pregunta: 'Muestra respeto y genera confianza', tipo: 'respeto', categoria: 'competencia' },
        { codigo: 'est-3', pregunta: 'Se adapta a cambios con resiliencia', tipo: 'adapt', categoria: 'competencia' },
        { codigo: 'A1', pregunta: 'Fomenta el desarrollo profesional', tipo: 'desarroll', categoria: 'competencia' },
        { codigo: 'A2', pregunta: 'Influye positivamente en los demás', tipo: 'influ', categoria: 'competencia' }
      ];

      const competencias = [
        { codigo: 'comunic', nombre: 'COMUNICACIÓN Y DIRECCION' },
        { codigo: 'motiv', nombre: 'MOTIVACIÓN' },
        { codigo: 'respeto', nombre: 'RESPETO Y CONFIANZA' },
        { codigo: 'adapt', nombre: 'ADAPTABILIDAD Y RESILIENCIA' },
        { codigo: 'desarroll', nombre: 'DESARROLLO DE EQUIPO Y EMPOWERMENT' },
        { codigo: 'influ', nombre: 'MOTIVACION E INFLUENCIA' }
      ];

      const estilos = ['Siempre', 'Casi siempre', 'A veces', 'Casi nunca', 'Nunca'];
      const instrucciones = [{ etiqueta: 'Trabajo en equipo' }, { etiqueta: 'Comunicación' }, { etiqueta: 'Liderazgo' }, { etiqueta: 'Planificación' }];

      window.localStorage.setItem('formulario_afirmaciones', JSON.stringify(afirmaciones));
      window.localStorage.setItem('formulario_competencias', JSON.stringify(competencias));
      window.localStorage.setItem('formulario_estilos', JSON.stringify(estilos));
      window.localStorage.setItem('formulario_instrucciones', JSON.stringify(instrucciones));

      setMessage(`Restauradas ${afirmaciones.length} afirmaciones y ${competencias.length} competencias. Recarga resultados para verificar.`);
      setText(JSON.stringify({ formulario_afirmaciones: afirmaciones, formulario_competencias: competencias, formulario_estilos: estilos }, null, 2));
    } catch (e: any) {
      setMessage('Error al restaurar desde adjunto: ' + (e?.message || String(e)));
    }
  };

  const handleClearSeeded = () => {
    try {
      const keysToRemove = ['form_responses', 'formulario_afirmaciones', 'formulario_competencias', 'formulario_estilos', 'formulario_instrucciones'];
      keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch {} });
      setMessage('Se eliminaron las claves sembradas localmente. Recarga la página de Resultados para verificar.');
      setText('');
    } catch (e: any) {
      setMessage('Error al limpiar claves: ' + (e?.message || String(e)));
    }
  };

  return (
    <section style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Importar / Restaurar LocalStorage</h1>
      <p style={{ color: '#374151' }}>Pega aquí un JSON con las claves (por ejemplo `form_responses`, `formulario_afirmaciones`, `formulario_estilos`, `formulario_competencias`) y pulsa <strong>Restaurar</strong>.</p>

      <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
        <input type="file" accept="application/json" onChange={(e) => handleFile(e.target.files ? e.target.files[0] : null)} />
        <button className="btn-press icon-btn" onClick={handleDownloadBackup}>Descargar backup actual</button>
      </div>

      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder='Pega aquí el JSON de backup' style={{ width: '100%', minHeight: 260, marginTop: 12, padding: 12 }} />

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-press icon-btn" onClick={handlePasteRestore}>Restaurar</button>
        <button className="btn-press icon-btn" onClick={handleReconstructFromResponses}>Reconstruir desde respuestas</button>
        <button className="btn-press icon-btn" onClick={handleRestoreFromAttachment}>Restaurar desde adjunto (afirmaciones/competencias)</button>
        <button className="btn-press icon-btn" onClick={handleClearSeeded} style={{ background: '#ef4444', color: '#fff' }}>Eliminar datos sembrados</button>
        <button className="continue-btn icon-btn" onClick={() => { setText(''); setMessage(null); }}>Limpiar</button>
      </div>

      {message && <div style={{ marginTop: 12, color: '#0f172a' }}>{message}</div>}
    </section>
  );
}
