"use client";
import React from "react";
import { mapLabelToNumeric } from '@/lib/scaleMapper';
import { exportToExcel } from '@/lib/excelExporter';
import ExcelJS from 'exceljs';
export default function ResultadosFinalesPage() {
  const [datos, setDatos] = React.useState<any[]>([]);
  const [estilosCols, setEstilosCols] = React.useState<string[]>([]);
  const formatLabel = (s: string) => {
    if (!s) return s;
    const str = String(s);
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };
  const handleExportPDF = async () => {
    if (typeof window === 'undefined') return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { PDFDocument } = await import('pdf-lib');

      // Build a clean printable DOM so tables render consistently (no buttons/images)
      const PDF_PT_TO_PX = 96 / 72; // 1pt = 1.3333px at 96dpi
      const pdfPageWidth = 595.28; // A4 pt
      const pdfPageHeight = 841.89; // A4 pt
      const sideMarginPt = 56.7; // 2 cm margin in points (~56.7pt)
      const captureWidthPx = Math.floor((pdfPageWidth - sideMarginPt * 2) * PDF_PT_TO_PX);

      const createTable = (headers: string[], rows: any[][]) => {
        const tbl = document.createElement('table');
        tbl.style.width = '100%';
        tbl.style.borderCollapse = 'collapse';
        tbl.style.marginBottom = '18px';
        const thead = document.createElement('thead');
        const trh = document.createElement('tr');
        headers.forEach(h => {
          const th = document.createElement('th');
          th.textContent = h;
          th.style.padding = '6px 8px';
          th.style.border = '1px solid #e6e6e6';
          th.style.background = '#f3f4f6';
          th.style.fontSize = '11px';
          th.style.textAlign = 'center';
          trh.appendChild(th);
        });
        thead.appendChild(trh);
        tbl.appendChild(thead);
        const tbody = document.createElement('tbody');
        rows.forEach(r => {
          const tr = document.createElement('tr');
          r.forEach((c: any) => {
            const td = document.createElement('td');
            td.textContent = c == null ? '-' : String(c);
            td.style.padding = '6px 8px';
            td.style.border = '1px solid #f0f0f0';
            td.style.fontSize = '11px';
            td.style.textAlign = 'center';
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        tbl.appendChild(tbody);
        return tbl;
      };

      // Build competencias data
      const competenciaCols = ['Comunicación y dirección', 'Respeto y confianza', 'Desarrollo de equipo y empowerment', 'Adaptabilidad y resiliencia', 'Motivación e influencia'];
      const compHeaders = ['Cod', 'Evaluado', 'Fecha', 'Número de evaluadores', ...competenciaCols, 'Promedio'];
      const compRows: any[][] = [];
      (datos || []).forEach((r: any) => {
        try {
          const evaluadores = Number(r.evaluadores) || 0;
          if (!(evaluadores > 3)) return;
          compRows.push([
            r.codigo || '-',
            r.nombre || '-',
            r.fecha || '-',
            evaluadores || '-',
            r.comunicacion ?? '-',
            r.respeto ?? '-',
            r.desarrollo ?? '-',
            r.adaptabilidad ?? '-',
            r.motivacion ?? '-',
            r.promedio ?? '-'
          ]);
        } catch (e) {}
      });
      const compTable = createTable(compHeaders, compRows);

      // Build estilos data
      const estHeaders = ['Cod', 'Evaluado', 'Fecha', 'Número de evaluadores', ...(estilosCols && estilosCols.length ? estilosCols.map(s => String(s)) : []), 'Promedio'];
      const estRows: any[][] = [];
      (datos || []).forEach((r: any) => {
        try {
          const evaluadores = Number(r.evaluadores) || 0;
          if (!(evaluadores > 3)) return;
          const row: any[] = [r.codigo || '-', r.nombre || '-', r.fecha || '-', evaluadores || '-'];
          (estilosCols || []).forEach((label: string) => {
            const val = r.estilos && (r.estilos[label] != null) ? r.estilos[label] : '-';
            row.push(val === null || val === undefined || val === '' ? '-' : val);
          });
          row.push(r.promedio ?? '-');
          estRows.push(row);
        } catch (e) {}
      });
      // Build estilos table and improve layout for printing: fixed layout + explicit column widths
      const estTable = createTable(estHeaders, estRows);
      // Ensure 'Evaluado' column in competencias is left-aligned (not centered)
      try {
        const thsComp = Array.from(compTable.querySelectorAll('th')) as HTMLElement[];
        if (thsComp[1]) thsComp[1].style.textAlign = 'left';
        const compRowsDom = Array.from(compTable.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
        compRowsDom.forEach(r => {
          const cells = Array.from(r.children) as HTMLElement[];
          if (cells[1]) {
            cells[1].style.textAlign = 'left';
            cells[1].style.whiteSpace = 'normal';
            cells[1].style.wordBreak = 'break-word';
            cells[1].style.padding = '6px 8px';
          }
        });
      } catch (e) { /* ignore */ }

      // Adjust estilos table: smaller header font, tighter padding and explicit col widths
      try {
        estTable.style.tableLayout = 'fixed';
        estTable.style.width = '100%';
        const colgroup = document.createElement('colgroup');
        const estiloCount = (estilosCols || []).length;
        const fixedWidths = [55, 200, 70, 65];
        const promedioWidth = 60;
        const fixedTotal = fixedWidths.reduce((a, b) => a + b, 0);
        const availablePx = Math.floor((841.89 - 20 * 2) * (96 / 72));
        const remainingForEstilos = availablePx - fixedTotal - promedioWidth;
        const estiloColWidth = estiloCount > 0 ? Math.max(50, Math.floor(remainingForEstilos / estiloCount)) : 65;
        const allWidths = [...fixedWidths, ...Array(estiloCount).fill(estiloColWidth), promedioWidth];
        allWidths.forEach(w => { const c = document.createElement('col'); c.style.width = `${w}px`; colgroup.appendChild(c); });
        if (estTable.firstChild) estTable.insertBefore(colgroup, estTable.firstChild);
        const ths = Array.from(estTable.querySelectorAll('th')) as HTMLElement[];
        ths.forEach((th, i) => {
          th.style.fontSize = estiloCount > 7 ? '9px' : '10px';
          th.style.padding = '5px 4px';
          th.style.whiteSpace = 'normal';
          th.style.wordBreak = 'break-word';
          th.style.lineHeight = '1.2';
          th.style.verticalAlign = 'middle';
          th.style.textAlign = i === 1 ? 'left' : 'center';
        });
        const rowsDom = Array.from(estTable.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
        rowsDom.forEach(r => {
          const cells = Array.from(r.children) as HTMLElement[];
          cells.forEach((cell, i) => {
            cell.style.fontSize = estiloCount > 7 ? '9px' : '10px';
            cell.style.padding = '5px 4px';
            cell.style.verticalAlign = 'middle';
            if (i === 1) { cell.style.textAlign = 'left'; cell.style.whiteSpace = 'normal'; cell.style.wordBreak = 'break-word'; }
            else { cell.style.textAlign = 'center'; }
          });
        });
      } catch (e) { console.warn('Error ajustando tabla estilos', e); }

      // Capture each table separately and add one landscape PDF page per table
      const pdfDoc = await PDFDocument.create();
      const pdfLandscapeWidth = 841.89; // A4 landscape pt
      const pdfLandscapeHeight = 595.28; // A4 landscape pt
      const sideMarginPtLocal = 56.7; // 2 cm margin in points
      const captureWidthPxLocal = Math.floor((pdfLandscapeWidth - sideMarginPtLocal * 2) * (96 / 72));

      const captureAndAddPage = async (titleText: string, tableEl: HTMLTableElement) => {
        const containerEl = document.createElement('div');
        containerEl.style.boxSizing = 'border-box';
        containerEl.style.width = `${captureWidthPxLocal}px`;
        containerEl.style.padding = '12px';
        containerEl.style.background = '#ffffff';
        containerEl.style.color = '#0f172a';

        const title = document.createElement('h1');
        title.textContent = titleText;
        title.style.fontSize = '16px';
        title.style.margin = '0 0 6px 0';
        containerEl.appendChild(title);

        const dateEl2 = document.createElement('div');
        dateEl2.textContent = `Fecha: ${new Date().toLocaleDateString()}`;
        dateEl2.style.fontSize = '12px';
        dateEl2.style.marginBottom = '8px';
        containerEl.appendChild(dateEl2);

        // clone table to avoid moving original
        const tableClone = tableEl.cloneNode(true) as HTMLTableElement;
        tableClone.style.width = '100%';
        containerEl.appendChild(tableClone);

        containerEl.style.position = 'fixed';
        containerEl.style.left = '0';
        containerEl.style.top = '-99999px';
        document.body.appendChild(containerEl);

        const canvasEl = await html2canvas(containerEl as HTMLElement, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });
        document.body.removeChild(containerEl);

        const sliceDataUrl = canvasEl.toDataURL('image/png');
        const pngImage = await pdfDoc.embedPng(sliceDataUrl);
        // scale image to fit within landscape width minus side margins
        const targetWidthPt = pdfLandscapeWidth - sideMarginPtLocal * 2;
        const scale = targetWidthPt / pngImage.width;
        const pngDims = pngImage.scale(scale);

        const page = pdfDoc.addPage([pdfLandscapeWidth, pdfLandscapeHeight]);
        // draw image offset by left/top margins
        page.drawImage(pngImage, {
          x: sideMarginPtLocal,
          y: pdfLandscapeHeight - sideMarginPtLocal - pngDims.height,
          width: pngDims.width,
          height: pngDims.height,
        });
      };

      // helper: capture table with a custom side margin (points)
      const captureAndAddPageWithMargin = async (titleText: string, tableEl: HTMLTableElement, marginPt: number) => {
        const containerEl = document.createElement('div');
        containerEl.style.boxSizing = 'border-box';
        const captureWidthPxCustom = Math.floor((pdfLandscapeWidth - marginPt * 2) * (96 / 72));
        containerEl.style.width = `${captureWidthPxCustom}px`;
        containerEl.style.padding = '12px';
        containerEl.style.background = '#ffffff';
        containerEl.style.color = '#0f172a';

        const title = document.createElement('h1');
        title.textContent = titleText;
        title.style.fontSize = '16px';
        title.style.margin = '0 0 6px 0';
        containerEl.appendChild(title);

        const dateEl2 = document.createElement('div');
        dateEl2.textContent = `Fecha: ${new Date().toLocaleDateString()}`;
        dateEl2.style.fontSize = '12px';
        dateEl2.style.marginBottom = '8px';
        containerEl.appendChild(dateEl2);

        const tableClone = tableEl.cloneNode(true) as HTMLTableElement;
        tableClone.style.width = '100%';
        containerEl.appendChild(tableClone);

        containerEl.style.position = 'fixed';
        containerEl.style.left = '0';
        containerEl.style.top = '-99999px';
        document.body.appendChild(containerEl);

        const canvasEl = await html2canvas(containerEl as HTMLElement, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });
        document.body.removeChild(containerEl);

        const sliceDataUrl = canvasEl.toDataURL('image/png');
        const pngImage = await pdfDoc.embedPng(sliceDataUrl);
        const targetWidthPt = pdfLandscapeWidth - marginPt * 2;
        const scale = targetWidthPt / pngImage.width;
        const pngDims = pngImage.scale(scale);

        const page = pdfDoc.addPage([pdfLandscapeWidth, pdfLandscapeHeight]);
        page.drawImage(pngImage, {
          x: marginPt,
          y: pdfLandscapeHeight - marginPt - pngDims.height,
          width: pngDims.width,
          height: pngDims.height,
        });
      };

      await captureAndAddPage('Resultados - Competencias', compTable as HTMLTableElement);
      await captureAndAddPageWithMargin('Resultados - Estilos', estTable as HTMLTableElement, 20);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Resultados-Finales-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error exporting PDF (image slice)', e);
      alert('Error al generar el PDF. Revisa la consola.');
    }
  };
  

React.useEffect(() => {
        if (typeof window === 'undefined') return;

        let mounted = true;
        const load = async (allResponsesFromServer?: any[]) => {
          try {
            const allResponses = Array.isArray(allResponsesFromServer) ? allResponsesFromServer : JSON.parse(window.localStorage.getItem('form_responses') || '[]') || [];
      let afirmaciones: any[] = [];
      try {
        const fRes = await fetch('/api/formulario');
        if (fRes.ok) {
          const fJson = await fRes.json();
          if (Array.isArray(fJson.afirmaciones) && fJson.afirmaciones.length > 0) {
            afirmaciones = fJson.afirmaciones;
          }
        }
      } catch {}
      if (!afirmaciones.length) {
        try {
          const rawA = window.localStorage.getItem('formulario_afirmaciones') || '[]';
          afirmaciones = JSON.parse(rawA) || [];
        } catch {}
      }
      let estilosRaw: any[] = [];
      try {
        const estFromApi = afirmaciones?.filter((a: any) => a.categoria === 'estilo').map((a: any) => a.tipo);
        const uniqueEstilos = [...new Set(estFromApi || [])];
        if (uniqueEstilos.length) estilosRaw = uniqueEstilos;
      } catch {}
      if (!estilosRaw.length) {
        try {
          const rawEst = window.localStorage.getItem('formulario_estilos') || '[]';
          estilosRaw = JSON.parse(rawEst) || [];
        } catch {}
      }
      const estilosArr: string[] = Array.isArray(estilosRaw) ? estilosRaw.map((s: any) => (typeof s === 'string' ? s : (s && s.nombre ? String(s.nombre) : String(s)))) : [];
      const affByCode: Record<string, any> = {};
      afirmaciones.forEach((a: any) => { if (a.codigo) affByCode[String(a.codigo)] = a; });

      const codesByGroup: Record<string, string[]> = { comunicacion: [], respeto: [], desarrollo: [], adaptabilidad: [], motivacion: [] };
      (afirmaciones || []).forEach((a: any) => {
        try {
          if (!a || a.categoria !== 'competencia') return;
          const tipoRaw = a.tipo != null ? String(a.tipo) : '';
          const tipo = tipoRaw.trim().toLowerCase();
          if (!tipo) return;
          if (codesByGroup[tipo]) {
            codesByGroup[tipo].push(String(a.codigo));
            return;
          }
          if (tipo.includes('comunic')) { codesByGroup.comunicacion.push(String(a.codigo)); return; }
          if (tipo.includes('resp')) { codesByGroup.respeto.push(String(a.codigo)); return; }
          if (tipo.includes('desar') || tipo.includes('desarrollo')) { codesByGroup.desarrollo.push(String(a.codigo)); return; }
          if (tipo.includes('adapt')) { codesByGroup.adaptabilidad.push(String(a.codigo)); return; }
          if (tipo.includes('motiva') || tipo.includes('influ')) { codesByGroup.motivacion.push(String(a.codigo)); return; }
        } catch (e) {

        }
      });
      const estilosByLabel: Record<string, string[]> = {};
      estilosArr.forEach((label: string) => { estilosByLabel[label] = []; });
      Object.values(affByCode).forEach((a: any) => {

        const tipo = a.tipo ? String(a.tipo) : '';
        const categoria = a.categoria ? String(a.categoria) : '';

        if (categoria === 'estilo') {

          if (tipo && estilosArr.includes(tipo)) estilosByLabel[tipo].push(String(a.codigo));
          else {

            for (const label of estilosArr) {
              if (String(a.pregunta || '').toLowerCase().includes(String(label).toLowerCase())) {
                estilosByLabel[label].push(String(a.codigo));
                break;
              }
            }
          }
        } else {

          if (tipo && estilosArr.includes(tipo)) estilosByLabel[tipo].push(String(a.codigo));
        }
      });

      const normalizeResponses = (respObj: Record<string, any>) => {
        const out: Record<string, any> = {};
        if (!respObj) return out;
        Object.keys(respObj).forEach((k) => {
          const v = respObj[k];
          if (affByCode[String(k)]) {
            out[String(k)] = v;
            return;
          }
          const m = String(k).match(/^(?:comp|est)-(\d+)$/i);
          if (m) {
            const idx = parseInt(m[1], 10);
            const aff = Array.isArray(afirmaciones) && afirmaciones[idx] ? afirmaciones[idx] : null;
            if (aff && aff.codigo) {
              out[String(aff.codigo)] = v;
              return;
            }
          }
          out[String(k)] = v;
        });
        return out;
      };

      // lista donde se cargan los datos normalizados, con codigo evaluado, nombre evaluado, respuestas normalizadas, fecha y evaluadores únicos
      let normalizedRows = (Array.isArray(allResponses) ? allResponses : []).map((r: any) => {
        const keys = Object.keys(r || {});
        const normalizeKey = (s: string) => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const normMap: Record<string, string> = {};
        keys.forEach((k) => { try { normMap[normalizeKey(k)] = k; } catch (e) { normMap[String(k).toLowerCase()] = k; } });

        const findByNorm = (check: (nk: string) => boolean) => {
          for (const nk of Object.keys(normMap)) {
            try { if (check(nk)) return r[normMap[nk]]; } catch (e) { /* ignore */ }
          }
          return undefined;
        };

        const evaluadoCodigo = r.evaluado_codigo || r.evaluadoCodigo || r.evaluadoCode || r.codigo_evaluado || findByNorm(nk => nk.includes('codig') && nk.includes('evaluad'));
        const evaluadoNombre = r.evaluado_nombre || r.evaluadoNombre || r.nombre_evaluado || r.nombre || findByNorm(nk => nk.includes('nombre') && nk.includes('evaluad'));
        const evaluatorName = r.evaluatorName || r.evaluator_name || r.evaluator || r.evaluador || findByNorm(nk => nk.includes('nombre') && (nk.includes('evaluador') || nk.includes('evaluador')));

        const normalizeNameForCodeInner = (n: string) => String(n || '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]/g, '_');
        const groupKey = String(evaluadoCodigo ?? (evaluadoNombre ? normalizeNameForCodeInner(evaluadoNombre) : (r.token || '')));

        return {
          evaluadoCodigo: evaluadoCodigo ?? null,
          evaluadoNombre: evaluadoNombre ?? (r['Nombre del Evaluado'] || r['Nombre Evaluado'] || ''),
          evaluatorName: evaluatorName ?? (r['Nombre Evaluador'] || r['Nombre del Evaluador'] || ''),
          responses: normalizeResponses(r.responses || r.respuestas || r.answers || r || {}),
          createdAt: r.createdAt || r.created_at || r.fecha || null,
          token: r.token || null,
          groupKey
        };
      });

      try {
        // decide si enriquecemos: si faltan códigos o si los códigos parecen slugs generados (contienen '_')
        const needEnrich = normalizedRows.some((r: any) => ((!r.evaluadoCodigo || String(r.evaluadoCodigo).trim() === '') && r.evaluadoNombre) || (r.evaluadoCodigo && String(r.evaluadoCodigo).includes('_')));
        if (needEnrich) {
          const evRes = await fetch('/api/admin/evaluators');
          if (evRes.ok) {
            const evJson = await evRes.json().catch(() => ({}));
            const evList = Array.isArray(evJson.data) ? evJson.data : (Array.isArray(evJson) ? evJson : []);

            const normalizeName = (s: string) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '');

            // build searchable list of evaluators
            const evaluatorsSearch: { code: string; name: string; nameNorm: string; tokens: string[] }[] = [];
            evList.forEach((ev: any) => {
              const rawNombre = String(ev.nombre_evaluado || ev.nombre || ev.nombreEvaluado || '').trim();
              const codigoEvaluado = ev.codigo_evaluado ?? ev.codigo ?? null;
              if (!rawNombre || !codigoEvaluado) return;
              const nameNorm = normalizeName(rawNombre);
              const tokens = nameNorm.split(' ').filter(Boolean);
              evaluatorsSearch.push({ code: String(codigoEvaluado), name: rawNombre, nameNorm, tokens });
            });

            const findMatchForName = (nameNorm: string) => {
              if (!nameNorm) return null;
              // exact
              const exact = evaluatorsSearch.find(e => e.nameNorm === nameNorm);
              if (exact) return exact.code;
              const tokens = nameNorm.split(' ').filter(Boolean);
              if (!tokens.length) return null;
              // token-all: evaluator name contains all tokens
              for (const ev of evaluatorsSearch) {
                const hasAll = tokens.every(t => ev.nameNorm.includes(t));
                if (hasAll) return ev.code;
              }
              // reverse: row name contained in evaluator name (useful if DB has full name and row is subset)
              for (const ev of evaluatorsSearch) {
                const evTokens = ev.tokens;
                const hasAll = evTokens.every(t => nameNorm.includes(t) || t.length <= 2);
                if (hasAll) return ev.code;
              }
              // partial: any significant token (>=3 chars) matches
              for (const ev of evaluatorsSearch) {
                if (tokens.some(t => t.length >= 3 && ev.nameNorm.includes(t))) return ev.code;
              }
              return null;
            };

            normalizedRows = normalizedRows.map((r: any) => {
              const origCode = r.evaluadoCodigo;
              const name = String(r.evaluadoNombre || '').trim();
              const nameNorm = normalizeName(name);

              if ((!origCode || String(origCode).trim() === '') && nameNorm) {
                const found = findMatchForName(nameNorm);
                if (found) r.evaluadoCodigo = found;
              }

              if (origCode && String(origCode).includes('_') && nameNorm) {
                const found = findMatchForName(nameNorm);
                if (found) r.evaluadoCodigo = found;
              }

              return r;
            });
          }
        }
      } catch (e) {

      }
      const byEvaluado: Record<string, any> = {};
      normalizedRows.forEach((r: any) => {

        const evaluadoCodigo = r.evaluadoCodigo || r.evaluado_codigo || r.evaluadoCode || r.codigo_evaluado || null;
        const evaluadoNombre = r.evaluadoNombre || r.evaluado_nombre || r.nombre || '';
        const groupingKey = r.groupKey || (evaluadoCodigo ? String(evaluadoCodigo) : (evaluadoNombre ? String(evaluadoNombre).trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]/g, '_') : (r.token || '')));
        const code = String(groupingKey);
        const normalizedResponses = normalizeResponses(r.responses || {});

        if (!byEvaluado[code]) byEvaluado[code] = { codigo: code, nombre: evaluadoNombre || '', fecha: r.createdAt || r.created_at || r.fecha || '', evaluadoresSet: new Set<string>(), values: [] };
        if ((!byEvaluado[code].nombre || String(byEvaluado[code].nombre).trim() === '') && evaluadoNombre) byEvaluado[code].nombre = evaluadoNombre;
        byEvaluado[code].evaluadoresSet.add(String(r.evaluatorName || r.evaluator_name || r.evaluator || '').trim());
        Object.keys(normalizedResponses).forEach(k => {
          const rawVal = normalizedResponses[k];
          const num = mapLabelToNumeric(rawVal);
          if (typeof num === 'number' && !isNaN(num)) byEvaluado[code].values.push(num);
        });
      });
      const rows = Object.values(byEvaluado).map((item: any) => {
        const code = item.codigo;
        const entries = normalizedRows.filter((r: any) => String(r.groupKey || r.evaluadoCodigo || r.token) === code);
        const evaluadores = item.evaluadoresSet.size;

        const computeGroupAvg = (groupCodes: string[]) => {
          //  solo si tiene 3 evaluadores cargaran los datos, de lo contrario se muestra '-'
          if (evaluadores < 3) return null;
          const vals: number[] = [];
          entries.forEach((r: any) => {
            groupCodes.forEach((c) => {
              const raw = r.responses?.[c];
              const num = mapLabelToNumeric(raw);
              if (typeof num === 'number' && !isNaN(num)) vals.push(num);
            });
          });
          return vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : null;
        };

        const comunicacion = computeGroupAvg(codesByGroup.comunicacion);
        const respeto = computeGroupAvg(codesByGroup.respeto);
        const desarrollo = computeGroupAvg(codesByGroup.desarrollo);
        const adaptabilidad = computeGroupAvg(codesByGroup.adaptabilidad);
        const motivacion = computeGroupAvg(codesByGroup.motivacion);


        const estiloAverages: Record<string, number | null> = {};
        estilosArr.forEach(label => {
          const codes = estilosByLabel[label] || [];
          if (!codes.length) { estiloAverages[label] = null; return; }

          if (evaluadores < 3) { estiloAverages[label] = null; return; }
          const vals: number[] = [];
          entries.forEach((r: any) => {
            codes.forEach((c) => {
              const raw = r.responses?.[c];
              const num = mapLabelToNumeric(raw);
              if (typeof num === 'number' && !isNaN(num)) vals.push(num);
            });
          });
          estiloAverages[label] = vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : null;
        });

        const overall = (evaluadores >= 3 && item.values.length) ? +(item.values.reduce((s: number, v: number) => s + v, 0) / item.values.length).toFixed(2) : null;

        return {
          codigo: code,
          nombre: item.nombre,
          fecha: item.fecha ? new Date(item.fecha).toLocaleDateString() : '',
          evaluadores,
          comunicacion: comunicacion ?? '-',
          respeto: respeto ?? '-',
          desarrollo: desarrollo ?? '-',
          adaptabilidad: adaptabilidad ?? '-',
          motivacion: motivacion ?? '-',
          estilos: estiloAverages,
          promedio: overall ?? '-'
        };
      });

      setEstilosCols(estilosArr);
      setDatos(rows);
    } catch (e) {
      console.warn('Error building resultados-finales data', e);
      setDatos([]);
    }
    };

    (async () => {
      try {
        const res = await fetch('/api/admin/form-responses');
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          if (json && Array.isArray(json.data) && json.data.length > 0) {
            try { window.localStorage.setItem('form_responses', JSON.stringify(json.data)); } catch {}
            await load(json.data);
            return;
          }
        }
      } catch (e) {

      }
      await load();
    })();

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'form_responses') {
        try { load(); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleExport = async () => {
    if (typeof window === 'undefined') return;
    try {
      const rows = datos || [];
      if (!rows || !rows.length) {
        alert('No hay datos para exportar');
        return;
      }
      const estilos = estilosCols || [];

      const workbook = new ExcelJS.Workbook();

      // Hoja Competencias
      const competenciasSheet = workbook.addWorksheet('Competencias');
      const competenciaCols = ['Comunicación y dirección', 'Respeto y confianza', 'Desarrollo de equipo y empowerment', 'Adaptabilidad y resiliencia', 'Motivación e influencia'];
      const competenciasHeaders = ['Cod', 'Evaluado', 'Fecha', 'Número de evaluadores', ...competenciaCols, 'Promedio'];
      competenciasSheet.columns = competenciasHeaders.map(h => ({ header: h, key: h, width: 18 }));
      const compHeaderRow = competenciasSheet.getRow(1);
      compHeaderRow.font = { bold: true, size: 12 };
      compHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };

      rows.forEach((r: any) => {
        try {
          const evaluadores = Number(r.evaluadores) || 0;
          if (!(evaluadores > 3)) return;
          const base: any[] = [];
          base.push(r.codigo || '-');
          base.push(r.nombre || '-');
          base.push(r.fecha || '-');
          base.push(evaluadores || '-');
          base.push(r.comunicacion ?? '-');
          base.push(r.respeto ?? '-');
          base.push(r.desarrollo ?? '-');
          base.push(r.adaptabilidad ?? '-');
          base.push(r.motivacion ?? '-');
          base.push(r.promedio ?? '-');
          const row = competenciasSheet.addRow(base);
          row.eachCell((cell) => {
            if (cell.value === null || cell.value === undefined || (typeof cell.value === 'string' && String(cell.value).trim() === '')) cell.value = '-';
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          });
        } catch (e) {}
      });

      // Hoja Estilos
      const estilosSheet = workbook.addWorksheet('Estilos');
      const estilosHeaders = ['Cod', 'Evaluado', 'Fecha', 'Número de evaluadores'];
      if (estilos && estilos.length) {
        estilosHeaders.push(...estilos.map(s => String(s)));
      }
      estilosHeaders.push('Promedio');
      estilosSheet.columns = estilosHeaders.map(h => ({ header: h, key: h, width: 18 }));
      const estHeaderRow = estilosSheet.getRow(1);
      estHeaderRow.font = { bold: true, size: 12 };
      estHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };

      rows.forEach((r: any) => {
        try {
          const evaluadores = Number(r.evaluadores) || 0;
          if (!(evaluadores > 3)) return;
          const base: any[] = [];
          base.push(r.codigo || '-');
          base.push(r.nombre || '-');
          base.push(r.fecha || '-');
          base.push(evaluadores || '-');
          if (estilos && estilos.length) {
            estilos.forEach((label: string) => {
              const val = r.estilos && (r.estilos[label] != null) ? r.estilos[label] : '-';
              base.push(val === null || val === undefined || val === '' ? '-' : val);
            });
          }
          base.push(r.promedio ?? '-');
          const row = estilosSheet.addRow(base);
          row.eachCell((cell) => {
            if (cell.value === null || cell.value === undefined || (typeof cell.value === 'string' && String(cell.value).trim() === '')) cell.value = '-';
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          });
        } catch (e) {}
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Resultados-Finales-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error exporting to Excel', e);
      alert('Error al generar el Excel. Revisa la consola.');
    }
  };
  function getAvgColor(value: number) {
    if (value === null || typeof value !== 'number' || isNaN(value)) return 'transparent';
    if (value >= 4.2) return '#d1fae5'; 
    if (value >= 3.4) return '#fef3c7'; 
    return '#fee2e2'; 
  }
  const styles = {
    container: { background: '#fff', padding: 8, borderRadius: 8, border: '1px solid rgba(15,23,42,0.04)' } as React.CSSProperties,
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', minWidth: 0, whiteSpace: 'normal', tableLayout: 'auto' } as React.CSSProperties,
    th: { padding: '12px 14px', fontSize: 14, fontWeight: 400, color: '#0F172A', background: '#f3f4f6', textAlign: 'center' } as React.CSSProperties,
    thLeft: { padding: '12px 14px', fontSize: 14, fontWeight: 400, color: '#0F172A', background: '#f3f4f6', textAlign: 'left' } as React.CSSProperties,
    tr: { background: '#fff', fontSize: 13, borderBottom: '1px solid #eef2f7' } as React.CSSProperties,
    td: { padding: '10px 12px', textAlign: 'center' } as React.CSSProperties,
    nameTd: { padding: '10px 12px', color: '#111827', fontWeight: 400, whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 560 } as React.CSSProperties,
    badge: { fontWeight: 400, padding: '6px 8px', borderRadius: 8 } as React.CSSProperties,
    avgBadge: (value: any) => ({ display: 'inline-block', minWidth: 48, padding: '6px 8px', borderRadius: 8, background: typeof value === 'number' ? getAvgColor(value) : 'transparent' } as React.CSSProperties)
  };
  return (
    <section id="resultados-print-area" style={{ padding: '6px 24px 20px 24px' }}>
      <h1 style={{ margin: '0 0 0 12px', fontSize: 32, fontWeight: 800, transform: 'translateY(-70px)' }}>RESULTADOS FINALES</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button title="Descargar PDF" className="btn-press icon-btn" onClick={handleExportPDF} style={{ padding: '8px 12px', fontSize: 14 }}>
            <img src="/images/descargar.png" alt="PDF" style={{ width: 18, height: 18, marginRight: 8 }} />PDF
          </button>
          <button className="btn-press icon-btn" onClick={handleExport} style={{ padding: '8px 12px', fontSize: 14 }}>
            <img src="/images/descargar.png" alt="Exportar" style={{ width: 18, height: 18, marginRight: 8 }} />Exportar
          </button>
        </div>
      </div>
      <div style={{ background: '#fff', padding: 8, borderRadius: 8, border: '1px solid rgba(15,23,42,0.04)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', minWidth: 0, whiteSpace: 'normal', tableLayout: 'auto' }}>
          <thead>
            <tr>
              <th style={{ padding: '12px 14px', fontSize: 14, fontWeight: 400, color: '#0F172A', background: '#f3f4f6', position: 'sticky', top: 0, zIndex: 2, textAlign: 'center', width: 100, whiteSpace: 'nowrap' }}>Cod</th>
              <th style={{ padding: '12px 14px', fontSize: 14, fontWeight: 400, color: '#0F172A', background: '#f3f4f6', position: 'sticky', top: 0, zIndex: 2, textAlign: 'left' }}>Evaluado</th>
              <th style={{ padding: '12px 14px', fontSize: 14, fontWeight: 400, color: '#0F172A', background: '#f3f4f6', position: 'sticky', top: 0, zIndex: 2, textAlign: 'center', whiteSpace: 'nowrap' }}>Fecha</th>
              <th style={{ padding: '12px 14px', fontSize: 14, fontWeight: 400, color: '#0F172A', background: '#f3f4f6', position: 'sticky', top: 0, zIndex: 2, textAlign: 'center' }}>Número de evaluadores</th>
              <th style={{ padding: '12px 14px', fontSize: 14, fontWeight: 400, color: '#0F172A', background: '#f3f4f6', position: 'sticky', top: 0, zIndex: 2, textAlign: 'center' }}>Comunicación y dirección</th>
              <th style={{ padding: '12px 14px', fontSize: 14, fontWeight: 400, color: '#0F172A', background: '#f3f4f6', position: 'sticky', top: 0, zIndex: 2, textAlign: 'center' }}>Respeto y confianza</th>
              <th style={{ padding: '12px 14px', fontSize: 14, fontWeight: 400, color: '#0F172A', background: '#f3f4f6', position: 'sticky', top: 0, zIndex: 2, textAlign: 'center' }}>Desarrollo de equipo y empowerment</th>
              <th style={{ padding: '12px 14px', fontSize: 14, fontWeight: 400, color: '#0F172A', background: '#f3f4f6', position: 'sticky', top: 0, zIndex: 2, textAlign: 'center' }}>Adaptabilidad y resiliencia</th>
              <th style={{ padding: '12px 14px', fontSize: 14, fontWeight: 400, color: '#0F172A', background: '#f3f4f6', position: 'sticky', top: 0, zIndex: 2, textAlign: 'center' }}>Motivación e influencia</th>
              <th style={{ padding: '12px 14px', fontSize: 14, fontWeight: 400, color: '#0F172A', background: '#f3f4f6', position: 'sticky', top: 0, zIndex: 2, textAlign: 'center' }}>Promedio</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((row, idx) => (
              <tr key={row.codigo || idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa', fontSize: 13, borderBottom: '1px solid #eef2f7' }}>
                <td style={{ padding: '6px 8px', textAlign: 'center', width: 90, maxWidth: 90, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace', fontWeight: 700 }}>{row.codigo || '-'}</td>
                <td title={String(row.nombre)} style={{ padding: '10px 12px', color: '#111827', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 560 }}>{row.nombre}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>{row.fecha}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: row.evaluadores <= 2 ? '#fee2e2' : '#eef2ff', color: row.evaluadores <= 2 ? '#dc2626' : '#0b5394', padding: '6px 8px', borderRadius: 8 }}>{row.evaluadores}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ display: 'inline-block', minWidth: 48, padding: '6px 8px', borderRadius: 8, background: typeof row.comunicacion === 'number' ? getAvgColor(row.comunicacion) : 'transparent' }}>{row.comunicacion}</span></td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ display: 'inline-block', minWidth: 48, padding: '6px 8px', borderRadius: 8, background: typeof row.respeto === 'number' ? getAvgColor(row.respeto) : 'transparent' }}>{row.respeto}</span></td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ display: 'inline-block', minWidth: 48, padding: '6px 8px', borderRadius: 8, background: typeof row.desarrollo === 'number' ? getAvgColor(row.desarrollo) : 'transparent' }}>{row.desarrollo}</span></td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ display: 'inline-block', minWidth: 48, padding: '6px 8px', borderRadius: 8, background: typeof row.adaptabilidad === 'number' ? getAvgColor(row.adaptabilidad) : 'transparent' }}>{row.adaptabilidad}</span></td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ display: 'inline-block', minWidth: 48, padding: '6px 8px', borderRadius: 8, background: typeof row.motivacion === 'number' ? getAvgColor(row.motivacion) : 'transparent' }}>{row.motivacion}</span></td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ display: 'inline-block', minWidth: 56, padding: '6px 8px', borderRadius: 8, background: typeof row.promedio === 'number' ? getAvgColor(row.promedio) : 'transparent' }}>{row.promedio}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 style={{ marginTop: 18, marginBottom: 8, fontSize: 18, fontWeight: 700 }}>Resultados de estilos</h2>
      <div style={styles.container}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 100, whiteSpace: 'nowrap' }}>Cod</th>
              <th style={styles.thLeft}>Evaluado</th>
              <th style={styles.th}>Fecha</th>
              <th style={styles.th}>Número de evaluadores</th>
              {estilosCols && estilosCols.length ? (
                estilosCols.map((label) => <th key={label} style={styles.th}>{formatLabel(label)}</th>)
              ) : (
                <>
                  <th style={styles.th}>Comunicación y dirección</th>
                  <th style={styles.th}>Respeto y confianza</th>
                  <th style={styles.th}>Desarrollo de equipo y empowerment</th>
                  <th style={styles.th}>Adaptabilidad y resiliencia</th>
                  <th style={styles.th}>Motivación e influencia</th>
                </>
              )}
              <th style={styles.th}>Promedio</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((row, idx) => (
              <tr key={row.codigo || idx} style={{ ...styles.tr, background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ ...styles.td, whiteSpace: 'nowrap', width: 90, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace', fontWeight: 700 }}>{row.codigo || '-'}</td>
                <td style={styles.nameTd} title={String(row.nombre)}>{row.nombre}</td>
                <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>{row.fecha}</td>
                <td style={styles.td}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ ...styles.badge, background: row.evaluadores <= 2 ? '#fee2e2' : '#eef2ff', color: row.evaluadores <= 2 ? '#dc2626' : '#0b5394' }}>{row.evaluadores}</span>
                  </div>
                </td>
                {estilosCols && estilosCols.length ? (
                  estilosCols.map(label => (
                    <td key={label} style={styles.td}><span style={styles.avgBadge(row.estilos ? row.estilos[label] : null)}>{(row.estilos && row.estilos[label] != null) ? row.estilos[label] : '-'}</span></td>
                  ))
                ) : (
                  <>
                    <td style={styles.td}><span style={styles.avgBadge(row.comunicacion)}>{row.comunicacion}</span></td>
                    <td style={styles.td}><span style={styles.avgBadge(row.respeto)}>{row.respeto}</span></td>
                    <td style={styles.td}><span style={styles.avgBadge(row.desarrollo)}>{row.desarrollo}</span></td>
                    <td style={styles.td}><span style={styles.avgBadge(row.adaptabilidad)}>{row.adaptabilidad}</span></td>
                    <td style={styles.td}><span style={styles.avgBadge(row.motivacion)}>{row.motivacion}</span></td>
                  </>
                )}
                <td style={{ ...styles.td }}><span style={styles.avgBadge(row.promedio)}>{row.promedio}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
