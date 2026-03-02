'use client';

import React, { useState, useEffect } from 'react';
import DraggableModal from '@/components/DraggableModal';
import { supabase } from '@/lib/supabaseClient';

interface Evaluador {
  id: string;
  codigo_evaluador: string;
  nombre_evaluador: string;
  correo_evaluador: string | null;
  cargo_evaluador: string | null;
  area_evaluador: string | null;
  nombre_evaluado: string;
  cargo_evaluado: string | null;
}

interface EvaluadoGroup {
  nombre: string;
  cargo: string | null;
  area: string | null;
  evaluadores: Evaluador[];
}

interface ModalSendFormsProps {
  isOpen: boolean;
  onClose: () => void;
  formData: any;
}

export default function ModalSendForms({ isOpen, onClose, formData }: ModalSendFormsProps) {
  const [evaluadoGroups, setEvaluadoGroups] = useState<Map<string, EvaluadoGroup>>(new Map());
  const [selectedEvaluadores, setSelectedEvaluadores] = useState<Set<string>>(new Set());
  const [mensajePersonalizado, setMensajePersonalizado] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  const loadEvaluadores = async () => {
    setLoading(true);
    try {
      if (!supabase) {
        setMessage('Error: Supabase no configurado');
        setMessageType('error');
        setLoading(false);
        return;
      }
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

      let groups = new Map<string, EvaluadoGroup>();

      if (!evalError && Array.isArray(evalData) && evalData.length > 0) {
        (evalData || []).forEach((row: any) => {
          const key = row.nombre_evaluado || 'Sin evaluado';
          if (!groups.has(key)) {
            groups.set(key, {
              nombre: row.nombre_evaluado || 'Sin evaluado',
              cargo: row.cargo_evaluado,
              area: row.area_evaluado,
              evaluadores: [],
            });
          }
          const group = groups.get(key)!;
          group.evaluadores.push({
            id: row.id || `${row.codigo_evaluador}-${Math.random()}`,
            codigo_evaluador: row.codigo_evaluador,
            nombre_evaluador: row.nombre_evaluador,
            correo_evaluador: row.correo_evaluador,
            cargo_evaluador: row.cargo_evaluador,
            area_evaluador: row.area_evaluador,
            nombre_evaluado: row.nombre_evaluado,
            cargo_evaluado: row.cargo_evaluado,
          });
        });
      } else {
        const { data: personasData, error: personasError } = await supabase
          .from('personas')
          .select(`id,codigo,nombre,cargo,correo,tipo,areas(nombre),gerencias(nombre)`)
          .eq('tipo', 'evaluador')
          .limit(1000);

        if (!personasError && Array.isArray(personasData) && personasData.length > 0) {
          const key = 'Evaluadores';
          groups.set(key, { nombre: 'Evaluadores', cargo: null, area: null, evaluadores: [] });
          personasData.forEach((p: any) => {
            groups.get(key)!.evaluadores.push({
              id: p.id || `${p.codigo}-${Math.random()}`,
              codigo_evaluador: p.codigo,
              nombre_evaluador: p.nombre,
              correo_evaluador: p.correo,
              cargo_evaluador: p.cargo,
              area_evaluador: p.areas?.nombre || null,
              nombre_evaluado: '',
              cargo_evaluado: null,
            });
          });
        } else {
          if (evalError) throw evalError;
          if (personasError) throw personasError;
        }
      }

      setEvaluadoGroups(groups);
    } catch (err) {
      console.error('Error cargando evaluadores:', err);
      setMessage('Error cargando evaluadores');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadEvaluadores();
    } else {
      setEvaluadoGroups(new Map());
      setSelectedEvaluadores(new Set());
      setMensajePersonalizado('');
      setMessage('');
      setMessageType('');
      setLoading(true);
    }
  }, [isOpen]);

  const handleToggleEvaluador = (id: string) => {
    const newSelected = new Set(selectedEvaluadores);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEvaluadores(newSelected);
  };

  const handleSelectAllGroup = (nombreEvaluado: string, select: boolean) => {
    const group = evaluadoGroups.get(nombreEvaluado);
    if (!group) return;

    const newSelected = new Set(selectedEvaluadores);
    group.evaluadores.forEach((ev) => {
      if (select) {
        newSelected.add(ev.id);
      } else {
        newSelected.delete(ev.id);
      }
    });
    setSelectedEvaluadores(newSelected);
  };

  const handleSend = async () => {
    if (selectedEvaluadores.size === 0) {
      setMessage('Selecciona al menos un evaluador');
      setMessageType('error');
      return;
    }

    if (!mensajePersonalizado.trim()) {
      setMessage('Escribe un mensaje para los evaluadores');
      setMessageType('error');
      return;
    }

    const evaluadoresConError: string[] = [];
    
    evaluadoGroups.forEach((group) => {
      group.evaluadores.forEach((ev) => {
        if (selectedEvaluadores.has(ev.id)) {
          if (!ev.correo_evaluador || ev.correo_evaluador.trim() === '') {
            evaluadoresConError.push(`${ev.nombre_evaluador} - SIN CORREO`);
          }
        }
      });
    });

    if (evaluadoresConError.length > 0) {
      setMessage(`Error: Los siguientes evaluadores no tienen correo:\n${evaluadoresConError.join('\n')}`);
      setMessageType('error');
      return;
    }

    setSending(true);
    try {
      const evaluadoresAEnviar: any[] = [];
      
      evaluadoGroups.forEach((group) => {
        group.evaluadores.forEach((ev) => {
          if (selectedEvaluadores.has(ev.id)) {
            evaluadoresAEnviar.push({
              nombre_evaluador: ev.nombre_evaluador,
              correo_evaluador: ev.correo_evaluador,
              cargo_evaluador: ev.cargo_evaluador,
              area_evaluador: ev.area_evaluador,
              nombre_evaluado: ev.nombre_evaluado,
              cargo_evaluado: ev.cargo_evaluado,
              area_evaluado: group.area,
            });
          }
        });
      });

      const response = await fetch('/api/send-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluators: evaluadoresAEnviar,
          formData,
          mensajePersonalizado,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error enviando formularios');
      }

      setMessage(`✓ ${result.successCount} emails enviados exitosamente`);
      setMessageType('success');
      setSelectedEvaluadores(new Set());
      setMensajePersonalizado('');

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setMessage(err.message || 'Error enviando formularios');
      setMessageType('error');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <DraggableModal id="modal-sendforms" isOpen={isOpen} onClose={onClose} minWidth={700} minHeight={420}>
      <div style={{
        width: '100%',
        padding: '24px 18px',
        background: 'transparent'
      }}>
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
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12, color: '#0F172A', margin: 0 }}>
            Enviar Formulario a Evaluadores
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(15,23,42,0.65)', lineHeight: 1.6, margin: 0 }}>
            Selecciona los evaluadores a los que deseas enviar el formulario
          </p>
        </div>

        {/* Mensaje Personalizado */}
        <div style={{ marginBottom: 40, backgroundColor: '#f0f9ff', padding: 20, borderRadius: 12, border: '1px solid #bfdbfe' }}>
          <label style={{ display: 'block', marginBottom: 12, fontSize: 14, fontWeight: 600, color: '#1e40af' }}>
            📝 Mensaje para los Evaluadores
          </label>
          <textarea
            value={mensajePersonalizado}
            onChange={(e) => setMensajePersonalizado(e.target.value)}
            placeholder="Ej: 'Hola, te invitamos a completar este formulario de evaluación de liderazgo. Tu feedback es valioso para nuestro proceso de desarrollo. Por favor completa antes del 30 de marzo.'"
            style={{
              width: '100%',
              minHeight: 100,
              padding: 12,
              border: '1px solid #93c5fd',
              borderRadius: 8,
              fontFamily: 'Arial, sans-serif',
              fontSize: 13,
              resize: 'vertical',
              fontWeight: 600,
              boxSizing: 'border-box'
            }}
          />
          <p style={{ margin: '12px 0 0 0', fontSize: 12, color: '#666' }}>
            💡 Usa este espacio para explicar qué es el formulario y qué esperas del evaluador
          </p>
        </div>

        {/* Evaluadores */}
        <div style={{ marginBottom: 40 }}>
          {loading ? (
            <p style={{ textAlign: 'left', color: '#999', fontSize: 16 }}>Cargando evaluadores...</p>
          ) : (
            evaluadoGroups.size > 0 ? (
              Array.from(evaluadoGroups.entries()).map(([nombreEvaluado, group]) => (
                <div key={nombreEvaluado} style={{ marginBottom: 28 }}>
                  <div style={{
                    backgroundColor: '#f3f4f6',
                    padding: 16,
                    borderRadius: 12,
                    marginBottom: 16,
                  }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
                      {group.nombre}
                    </h3>
                    <p style={{ margin: '0', fontSize: 14, color: 'rgba(15,23,42,0.6)' }}>
                      {group.cargo} {group.area ? `- ${group.area}` : ''}
                    </p>
                  </div>

                  <div style={{ marginLeft: 16, marginBottom: 16 }}>
                    {group.evaluadores.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          padding: 16,
                          marginBottom: 12,
                          backgroundColor: !ev.correo_evaluador ? '#fff3cd' : '#f9fafb',
                          border: `1px solid ${!ev.correo_evaluador ? '#ffc107' : '#e5e7eb'}`,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEvaluadores.has(ev.id)}
                          onChange={() => handleToggleEvaluador(ev.id)}
                          disabled={!ev.correo_evaluador}
                          style={{ cursor: ev.correo_evaluador ? 'pointer' : 'not-allowed', width: 20, height: 20 }}
                        />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: '0', fontSize: 16, fontWeight: 500, color: '#0F172A' }}>
                            {ev.nombre_evaluador}
                          </p>
                          <p style={{
                            margin: '4px 0 0 0',
                            fontSize: 13,
                            color: !ev.correo_evaluador ? '#d32f2f' : 'rgba(15,23,42,0.65)',
                          }}>
                            {ev.correo_evaluador ? ev.correo_evaluador : '⚠️ SIN CORREO'}
                          </p>
                        </div>
                      </div>
                    ))}

                    <div style={{ marginTop: 16, textAlign: 'left', gap: 8, display: 'flex', justifyContent: 'flex-start' }}>
                      <button
                        className="deselect-btn"
                        onClick={() => handleSelectAllGroup(nombreEvaluado, true)}
                        style={{
                          padding: '10px 16px',
                          backgroundColor: '#e5e7eb',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        Seleccionar todo
                      </button>
                      <button
                          onClick={() => handleSelectAllGroup(nombreEvaluado, false)}
                          className="deselect-btn"
                          style={{
                            padding: '10px 16px',
                            backgroundColor: '#6366f1',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          Deseleccionar
                        </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ textAlign: 'left', color: '#999', fontSize: 16 }}>No hay evaluadores disponibles</p>
            )
          )}
        </div>

        {message && (
          <div style={{
            padding: 16,
            marginBottom: 24,
            backgroundColor: messageType === 'error' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            color: messageType === 'error' ? '#DC2626' : '#22C55E',
            borderRadius: 8,
            fontSize: 14,
            whiteSpace: 'pre-wrap',
            border: `1px solid ${messageType === 'error' ? 'rgba(220, 38, 38, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`,
          }}>
            {message}
          </div>
        )}

        {/* Footer */}
        <div style={{
          paddingTop: 32,
          borderTop: '2px solid rgba(15,23,42,0.06)',
          display: 'flex',
          gap: 12,
          justifyContent: 'flex-start',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleSend}
            disabled={sending || selectedEvaluadores.size === 0}
            style={{
              padding: '14px 32px',
              background: sending || selectedEvaluadores.size === 0 ? '#ccc' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: sending ? 'not-allowed' : 'pointer',
              fontSize: 16,
              fontWeight: 600,
              boxShadow: sending || selectedEvaluadores.size === 0 ? 'none' : '0 4px 15px rgba(16, 185, 129, 0.4)',
              transition: 'all 0.3s'
            }}
          >
            {sending ? 'Enviando...' : `Enviar (${selectedEvaluadores.size})`}
          </button>
        </div>
      </div>
    </div>
    </DraggableModal>
  );
}
