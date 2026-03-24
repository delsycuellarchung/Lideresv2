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
  const worksheet = workbook.addWorksheet('Resultados');
  const headers = ['CÓDIGO', 'EVALUADO', 'EVALUADOR', 'FECHA'];
  // Competencia columns: if provided use campe names, else fallback to defaults
  const competenciaCols = (Array.isArray(competencias) && competencias.length) ? competencias : ['Comunicación', 'Respeto', 'Desarrollo', 'Adaptabilidad', 'Motivación'];
  headers.push(...competenciaCols.map(c => String(c).toUpperCase()));
  // Estilos columns
  const estiloCols = estilos.map(e => String(e.pregunta || '').toUpperCase());
  headers.push(...estiloCols);
  // instrucciones kept for backward-compat but appended after estilos
  headers.push(...instrucciones.map(i => String(i).toUpperCase().substring(0, 15)));
  headers.push('PROMEDIO');

  worksheet.columns = [
    { header: 'CÓDIGO', key: 'codigo', width: 12 },
    { header: 'EVALUADO', key: 'evaluado', width: 30 },
    { header: 'EVALUADOR', key: 'evaluador', width: 28 },
    { header: 'FECHA', key: 'fecha', width: 18 },
    ...competenciaCols.map(c => ({ header: String(c).toUpperCase(), key: `comp_${String(c)}`, width: 14 })),
    ...estiloCols.map(c => ({ header: c, key: `est_${c}`, width: 14 })),
    ...instrucciones.map(i => ({ header: String(i).toUpperCase().substring(0, 15), key: `ins_${String(i)}`, width: 11 })),
    { header: 'PROMEDIO', key: 'promedio', width: 12 }
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.height = 30;

  headerRow.eachCell(cell => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
  });

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

  Object.values(byEvaluado).forEach((item: any) => {
    const evaluadores = item.evaluadoresSet ? item.evaluadoresSet.size : 0;
    // Only export evaluateds with more than 3 evaluators
    if (!(evaluadores > 3)) return;

    const row = worksheet.getRow(rowNumber);
    row.getCell(1).value = item.codigo || '-';
    row.getCell(2).value = item.nombre || '-';
    row.getCell(3).value = Array.from(item.evaluadoresSet || []).join(', ') || '-';
    row.getCell(4).value = item.entries && item.entries.length ? (item.entries[0].createdAt ? new Date(item.entries[0].createdAt).toLocaleDateString() : '-') : '-';

    const baseIndex = 5;
    // competencias averages across entries
    compKeys.forEach((ck, i) => {
      const codes = codesByGroup[ck] || [];
      const vals: number[] = [];
      item.entries.forEach((e: any) => {
        codes.forEach((c: string) => {
          const raw = e.responses?.[c];
          const num = mapLabelToNumeric(String(raw || ''));
          if (typeof num === 'number' && !isNaN(num)) vals.push(num);
        });
      });
      const avg = vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : null;
      row.getCell(baseIndex + i).value = avg !== null ? avg : '-';
    });

    // estilos averages across entries
    estiloCols.forEach((label, ei) => {
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
      const avg = vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : null;
      row.getCell(baseIndex + compKeys.length + ei).value = avg !== null ? avg : '-';
    });

    // instrucciones averages across entries
    instrucciones.forEach((ins, insIdx) => {
      const vals: number[] = [];
      item.entries.forEach((e: any) => {
        Object.keys(e.responses || {}).forEach(k => {
          if (String(e.responses[k]) === String(ins)) {
            const num = mapLabelToNumeric(String(e.responses[k] || ''));
            if (typeof num === 'number' && !isNaN(num)) vals.push(num);
          }
        });
      });
      const colIdx = baseIndex + compKeys.length + estiloCols.length + insIdx;
      const avg = vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : null;
      row.getCell(colIdx).value = avg !== null ? avg : '-';
    });

    // overall promedio across all numeric answers for this evaluated
    const allNums: number[] = [];
    item.entries.forEach((e: any) => {
      Object.keys(e.responses || {}).forEach(k => {
        const num = mapLabelToNumeric(String(e.responses[k] || ''));
        if (typeof num === 'number' && !isNaN(num)) allNums.push(num);
      });
    });
    const promedioCol = baseIndex + compKeys.length + estiloCols.length + instrucciones.length;
    const overall = allNums.length ? +(allNums.reduce((s, v) => s + v, 0) / allNums.length).toFixed(2) : null;
    row.getCell(promedioCol).value = overall !== null ? overall : '-';

    row.eachCell((cell, colNumber) => {
      cell.font = { size: 10, color: { argb: 'FF0F172A' } };
      cell.alignment = { horizontal: colNumber >= baseIndex ? 'center' : 'left', vertical: 'middle' };
      if (!cell.border) {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        };
      }
    });

    row.height = 18;
    rowNumber++;
  });

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

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
