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
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const [evaluatorName, setEvaluatorName] = React.useState<string>('');
  const [evaluadoName, setEvaluadoName] = React.useState<string>('');
  const [validationError, setValidationError] = React.useState<string>('');
  const [isDirty, setIsDirty] = React.useState(false);
  const [draftSavedAt, setDraftSavedAt] = React.useState<string | null>(null);
  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = React.useState<number>(0);

  React.useEffect(() => {
    if (!token) return;
    // Claim the token to prevent forwarding: POST /api/claim-submission
    (async () => {
      try {
        const resp = await fetch('/api/claim-submission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        }).then(r => r.json());
        if (resp && resp.claimed === false) {
          if (resp.reason === 'completed') {
            setError('Este formulario ya fue completado anteriormente.');
          } else {
            setError('Este enlace ya fue abierto desde otro dispositivo y no puede usarse aquí.');
          }
        }
      } catch (e) {
        console.warn('Aviso: no se pudo reclamar token', e);
      }
    })();
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

      // In production, fetch evaluator + evaluado info from Supabase using token
      const fetchInfo = async () => {
        try {
          if (supabase && token) {
            const { data, error } = await supabase.from('form_submissions').select('evaluator_name, evaluator_email, responses, form_data').eq('token', token).single();
            if (!error && data) {
              const resp = (data as any).responses || {};
              const fd = (data as any).form_data || {};
              const ename = (data as any).evaluator_name || fd.evaluator_name || resp.evaluator_name || null;
              const evalName = ename ? String(ename) : '';
              const edName = resp.evaluado_nombre || fd.evaluado_nombre || fd.nombre_evaluado || '';
              if (evalName) setEvaluatorName(evalName);
              if (edName) setEvaluadoName(String(edName));

              // Si no hay preguntas/instrucciones en localStorage, cargar desde form_data
              try {
                const hasItems = (items && items.length > 0);
                const hasInstrucciones = (instrucciones && instrucciones.length > 0);
                const fdAf = fd.afirmaciones && Array.isArray(fd.afirmaciones) ? fd.afirmaciones : null;
                const fdComps = fd.competencias && Array.isArray(fd.competencias) ? fd.competencias : null;
                const fdEsts = fd.estilos && Array.isArray(fd.estilos) ? fd.estilos : null;
                const combined = [] as any[];
                if (fdAf) combined.push(...fdAf);
                if (fdComps) combined.push(...fdComps);
                if (fdEsts) combined.push(...fdEsts);

                if (!hasItems && combined.length > 0) {
                  setItems(combined);
                  console.log('✅ Cargadas preguntas desde Supabase form_data');
                }

                if (!hasInstrucciones && fd.instrucciones && Array.isArray(fd.instrucciones) && fd.instrucciones.length > 0) {
                  setInstrucciones(fd.instrucciones.map((i: any) => ({ etiqueta: i.etiqueta || i.label || i.name || '', descripcion: i.descripcion || i.desc || '' })));
                  console.log('✅ Cargadas instrucciones desde Supabase form_data');
                }
                  // If there was no form_data in the submission, try to load the canonical form
                  if (!hasItems && (!combined || combined.length === 0)) {
                    try {
                      const fResp = await fetch('/api/formulario');
                      if (fResp.ok) {
                        const fJson = await fResp.json();
                        const fAf = Array.isArray(fJson.afirmaciones) ? fJson.afirmaciones : [];
                        const fComps = Array.isArray(fJson.competencias) ? fJson.competencias : [];
                        const fEsts = Array.isArray(fJson.estilos) ? fJson.estilos : [];
                        const merged: any[] = [];
                        if (fAf.length) merged.push(...fAf);
                        if (fComps.length) merged.push(...fComps);
                        if (fEsts.length) merged.push(...fEsts);
                        if (merged.length) {
                          setItems(merged);
                          console.log('✅ Cargadas preguntas desde /api/formulario (fallback)');
                        }
                        if (!hasInstrucciones && Array.isArray(fJson.instrucciones) && fJson.instrucciones.length) {
                          setInstrucciones(fJson.instrucciones.map((i: any) => ({ etiqueta: i.etiqueta || i.label || i.name || '', descripcion: i.descripcion || i.desc || '' })));
                          console.log('✅ Cargadas instrucciones desde /api/formulario (fallback)');
                        }
                      }
                    } catch (e) {
                      console.warn('Aviso: no se pudo cargar /api/formulario como fallback', e);
                    }
                  }
              } catch (e) {
                console.warn('Aviso: no se pudo aplicar form_data al formulario', e);
              }
            }
          }
        } catch (e) {
          console.warn('Aviso: no se pudo obtener evaluator/evaluado desde Supabase', e);
          if (!evaluatorName) setEvaluatorName('Evaluador');
        }
      };

      fetchInfo();
    } catch (e) {
      console.warn(e);
    }
  }, [token]);

  // Measure sticky header height and update padding for content so it doesn't get hidden
  React.useLayoutEffect(() => {
    const measure = () => {
      const h = headerRef.current ? headerRef.current.offsetHeight : 0;
      setHeaderHeight(h);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [instrucciones.length, evaluadoName, evaluatorName]);

  // Auto-save removed: progress will be saved only when user clicks "Guardar progreso"

  // provide explicit save-progress action (local-only)
  const saveProgress = () => {
    if (!token) return;
    try {
      localStorage.setItem(`form_responses_${token}`, JSON.stringify(responses));
      setIsDirty(false);
      setDraftSavedAt(new Date().toISOString());
      console.log('💾 Progreso guardado manualmente');
    } catch (e) {
      console.warn('Error guardando progreso', e);
    }
  };

  // warn user about leaving with unsaved changes
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const determineTipoCategory = (tipoVal?: string | null, categoria?: string | null) => {
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
    setIsDirty(true);
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

    if (error) return; // do not allow submit if token was blocked
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

            // Si no tiene código, buscarlo en la tabla evaluators por nombre
            if (!evaluadoCodigo && evaluadoNombre) {
              try {
                const { data: evData } = await supabase
                  .from('evaluators')
                  .select('codigo_evaluado')
                  .ilike('nombre_evaluado', evaluadoNombre.trim())
                  .limit(1)
                  .single();
                if (evData?.codigo_evaluado) {
                  evaluadoCodigo = String(evData.codigo_evaluado);
                }
              } catch (e) {
                console.warn('Aviso: no se pudo resolver codigo_evaluado desde evaluators', e);
              }
            }
            // Si no tiene código, buscarlo en la tabla evaluators por nombre
            if (!evaluadoCodigo && evaluadoNombre) {
              try {
                const { data: evData } = await supabase
                  .from('evaluators')
                  .select('codigo_evaluado')
                  .ilike('nombre_evaluado', evaluadoNombre.trim())
                  .limit(1)
                  .single();
                if (evData?.codigo_evaluado) {
                  evaluadoCodigo = String(evData.codigo_evaluado);
                }
              } catch (e) {
                console.warn('Aviso: no se pudo resolver codigo_evaluado desde evaluators', e);
              }
            }

            // Si no tiene código, buscarlo en la tabla evaluators por nombre
            if (!evaluadoCodigo && evaluadoNombre) {
              try {
                const { data: evData } = await supabase
                  .from('evaluators')
                  .select('codigo_evaluado')
                  .ilike('nombre_evaluado', evaluadoNombre.trim())
                  .limit(1)
                  .single();
                if (evData?.codigo_evaluado) {
                  evaluadoCodigo = String(evData.codigo_evaluado);
                }
              } catch (e) {
                console.warn('Aviso: no se pudo resolver codigo_evaluado desde evaluators', e);
              }
            }

            // Si no tiene código, buscarlo en la tabla evaluators por nombre
            if (!evaluadoCodigo && evaluadoNombre) {
              try {
                const { data: evData } = await supabase
                  .from('evaluators')
                  .select('codigo_evaluado')
                  .ilike('nombre_evaluado', evaluadoNombre.trim())
                  .limit(1)
                  .single();
                if (evData?.codigo_evaluado) {
                  evaluadoCodigo = String(evData.codigo_evaluado);
                }
              } catch (e) {
                console.warn('Aviso: no se pudo resolver codigo_evaluado desde evaluators', e);
              }
            }

            // Si no tiene código, buscarlo en la tabla evaluators por nombre
            if (!evaluadoCodigo && evaluadoNombre) {
              try {
                const { data: evData } = await supabase
                  .from('evaluators')
                  .select('codigo_evaluado')
                  .ilike('nombre_evaluado', evaluadoNombre.trim())
                  .limit(1)
                  .single();
                if (evData?.codigo_evaluado) {
                  evaluadoCodigo = String(evData.codigo_evaluado);
                }
              } catch (e) {
                console.warn('Aviso: no se pudo resolver codigo_evaluado desde evaluators', e);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Aviso: no se pudo obtener info del evaluado desde Supabase', e);
      }

      const raw = localStorage.getItem('form_responses') || '[]';
      const arr = JSON.parse(raw);

      // Map internal keys (comp-#, est-#) to affirmation `codigo` when available
      const mappedResponses: Record<string, any> = {};
      try {
        // build flat array of questions in the same order as rendered: competencias then estilos
        const flatItems: any[] = [];
        (grouped.competencias || []).forEach((it: any) => flatItems.push(it));
        (grouped.estilos || []).forEach((it: any) => flatItems.push(it));

        Object.keys(responses || {}).forEach((k) => {
          // keys are like 'comp-0' or 'est-1' or 'est-0' or custom keys
          const m = k.match(/^(?:comp|est)-(\d+)$/);
          if (m) {
            const idx = parseInt(m[1], 10);
            const item = flatItems[idx];
            const code = item && (item.codigo || item.code || item.codigo_val || item.id) ? (item.codigo || item.code || item.codigo_val || item.id) : null;
            if (code) mappedResponses[String(code)] = responses[k];
            else mappedResponses[k] = responses[k];
          } else {
            // keep original key if not matching pattern
            mappedResponses[k] = responses[k];
          }
        });
      } catch (e) {
        // fallback: use raw responses
        Object.assign(mappedResponses, responses);
      }

      const responseData: any = { id, createdAt: new Date().toISOString(), responses: mappedResponses, token, evaluatorName };
      if (evaluadoNombre) responseData.evaluadoNombre = evaluadoNombre;
      if (evaluadoCodigo) responseData.evaluadoCodigo = evaluadoCodigo;
      arr.push(responseData);
      localStorage.setItem('form_responses', JSON.stringify(arr));
      console.log('✅ Respuestas guardadas en localStorage:', responseData);

      // Actualizar estado en Supabase si está disponible — incluir evaluado info dentro de responses para persistencia
      let updateOk = false;
      let insertOk = false;
      try {
        const payloadResponses = { ...mappedResponses } as any;
        if (evaluadoNombre) payloadResponses.evaluado_nombre = evaluadoNombre;
        if (evaluadoCodigo) payloadResponses.evaluado_codigo = evaluadoCodigo;

        const updateRes = await fetch('/api/update-submission-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            status: 'completed',
            completedAt: new Date().toISOString(),
            responses: payloadResponses
          })
        });
        const updateJson = await updateRes.json().catch(() => ({}));
        if (updateRes.ok && updateJson && updateJson.success) {
          updateOk = true;
          console.log('✅ update-submission-status OK');
        } else {
          console.warn('Aviso: No se pudo actualizar estado en Supabase', updateJson.error || updateJson);
        }
      } catch (e) {
        console.warn('Aviso: Error actualizando Supabase:', e);
      }

      // Además, intentar insertar cada envío en `form_responses` (no destructivo)
      try {
        const insRes = await fetch('/api/insert-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            evaluatorName,
            evaluadoNombre,
            evaluadoCodigo,
            responses: mappedResponses
          })
        });
        const insJson = await insRes.json().catch(() => ({}));
        if (insRes.ok && insJson && insJson.success) {
          insertOk = true;
          console.log('✅ insert-response OK');
        } else {
          console.warn('Aviso: insert-response API retornó error:', insJson.error || insJson);
        }
      } catch (e) {
        console.warn('Aviso: Error llamando a insert-response API', e);
      }

      // Limpiar respuestas guardadas y resetear formulario después
      localStorage.removeItem(`form_responses_${token}`);
      setResponses({});

      // Mostrar modal de éxito y cerrar automáticamente, redirigir y bloquear el link localmente
      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        // Redirigir a una página de cierre para evitar mostrar el login en la raíz
        try {
          router.replace('/formulario/closed');
        } catch (e) {
          // fallback: window.location
          window.location.href = '/formulario/closed';
        }
      }, 1800);

      // Si ambas llamadas fallaron, dejar registro local para diagnóstico y avisar al usuario
      if (!updateOk && !insertOk) {
        // Guardar copia en localStorage para reintento o inspección
        const pending = JSON.parse(localStorage.getItem('pending_form_responses') || '[]');
        pending.push(responseData);
        localStorage.setItem('pending_form_responses', JSON.stringify(pending));
        console.warn('⚠️ Ambas APIs fallaron, guardado en pending_form_responses para reintento manual');
        // notificar al usuario
        setError('Hubo un problema guardando las respuestas en el servidor; se guardaron localmente y se reintentarán luego.');
        setTimeout(() => setError(null), 8000);
      }
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
        <div style={{ background: '#f8f9ff', borderRadius: 12, boxShadow: '0 8px 32px rgba(2, 6, 23, 0.06)', padding: '28px', border: 'none' }}>
          {/* Header + scale (sticky) */}
          <div style={{ marginBottom: 16 }}>
            <div ref={headerRef} style={{ position: 'sticky', top: 0, zIndex: 60, background: '#f8f9ff', padding: '16px 28px', border: '1px solid rgba(79, 70, 229, 0.1)', borderRadius: 10, margin: '-28px -28px 12px -28px', boxShadow: '0 6px 18px rgba(2,6,23,0.06)' }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ fontSize: 32, fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0', letterSpacing: '0.5px' }}>Formulario de evaluación</h1>
                  <p style={{ fontSize: 14, color: '#64748b', margin: 0, fontWeight: 500 }}>Evaluado: <span style={{ color: '#0F172A', fontWeight: 700 }}>{evaluadoName || evaluatorName || 'Nombre no disponible'}</span></p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <button
                    onClick={saveProgress}
                    disabled={!isDirty}
                    style={{
                      padding: '12px 24px',
                      background: !isDirty ? '#ccc' : 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      cursor: isDirty ? 'pointer' : 'not-allowed',
                      fontWeight: 600,
                      fontSize: 14,
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                      transition: 'all 0.3s',
                    }}
                  >
                    {isDirty ? 'Guardar progreso' : 'Guardado'}
                  </button>
                  <div style={{ marginTop: 6, fontSize: 12, color: '#374151' }}>
                    {draftSavedAt ? `Último guardado: ${new Date(draftSavedAt).toLocaleString()}` : 'No guardado aún'}
                  </div>
                </div>
              </div>

              {instrucciones.length === 0 ? (
                <div style={{ color: 'rgba(15,23,42,0.6)', fontSize: 14, padding: '8px 0' }}>No hay instrucciones disponibles.</div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `minmax(420px, 1fr) repeat(${instrucciones.length}, minmax(120px, 160px))`,
                  gap: 16,
                  alignItems: 'flex-end',
                  marginBottom: 0,
                  paddingBottom: 0
                }}>
                  <div></div>
                  {instrucciones.map((ins, i) => (
                    <div key={`head-${i}`} style={{ textAlign: 'left', padding: '0 8px', maxWidth: 200, wordBreak: 'break-word', whiteSpace: 'normal', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {ins.descripcion ? (
                          <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.6)', marginBottom: 4, lineHeight: '1.25', hyphens: 'auto', flex: 1, display: 'flex', alignItems: 'center' }}>{ins.descripcion}</div>
                        ) : null}
                        <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 12 }}>{ins.etiqueta}</div>
                      </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 8, paddingTop: 0 }}>

                  {allQuestions.map((it, idx) => (
                    <div
                      key={it.key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `minmax(420px, 1fr) repeat(${Math.max(instrucciones.length, 1)}, minmax(120px, 160px))`,
                        gap: 16,
                        alignItems: 'center',
                        padding: '6px 8px',
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
                        <div key={`est-head-${i}`} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', height: '100%', padding: '0 8px', maxWidth: 200 }}>
                            {ins.descripcion ? (
                              <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.6)', marginBottom: 4, flex: 1, display: 'flex', alignItems: 'center', lineHeight: '1.25' }}>{ins.descripcion}</div>
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
                            gridTemplateColumns: `minmax(420px, 1fr) repeat(${Math.max(instrucciones.length, 1)}, minmax(120px, 160px))`,
                            gap: 16,
                            alignItems: 'center',
                            padding: '6px 0',
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

              <div style={{ borderTop: '1px solid rgba(15,23,42,0.06)', paddingTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
                <button
                  onClick={() => setShowConfirmModal(true)}
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
      {showConfirmModal && (
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
            padding: '28px 24px',
            maxWidth: 480,
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)'
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: '0 0 12px 0' }}>¿Estás seguro?</h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px 0' }}>Una vez enviado, no podrás editar la evaluación. ¿Deseas continuar?</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  color: '#374151',
                  border: '1px solid rgba(15,23,42,0.08)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { setShowConfirmModal(false); submit(); }}
                disabled={loading}
                style={{
                  padding: '10px 24px',
                  background: loading ? '#ccc' : 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                }}
              >
                {loading ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
