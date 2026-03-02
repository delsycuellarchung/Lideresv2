'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function EnviarFormularioPage() {
  const router = useRouter();
  const [evaluators, setEvaluators] = React.useState<any[]>([]);
  const [selectedEvaluators, setSelectedEvaluators] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingEvaluators, setLoadingEvaluators] = React.useState(true);
  const [message, setMessage] = React.useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });
  const [results, setResults] = React.useState<any>(null);
  const [testEmail, setTestEmail] = React.useState<string>('');
  const [useTestEmail, setUseTestEmail] = React.useState(false);
  const [useImportOrder, setUseImportOrder] = React.useState(true);

  React.useEffect(() => {
    loadEvaluators();
  }, []);

  const loadEvaluators = async () => {
    try {
      const disableDb = String(process.env.NEXT_PUBLIC_DISABLE_DB || '').toLowerCase() === 'true';
      
      if (!supabase || disableDb) {
        // Simulación con datos de ejemplo
        setEvaluators([
          { id: '1', nombre_evaluador: 'Juan Pérez', correo: 'juan@example.com' },
          { id: '2', nombre_evaluador: 'María García', correo: 'maria@example.com' },
          { id: '3', nombre_evaluador: 'Carlos López', correo: 'carlos@example.com' },
        ]);
        setLoadingEvaluators(false);
        return;
      }

      const evaluatorsMap = new Map<string, any>();
      let evalData: any[] | null = null;
      let evalError: any = null;
      try {
        const res = await supabase
          .from('evaluators')
          .select('*')
          .order('row_index', { ascending: true })
          .limit(10000);
        evalData = res.data as any[] | null;
        evalError = res.error;
      } catch (e) {
        const res2 = await supabase.from('evaluators').select('*').limit(10000);
        evalData = res2.data as any[] | null;
        evalError = res2.error;
      }

      if (!evalError && Array.isArray(evalData) && evalData.length > 0) {
        evalData.forEach((e: any) => {
          evaluatorsMap.set(e.correo_evaluador || e.id, {
            ...e,
            correo: e.correo_evaluador,
          });
        });
      }
      const { data: personasData, error: personasError } = await supabase
        .from('personas')
        .select('id, nombre, correo, codigo')
        .eq('tipo', 'evaluador')
        .limit(1000);

      if (!personasError && Array.isArray(personasData)) {
        personasData.forEach((p: any) => {
          if (!evaluatorsMap.has(p.correo || p.id)) {
            evaluatorsMap.set(p.correo || p.id, {
              ...p,
              nombre_evaluador: p.nombre,
              correo: p.correo,
            });
          }
        });
      }

      const allEvaluators = Array.from(evaluatorsMap.values());
      
      if (allEvaluators.length === 0) {
        setMessage({ type: 'error', text: 'No hay evaluadores disponibles' });
      }
      
      setEvaluators(allEvaluators);
    } catch (error) {
      console.error('Error loading evaluators:', error);
      setMessage({ type: 'error', text: 'Error cargando evaluadores' });
    } finally {
      setLoadingEvaluators(false);
    }
  };

  const handleSelectEvaluator = (id: string) => {
    setSelectedEvaluators((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedEvaluators.length === evaluators.length) {
      setSelectedEvaluators([]);
    } else {
      setSelectedEvaluators(evaluators.map((e) => e.id));
    }
  };

  const sendForms = async () => {
    if (selectedEvaluators.length === 0 && (!useTestEmail || !testEmail.trim())) {
      setMessage({ type: 'error', text: 'Por favor selecciona al menos un evaluador o usa un correo de prueba' });
      return;
    }

    if (useTestEmail && !testEmail.trim()) {
      setMessage({ type: 'error', text: 'Por favor ingresa un correo de prueba válido' });
      return;
    }

    setLoading(true);
    setMessage({ type: null, text: '' });

    try {
      let selectedData = evaluators.filter((e) => selectedEvaluators.includes(e.id));

      // Si el usuario pidió usar el orden de importación, ordenar por `row_index` (fallback por id)
      if (useImportOrder) {
        selectedData = selectedData.slice().sort((a: any, b: any) => {
          const ai = (a.row_index ?? Number.MAX_SAFE_INTEGER);
          const bi = (b.row_index ?? Number.MAX_SAFE_INTEGER);
          if (ai !== bi) return ai - bi;
          return String(a.id).localeCompare(String(b.id));
        });
      }

      // Si estamos usando correo de prueba, agregar un evaluador temporal
      if (useTestEmail && testEmail.trim()) {
        selectedData = [{
          id: `test-${Date.now()}`,
          nombre_evaluador: 'Prueba',
          correo: testEmail.trim(),
          nombre_evaluado: 'Test',
          cargo_evaluado: 'Test',
        }];
      }

      const formData = {
        competencias: JSON.parse(localStorage.getItem('formulario_competencias') || '[]'),
        estilos: JSON.parse(localStorage.getItem('formulario_estilos') || '[]'),
        afirmaciones: JSON.parse(localStorage.getItem('formulario_afirmaciones') || '[]'),
        instrucciones: JSON.parse(localStorage.getItem('formulario_instrucciones') || '[]'),
      };

      const response = await fetch('/api/send-forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          evaluators: selectedData,
          formData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error enviando formularios');
      }

      setResults(data);
      setMessage({
        type: 'success',
        text: `✓ ${data.successCount} formularios enviados exitosamente${data.failureCount > 0 ? ` (${data.failureCount} errores)` : ''}`,
      });
      setSelectedEvaluators([]);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error enviando formularios' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', padding: '20px 12px 40px 12px', background: 'transparent' }}>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        <style>{`
          .deselect-btn {
            transition: transform .16s ease, box-shadow .16s ease, opacity .16s ease, background .12s ease;
            will-change: transform, box-shadow;
          }
          .deselect-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(99,102,241,0.10);
            background: #4f46e5; /* darker purple on hover */
            opacity: 1;
          }
          .deselect-btn:active { transform: translateY(-1px); }
        `}</style>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0F172A', margin: '-80px 0 8px 0' }}>
            ENVIAR FORMULARIO
          </h1>
        </div>

        {/* Test Email Section */}
        <div style={{ marginBottom: 32, padding: 20, backgroundColor: '#fef3c7', borderRadius: 12, border: '1px solid #fcd34d' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={useTestEmail}
              onChange={(e) => setUseTestEmail(e.target.checked)}
              style={{ width: 20, height: 20, cursor: 'pointer', accentColor: '#d97706' }}
            />
            <span style={{ fontWeight: 600, color: '#92400e' }}>🧪 Usar correo de prueba (temporal)</span>
          </label>
          {useTestEmail && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="tu-correo@gmail.com"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '1px solid #fcd34d',
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: 'Arial, sans-serif',
                  boxSizing: 'border-box'
                }}
              />
              <button
                onClick={sendForms}
                disabled={loading || !testEmail.trim()}
                style={{
                  padding: '10px 24px',
                  background: loading || !testEmail.trim() ? '#ccc' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: loading || !testEmail.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
                  whiteSpace: 'nowrap',
                }}
              >
                {loading ? 'Enviando...' : '🧪 Enviar'}
              </button>
            </div>
          )}
        </div>

        {/* Import Order Preview & Controls (new) */}
        <div style={{ marginBottom: 32, padding: 20, backgroundColor: '#eef2ff', borderRadius: 12, border: '1px solid #c7d2fe' }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 18 }}>Selecciona a tus evaluadores</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ color: '#374151', fontSize: 13 }}>Total evaluadores: <strong>{evaluators.length}</strong></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="deselect-btn"
                onClick={() => {
                  // Select all in import order
                  const ids = evaluators.slice().sort((a: any, b: any) => {
                    const ai = (a.row_index ?? Number.MAX_SAFE_INTEGER);
                    const bi = (b.row_index ?? Number.MAX_SAFE_INTEGER);
                    if (ai !== bi) return ai - bi;
                    return String(a.id).localeCompare(String(b.id));
                  }).map((e: any) => e.id);
                  setSelectedEvaluators(ids);
                }}
                style={{ padding: '8px 12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >Seleccionar todo</button>

              <button
                onClick={() => setSelectedEvaluators([])}
                className="deselect-btn"
                style={{ padding: '8px 12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >Deseleccionar</button>

              <button
                onClick={sendForms}
                disabled={loading || selectedEvaluators.length === 0}
                style={{ padding: '8px 12px', background: selectedEvaluators.length === 0 ? '#ccc' : 'linear-gradient(135deg,#10b981 0%,#059669 100%)', color: 'white', border: 'none', borderRadius: 8, cursor: selectedEvaluators.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 700 }}
              >{loading ? 'Enviando...' : 'Enviar seleccionados'}</button>
            </div>
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto', borderRadius: 8, border: '1px solid rgba(99,102,241,0.06)', background: '#fff', padding: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                  <th style={{ padding: '8px 6px', width: 60 }}>#</th>
                  <th style={{ padding: '8px 6px' }}>Evaluador</th>
                  <th style={{ padding: '8px 6px', width: 220 }}>Correo</th>
                  <th style={{ padding: '8px 6px' }}>Evaluado</th>
                </tr>
              </thead>
              <tbody>
                {evaluators.map((ev: any, i: number) => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.03)' }}>
                    <td style={{ padding: '8px 6px', color: '#4b5563' }}>{String(ev.row_index ?? i)}</td>
                    <td style={{ padding: '8px 6px', color: '#0f172a', fontWeight: 600 }}>{ev.nombre_evaluador || ev.nombre}</td>
                    <td style={{ padding: '8px 6px', color: ev.correo ? '#065f46' : '#b91c1c' }}>{ev.correo || ev.correo_evaluador || '-'}</td>
                    <td style={{ padding: '8px 6px', color: '#374151' }}>{ev.nombre_evaluado || ev.nombre_alt || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {message.text && (
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              marginBottom: 24,
              border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 107, 107, 0.2)'}`,
              background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 107, 107, 0.1)',
              color: message.type === 'success' ? '#16A34A' : '#FF6B6B',
            }}
          >
            {message.text}
          </div>
        )}

        {/* Results detail panel removed per request */}
      </div>
    </div>
  );
}
