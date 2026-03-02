"use client";

import React from 'react';
import { GeneralDonut } from '@/components/GeneralDonut';
import { mapLabelToNumeric } from '@/lib/scaleMapper';
import { supabase } from '@/lib/supabaseClient';

type Afirm = { codigo?: string; pregunta: string; tipo?: string | null; categoria?: string };
type RespEntry = { id: string; createdAt: string; responses?: Record<string, string>; token?: string; evaluatorName?: string; evaluadoNombre?: string; evaluadoCodigo?: string };

export default function ResultadosPage() {
  const renderCodigo = (val: any): string => {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return (val as any).codigo ?? (val as any).nombre ?? JSON.stringify(val);
    return String(val);
  };
  const renderVal = (val: any): string => {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return (val as any).pregunta ?? (val as any).codigo ?? (val as any).nombre ?? JSON.stringify(val);
    return String(val);
  };
  const [allResponses, setAllResponses] = React.useState<RespEntry[]>([]);
  const [afirmaciones, setAfirmaciones] = React.useState<Afirm[]>([]);
  const [competenciasList, setCompetenciasList] = React.useState<string[]>([]);
  const [competenciasMap, setCompetenciasMap] = React.useState<Record<string, string>>({});
  const [estilosList, setEstilosList] = React.useState<string[]>([]);
  const [selectedName, setSelectedName] = React.useState<string>('');
  const [selectedCode, setSelectedCode] = React.useState<string>('');
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [selectedData, setSelectedData] = React.useState<{ codigo?: string; evaluadores?: number } | null>(null);
  const [supabaseTried, setSupabaseTried] = React.useState(false);
  const [supabaseError, setSupabaseError] = React.useState<string | null>(null);
  const [formServerLoaded, setFormServerLoaded] = React.useState(false);

  React.useEffect(() => {
    // Auto-clean only demo/sample afirmaciones from localStorage — do NOT remove all keys
    const clearDemoIfDetected = () => {
      if (typeof window === 'undefined') return;
      try {
        const rawA = window.localStorage.getItem('formulario_afirmaciones');
        if (!rawA) return;
        const parsedA = JSON.parse(rawA) || [];
        if (!Array.isArray(parsedA) || parsedA.length === 0) return;
        const demoPhrases = ['Comunica', 'Motiva', 'Muestra respeto', 'Se adapta', 'Fomenta el desarrollo', 'Influye'];
        const isDemo = (it: any) => {
          const txt = (typeof it === 'string' ? it : (it && (it.pregunta || it.texto || it.nombre))) || '';
          return demoPhrases.some(p => txt.toString().includes(p));
        };
        const filtered = (parsedA as any[]).filter(it => !isDemo(it));
        if (filtered.length !== parsedA.length) {
          // overwrite only the afirmaciones list with demo items removed
          try {
            window.localStorage.setItem('formulario_afirmaciones', JSON.stringify(filtered));
            // update in-memory state immediately so UI reflects change
            setAfirmaciones(Array.isArray(filtered) ? filtered.map((a: any) => {
              const item = typeof a === 'string' ? { pregunta: a } : (a || {});
              const codigoVal = item.codigo != null ? (typeof item.codigo === 'object' ? (item.codigo.codigo ?? item.codigo.nombre ?? JSON.stringify(item.codigo)) : String(item.codigo)) : undefined;
              const preguntaVal = item.pregunta != null ? (typeof item.pregunta === 'object' ? (item.pregunta.pregunta ?? item.pregunta.texto ?? JSON.stringify(item.pregunta)) : String(item.pregunta)) : '';
              const tipoVal = item.tipo != null ? (typeof item.tipo === 'object' ? (item.tipo.nombre ?? JSON.stringify(item.tipo)) : String(item.tipo)) : undefined;
              const categoriaVal = item.categoria != null ? String(item.categoria) : undefined;
              return { codigo: codigoVal, pregunta: preguntaVal, tipo: tipoVal, categoria: categoriaVal };
            }) : []);
          } catch (e) {
            // if storage.setItem fails, ignore — leave localStorage as-is
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    };
    clearDemoIfDetected();
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('form_responses') || '[]';
      const parsed = JSON.parse(raw) || [];
      setAllResponses(parsed);
    } catch (e) {
      setAllResponses([]);
    }
    try {
      const rawA = window.localStorage.getItem('formulario_afirmaciones') || '[]';
      const parsedA = JSON.parse(rawA) || [];
      const normalizedA: Afirm[] = Array.isArray(parsedA)
        ? parsedA.map((a: any) => {
            const item = typeof a === 'string' ? { pregunta: a } : (a || {});
            const codigoVal = item.codigo != null ? (typeof item.codigo === 'object' ? (item.codigo.codigo ?? item.codigo.nombre ?? JSON.stringify(item.codigo)) : String(item.codigo)) : undefined;
            const preguntaVal = item.pregunta != null ? (typeof item.pregunta === 'object' ? (item.pregunta.pregunta ?? item.pregunta.texto ?? JSON.stringify(item.pregunta)) : String(item.pregunta)) : '';
            const tipoVal = item.tipo != null ? (typeof item.tipo === 'object' ? (item.tipo.nombre ?? JSON.stringify(item.tipo)) : String(item.tipo)) : undefined;
            const categoriaVal = item.categoria != null ? String(item.categoria) : undefined;
            return { codigo: codigoVal, pregunta: preguntaVal, tipo: tipoVal, categoria: categoriaVal };
          })
        : [];
      setAfirmaciones(normalizedA);
    } catch (e) {
      setAfirmaciones([]);
    }
    try {
      const rawC = window.localStorage.getItem('formulario_competencias') || '[]';
      const parsedC = JSON.parse(rawC) || [];
      const normalizedC: string[] = [];
      const map: Record<string, string> = {};
      (Array.isArray(parsedC) ? parsedC : []).forEach((it: any) => {
        if (typeof it === 'string') {
          normalizedC.push(it);
        } else if (it && typeof it === 'object') {
          const label = String(it.nombre ?? it.label ?? it.name ?? it.codigo ?? '');
          const code = it.codigo != null ? String(it.codigo) : (it.code != null ? String(it.code) : '');
          if (label) normalizedC.push(label);
          if (label && code) map[label] = code;
        }
      });
      setCompetenciasList(normalizedC.filter(Boolean));
      setCompetenciasMap(map);
    } catch (e) {
      setCompetenciasList([]);
      setCompetenciasMap({});
    }
    try {
      const rawE = window.localStorage.getItem('formulario_estilos') || '[]';
      const parsedE = JSON.parse(rawE) || [];
      const normalizedE = (Array.isArray(parsedE) ? parsedE : []).map((it: any) => typeof it === 'string' ? it : (it && typeof it === 'object' ? String(it.nombre ?? it.codigo ?? it.label ?? JSON.stringify(it)) : String(it ?? '')));
      setEstilosList(normalizedE.filter(Boolean));
    } catch (e) {
      setEstilosList([]);
    }
  }, []);

  // Try to auto-load last import from server if no localStorage data present
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const tryLoadImport = async () => {
      try {
        const resp = await fetch('/api/import-last');
        if (!resp.ok) return;
        const data = await resp.json();
        const rows = Array.isArray(data.rows) ? data.rows : (Array.isArray(data) ? data : []);
        if (!rows || !rows.length) return;
        const normalized: RespEntry[] = rows.map((r: any, idx: number) => {
          const entry: any = {};
          entry.id = r.id ?? r._id ?? String(idx);
          entry.createdAt = r.createdAt ?? r.created_at ?? r.created ?? '';
          entry.evaluadoCodigo = r.evaluadoCodigo ?? r.codigo_evaluado ?? r.codigo ?? r.COD_EVALUADO ?? r['Código'] ?? r['Código Evaluado'] ?? '';
          entry.evaluadoNombre = r.evaluadoNombre ?? r.nombre_evaluado ?? r.nombre ?? r['Nombre'] ?? '';
          entry.evaluatorName = r.evaluatorName ?? r.evaluador ?? r.evaluator ?? r['Evaluator'] ?? '';
          const responses: Record<string, string> = {};
          Object.keys(r || {}).forEach((k) => {
            const kl = k.toLowerCase();
            if (['id', 'createdat', 'created_at', 'created', 'evaluadocodigo', 'evaluadonombre', 'evaluador', 'evaluatorname', 'token'].includes(kl)) return;
            // skip obvious metadata-like keys
            if (kl.includes('codigo') && !/^([a-zA-Z]{2,}\d+)/.test(k)) return;
            if (kl.includes('nombre') && !/^([a-zA-Z]{2,}\d+)/.test(k)) return;
            responses[k] = r[k];
          });
          entry.responses = responses;
          return entry as RespEntry;
        });
        // only overwrite responses if we don't already have them in localStorage
        setAllResponses(prev => (prev && prev.length ? prev : normalized));

        // build afirmaciones list from response keys if we don't already have afirmaciones
        const codes = new Set<string>();
        const tipos = new Set<string>();
        normalized.forEach(n => {
          if (!n.responses) return;
          Object.keys(n.responses).forEach(k => {
            codes.add(k);
            const tipoGuess = String(k).replace(/\d+$/g, '').trim();
            if (tipoGuess) tipos.add(tipoGuess);
          });
        });
        const afirm: Afirm[] = Array.from(codes).map(c => ({ codigo: c, pregunta: c, tipo: String(c).replace(/\d+$/g, '').trim() || undefined, categoria: 'competencia' }));
        setAfirmaciones(prev => (prev && prev.length ? prev : afirm));
        // populate competenciasList if empty using derived tipos
        setCompetenciasList(prev => (prev && prev.length ? prev : Array.from(tipos)));
        // populate estilosList if empty (no reliable derivation) — leave empty to allow user to add
        setFormServerLoaded(true);
      } catch (e) {
        // fail silently
      }
    };
    tryLoadImport();
  }, []);

  // Load persisted formulario (afirmaciones/competencias/estilos) from server, fallback to localStorage
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const load = async () => {
      try {
        const resp = await fetch('/api/formulario');
        if (!resp.ok) {
          // fallback to localStorage already handled in mount
          setFormServerLoaded(true);
          return;
        }
        const data = await resp.json();
        const hasAny = (Array.isArray(data.afirmaciones) && data.afirmaciones.length > 0) || (Array.isArray(data.competencias) && data.competencias.length > 0) || (Array.isArray(data.estilos) && data.estilos.length > 0);
        if (hasAny) {
          // normalize afirmaciones
          const normalizedA: Afirm[] = (Array.isArray(data.afirmaciones) ? data.afirmaciones : []).map((a: any) => {
            const item = typeof a === 'string' ? { pregunta: a } : (a || {});
            const codigoVal = item.codigo != null ? (typeof item.codigo === 'object' ? (item.codigo.codigo ?? item.codigo.nombre ?? JSON.stringify(item.codigo)) : String(item.codigo)) : undefined;
            const preguntaVal = item.pregunta != null ? (typeof item.pregunta === 'object' ? (item.pregunta.pregunta ?? item.pregunta.texto ?? JSON.stringify(item.pregunta)) : String(item.pregunta)) : '';
            const tipoVal = item.tipo != null ? (typeof item.tipo === 'object' ? (item.tipo.nombre ?? JSON.stringify(item.tipo)) : String(item.tipo)) : undefined;
            const categoriaVal = item.categoria != null ? String(item.categoria) : undefined;
            return { codigo: codigoVal, pregunta: preguntaVal, tipo: tipoVal, categoria: categoriaVal };
          });
          setAfirmaciones(normalizedA);
          setCompetenciasList(Array.isArray(data.competencias) ? data.competencias.filter(Boolean) : []);
          setEstilosList(Array.isArray(data.estilos) ? data.estilos.filter(Boolean) : []);
          // write to localStorage to persist for client sessions
          try {
            window.localStorage.setItem('formulario_afirmaciones', JSON.stringify(normalizedA));
            window.localStorage.setItem('formulario_competencias', JSON.stringify(Array.isArray(data.competencias) ? data.competencias : []));
            window.localStorage.setItem('formulario_estilos', JSON.stringify(Array.isArray(data.estilos) ? data.estilos : []));
          } catch (e) {}
        }
        setFormServerLoaded(true);
      } catch (e) {
        setFormServerLoaded(true);
      }
    };
    load();
  }, []);

  // Persist formulario to server when user edits afirmaciones/competencias/estilos
  React.useEffect(() => {
    if (!formServerLoaded) return; // wait until initial load
    const payload = { afirmaciones, competencias: competenciasList, estilos: estilosList };
    const t = setTimeout(() => {
      fetch('/api/formulario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [afirmaciones, competenciasList, estilosList, formServerLoaded]);

  React.useEffect(() => {
    const setCodes = new Set<string>();
    for (const r of allResponses) {
      if (r.evaluadoCodigo) setCodes.add(String(r.evaluadoCodigo));
    }
    setSuggestions(Array.from(setCodes).filter(n => n));
  }, [allResponses]);

  const suggestionsInfo = React.useMemo(() => {
    const tmp: Record<string, Set<string>> = {};
    const nameForCode: Record<string, string> = {};
    for (const r of allResponses) {
      const code = String(r.evaluadoCodigo || '');
      const name = String(r.evaluadoNombre || '');
      if (!code) continue;
      nameForCode[code] = nameForCode[code] || name;
      if (!tmp[code]) tmp[code] = new Set<string>();
      if (r.evaluatorName) tmp[code].add(String(r.evaluatorName).trim());
    }
    return suggestions.map(code => ({ code, name: nameForCode[code] || '', evaluadores: tmp[code] ? tmp[code].size : 0 }));
  }, [suggestions, allResponses]);

  const onSelectName = (name: string) => {
    setSelectedName(name);
    const entries = allResponses.filter(e => (e.evaluadoNombre || '').toString() === name);
    const codigo = entries.find(e => e.evaluadoCodigo)?.evaluadoCodigo;
    const evaluadores = new Set(entries.map(e => (e.evaluatorName || '').toString().trim()).filter(x => x));
    setSelectedData({ codigo: codigo || undefined, evaluadores: evaluadores.size });
  };

  const stats = React.useMemo(() => {
    if (!selectedCode && !selectedName) return null;
    const entries = selectedCode
      ? allResponses.filter(e => String(e.evaluadoCodigo) === String(selectedCode))
      : allResponses.filter(e => (e.evaluadoNombre || '').toString() === selectedName);
    if (!entries || entries.length === 0) return { evaluadoresCount: 0, competencias: {}, estilos: {}, overallCompetenciasAvg: null, overallEstilosAvg: null };

    const evaluadoresSet = new Set(entries.map(e => (e.evaluatorName || '').toString().trim()).filter(x => x));
    const evaluadoresCount = evaluadoresSet.size;

    return {
      evaluadoresCount,
      competencias: {},
      estilos: {},
      overallCompetenciasAvg: null,
      overallEstilosAvg: null,
    };
  }, [selectedCode, selectedName, allResponses]);

  const getAfirmValues = (entries: RespEntry[], a: Afirm): number[] => {
    const vals: number[] = [];
    for (const e of entries) {
      if (!e.responses || !a.codigo) continue;
      const raw = e.responses[a.codigo];
      const mapped = mapLabelToNumeric(raw as string);
      if (typeof mapped === 'number' && !isNaN(mapped)) vals.push(mapped);
    }
    return vals;
  };

  return (
    <section style={{ padding: '6px 24px 20px 24px' }}>
      <h1 style={{ margin: '0 0 0 12px', fontSize: 32, fontWeight: 800, transform: 'translateY(-70px)' }}>Resultados detalle</h1>
      <div style={{ marginTop: -38, marginLeft: 12 }}>
        <label style={{ display: 'block', fontWeight: 700, marginBottom: 17 }}>Buscar por código del evaluado</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            placeholder="Código..."
            value={selectedCode}
            onChange={(e) => setSelectedCode(e.target.value)}
            list="evaluados-list"
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.08)', width: 200 }}
          />
          <datalist id="evaluados-list">
            {suggestions.map((s, i) => <option key={i} value={s} />)}
          </datalist>
          <button onClick={() => {
            const code = selectedCode.trim();
            const entries = allResponses.filter(a => String(a.evaluadoCodigo) === code);
            const name = entries.find(e => e.evaluadoNombre)?.evaluadoNombre || '';
            setSelectedName(name);
            const evaluadores = new Set(entries.map(e => (e.evaluatorName || '').toString().trim()).filter(x => x));
            setSelectedData({ codigo: code, evaluadores: evaluadores.size });
          }} style={{ padding: '8px 12px', borderRadius: 8, background: '#4f46e5', color: '#fff', border: 'none' }}>Cargar</button>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginRight: 8 }}>Nombre</label>
            <input disabled value={selectedName || ''} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.08)', width: 220, background: '#cbd5e1', color: '#0f172a' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginRight: 8 }}>Evaluadores</label>
            <input disabled value={(selectedData?.evaluadores ?? 0).toString()} placeholder="# Evaluadores" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.08)', width: 120, textAlign: 'center', background: '#cbd5e1', color: '#0f172a' }} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr', gap: 18 }}>
        {/* Competencias */}
        <div style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid rgba(15,23,42,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#f9fafb', minWidth: 0, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ textAlign: 'left', padding: '4px 6px' }}>COMPETENCIA</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px', minWidth: 70 }}>COD</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px', borderRight: '1.5px solid #e5e7eb', minWidth: 140 }}>AFIRMACIÓN / COMPORTAMIENTO</th>
                    <th style={{ textAlign: 'left', padding: '3px 5px', borderLeft: '1.5px solid #e5e7eb', minWidth: 60 }}>PROMEDIO AFIRMACIÓN</th>
                    <th style={{ textAlign: 'left', padding: '3px 5px', minWidth: 60 }}>PROMEDIO COMPETENCIA</th>
                    <th style={{ textAlign: 'left', padding: '3px 5px', border: 'none', minWidth: 70 }}>PROMEDIO COMPETENCIAS</th>
                  </tr>
                </thead>
            <tbody>
              {(() => {
                const comps: Record<string, Afirm[]> = {};
                afirmaciones.filter(a => {
                  if (!a.tipo) return false;
                  // If category explicitly 'competencia'
                  if (a.categoria === 'competencia') return true;
                  // If category explicitly 'estilo', exclude
                  if (a.categoria === 'estilo') return false;
                  // If no explicit category, classify using listas: prefer estilos when tipo present in estilosList
                  if (estilosList.includes(String(a.tipo))) return false;
                  if (competenciasList.length === 0) return true; // default to competencia if no competencias defined
                  return competenciasList.includes(String(a.tipo));
                }).forEach(a => {
                  if (!comps[a.tipo!]) comps[a.tipo!] = [];
                  comps[a.tipo!].push(a);
                });
                // ensure competencias from formulario_competencias appear even if no afirmaciones
                competenciasList.forEach(c => {
                  if (!comps[c]) comps[c] = [];
                });
                const palette = ['#EF8A4B', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#F97316', '#EF4444'];
                const compIndex: Record<string, number> = {};
                Object.keys(comps).forEach((c, i) => { compIndex[c] = i % palette.length; });
                const entries = selectedCode
                  ? allResponses.filter(e => String(e.evaluadoCodigo) === String(selectedCode))
                  : (selectedName ? allResponses.filter(e => (e.evaluadoNombre || '').toString() === selectedName) : allResponses);
                const rows: React.ReactNode[] = [];
                Object.entries(comps).forEach(([comp, compRows]) => {
                  const color = palette[compIndex[comp]];
                    // compute competence average across all afirmaciones in this competence
                    const allValsForComp: number[] = [];
                    const entries = selectedCode
                      ? allResponses.filter(e => String(e.evaluadoCodigo) === String(selectedCode))
                      : (selectedName ? allResponses.filter(e => (e.evaluadoNombre || '').toString() === selectedName) : allResponses);
                    compRows.forEach(a => {
                      const vals = entries.map(e => e.responses && a.codigo && mapLabelToNumeric(e.responses[a.codigo])).filter((v): v is number => typeof v === 'number' && !isNaN(v));
                      allValsForComp.push(...vals);
                    });
                    const compAvg = allValsForComp.length ? (allValsForComp.reduce((s, v) => s + v, 0) / allValsForComp.length) : '';
                    // if no afirmaciones, push a placeholder row so the competence still renders
                    if (compRows.length === 0) compRows.push({ codigo: undefined, pregunta: '(sin afirmaciones)', tipo: comp, categoria: 'competencia' } as Afirm);
                    compRows.forEach((a, idx) => {
                      rows.push(
                          <tr key={`${comp}-${String(a.codigo)}`} style={{ background: '#fff', fontSize: 11, borderBottom: '1px solid #e5e7eb' }}>
                            {idx === 0 ? <td rowSpan={compRows.length} style={{ padding: '4px 6px 4px 6px', verticalAlign: 'middle', background: color, color: '#000000', fontWeight: 800, textAlign: 'center', fontSize: 12, borderRight: '1px solid #e5e7eb', borderLeft: `4px solid ${color}`, borderBottom: idx === compRows.length - 1 ? '2px solid #cbd5e1' : '1px solid #e5e7eb' }}>{String(comp)}</td> : null}
                            <td style={{ padding: '4px 6px', verticalAlign: 'middle', fontWeight: 600, color: '#000000', background: color + '22', fontSize: 11, borderBottom: idx === compRows.length - 1 ? '2px solid #cbd5e1' : '1px solid #e5e7eb' }}>{renderCodigo(a.codigo)}</td>
                          <td style={{ padding: '4px 6px', color: '#000000', borderBottom: idx === compRows.length - 1 ? '2px solid #cbd5e1' : '1px solid #e5e7eb', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 420, fontSize: 11 }}>{renderVal(a.pregunta)}</td>
                          <td style={{ padding: '3px 5px', borderLeft: '1px solid #e5e7eb', borderBottom: idx === compRows.length - 1 ? '2px solid #cbd5e1' : '1px solid #e5e7eb', fontSize: 11 }}>{(() => {
                            const values = entries.map(e => e.responses && a.codigo && mapLabelToNumeric(e.responses[a.codigo])).filter((v): v is number => typeof v === 'number' && !isNaN(v));
                            if (!values.length) return '';
                            return (values.reduce((s, v) => s + v, 0) / values.length).toFixed(2);
                          })()}</td>
                          {idx === 0 ? (
                            <td rowSpan={compRows.length} style={{ padding: '3px 5px', fontWeight: 700, fontSize: 11, background: '#e0e7ff', color: '#3730a3', borderLeft: '2px solid #cbd5e1', borderRight: '2px solid #cbd5e1', borderBottom: idx === compRows.length - 1 ? '2px solid #cbd5e1' : '1px solid #cbd5e1' }}>
                              {compAvg ? Number(compAvg).toFixed(2) : ''}
                            </td>
                          ) : null}
                          {idx === 0 ? (
                            <td rowSpan={compRows.length} style={{ padding: '3px 5px', background: '#e0e7ff' }}></td>
                          ) : null}
                        </tr>
                      );
                  });
                });
                return rows;
              })()}
            </tbody>
          </table>
        </div>
        {/* Estilos */}
        <div style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid rgba(15,23,42,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#f9fafb', minWidth: 0, whiteSpace: 'normal', wordBreak: 'break-word' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ padding: '4px 6px' }}>ESTILO</th>
                <th style={{ padding: '4px 6px', minWidth: 70 }}>COD</th>
                <th style={{ padding: '4px 6px', borderRight: '1.5px solid #e5e7eb', minWidth: 140 }}>AFIRMACIÓN / COMPORTAMIENTO</th>
                <th style={{ padding: '3px 5px', borderLeft: '1.5px solid #e5e7eb', minWidth: 60 }}>PROMEDIO AFIRMACIÓN</th>
                <th style={{ padding: '3px 5px', minWidth: 60 }}>PROMEDIO ESTILO</th>
                <th style={{ padding: '3px 5px', minWidth: 70 }}>PROMEDIO ESTILOS</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                  const estilos: Record<string, Afirm[]> = {};
                  afirmaciones.filter(a => {
                    if (!a.tipo) return false;
                    if (a.categoria === 'estilo') return true;
                    if (a.categoria === 'competencia') return false;
                    // If no explicit category, classify as estilo if its tipo is listed in estilosList
                    if (estilosList.includes(String(a.tipo))) return true;
                    return false;
                  }).forEach(a => {
                    if (!estilos[a.tipo!]) estilos[a.tipo!] = [];
                    estilos[a.tipo!].push(a);
                  });
                  // ensure estilos from formulario_estilos appear even if no afirmaciones
                  estilosList.forEach(s => {
                    if (!estilos[s]) estilos[s] = [];
                  });
                  const palette = ['#1E3A8A', '#1D4ED8', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'];
                  const estIndex: Record<string, number> = {};
                  Object.keys(estilos).forEach((c, i) => { estIndex[c] = i % palette.length; });

                  const entries = selectedCode
                    ? allResponses.filter(e => String(e.evaluadoCodigo) === String(selectedCode))
                    : (selectedName ? allResponses.filter(e => (e.evaluadoNombre || '').toString() === selectedName) : allResponses);
                  const rows: React.ReactNode[] = [];
                  Object.entries(estilos).forEach(([est, estRows]) => {
                    const color = palette[estIndex[est]];
                    // compute estilo average across all afirmaciones in this estilo
                    const allValsForEst: number[] = [];
                    const entries = selectedCode
                      ? allResponses.filter(e => String(e.evaluadoCodigo) === String(selectedCode))
                      : (selectedName ? allResponses.filter(e => (e.evaluadoNombre || '').toString() === selectedName) : allResponses);
                    // if no afirmaciones for this estilo, add placeholder so it renders
                    if (estRows.length === 0) estRows.push({ codigo: undefined, pregunta: '(sin afirmaciones)', tipo: est, categoria: 'estilo' } as Afirm);
                    estRows.forEach(a => {
                      const vals = entries.map(e => e.responses && a.codigo && mapLabelToNumeric(e.responses[a.codigo])).filter((v): v is number => typeof v === 'number' && !isNaN(v));
                      allValsForEst.push(...vals);
                    });
                    const estAvg = allValsForEst.length ? (allValsForEst.reduce((s, v) => s + v, 0) / allValsForEst.length) : '';
                    estRows.forEach((a, idx) => {
                      rows.push(
                        <tr key={`${est}-${a.codigo}`} style={{ borderBottom: '1px solid #e5e7eb', background: '#fff', fontSize: 11, height: 18 }}>
                          {idx === 0 ? <td rowSpan={estRows.length} style={{ padding: '4px 6px', verticalAlign: 'middle', background: color, color: '#000000', fontWeight: 800, textAlign: 'center', fontSize: 12, borderRight: '1px solid #e5e7eb' }}>{String(est)}</td> : null}
                          <td style={{ padding: '4px 6px', verticalAlign: 'middle', fontWeight: 600, color: '#000000', background: color + '22', fontSize: 11 }}>{renderCodigo(a.codigo)}</td>
                        <td style={{ padding: '4px 6px', color: '#000000', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 420, fontSize: 11 }}>{renderVal(a.pregunta)}</td>
                        <td style={{ padding: '3px 5px', borderLeft: '1px solid #e5e7eb', fontSize: 11 }}>{(() => {
                          const values = entries.map(e => e.responses && a.codigo && mapLabelToNumeric(e.responses[a.codigo])).filter((v): v is number => typeof v === 'number' && !isNaN(v));
                          if (!values.length) return '';
                          return (values.reduce((s, v) => s + v, 0) / values.length).toFixed(2);
                        })()}</td>
                          {idx === 0 ? (
                            <td rowSpan={estRows.length} style={{ padding: '3px 5px', fontWeight: 700, fontSize: 11, background: '#e0e7ff', color: '#3730a3', borderLeft: '2px solid #cbd5e1', borderRight: '2px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                              {estAvg ? Number(estAvg).toFixed(2) : ''}
                            </td>
                          ) : null}
                          {idx === 0 ? (
                            <td rowSpan={estRows.length} style={{ padding: '3px 5px', background: '#e0e7ff' }}></td>
                          ) : null}
                      </tr>
                    );
                  });
                });
                return rows;
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}