"use client";
import React from "react";
import { mapLabelToNumeric } from '@/lib/scaleMapper';

export default function ReporteFinalPage() {
  const [codigo, setCodigo] = React.useState('');
  const [nombre, setNombre] = React.useState('');
  const [evaluadores, setEvaluadores] = React.useState<number | ''>('');
  const [afCompetencias, setAfCompetencias] = React.useState<Array<any>>([]);
  const [afEstilos, setAfEstilos] = React.useState<Array<any>>([]);
  const [loading, setLoading] = React.useState(false);
  const reportRef = React.useRef<HTMLElement | null>(null);

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    try {
      const html2canvasMod = await import('html2canvas').catch(() => null);
      if (!html2canvasMod) { alert('Instala html2canvas (npm install html2canvas) para descargar PDF.'); return; }
      const html2canvas = html2canvasMod.default || html2canvasMod;

      // clone the report so we can modify the cloned DOM for PDF without affecting the page
      const el = reportRef.current as HTMLElement;
      const clone = el.cloneNode(true) as HTMLElement;

      // remove interactive controls so they don't appear in the PDF
      try {
        clone.querySelectorAll('input, button, select, textarea, datalist').forEach(n => n.remove());
      } catch (err) {
        // ignore DOM manipulation errors
      }
      clone.style.position = 'fixed';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      document.body.appendChild(clone);

      const canvas = await html2canvas(clone as HTMLElement, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const jspdfMod: any = await import('jspdf').catch(() => null);
      if (!jspdfMod) { alert('Instala jspdf (npm install jspdf) para descargar PDF.'); try { document.body.removeChild(clone); } catch(e){} return; }
      const jsPDFClass: any = jspdfMod.jsPDF || jspdfMod.default || jspdfMod;
      const pdf = new jsPDFClass('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const timestamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      const fn = `reporte-final-${codigo || 'sin-codigo'}-${timestamp}.pdf`;
      pdf.save(fn);

      try { document.body.removeChild(clone); } catch(e) { /* ignore */ }
    } catch (e) {
      console.error('Error generando PDF', e);
      alert('Error al generar PDF. Revisa la consola.');
    }
  };

  return (
    <section ref={reportRef} style={{ padding: 28, marginTop: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: '-220px 0 16px 0', fontSize: 33, fontWeight: 800 }}>REPORTE FINAL</h2>
        <div>
          <button onClick={handleDownloadPdf} aria-label="descargar-pdf" style={{ padding: '8px 12px', borderRadius: 8, background: '#4F46E5', color: '#fff', border: 'none', cursor: 'pointer' }}>Descargar PDF</button>
        </div>
      </div>

      <div style={{ marginTop: -60, marginLeft: 12 }}>
        <label style={{ display: 'block', fontWeight: 700, marginBottom: 12 }}>Buscar por código del evaluado</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            aria-label="buscar-evaluado-codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código..."
            list="evaluados-list-rf"
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.08)', width: 200 }}
          />
          <datalist id="evaluados-list-rf">
            {/* opciones cargadas dinámicamente si se desea */}
          </datalist>

          <button onClick={async () => {
            if (!codigo) return;
            setLoading(true);
            try {
              const [frRes, fRes] = await Promise.all([fetch('/api/admin/form-responses'), fetch('/api/formulario')]);
              const frJson = await frRes.json();
              const fJson = await fRes.json();
              const allResponses = Array.isArray(frJson.data) ? frJson.data : [];
              const afirmaciones = Array.isArray(fJson.afirmaciones) ? fJson.afirmaciones : [];
              // filter entries for this evaluado
              const entries = allResponses.filter((r: any) => String(r.evaluado_codigo || r.evaluadoCodigo || r.token || '').trim() === String(codigo).trim());
              // use shared mapper for consistency with other reports
              const mapLabelToNumericLocal = (v: any) => {
                if (v === null || v === undefined) return null;
                if (typeof v === 'number') return isNaN(v) ? null : v;
                const s = String(v).trim();
                if (!s) return null;
                const n = Number(s);
                if (!isNaN(n)) return n;
                const mapped = mapLabelToNumeric(s);
                if (mapped !== null) return mapped;
                const m = s.match(/\d+(?:\.\d+)?/);
                return m ? Number(m[0]) : null;
              };

              const computeAvgForCode = (code: string) => {
                const vals: number[] = [];
                entries.forEach((r: any) => {
                  let raw = r.responses?.[code];
                  if (raw === undefined || raw === null) {
                    const globalIdx = afirmaciones.findIndex((af: any) => String(af.codigo) === String(code));
                    if (globalIdx >= 0 && (r.responses?.[`comp-${globalIdx}`] !== undefined)) raw = r.responses?.[`comp-${globalIdx}`];
                    if ((raw === undefined || raw === null) && r.responses) {
                      const keys = Object.keys(r.responses || {});
                      for (let k of keys) {
                        if (!k) continue;
                        if (k === code || k.endsWith(String(code)) || k.includes(String(code))) {
                          raw = r.responses[k];
                          break;
                        }
                      }
                    }
                  }
                  const num = mapLabelToNumericLocal(raw);
                  if (typeof num === 'number' && !isNaN(num)) vals.push(num);
                });
                if (!vals.length) return null;
                const avg = vals.reduce((acc: number, v: number) => acc + v, 0) / vals.length;
                return Number(avg.toFixed(2));
              };

              const competenciaAfs: Array<any> = [];
              const estiloAfs: Array<any> = [];
              afirmaciones.forEach((af: any) => {
                const avg = computeAvgForCode(String(af.codigo));
                const row = { codigo: af.codigo, pregunta: af.pregunta || af.texto || af.label || '', promedio: avg };
                if (af.categoria === 'estilo') estiloAfs.push(row);
                else competenciaAfs.push(row);
              });

              // show all afirmaciones in their respective tables, even if promedio is null
              setAfCompetencias(competenciaAfs);
              setAfEstilos(estiloAfs);
              // optionally set nombre/evaluadores from entries
              if (entries.length) {
                const first = entries[0];
                const name = first.evaluado_nombre || first.evaluadoNombre || first.evaluadoNombreCompleto || '';
                setNombre(name || '');
                // compute unique evaluadores
                const evalNames: string[] = entries.map((e: any) => String(e.evaluator_name || e.evaluatorName || e.evaluador || '').trim());
                const filtered = evalNames.filter((n) => !!n);
                const evalSet = new Set(filtered);
                setEvaluadores(evalSet.size || 0);
              }
              // debug: print counts
              try { console.debug('[ReporteFinal] afirmaciones:', afirmaciones.length, 'entradas:', entries.length, 'competencias:', competenciaAfs.length, 'estilos:', estiloAfs.length); } catch(e){}
            } catch (e) {
              console.warn('Error cargando datos', e);
            } finally { setLoading(false); }
          }} style={{ padding: '8px 12px', borderRadius: 8, background: '#4f46e5', color: '#fff', border: 'none' }}>{loading ? 'Cargando...' : 'Cargar'}</button>

          <div style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginRight: 8 }}>Nombre</label>
            <input
              aria-label="nombre-evaluado"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del evaluado"
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.08)', width: 420, background: '#fff', color: '#0f172a' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginRight: 8 }}>Evaluadores</label>
            <input
              aria-label="num-evaluadores"
              value={evaluadores}
              onChange={(e) => {
                const v = e.target.value;
                const n = v === '' ? '' : Number(v.replace(/[^0-9]/g, ''));
                setEvaluadores(n as any);
              }}
              placeholder="0"
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.08)', width: 120, textAlign: 'center', background: '#fff', color: '#0f172a' }}
            />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 420px', minWidth: 320, background: '#fff', padding: 12, borderRadius: 8, border: '1px solid rgba(15,23,42,0.04)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Afirmaciones — Competencias</div>
            <div style={{ height: 1, background: '#e6eef8', marginBottom: 10, borderRadius: 4 }} />
            {afCompetencias.length ? (
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
                      <td style={{ padding: '8px', border: '1px solid #e6eef8' }}>Código</td>
                      <td style={{ padding: '8px', border: '1px solid #e6eef8' }}>Afirmación</td>
                      <td style={{ padding: '8px', border: '1px solid #e6eef8', width: 120, textAlign: 'center' }}>Promedio</td>
                    </tr>
                  </thead>
                  <tbody>
                    {afCompetencias.map((r:any) => (
                      <tr key={r.codigo}>
                        <td style={{ padding: '8px', border: '1px solid #eef2f7' }}>{r.codigo}</td>
                        <td style={{ padding: '8px', border: '1px solid #eef2f7' }}>{r.pregunta}</td>
                        <td style={{ padding: '8px', border: '1px solid #eef2f7', textAlign: 'center' }}>{r.promedio ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: '#6b7280' }}>No hay datos de afirmaciones de competencias para este evaluado.</div>
            )}
          </div>

          <div style={{ flex: '1 1 320px', minWidth: 280, background: '#fff', padding: 12, borderRadius: 8, border: '1px solid rgba(15,23,42,0.04)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Afirmaciones — Estilos</div>
            <div style={{ height: 1, background: '#e6eef8', marginBottom: 10, borderRadius: 4 }} />
            {afEstilos.length ? (
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
                      <td style={{ padding: '8px', border: '1px solid #e6eef8' }}>Código</td>
                      <td style={{ padding: '8px', border: '1px solid #e6eef8' }}>Afirmación</td>
                      <td style={{ padding: '8px', border: '1px solid #e6eef8', width: 120, textAlign: 'center' }}>Promedio</td>
                    </tr>
                  </thead>
                  <tbody>
                    {afEstilos.map((r:any) => (
                      <tr key={r.codigo}>
                        <td style={{ padding: '8px', border: '1px solid #eef2f7' }}>{r.codigo}</td>
                        <td style={{ padding: '8px', border: '1px solid #eef2f7' }}>{r.pregunta}</td>
                        <td style={{ padding: '8px', border: '1px solid #eef2f7', textAlign: 'center' }}>{r.promedio ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: '#6b7280' }}>No hay datos de afirmaciones de estilos para este evaluado.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
