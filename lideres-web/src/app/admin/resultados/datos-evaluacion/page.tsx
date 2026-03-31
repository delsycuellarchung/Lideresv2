"use client";

import React from 'react';
import { mapLabelToNumeric } from '@/lib/scaleMapper';
import ExcelJS from 'exceljs';

type Afirm = { codigo?: string; pregunta: string; tipo?: string | null; categoria?: string };
type RespEntry = {
  id: string;
  createdAt: string;
  responses?: Record<string, string>;
  token?: string;
  evaluatorName?: string;
  evaluatorCodigo?: string;
  evaluadoNombre?: string;
  evaluadoCodigo?: string;
  // optional display-only enriched fields (in-memory)
  displayEvaluadoCodigo?: string;
  displayEvaluadoNombre?: string;
  displayEvaluatorName?: string;
  displayEvaluatorCodigo?: string;
  // alternative original keys that may appear in records
  evaluado_nombre?: string;
  nombre?: string;
};

export default function DatosEvaluacionPage() {
  const [allResponses, setAllResponses] = React.useState<RespEntry[]>([]);
  const [afirmaciones, setAfirmaciones] = React.useState<Afirm[]>([]);
  const evaluatorsMapRef = React.useRef<Map<string, string>>(new Map());

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    let mounted = true;
    const loadLocalAff = async () => {
          try {
            const fRes = await fetch('/api/formulario');
            if (fRes.ok) {
              const fJson = await fRes.json();
              if (Array.isArray(fJson.afirmaciones) && fJson.afirmaciones.length > 0) {
                setAfirmaciones(fJson.afirmaciones);
                return;
              }
            }
          } catch {}
          // fallback a localStorage
          try {
            const rawA = window.localStorage.getItem('formulario_afirmaciones') || '[]';
            setAfirmaciones(JSON.parse(rawA) || []);
          } catch {
            setAfirmaciones([]);
          }
        };

    const loadResponsesFromServer = async () => {
      try {
        const res = await fetch('/api/admin/form-responses');
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          if (json && Array.isArray(json.data)) {
            // normalize fields for UI (handle multiple naming conventions)
            let normalized = json.data.map((it: any) => ({
              id: it.id,
              token: it.token,
              evaluatorName: (it.evaluator_name ?? it.evaluatorName ?? it.evaluator_name ?? it.evaluator) || it.evaluador || '',
              evaluatorCodigo: it.evaluator_codigo ?? it.evaluatorCodigo ?? it.codigo_evaluador ?? it.codigo_evaluador ?? it.codigo ?? null,
              evaluadoNombre: it.evaluado_nombre ?? it.evaluadoNombre ?? it.evaluado_nombre ?? it.evaluado_name ?? it.evaluado ?? it.nombre ?? null,
              evaluadoCodigo: it.evaluado_codigo ?? it.evaluadoCodigo ?? it.codigo_evaluado ?? it.codigo ?? it.COD_EVALUADO ?? it['Código'] ?? null,
              responses: it.responses ?? it.respuestas ?? {},
              createdAt: it.created_at ?? it.createdAt ?? it.created ?? null,
            }));

            // Attempt to enrich missing evaluadoCodigo and evaluatorCodigo by joining against evaluators table
            try {
              const evRes = await fetch('/api/admin/evaluators');
              if (evRes.ok) {
                const evJson = await evRes.json().catch(() => ({}));
                const evList = Array.isArray(evJson.data) ? evJson.data : (Array.isArray(evJson) ? evJson : []);
                const normalizeName = (s: string) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
                // Build a fast lookup map by normalized evaluated name, and a small array for fuzzy search
                const evalByName = new Map<string, string>();
                const evalNames: Array<{ code: string; nameNorm: string; name: string }> = [];
                evList.forEach((ev: any) => {
                  const rawNombre = String(ev.nombre_evaluado || ev.nombre || ev.nombreEvaluado || '').trim();
                  const codigoEvaluado = ev.codigo_evaluado ?? ev.codigo ?? null;
                  if (!rawNombre || !codigoEvaluado) return;
                  const nameNorm = normalizeName(rawNombre);
                  evalByName.set(nameNorm, String(codigoEvaluado));
                  // also set compact key without spaces to improve lookup from different normalizers
                  try { evalByName.set(nameNorm.replace(/\s+/g, ''), String(codigoEvaluado)); } catch (e) {}
                  evalNames.push({ code: String(codigoEvaluado), nameNorm, name: rawNombre });
                });
                // expose to outer scope so aggregation can reuse the same lookup
                evaluatorsMapRef.current = evalByName;

                const findMatchForName = (nameNorm: string) => {
                  if (!nameNorm) return null;
                  if (evalByName.has(nameNorm)) return evalByName.get(nameNorm) || null;
                  const tokens = nameNorm.split(' ').filter(Boolean);
                  for (const ev of evalNames) {
                    const hasAll = tokens.every(t => ev.nameNorm.includes(t));
                    if (hasAll) return ev.code;
                  }
                  for (const ev of evalNames) {
                    if (tokens.some(t => t.length >= 3 && ev.nameNorm.includes(t))) return ev.code;
                  }
                  return null;
                };

                // do NOT overwrite stored codes; add display fields in-memory only
                normalized = normalized.map((r: any) => {
                  const name = String(r.evaluadoNombre || r.evaluado_nombre || r.nombre || '').trim();
                  const nameNorm = normalizeName(name);
                  const origCode = r.evaluadoCodigo || r.evaluado_codigo || r.codigo_evaluado || null;
                  const maybe = (!origCode || String(origCode).includes('_')) && nameNorm ? findMatchForName(nameNorm) : null;
                  if (maybe) {
                      r.displayEvaluadoCodigo = maybe;
                      r.evaluadoCodigo = maybe;          
                      r.evaluado_codigo = maybe;         
                      const found = evalNames.find((e) => e.code === String(maybe));
                      r.displayEvaluadoNombre = found?.name || r.evaluadoNombre || r.evaluado_nombre || r.nombre || '';
                    }
                  // evaluator name/code similar: prefer providing a display name (not the internal code)
                  const evName = String(r.evaluatorName || r.evaluator_name || '').trim();
                  const evNameNorm = normalizeName(evName);
                  if ((!r.evaluatorCodigo || String(r.evaluatorCodigo).trim() === '') && evNameNorm) {
                    const foundE = evalNames.find(e => e.nameNorm === evNameNorm || e.nameNorm.includes(evNameNorm) || evNameNorm.includes(e.nameNorm));
                    if (foundE) {
                      r.displayEvaluatorName = foundE.name;
                      r.displayEvaluatorCodigo = foundE.code;
                    }
                  }
                  return r;
                });
              }
            } catch (e) {
            }

            // set in-memory responses (do NOT overwrite localStorage here)
            if (mounted) setAllResponses(normalized);
            return;
          }
        }
      } catch (e) {

      }
      try {
        const raw = window.localStorage.getItem('form_responses') || '[]';
        if (mounted) setAllResponses(JSON.parse(raw) || []);
      } catch {
        if (mounted) setAllResponses([]);
      }
    };

    loadLocalAff();
    loadResponsesFromServer();
    const iv = setInterval(() => { try { loadResponsesFromServer(); } catch {} }, 10000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  

  const competenciasAgrupadas = React.useMemo(() => {
    const map: Record<string, Afirm[]> = {};
    for (const a of afirmaciones) {
      if (a.categoria === 'competencia' && a.tipo) {
        if (!map[a.tipo]) map[a.tipo] = [];
        map[a.tipo].push(a);
      }
    }
    return map;
  }, [afirmaciones]);

  const estilosAgrupados = React.useMemo(() => {
    const map: Record<string, Afirm[]> = {};
    for (const a of afirmaciones) {
      if (a.categoria === 'estilo' && a.tipo) {
        if (!map[a.tipo]) map[a.tipo] = [];
        map[a.tipo].push(a);
      }
    }
    return map;
  }, [afirmaciones]);

  const codigosCompetencias = Object.keys(competenciasAgrupadas);
  const codigosEstilos = Object.keys(estilosAgrupados);
  const todasAfirmaciones = React.useMemo(() => afirmaciones.filter(a => a.codigo), [afirmaciones]);

  const normalizeForMap = (s?: string) => String(s || '')
    .trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

  const hasAnswer = (r: RespEntry) => {
    if (!r || !r.responses) return false;
    return Object.values(r.responses).some(v => {
      if (v == null) return false;
      if (typeof v === 'string') return String(v).trim() !== '';
      if (typeof v === 'number') return !isNaN(v);
      return true;
    });
  };

  const visibleResponses = React.useMemo(() => allResponses.filter(hasAnswer), [allResponses]);

  const visibleAfirmaciones = React.useMemo(() => {
    if (todasAfirmaciones && todasAfirmaciones.length > 0) return todasAfirmaciones;
    // derive affirmation codes from visible responses if none provided by formulario
    const codes = new Set<string>();
    for (const r of visibleResponses) {
      if (!r.responses) continue;
      Object.keys(r.responses).forEach(k => {
        if (!k) return;
        codes.add(k);
      });
    }
    // prefer comp-/est- ordering if present; also pad missing indices up to max found
    const compKeys = Array.from(codes).filter(k => /^comp-\d+$/.test(k));
    if (compKeys.length > 0) {
      let max = 0;
      compKeys.forEach(k => { const n = Number(k.split('-')[1] || 0); if (!isNaN(n) && n > max) max = n; });
      const out: { codigo: string; pregunta: string }[] = [];
      for (let i = 0; i <= max; i++) out.push({ codigo: `comp-${i}`, pregunta: `comp-${i}` });
      return out;
    }
    const estKeys = Array.from(codes).filter(k => /^est-\d+$/.test(k));
    if (estKeys.length > 0) {
      let max = 0;
      estKeys.forEach(k => { const n = Number(k.split('-')[1] || 0); if (!isNaN(n) && n > max) max = n; });
      const out: { codigo: string; pregunta: string }[] = [];
      for (let i = 0; i <= max; i++) out.push({ codigo: `est-${i}`, pregunta: `est-${i}` });
      return out;
    }
    return Array.from(codes).map(c => ({ codigo: c, pregunta: c }));
  }, [todasAfirmaciones, visibleResponses]);

  const aggregatedRows = React.useMemo(() => {
    const findValueByKeyLike = (obj: any, checks: string[]) => {
      if (!obj) return undefined;
      for (const c of checks) {
        if (Object.prototype.hasOwnProperty.call(obj, c)) return obj[c];
      }
      return undefined;
    };

    return visibleResponses.map((r) => {
      const rr: any = r as any;
      let code = String(rr.displayEvaluadoCodigo || rr.evaluadoCodigo || rr.evaluado_codigo || '').trim();
      const name = String(rr.displayEvaluadoNombre || rr.evaluadoNombre || rr.evaluado_nombre || rr.nombre || '').trim();
      const fecha = String(rr.createdAt || '');
      const evName = String(rr.displayEvaluatorName || rr.evaluatorName || rr.evaluator_name || '').trim();

      if (!code && name) {
        const nm = normalizeForMap(name);
        const m = evaluatorsMapRef.current;
        code = m.get(nm) || m.get(nm.replace(/\s+/g, '')) || '';
      }

      const respObj = rr.responses || {};
      console.log('EVALUADO:', rr.evaluadoNombre, '| CLAVES:', Object.keys(respObj));
      const avgByCode: Record<string, number | null> = {};
      const allValues: number[] = [];

      Object.keys(respObj).forEach((k) => {
        const raw = respObj[k];
        const n = mapLabelToNumeric(raw);
        if (typeof n === 'number' && !isNaN(n)) {
          allValues.push(n);
          avgByCode[k] = n;
          avgByCode[k.toUpperCase()] = n;
          avgByCode[k.toLowerCase()] = n;
        }
      });

      const avg = allValues.length ? +(allValues.reduce((s, v) => s + v, 0) / allValues.length).toFixed(2) : null;

      return {
        codigo: code || '-',
        nombre: name || '-',
        evaluador: evName || '-',
        fecha: fecha ? new Date(fecha).toLocaleDateString() : '-',
        promedio: avg ?? '-',
        avgByCode,
      };
    });
  }, [visibleResponses, visibleAfirmaciones]);

  const exportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Datos Evaluacion');

      const codeHeaders = visibleAfirmaciones.map(a => a.codigo || a.pregunta);

      // Build all rows in memory first
      const visibleResponsesLocal = allResponses.filter(hasAnswer);
      // compute evaluador counts per evaluado to allow filtering (only include evaluateds with >3 evaluadores)
      const evaluadoresByEvaluado: Record<string, Set<string>> = {};
      visibleResponsesLocal.forEach(r => {
        const rr: any = r as any;
        const code = String(rr.displayEvaluadoCodigo || rr.evaluadoCodigo || rr.evaluado_codigo || rr.evaluado || rr.token || '');
        if (!evaluadoresByEvaluado[code]) evaluadoresByEvaluado[code] = new Set<string>();
        if (rr.displayEvaluatorName) evaluadoresByEvaluado[code].add(String(rr.displayEvaluatorName).trim());
        else if (rr.evaluatorName) evaluadoresByEvaluado[code].add(String(rr.evaluatorName).trim());
      });

      // decide filtering using displayEvaluadoCodigo when available
      const filteredResponses = visibleResponsesLocal.filter(r => {
        const rr: any = r as any;
        const code = String(rr.displayEvaluadoCodigo || rr.evaluadoCodigo || rr.evaluado_codigo || rr.evaluado || rr.token || '');
        const count = evaluadoresByEvaluado[code] ? evaluadoresByEvaluado[code].size : 0;
        return count > 3; // solo descarga evaluados con más de 3 evaluadores
      });

      const dataRows = filteredResponses.map(r => {
        const base: any[] = [];
        const rr: any = r as any;
        base[0] = rr.displayEvaluadoCodigo || rr.evaluadoCodigo || rr.evaluado_codigo || rr.token || '-';
        base[1] = rr.displayEvaluadoNombre || rr.evaluadoNombre || rr.evaluado_nombre || rr.nombre || '-';
      base[2] = rr.displayEvaluatorName || rr.displayEvaluatorCodigo || rr.evaluatorName || '-';
        base[3] = rr.createdAt ? new Date(rr.createdAt).toLocaleString() : '-';

        const vals = codeHeaders.map((code, idx) => {
          // try by code, then fallback to comp-<idx> or est-<idx>
          let raw: any = '';
          try {
            raw = rr.responses?.[code];
            if (raw === undefined || raw === null || raw === '') {
              raw = rr.responses?.[`comp-${idx}`];
            }
            if (raw === undefined || raw === null || raw === '') {
              raw = rr.responses?.[`est-${idx}`];
            }
            if (raw === undefined || raw === null) raw = '';
          } catch (e) { raw = ''; }
          const numeric = raw !== '' ? mapLabelToNumeric(String(raw)) : null;
          return numeric !== null ? numeric : (raw || '-');
        });
        return base.concat(vals);
      });
      const columns: any[] = [
        { header: 'CÓDIGO', key: 'codigo', width: 10 },
        { header: 'EVALUADO', key: 'evaluado', width: 28 },
        { header: 'EVALUADOR', key: 'evaluador', width: 24 },
        { header: 'FECHA', key: 'fecha', width: 18 },
      ];
      // Always include all code headers so values per person are visible in the sheet
      codeHeaders.forEach((ch) => columns.push({ header: ch, key: ch, width: 12 }));

      worksheet.columns = columns;

      // Header styling
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, size: 11 };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      headerRow.height = 26;

      // Add rows including all code columns
      dataRows.forEach(dr => {
        const base = [dr[0], dr[1], dr[2], dr[3]];
        const rest = codeHeaders.map((_, i) => dr[4 + i]);
        const row = worksheet.addRow(base.concat(rest));
        row.eachCell((cell, colNumber) => {
          const valueIndex = colNumber - 5; // index into rest (0-based)
          const cellValue = colNumber >= 5 ? dr[4 + valueIndex] : null;
          const isLow = typeof cellValue === 'number' && cellValue < 3;
          cell.alignment = { horizontal: colNumber >= 5 ? 'center' : 'left', vertical: 'middle' };
          if (isLow) {
            cell.font = { size: 10, color: { argb: 'FFFFFFFF' }, bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
          } else {
            cell.font = { size: 10, color: { argb: 'FF0F172A' } };
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          };
          // ensure empty-like values are represented as '-'
          if (cell.value === null || cell.value === undefined || (typeof cell.value === 'string' && cell.value.trim() === '')) {
            cell.value = '-';
            cell.font = { size: 10, color: { argb: 'FF0F172A' } };
          }
        });
        row.height = 18;
      });

      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `datos_evaluacion.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error exporting XLSX', e);
      alert('Error al exportar Excel');
    }
  };

  return (
    <section style={{ padding: '12px 24px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: '-140px 0 0 0', fontSize: 28, fontWeight: 800 }}>DATOS EVALUACION</h1>
        </div>
        <div style={{ marginTop: 0, marginLeft: 12, display: 'flex', gap: 8 }}>
          <button onClick={exportExcel} style={{ padding: '8px 12px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', fontWeight: 700 }}>Exportar Excel</button>
        </div>
      </div>
      <div style={{ marginTop: 30, marginLeft: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#2f2f2f' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #dcdcdc', color: '#555', fontWeight: 600 }}>
              <th style={{ padding: '12px 14px', width: 140, minWidth: 120, textAlign: 'left' }}>Código</th>
              <th style={{ padding: '12px 14px', width: 340, minWidth: 240, textAlign: 'left' }}>Evaluado</th>
              <th style={{ padding: '12px 14px', width: 220, minWidth: 160, textAlign: 'left' }}>Evaluador</th>
              <th style={{ padding: '12px 14px', width: 140 }}>Fecha</th>
              
              {visibleAfirmaciones.map((a: Afirm, i: number) => {
                const rawLabel = a.codigo ? String(a.codigo) : `P${i + 1}`;
                const label = rawLabel; // show full code (keep numbers) so columns are unique
                return <th key={rawLabel} title={a.pregunta} style={{ padding: '8px 10px', minWidth: 90, textAlign: 'center', whiteSpace: 'normal' }}>{label}</th>;
                    })}
              <th style={{ padding: '12px 14px', width: 120, textAlign: 'center' }}>Promedio</th>
            </tr>
          </thead>
          <tbody>
            {aggregatedRows.length === 0 ? (
              <tr>
                <td colSpan={5 + todasAfirmaciones.length} style={{ padding: 20, textAlign: 'center', color: '#666' }}>No hay respuestas registradas aún.</td>
              </tr>
            ) : (
              aggregatedRows.map((row, idx) => (
                <tr key={row.codigo || idx} style={{ borderBottom: '1px solid #ededed' }}>
                  <td style={{ padding: '12px 14px', width: 140, minWidth: 120 }}>
                    {(() => {
                      const raw = String(row.codigo || '');
                      // if code looks like a slug (contains underscore) try map lookup by name
                      if (raw && raw.indexOf('_') >= 0 && row.nombre) {
                        try {
                          const nm = normalizeForMap(row.nombre);
                          const compact = nm.replace(/\s+/g, '');
                          const m = evaluatorsMapRef.current;
                          const found = m.get(nm) || m.get(compact) || null;
                          if (found) return String(found);
                        } catch (e) {}
                      }
                      return raw || '-';
                    })()}
                  </td>
                  <td style={{ padding: '12px 14px', width: 340, minWidth: 240 }}>{row.nombre || ''}</td>
                  <td style={{ padding: '12px 14px', width: 220, minWidth: 160 }}>{row.evaluador || '-'}</td>
                  <td style={{ padding: '12px 14px', width: 140 }}>{row.fecha || ''}</td>
                  
                  {visibleAfirmaciones.map((a: Afirm, i: number) => {
                    const compIdx = afirmaciones.filter(x => x.categoria === 'competencia' && x.codigo).indexOf(a);
                    const estIdx = afirmaciones.filter(x => x.categoria === 'estilo' && x.codigo).indexOf(a);
                    const fallbackKey = a.categoria === 'estilo' ? `est-${estIdx}` : `comp-${compIdx}`;
                    const val = (row as any).avgByCode?.[a.codigo || ''] ?? (row as any).avgByCode?.[fallbackKey] ?? null;
                    const isLow = typeof val === 'number' && val < 3;
                    return (
                      <td key={String(a.codigo || i)} style={{ padding: '8px 10px', minWidth: 90, textAlign: 'center' }}>
                        {val !== null ? (
                          <span style={{ background: isLow ? '#fee2e2' : '#eef2ff', color: isLow ? '#dc2626' : '#0b5394', padding: '4px 8px', borderRadius: 6, fontWeight: 600 }}>
                            {val}
                          </span>
                        ) : '-'}
                      </td>
                    );
                  })}
                  <td style={{ padding: '8px 10px', minWidth: 90, textAlign: 'center', fontWeight: 700, borderLeft: '2px solid #e2e8f0' }}>
                    {row.promedio !== '-' ? (
                      <span style={{ background: typeof row.promedio === 'number' && row.promedio < 3 ? '#fee2e2' : '#eef2ff', color: typeof row.promedio === 'number' && row.promedio < 3 ? '#dc2626' : '#0b5394', padding: '4px 8px', borderRadius: 6, fontWeight: 600 }}>
                        {row.promedio}
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const thNormal: React.CSSProperties = {
  padding: '14px 18px',
  textAlign: 'left'
};

const thSmall: React.CSSProperties = {
  padding: '14px 10px',
  textAlign: 'left',
  width: 70
};

const thCenter: React.CSSProperties = {
  padding: '14px 10px',
  textAlign: 'center'
};

const tdNormal: React.CSSProperties = {
  padding: '16px 18px'
};

const tdSmall: React.CSSProperties = {
  padding: '16px 10px',
  width: 70
};

const tdCenter: React.CSSProperties = {
  padding: '16px 10px',
  textAlign: 'center'
};