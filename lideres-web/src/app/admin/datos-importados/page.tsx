"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

// Clave para intentar obtener datos importados desde localStorage
const LOCAL_IMPORT_DATA_KEY = "local_import_data";

// Tipo usado para representar tanto evaluadores como evaluados
type Persona = {
  id: string;
  codigo: string;
  nombre: string;
  cargo: string | null;
  correo: string | null;
  area_nombre: string | null;
  gerencia_nombre: string | null;
  regional: string | null;
  tipo: string;
  // Campos alternativos (por ejemplo, cuando la fila contiene datos mezclados)
  codigo_alt?: string | null;
  nombre_alt?: string | null;
  correo_alt?: string | null;
  area_alt?: string | null;
  gerencia_alt?: string | null;
};

// Fila genérica recibida desde la importación (csv/hoja)
type RawRow = Record<string, unknown>;
type ImportLastResponse = { rows?: RawRow[] };

// Helper: devuelve el primer valor no vacío entre una lista de keys
// Útil para manejar cabeceras con variantes (acentos, mayúsculas, etc.).
const getFirstValue = (row: RawRow, keys: string[]): string | null => {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null || value === '') continue;
    return String(value);
  }
  return null;
};

// Normaliza cadenas para búsquedas: quita diacríticos y pasa a minúsculas.
const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

