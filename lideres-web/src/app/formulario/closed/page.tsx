"use client";

import React from 'react';

export default function FormularioClosedPage() {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 720, textAlign: 'center', background: '#fff', padding: 36, borderRadius: 12, boxShadow: '0 12px 40px rgba(2,6,23,0.06)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Enlace cerrado</h1>
        <p style={{ color: '#64748b', fontSize: 16, marginBottom: 18 }}>
          Gracias por completar la evaluación. Este enlace ya no está disponible para nuevas respuestas.
        </p>
        <div style={{ color: '#6b7280', fontSize: 14 }}>
          Si necesitas reabrir la evaluación o enviar otra respuesta, contacta con el administrador.
        </div>
      </div>
    </div>
  );
}
