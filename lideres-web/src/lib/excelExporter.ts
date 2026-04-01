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
  const norm = String(label).trim().toLowerCase();
  if (norm in LABEL_TO_VALUE) return LABEL_TO_VALUE[norm];
  // accept numeric strings or numbers 1-5 as valid values
  const asNum = Number(String(label).trim());
  if (!Number.isNaN(asNum) && asNum >= 1 && asNum <= 5) return asNum;
  return null;
}

// resolve a numeric value for an affirmation from an entry's responses
const resolveNumeric = (eResponses: Record<string, any> | undefined, aCodigo: any, globalIdx: number) => {
  if (!eResponses) return null;
  let raw = aCodigo ? eResponses[aCodigo] : undefined;
  if ((raw === undefined || raw === null) && globalIdx >= 0) raw = eResponses[`comp-${globalIdx}`];
  const num = mapLabelToNumeric(raw === undefined || raw === null ? '' : String(raw));
  return (typeof num === 'number' && !isNaN(num)) ? num : null;
};

export async function exportToExcel(
  entries: ResponseEntry[],
  estilos: Array<{ pregunta: string }>,
  instrucciones: string[],
  afirmaciones: Array<{ codigo?: string; pregunta?: string; tipo?: string | null; categoria?: string }>,
  competencias: string[]
) {
  const workbook = new ExcelJS.Workbook();

  const sheetComp = workbook.addWorksheet('Competencias');
  const sheetEst = workbook.addWorksheet('Estilos');

  // palettes (match UI)
  const compPalette = ['EF8A4B','F59E0B','10B981','06B6D4','8B5CF6','F97316','EF4444'];
  const estPalette = ['1E3A8A','1D4ED8','3B82F6','60A5FA','93C5FD','BFDBFE','DBEAFE'];

  // helper: lookup afirmaciones by code
  const affByCode: Record<string, any> = {};
  (Array.isArray(afirmaciones) ? afirmaciones : []).forEach(a => { if (a && a.codigo) affByCode[String(a.codigo)] = a; });

  const normalizeEntry = (r: any) => {
    const responses = r.responses || r.respuestas || r.answers || r || {};
    const normalized: Record<string, any> = {};
    Object.keys(responses || {}).forEach(k => {
      const v = responses[k];
      if (affByCode[k]) { normalized[k] = v; return; }
      const m = String(k).match(/^(?:comp|est)-(\d+)$/i);
      if (m) {
        const idx = parseInt(m[1], 10);
        const aff = Array.isArray(afirmaciones) && afirmaciones[idx] ? afirmaciones[idx] : null;
        if (aff && aff.codigo) { normalized[String(aff.codigo)] = v; return; }
      }
      normalized[k] = v;
    });
    return { ...r, responses: normalized };
  };

  const normEntries = (Array.isArray(entries) ? entries : []).map(e => normalizeEntry(e));

  // determine competencia groups similar to UI logic
  const compList = (Array.isArray(competencias) && competencias.length) ? competencias : Array.from(new Set((afirmaciones || []).map(a => String(a.tipo || '').trim()).filter(Boolean)));
  const comps: Record<string, any[]> = {};
  (afirmaciones || []).filter(a => {
    if (!a.tipo) return false;
    if (a.categoria === 'competencia') return true;
    if (a.categoria === 'estilo') return false;
    if ((Array.isArray(estilos) ? estilos.map(e=>String(e.pregunta)) : []).includes(String(a.tipo))) return false;
    if (!compList.length) return true;
    return compList.includes(String(a.tipo));
  }).forEach(a => {
    const tipo = String(a.tipo || '');
    if (!comps[tipo]) comps[tipo] = [];
    comps[tipo].push(a);
  });
  compList.forEach(c => { if (!comps[c]) comps[c] = []; });

  // headers for competencias sheet (removed COD column)
  const compHeaders = ['AFIRMACIÓN / COMPORTAMIENTO','PROMEDIO AFIRMACIÓN','PROMEDIO COMPETENCIA','PROMEDIO COMPETENCIAS'];
  sheetComp.columns = compHeaders.map(h => ({ header: h, key: h, width: h === 'AFIRMACIÓN / COMPORTAMIENTO' ? 80 : 18 }));

  // style header
  const headerRowComp = sheetComp.getRow(1);
  headerRowComp.font = { bold: true, size: 11 };
  headerRowComp.alignment = { horizontal: 'center', vertical: 'middle' };

  const renderSafe = (v: any) => (v === null || v === undefined ? '' : String(v));

  let currentRow = 2;
  const compKeys = Object.keys(comps);
  compKeys.forEach((compKey, idx) => {
    const compRows = comps[compKey] && comps[compKey].length ? comps[compKey] : [{ codigo: undefined, pregunta: '(sin afirmaciones)', tipo: compKey, categoria: 'competencia' }];
    // compute comp average (if single entry provided, compute average for that evaluado)
    const allValsForComp: number[] = [];
    if (normEntries.length === 1) {
      // average across affirmations for the single entry
      const eResponses = normEntries[0].responses || {};
      compRows.forEach((a: any) => {
        const globalIdx = (afirmaciones || []).findIndex(af => af.codigo === a.codigo);
        const num = resolveNumeric(eResponses, a.codigo, globalIdx);
        if (num !== null) allValsForComp.push(num);
      });
    } else {
      compRows.forEach((a: any) => {
        const globalIdx = (afirmaciones || []).findIndex(af => af.codigo === a.codigo);
        normEntries.forEach(e => {
          const num = resolveNumeric(e.responses || {}, a.codigo, globalIdx);
          if (num !== null) allValsForComp.push(num);
        });
      });
    }
    const compAvg = allValsForComp.length ? +(allValsForComp.reduce((s,v)=>s+v,0)/allValsForComp.length).toFixed(2) : '';

    const colorHex = compPalette[idx % compPalette.length];
    const colorARGB = 'FF' + colorHex;
    const colorARGBAlpha = '22' + colorHex;

    const startRow = currentRow;
    compRows.forEach((a: any, i: number) => {
      const globalIdx = (afirmaciones || []).findIndex(af => af.codigo === a.codigo);
      // compute avg for this affirmation
      let avgAff: any = '';
      if (normEntries.length === 1) {
        const num = resolveNumeric(normEntries[0].responses || {}, a.codigo, globalIdx);
        avgAff = num !== null ? Number(num) : '';
      } else {
        const vals: number[] = [];
        normEntries.forEach(e => {
          const num = resolveNumeric(e.responses || {}, a.codigo, globalIdx);
          if (num !== null) vals.push(num);
        });
        avgAff = vals.length ? +(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : '';
      }

        const row = sheetComp.getRow(currentRow);
        // Columna 1: Afirmación
        row.getCell(1).value = renderSafe(a.pregunta || '');
        // Columna 2: Promedio Afirmación
        row.getCell(2).value = avgAff === '' ? '' : Number(avgAff);
        // Columna 3: Promedio Competencias (compAvg del grupo)
        row.getCell(3).value = compAvg === '' ? '' : Number(compAvg);
        // Columna 4: Promedio Competencia (en tu caso normalmente blank o igual a compAvg si es por competencia; si no, deja '')
        row.getCell(4).value = ''; // O compAvg si tu estructura así lo requiere

        // borders
        [1, 2, 3, 4].forEach(ci => {
          const c = row.getCell(ci);
          c.border = { top: { style: 'thin', color: { argb: 'FFe5e7eb' } }, left: { style: 'thin', color: { argb: 'FFe5e7eb' } }, bottom: { style: 'thin', color: { argb: 'FFe5e7eb' } }, right: { style: 'thin', color: { argb: 'FFe5e7eb' } } };
        });

        currentRow++;
    });
    const endRow = currentRow - 1;
    // merge competencia column cells
    sheetComp.mergeCells(startRow, 3, endRow, 3);
    const compAvgCell = sheetComp.getCell(startRow, 3);
    const compAvgCellValue: string | number = compAvg !== '' ? Number(compAvg) : '';
    compAvgCell.value = compAvgCellValue as any;
    compAvgCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    compAvgCell.font = { bold: true, size: 14, color: { argb: 'FF3730A3' } };
    compAvgCell.alignment = { vertical: 'middle', horizontal: 'center' };

    sheetComp.mergeCells(startRow, 4, endRow, 4);
    const overallCell = sheetComp.getCell(startRow, 4);
    overallCell.value = '';
    overallCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    overallCell.font = { bold: true, size: 18 };
    overallCell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // estilos sheet: similar structure
  // derive effectiveEstilos in clear steps to avoid complex inline expressions
  let effectiveEstilos: string[] = [];
  if (Array.isArray(estilos) && estilos.length) {
    effectiveEstilos = estilos.map(e => String(e.pregunta));
  } else {
    const tipos = (afirmaciones || []).map(a => a.tipo).filter((t): t is string => typeof t === 'string' && t.trim() !== '');
    if (competencias && competencias.length) {
      effectiveEstilos = Array.from(new Set(tipos.filter(t => !competencias.includes(String(t)))));
    } else {
      effectiveEstilos = Array.from(new Set(tipos));
    }
  }
  const estGroups: Record<string, any[]> = {};
  (afirmaciones || []).filter(a => {
    if (!a.tipo) return false;
    if (a.categoria === 'estilo') return true;
    if (a.categoria === 'competencia') return false;
    if (effectiveEstilos.includes(String(a.tipo))) return true;
    return false;
  }).forEach(a => {
    const tipo = String(a.tipo || '');
    if (!estGroups[tipo]) estGroups[tipo] = [];
    estGroups[tipo].push(a);
  });
  effectiveEstilos.forEach(s => { if (!estGroups[s]) estGroups[s] = []; });
  const estHeaders = ['AFIRMACIÓN / COMPORTAMIENTO','PROMEDIO AFIRMACIÓN','PROMEDIO ESTILOS','PROMEDIO ESTILO'];
  sheetEst.columns = estHeaders.map(h => ({ header: h, key: h, width: h === 'AFIRMACIÓN / COMPORTAMIENTO' ? 80 : 18 }));
  const headerRowEst = sheetEst.getRow(1);
  headerRowEst.font = { bold: true, size: 11 };
  headerRowEst.alignment = { horizontal: 'center', vertical: 'middle' };

  let estRowIdx = 2;
  const estKeys = Object.keys(estGroups);
  estKeys.forEach((estKey, idx) => {
    const rowsForEst = estGroups[estKey] && estGroups[estKey].length ? estGroups[estKey] : [{ codigo: undefined, pregunta: '(sin afirmaciones)', tipo: estKey, categoria: 'estilo' }];
    const allValsForEst: number[] = [];
    rowsForEst.forEach((a:any) => {
      const globalIdx = (afirmaciones || []).findIndex(af => af.codigo === a.codigo);
      normEntries.forEach(e => {
        let raw = a.codigo ? e.responses?.[a.codigo] : undefined;
        if ((raw === undefined || raw === null) && globalIdx >= 0) raw = e.responses?.[`comp-${globalIdx}`];
        const num = mapLabelToNumeric(String(raw || ''));
        if (typeof num === 'number' && !isNaN(num)) allValsForEst.push(num);
      });
    });
    const estAvg = allValsForEst.length ? +(allValsForEst.reduce((s,v)=>s+v,0)/allValsForEst.length).toFixed(2) : '';

    const colorHex = estPalette[idx % estPalette.length];
    const colorARGB = 'FF' + colorHex;
    const colorARGBAlpha = '22' + colorHex;

    const start = estRowIdx;
    rowsForEst.forEach((a:any) => {
      const globalIdx = (afirmaciones || []).findIndex(af => af.codigo === a.codigo);
      const vals: number[] = [];
      normEntries.forEach(e => {
        let raw = a.codigo ? e.responses?.[a.codigo] : undefined;
        if ((raw === undefined || raw === null) && globalIdx >= 0) raw = e.responses?.[`comp-${globalIdx}`];
        const num = mapLabelToNumeric(String(raw || ''));
        if (typeof num === 'number' && !isNaN(num)) vals.push(num);
      });
      const avgAff = vals.length ? +(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : '';

      const row = sheetEst.getRow(estRowIdx);
      // columns: 1 ESTILO (merged), 2 AFIRMACIÓN, 3 avg aff, 4 estAvg (merged), 5 overall
      row.getCell(1).value = renderSafe(a.pregunta || '');
      const avgAffCellValue: string | number = avgAff === '' ? '' : Number(avgAff);
      row.getCell(2).value = avgAffCellValue as any;
      [1,2].forEach(ci => { const c = row.getCell(ci); c.border = { top: { style: 'thin', color: { argb: 'FFe5e7eb' } }, left: { style: 'thin', color: { argb: 'FFe5e7eb' } }, bottom: { style: 'thin', color: { argb: 'FFe5e7eb' } }, right: { style: 'thin', color: { argb: 'FFe5e7eb' } } }; });
      estRowIdx++;
    });
    const end = estRowIdx - 1;
     sheetEst.mergeCells(start, 3, end, 3);
    const estAvgCell = sheetEst.getCell(start, 3);
    const estAvgCellValueDtl: string | number = estAvg !== '' ? Number(estAvg) : '';
    estAvgCell.value = estAvgCellValueDtl as any;
    estAvgCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    estAvgCell.font = { bold: true, size: 14, color: { argb: 'FF3730A3' } };

    sheetEst.mergeCells(start, 4, end, 4);
    const estOverall = sheetEst.getCell(start, 4);
    estOverall.value = '';
    estOverall.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
  });

  sheetComp.views = [{ state: 'frozen', ySplit: 1 }];
  sheetEst.views = [{ state: 'frozen', ySplit: 1 }];

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Resultados-Evaluaciones-${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportDetalle(
  entries: ResponseEntry[],
  afirmaciones: Array<{ codigo?: string; pregunta?: string; tipo?: string | null; categoria?: string }>,
  competenciasList: string[],
  estilosList: string[]
) {
  const workbook = new ExcelJS.Workbook();
  const sheetComp = workbook.addWorksheet('Competencias');
  const sheetEst = workbook.addWorksheet('Estilos');

  const paletteComp = ['#EF8A4B', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#F97316', '#EF4444'];
  const paletteEst = ['#1E3A8A', '#1D4ED8', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'];

  const renderSafe = (v: any) => (v === null || v === undefined ? '' : String(v));

  // build comps map following the same logic as UI
  const comps: Record<string, any[]> = {};
  // derive effective competencia list logic in clear steps
  const effectiveCompetenciasList: string[] = Array.isArray(competenciasList) && competenciasList.length ? competenciasList : Array.from(new Set((afirmaciones || []).map(a => a.tipo).filter((t): t is string => typeof t === 'string' && t.trim() !== '')));

  (afirmaciones || []).filter(a => {
    if (!a.tipo) return false;
    if (a.categoria === 'competencia') return true;
    if (a.categoria === 'estilo') return false;
    if (estilosList && estilosList.length && estilosList.includes(String(a.tipo))) return false;
    if (!effectiveCompetenciasList || effectiveCompetenciasList.length === 0) return true;
    return effectiveCompetenciasList.includes(String(a.tipo));
  }).forEach(a => {
    const tipo = String(a.tipo || '');
    if (!comps[tipo]) comps[tipo] = [];
    comps[tipo].push(a);
  });
  (effectiveCompetenciasList || []).forEach(c => { if (!comps[c]) comps[c] = []; });
  // setup headers (removed COD column)
    const compHeaders = ['AFIRMACIÓN / COMPORTAMIENTO','PROMEDIO AFIRMACIÓN','PROMEDIO COMPETENCIA','PROMEDIO COMPETENCIAS'];
    sheetComp.columns = compHeaders.map(h => ({ header: h, key: h, width: h === 'AFIRMACIÓN / COMPORTAMIENTO' ? 80 : 18 }));

  const headerRowComp = sheetComp.getRow(1);
  headerRowComp.font = { bold: true, size: 11 };
  headerRowComp.alignment = { horizontal: 'center', vertical: 'middle' };

  // normalize passed entries so comp-N keys map to afirmacion.codigo
  const normalizeEntry = (r: any) => {
    const responses = r?.responses || r?.respuestas || r?.answers || r || {};
    const normalized: Record<string, any> = {};
    Object.keys(responses || {}).forEach(k => {
      const v = responses[k];
      const m = String(k).match(/^(?:comp|est)-(\d+)$/i);
      if (m) {
        const idx = parseInt(m[1], 10);
        const aff = Array.isArray(afirmaciones) && afirmaciones[idx] ? afirmaciones[idx] : null;
        if (aff && aff.codigo) { normalized[String(aff.codigo)] = v; return; }
      }
      normalized[k] = v;
    });
    return { ...r, responses: normalized };
  };

  const normEntries = (Array.isArray(entries) ? entries : []).map(e => normalizeEntry(e));

  let rowIdx = 2;
  const compKeys = Object.keys(comps);
  compKeys.forEach((compKey, idx) => {
    const compRows = comps[compKey] && comps[compKey].length ? comps[compKey] : [{ codigo: undefined, pregunta: '(sin afirmaciones)', tipo: compKey }];
    // compute comp average (single-entry -> average across affirmations for that evaluado)
    const allValsForComp: number[] = [];
    if (normEntries.length === 1) {
      const eResponses = normEntries[0].responses || {};
      compRows.forEach(a => {
        const globalIdx = afirmaciones.findIndex(af => af.codigo === a.codigo);
        const num = resolveNumeric(eResponses, a.codigo, globalIdx);
        if (num !== null) allValsForComp.push(num);
      });
    } else {
      compRows.forEach(a => {
        const globalIdx = afirmaciones.findIndex(af => af.codigo === a.codigo);
        normEntries.forEach(e => {
          const num = resolveNumeric(e.responses || {}, a.codigo, globalIdx);
          if (num !== null) allValsForComp.push(num);
        });
      });
    }
    const compAvg = allValsForComp.length ? +(allValsForComp.reduce((s,v)=>s+v,0)/allValsForComp.length).toFixed(2) : '';

    const color = paletteComp[idx % paletteComp.length];

    const start = rowIdx;
    compRows.forEach((a:any, ai:number) => {
      const globalIdx = afirmaciones.findIndex(af => af.codigo === a.codigo);
      const vals: number[] = [];
      // compute avg per-affirmation (single selected entry -> use that value; otherwise average across entries)
      let avgAff: string | number = '';
      if (normEntries.length === 1) {
        const num = resolveNumeric(normEntries[0].responses || {}, a.codigo, globalIdx);
        avgAff = num !== null ? Number(num) : '';
      } else {
        normEntries.forEach(e => {
          const num = resolveNumeric(e.responses || {}, a.codigo, globalIdx);
          if (num !== null) vals.push(num);
        });
        avgAff = vals.length ? +(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : '';
      }

      const row = sheetComp.getRow(rowIdx);
      // columns: 1 COMP (merged), 2 AFIRMACION, 3 avg aff
      row.getCell(1).value = renderSafe(a.pregunta || '');
      const avgAffCellValue: string | number = avgAff === '' ? '' : Number(avgAff);
      row.getCell(2).value = avgAffCellValue as any;

      // borders
      [1,2].forEach(ci => {
        const c = row.getCell(ci);
        c.border = { top: { style: 'thin', color: { argb: 'FFe5e7eb' } }, left: { style: 'thin', color: { argb: 'FFe5e7eb' } }, bottom: { style: 'thin', color: { argb: 'FFe5e7eb' } }, right: { style: 'thin', color: { argb: 'FFe5e7eb' } } };
      });

      rowIdx++;
    });
    const end = rowIdx - 1;
sheetComp.mergeCells(start,3,end,3);
    const compAvgCell = sheetComp.getCell(start,3);
    const compAvgCellValueDtl: string | number = compAvg !== '' ? Number(compAvg) : '';
    compAvgCell.value = compAvgCellValueDtl as any;
    compAvgCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    compAvgCell.font = { bold: true, size: 14, color: { argb: 'FF3730A3' } };
    compAvgCell.alignment = { vertical: 'middle', horizontal: 'center' };

    sheetComp.mergeCells(start,4,end,4);
    const overallCell = sheetComp.getCell(start,4);
    overallCell.value = '';
    overallCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };

  });

  // ESTILOS
  const estMap: Record<string, any[]> = {};
  (afirmaciones || []).filter(a => {
    if (!a.tipo) return false;
    if (a.categoria === 'estilo') return true;
    if (a.categoria === 'competencia') return false;
    // derive effective estilos list clearly to avoid parser/type issues
    let effective: string[] = [];
    if (Array.isArray(estilosList) && estilosList.length) {
      effective = estilosList.slice();
    } else {
      const tipos = (afirmaciones || []).map(x => x.tipo).filter((t): t is string => typeof t === 'string' && t.trim() !== '');
      if (Array.isArray(competenciasList) && competenciasList.length) {
        effective = Array.from(new Set(tipos.filter(t => !competenciasList.includes(String(t)))));
      } else {
        effective = Array.from(new Set(tipos));
      }
    }
    if (!effective.includes(String(a.tipo))) return false;
    return true;
  }).forEach(a => {
    const tipo = String(a.tipo || '');
    if (!estMap[tipo]) estMap[tipo] = [];
    estMap[tipo].push(a);
  });
  const effectiveEstilos = Object.keys(estMap);

  const estHeaders = ['ESTILO','AFIRMACIÓN / COMPORTAMIENTO','PROMEDIO AFIRMACIÓN','PROMEDIO ESTILO','PROMEDIO ESTILOS'];
  sheetEst.columns = estHeaders.map(h => ({ header: h, key: h, width: h === 'AFIRMACIÓN / COMPORTAMIENTO' ? 80 : 18 }));
  const headerRowEst = sheetEst.getRow(1);
  headerRowEst.font = { bold: true, size: 11 };
  headerRowEst.alignment = { horizontal: 'center', vertical: 'middle' };

  let er = 2;
  Object.keys(estMap).forEach((estKey, idx) => {
    const rowsForEst = estMap[estKey] && estMap[estKey].length ? estMap[estKey] : [{ codigo: undefined, pregunta: '(sin afirmaciones)', tipo: estKey }];
    const allVals: number[] = [];
    if (normEntries.length === 1) {
      const eResponses = normEntries[0].responses || {};
      rowsForEst.forEach(a => {
        const globalIdx = afirmaciones.findIndex(af => af.codigo === a.codigo);
        const num = resolveNumeric(eResponses, a.codigo, globalIdx);
        if (num !== null) allVals.push(num);
      });
    } else {
      rowsForEst.forEach(a => {
        const globalIdx = afirmaciones.findIndex(af => af.codigo === a.codigo);
        normEntries.forEach(e => {
          const num = resolveNumeric(e.responses || {}, a.codigo, globalIdx);
          if (num !== null) allVals.push(num);
        });
      });
    }
    const estAvg = allVals.length ? +(allVals.reduce((s,v)=>s+v,0)/allVals.length).toFixed(2) : '';
    const color = paletteEst[idx % paletteEst.length];
    const start = er;
    rowsForEst.forEach(a => {
      const globalIdx = afirmaciones.findIndex(af => af.codigo === a.codigo);
      let avgAff: any = '';
      if (normEntries.length === 1) {
        const num = resolveNumeric(normEntries[0].responses || {}, a.codigo, globalIdx);
        avgAff = num !== null ? Number(num) : '';
      } else {
        const vals: number[] = [];
        normEntries.forEach(e => {
          const num = resolveNumeric(e.responses || {}, a.codigo, globalIdx);
          if (num !== null) vals.push(num);
        });
        avgAff = vals.length ? +(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : '';
      }
      const row = sheetEst.getRow(er);
      row.getCell(1).value = renderSafe(a.pregunta || '');
      row.getCell(2).value = avgAff;
      er++;
    });
    const end = er - 1;
    sheetEst.mergeCells(start,3,end,3);
    const estAvgCell = sheetEst.getCell(start,3);
    const estAvgCellValueDtl: string | number = estAvg !== '' ? Number(estAvg) : '';
    estAvgCell.value = estAvgCellValueDtl as any;
    estAvgCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    estAvgCell.font = { bold: true, size: 14, color: { argb: 'FF3730A3' } };
    estAvgCell.alignment = { vertical: 'middle', horizontal: 'center' };

    sheetEst.mergeCells(start,4,end,4);
    const estOverall = sheetEst.getCell(start,4);
    estOverall.value = '';
    estOverall.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
  });

  sheetComp.views = [{ state: 'frozen', ySplit: 1 }];
  sheetEst.views = [{ state: 'frozen', ySplit: 1 }];

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Resultados-Detalle-${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
