"use client";

import React from 'react';
import { mapLabelToNumeric } from '@/lib/scaleMapper';

type Afirm = { codigo?: string; pregunta: string; tipo?: string | null; categoria?: string };
type RespEntry = { id: string; createdAt: string; responses?: Record<string, string>; token?: string; evaluatorName?: string; evaluadoNombre?: string; evaluadoCodigo?: string };

export default function DatosEvaluacionPage() {
  const [allResponses, setAllResponses] = React.useState<RespEntry[]>([]);
  const [afirmaciones, setAfirmaciones] = React.useState<Afirm[]>([]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem('form_responses') || '[]';
      setAllResponses(JSON.parse(raw) || []);
    } catch {
      setAllResponses([]);
    }

    try {
      const rawA = window.localStorage.getItem('formulario_afirmaciones') || '[]';
      setAfirmaciones(JSON.parse(rawA) || []);
    } catch {
      setAfirmaciones([]);
    }
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

  return (
    <section style={{ padding: '12px 24px 20px 24px' }}>
      <h1 style={{ margin: '0 0 0 12px', fontSize: 28, fontWeight: 800, transform: 'translateY(-70px)' }}>Datos evaluacion</h1>
      <div style={{ marginTop: -12, marginLeft: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#2f2f2f' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #dcdcdc', color: '#555', fontWeight: 600 }}>
              <th style={{ padding: '10px 10px', width: 80 }}>Código</th>
              <th style={{ padding: '10px 10px', width: 160 }}>Evaluado</th>
              <th style={{ padding: '10px 10px', width: 120 }}>Evaluador</th>
              <th style={{ padding: '10px 10px', width: 100 }}>Fecha</th>
              {todasAfirmaciones.map((a, i) => {
                const rawLabel = a.codigo ? String(a.codigo) : `P${i + 1}`;
                const label = rawLabel.replace(/\d+$/g, '');
                return <th key={rawLabel} title={a.pregunta} style={{ padding: '10px 8px', minWidth: 120, textAlign: 'center', whiteSpace: 'normal' }}>{label}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {allResponses.length === 0 ? (
              <tr>
                <td colSpan={4 + todasAfirmaciones.length} style={{ padding: 20, textAlign: 'center', color: '#666' }}>No hay respuestas registradas aún.</td>
              </tr>
            ) : (
              allResponses.map((resp, idx) => (
                <tr key={resp.id || idx} style={{ borderBottom: '1px solid #ededed' }}>
                  <td style={{ padding: '10px 10px', width: 80 }}>{resp.evaluadoCodigo}</td>
                  <td style={{ padding: '10px 10px', width: 160 }}>{resp.evaluadoNombre}</td>
                  <td style={{ padding: '10px 10px', width: 120 }}>{resp.evaluatorName}</td>
                  <td style={{ padding: '10px 10px', width: 100 }}>{resp.createdAt ? new Date(resp.createdAt).toLocaleDateString() : ''}</td>
                  {todasAfirmaciones.map(a => {
                    const code = a.codigo || '';
                    const raw = resp.responses?.[code] || '';
                    const mapped = mapLabelToNumeric(raw as string);
                    const display = raw && typeof mapped === 'number' && !isNaN(mapped) ? `${raw} (${mapped})` : raw;
                    return <td key={code} style={{ padding: '8px 10px', minWidth: 120, textAlign: 'center' }}>{display}</td>;
                  })}
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