"use client";
import React from "react";
import { mapLabelToNumeric } from '@/lib/scaleMapper';
import { exportToExcel } from '@/lib/excelExporter';
export default function ResultadosFinalesPage() {
  const [datos, setDatos] = React.useState<any[]>([]);
  const [estilosCols, setEstilosCols] = React.useState<string[]>([]);
  const formatLabel = (s: string) => {
    if (!s) return s;
    const str = String(s);
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

      React.useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem('form_responses') || '[]';
      const allResponses = JSON.parse(raw) || [];
      const rawA = window.localStorage.getItem('formulario_afirmaciones') || '[]';
      const afirmaciones = JSON.parse(rawA) || [];
      const rawEst = window.localStorage.getItem('formulario_estilos') || '[]';
      const estilosRaw = JSON.parse(rawEst) || [];
      const estilosArr: string[] = Array.isArray(estilosRaw) ? estilosRaw.map((s: any) => (typeof s === 'string' ? s : (s && s.nombre ? String(s.nombre) : String(s)))) : [];
      const affByCode: Record<string, any> = {};
      afirmaciones.forEach((a: any) => { if (a.codigo) affByCode[String(a.codigo)] = a; });

      const classify = (a: any) => {
        const txt = ((a.tipo || '') + ' ' + (a.pregunta || '')).toLowerCase();
        if (/comunic|direcci/i.test(txt)) return 'comunicacion';
        if (/respeto|confian/i.test(txt)) return 'respeto';
        if (/desarroll|equipo|empower/i.test(txt)) return 'desarrollo';
        if (/adapt|resil/i.test(txt)) return 'adaptabilidad';
        if (/motiv|influ/i.test(txt)) return 'motivacion';
        return null;
      };
      const codesByGroup: Record<string, string[]> = { comunicacion: [], respeto: [], desarrollo: [], adaptabilidad: [], motivacion: [] };
      Object.values(affByCode).forEach((a: any) => {
        const g = classify(a);
        if (g) codesByGroup[g].push(String(a.codigo));
      });

      // Build estilos -> codes map using afirmaciones that have categoria 'estilo' or tipo matching estilo label
      const estilosByLabel: Record<string, string[]> = {};
      estilosArr.forEach((label: string) => { estilosByLabel[label] = []; });
      Object.values(affByCode).forEach((a: any) => {
        const tipo = a.tipo ? String(a.tipo) : '';
        const categoria = a.categoria ? String(a.categoria) : '';
        // if explicit estilo category, try map by tipo or label
        if (categoria === 'estilo') {
          // prefer mapping by tipo if it matches a label
          if (tipo && estilosArr.includes(tipo)) estilosByLabel[tipo].push(String(a.codigo));
          else {
            // try to find label contained in pregunta
            for (const label of estilosArr) {
              if (String(a.pregunta || '').toLowerCase().includes(String(label).toLowerCase())) {
                estilosByLabel[label].push(String(a.codigo));
                break;
              }
            }
          }
        } else {
          // if no explicit category, map by tipo matching
          if (tipo && estilosArr.includes(tipo)) estilosByLabel[tipo].push(String(a.codigo));
        }
      });

      const byEvaluado: Record<string, any> = {};
      allResponses.forEach((r: any) => {
        const code = String(r.evaluadoCodigo || r.token || '');
        if (!byEvaluado[code]) byEvaluado[code] = { codigo: code, nombre: r.evaluadoNombre || '', fecha: r.createdAt || '', evaluadoresSet: new Set<string>(), values: [] };
        byEvaluado[code].evaluadoresSet.add(String(r.evaluatorName || '').trim());
        Object.keys(r.responses || {}).forEach(k => {
          const rawVal = r.responses[k];
          const num = mapLabelToNumeric(rawVal);
          if (typeof num === 'number' && !isNaN(num)) byEvaluado[code].values.push(num);
        });
      });
      const rows = Object.values(byEvaluado).map((item: any) => {
        const code = item.codigo;
        const entries = allResponses.filter((r: any) => String(r.evaluadoCodigo || r.token) === code);
        const evaluadores = item.evaluadoresSet.size;

        const computeGroupAvg = (groupCodes: string[]) => {
          // Follow spreadsheet logic: only compute group averages when there are at least 3 evaluadores
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

        // compute estilo averages per estilosArr
        const estiloAverages: Record<string, number | null> = {};
        estilosArr.forEach(label => {
          const codes = estilosByLabel[label] || [];
          if (!codes.length) { estiloAverages[label] = null; return; }
          // same rule: need at least 3 evaluadores
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
  }, []);

  const handleExport = async () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('form_responses') || '[]';
      const entries = JSON.parse(raw) || [];
      const rawEst = window.localStorage.getItem('formulario_estilos') || '[]';
      const estilosRaw = JSON.parse(rawEst) || [];
      const estilos = estilosRaw.map((s: any) => (typeof s === 'string' ? { pregunta: s } : { pregunta: s.pregunta || String(s) }));
      const rawI = window.localStorage.getItem('formulario_instrucciones') || '[]';
      const instruccionesRaw = JSON.parse(rawI) || [];
      const instrucciones = instruccionesRaw.map((it: any) => (it && it.etiqueta) ? it.etiqueta : String(it));
      await exportToExcel(entries, estilos, instrucciones);
    } catch (e) {
      console.error('Error exporting to Excel', e);
      alert('Error al generar el Excel. Revisa la consola.');
    }
  };

  // Seed function removed to avoid writing fake test data

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
    <section style={{ padding: '6px 24px 20px 24px' }}>
      <h1 style={{ margin: '0 0 0 12px', fontSize: 32, fontWeight: 800, transform: 'translateY(-70px)' }}>Resultados finales</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-press icon-btn" onClick={handleExport} style={{ padding: '8px 12px', fontSize: 14 }}>
            <img src="/images/descargar.png" alt="Exportar" style={{ width: 18, height: 18, marginRight: 8 }} />Exportar
          </button>
        </div>
      </div>
      <div style={{ background: '#fff', padding: 8, borderRadius: 8, border: '1px solid rgba(15,23,42,0.04)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', minWidth: 0, whiteSpace: 'normal', tableLayout: 'auto' }}>
          <thead>
            <tr>
              <th style={{ padding: '12px 14px', fontSize: 14, fontWeight: 400, color: '#0F172A', background: '#f3f4f6', position: 'sticky', top: 0, zIndex: 2, textAlign: 'center' }}>Cod</th>
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
                <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>{row.codigo}</td>
                <td title={String(row.nombre)} style={{ padding: '10px 12px', color: '#111827', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 560 }}>{row.nombre}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>{row.fecha}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ background: row.evaluadores <= 2 ? '#fee2e2' : '#eef2ff', color: row.evaluadores <= 2 ? '#dc2626' : '#0b5394', padding: '6px 8px', borderRadius: 8 }}>{row.evaluadores}</span></td>
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
              <th style={styles.th}>Cod</th>
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
                <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>{row.codigo}</td>
                <td style={styles.nameTd} title={String(row.nombre)}>{row.nombre}</td>
                <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>{row.fecha}</td>
                <td style={styles.td}><span style={{ ...styles.badge, background: row.evaluadores <= 2 ? '#fee2e2' : '#eef2ff', color: row.evaluadores <= 2 ? '#dc2626' : '#0b5394' }}>{row.evaluadores}</span></td>
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
