"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Componente principal del dashboard del admin.
// Muestra estadísticas simples extraídas de la base de datos.
export default function DashboardPage() {
  // Estado local para los distintos contadores que se renderizan.
  const [stats, setStats] = useState({
    evaluadores: 0,
    evaluaciones: 0,
    completadas: 0,
    pendientes: 0,
    evaluados: 0,
  });

  // Al montar el componente, cargamos las estadísticas.
  useEffect(() => {
    cargarEstadisticas();
  }, []);

  // Función encargada de consultar la base de datos (Supabase)
  // y calcular los valores que necesitaremos en el dashboard.
  const cargarEstadisticas = async () => {
    // Permite desactivar las llamadas a la BD mediante la variable de entorno
    // `NEXT_PUBLIC_DISABLE_DB=true` (útil en entornos de desarrollo o pruebas).
    const disableDb = String(process.env.NEXT_PUBLIC_DISABLE_DB || '').toLowerCase() === 'true';
    
    // Si no hay cliente de supabase o la BD está deshabilitada, salir temprano.
    if (!supabase || disableDb) return;

    try {
      // --- Contar evaluadores únicos ---
      // Seleccionamos la columna `codigo_evaluador` desde la tabla `evaluators`.
      // Luego usamos un Set para asegurar unicidad (por si hubiera duplicados).
      const { data: evaluatorsData } = await supabase
        .from('evaluators')
        .select('codigo_evaluador', { count: 'exact' });
      
      const evaluadoresUnicos = new Set(
        evaluatorsData
          ?.filter((e: any) => e.codigo_evaluador)
          .map((e: any) => e.codigo_evaluador) || []
      ).size;

      // --- Contar todas las evaluaciones ---
      // Usamos `head: true` y `count: 'exact'` para que supabase nos devuelva
      // únicamente el conteo en lugar de todos los registros.
      const { count: countEvaluaciones } = await supabase
        .from('evaluaciones')
        .select('*', { count: 'exact', head: true });

      // --- Contar evaluaciones completadas ---
      // Filtramos por `status = 'completada'` y pedimos solo el conteo.
      const { count: countCompletadas } = await supabase
        .from('evaluaciones')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completada');

      // --- Contar evaluaciones pendientes ---
      const { count: countPendientes } = await supabase
        .from('evaluaciones')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendiente');

      // --- Contar evaluados únicos ---
      // Similar a evaluadores: extraemos `codigo_evaluado` y contamos valores únicos.
      const { data: evaluadosData } = await supabase
        .from('evaluados')
        .select('codigo_evaluado', { count: 'exact' });

      const evaluadosUnicos = new Set(
        evaluadosData
          ?.filter((e: any) => e.codigo_evaluado)
          .map((e: any) => e.codigo_evaluado) || []
      ).size;

      // Actualizamos el estado con los valores calculados.
      setStats({
        evaluadores: evaluadoresUnicos,
        evaluaciones: countEvaluaciones || 0,
        completadas: countCompletadas || 0,
        pendientes: countPendientes || 0,
        evaluados: evaluadosUnicos || 0,
      });
    } catch (err) {
      // Manejo básico de errores: log para depuración.
      console.error('Error cargando estadísticas:', err);
    }
  };

  // Render del componente: tarjetas con cada estadística.
  return (
    <section className="dashboard-container">
      {/* Título principal del dashboard. */}
      <h2 style={{ margin: 0, marginBottom: 24, fontSize: 32, fontWeight: 800, transform: 'translateX(-16px) translateY(-60px)' }}>DASHBOARD</h2>
      {/* Grid principal con tres tarjetas superiores. */}
      <div className="stat-grid">
        {/* Tarjeta: Evaluadores (únicos) */}
        <div className="stat-card stat-evaluadores" role="button" aria-label="Evaluadores">
          <img src="/images/evaluadores.png" alt="Evaluadores" className="stat-image natural" />
          <div className="stat-value">{stats.evaluadores}</div>
          <div className="stat-label">Evaluadores</div>
        </div>
        {/* Tarjeta: Evaluados (únicos) */}
        <div className="stat-card stat-evaluados" role="button" aria-label="Evaluados">
          <img src="/images/evaluadores.png" alt="Evaluados" className="stat-image natural" />
          <div className="stat-value">{stats.evaluados}</div>
          <div className="stat-label">Evaluados</div>
        </div>
        {/* Tarjeta: Total de evaluaciones */}
        <div className="stat-card stat-evaluaciones" role="button" aria-label="Evaluaciones">
          <img src="/images/evaluaciones.png" alt="Evaluaciones" className="stat-image natural" />
          <div className="stat-value">{stats.evaluaciones}</div>
          <div className="stat-label">Evaluaciones</div>
        </div>
      </div>
      {/* Fila inferior con pendientes y completadas. */}
      <div className="stat-row">
        <div className="stat-placeholder" aria-hidden="true" />
        {/* Tarjeta: Pendientes */}
        <div className="stat-card stat-pendientes" role="button" aria-label="Pendientes">
          <img src="/images/pendiente.png" alt="Pendientes" className="stat-image natural" />
          <div className="stat-value">{stats.pendientes}</div>
          <div className="stat-label">Pendientes</div>
        </div>
        {/* Tarjeta: Completadas */}
        <div className="stat-card stat-completadas" role="button" aria-label="Completadas">
          <img src="/images/completado.png" alt="Completadas" className="stat-image natural" />
          <div className="stat-value">{stats.completadas}</div>
          <div className="stat-label">Completadas</div>
        </div>
        <div className="stat-placeholder" aria-hidden="true" />
      </div>
    </section>
  );
}
