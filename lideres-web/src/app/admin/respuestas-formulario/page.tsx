'use client';

import React from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function RespuestasFormularioPage() {
  const [responses, setResponses] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [completedCount, setCompletedCount] = React.useState<number | null>(null);
  const [pendingCount, setPendingCount] = React.useState<number | null>(null);
  const [filter, setFilter] = React.useState<'all' | 'pending' | 'completed'>('all');
  // quick-toggle: ocultar la lista en la UI sin tocar la BD (set true para ocultar)
  const hideList = false;
  

  React.useEffect(() => {
    loadResponses();
    // poll for new responses (non-destructive auto-refresh)
    const iv = setInterval(() => { try { loadResponses(); } catch {} }, 10000);
    return () => clearInterval(iv);
  }, []);

  // Compute displayed responses: prefer DB-loaded responses, fallback to localStorage
  const displayedResponses = React.useMemo(() => {
    try {
      const localFallback = (() => {
        try {
          const raw = window.localStorage.getItem('form_responses') || '[]';
          return JSON.parse(raw) || [];
        } catch {
          return [];
        }
      })();

      const source = (responses && responses.length) ? responses : localFallback;

      if (!source) return [] as any[];
      if (filter !== 'all') return (source || []).filter((r: any) => r.status === filter);
      return source as any[];
    } catch (e) {
      return responses || [];
    }
  }, [responses, filter]);

  const loadResponses = async () => {
    try {
      const disableDb = String(process.env.NEXT_PUBLIC_DISABLE_DB || '').toLowerCase() === 'true';

      if (!supabase || disableDb) {
        setResponses([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('form_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setResponses(data || []);
      // update counters (visual only)
      try {
        if (supabase) {
          const compRes = await supabase.from('form_submissions').select('id', { count: 'exact' }).eq('status', 'completed');
          const pendRes = await supabase.from('form_submissions').select('id', { count: 'exact' }).eq('status', 'pending');
          const comp = (compRes && (compRes as any).count) || 0;
          const pend = (pendRes && (pendRes as any).count) || 0;
          setCompletedCount(typeof comp === 'number' ? comp : 0);
          setPendingCount(typeof pend === 'number' ? pend : 0);
        }
      } catch (e) {
        console.warn('Error cargando contadores de envíos:', e);
      }
    } catch (error) {
      console.error('Error loading responses:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadResponses();
  }, [filter]);

  const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(dateString));
};

  const getFromRow = (row: any, keys: string[]) => {
    if (!row) return '';
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(row, k) && row[k]) return row[k];
    }
    // also try nested responses object
    const nested = row.responses || row.respuestas || {};
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(nested, k) && nested[k]) return nested[k];
    }
    return '';
  };

  const [codeNameMap, setCodeNameMap] = React.useState<Record<string, string>>({});
  const [nameToCodeMap, setNameToCodeMap] = React.useState<Record<string, string>>({});
  const [evaluatorsSearch, setEvaluatorsSearch] = React.useState<Array<{code:string,name:string,nameNorm:string,tokens:string[]}>>([]);

  React.useEffect(() => {
    // fetch evaluators/personas mapping once to resolve evaluado names by code when missing
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/evaluators');
        if (!res.ok) return;
        const json = await res.json().catch(() => ({}));
        const list = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
        const map: Record<string, string> = {};
        list.forEach((it: any) => {
          const code = String((it.codigo_evaluado ?? it.codigo ?? it.evaluadoCodigo ?? '')).trim();
          const name = String((it.nombre_evaluado ?? it.nombre ?? it.evaluadoNombre ?? '')).trim();
          if (code && name) map[code] = map[code] || name;
        });
        // also build searchable evaluators list for better name matching (non-destructive)
        const normalizeName = (s: string) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
        const searchList: Array<{code:string,name:string,nameNorm:string,tokens:string[]}> = [];
        list.forEach((it: any) => {
          const rawNombre = String(it.nombre_evaluado || it.nombre || it.evaluadoNombre || '')?.trim();
          const codigoEvaluado = it.codigo_evaluado ?? it.codigo ?? null;
          if (!rawNombre || !codigoEvaluado) return;
          const nameNorm = normalizeName(rawNombre);
          const tokens = nameNorm.split(' ').filter(Boolean);
          searchList.push({ code: String(codigoEvaluado), name: rawNombre, nameNorm, tokens });
        });
        const nameCode: Record<string,string> = {};
        searchList.forEach(s => { if (s.nameNorm) nameCode[s.nameNorm] = nameCode[s.nameNorm] || s.code; });
        if (mounted) {
          setCodeNameMap(map);
          setEvaluatorsSearch(searchList);
          setNameToCodeMap(nameCode);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  const resolveEvaluadoName = (row: any) => {
    // search common locations
    const candidates = [
      // top-level
      'evaluado_nombre', 'evaluadoName', 'evaluado', 'evaluado_name', 'evaluadoNombre',
      'evaluadoNombre', 'evaluado_nombre', 'nombre_evaluado', 'nombre', 'nombreEvaluado',
      // form_data keys
      'form_data.evaluado_nombre', 'form_data.nombre_evaluado',
    ];
    // try root and responses/form_data
    let val = getFromRow(row, ['evaluado_nombre','evaluadoName','evaluado','evaluado_name','evaluadoNombre','nombre_evaluado','nombre','nombreEvaluado']);
    if (val) return String(val);
    // try form_data nested
    try {
      const fd = row.form_data || row.formData || {};
      if (fd) {
        const k = fd.evaluado_nombre || fd.nombre_evaluado || fd.nombre || fd.nombre_evaluado || fd.evaluado || null;
        if (k) return String(k);
      }
    } catch (e) {}

    // try responses nested keys not covered
    try {
      let resp = row.responses || row.respuestas || {};
      if (Array.isArray(resp)) {
        for (const item of resp) {
          const parsed = typeof item === 'string' ? (() => { try { return JSON.parse(item); } catch { return {}; } })() : (item || {});
          const r = parsed.evaluado_nombre || parsed.nombre_evaluado || parsed.evaluado || parsed.nombre || null;
          if (r) return String(r);
        }
      }
      const r = resp.evaluado_nombre || resp.nombre_evaluado || resp.evaluado || resp.nombre || null;
      if (r) return String(r);
    } catch (e) {}

    // fallback: lookup by code
    const code = (row.evaluado_codigo || row.evaluadoCodigo || row.codigo_evaluado || (row.responses && (row.responses.evaluado_codigo || row.responses.codigo_evaluado)) || row.token || '').toString().trim();
    if (code && codeNameMap[code]) return String(codeNameMap[code]);

    // try direct name->code map (normalized, case-insensitive)
    try {
      const normalizeName = (s: string) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
      const name = (row.evaluado_nombre || row.evaluadoNombre || row.nombre_evaluado || row.nombre || row.responses?.evaluado_nombre || row.responses?.nombre || '').toString().trim();
      const nameNorm = normalizeName(name);
      if (nameNorm && nameToCodeMap && nameToCodeMap[nameNorm]) {
        const c = nameToCodeMap[nameNorm];
        if (c && codeNameMap[c]) return String(codeNameMap[c]);
      }

      // try fuzzy match by normalized name against evaluatorsSearch (non-destructive)
      if (nameNorm && evaluatorsSearch && evaluatorsSearch.length) {
        // exact
        const exact = evaluatorsSearch.find(e => e.nameNorm === nameNorm);
        if (exact && exact.code) return String(codeNameMap[exact.code] || exact.name || '');
        const tokens = nameNorm.split(' ').filter(Boolean);
        // token-all
        for (const ev of evaluatorsSearch) {
          const hasAll = tokens.every(t => ev.nameNorm.includes(t));
          if (hasAll) return String(codeNameMap[ev.code] || ev.name || '');
        }
        // partial token
        for (const ev of evaluatorsSearch) {
          if (tokens.some(t => t.length >= 3 && ev.nameNorm.includes(t))) return String(codeNameMap[ev.code] || ev.name || '');
        }
      }
    } catch (e) {}

    return '';
  };

  const computeDisplayStatus = (row: any) => {
    try {
      if (row.status === 'completed') return 'completed';
      if (row.expires_at) {
        const exp = new Date(row.expires_at);
        if (Date.now() > exp.getTime()) return 'expired';
      }
      return 'pending';
    } catch (e) {
      return row.status || 'pending';
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      pending: { bg: 'rgba(245, 158, 11, 0.1)', text: '#F59E0B' },
      completed: { bg: 'rgba(34, 197, 94, 0.1)', text: '#16A34A' },
      expired: { bg: 'rgba(255, 107, 107, 0.1)', text: '#FF6B6B' },
    };

    const color = colors[status] || colors.pending;
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      completed: 'Completado',
      expired: 'Expirado',
    };

    return (
      <span
        style={{
          padding: '4px 12px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          background: color.bg,
          color: color.text,
        }}
      >
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div style={{ padding: 28 }}>
      <h2 style={{ margin: '-85px 0 24px 0', fontSize: 32, fontWeight: 800 }}>RESPUESTAS DEL FORMULARIO</h2>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['all', 'pending', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '10px 20px',
                background: filter === f ? '#4F46E5' : 'rgba(15,23,42,0.05)',
                color: filter === f ? 'white' : '#0F172A',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendientes' : 'Completadas'}
            </button>
          ))}
        </div>
      </div>
      {/* Counters visual only: completados / pendientes */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ background: '#ecfdf5', color: '#065f46', padding: '8px 12px', borderRadius: 8, fontWeight: 700 }}>
            {completedCount === null ? '—' : String(completedCount)}
          </div>
          <div style={{ fontSize: 13, color: '#065f46' }}>Respondieron</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ background: '#fff1f2', color: '#991b1b', padding: '8px 12px', borderRadius: 8, fontWeight: 700 }}>
            {pendingCount === null ? '—' : String(pendingCount)}
          </div>
          <div style={{ fontSize: 13, color: '#991b1b' }}>Pendientes</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'rgba(15,23,42,0.6)' }}>Cargando respuestas...</div>
      ) : (hideList || displayedResponses.length === 0) ? (
        <div style={{ padding: 32, background: 'rgba(15,23,42,0.02)', borderRadius: 8, textAlign: 'center', color: 'rgba(15,23,42,0.6)' }}>
          No hay respuestas disponibles
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
                <tr style={{ background: 'rgba(15,23,42,0.02)', borderBottom: '2px solid rgba(15,23,42,0.1)' }}>
                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#0F172A' }}>Evaluador</th>
                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#0F172A' }}>Correo destino</th>
                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#0F172A' }}>Evaluado</th>
                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#0F172A' }}>Estado</th>
                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#0F172A' }}>Enviado</th>
                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#0F172A' }}>Completado</th>
              </tr>
            </thead>
            <tbody>
              
                {displayedResponses.map((response: any) => {
                  const disp = computeDisplayStatus(response);
                  const evaluatorNameVal = getFromRow(response, ['evaluator_name', 'evaluatorName', 'evaluador', 'Nombre Evaluador', 'Nombre del Evaluador', 'nombre']) || '';
                  const evaluatorEmailVal = getFromRow(response, ['evaluator_email', 'evaluatorEmail', 'email', 'Correo del Evaluador', 'Correo del Evaluado', 'correo']) || '';
                    const evaluadoVal = resolveEvaluadoName(response) || '';
                  const completedAtVal = response.completed_at || response.completedAt || response.createdAt || null;
                    return (
                      <React.Fragment key={response.id || response.token || response.createdAt || Math.random()}>
                        <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
                          <td style={{ padding: 16, color: '#0F172A', fontWeight: 500 }}>{evaluatorNameVal}</td>
                          <td style={{ padding: 16, color: 'rgba(15,23,42,0.65)', fontSize: 13 }}>{evaluatorEmailVal}</td>
                          <td style={{ padding: 16, color: 'rgba(15,23,42,0.65)', fontSize: 13 }}>{evaluadoVal}</td>
                          <td style={{ padding: 16 }}>{getStatusBadge(disp)}</td>
                          <td style={{ padding: 16 }}>
                            {disp === 'completed' ? (
                              <span style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.08)', color: '#16A34A', fontWeight: 700 }}>Sí</span>
                            ) : (
                              <span style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(15,23,42,0.04)', color: '#374151', fontWeight: 700 }}>No</span>
                            )}
                          </td>
                          <td style={{ padding: 16, color: 'rgba(15,23,42,0.65)', fontSize: 13 }}>{completedAtVal ? formatDate(completedAtVal) : ''}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
