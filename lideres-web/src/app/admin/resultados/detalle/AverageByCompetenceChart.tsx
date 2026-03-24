"use client";

import React from 'react';
import { labelToPercent } from '@/lib/scaleMapper';

type Afirm = { codigo?: string; pregunta: string; tipo?: string | null; categoria?: string };

export default function AverageByCompetenceChart({ onBarClick }: { onBarClick?: (competence: string) => void }) {
  const [data, setData] = React.useState<Array<{ competence: string; avg: number; count: number }>>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
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
      afirmaciones.forEach((a) => { if (a.codigo) byCodigo[String(a.codigo)] = a; });

      const normalizeResponses = (respObj: Record<string, any>) => {
        const out: Record<string, any> = {};
        if (!respObj) return out;
        Object.keys(respObj).forEach((k) => {
          const v = respObj[k];
          if (byCodigo[String(k)]) { out[String(k)] = v; return; }
          const m = String(k).match(/^(?:comp|est)-(\d+)$/i);
          if (m) {
            const idx = parseInt(m[1], 10);
            const aff = Array.isArray(afirmaciones) && afirmaciones[idx] ? afirmaciones[idx] : null;
            if (aff && aff.codigo) { out[String(aff.codigo)] = v; return; }
          }
          out[String(k)] = v;
        });
        return out;
      };

      // accumulate per competence
      const accum: Record<string, { sum: number; count: number }> = {};

      responsesArr.forEach((entry) => {
        const resp = normalizeResponses(entry.responses || {});
        Object.keys(resp).forEach((key) => {
          const aff = byCodigo[String(key)];
          if (!aff) return;
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
    };

    // Try server first, fallback to localStorage
    (async () => {
      try {
        const res = await fetch('/api/admin/form-responses');
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          if (json && Array.isArray(json.data) && json.data.length > 0) {
            // write responses into localStorage shape expected by old logic
            try { localStorage.setItem('form_responses', JSON.stringify(json.data)); } catch {};
            await load();
          } else {
            await load();
          }
        } else {
          await load();
        }
      } catch (e) {
        await load();
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'form_responses') {
        // recompute when local responses change
        try { load(); } catch {};
      }
    };
    window.addEventListener('storage', onStorage);
    return () => { mounted = false; window.removeEventListener('storage', onStorage); };
  }, []);

  if (loading) return <div>Calculando datos…</div>;
  if (!data || data.length === 0) return <div>No hay datos suficientes para el gráfico.</div>;

  const width = 760;
  const barMaxWidth = 520;
  const barHeight = 36;
  const gap = 12;

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
                <div title={`${d.avg.toFixed(1)} — ${d.count} respuestas`} style={{ background: 'linear-gradient(90deg,#3b82f6,#7c3aed)', height: barHeight, width: w, borderRadius: 10, boxShadow: '0 6px 18px rgba(99,102,241,0.12)' }} />
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(15,23,42,0.6)' }}>Promedio calculado a partir de respuestas guardadas en localStorage (<code>form_responses</code>).</div>
      </div>
    </div>
  );
}
