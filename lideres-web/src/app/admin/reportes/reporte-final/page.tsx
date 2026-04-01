"use client";
import React from "react";

export default function ReporteFinalPage() {
  const [codigo, setCodigo] = React.useState('');
  const [nombre, setNombre] = React.useState('');
  const [evaluadores, setEvaluadores] = React.useState<number | ''>('');

  return (
    <section style={{ padding: 28 }}>
      <h2 style={{ margin: '-85px 0 16px 0', fontSize: 33, fontWeight: 800 }}>REPORTE FINAL</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <div style={{ flex: '1 1 420px' }}>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Buscar evaluado (código)</label>
          <input
            aria-label="buscar-evaluado-codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ingresa código..."
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
          />
        </div>

        <div style={{ flex: '1 1 420px' }}>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Nombre</label>
          <input
            aria-label="nombre-evaluado"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del evaluado"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
          />
        </div>

        <div style={{ width: 160 }}>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Evaluadores</label>
          <input
            aria-label="num-evaluadores"
            value={evaluadores}
            onChange={(e) => {
              const v = e.target.value;
              const n = v === '' ? '' : Number(v.replace(/[^0-9]/g, ''));
              setEvaluadores(n as any);
            }}
            placeholder="0"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', textAlign: 'center' }}
          />
        </div>
      </div>
    </section>
  );
}
