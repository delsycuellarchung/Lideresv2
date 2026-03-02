"use client";
import React from "react";
import dynamic from 'next/dynamic';
import { mapLabelToNumeric } from '@/lib/scaleMapper';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false }) as any;

export default function ReportesPage() {
  const [datos, setDatos] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('form_responses') || '[]';
      const allResponses = JSON.parse(raw) || [];
      const rawA = window.localStorage.getItem('formulario_afirmaciones') || '[]';
      const afirmaciones = JSON.parse(rawA) || [];
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
      Object.values(affByCode).forEach((a: any) => {
        const g = classify(a);
        if (g) codesByGroup[g].push(String(a.codigo));
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

        const overall = (evaluadores >= 3 && item.values.length) ? +(item.values.reduce((s: number, v: number) => s + v, 0) / item.values.length).toFixed(2) : null;

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
          promedio: overall ?? null
        };
      });

      setDatos(rows);
    } catch (e) {
      console.warn('Error building report data', e);
      setDatos([]);
    }
  }, []);

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
        stroke: { show: true, width: 1, colors: ['transparent'] },
        xaxis: { categories },
        yaxis: { min: 0, max: 5, title: { text: 'Promedio' } },
        tooltip: { y: { formatter: (v:any) => v === null ? '—' : v.toFixed(2) } },
        legend: { position: 'top' },
        responsive: [{ breakpoint: 800, options: { plotOptions: { bar: { columnWidth: '70%' } }, legend: { position: 'bottom' } } }]
      }
    };
  }, [datos]);

  

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
  }, [datos]);

  const radarOptions = React.useMemo(() => {
    const labels = ['Comunicación', 'Respeto', 'Desarrollo', 'Adaptabilidad', 'Motivación'];
    const series = datos.map(d => ({ name: d.nombre || d.codigo, data: [d.comunicacion ?? 0, d.respeto ?? 0, d.desarrollo ?? 0, d.adaptabilidad ?? 0, d.motivacion ?? 0] }));
    return {
      series,
      options: {
        chart: { type: 'radar', height: 360, toolbar: { show: true } },
        xaxis: { categories: labels },
        yaxis: { min: 0, max: 5 },
        stroke: { width: 2 },
        markers: { size: 3 },
        legend: { position: 'bottom' }
      }
    };
  }, [datos]);

  return (
    <section style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, transform: 'translateY(-80px)' }}>REPORTES</h1>
      <p style={{ marginTop: -40, marginBottom: 28, color: 'rgba(15,23,42,0.8)' }}>Resumen de resultados por persona. Los promedios sólo se muestran cuando hay al menos tres evaluadores.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18 }}>
        <div style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid rgba(15,23,42,0.04)' }}>
          <h3 style={{ margin: 0, marginBottom: 8, fontSize: 16, fontWeight: 700 }}>Competencias — promedios por evaluado</h3>
          {typeof window !== 'undefined' && ReactApexChart ? (
            <ReactApexChart options={barOptions.options} series={barOptions.series} type="bar" height={360} />
          ) : (
            <div>Gráfico</div>
          )}
        </div>

        <div style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid rgba(15,23,42,0.04)' }}>
          <h3 style={{ margin: 0, marginBottom: 8, fontSize: 16, fontWeight: 700 }}>Perfil individual</h3>
          {typeof window !== 'undefined' && ReactApexChart ? (
            <ReactApexChart options={radarOptions.options} series={radarOptions.series} type="radar" height={360} />
          ) : (
            <div>Gráfico</div>
          )}
        </div>
      </div>
      
      <div style={{ marginTop: 18, background: '#fff', padding: 12, borderRadius: 8, border: '1px solid rgba(15,23,42,0.04)' }}>
        <h3 style={{ margin: 0, marginBottom: 8, fontSize: 16, fontWeight: 700 }}>Competencias por evaluado</h3>
        {typeof window !== 'undefined' && ReactApexChart ? (
          <ReactApexChart options={heatmapOptions.options} series={heatmapOptions.series} type="heatmap" height={320} />
        ) : (
          <div>Gráfico</div>
        )}
      </div>

      
    </section>
  );
}