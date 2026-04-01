"use client";
import React from "react";

export default function ReporteFinalPage() {
  const [codigo, setCodigo] = React.useState('');
  const [nombre, setNombre] = React.useState('');
  const [evaluadores, setEvaluadores] = React.useState<number | ''>('');
  const [afCompetencias, setAfCompetencias] = React.useState<Array<any>>([]);
  const [afEstilos, setAfEstilos] = React.useState<Array<any>>([]);
  const [loading, setLoading] = React.useState(false);

  return (
    <section style={{ padding: 28, marginTop: 48 }}>
      <h2 style={{ margin: '-125px 0 16px 0', fontSize: 33, fontWeight: 800 }}>REPORTE FINAL</h2>

      <div style={{ marginTop: 8, marginLeft: 12 }}>
        <label style={{ display: 'block', fontWeight: 700, marginBottom: 12 }}>Buscar por código del evaluado</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            aria-label="buscar-evaluado-codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código..."
            list="evaluados-list-rf"
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.08)', width: 200 }}
          />
          <datalist id="evaluados-list-rf">
            {/* opciones cargadas dinámicamente si se desea */}
          </datalist>

          <button onClick={async () => {
            if (!codigo) return;
            setLoading(true);
            try {
              const [frRes, fRes] = await Promise.all([fetch('/api/admin/form-responses'), fetch('/api/formulario')]);
              const frJson = await frRes.json();
              const fJson = await fRes.json();
              const allResponses = Array.isArray(frJson.data) ? frJson.data : [];
              const afirmaciones = Array.isArray(fJson.afirmaciones) ? fJson.afirmaciones : [];
              // filter entries for this evaluado
              const entries = allResponses.filter((r: any) => String(r.evaluado_codigo || r.evaluadoCodigo || r.token || '').trim() === String(codigo).trim());
              // helper mapLabelToNumeric logic: import mapping from scaleMapper might not be available here, so implement lightweight mapper
              const mapLabelToNumericLocal = (v: any) => {
                if (v === null || v === undefined) return null;
                if (typeof v === 'number') return isNaN(v) ? null : v;
                const s = String(v).trim();
                if (!s) return null;
                // try numeric
                const n = Number(s);
                if (!isNaN(n)) return n;
                // common labels
                const map: Record<string, number> = { 'Muy en desacuerdo': 1, 'En desacuerdo': 2, 'Neutral': 3, 'De acuerdo': 4, 'Muy de acuerdo': 5 };
                if (map[s]) return map[s];
                // fallback: extract first digit
                const m = s.match(/\d+(?:\.\d+)?/);
                return m ? Number(m[0]) : null;
              };

              const computeAvgForCode = (code: string) => {
                const vals: number[] = [];
                entries.forEach((r: any) => {
                  let raw = r.responses?.[code];
                  if (raw === undefined || raw === null) {
                    // attempt fallback comp-<index>
                    const globalIdx = afirmaciones.findIndex((af: any) => String(af.codigo) === String(code));
                    if (globalIdx >= 0) raw = r.responses?.[`comp-${globalIdx}`];
                  }
                  const num = mapLabelToNumericLocal(raw);
                  if (typeof num === 'number' && !isNaN(num)) vals.push(num);
                });
                if (!vals.length) return null;
                const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
                return Number(avg.toFixed(2));
              };

              const competenciaAfs: Array<any> = [];
              const estiloAfs: Array<any> = [];
              afirmaciones.forEach((af: any) => {
                const avg = computeAvgForCode(String(af.codigo));
                const row = { codigo: af.codigo, pregunta: af.pregunta || af.texto || af.label || '', promedio: avg };
                if (af.categoria === 'estilo') estiloAfs.push(row);
                else competenciaAfs.push(row);
              });

              setAfCompetencias(competenciaAfs.filter(r => r.promedio !== null));
              setAfEstilos(estiloAfs.filter(r => r.promedio !== null));
              // optionally set nombre/evaluadores from entries
              if (entries.length) {
                const first = entries[0];
                const name = first.evaluado_nombre || first.evaluadoNombre || '';
                setNombre(name || nombre);
                // compute unique evaluadores
                const evalSet = new Set(entries.map((e:any) => String(e.evaluator_name || e.evaluatorName || '').trim()));
                setEvaluadores(evalSet.size || evaluadores);
              }
            } catch (e) {
              console.warn('Error cargando datos', e);
            } finally { setLoading(false); }
          }} style={{ padding: '8px 12px', borderRadius: 8, background: '#4f46e5', color: '#fff', border: 'none' }}>{loading ? 'Cargando...' : 'Cargar'}</button>

          <div style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginRight: 8 }}>Nombre</label>
            <input
              aria-label="nombre-evaluado"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del evaluado"
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.08)', width: 420, background: '#fff', color: '#0f172a' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginRight: 8 }}>Evaluadores</label>
            <input
              aria-label="num-evaluadores"
              value={evaluadores}
              onChange={(e) => {
                const v = e.target.value;
                const n = v === '' ? '' : Number(v.replace(/[^0-9]/g, ''));
                setEvaluadores(n as any);
              }}
              placeholder="0"
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.08)', width: 120, textAlign: 'center', background: '#fff', color: '#0f172a' }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
