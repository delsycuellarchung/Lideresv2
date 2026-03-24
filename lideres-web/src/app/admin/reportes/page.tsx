"use client";
import React from "react";
import dynamic from 'next/dynamic';
import { mapLabelToNumeric } from '@/lib/scaleMapper';
// note: jsPDF is imported dynamically inside the handler to avoid build-time errors
import * as XLSX from 'xlsx';


const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false }) as any;

export default function ReportesPage() {
  const reportRef = React.useRef<HTMLElement | null>(null);
  const [datos, setDatos] = React.useState<any[]>([]);
  const [estilosLabels, setEstilosLabels] = React.useState<string[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [matches, setMatches] = React.useState<Array<{codigo:string,nombre:string}>>([]);
  const [selectedCodigo, setSelectedCodigo] = React.useState<string | null>(null);

  React.useEffect(() => {
    console.debug('[REPORTES] datos length', datos.length, 'selectedCodigo', selectedCodigo, 'matches', matches.length);
    if (selectedCodigo) {
      const found = datos.find(d => String(d.codigo) === String(selectedCodigo));
      console.debug('[REPORTES] selected row', found);
    } else if (datos.length) {
      console.debug('[REPORTES] sample rows', datos.slice(0, 3));
    }
  }, [datos, selectedCodigo, matches]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    (async () => { try {
      const [frRes, fRes] = await Promise.all([
        fetch('/api/admin/form-responses'),
        fetch('/api/formulario')
      ]);
      const frJson = await frRes.json();
      const fJson = await fRes.json();
      const allResponses = Array.isArray(frJson.data) ? frJson.data.map((it: any) => ({
        evaluadoCodigo: it.evaluado_codigo || it.evaluadoCodigo || it.token || '',
        evaluadoNombre: it.evaluado_nombre || it.evaluadoNombre || '',
        evaluatorName: it.evaluator_name || it.evaluatorName || '',
        createdAt: it.created_at || it.createdAt || '',
        responses: it.responses || {},
        token: it.token || ''
      })) : [];
      const afirmaciones = Array.isArray(fJson.afirmaciones) ? fJson.afirmaciones : [];
      const affByCode: Record<string, any> = {};
      afirmaciones.forEach((a: any) => { if (a.codigo) affByCode[String(a.codigo)] = a; });

      const classify = (a: any) => {
        const txt = ((a.tipo || '') + ' ' + (a.pregunta || '')).toLowerCase();
        if (/comunic|direcci/i.test(txt)) return 'comunicacion';
        if (/respeto|confian/i.test(txt)) return 'respeto';
        if (/desarroll|equipo|empower/i.test(txt)) return 'desarrollo';
        if (/adapt|resil/i.test(txt)) return 'adaptabilidad';
        if (/motiv|influenc/i.test(txt)) return 'motivacion';
        return null;
      };
      const codesByGroup: Record<string, string[]> = { comunicacion: [], respeto: [], desarrollo: [], adaptabilidad: [], motivacion: [] };
      const estilosByTipo: Record<string, string[]> = {};
      Object.values(affByCode).forEach((a: any) => {
        const g = classify(a);
        if (g) codesByGroup[g].push(String(a.codigo));
        // collect estilos by tipo when afirmacion explicitly marked as estilo or tipo suggests estilo
        const isEstilo = a.categoria === 'estilo';
        if (isEstilo) {
          const tipoKey = String(a.tipo || a.codigo || 'est').trim() || 'est';
          estilosByTipo[tipoKey] = estilosByTipo[tipoKey] || [];
          estilosByTipo[tipoKey].push(String(a.codigo));
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
          const vals: number[] = [];

          entries.forEach((r: any) => {
            groupCodes.forEach((c: string) => {
              let raw = r.responses?.[c];

              if (raw === undefined || raw === null) {
                const globalIdx = afirmaciones.findIndex((af: any) => af.codigo === c);
                if (globalIdx >= 0) {
                  raw = r.responses?.[`comp-${globalIdx}`];
                }
              }

              const num = mapLabelToNumeric(raw);
              if (typeof num === 'number' && !isNaN(num)) vals.push(num);
            });
          });

          return vals.length
            ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2)
            : null;
        };

        const comunicacion = computeGroupAvg(codesByGroup.comunicacion);
        const respeto = computeGroupAvg(codesByGroup.respeto);
        const desarrollo = computeGroupAvg(codesByGroup.desarrollo);
        const adaptabilidad = computeGroupAvg(codesByGroup.adaptabilidad);
        const motivacion = computeGroupAvg(codesByGroup.motivacion);

        const estilosMap: Record<string, number | null> = {};
        Object.keys(estilosByTipo).forEach(tk => {
          estilosMap[tk] = (() => {
            const vals: number[] = [];

            entries.forEach((r: any) => {
              estilosByTipo[tk].forEach((c: string) => {
                let raw = r.responses?.[c];

                if (raw === undefined || raw === null) {
                  const globalIdx = afirmaciones.findIndex((af: any) => String(af.codigo) === String(c));
                  if (globalIdx >= 0) {
                    raw = r.responses?.[`comp-${globalIdx}`];
                  }
                }

                const num = mapLabelToNumeric(raw);
                if (typeof num === 'number' && !isNaN(num)) vals.push(num);
              });
            });

            return vals.length
              ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2)
              : null;
          })();
        });

        const overall = (evaluadores >= 3 && Array.isArray(item.values) && item.values.length)
          ? +(item.values.reduce((s: number, v: number) => s + v, 0) / item.values.length).toFixed(2)
          : null;

        return {
          codigo: code,
          nombre: item.nombre,
          fecha: item.fecha ? new Date(item.fecha).toLocaleDateString() : '',
          evaluadores,
          comunicacion: comunicacion ?? null,
          respeto: respeto ?? null,
          desarrollo: desarrollo ?? null,
          adaptabilidad: adaptabilidad ?? null,
          motivacion: motivacion ?? null,
          estilos: estilosMap,
          promedio: overall ?? null
        };
      });


      let estilosLabelsArr = Object.keys(estilosByTipo || {});
      if (!estilosLabelsArr || estilosLabelsArr.length === 0) {
        const union = new Set<string>();
        rows.forEach((r: any) => {
          const e = r.estilos || {};
          Object.keys(e).forEach(k => { if (k) union.add(String(k)); });
        });
        estilosLabelsArr = Array.from(union);
      }
        setEstilosLabels(estilosLabelsArr);
        setDatos(rows);

            } catch (e) {
              console.warn('Error building report data', e);
              setDatos([]);
            } })();
          }, []);

  const masYMenos = React.useMemo(() => {
    const source = selectedCodigo
  ? datos.filter(d => String(d.codigo) === String(selectedCodigo))
  : [];
    if (!source.length) return null;
    const d = source[0];
    const comps = [
      { label: 'Comunicación y dirección', val: d.comunicacion },
      { label: 'Respeto y confianza', val: d.respeto },
      { label: 'Desarrollo de equipo', val: d.desarrollo },
      { label: 'Adaptabilidad y resiliencia', val: d.adaptabilidad },
      { label: 'Motivación e influencia', val: d.motivacion },
    ].filter(c => c.val !== null && c.val !== undefined) as { label: string; val: number }[];
    const estilosArr = Object.entries(d.estilos || {})
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => ({ label: k, val: v as number }));
    if (!comps.length && !estilosArr.length) return null;
    const maxComp = comps.length ? comps.reduce((a, b) => a.val > b.val ? a : b) : null;
    const minComp = comps.length ? comps.reduce((a, b) => a.val < b.val ? a : b) : null;
    const maxEst = estilosArr.length ? estilosArr.reduce((a, b) => a.val > b.val ? a : b) : null;
    const minEst = estilosArr.length ? estilosArr.reduce((a, b) => a.val < b.val ? a : b) : null;
    return { maxComp, minComp, maxEst, minEst };
  }, [datos, selectedCodigo]);

  const findMatches = (term: string) => {
    const t = (term || '').trim().toLowerCase();
    if (!t) return [];
    return datos
      .filter(d => 
        String(d.nombre || '').toLowerCase().includes(t) || 
        String(d.codigo || '').toLowerCase().includes(t)
      )
      .slice(0, 20)
      .map(d => ({ codigo: d.codigo, nombre: d.nombre || d.codigo }));
  };

  const barOptions = React.useMemo(() => {
    const categories = datos.map(d => d.nombre || d.codigo || '—');
    const series = [
      { name: 'Comunicación', data: datos.map(d => typeof d.comunicacion === 'number' ? d.comunicacion : null) },
      { name: 'Respeto', data: datos.map(d => typeof d.respeto === 'number' ? d.respeto : null) },
      { name: 'Desarrollo', data: datos.map(d => typeof d.desarrollo === 'number' ? d.desarrollo : null) },
      { name: 'Adaptabilidad', data: datos.map(d => typeof d.adaptabilidad === 'number' ? d.adaptabilidad : null) },
      { name: 'Motivación', data: datos.map(d => typeof d.motivacion === 'number' ? d.motivacion : null) }
    ];
    return {
      series,
      options: {
        chart: { type: 'bar', height: 360, toolbar: { show: true } },
        plotOptions: { bar: { horizontal: false, columnWidth: '55%' } },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: { categories },
        yaxis: { min: 0, max: 5, title: { text: 'Promedio' }, labels: { show: false } },
        tooltip: { y: { formatter: (v:any) => v === null ? '—' : v.toFixed(2) } },
        legend: { position: 'top' },
        fill: { opacity: 0.95 },
        colors: ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'],
        grid: { borderColor: '#eef2ff' },
        responsive: [{ breakpoint: 800, options: { plotOptions: { bar: { columnWidth: '70%' } }, legend: { position: 'bottom' } } }]
      }
    };
  }, [datos, selectedCodigo]);

  const radarEstilosOptions = React.useMemo(() => {
    let labels = estilosLabels && estilosLabels.length ? estilosLabels.slice() : [];
    let source: any[] = [];
    if (selectedCodigo) {
      const sel = String(selectedCodigo).trim().toLowerCase();
      source = datos.filter(d => {
        const k = String(d.codigo || d.token || d.nombre || '').trim().toLowerCase();
        return k === sel;
      });
      if (!source.length) {
        // fallback: contains match on codigo or nombre
        source = datos.filter(d => {
          const k = String(d.codigo || d.token || d.nombre || '').trim().toLowerCase();
          return k.includes(sel) || (String(d.nombre || '').toLowerCase().includes(sel));
        });
      }
    } else source = datos;

    // If no explicit estilosLabels, try to infer labels from the first available row's estilos keys
    if ((!labels || labels.length === 0) && source.length) {
      const first = source[0];
      const keys = first && first.estilos ? Object.keys(first.estilos).filter(k => k) : [];
      if (keys.length) labels = keys;
    }

    const series = labels.length ? source.map(d => ({ name: d.nombre || d.codigo, data: labels.map(l => (d.estilos && typeof d.estilos[l] === 'number') ? d.estilos[l] : 0) })) : [];
    const displayLabels = labels.map((l: any) => String(l).toLowerCase());
    return {
      series,
      options: {
        chart: { type: 'radar', height: 640, toolbar: { show: true }, foreColor: '#000000' },
        plotOptions: { radar: { polygons: { strokeColors: '#374151', connectorColors: '#374151', fill: { colors: ['transparent'] }, opacity: 1 } } },
        grid: { show: false },
        xaxis: { categories: displayLabels, labels: { style: { fontSize: '13px', fontFamily: 'inherit', fontWeight: '400', colors: displayLabels.map(() => '#000000') } } },
        yaxis: { show: false, min: 0, max: 5, tickAmount: 0, labels: { show: false } },
        stroke: { width: 5, curve: 'smooth' },
        markers: { size: 8 },
        fill: { opacity: 0.9 },
        colors: ['#4F46E5', '#06B6D4', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6'],
        legend: { position: 'bottom', horizontalAlign: 'center', labels: { colors: '#000000' }, fontSize: '16px' },
        tooltip: { y: { formatter: (v:any) => v === null ? '—' : v.toFixed(2) } }
      }
    };
  }, [datos, selectedCodigo]);

  // placeholder series/options when no data available so the chart area isn't blank
  const placeholderRadarOptions = React.useMemo(() => {
    const labels = ['Comunicación', 'Respeto', 'Desarrollo', 'Adaptabilidad', 'Motivación'];
    const displayLabels = labels.map(l => String(l).toLowerCase());
    return {
      series: [{ name: 'Sin datos', data: [0, 0, 0, 0, 0] }],
      options: {
        chart: { type: 'radar', height: 640, toolbar: { show: true }, foreColor: '#000000' },
        plotOptions: { radar: { polygons: { strokeColors: '#e5e7eb', connectorColors: '#e5e7eb', fill: { colors: ['transparent'] }, opacity: 1 } } },
        grid: { show: false },
        xaxis: { categories: displayLabels, labels: { style: { fontSize: '13px', fontFamily: 'inherit', fontWeight: '400', colors: displayLabels.map(() => '#9ca3af') } } },
        yaxis: { show: false, min: 0, max: 5, tickAmount: 0, labels: { show: false } },
        stroke: { width: 3, curve: 'smooth' },
        markers: { size: 6 },
        fill: { opacity: 0.45 },
        colors: ['#7C3AED'],
        legend: { show: false },
        tooltip: { enabled: false }
      }
    };
  }, []);

  const handleDownloadPdf = async () => {
    try {
      if (!reportRef.current) return;
      const el = reportRef.current;
      // dynamic import to avoid build-time module resolution errors
      const html2canvasMod = await import('html2canvas').catch(() => null);
      if (!html2canvasMod) {
        alert('La librería html2canvas no está disponible en este entorno. Instálala con `npm install html2canvas`.');
        return;
      }
      const html2canvas = html2canvasMod.default || html2canvasMod;
      const canvas = await html2canvas(el, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      // dynamic import jspdf to avoid build errors when not installed
      const jspdfMod = await import('jspdf').catch(() => null);
      if (!jspdfMod) {
        alert('La librería jspdf no está disponible. Instálala con `npm install jspdf` para habilitar la descarga como PDF.');
        return;
      }
      const jsPDFClass = jspdfMod.jsPDF || jspdfMod.default || jspdfMod;
      const pdf = new jsPDFClass('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const fileName = `reporte-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.pdf`;
      pdf.save(fileName);
    } catch (e) {
      console.error('Error generando PDF', e);
      alert('Error al generar PDF. Revisa la consola.');
    }
  };

  const handlePrintPdfFallback = () => {
    if (!reportRef.current) {
      alert('No hay contenido del reporte para imprimir.');
      return;
    }
    const html = reportRef.current.innerHTML;
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) {
      alert('No se pudo abrir una nueva ventana para imprimir. Revisa tu bloqueador de ventanas emergentes.');
      return;
    }
    const doc = w.document;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Reporte</title><style>body{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding:20px; color:#111} table{font-size:12px}</style></head><body>${html}</body></html>`);
    doc.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch (e) { console.warn('print failed', e); } }, 500);
  };

  

  const heatmapOptions = React.useMemo(() => {
    const evaluados = datos.map(d => d.nombre || d.codigo || '—');
    const comps = [
      { key: 'comunicacion', label: 'Comunicación' },
      { key: 'respeto', label: 'Respeto' },
      { key: 'desarrollo', label: 'Desarrollo' },
      { key: 'adaptabilidad', label: 'Adaptabilidad' },
      { key: 'motivacion', label: 'Motivación' }
    ];
    const series = comps.map(c => ({
      name: c.label,
      data: evaluados.map((name, idx) => ({ x: name, y: (typeof datos[idx]?.[c.key] === 'number' ? datos[idx][c.key] : 0) }))
    }));

    return {
      series,
      options: {
        chart: { type: 'heatmap', height: 320 },
        dataLabels: { enabled: false },
        plotOptions: {
          heatmap: {
            shadeIntensity: 0.5,
            colorScale: {
              ranges: [
                { from: 0, to: 1.9, color: '#fee2e2', name: 'Bajo' },
                { from: 2, to: 3.4, color: '#fef3c7', name: 'Medio' },
                { from: 3.5, to: 5, color: '#d1fae5', name: 'Alto' }
              ]
            }
          }
        },
        
        xaxis: { type: 'category' }
      }
    };
  }, [datos, selectedCodigo]);

const radarOptions = React.useMemo(() => {
    const labels = ['Comunicación', 'Respeto', 'Desarrollo', 'Adaptabilidad', 'Motivación'];
    const displayLabels = labels.map(l => String(l).toLowerCase());

    let source: any[] = [];
    if (selectedCodigo) {
      const sel = String(selectedCodigo).trim().toLowerCase();
      source = datos.filter(d => {
        const k = String(d.codigo || d.token || d.nombre || '').trim().toLowerCase();
        return k === sel;
      });
    }

    const d = source.length ? source[0] : null;
    const series = d ? [{
      name: d.nombre || d.codigo,
      data: [
        d.comunicacion ?? 0,
        d.respeto ?? 0,
        d.desarrollo ?? 0,
        d.adaptabilidad ?? 0,
        d.motivacion ?? 0
      ]
    }] : [];

    return {
      series,
      options: {
        chart: { type: 'radar', height: 640, toolbar: { show: true }, foreColor: '#000000' },
        plotOptions: { radar: { polygons: { strokeColors: '#374151', connectorColors: '#374151', fill: { colors: ['transparent'] }, opacity: 1 } } },
        grid: { show: false },
        xaxis: { categories: displayLabels, labels: { style: { fontSize: '13px', fontFamily: 'inherit', fontWeight: '400', colors: displayLabels.map(() => '#000000') } } },
        yaxis: { show: false, min: 0, max: 5, tickAmount: 0, labels: { show: false } },
        stroke: { width: 5, curve: 'smooth' },
        markers: { size: 8 },
        fill: { opacity: 0.9 },
        colors: ['#4F46E5'],
        legend: { show: false },
        tooltip: { y: { formatter: (v:any) => v === null ? '—' : v.toFixed(2) } }
      }
    };
  }, [datos, selectedCodigo]);

  return (
    <section ref={reportRef} style={{ padding: 24 }}>
      <style>{`
        .apexcharts .apexcharts-yaxis, 
        .apexcharts .apexcharts-yaxis-label, 
        .apexcharts .apexcharts-yaxis-text, 
        .apexcharts .apexcharts-yaxis text, 
        .apexcharts .apexcharts-yaxis-label tspan, 
        .apexcharts .apexcharts-yaxis .apexcharts-text, 
        .apexcharts .apexcharts-yaxis .apexcharts-gridline, 
        .apexcharts .apexcharts-yaxis .apexcharts-line,
        .apexcharts .apexcharts-gridline line,
        .apexcharts .apexcharts-gridline text
        { display: none !important; }
        .apexcharts .apexcharts-area { opacity: 1 !important; }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, transform: 'translateY(-80px)', marginRight: 12 }}>REPORTES</h1>
        <button onClick={handleDownloadPdf} style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: 6, background: '#4F46E5', color: '#fff', border: 'none', cursor: 'pointer' }}>Descargar PDF</button>
      </div>
      <div style={{ marginTop: -40, marginBottom: 14, maxWidth: 520 }}>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Buscar evaluado por código o nombre</label>
        <div style={{ position: 'relative' }}>
          <input
            aria-label="Buscar evaluado"
            value={searchTerm}
            onChange={(e) => {
              const v = e.target.value;
              setSearchTerm(v);
              setMatches(findMatches(v));
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && matches.length) { setSelectedCodigo(matches[0].codigo); setMatches([]); } }}
            placeholder="Escribe nombre o código..."
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
          />
          {matches.length > 0 && (
            <ul style={{ position: 'absolute', left: 0, right: 0, zIndex: 40, background: '#fff', border: '1px solid #e5e7eb', marginTop: 6, listStyle: 'none', padding: 8, borderRadius: 6, maxHeight: 220, overflow: 'auto' }}>
              {matches.map(m => (
                <li key={m.codigo} style={{ padding: '6px 8px', cursor: 'pointer' }} onClick={() => { setSelectedCodigo(m.codigo); setMatches([]); setSearchTerm(m.codigo + ' — ' + m.nombre); }}>
                  <strong>{m.codigo}</strong> — {m.nombre}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18 }}>
        <div style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 22, alignItems: 'start' }}>
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#8B7355' }}>
                      <td colSpan={2} style={{ padding: '6px 12px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>MAS UTILIZADOS</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ border: '1px solid #d1c9b0' }}>
                      <td style={{ padding: '6px 12px', fontWeight: 700, background: '#f5f0e8' }}>Competencia</td>
                      <td style={{ padding: '6px 12px' }}>{masYMenos?.maxComp?.label ?? '-'}</td>
                    </tr>
                    <tr style={{ border: '1px solid #d1c9b0' }}>
                      <td style={{ padding: '6px 12px', fontWeight: 700, background: '#f5f0e8' }}>Estilo</td>
                      <td style={{ padding: '6px 12px' }}>{masYMenos?.maxEst?.label ? masYMenos.maxEst.label.charAt(0).toUpperCase() + masYMenos.maxEst.label.slice(1).toLowerCase() : '-'}</td>
                    </tr>
                  </tbody>
                  <thead>
                    <tr style={{ background: '#8B7355' }}>
                      <td colSpan={2} style={{ padding: '6px 12px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>MENOS UTILIZADOS</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ border: '1px solid #d1c9b0' }}>
                      <td style={{ padding: '6px 12px', fontWeight: 700, background: '#f5f0e8' }}>Competencia</td>
                      <td style={{ padding: '6px 12px' }}>{masYMenos?.minComp?.label ?? '-'}</td>
                    </tr>
                    <tr style={{ border: '1px solid #d1c9b0' }}>
                      <td style={{ padding: '6px 12px', fontWeight: 700, background: '#f5f0e8' }}>Estilo</td>
                      <td style={{ padding: '6px 12px' }}>{masYMenos?.maxEst?.label
  ? masYMenos.maxEst.label.charAt(0).toUpperCase() + masYMenos.maxEst.label.slice(1).toLowerCase()
  : '-'}</td>
                    </tr>
                  </tbody>
                </table>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Competencias</div>
              {(() => {
                const source = selectedCodigo
  ? datos.filter(d => String(d.codigo) === String(selectedCodigo))
  : [];
                if (!source.length) return null;
                const d = source[0];
                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#00AEEF' }}>
                        <td colSpan={5} style={{ padding: '6px 12px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>COMPETENCIAS DE LIDERAZGO</td>
                      </tr>
                      <tr style={{ background: '#e8f4fb', fontWeight: 700 }}>
                        <td style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'center' }}>COMUNICACIÓN Y DIRECCIÓN</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'center' }}>RESPETO Y CONFIANZA</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'center' }}>DESARROLLO DE EQUIPO Y EMPOWERMENT</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'center' }}>ADAPTABILIDAD Y RESILIENCIA</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'center' }}>MOTIVACION E INFLUENCIA</td>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'center' }}>{d.comunicacion ?? '-'}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'center' }}>{d.respeto ?? '-'}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'center' }}>{d.desarrollo ?? '-'}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'center' }}>{d.adaptabilidad ?? '-'}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'center' }}>{d.motivacion ?? '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                );
              })()}
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {typeof window !== 'undefined' && ReactApexChart ? (
                    selectedCodigo ? (
                      (radarOptions.series && radarOptions.series.length) ? (
                        <ReactApexChart options={radarOptions.options} series={radarOptions.series} type="radar" height={640} />
                      ) : (
                        <ReactApexChart options={placeholderRadarOptions.options} series={placeholderRadarOptions.series} type="radar" height={640} />
                      )
                    ) : (
                      <ReactApexChart options={placeholderRadarOptions.options} series={placeholderRadarOptions.series} type="radar" height={640} />
                    )
                  ) : (
                    <div>Gráfico competencias</div>
                  )}
                </div>

                <div style={{ width: 520, border: 'none', borderRadius: 12, padding: 14, background: 'linear-gradient(180deg,#ffffff,#fbfdff)', boxShadow: '0 8px 24px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Competencias</div>
                  </div>
                  <div style={{ height: 1, background: '#e6eef8', marginBottom: 10, borderRadius: 4 }} />

                  <div style={{ overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <tbody>
                        <tr style={{ background: '#ffffff', borderRadius: 8 }}>
                          <td style={{ width: 28, padding: '10px 8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#06B6D4', margin: '4px 0' }} />
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 700 }}>Comunicación y dirección</td>
                        </tr>
                        <tr>
                          <td />
                          <td style={{ padding: '6px 8px', color: '#334155' }}>Habilidad del líder para transmitir información clara, escuchar activamente y asegurar comprensión mutua.</td>
                        </tr>

                        <tr style={{ background: '#ffffff', borderRadius: 8 }}>
                          <td style={{ width: 28, padding: '10px 8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#10B981', margin: '4px 0' }} />
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 700 }}>Desarrollo y Empowerment</td>
                        </tr>
                        <tr>
                          <td />
                          <td style={{ padding: '6px 8px', color: '#334155' }}>Identificar potencial, delegar con autoridad y proporcionar oportunidades de crecimiento.</td>
                        </tr>

                        <tr style={{ background: '#ffffff', borderRadius: 8 }}>
                          <td style={{ width: 28, padding: '10px 8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#F59E0B', margin: '4px 0' }} />
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 700 }}>Respeto y confianza</td>
                        </tr>
                        <tr>
                          <td />
                          <td style={{ padding: '6px 8px', color: '#334155' }}>Tratar a todos con dignidad, crear un ambiente seguro y consistente en compromisos.</td>
                        </tr>

                        <tr style={{ background: '#ffffff', borderRadius: 8 }}>
                          <td style={{ width: 28, padding: '10px 8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#EF4444', margin: '4px 0' }} />
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 700 }}>Adaptabilidad y resiliencia</td>
                        </tr>
                        <tr>
                          <td />
                          <td style={{ padding: '6px 8px', color: '#334155' }}>Gestionar el cambio, mantener la calma bajo presión y ajustar planes ante imprevistos.</td>
                        </tr>

                        <tr style={{ background: '#ffffff', borderRadius: 8 }}>
                          <td style={{ width: 28, padding: '10px 8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#8B5CF6', margin: '4px 0' }} />
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 700 }}>Motivación e influencia</td>
                        </tr>
                        <tr>
                          <td />
                          <td style={{ padding: '6px 8px', color: '#334155' }}>Inspirar y energizar al equipo, conectar el trabajo con un propósito mayor.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Estilos</div>
              {(() => {
                const source = selectedCodigo ? datos.filter(d => String(d.codigo) === String(selectedCodigo)) : [];
                if (!source.length) return null;
                const d = source[0];
                const estilosKeys = Object.keys(d.estilos || {});
                if (!estilosKeys.length) return null;
                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#4B6E2E' }}>
                        <td colSpan={estilosKeys.length} style={{ padding: '6px 12px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>ESTILOS DE LIDERAZGO</td>
                      </tr>
                      <tr style={{ background: '#e8f0e0', fontWeight: 700 }}>
                        {estilosKeys.map(k => <td key={k} style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'center' }}>{String(k).toLowerCase()}</td>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {estilosKeys.map(k => <td key={k} style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'center' }}>{d.estilos[k] ?? '-'}</td>)}
                      </tr>
                    </tbody>
                  </table>
                );
              })()}
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {typeof window !== 'undefined' && ReactApexChart ? (
                    selectedCodigo ? (
                      (radarEstilosOptions.series && radarEstilosOptions.series.length) ? (
                        <ReactApexChart options={radarEstilosOptions.options} series={radarEstilosOptions.series} type="radar" height={640} />
                      ) : (
                        <ReactApexChart options={placeholderRadarOptions.options} series={placeholderRadarOptions.series} type="radar" height={640} />
                      )
                    ) : (
                      <ReactApexChart options={placeholderRadarOptions.options} series={placeholderRadarOptions.series} type="radar" height={640} />
                    )
                  ) : (
                    <div>Gráfico estilos</div>
                  )}
                </div>

                <div style={{ width: 520, border: 'none', borderRadius: 12, padding: 14, background: 'linear-gradient(180deg,#ffffff,#fbfdff)', boxShadow: '0 8px 24px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Estilos de Liderazgo</div>
                  </div>
                  <div style={{ height: 1, background: '#e6eef8', marginBottom: 10, borderRadius: 4 }} />

                  <div style={{ overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <tbody>
                        <tr style={{ background: '#ffffff', borderRadius: 8 }}>
                          <td style={{ width: 28, padding: '10px 8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#4B6E2E', margin: '4px 0' }} />
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 700 }}>Autocrático o Directivo</td>
                        </tr>
                        <tr>
                          <td />
                          <td style={{ padding: '6px 8px', color: '#334155' }}>El líder toma todas las decisiones de manera centralizada, sin consultar al equipo. Da órdenes específicas y espera obediencia.</td>
                        </tr>

                        <tr style={{ background: '#ffffff', borderRadius: 8 }}>
                          <td style={{ width: 28, padding: '10px 8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#9A3412', margin: '4px 0' }} />
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 700 }}>Coercitivo</td>
                        </tr>
                        <tr>
                          <td />
                          <td style={{ padding: '6px 8px', color: '#334155' }}>El líder utiliza su autoridad formal, el miedo y la coerción para imponer su voluntad. Se centra en el control y el cumplimiento mediante amenazas o sanciones.</td>
                        </tr>

                        <tr style={{ background: '#ffffff', borderRadius: 8 }}>
                          <td style={{ width: 28, padding: '10px 8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#0ea5b7', margin: '4px 0' }} />
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 700 }}>Democrático o Participativo</td>
                        </tr>
                        <tr>
                          <td />
                          <td style={{ padding: '6px 8px', color: '#334155' }}>El líder fomenta la colaboración. Las decisiones se toman consultando al equipo, considerando sus opiniones antes de actuar.</td>
                        </tr>

                        <tr style={{ background: '#ffffff', borderRadius: 8 }}>
                          <td style={{ width: 28, padding: '10px 8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#0369a1', margin: '4px 0' }} />
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 700 }}>De equipo</td>
                        </tr>
                        <tr>
                          <td />
                          <td style={{ padding: '6px 8px', color: '#334155' }}>El líder se enfoca en construir colaboración, cohesión y desempeño efectivo del grupo. Actúa como catalizador de la sinergia del equipo.</td>
                        </tr>

                        <tr style={{ background: '#ffffff', borderRadius: 8 }}>
                          <td style={{ width: 28, padding: '10px 8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#16a34a', margin: '4px 0' }} />
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 700 }}>Afiliativo</td>
                        </tr>
                        <tr>
                          <td />
                          <td style={{ padding: '6px 8px', color: '#334155' }}>El líder prioriza la construcción de relaciones y la armonía dentro del equipo. Se centra en el bienestar emocional y en crear un ambiente de apoyo y confianza.</td>
                        </tr>

                        <tr style={{ background: '#ffffff', borderRadius: 8 }}>
                          <td style={{ width: 28, padding: '10px 8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#8b5cf6', margin: '4px 0' }} />
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 700 }}>Visionario</td>
                        </tr>
                        <tr>
                          <td />
                          <td style={{ padding: '6px 8px', color: '#334155' }}>El líder comunica una visión clara, inspiradora del futuro. Motiva al equipo mostrando cómo su trabajo contribuye a un propósito mayor.</td>
                        </tr>

                        <tr style={{ background: '#ffffff', borderRadius: 8 }}>
                          <td style={{ width: 28, padding: '10px 8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#f97316', margin: '4px 0' }} />
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 700 }}>Delegativo</td>
                        </tr>
                        <tr>
                          <td />
                          <td style={{ padding: '6px 8px', color: '#334155' }}>El líder brinda total autonomía al equipo. Proporciona recursos pero interviene muy poco, dejando que el equipo se autogestione.</td>
                        </tr>

                        <tr style={{ background: '#ffffff', borderRadius: 8 }}>
                          <td style={{ width: 28, padding: '10px 8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#7c3aed', margin: '4px 0' }} />
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 700 }}>Transformacional</td>
                        </tr>
                        <tr>
                          <td />
                          <td style={{ padding: '6px 8px', color: '#334155' }}>El líder inspira y motiva al equipo con una visión convincente. Busca transformar a las personas y la organización, fomentando innovación y crecimiento intelectual.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}