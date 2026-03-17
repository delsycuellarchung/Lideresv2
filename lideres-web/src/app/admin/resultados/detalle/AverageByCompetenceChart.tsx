"use client";

import React from 'react';
import { labelToPercent } from '@/lib/scaleMapper';

type Afirm = { codigo?: string; pregunta: string; tipo?: string | null; categoria?: string };

export default function AverageByCompetenceChart({ onBarClick }: { onBarClick?: (competence: string) => void }) {
  const [data, setData] = React.useState<Array<{ competence: string; avg: number; count: number }>>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    try {
      const rawAff = localStorage.getItem('formulario_afirmaciones') || '[]';
      const parsedAff = JSON.parse(rawAff) || [];
      const afirmaciones: Afirm[] = Array.isArray(parsedAff) ? parsedAff.map((a: any) => {
        const item = typeof a === 'string' ? { pregunta: a } : (a || {});
        const codigoVal = item.codigo != null ? (typeof item.codigo === 'object' ? (item.codigo.codigo ?? item.codigo.nombre ?? JSON.stringify(item.codigo)) : String(item.codigo)) : undefined;
        const preguntaVal = item.pregunta != null ? (typeof item.pregunta === 'object' ? (item.pregunta.pregunta ?? item.pregunta.texto ?? JSON.stringify(item.pregunta)) : String(item.pregunta)) : '';
        const tipoVal = item.tipo != null ? (typeof item.tipo === 'object' ? (item.tipo.nombre ?? JSON.stringify(item.tipo)) : String(item.tipo)) : undefined;
        const categoriaVal = item.categoria != null ? String(item.categoria) : undefined;
        return { codigo: codigoVal, pregunta: preguntaVal, tipo: tipoVal, categoria: categoriaVal };
      }) : [];
      const rawInst = localStorage.getItem('formulario_instrucciones') || '[]';
      const instrucciones: Array<{ etiqueta: string; descripcion?: string }> = JSON.parse(rawInst);
      const rawResp = localStorage.getItem('form_responses') || '[]';
      const responsesArr: Array<{ id?: string; createdAt?: string; responses?: Record<string, string> }> = JSON.parse(rawResp);

      if (!afirmaciones || afirmaciones.length === 0 || !responsesArr || responsesArr.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }
      const byCodigo: Record<string, Afirm> = {};
      afirmaciones.forEach((a) => { if (a.codigo) byCodigo[a.codigo] = a; });

      // accumulate per competence
      const accum: Record<string, { sum: number; count: number }> = {};

      responsesArr.forEach((entry) => {
        const resp = entry.responses || {};
        Object.keys(resp).forEach((key) => {
          const segs = key.split('-');
          const codigo = segs[segs.length - 1];
          const aff = byCodigo[codigo];
          if (!aff) return; // skip if no match
          // only consider competencies
          const competence = aff.tipo || 'Sin competencia';
          const etiqueta = resp[key];
          const instruccionesLabels = instrucciones && instrucciones.length > 0 ? instrucciones.map(i => i.etiqueta) : undefined;
          const score = labelToPercent(String(etiqueta), instruccionesLabels);
          if (score === null) return;
          if (!accum[competence]) accum[competence] = { sum: 0, count: 0 };
          accum[competence].sum += score;
          accum[competence].count += 1;
        });
      });

      const out: Array<{ competence: string; avg: number; count: number }> = Object.keys(accum).map((k) => ({ competence: k, avg: accum[k].sum / Math.max(1, accum[k].count), count: accum[k].count }));
      // sort by avg desc
      out.sort((a, b) => b.avg - a.avg);

      setData(out);
    } catch (e) {
      console.warn(e);
      setData([]);
    }
    setLoading(false);
  }, []);

  if (loading) return <div>Calculando datos…</div>;
  if (!data || data.length === 0) return <div>No hay datos suficientes para el gráfico.</div>;

  const width = 760; const barMaxWidth = 520; const barHeight = 28; const gap = 12;

  const maxValue = 100;

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ margin: '6px 0 12px 0' }}>Promedio por competencia</h3>
      <div style={{ width: width, maxWidth: '100%', padding: 12, borderRadius: 10, background: '#fff', border: '1px solid rgba(15,23,42,0.04)', boxShadow: '0 6px 18px rgba(2,6,23,0.03)' }}>
        {data.map((d, i) => {
          const w = Math.max(6, (d.avg / maxValue) * barMaxWidth);
          return (
            <div key={d.competence} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: gap, cursor: onBarClick ? 'pointer' : 'default' }} onClick={() => onBarClick?.(d.competence)}>
              <div style={{ width: 200, fontSize: 13, color: 'rgba(15,23,42,0.9)', fontWeight: 700 }}>{d.competence}</div>
              <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div title={`${d.avg.toFixed(1)} — ${d.count} respuestas`} style={{ background: 'linear-gradient(90deg,#60a5fa,#4f46e5)', height: barHeight, width: w, borderRadius: 8 }} />
                <div style={{ width: 52, textAlign: 'right', fontWeight: 700 }}>{Math.round(d.avg)}%</div>
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(15,23,42,0.6)' }}>Promedio calculado a partir de respuestas guardadas en localStorage (<code>form_responses</code>).</div>
      </div>
    </div>
  );
}
