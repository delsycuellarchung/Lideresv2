"use client";

import React from 'react';
import DraggableModal from '@/components/DraggableModal';

export default function ModalPreview({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [items, setItems] = React.useState<any[]>([]);
  const [instrucciones, setInstrucciones] = React.useState<{ etiqueta: string; descripcion?: string }[]>([]);
  const [responses, setResponses] = React.useState<Record<string, string>>({});
  const [saved, setSaved] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    try {
      const raw = localStorage.getItem('formulario_afirmaciones');
      if (raw) setItems(JSON.parse(raw)); else setItems([]);
    } catch (e) { console.warn(e); setItems([]); }
    try {
      const rawI = localStorage.getItem('formulario_instrucciones');
      if (rawI) setInstrucciones(JSON.parse(rawI)); else setInstrucciones([]);
    } catch (e) { console.warn(e); setInstrucciones([]); }
    setResponses({});
    setSaved(null);
  }, [isOpen]);

  const determineTipoCategory = (tipoVal?: string | null) => {
    if (!tipoVal) return 'unknown';
    try {
      const rawE = localStorage.getItem('formulario_estilos');
      const rawC = localStorage.getItem('formulario_competencias');
      const est = rawE ? JSON.parse(rawE) : [];
      const comp = rawC ? JSON.parse(rawC) : [];
      if (est.includes(tipoVal)) return 'estilo';
      if (comp.includes(tipoVal)) return 'competencia';
    } catch (e) { /* ignore */ }
    if (tipoVal.toLowerCase().includes('estilo')) return 'estilo';
    return 'competencia';
  };

  const grouped = React.useMemo(() => {
    const comp: any[] = [];
    const est: any[] = [];
    (items || []).forEach((it) => {
      const cat = it.categoria || determineTipoCategory(it.tipo || null);
      if (cat === 'estilo') est.push(it); else comp.push(it);
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

  const submit = () => {
    const id = `resp_${Date.now()}`;
    try {
      const raw = localStorage.getItem('form_responses') || '[]';
      const arr = JSON.parse(raw);
      arr.push({ id, createdAt: new Date().toISOString(), responses });
      localStorage.setItem('form_responses', JSON.stringify(arr));
      setSaved(id);
    } catch (e) { console.warn(e); }
  };

  if (!isOpen) return null;

  const content = (
    <>
      {/* Header */}
      <div style={{
        padding: '24px 32px',
        borderBottom: '1px solid rgba(15,23,42,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, color: '#0F172A' }}>Formulario de Evaluación</h2>
        </div>
      </div>

      {/* Content */}
      <div style={{ overflow: 'auto', flex: 1, padding: '28px' }}>
        {(!items || items.length === 0) ? (
          <div style={{ 
            padding: 28, 
            textAlign: 'center', 
            background: 'rgba(15,23,42,0.02)', 
            borderRadius: 8, 
            color: 'rgba(15,23,42,0.6)' 
          }}>
            No hay afirmaciones disponibles.
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 28 }}>
              <div style={{ marginTop: 6 }}>
                {instrucciones.length === 0 ? (
                  <div style={{ color: 'rgba(15,23,42,0.6)', fontSize: 13, padding: '8px 0' }}>No hay instrucciones disponibles.</div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `minmax(180px, 1fr) repeat(${instrucciones.length}, minmax(70px, 100px))`,
                    gap: 12,
                    alignItems: 'end',
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottom: '1px solid rgba(15,23,42,0.06)'
                  }}>
                    <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.6)' }}>Pregunta</div>
                    {instrucciones.map((ins, i) => (
                      <div key={`head-${i}`} style={{ textAlign: 'center', padding: '0 6px', maxWidth: 130, wordBreak: 'break-word', whiteSpace: 'normal' }}>
                        <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 12 }}>{ins.etiqueta}</div>
                        {ins.descripcion ? (
                          <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.55)', marginTop: 4, lineHeight: '1.1', hyphens: 'auto' }}>{ins.descripcion}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {allQuestions.map((it) => (
                  <div
                    key={it.key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `minmax(180px, 1fr) repeat(${Math.max(instrucciones.length, 1)}, minmax(70px, 100px))`,
                      gap: 12,
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: '1px solid rgba(15,23,42,0.06)'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>{it.question}</div>
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
                            boxShadow: selected ? '0 6px 18px rgba(79,70,229,0.08)' : 'none',
                            transition: 'box-shadow 0.15s'
                          }}
                        >
                          <input
                            type="radio"
                            name={it.key}
                            value={ins.etiqueta}
                            checked={selected}
                            onChange={() => handleChange(it.key, ins.etiqueta)}
                            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#4F46E5', transform: selected ? 'scale(1.06)' : 'scale(1)', transition: 'transform 0.12s' }}
                          />
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <DraggableModal id="modal-preview" isOpen={isOpen} onClose={onClose}>
      {content}
    </DraggableModal>
  );
}
