import ExcelJS from 'exceljs';

export interface ResponseEntry {
  id: string;
  createdAt: string;
  responses?: Record<string, string>;
  token?: string;
  evaluatorName?: string;
  evaluadoNombre?: string;
  evaluadoCodigo?: string;
}

const LABEL_TO_VALUE: Record<string, number> = {
  'nunca': 1,
  'rara vez': 2,
  'casi nunca': 3,
  'a veces': 4,
  'siempre': 5,
};

function mapLabelToNumeric(label?: string): number | null {
  if (!label) return null;
  const norm = label.trim().toLowerCase();
  if (norm in LABEL_TO_VALUE) return LABEL_TO_VALUE[norm];
  return null;
}

export async function exportToExcel(
  entries: ResponseEntry[],
  estilos: Array<{ pregunta: string }>,
  instrucciones: string[],
  afirmaciones: Array<{ codigo?: string; pregunta?: string; tipo?: string | null; categoria?: string }>,
  competencias: string[]
) {
  const workbook = new ExcelJS.Workbook();

  // create two worksheets for Competencias and Estilos
  const sheetComp = workbook.addWorksheet('Competencias');
  const sheetEst = workbook.addWorksheet('Estilos');

  // Competencia and estilo labels
  const competenciaCols = (Array.isArray(competencias) && competencias.length) ? competencias : ['Comunicación', 'Respeto', 'Desarrollo', 'Adaptabilidad', 'Motivación'];
  const estiloCols = estilos.map(e => String(e.pregunta || '').toUpperCase());

  // split afirmaciones by category
  const compAfirmaciones = (Array.isArray(afirmaciones) ? afirmaciones : []).filter(a => String(a?.categoria || '').toLowerCase() === 'competencia');
  const estAfirmaciones = (Array.isArray(afirmaciones) ? afirmaciones : []).filter(a => String(a?.categoria || '').toLowerCase() === 'estilo');

  // build columns for competencias sheet
  sheetComp.columns = [
    { header: 'CÓDIGO', key: 'codigo', width: 12 },
    { header: 'EVALUADO', key: 'evaluado', width: 30 },
    { header: 'EVALUADOR', key: 'evaluador', width: 28 },
    { header: 'FECHA', key: 'fecha', width: 18 },
    ...competenciaCols.map(c => ({ header: String(c).toUpperCase(), key: `comp_${String(c)}`, width: 14 })),
    ...compAfirmaciones.map(a => ({ header: `${String(a.codigo || '')} - ${String(a.pregunta || '')}`.toUpperCase().substring(0, 40), key: `aff_${String(a.codigo)}`, width: 40 })),
    ...instrucciones.map(i => ({ header: String(i).toUpperCase().substring(0, 15), key: `ins_${String(i)}`, width: 11 })),
    { header: 'PROMEDIO', key: 'promedio', width: 12 }
  ];

  // build columns for estilos sheet
  sheetEst.columns = [
    { header: 'CÓDIGO', key: 'codigo', width: 12 },
    { header: 'EVALUADO', key: 'evaluado', width: 30 },
    { header: 'EVALUADOR', key: 'evaluador', width: 28 },
    { header: 'FECHA', key: 'fecha', width: 18 },
    ...estiloCols.map(c => ({ header: c, key: `est_${c}`, width: 14 })),
    ...estAfirmaciones.map(a => ({ header: `${String(a.codigo || '')} - ${String(a.pregunta || '')}`.toUpperCase().substring(0, 40), key: `aff_${String(a.codigo)}`, width: 40 })),
    ...instrucciones.map(i => ({ header: String(i).toUpperCase().substring(0, 15), key: `ins_${String(i)}`, width: 11 })),
    { header: 'PROMEDIO', key: 'promedio', width: 12 }
  ];

  const styleHeader = (headerRow: any) => {
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.height = 30;
    headerRow.eachCell((cell: any) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
    });
  };

  styleHeader(sheetComp.getRow(1));
  styleHeader(sheetEst.getRow(1));

  let rowNumber = 2;

  // build lookup of afirmaciones by code
  const affByCode: Record<string, any> = {};
  (Array.isArray(afirmaciones) ? afirmaciones : []).forEach(a => { if (a && a.codigo) affByCode[String(a.codigo)] = a; });

  // build codes grouped by competencia similar to UI logic
  const codesByGroup: Record<string, string[]> = {};
  const compKeys = competenciaCols.map(c => String(c).toLowerCase());
  compKeys.forEach(k => { codesByGroup[k] = []; });
  (Array.isArray(afirmaciones) ? afirmaciones : []).forEach((a: any) => {
    try {
      if (!a) return;
      const categoria = String(a.categoria || '').toLowerCase();
      if (categoria && categoria !== 'competencia') return;
      const tipoRaw = a.tipo != null ? String(a.tipo) : '';
      const tipo = tipoRaw.trim().toLowerCase();
      const foundKey = compKeys.find(k => k === tipo || tipo.includes(k) || k.includes(tipo));
      if (foundKey) codesByGroup[foundKey].push(String(a.codigo));
      else {
        if (tipo.includes('comunic')) codesByGroup['comunicación']?.push(String(a.codigo));
        if (tipo.includes('resp')) codesByGroup['respeto']?.push(String(a.codigo));
        if (tipo.includes('desar')) codesByGroup['desarrollo']?.push(String(a.codigo));
        if (tipo.includes('adapt')) codesByGroup['adaptabilidad']?.push(String(a.codigo));
        if (tipo.includes('motiva') || tipo.includes('influ')) codesByGroup['motivación']?.push(String(a.codigo));
      }
    } catch (e) {}
  });

  // normalize all incoming entries and group by evaluated code to compute aggregated averages
  const normalizedRows = (Array.isArray(entries) ? entries : []).map((r: any) => {
    const responses = r.responses || r.respuestas || r.answers || {};
    const normalizedResp: Record<string, any> = {};
    Object.keys(responses || {}).forEach(k => {
      const v = responses[k];
      if (affByCode[k]) { normalizedResp[k] = v; return; }
      const m = String(k).match(/^(?:comp|est)-(\d+)$/i);
      if (m) {
        const idx = parseInt(m[1], 10);
        const aff = Array.isArray(afirmaciones) && afirmaciones[idx] ? afirmaciones[idx] : null;
        if (aff && aff.codigo) { normalizedResp[String(aff.codigo)] = v; return; }
      }
      normalizedResp[k] = v;
    });
    return {
      evaluadoCodigo: r.evaluadoCodigo || r.evaluado_codigo || r.evaluadoCode || r.codigo_evaluado || r.token || '',
      evaluadoNombre: r.evaluadoNombre || r.evaluado_nombre || r.nombre || '',
      evaluatorName: r.evaluatorName || r.evaluator_name || r.evaluador || r.evaluator || '',
      responses: normalizedResp,
      createdAt: r.createdAt || r.created_at || r.fecha || ''
    };
  });

  const byEvaluado: Record<string, any> = {};
  normalizedRows.forEach((r: any) => {
    const code = String(r.evaluadoCodigo || r.token || '');
    if (!byEvaluado[code]) byEvaluado[code] = { codigo: code, nombre: r.evaluadoNombre || '', evaluadoresSet: new Set<string>(), entries: [] };
    if (r.evaluatorName) byEvaluado[code].evaluadoresSet.add(String(r.evaluatorName).trim());
    byEvaluado[code].entries.push(r);
  });
  // populate both sheets with aggregated rows
  Object.values(byEvaluado).forEach((item: any) => {
    const evaluadores = item.evaluadoresSet ? item.evaluadoresSet.size : 0;
    // Only export evaluateds with more than 3 evaluators
    if (!(evaluadores > 3)) return;

    const fechaVal = item.entries && item.entries.length ? (item.entries[0].createdAt ? new Date(item.entries[0].createdAt).toLocaleDateString() : '-') : '-';

    // --- Competencias sheet row ---
    const compRowValues: any[] = [];
    compRowValues.push(item.codigo || '-');
    compRowValues.push(item.nombre || '-');
    compRowValues.push(Array.from(item.evaluadoresSet || []).join(', ') || '-');
    compRowValues.push(fechaVal);

    // competencia averages
    const compKeys = competenciaCols.map(c => String(c).toLowerCase());
    compKeys.forEach((ck: string) => {
      const codes = ((): string[] => {
        try {
          const arr: string[] = [];
          (Array.isArray(afirmaciones) ? afirmaciones : []).forEach((a: any) => {
            const categoria = String(a.categoria || '').toLowerCase();
            if (categoria !== 'competencia') return;
            const tipo = String(a.tipo || '').toLowerCase();
            if (tipo && (tipo === ck || tipo.includes(ck) || ck.includes(tipo))) arr.push(String(a.codigo));
          });
          return arr;
        } catch (e) { return []; }
      })();
      const vals: number[] = [];
      item.entries.forEach((e: any) => {
        codes.forEach((c: string) => {
          const raw = e.responses?.[c];
          const num = mapLabelToNumeric(String(raw || ''));
          if (typeof num === 'number' && !isNaN(num)) vals.push(num);
        });
      });
      const avg = vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : '-';
      compRowValues.push(avg);
    });

    // individual competencia afirmaciones
    compAfirmaciones.forEach((a: any) => {
      const code = String(a.codigo || '');
      const vals: number[] = [];
      item.entries.forEach((e: any) => {
        const raw = e.responses?.[code];
        const num = mapLabelToNumeric(String(raw || ''));
        if (typeof num === 'number' && !isNaN(num)) vals.push(num);
      });
      const avg = vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : '-';
      compRowValues.push(avg);
    });

    // instrucciones
    instrucciones.forEach((ins: any) => {
      const vals: number[] = [];
      item.entries.forEach((e: any) => {
        Object.keys(e.responses || {}).forEach(k => {
          if (String(e.responses[k]) === String(ins)) {
            const num = mapLabelToNumeric(String(e.responses[k] || ''));
            if (typeof num === 'number' && !isNaN(num)) vals.push(num);
          }
        });
      });
      const avg = vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : '-';
      compRowValues.push(avg);
    });

    // overall promedio
    const allNums: number[] = [];
    item.entries.forEach((e: any) => {
      Object.keys(e.responses || {}).forEach(k => {
        const num = mapLabelToNumeric(String(e.responses[k] || ''));
        if (typeof num === 'number' && !isNaN(num)) allNums.push(num);
      });
    });
    const overall = allNums.length ? +(allNums.reduce((s, v) => s + v, 0) / allNums.length).toFixed(2) : '-';
    compRowValues.push(overall);

    const compRow = sheetComp.addRow(compRowValues);
    compRow.eachCell((cell: any, colNumber: number) => {
      cell.font = { size: 10, color: { argb: 'FF0F172A' } };
      cell.alignment = { horizontal: colNumber >= 5 ? 'center' : 'left', vertical: 'middle' };
      if (!cell.border) {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        };
      }
    });
    compRow.height = 18;

    // --- Estilos sheet row ---
    const estRowValues: any[] = [];
    estRowValues.push(item.codigo || '-');
    estRowValues.push(item.nombre || '-');
    estRowValues.push(Array.from(item.evaluadoresSet || []).join(', ') || '-');
    estRowValues.push(fechaVal);

    // estilos averages (per estiloCols)
    estiloCols.forEach((label: string) => {
      const codesForEst: string[] = [];
      (Array.isArray(afirmaciones) ? afirmaciones : []).forEach(a => {
        try {
          if (!a) return;
          const categoria = String(a.categoria || '').toLowerCase();
          const tipo = String(a.tipo || '').toLowerCase();
          if (categoria === 'estilo') {
            if (tipo && tipo === label.toLowerCase()) codesForEst.push(String(a.codigo));
            else if (String(a.pregunta || '').toLowerCase().includes(label.toLowerCase())) codesForEst.push(String(a.codigo));
          }
        } catch (e) {}
      });
      const vals: number[] = [];
      item.entries.forEach((e: any) => {
        codesForEst.forEach(c => {
          const raw = e.responses?.[c];
          const num = mapLabelToNumeric(String(raw || ''));
          if (typeof num === 'number' && !isNaN(num)) vals.push(num);
        });
      });
      const avg = vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : '-';
      estRowValues.push(avg);
    });

    // individual estilo afirmaciones
    estAfirmaciones.forEach((a: any) => {
      const code = String(a.codigo || '');
      const vals: number[] = [];
      item.entries.forEach((e: any) => {
        const raw = e.responses?.[code];
        const num = mapLabelToNumeric(String(raw || ''));
        if (typeof num === 'number' && !isNaN(num)) vals.push(num);
      });
      const avg = vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : '-';
      estRowValues.push(avg);
    });

    // instrucciones
    instrucciones.forEach((ins: any) => {
      const vals: number[] = [];
      item.entries.forEach((e: any) => {
        Object.keys(e.responses || {}).forEach(k => {
          if (String(e.responses[k]) === String(ins)) {
            const num = mapLabelToNumeric(String(e.responses[k] || ''));
            if (typeof num === 'number' && !isNaN(num)) vals.push(num);
          }
        });
      });
      const avg = vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : '-';
      estRowValues.push(avg);
    });

    estRowValues.push(overall);

    const estRow = sheetEst.addRow(estRowValues);
    estRow.eachCell((cell: any, colNumber: number) => {
      cell.font = { size: 10, color: { argb: 'FF0F172A' } };
      cell.alignment = { horizontal: colNumber >= 5 ? 'center' : 'left', vertical: 'middle' };
      if (!cell.border) {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        };
      }
    });
    estRow.height = 18;

    rowNumber++;
  });

  sheetComp.views = [{ state: 'frozen', ySplit: 1 }];
  sheetEst.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Resultados-Evaluaciones-${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
