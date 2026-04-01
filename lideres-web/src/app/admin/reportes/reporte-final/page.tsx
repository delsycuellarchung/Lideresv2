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

      // remove interactive controls and form labels so they don't appear in the PDF
      try {
        clone.querySelectorAll('input, button, select, textarea, datalist, label').forEach(n => n.remove());
      } catch (err) {
        // ignore DOM manipulation errors
      }
      clone.style.position = 'fixed';
      clone.style.left = '-9999px';
      clone.style.top = '-99999px';
      clone.style.visibility = 'hidden';
      clone.style.pointerEvents = 'none';
      clone.style.zIndex = '-9999';
      document.body.appendChild(clone);

      // find explicit PDF page sections first (elements marked data-pdf-page),
      // otherwise fall back to capturing each table separately
      try {
      const pages = Array.from(clone.querySelectorAll('[data-pdf-page]')) as HTMLElement[];
      const tables = pages.length ? [] : Array.from(clone.querySelectorAll('table')) as HTMLTableElement[];
        const jspdfMod: any = await import('jspdf').catch(() => null);
        if (!jspdfMod) { alert('Instala jspdf (npm install jspdf) para descargar PDF.'); try { document.body.removeChild(clone); } catch(e){} return; }
        const jsPDFClass: any = jspdfMod.jsPDF || jspdfMod.default || jspdfMod;
        const pdf = new jsPDFClass('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const margin = 20; // mm

        // helper to render an element into a canvas and add to pdf with margins
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const renderElementToPdf = async (element: HTMLElement, addNewPage: boolean) => {
          const canvas = await html2canvas(element as HTMLElement, { scale: 2 });
          const availableWidth = pdfWidth - margin * 2;
          const availableHeightMm = pdfHeight - margin * 2;
          const pageHeightPx = (availableHeightMm * canvas.width) / availableWidth;

          let offsetPx = 0;
          let remainingPx = canvas.height;
          let isFirstSlice = true;

          while (remainingPx > 0) {
            const sliceHeightPx = Math.min(pageHeightPx, remainingPx);
            const sliceHeightMm = (sliceHeightPx * availableWidth) / canvas.width;

            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceHeightPx;
            const ctx = sliceCanvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(canvas, 0, offsetPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
            }
            const sliceData = sliceCanvas.toDataURL('image/png');

            if (!isFirstSlice || addNewPage) pdf.addPage();
            pdf.addImage(sliceData, 'PNG', margin, margin, availableWidth, sliceHeightMm);

            offsetPx += sliceHeightPx;
            remainingPx -= sliceHeightPx;
            isFirstSlice = false;
          }
        };

        // prepare header pieces: show LIDER and number of evaluadores on separate lines
        const leaderName = String(nombre || '');
        const evalCount = Number(evaluadores || 0);

        if (pages.length) {
          // For each marked page (which may include chart + table), render it as a separate PDF page
          for (let i = 0; i < pages.length; i++) {
            const section = pages[i];
            const pageEl = document.createElement('div');
            pageEl.style.width = '1050px';
            pageEl.style.boxSizing = 'border-box';
            pageEl.style.padding = '0 18px 18px 18px';
            pageEl.style.background = '#ffffff';
            pageEl.style.color = '#000';

            if (i === 0) {
              // Barra superior con gradiente
              const topBar = document.createElement('div');
              topBar.style.cssText = `
                background: linear-gradient(90deg, #4F46E5 0%, #06B6D4 100%);
                height: 8px;
                borderRadius: 6px 6px 0 0;
                marginBottom: 0;
              `;
              pageEl.appendChild(topBar);

              // Contenedor del header
              const headerBox = document.createElement('div');
              headerBox.style.cssText = `
                background: linear-gradient(135deg, #f0f4ff 0%, #e0f2fe 100%);
                border: 1px solid #c7d2fe;
                border-top: none;
                border-radius: 0 0 10px 10px;
                padding: 18px 24px 16px 24px;
                margin-bottom: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
              `;

              // Lado izquierdo: título + nombre
              const leftCol = document.createElement('div');

              const leaderDiv = document.createElement('div');
              leaderDiv.textContent = `${leaderName || '-'}`;
              leaderDiv.style.cssText = `
                font-size: 20px;
                font-weight: 800;
                color: #0f172a;
                letter-spacing: 0.3px;
              `;
              leftCol.appendChild(leaderDiv);
              headerBox.appendChild(leftCol);

              // Lado derecho: badge evaluadores
              const badge = document.createElement('div');
              badge.style.cssText = `
                background: #4F46E5;
                color: #fff;
                border-radius: 12px;
                padding: 10px 20px;
                text-align: center;
              `;
              const badgeNum = document.createElement('div');
              badgeNum.textContent = String(evalCount);
              badgeNum.style.cssText = `font-size: 26px; font-weight: 800; line-height: 1;`;
              const badgeLabel = document.createElement('div');
              badgeLabel.textContent = 'Evaluadores';
              badgeLabel.style.cssText = `font-size: 10px; font-weight: 600; letter-spacing: 0.8px; margin-top: 3px; opacity: 0.85;`;
              badge.appendChild(badgeNum);
              badge.appendChild(badgeLabel);
              headerBox.appendChild(badge);

              pageEl.appendChild(headerBox);
            }

            // clone the section (which may include charts and tables)
            const sectionClone = section.cloneNode(true) as HTMLElement;
            // ensure full width for capture
            sectionClone.style.width = '100%';
            pageEl.appendChild(sectionClone);

            pageEl.style.position = 'fixed';
            pageEl.style.left = '-9999px';
            pageEl.style.top = '-99999px';
            clone.style.visibility = 'hidden';
            clone.style.pointerEvents = 'none';
            clone.style.zIndex = '-9999';
            document.body.appendChild(pageEl);
            await renderElementToPdf(pageEl, i > 0);
            try { document.body.removeChild(pageEl); } catch (e) { /* ignore */ }
          }
        } else if (tables.length) {
          // For each table, create a temporary page container that includes header + some spacing + the table clone
          for (let i = 0; i < tables.length; i++) {
            const tbl = tables[i];
            const pageEl = document.createElement('div');
            pageEl.style.width = '1200px';
            pageEl.style.boxSizing = 'border-box';
            pageEl.style.padding = '0 18px 18px 18px';
            pageEl.style.background = '#ffffff';
            pageEl.style.color = '#000';

            // header: LIDER and number of evaluadores (centered) and extra top spacing
            // Barra superior con gradiente
              const topBarTbl = document.createElement('div');
              topBarTbl.style.cssText = `
                background: linear-gradient(90deg, #4F46E5 0%, #06B6D4 100%);
                height: 8px;
                border-radius: 6px 6px 0 0;
                margin-bottom: 0;
              `;
              pageEl.appendChild(topBarTbl);

              // Header box
              const headerBoxTbl = document.createElement('div');
              headerBoxTbl.style.cssText = `
                background: linear-gradient(135deg, #f0f4ff 0%, #e0f2fe 100%);
                border: 1px solid #c7d2fe;
                border-top: none;
                border-radius: 0 0 10px 10px;
                padding: 18px 24px 16px 24px;
                margin-bottom: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
              `;

              const leftColTbl = document.createElement('div');

              const leaderDivTbl = document.createElement('div');
              leaderDivTbl.textContent = `${leaderName || '-'}`;
              leaderDivTbl.style.cssText = `
                font-size: 20px;
                font-weight: 800;
                color: #0f172a;
                letter-spacing: 0.3px;
              `;
              leftColTbl.appendChild(leaderDivTbl);
              headerBoxTbl.appendChild(leftColTbl);

              const badgeTbl = document.createElement('div');
              badgeTbl.style.cssText = `
                background: #4F46E5;
                color: #fff;
                border-radius: 12px;
                padding: 10px 20px;
                text-align: center;
              `;
              const badgeNumTbl = document.createElement('div');
              badgeNumTbl.textContent = String(evalCount);
              badgeNumTbl.style.cssText = `font-size: 26px; font-weight: 800; line-height: 1;`;
              const badgeLabelTbl = document.createElement('div');
              badgeLabelTbl.textContent = 'Evaluadores';
              badgeLabelTbl.style.cssText = `font-size: 10px; font-weight: 600; letter-spacing: 0.8px; margin-top: 3px; opacity: 0.85;`;
              badgeTbl.appendChild(badgeNumTbl);
              badgeTbl.appendChild(badgeLabelTbl);
              headerBoxTbl.appendChild(badgeTbl);

              pageEl.appendChild(headerBoxTbl);

            // clone the table into the page
            const tableClone = tbl.cloneNode(true) as HTMLElement;
            tableClone.style.width = '100%';
            tableClone.style.borderCollapse = 'collapse';
            // ensure table cells have visible backgrounds for capture
            pageEl.appendChild(tableClone);

            // append off-screen, render, then remove
            pageEl.style.position = 'fixed';
            pageEl.style.left = '-9999px';
            pageEl.style.top = '-99999px';
            clone.style.visibility = 'hidden';
      clone.style.pointerEvents = 'none';
      clone.style.zIndex = '-9999';
            document.body.appendChild(pageEl);
            await renderElementToPdf(pageEl, i > 0);
            try { document.body.removeChild(pageEl); } catch (e) { /* ignore */ }
          }
        } else {
          // fallback: render whole cloned report as single page
          await renderElementToPdf(clone as HTMLElement, false);
        }

        const timestamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
        const safeName = String(nombre || codigo || 'sin-nombre').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
        const fn = `reporte_final-${safeName}-${timestamp}.pdf`;
        pdf.save(fn);
        try { document.body.removeChild(clone); } catch(e) { /* ignore */ }
      } catch (err) {
        // if anything fails, fallback to capturing the whole clone as one image
        try {
          const canvas = await html2canvas(clone as HTMLElement, { scale: 2 });
          const imgData = canvas.toDataURL('image/png');
          const jspdfMod2: any = await import('jspdf').catch(() => null);
          if (!jspdfMod2) { alert('Instala jspdf (npm install jspdf) para descargar PDF.'); try { document.body.removeChild(clone); } catch(e){} return; }
          const jsPDFClass2: any = jspdfMod2.jsPDF || jspdfMod2.default || jspdfMod2;
          const pdf2 = new jsPDFClass2('p', 'mm', 'a4');
          const pdfWidth2 = pdf2.internal.pageSize.getWidth();
          const pdfHeight2 = (canvas.height * pdfWidth2) / canvas.width;
          pdf2.addImage(imgData, 'PNG', 0, 0, pdfWidth2, pdfHeight2);
          const timestamp2 = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
          const safeName2 = String(nombre || codigo || 'sin-nombre').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
          const fn2 = `reporte_final-${safeName2}-${timestamp2}.pdf`;
          pdf2.save(fn2);
          try { document.body.removeChild(clone); } catch(e) { /* ignore */ }
        } catch (e) {
          console.error('Error generando PDF fallback', e);
          alert('Error al generar PDF. Revisa la consola.');
          try { document.body.removeChild(clone); } catch(e) { /* ignore */ }
        }
      }
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
        <div data-pdf-page style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 22, borderRadius: 4, background: 'linear-gradient(180deg,#4F46E5,#06B6D4)' }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '0.3px' }}>Afirmaciones</div>
          </div>
          <div style={{ height: 1, background: 'linear-gradient(90deg,#4F46E5,#e2e8f0)', marginBottom: 14, borderRadius: 4 }} />
          {(afCompetencias.length || afEstilos.length) ? (
            <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed' }}>
                          <colgroup>
                            <col style={{ width: '85%' }} />
                            <col style={{ width: '15%' }} />
                          </colgroup>
                          <thead>
                            <tr style={{ background: 'linear-gradient(90deg,#4F46E5,#06B6D4)' }}>
                              <td style={{ padding: '6px 10px', color: '#fff', fontWeight: 700, borderRadius: '6px 0 0 0' }}>Afirmación</td>
                              <td style={{ padding: '6px 10px', color: '#fff', fontWeight: 700, textAlign: 'center', borderRadius: '0 6px 0 0' }}>Promedio</td>
                            </tr>
                          </thead>
                          <tbody>
                            {[...afCompetencias.map((r:any) => ({ ...r, tipo: 'Competencia' })), ...afEstilos.map((r:any) => ({ ...r, tipo: 'Estilo' }))]
                              .sort((a, b) => String(a.pregunta || '').localeCompare(String(b.pregunta || ''), 'es'))
                              .map((r:any, idx:number) => {
                                const val = typeof r.promedio === 'number' ? r.promedio : null;
                                const bg = val === null ? 'transparent' : val >= 4.2 ? '#d1fae5' : val >= 3.4 ? '#fef3c7' : '#fee2e2';
                                const color = val === null ? '#6b7280' : val >= 4.2 ? '#065f46' : val >= 3.4 ? '#92400e' : '#991b1b';
                                return (
                                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #eef2f7' }}>
                                    <td style={{ padding: '5px 10px', color: '#1e293b', lineHeight: 1.4, wordWrap: 'break-word', whiteSpace: 'normal' }}>{r.pregunta}</td>
                                    <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                                      <span style={{ display: 'inline-block', minWidth: 40, padding: '2px 8px', borderRadius: 6, background: 'transparent', color: '#1e293b', fontWeight: 700, fontSize: 11 }}>
                                        {val !== null ? Number(val).toFixed(2) : '-'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                  </div>
                ) : (
              <div style={{ color: '#6b7280', padding: 12 }}>No hay datos de afirmaciones para este evaluado.</div>
            )}
        </div>
      </div>
    </section>
  );
}
