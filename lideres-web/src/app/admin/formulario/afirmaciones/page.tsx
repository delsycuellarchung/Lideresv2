"use client";

import React from "react";
import { useRouter } from 'next/navigation';
import ModalPreview from '../preview/ModalPreview';
import dynamic from 'next/dynamic';
const DraggableModal = dynamic(() => import('@/components/DraggableModal'), { ssr: false });

type Afirmacion = {
  codigo?: string;
  pregunta: string;
  tipo?: string | null;
  categoria?: 'competencia' | 'estilo' | 'unknown';
};

export default function AfirmacionesPage() {
  const [items, setItems] = React.useState<Afirmacion[]>([]);
  const [open, setOpen] = React.useState(false);
  const [codigo, setCodigo] = React.useState("");
  const [pregunta, setPregunta] = React.useState("");
  const [tipo, setTipo] = React.useState<string | null>(null);
  const [tipoFuente, setTipoFuente] = React.useState<string | null>(null);
  const router = useRouter();
  const [showPreviewModal, setShowPreviewModal] = React.useState(false);
  const [instrucciones, setInstrucciones] = React.useState<{ etiqueta: string; descripcion?: string }[]>([]);
  const [responses, setResponses] = React.useState<Record<string, string>>({});

  const [availableCompetencias, setAvailableCompetencias] = React.useState<string[]>([]);
  const [availableEstilos, setAvailableEstilos] = React.useState<string[]>([]);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);

  // Filter states to view affirmations separately
  const [filterScope, setFilterScope] = React.useState<'all' | 'competencia' | 'estilo'>('competencia');
  const [filterValue, setFilterValue] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('formulario_afirmaciones');
      if (raw) {
        const parsed = JSON.parse(raw) || [];
        const normalized = Array.isArray(parsed) ? parsed.map((a: any) => {
          const item = typeof a === 'string' ? { pregunta: a } : (a || {});
          const codigoVal = item.codigo != null ? (typeof item.codigo === 'object' ? (item.codigo.codigo ?? item.codigo.nombre ?? JSON.stringify(item.codigo)) : String(item.codigo)) : undefined;
          const preguntaVal = item.pregunta != null ? (typeof item.pregunta === 'object' ? (item.pregunta.pregunta ?? item.pregunta.texto ?? JSON.stringify(item.pregunta)) : String(item.pregunta)) : '';
          const tipoVal = item.tipo != null ? (typeof item.tipo === 'object' ? (item.tipo.nombre ?? JSON.stringify(item.tipo)) : String(item.tipo)) : undefined;
          const categoriaVal = item.categoria != null ? String(item.categoria) : undefined;
          return { codigo: codigoVal, pregunta: preguntaVal, tipo: tipoVal, categoria: categoriaVal };
        }) : [];
        setItems(normalized as Afirmacion[]);
      }
    } catch (e) { console.warn(e); }
    try {
      const rawC = localStorage.getItem('formulario_competencias');
      if (rawC) {
        const parsed = JSON.parse(rawC) || [];
        const normalized = (parsed || []).map((it: any) => typeof it === 'string' ? it : (it && typeof it === 'object' ? String(it.nombre ?? it.codigo ?? it.label ?? JSON.stringify(it)) : String(it ?? '')));
        setAvailableCompetencias(normalized);
      }
    } catch (e) { console.warn(e); }
    try {
      const rawE = localStorage.getItem('formulario_estilos');
      if (rawE) {
        const parsed = JSON.parse(rawE) || [];
        const normalized = (parsed || []).map((it: any) => typeof it === 'string' ? it : (it && typeof it === 'object' ? String(it.nombre ?? it.codigo ?? it.label ?? JSON.stringify(it)) : String(it ?? '')));
        setAvailableEstilos(normalized);
      }
    } catch (e) { console.warn(e); }
    try {
      const rawI = localStorage.getItem('formulario_instrucciones');
      if (rawI) setInstrucciones(JSON.parse(rawI));
    } catch (e) { console.warn(e); }
  }, []);

  // helper: determine whether a given tipo value belongs to competencias or estilos
  const determineTipoCategory = (tipoVal?: string | null) => {
    if (!tipoVal) return 'unknown';
    // Prefer estilos first to avoid misclassification when names overlap
    if (availableEstilos.includes(tipoVal)) return 'estilo';
    if (availableCompetencias.includes(tipoVal)) return 'competencia';
    return 'unknown';
  };

  // Generate code automatically when a tipo is selected, if codigo is empty
  React.useEffect(() => {
    if (!tipo) return;
    if (codigo && codigo.trim()) return; // user already set a code
    const label = (tipo as string) || '';
    // normalize label: remove diacritics and non-letter characters
    const normalized = label.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Za-z0-9\s]/g, '');
    const categoria = determineTipoCategory(tipo);
    let prefix = '';
    if (categoria === 'estilo') {
      // estilos: first 3 letters of the normalized label (no spaces)
      prefix = normalized.replace(/\s+/g, '').slice(0, 3).toUpperCase();
    } else {
      // competencias: initials
      prefix = normalized.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase();
    }
    // count existing affirmations for this tipo (exact match)
    const existingForTipo = (items || []).filter(it => String(it.tipo) === String(tipo));
    let nextIndex = existingForTipo.length + 1;
    // build candidate and ensure uniqueness
    let candidate = `${prefix}${nextIndex}`;
    const exists = (code: string) => (items || []).some(it => String(it.codigo || '') === String(code));
    while (exists(candidate)) {
      nextIndex += 1;
      candidate = `${prefix}${nextIndex}`;
    }
    setCodigo(candidate);
  }, [tipo, items, codigo, availableCompetencias, availableEstilos]);

  const save = () => {
    // ensure codigo is set: generate if empty to avoid race conditions
    let codeToUse = codigo.trim();
    if (!codeToUse && tipo) {
      const label = (tipo as string) || '';
      const normalized = label.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Za-z0-9\s]/g, '');
      const categoria = (tipoFuente as 'competencia' | 'estilo' | null) || (determineTipoCategory(tipo) as 'competencia' | 'estilo' | 'unknown');
      let prefix = '';
      if (categoria === 'estilo') {
        prefix = normalized.replace(/\s+/g, '').slice(0, 3).toUpperCase();
      } else {
        prefix = normalized.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase();
      }
      // Append numeric suffix based on existing affirmations for this tipo
      const existingForTipo = (items || []).filter((it, idx) => {
        // when editing, exclude the item being edited from the count
        if (editingIndex !== null && idx === editingIndex) return false;
        return String(it.tipo) === String(tipo);
      });
      let nextIndex = existingForTipo.length + 1;
      let candidate = `${prefix}${nextIndex}`;
      const exists = (code: string) => (items || []).some((it, idx) => {
        if (editingIndex !== null && idx === editingIndex) return false;
        return String(it.codigo || '') === String(code);
      });
      while (exists(candidate)) {
        nextIndex += 1;
        candidate = `${prefix}${nextIndex}`;
      }
      codeToUse = `${candidate}`;
    }
    const categoriaToUse = (tipoFuente as 'competencia' | 'estilo' | null) || (determineTipoCategory(tipo) as 'competencia' | 'estilo' | 'unknown');
    const entry: Afirmacion = { codigo: codeToUse || undefined, pregunta: pregunta.trim(), tipo: tipo || undefined, categoria: categoriaToUse || 'unknown' };

    if (editingIndex !== null && editingIndex >= 0 && editingIndex < items.length) {
      const next = [...items];
      next[editingIndex] = entry;
      setItems(next);
      try { localStorage.setItem('formulario_afirmaciones', JSON.stringify(next)); } catch (e) { console.warn(e); }
      setEditingIndex(null);
    } else {
      const next = [...items, entry];
      setItems(next);
      try { localStorage.setItem('formulario_afirmaciones', JSON.stringify(next)); } catch (e) { console.warn(e); }
    }

    setCodigo(""); setPregunta(""); setTipo(null); setTipoFuente(null); setOpen(false);
  };

  const editItem = (index: number) => {
    const it = items[index];
    setEditingIndex(index);
    setCodigo(it.codigo || "");
    setPregunta(it.pregunta || "");
    // determine tipoFuente from stored categoria or available lists
    const inferred = it.categoria && (it.categoria === 'estilo' || it.categoria === 'competencia') ? it.categoria : determineTipoCategory(it.tipo || null);
    setTipoFuente(inferred === 'unknown' ? null : (inferred as 'estilo' | 'competencia'));
    // set tipo after tipoFuente so the select options will match on next render
    setTipo(it.tipo || null);
    setOpen(true);
  };

  const deleteItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    try { localStorage.setItem('formulario_afirmaciones', JSON.stringify(next)); } catch (e) { console.warn(e); }
    // if we were editing this item, reset modal
    if (editingIndex === index) {
      setEditingIndex(null);
      setOpen(false);
      setCodigo(''); setPregunta(''); setTipo(null); setTipoFuente(null);
    }
  };

  // Prepare deduplicated options for the select to avoid duplicate entries like "-- Todas --"
  const currentAvailable = filterScope === 'competencia' ? availableCompetencias : availableEstilos;
  const uniqueOptions = React.useMemo(() => Array.from(new Set((currentAvailable || []).filter(Boolean))), [currentAvailable]);

  return (
    <div style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <h2 style={{ margin: "-160px 0 16px 0", fontSize: 28, fontWeight: 800 }}>AFIRMACIONES</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <button className="btn-press icon-btn" onClick={() => { setEditingIndex(null); setCodigo(''); setPregunta(''); setTipo(null); setTipoFuente(null); setOpen(true); }} style={{ padding: '10px 16px', fontSize: '15px' }}>
                <img src="/images/agregar.png" alt="Agregar" style={{ width: 18, height: 18, marginRight: 8 }} />Añadir
              </button>
              <button type="button" className="btn-press icon-btn" onClick={() => setShowPreviewModal(true)} style={{ padding: '10px 16px', fontSize: '15px' }}>
                <img src="/images/crearformulario.png" alt="Crear formulario" style={{ width: 18, height: 18, marginRight: 8 }} />Crear formulario
              </button>
            </div>
            <div 
              role="tablist" 
              aria-label="Filtrar por tipo"
              style={{ 
                display: 'inline-flex', 
                background: 'rgba(241, 245, 249, 0.8)',
                borderRadius: '10px',
                padding: '4px',
                border: '1px solid rgba(15, 23, 42, 0.08)',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04) inset'
              }}
            >
              <button 
                onClick={() => { setFilterScope('competencia'); setFilterValue(null); }}
                style={{
                  padding: '8px 20px',
                  borderRadius: '7px',
                  border: 'none',
                  background: filterScope === 'competencia' ? 'linear-gradient(180deg, #ffffff, #f8fafc)' : 'transparent',
                  color: filterScope === 'competencia' ? '#0f172a' : 'rgba(15, 23, 42, 0.6)',
                  fontWeight: filterScope === 'competencia' ? 600 : 500,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: filterScope === 'competencia' ? '0 2px 4px rgba(15, 23, 42, 0.1), 0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                  transform: filterScope === 'competencia' ? 'translateY(-1px)' : 'translateY(0)'
                }}
              >
                Competencias
              </button>
              <button 
                onClick={() => { setFilterScope('estilo'); setFilterValue(null); }}
                style={{
                  padding: '8px 20px',
                  borderRadius: '7px',
                  border: 'none',
                  background: filterScope === 'estilo' ? 'linear-gradient(180deg, #ffffff, #f8fafc)' : 'transparent',
                  color: filterScope === 'estilo' ? '#0f172a' : 'rgba(15, 23, 42, 0.6)',
                  fontWeight: filterScope === 'estilo' ? 600 : 500,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: filterScope === 'estilo' ? '0 2px 4px rgba(15, 23, 42, 0.1), 0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                  transform: filterScope === 'estilo' ? 'translateY(-1px)' : 'translateY(0)'
                }}
              >
                Estilos
              </button>
            </div>
          </div>
        </div>
        <div style={{ maxWidth: '100%' }}>

        {/* Render filtered list */}
        <ul style={{ marginTop: 20, paddingLeft: 0, listStyle: 'none' }}>
          {items && items.length ? (
            items
              .map((it, index) => ({ it, index }))
              .filter(({ it }) => {
                // prefer explicit categoria stored on the item
                const itemCat = (it.categoria as string) ?? determineTipoCategory(it.tipo || null);
                if (filterScope === 'all') return true;
                if (filterScope !== itemCat) return false;
                if (filterValue && filterValue.length > 0) return (it.tipo === filterValue);
                return true;
              })
              .map(({ it, index }) => (
                <li key={`${it.codigo || 'item'}-${index}`} style={{ padding: '12px 0', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{it.codigo || '(sin código)'} — {it.tipo || 'Sin tipo'}</div>
                      <div style={{ marginTop: 6, color: 'rgba(15,23,42,0.65)', fontSize: 14, lineHeight: 1.5 }}>{it.pregunta}</div>
                    </div>
                    <div style={{ display: 'inline-flex', gap: 10, flexShrink: 0 }}>
                      <button 
                        type="button" 
                        onClick={() => editItem(index)} 
                        aria-label="Editar" 
                        title="Editar"
                        style={{ 
                          padding: '6px 12px', 
                          borderRadius: '6px', 
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          background: 'linear-gradient(180deg, rgba(238, 242, 255, 0.8), rgba(224, 231, 255, 0.6))',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: 'translateY(0)',
                          boxShadow: '0 1px 3px rgba(99, 102, 241, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(180deg, #6366f1, #4f46e5)';
                          e.currentTarget.style.borderColor = '#6366f1';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                          const span = e.currentTarget.querySelector('span');
                          if (span) span.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(180deg, rgba(238, 242, 255, 0.8), rgba(224, 231, 255, 0.6))';
                          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(99, 102, 241, 0.1)';
                          const span = e.currentTarget.querySelector('span');
                          if (span) span.style.color = '#4f46e5';
                        }}
                      >
                        <img src="/images/editar.png" alt="Editar" style={{ width: 14, height: 14 }} />
                        <span style={{ fontSize: '13px', color: '#4f46e5', fontWeight: 500, transition: 'color 0.3s' }}>Editar</span>
                      </button>
                      <button 
                        type="button" 
                        onClick={() => deleteItem(index)} 
                        aria-label="Eliminar" 
                        title="Eliminar"
                        style={{ 
                          padding: '6px 12px', 
                          borderRadius: '6px', 
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          background: 'linear-gradient(180deg, rgba(254, 242, 242, 0.8), rgba(254, 226, 226, 0.6))',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: 'translateY(0)',
                          boxShadow: '0 1px 3px rgba(239, 68, 68, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(180deg, #ef4444, #dc2626)';
                          e.currentTarget.style.borderColor = '#ef4444';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                          const span = e.currentTarget.querySelector('span');
                          if (span) span.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(180deg, rgba(254, 242, 242, 0.8), rgba(254, 226, 226, 0.6))';
                          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(239, 68, 68, 0.1)';
                          const span = e.currentTarget.querySelector('span');
                          if (span) span.style.color = '#dc2626';
                        }}
                      >
                        <img src="/images/eliminar.png" alt="Eliminar" style={{ width: 14, height: 14 }} />
                        <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 500, transition: 'color 0.3s' }}>Eliminar</span>
                      </button>
                    </div>
                  </div>
                </li>
              ))
          ) : (
            <li style={{ padding: 8, color: 'rgba(15,23,42,0.6)' }}>No hay afirmaciones.</li>
          )}
        </ul>

        {/* El preview ahora se abre en una página separada: /admin/formulario/preview */}
      </div>

      {open && (
        <DraggableModal id="modal-afirmaciones" isOpen={open} onClose={() => setOpen(false)} minWidth={680} minHeight={420} overlayClassName="modal-overlay" modalClassName="modal" centerOnOpen={true}>
        <h3>Crear afirmación</h3>
        <div style={{ marginTop: 8, display: 'grid', gap: 10, alignItems: 'start' }}>
          <label style={{ fontSize: 13, fontWeight: 700 }}>Código:</label>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="(dejar vacío para autogenerar)" className="form-control" style={{ maxWidth: 640, height: 44 }} />

          <label style={{ fontSize: 13, fontWeight: 700 }}>Texto de la Pregunta:</label>
          <textarea value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder="Escribe la pregunta" className="form-control form-control--textarea" style={{ maxWidth: 640, minHeight: 180 }} />

          <label style={{ fontSize: 13, fontWeight: 700 }}>Tipo:</label>
          <select value={tipoFuente ?? ""} onChange={(e) => { setTipoFuente(e.target.value || null); setTipo(null); }} className="form-control" style={{ maxWidth: 640 }}>
            <option value="">-- Seleccionar tipo --</option>
            <option value="competencia">Competencia</option>
            <option value="estilo">Estilo</option>
          </select>

          <label style={{ fontSize: 13, fontWeight: 700 }}>Seleccionar:</label>
          <select value={tipo ?? ""} onChange={(e) => setTipo(e.target.value || null)} className="form-control" style={{ maxWidth: 640 }}>
            <option value="">-- Seleccionar --</option>
            {(tipoFuente === 'competencia' ? availableCompetencias : tipoFuente === 'estilo' ? availableEstilos : []).map((c, i) => <option key={i} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="continue-btn icon-btn" onClick={() => setOpen(false)}>
            <img src="/images/cancelar.png" alt="Cancelar" style={{ width: 18, height: 18, marginRight: 8 }} />Cancelar
          </button>
          <button className="btn-press icon-btn" onClick={save} disabled={!pregunta.trim()}>
            <img src="/images/guardar.png" alt="Guardar" style={{ width: 18, height: 18, marginRight: 8 }} />Guardar
          </button>
        </div>
        </DraggableModal>
      )}

      <ModalPreview isOpen={showPreviewModal} onClose={() => setShowPreviewModal(false)} />

    </div>
  );
}
