"use client";

import React from "react";
import dynamic from 'next/dynamic';
const DraggableModal = dynamic(() => import('@/components/DraggableModal'), { ssr: false });

export default function EstilosPage() {
  const [items, setItems] = React.useState<string[]>([]);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [editIndex, setEditIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('formulario_estilos');
      if (raw) {
        const parsed = JSON.parse(raw) || [];
        const normalized = (parsed || []).map((it: any) => {
          if (typeof it === 'string') return it;
          if (it && typeof it === 'object') return String(it.nombre ?? it.codigo ?? it.label ?? JSON.stringify(it));
          return String(it ?? '');
        });
        setItems(normalized);
      }
    } catch (e) { console.warn(e); }
  }, []);

  const persist = (next: string[]) => {
    try { localStorage.setItem('formulario_estilos', JSON.stringify(next)); } catch (e) { console.warn(e); }
  };

  const openCreate = () => {
    setEditIndex(null);
    setName("");
    setOpen(true);
  };

  const openEdit = (index: number) => {
    setEditIndex(index);
    setName(items[index] || "");
    setOpen(true);
  };

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    persist(next);
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = editIndex === null
      ? [...items, trimmed]
      : items.map((item, i) => (i === editIndex ? trimmed : item));
    setItems(next);
    persist(next);
    setName("");
    setEditIndex(null);
    setOpen(false);
  };

  return (
    <div style={{ padding: 28 }}>
      <h2 style={{ margin: "-90px 0 16px 0", fontSize: 28, fontWeight: 800 }}>ESTILOS</h2>
      <div style={{ maxWidth: 980 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '38px', transform: 'translateX(220px)' }}>
          <div>
            <button className="btn-press icon-btn" onClick={openCreate} style={{ padding: '10px 16px', fontSize: '15px' }}>
              <img src="/images/agregar.png" alt="Agregar" style={{ width: 18, height: 18, marginRight: 8 }} />Añadir
            </button>
          </div>
        </div>

        <ul style={{ marginTop: 40, paddingLeft: 0 }}>
          {items.length ? items.map((it, i) => (
            <li key={i} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(15,23,42,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: '15px', fontWeight: 500 }}>{it}</span>
              <span style={{ display: 'inline-flex', gap: 10, flexShrink: 0, transform: 'translateX(230px)', alignSelf: 'center' }}>
                <button 
                  onClick={() => openEdit(i)} 
                  aria-label={`Editar ${it}`}
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
                  aria-label={`Eliminar ${it}`}
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
            </li>
          )) : <li style={{ padding: 8, color: 'rgba(15,23,42,0.6)' }}>No hay estilos.</li>}
        </ul>
      </div>

      {open && (
        <DraggableModal id="modal-estilos" isOpen={open} onClose={() => { setOpen(false); setEditIndex(null); setName(""); }} minWidth={520} minHeight={160} overlayClassName="modal-overlay" modalClassName="modal" centerOnOpen={true}>
        <h3>{editIndex === null ? 'Crear estilo' : 'Editar estilo'}</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="form-control" />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="continue-btn icon-btn" onClick={() => { setOpen(false); setEditIndex(null); setName(""); }}>
            <img src="/images/cancelar.png" alt="Cancelar" style={{ width: 18, height: 18, marginRight: 8 }} />Cancelar
          </button>
          <button className="btn-press icon-btn" onClick={save} disabled={!name.trim()}>
            <img src="/images/guardar.png" alt="Guardar" style={{ width: 18, height: 18, marginRight: 8 }} />Guardar
          </button>
        </div>
        </DraggableModal>
      )}
    </div>
  );
}
