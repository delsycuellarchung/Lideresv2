"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function FormularioPublicPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string | undefined;

  const [items, setItems] = React.useState<any[]>([]);
  const [instrucciones, setInstrucciones] = React.useState<{ etiqueta: string; descripcion?: string }[]>([]);
  const [responses, setResponses] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = React.useState(false);
  const [evaluatorName, setEvaluatorName] = React.useState<string>('');
  const [validationError, setValidationError] = React.useState<string>('');

  React.useEffect(() => {
    if (!token) return;

    // Load form data from localStorage (in a real scenario, fetch from API)
    try {
      const raw = localStorage.getItem('formulario_afirmaciones');
      if (raw) setItems(JSON.parse(raw));
      const rawI = localStorage.getItem('formulario_instrucciones');
      if (rawI) setInstrucciones(JSON.parse(rawI));

      // Recuperar respuestas guardadas para este token
      const savedResponses = localStorage.getItem(`form_responses_${token}`);
      if (savedResponses) {
        setResponses(JSON.parse(savedResponses));
        console.log('✅ Respuestas recuperadas del guardado anterior');
      }

      // In production, fetch evaluator info from API using token
      setEvaluatorName('Evaluador');
    } catch (e) {
      console.warn(e);
    }
  }, [token]);

  // Guardar respuestas en localStorage cuando cambien (con debounce)
  React.useEffect(() => {
    if (!token || Object.keys(responses).length === 0) return;

    const timeoutId = setTimeout(() => {
      localStorage.setItem(`form_responses_${token}`, JSON.stringify(responses));
      console.log('💾 Respuestas guardadas automáticamente');
    }, 1000); // Guardar después de 1 segundo sin cambios

    return () => clearTimeout(timeoutId);
  }, [responses, token]);

  const determineTipoCategory = (tipoVal?: string | null) => {
    if (!tipoVal) return 'unknown';
    if (tipoVal.toLowerCase().includes('estilo')) return 'estilo';
    return 'competencia';
  };

  const grouped = React.useMemo(() => {
    const comp: any[] = [];
    const est: any[] = [];
    (items || []).forEach((it) => {
      const cat = determineTipoCategory(it.tipo || null);
      if (cat === 'estilo') {
        est.push(it);
      } else if (cat === 'competencia') {
        comp.push(it);
      }
    });
    return { competencias: comp, estilos: est };
  }, [items]);

  const allQuestions = React.useMemo(() => {
    const competencias = grouped.competencias.map((it: any, idx: number) => ({
      key: `comp-${idx}`,
      question: it.pregunta || 'Pregunta no disponible',
    }));
    const estilos = grouped.estilos.map((it: any, idx: number) => ({
      key: `est-${idx}`,
      question: it.pregunta || 'Pregunta no disponible',
    }));
    return [...competencias, ...estilos];
  }, [grouped]);
  const handleChange = (key: string, value: string) => {
    setResponses((prev) => ({ ...prev, [key]: value }));
  };

  const validateResponses = () => {
    const missingQuestions: number[] = [];
    allQuestions.forEach((question, idx) => {
      if (!responses[question.key]) {
        missingQuestions.push(idx + 1);
      }
    });
    return missingQuestions;
  };

  const submit = async () => {
    const missing = validateResponses();
    if (missing.length > 0) {
      setValidationError(`Debes responder las preguntas: ${missing.join(', ')}`);
      setTimeout(() => setValidationError(''), 5000);
      return;
    }

    setLoading(true);
    try {
      const id = `resp_${Date.now()}`;

      // try to fetch evaluado info from supabase form_submissions by token
      let evaluadoNombre: string | null = null;
      let evaluadoCodigo: string | null = null;
      try {
        if (supabase && token) {
          const { data, error } = await supabase.from('form_submissions').select('responses, form_data').eq('token', token).single();
          if (!error && data) {
            const resp = (data as any).responses || {};
            const fd = (data as any).form_data || {};
            evaluadoNombre = resp.evaluado_nombre || fd.evaluado_nombre || null;
            evaluadoCodigo = resp.evaluado_codigo || fd.evaluado_codigo || fd.codigo || null;
          }
        }
      } catch (e) {
        console.warn('Aviso: no se pudo obtener info del evaluado desde Supabase', e);
      }

      const raw = localStorage.getItem('form_responses') || '[]';
      const arr = JSON.parse(raw);
      const responseData: any = { id, createdAt: new Date().toISOString(), responses, token, evaluatorName };
      if (evaluadoNombre) responseData.evaluadoNombre = evaluadoNombre;
      if (evaluadoCodigo) responseData.evaluadoCodigo = evaluadoCodigo;
      arr.push(responseData);
      localStorage.setItem('form_responses', JSON.stringify(arr));
      console.log('✅ Respuestas guardadas en localStorage:', responseData);

      // Actualizar estado en Supabase si está disponible — incluir evaluado info dentro de responses para persistencia
      try {
        const payloadResponses = { ...responses } as any;
        if (evaluadoNombre) payloadResponses.evaluado_nombre = evaluadoNombre;
        if (evaluadoCodigo) payloadResponses.evaluado_codigo = evaluadoCodigo;

        const { error } = await fetch('/api/update-submission-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            status: 'completed',
            completedAt: new Date().toISOString(),
            responses: payloadResponses
          })
        }).then(r => r.json());

        if (error) console.warn('Aviso: No se pudo actualizar estado en Supabase', error);
      } catch (e) {
        console.warn('Aviso: Error actualizando Supabase:', e);
      }

      // Además, intentar insertar cada envío en `form_responses` (no destructivo)
      try {
        await fetch('/api/insert-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            evaluatorName,
            evaluadoNombre,
            evaluadoCodigo,
            responses
          })
        }).then(res => res.json()).then((r) => {
          if (r && r.error) console.warn('Aviso: insert-response API retornó error:', r.error);
          else console.log('✅ Insert-response API result:', r);
        }).catch(err => console.warn('Aviso: error calling insert-response API', err));
      } catch (e) {
        console.warn('Aviso: Error llamando a insert-response API', e);
      }

      // Limpiar respuestas guardadas y resetear formulario después de envío exitoso
      localStorage.removeItem(`form_responses_${token}`);
      setResponses({});
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 3000);
    } catch (e) {
      console.error('❌ Error guardando respuestas:', e);
      setError('Error guardando respuestas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f4ff 0%, #f8f9ff 100%)', padding: '20px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Card Container */}
        <div style={{ background: '#f8f9ff', borderRadius: 12, boxShadow: '0 8px 32px rgba(2, 6, 23, 0.06)', padding: '28px', border: '1px solid rgba(79, 70, 229, 0.1)' }}>
          {/* Header */}
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0', letterSpacing: '0.5px' }}>Formulario de evaluación</h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0, fontWeight: 500 }}>Evaluado: <span style={{ color: '#0F172A', fontWeight: 700 }}>{evaluatorName || 'Nombre no disponible'}</span></p>
          </div>

          {/* Form Content */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginTop: 8 }}>
                  {instrucciones.length === 0 ? (
                    <div style={{ color: 'rgba(15,23,42,0.6)', fontSize: 14, padding: '8px 0' }}>No hay instrucciones disponibles.</div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `minmax(500px, 1fr) repeat(${instrucciones.length}, minmax(90px, 120px))`,
                      gap: 8,
                      alignItems: 'flex-end',
                      marginBottom: 12,
                      paddingBottom: 8,
                      borderBottom: '1px solid rgba(239, 68, 68, 0.2)'
                    }}>
                      <div></div>
                      {instrucciones.map((ins, i) => (
                        <div key={`head-${i}`} style={{ textAlign: 'left', padding: '0 4px', maxWidth: 140, wordBreak: 'break-word', whiteSpace: 'normal', display: 'flex', flexDirection: 'column', height: '100%' }}>
                          {ins.descripcion ? (
                            <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.55)', marginBottom: 2, lineHeight: '1.1', hyphens: 'auto', flex: 1, display: 'flex', alignItems: 'center' }}>{ins.descripcion}</div>
                          ) : null}
                          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 12 }}>{ins.etiqueta}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {allQuestions.map((it, idx) => (
                    <div
                      key={it.key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `minmax(500px, 1fr) repeat(${Math.max(instrucciones.length, 1)}, minmax(90px, 120px))`,
                        gap: 8,
                        alignItems: 'center',
                        padding: '4px 8px',
                        marginBottom: 0,
                        borderRadius: 6
                      }}
                    >
                      <div style={{ fontWeight: 400, color: '#0F172A', fontSize: 13, lineHeight: '1.4', wordBreak: 'break-word', whiteSpace: 'normal' }}>{idx + 1}. {it.question}</div>
                      {instrucciones.map((ins, i) => {
                        const selected = responses[it.key] === ins.etiqueta;
                        return (
                          <label
                            key={`${it.key}-opt-${i}`}
                            style={{
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              cursor: 'pointer',
                              padding: 6,
                              borderRadius: 9999,
                              background: 'transparent',
                              boxShadow: selected ? '0 6px 20px rgba(79,70,229,0.08)' : 'none',
                              transition: 'box-shadow 0.15s, transform 0.12s'
                            }}
                          >
                            <input
                              type="radio"
                              name={it.key}
                              value={ins.etiqueta}
                              checked={selected}
                              onChange={() => handleChange(it.key, ins.etiqueta)}
                              style={{ width: 20, height: 20, cursor: 'pointer', accentColor: '#4F46E5', transition: 'transform 0.12s', transform: selected ? 'scale(1.08)' : 'scale(1)' }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  ))}

              {grouped.estilos.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#0F172A', borderBottom: '1px solid rgba(239, 68, 68, 0.3)', paddingBottom: 6, display: 'inline-block' }}>
                    Estilos de Liderazgo
                  </h3>
                  <div style={{ marginTop: 12 }}>
                    {instrucciones.length === 0 ? (
                      <div style={{ color: 'rgba(15,23,42,0.6)', fontSize: 14, padding: '8px 0' }}>No hay instrucciones disponibles.</div>
                    ) : (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: `minmax(500px, 1fr) repeat(${instrucciones.length}, minmax(90px, 120px))`,
                        gap: 8,
                        alignItems: 'flex-end',
                        marginBottom: 12,
                        paddingBottom: 8,
                        borderBottom: '1px solid rgba(239, 68, 68, 0.2)'
                      }}>
                        <div></div>
                        {instrucciones.map((ins, i) => (
                          <div key={`est-head-${i}`} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', height: '100%' }}>
                            {ins.descripcion ? (
                              <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.55)', marginBottom: 2, flex: 1, display: 'flex', alignItems: 'center' }}>{ins.descripcion}</div>
                            ) : null}
                            <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 12 }}>{ins.etiqueta}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {grouped.estilos.map((it: any, idx: number) => {
                      const questionNumber = grouped.competencias.length + idx + 1;
                      return (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `minmax(500px, 1fr) repeat(${Math.max(instrucciones.length, 1)}, minmax(90px, 120px))`,
                          gap: 8,
                          alignItems: 'center',
                          padding: '4px 0',
                          marginBottom: 0,
                          borderBottom: 'none'
                        }}
                      >
                        <div style={{ fontWeight: 400, color: '#0F172A', fontSize: 13, lineHeight: '1.4', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                          {questionNumber}. {it.pregunta || 'Pregunta no disponible'}
                        </div>
                        {instrucciones.map((ins, i) => {
                          const selected = responses[`est-${idx}`] === ins.etiqueta;
                          return (
                          <label
                            key={`${idx}-opt-${i}`}
                            style={{
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              cursor: 'pointer',
                              padding: 6,
                              borderRadius: 9999,
                              background: 'transparent',
                              boxShadow: selected ? '0 6px 20px rgba(79,70,229,0.08)' : 'none',
                              transition: 'box-shadow 0.15s, transform 0.12s'
                            }}
                          >
                            <input
                              type="radio"
                              name={`est-${idx}`}
                              value={ins.etiqueta}
                              checked={selected}
                              onChange={() => handleChange(`est-${idx}`, ins.etiqueta)}
                              style={{ width: 20, height: 20, cursor: 'pointer', accentColor: '#4F46E5', transition: 'transform 0.12s', transform: selected ? 'scale(1.08)' : 'scale(1)' }}
                            />
                          </label>
                          );
                        })}
                      </div>
                    );
                    })}
                  </div>
                </div>
              )}

              {validationError && (
                <div style={{
                  padding: 12,
                  marginBottom: 16,
                  backgroundColor: 'rgba(220, 38, 38, 0.1)',
                  color: '#DC2626',
                  borderRadius: 8,
                  fontSize: 14,
                  border: '1px solid rgba(220, 38, 38, 0.2)',
                  fontWeight: 500
                }}>
                  ⚠️ {validationError}
                </div>
              )}

              <div style={{ borderTop: '1px solid rgba(15,23,42,0.06)', paddingTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={submit}
                  disabled={loading}
                  style={{
                    padding: '12px 48px',
                    background: loading ? '#ccc' : 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                    transition: 'all 0.3s',
                  }}
                >
                  {loading ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSuccessModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: '40px 32px',
            maxWidth: 400,
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', margin: '0 0 12px 0' }}>¡Éxito!</h2>
            <p style={{ fontSize: 16, color: '#64748b', margin: '0 0 24px 0', lineHeight: '1.6' }}>
              Has enviado correctamente tu evaluación
            </p>
            <button
              onClick={() => setShowSuccessModal(false)}
              style={{
                padding: '12px 28px',
                background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
