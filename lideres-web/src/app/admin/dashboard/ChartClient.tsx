"use client";

import dynamic from 'next/dynamic';
import React from 'react';

// Este componente actúa como wrapper cliente para el gráfico.
// Usamos `next/dynamic` para cargar el componente `AverageByCompetenceChart`
// de forma dinámica y deshabilitar el renderizado en servidor (`ssr: false`).
// Razones:
// - Muchas librerías de gráficos dependen del objeto `window` o del DOM,
//   por lo que fallan en SSR.
// - Cargarlo dinámicamente reduce el tamaño del bundle inicial y evita
//   ejecutar código de cliente en el servidor.
// El componente simplemente monta el gráfico importado dinámicamente.
const AverageByCompetenceChart = dynamic(
  () => import('../resultados/detalle/AverageByCompetenceChart'),
  { ssr: false }
);

export default function ChartClient() {
  // Renderiza el componente de gráfico en el cliente.
  return <AverageByCompetenceChart />;
}
