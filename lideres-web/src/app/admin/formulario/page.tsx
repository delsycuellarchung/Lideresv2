"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function FormularioPage() {
  const [section, setSection] = useState<"competencias" | "estilos" | "instrucciones" | "afirmaciones">("competencias");
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [items, setItems] = useState<Record<string, any[]>>({ competencias: [], estilos: [], instrucciones: [], afirmaciones: [] });
  const [activeSection, setActiveSection] = useState<string>("competencias");

  // load saved items from localStorage per section
  React.useEffect(() => {
    try {
      const next: Record<string, string[]> = { competencias: [], estilos: [], instrucciones: [], afirmaciones: [] };
      Object.keys(next).forEach((k) => {
        const raw = localStorage.getItem(`formulario_${k}`);
        if (raw) next[k] = JSON.parse(raw);
      });
      setItems(next);
    } catch (e) {
      console.warn("could not load formulario items", e);
    }
  }, []);

  const openCreate = (s: string) => {
    setActiveSection(s);
    setNewName("");
    setNewDesc("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setNewName("");
    setNewDesc("");
  };

  const saveNew = () => {
    const key = `formulario_${activeSection}`;
    let next: Record<string, any[]>;
    if (activeSection === 'instrucciones') {
      const entry = { etiqueta: newName, descripcion: newDesc };
      next = { ...items, [activeSection]: [...(items[activeSection] || []), entry] };
      setItems(next);
      try { localStorage.setItem(key, JSON.stringify(next[activeSection])); } catch (e) { console.warn("could not persist formulario item", e); }
      try { import('@/lib/formularioService').then(m => m.persistFormularioToServer({ afirmaciones: JSON.parse(localStorage.getItem('formulario_afirmaciones') || '[]'), competencias: JSON.parse(localStorage.getItem('formulario_competencias') || '[]'), estilos: JSON.parse(localStorage.getItem('formulario_estilos') || '[]'), instrucciones: JSON.parse(localStorage.getItem('formulario_instrucciones') || '[]') })); } catch (e) {}
    } else {
      next = { ...items, [activeSection]: [...(items[activeSection] || []), newName] };
      setItems(next);
      try { localStorage.setItem(key, JSON.stringify(next[activeSection])); } catch (e) { console.warn("could not persist formulario item", e); }
      try { import('@/lib/formularioService').then(m => m.persistFormularioToServer({ afirmaciones: JSON.parse(localStorage.getItem('formulario_afirmaciones') || '[]'), competencias: JSON.parse(localStorage.getItem('formulario_competencias') || '[]'), estilos: JSON.parse(localStorage.getItem('formulario_estilos') || '[]'), instrucciones: JSON.parse(localStorage.getItem('formulario_instrucciones') || '[]') })); } catch (e) {}
    }
    closeModal();
  };

  // Persist all sections to localStorage whenever `items` changes
  React.useEffect(() => {
    try {
      Object.keys(items).forEach((k) => {
        localStorage.setItem(`formulario_${k}`, JSON.stringify(items[k] || []));
      });
    } catch (e) {
      console.warn("could not persist formulario items on update", e);
    }

    // Also try to persist to server (best-effort). Requires user authenticated for server-side DB save.
    (async () => {
      try {
        const mod = await import('@/lib/formularioService');
        // pass the sections explicitly
        await mod.persistFormularioToServer({
          afirmaciones: Array.isArray(items.afirmaciones) ? items.afirmaciones : [],
          competencias: Array.isArray(items.competencias) ? items.competencias : [],
          estilos: Array.isArray(items.estilos) ? items.estilos : [],
          instrucciones: Array.isArray(items.instrucciones) ? items.instrucciones : []
        });
      } catch (e) {
        // non-blocking
      }
    })();
  }, [items]);

  return (
    <div style={{ padding: 28 }}>
      <div className="page-header">
        <h2 style={{ margin: "0 0 24px 0", fontSize: 32, fontWeight: 800 }}>Formulario</h2>
        <p style={{ marginTop: 6, color: 'rgba(15,23,42,0.7)' }}>Selecciona una subsección en el menú izquierdo para ver y editar sus ítems.</p>
      </div>

      <div style={{ maxWidth: 980, margin: "12px 0 0 0" }}>
        <nav style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }} aria-label="Formulario subsecciones">
          <Link href="/admin/formulario/competencias" className="btn-press" onClick={() => setSection('competencias')} style={{ padding: '6px 10px', borderRadius: 8 }}>Competencias</Link>
          <Link href="/admin/formulario/estilos" className="btn-press" onClick={() => setSection('estilos')} style={{ padding: '6px 10px', borderRadius: 8 }}>Estilos</Link>
          <Link href="/admin/formulario/instrucciones" className="btn-press" onClick={() => setSection('instrucciones')} style={{ padding: '6px 10px', borderRadius: 8 }}>Instrucciones</Link>
          <Link href="/admin/formulario/afirmaciones" className="btn-press" onClick={() => setSection('afirmaciones')} style={{ padding: '6px 10px', borderRadius: 8 }}>Afirmaciones</Link>
        </nav>
        <div style={{ padding: 12, border: '1px dashed rgba(15,23,42,0.06)', borderRadius: 8 }}>
          <p>Las subsecciones están disponibles en el submenú <strong>Formulario</strong> del panel izquierdo: <em>Competencias, Estilos, Instrucciones, Afirmaciones</em>.</p>
          <p>Cada subsección tiene su propio botón "Añadir" y ventana emergente para crear ítems.</p>
        </div>
      </div>

      {/* Quick inline view of the active section items (non-destructive) */}
      <div style={{ maxWidth: 980, marginTop: 18 }}>
        <h3 style={{ margin: '10px 0' }}>Vista rápida: {section.charAt(0).toUpperCase() + section.slice(1)}</h3>
        {Array.isArray(items[section]) && items[section].length > 0 ? (
          <ul>
            {items[section].map((it: any, idx: number) => (
              <li key={idx} style={{ padding: '6px 0' }}>{typeof it === 'string' ? it : `${it.etiqueta || ''} ${it.descripcion ? '- ' + it.descripcion : ''}`}</li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'rgba(15,23,42,0.6)' }}>No hay ítems en esta subsección aún.</p>
        )}
      </div>
    </div>
  );
}
