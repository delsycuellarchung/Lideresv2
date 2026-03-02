"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
// Chart removed: not rendering chart component here to keep only stat cards

export default function DashboardPage() {
  const [stats, setStats] = useState({
    evaluadores: 0,
    evaluaciones: 0,
    completadas: 0,
    pendientes: 0,
    evaluados: 0,
  });

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    const disableDb = String(process.env.NEXT_PUBLIC_DISABLE_DB || '').toLowerCase() === 'true';
    
    if (!supabase || disableDb) return;

    try {
      // Contar evaluadores únicos
      const { data: evaluatorsData } = await supabase
        .from('evaluators')
        .select('codigo_evaluador', { count: 'exact' });
      
      const evaluadoresUnicos = new Set(
        evaluatorsData
          ?.filter((e: any) => e.codigo_evaluador)
          .map((e: any) => e.codigo_evaluador) || []
      ).size;

      // Contar evaluaciones
      const { count: countEvaluaciones } = await supabase
        .from('evaluaciones')
        .select('*', { count: 'exact', head: true });

      // Contar completadas
      const { count: countCompletadas } = await supabase
        .from('evaluaciones')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completada');

      // Contar pendientes
      const { count: countPendientes } = await supabase
        .from('evaluaciones')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendiente');

      // Contar evaluados únicos
      const { data: evaluadosData } = await supabase
        .from('evaluados')
        .select('codigo_evaluado', { count: 'exact' });

      const evaluadosUnicos = new Set(
        evaluadosData
          ?.filter((e: any) => e.codigo_evaluado)
          .map((e: any) => e.codigo_evaluado) || []
      ).size;

      setStats({
        evaluadores: evaluadoresUnicos,
        evaluaciones: countEvaluaciones || 0,
        completadas: countCompletadas || 0,
        pendientes: countPendientes || 0,
        evaluados: evaluadosUnicos || 0,
      });
    } catch (err) {
      console.error('Error cargando estadísticas:', err);
    }
  };

  return (
    <section className="dashboard-container">
      <h2 style={{ margin: 0, marginBottom: 24, fontSize: 32, fontWeight: 800, transform: 'translateX(-16px) translateY(-60px)' }}>Dashboard</h2>

      <div className="stat-grid">
        <div className="stat-card stat-evaluadores" role="button" aria-label="Evaluadores">
          <img src="/images/evaluadores.png" alt="Evaluadores" className="stat-image natural" />
          <div className="stat-value">{stats.evaluadores}</div>
          <div className="stat-label">Evaluadores</div>
        </div>

        <div className="stat-card stat-evaluaciones" role="button" aria-label="Evaluaciones">
          <img src="/images/evaluaciones.png" alt="Evaluaciones" className="stat-image natural" />
          <div className="stat-value">{stats.evaluaciones}</div>
          <div className="stat-label">Evaluaciones</div>
        </div>

        <div className="stat-card stat-completadas" role="button" aria-label="Completadas">
          <img src="/images/completado.png" alt="Completadas" className="stat-image natural" />
          <div className="stat-value">{stats.completadas}</div>
          <div className="stat-label">Completadas</div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-placeholder" aria-hidden="true" />

        <div className="stat-card stat-pendientes" role="button" aria-label="Pendientes">
          <img src="/images/pendiente.png" alt="Pendientes" className="stat-image natural" />
          <div className="stat-value">{stats.pendientes}</div>
          <div className="stat-label">Pendientes</div>
        </div>

        <div className="stat-card stat-evaluados" role="button" aria-label="Evaluados">
          <img src="/images/evaluadores.png" alt="Evaluados" className="stat-image natural" />
          <div className="stat-value">{stats.evaluados}</div>
          <div className="stat-label">Evaluados</div>
        </div>

        <div className="stat-placeholder" aria-hidden="true" />
      </div>
      {/* Gráfico eliminado: sólo se muestran las tarjetas del dashboard */}
    </section>
  );
}
