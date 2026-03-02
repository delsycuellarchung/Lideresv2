"use client";

import dynamic from 'next/dynamic';
import React from 'react';

const AverageByCompetenceChart = dynamic(() => import('../resultados/detalle/AverageByCompetenceChart'), { ssr: false });

export default function ChartClient() {
  return <AverageByCompetenceChart />;
}