// Página principal que muestra los datos importados.
// Funcionalidades principales:
// - Cargar filas importadas desde `localStorage`, endpoint `/api/import-last` o Supabase
// - Extraer listas de `evaluados` y `evaluadores`
// - Buscar y filtrar por estado de envío (pendiente/completado)
export default function DatosImportadosPage() {
  // Tab activo: importados (evaluado), otra (evaluador) o evaluaciones
  const [tab, setTab] = useState<"importados" | "otra" | "evaluaciones">("importados");
  const [evaluados, setEvaluados] = useState<Persona[]>([]);
  const [evaluadores, setEvaluadores] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [evalFilter, setEvalFilter] = useState<'all'|'pending'|'completed'>('all');
  // Mapa email -> status ('pending' | 'completed') para mostrar en la pestaña Evaluaciones
  const [submissionStatus, setSubmissionStatus] = useState<Record<string, string>>({});
  const disableDb = String(process.env.NEXT_PUBLIC_DISABLE_DB || '').toLowerCase() === 'true';
  
  // Cargar datos al montar el componente
  useEffect(() => {
    cargarDatos();
  }, []);
  
  // Función que centraliza la carga de datos.
  // Ahora FORZAMOS que los datos provengan únicamente de la base de datos.
  // Si `supabase` no está disponible o `NEXT_PUBLIC_DISABLE_DB` está activo,
  // la función devolverá listas vacías y registrará un error.
  const cargarDatos = async () => {
    setLoading(true);

    // Requerimos el cliente de Supabase y que no esté explícitamente deshabilitado
    if (!supabase) {
      console.error('Supabase client no disponible — Datos importados necesita la base de datos.');
      setEvaluados([]);
      setEvaluadores([]);
      setLoading(false);
      return;
    }
    if (disableDb) {
      console.error('NEXT_PUBLIC_DISABLE_DB=true — Datos importados requiere la base de datos activa.');
      setEvaluados([]);
      setEvaluadores([]);
      setLoading(false);
      return;
    }

    // Camino con Supabase: consultar la tabla `evaluators` y convertirla
    // a las estructuras que usa la UI.
    let evaluatorsData: any[] | null = null;
    let evalError: any = null;
    try {
      // Intentamos ordenar por `row_index` si existe (mantener el orden de importación)
      const res = await supabase.from('evaluators').select('*').order('row_index', { ascending: true }).limit(10000);
      evaluatorsData = res.data as any[] | null;
      evalError = res.error;
    } catch (e) {
      // Fallback: intentar sin ordenar
      const res2 = await supabase.from('evaluators').select('*').limit(10000);
      evaluatorsData = res2.data as any[] | null;
      evalError = res2.error;
    }
    
    if (evalError) {
      console.error('Error cargando evaluators:', evalError);
    }
    
    if (evaluatorsData) {
      const evaluados: Persona[] = [];
      const evaluadores: Persona[] = [];
      
      evaluatorsData.forEach((row: any, idx: number) => {
        // Si la fila contiene datos de evaluado, los añadimos
        if (row.codigo_evaluado && row.nombre_evaluado) {
          evaluados.push({
            id: `evaluado-${idx}`,
            codigo: row.codigo_evaluado || '',
            nombre: row.nombre_evaluado || '',
            cargo: row.cargo_evaluado || null,
            correo: row.correo_evaluado || null,
            area_nombre: row.area_evaluado || null,
            gerencia_nombre: row.gerencia_evaluado || null,
            regional: row.regional_evaluado || row['Regional del Evaluado'] || row['Regional Evaluado'] || row.regional || null,
            tipo: 'evaluado',
            codigo_alt: null,
            nombre_alt: null,
            correo_alt: null,
            area_alt: null,
            gerencia_alt: null,
          });
        }
        
        // Si la fila contiene datos de evaluador, los añadimos
        if (row.codigo_evaluador && row.nombre_evaluador) {
          evaluadores.push({
            id: `evaluador-${idx}`,
            codigo: row.codigo_evaluador || '',
            nombre: row.nombre_evaluador || '',
            cargo: row.cargo_evaluador || null,
            correo: row.correo_evaluador || null,
            area_nombre: row.area_evaluador || null,
            gerencia_nombre: row.gerencia_evaluador || null,
            regional: row.regional_evaluador || row['Regional del Evaluador'] || row['Regional Evaluador'] || row.regional || null,
            tipo: 'evaluador',
            codigo_alt: row.codigo_evaluado || null,
            nombre_alt: row.nombre_evaluado || null,
            correo_alt: row.correo_evaluado || null,
            area_alt: row.area_evaluado || null,
            gerencia_alt: row.gerencia_evaluado || null,
          });
        }
      });
      
      setEvaluados(evaluados);
      setEvaluadores(evaluadores);

      // Intentar cargar el estado de las respuestas (si la DB está disponible)
      try {
        if (supabase && !disableDb) {
          const emails = evaluadores.map(e => e.correo).filter(Boolean) as string[];
          const codes = evaluadores.map(e => e.codigo).filter(Boolean) as string[];
          const { data: subs } = await supabase
            .from('form_submissions')
            .select('evaluator_email,status')
            .or(emails.map(em => `evaluator_email.eq.${em}`).join(','))
            .limit(10000);
          const map: Record<string,string> = {};
          if (Array.isArray(subs)) {
            subs.forEach((s: any) => {
              const key = (s.evaluator_email || '').toLowerCase();
              if (!key) return;
              // Priorizar 'completed' si existe
              if (!map[key] || map[key] !== 'completed') {
                map[key] = s.status || 'pending';
              }
            });
          }
          setSubmissionStatus(map);
        } else {
          // Si no hay DB, marcar todos como 'pending' por defecto
          const map: Record<string,string> = {};
          evaluadores.forEach(e => { if (e.correo) map[e.correo.toLowerCase()] = 'pending'; });
          setSubmissionStatus(map);
        }
      } catch (sErr) {
        console.warn('Could not load submission statuses', sErr);
      }
    }
    
    setLoading(false);
  };

  // Preparar tokens de búsqueda normalizados
  const normalizedSearch = normalizeText(searchText.trim());
  const searchTokens = normalizedSearch.split(/\s+/).filter(Boolean);

  // Función que verifica si una persona coincide con los tokens de búsqueda
  const matchesSearch = (persona: Persona) => {
    if (searchTokens.length === 0) return true;
    // Excluir tokens que expresan estado (pendiente/completado) para el filtro de texto
    const effectiveTokens = searchTokens.filter(t => !/pend|pendiente|pendientes|pending|comp|complet|completado|completed/.test(t));
    if (effectiveTokens.length === 0) return true; 
    const nameParts = (persona.nombre || '').split(/\s+/).filter(Boolean);
    const correo = (persona.correo || '').toLowerCase();
    const correoLocal = correo.split('@')[0] || '';
    const correoDomain = correo.split('@')[1] || '';

    const values = [
      persona.codigo,
      persona.nombre,
      persona.cargo,
      persona.correo,
      persona.area_nombre,
      persona.gerencia_nombre,
      persona.regional,
      persona.codigo_alt,
      persona.nombre_alt,
      persona.correo_alt,
      persona.area_alt,
      persona.gerencia_alt,
      persona.tipo,
      ...nameParts,
      correoLocal,
      correoDomain,
    ]
      .filter((value) => value !== null && value !== undefined)
      .map((value) => normalizeText(String(value)));

    return effectiveTokens.every((token) => values.some((value) => value.includes(token)));
  };

  // Detectar token de estado en la búsqueda (pendiente/completado)
  const statusToken = searchTokens.find(t => /pend|pendiente|pendientes|pending|comp|complet|completado|completed/.test(t));
  const statusTokenDesired: 'pending' | 'completed' | null = statusToken
    ? (/comp|complet|completed/.test(statusToken) ? 'completed' : 'pending')
    : null;

  const filteredEvaluados = evaluados.filter(matchesSearch);
  const filteredEvaluadores = evaluadores.filter(matchesSearch);

  // Si estamos en la pestaña 'evaluaciones' aplicamos filtros por estado
  const displayEvaluadores = tab === 'evaluaciones'
    ? filteredEvaluadores.filter((ev) => {
        const status = submissionStatus[(ev.correo || '').toLowerCase()] || 'pending';
        if (statusTokenDesired) {
          if (status !== statusTokenDesired) return false;
        }
        if (evalFilter === 'all') return true;
        return evalFilter === 'completed' ? status === 'completed' : status !== 'completed';
      })
    : filteredEvaluadores;

  // Pequeño helper para renderizar la etiqueta de estado
  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      pending: { bg: 'rgba(245, 158, 11, 0.08)', text: '#F59E0B' },
      completed: { bg: 'rgba(34, 197, 94, 0.08)', text: '#16A34A' },
    };
    const color = colors[status] || colors.pending;
    const label = status === 'completed' ? 'Completado' : 'Pendiente';
    return (
      <span style={{ padding: '6px 12px', borderRadius: 6, fontWeight: 600, fontSize: 12, background: color.bg, color: color.text }}>
        {label}
      </span>
    );
  };

  // Render: header con búsqueda, tabs y la tabla correspondiente según la pestaña activa
  return (
    <div style={{ padding: 28, transform: 'translateY(-20px)' }}>
      <div className="page-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
        <h2 style={{ margin: '0 0 0 0', fontSize: 32, fontWeight: 800, transform: 'translateY(-70px)' }}>DATOS IMPORTADOS</h2>

        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start', paddingLeft: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Buscar en cualquier columna"
              aria-label="Buscar en cualquier columna"
              style={{
                height: 40,
                padding: '0 12px',
                borderRadius: 10,
                border: '1px solid rgba(15,23,42,0.2)',
                background: '#fff',
                minWidth: 260,
              }}
            />
            <div className="tabs" role="tablist" aria-label="Tablas de datos" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                role="tab"
                aria-selected={tab === "importados"}
                className={`tab-btn ${tab === "importados" ? "active" : ""}`}
                onClick={() => setTab("importados")}
                style={{ height: 40 }}
              >
                Evaluado
              </button>
              <button
                role="tab"
                aria-selected={tab === "otra"}
                className={`tab-btn ${tab === "otra" ? "active" : ""}`}
                onClick={() => setTab("otra")}
                style={{ height: 40 }}
              >
                Evaluador
              </button>
              <button
                role="tab"
                aria-selected={tab === "evaluaciones"}
                className={`tab-btn ${tab === "evaluaciones" ? "active" : ""}`}
                onClick={() => setTab("evaluaciones")}
                style={{ height: 40 }}
              >
                Evaluaciones
              </button>
            </div>
            {tab === 'evaluaciones' && (
              <div style={{ display: 'flex', gap: 8, marginLeft: 12, alignItems: 'center' }}>
                <button
                  className={`tab-btn ${evalFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setEvalFilter('all')}
                  style={{ height: 36, padding: '6px 10px' }}
                >
                  Todos
                </button>
                <button
                  className={`tab-btn ${evalFilter === 'pending' ? 'active' : ''}`}
                  onClick={() => setEvalFilter('pending')}
                  style={{ height: 36, padding: '6px 10px' }}
                >
                  Pendientes
                </button>
                <button
                  className={`tab-btn ${evalFilter === 'completed' ? 'active' : ''}`}
                  onClick={() => setEvalFilter('completed')}
                  style={{ height: 36, padding: '6px 10px' }}
                >
                  Completados
                </button>
              </div>
            )}
            <button
              onClick={cargarDatos}
              className="btn-press"
              style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 0, display: 'inline-flex', alignItems: 'center', gap: 10, height: 40 }}
              aria-label="Recargar datos"
            >
              <img src="/images/recargar.png" alt="recargar" style={{ width: 18, height: 18, display: 'block' }} />
              <span style={{ fontWeight: 600 }}>Recargar</span>
            </button>
          </div>
        </div>
      </div>
      {tab === "importados" ? (
        <table className="import-table" aria-label="Tabla de datos importados" style={{ margin: '16px 0 24px 0' }}>
          <thead>
            <tr>
              <th>Código del Evaluado</th>
              <th>Nombre del Evaluado</th>
              <th>Cargo del Evaluado</th>
              <th>Correo del Evaluado</th>
              <th>Área del Evaluado</th>
              <th>Gerencia del Evaluado</th>
              <th>Regional del Evaluado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 12, textAlign: 'center' }}>
                  Cargando...
                </td>
              </tr>
            ) : filteredEvaluados.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 12, color: "rgba(15,23,42,0.6)" }}>
                  {searchTokens.length > 0 ? 'No hay resultados.' : 'No hay datos importados.'}
                </td>
              </tr>
            ) : (
              filteredEvaluados.map((evaluado) => (
                <tr key={evaluado.id}>
                  <td>{evaluado.codigo}</td>
                  <td>{evaluado.nombre}</td>
                  <td>{evaluado.cargo || '-'}</td>
                  <td>{evaluado.correo || '-'}</td>
                  <td>{evaluado.area_nombre || '-'}</td>
                  <td>{evaluado.gerencia_nombre || '-'}</td>
                  <td>{evaluado.regional || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : tab === "otra" ? (
        <table className="import-table" aria-label="Tabla adicional de datos" style={{ margin: '16px 0 24px 0' }}>
          <thead>
            <tr>
              <th>Código del Evaluador</th>
              <th>Nombre del Evaluador</th>
              <th>Cargo del Evaluador</th>
              <th>Correo del Evaluador</th>
              <th>Área del Evaluador</th>
              <th>Gerencia del Evaluador</th>
              <th>Regional del Evaluador</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 12, textAlign: 'center' }}>
                  Cargando...
                </td>
              </tr>
            ) : filteredEvaluadores.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 12, color: "rgba(15,23,42,0.6)" }}>
                  {searchTokens.length > 0 ? 'No hay resultados.' : 'No hay datos en esta tabla.'}
                </td>
              </tr>
            ) : (
              filteredEvaluadores.map((evaluador) => (
                <tr key={evaluador.id}>
                  <td>{evaluador.codigo}</td>
                  <td>{evaluador.nombre}</td>
                  <td>{evaluador.cargo || '-'}</td>
                  <td>{evaluador.correo || '-'}</td>
                  <td>{evaluador.area_nombre || '-'}</td>
                  <td>{evaluador.gerencia_nombre || '-'}</td>
                  <td>{evaluador.regional || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : (
        <table className="import-table" aria-label="Tabla de evaluaciones" style={{ margin: '16px 0 24px 0' }}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Apellido</th>
              <th>Área</th>
              <th>Correo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
              {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 12, textAlign: 'center' }}>
                  Cargando...
                </td>
              </tr>
            ) : displayEvaluadores.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 12, color: "rgba(15,23,42,0.6)" }}>
                  {searchTokens.length > 0 ? 'No hay resultados.' : 'No hay evaluadores importados.'}
                </td>
              </tr>
            ) : (
              displayEvaluadores.map((ev) => {
                const status = submissionStatus[(ev.correo || '').toLowerCase()] || 'pending';
                const nameParts = (ev.nombre || '').split(' ');
                const firstName = nameParts.slice(0, 1).join(' ');
                const lastName = nameParts.slice(1).join(' ');
                return (
                  <tr key={`eval-${ev.id}`}>
                    <td>{ev.codigo}</td>
                    <td>{firstName}</td>
                    <td>{lastName || '-'}</td>
                    <td>{ev.area_nombre || '-'}</td>
                    <td>{ev.correo || '-'}</td>
                    <td>{getStatusBadge(status)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
