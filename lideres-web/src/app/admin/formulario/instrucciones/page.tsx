"use client";

import React from "react";
import dynamic from 'next/dynamic';
const DraggableModal = dynamic(() => import('@/components/DraggableModal'), { ssr: false });

export default function InstruccionesPage() {
  const [items, setItems] = React.useState<{etiqueta:string, descripcion?:string}[]>([]);
  const [open, setOpen] = React.useState(false);
  const [etiqueta, setEtiqueta] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [editIndex, setEditIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('formulario_instrucciones');
      if (raw) setItems(JSON.parse(raw));
    } catch (e) { console.warn(e); }
  }, []);

  const persist = (next: { etiqueta: string; descripcion?: string }[]) => {
    try { localStorage.setItem('formulario_instrucciones', JSON.stringify(next)); } catch (e) { console.warn(e); }
  };

  const openCreate = () => {
    setEditIndex(null);
    setEtiqueta("");
    setDescripcion("");
    setOpen(true);
  };

  const openEdit = (index: number) => {
    const current = items[index];
    setEditIndex(index);
    setEtiqueta(current?.etiqueta || "");
    setDescripcion(current?.descripcion || "");
    setOpen(true);
  };

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    persist(next);
  };

  const save = () => {
    const etiquetaTrimmed = etiqueta.trim();
    if (!etiquetaTrimmed) return;
    const payload = { etiqueta: etiquetaTrimmed, descripcion: descripcion.trim() || '' };
    const next = editIndex === null
      ? [...items, payload]
      : items.map((item, i) => (i === editIndex ? payload : item));
    setItems(next);
    persist(next);
    setEtiqueta("");
    setDescripcion("");
    setEditIndex(null);
    setOpen(false);
  };

  return (
    <div style={{ padding: 28 }}>
      <h2 style={{ margin: "-90px 0 16px 0", fontSize: 28, fontWeight: 800 }}>INSTRUCCIONES</h2>
      <div style={{ maxWidth: 980 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '38px', transform: 'translateX(220px)' }}>
          <div>
            <button className="btn-press icon-btn" onClick={openCreate} style={{ padding: '10px 16px', fontSize: '15px' }}>
              <img src="/images/agregar.png" alt="Agregar" style={{ width: 18, height: 18, marginRight: 8 }} />Añadir
            </button>
          </div>
        </div>

        <ul style={{ marginTop: 30, paddingLeft: 0, listStyle: 'none' }}>
          {items.length ? items.map((it, i) => (
            <li key={i} style={{ padding: '12px 0', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: it.descripcion ? 6 : 0 }}>{it.etiqueta}</div>
                  {it.descripcion ? <div style={{ color: 'rgba(15,23,42,0.65)', fontSize: 12, lineHeight: 1.70, margin: 0 }}>{it.descripcion}</div> : null}
                </div>
                <span style={{ display: 'inline-flex', gap: 15, flexShrink: 0, transform: 'translateX(220px)', alignSelf: 'center' }}>
                  <button 
                    onClick={() => openEdit(i)} 
                    aria-label={`Editar ${it.etiqueta}`}
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
                    onClick={() => removeItem(i)} 
                    aria-label={`Eliminar ${it.etiqueta}`}
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
                </span>
              </div>
            </li>
          )) : <li style={{ padding: 8, color: 'rgba(15,23,42,0.6)' }}>No hay instrucciones.</li>}
        </ul>
      </div>

      {open && (
        <DraggableModal id="modal-instrucciones" isOpen={open} onClose={() => { setOpen(false); setEditIndex(null); setEtiqueta(""); setDescripcion(""); }} minWidth={560} minHeight={340} overlayClassName="modal-overlay" modalClassName="modal" centerOnOpen={true}>
        <h3>{editIndex === null ? 'Crear instrucción' : 'Editar instrucción'}</h3>
        <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="Etiqueta" className="form-control" />
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción (opcional)" className="form-control form-control--textarea" style={{ minHeight: 110 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="continue-btn icon-btn" onClick={() => { setOpen(false); setEditIndex(null); setEtiqueta(""); setDescripcion(""); }}>
            <img src="/images/cancelar.png" alt="Cancelar" style={{ width: 18, height: 18, marginRight: 8 }} />Cancelar
          </button>
          <button className="btn-press icon-btn" onClick={save} disabled={!etiqueta.trim()}>
            <img src="/images/guardar.png" alt="Guardar" style={{ width: 18, height: 18, marginRight: 8 }} />Guardar
          </button>
        </div>
        </DraggableModal>
      )}
    </div>
  );
}
