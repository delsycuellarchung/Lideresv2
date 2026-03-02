"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Gestion = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  evaluadores: number;
  asignaciones: number;
  completadas: number;
};

export default function GestionPage() {
  const [gestiones, setGestiones] = useState<Gestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
  });
  const [creando, setCreando] = useState(false);
  const disableDb = String(process.env.NEXT_PUBLIC_DISABLE_DB || '').toLowerCase() === 'true';

  useEffect(() => {
    if (!supabase || disableDb) {
      setLoading(false);
      return;
    }
    cargarGestiones();
  }, []);

  const cargarGestiones = async () => {
    try {
      // Obtener todas las gestiones
      const { data: gestionesData, error: gestErr } = await supabase
        .from('gestiones')
        .select('*')
        .order('name', { ascending: false });

      if (gestErr) throw gestErr;

      // Para cada gestión, contar evaluadores, asignaciones y completadas
      const result: Gestion[] = [];

      for (const g of gestionesData || []) {
        // Contar evaluadores únicos en esta gestión
        const { data: asignData } = await supabase
          .from('asignaciones')
          .select('evaluador_id', { count: 'exact' })
          .eq('gestion_id', g.id);

        const evaluadoresSet = new Set((asignData || []).map((a: any) => a.evaluador_id));

        // Contar asignaciones totales
        const { count: totalAsignaciones } = await supabase
          .from('asignaciones')
          .select('*', { count: 'exact', head: true })
          .eq('gestion_id', g.id);

        // Contar evaluaciones completadas
        const { data: evalCompletadas } = await supabase
          .from('evaluaciones')
          .select('id', { count: 'exact' })
          .eq('gestion_id', g.id)
          .eq('status', 'completada');

        result.push({
          id: g.id,
          name: g.name,
          start_date: g.start_date,
          end_date: g.end_date,
          is_active: g.is_active,
          evaluadores: evaluadoresSet.size,
          asignaciones: totalAsignaciones || 0,
          completadas: evalCompletadas?.length || 0,
        });
      }

      setGestiones(result);
    } catch (err) {
      console.error('Error cargando gestiones:', err);
    } finally {
      setLoading(false);
    }
  };

  const cambiarGestionActiva = async (gestionId: string) => {
    if (!supabase) return;

    setUpdating(gestionId);
    try {
      // Desactivar todas
      await supabase
        .from('gestiones')
        .update({ is_active: false })
        .neq('id', gestionId);

      // Activar la seleccionada
      await supabase
        .from('gestiones')
        .update({ is_active: true })
        .eq('id', gestionId);

      // Recargar
      await cargarGestiones();
    } catch (err) {
      console.error('Error cambiando gestión:', err);
    } finally {
      setUpdating(null);
    }
  };

  const crearGestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    if (!formData.name || !formData.start_date || !formData.end_date) {
      alert('Completa todos los campos');
      return;
    }

    setCreando(true);
    try {
      const { error } = await supabase
        .from('gestiones')
        .insert({
          name: formData.name,
          start_date: formData.start_date,
          end_date: formData.end_date,
          is_active: false,
        });

      if (error) throw error;

      setFormData({ name: '', start_date: '', end_date: '' });
      setShowModal(false);
      await cargarGestiones();
    } catch (err) {
      console.error('Error creando gestión:', err);
      alert('Error creando gestión');
    } finally {
      setCreando(false);
    }
  };

  const calcularPorcentajeAvance = (completadas: number, asignaciones: number) => {
    return asignaciones === 0 ? 0 : Math.round((completadas / asignaciones) * 100);
  };

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: '-173px 0 0 0', marginBottom: 0, fontSize: 32, fontWeight: 800 }}>GESTIONES</h2>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: '#0ea5e9',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#0284c7';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#0ea5e9';
          }}
        >
          + Nueva Gestión
        </button>
      </div>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !creando && setShowModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 32,
              width: '100%',
              maxWidth: 400,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 700 }}>Nueva Gestión</h3>

            <form onSubmit={crearGestion} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                  Nombre (ej: 2026)
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="2026"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(15,23,42,0.1)',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                  disabled={creando}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(15,23,42,0.1)',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                  disabled={creando}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                  Fecha Fin
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(15,23,42,0.1)',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                  disabled={creando}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => !creando && setShowModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 6,
                    border: '1px solid rgba(15,23,42,0.1)',
                    background: '#fff',
                    fontWeight: 600,
                    cursor: creando ? 'not-allowed' : 'pointer',
                    opacity: creando ? 0.5 : 1,
                  }}
                  disabled={creando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#0ea5e9',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: creando ? 'not-allowed' : 'pointer',
                    opacity: creando ? 0.7 : 1,
                  }}
                  disabled={creando}
                >
                  {creando ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(15,23,42,0.6)' }}>
            Cargando gestiones...
          </div>
        ) : gestiones.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(15,23,42,0.6)' }}>
            No hay gestiones registradas.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
            {gestiones.map((g) => {
              const porcentaje = calcularPorcentajeAvance(g.completadas, g.asignaciones);
              return (
                <div
                  key={g.id}
                  style={{
                    padding: 20,
                    border: g.is_active ? '2px solid #0ea5e9' : '1px solid rgba(15,23,42,0.04)',
                    borderRadius: 12,
                    background: g.is_active ? '#f0f9ff' : '#fff',
                    boxShadow: g.is_active ? '0 0 0 1px #0ea5e9' : '0 6px 18px rgba(2,6,23,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 800 }}>{g.name}</h3>
                      <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.6)' }}>
                        {g.start_date} → {g.end_date}
                      </div>
                    </div>
                    {g.is_active && (
                      <div
                        style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: 6,
                          background: '#dbeafe',
                          color: '#0369a1',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        Activa
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e40af' }}>{g.evaluadores}</div>
                        <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.6)', marginTop: 4 }}>Evaluadores</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed' }}>{g.asignaciones}</div>
                        <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.6)', marginTop: 4 }}>Asignaciones</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#059669' }}>{g.completadas}</div>
                        <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.6)', marginTop: 4 }}>Completadas</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Avance</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#0ea5e9' }}>{porcentaje}%</span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: 6,
                        background: 'rgba(15,23,42,0.08)',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${porcentaje}%`,
                          background: 'linear-gradient(90deg, #60a5fa, #0ea5e9)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>

                  {!g.is_active && (
                    <button
                      onClick={() => cambiarGestionActiva(g.id)}
                      disabled={updating === g.id}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#0ea5e9',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: updating === g.id ? 'not-allowed' : 'pointer',
                        opacity: updating === g.id ? 0.6 : 1,
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (updating !== g.id) {
                          e.currentTarget.style.background = '#0284c7';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#0ea5e9';
                      }}
                    >
                      {updating === g.id ? 'Cambiando...' : 'Cambiar a esta gestión'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
