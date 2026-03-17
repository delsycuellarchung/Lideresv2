"use client";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabaseClient";

type ImportRecord = {
  id: string;
  fileName: string;
  type: string;
  timestamp: number;
};
type RawRow = Record<string, unknown>;
const STORAGE_KEY = "adminImports";
const LOCAL_IMPORT_DATA_KEY = "local_import_data";

export default function AdminImportPage() {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<RawRow[] | null>(null);
  const router = useRouter();
  const REQUIRED_HEADERS = [
    'Codigo del Evaluado',
    'Nombre del Evaluado',
    'Cargo del Evaluado',
    'Correo del Evaluado',
    'Area del Evaluado',
    'Gerencia del Evaluado',
    'Codigo del Evaluador',
    'Nombre Evaluador',
    'Cargo del Evaluador',
    'Correo Evaluador',
    'Area Evaluador',
    'Gerencia Evaluador',
    'Regional del Evaluador',
  ];
  const normalizeHeader = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: ImportRecord[] = JSON.parse(raw);
        parsed.sort((a, b) => b.timestamp - a.timestamp);
        setImports(parsed);
      }
    } catch (e) {
      console.warn("no previous imports", e);
    }
  }, []);
  const saveImports = (list: ImportRecord[]) => {
    setImports(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("could not persist imports", e);
    }
  };

  const clearHistory = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LOCAL_IMPORT_DATA_KEY);
      saveImports([]);
      try { setLocalPreview(null); } catch {}
      setSuccess('Historial de importaciones eliminado');
    } catch (e) {
      console.warn('Error clearing history', e);
      setError('No se pudo eliminar el historial');
    }
  };
  const parseDelimited = (text: string, delimiter: string): RawRow[] => {
    console.log('[PARSE] Parsing delimited data, delimiter=', delimiter);
    const lines = text.trim().split('\n');
    if (lines.length < 2) throw new Error('No hay datos suficientes (mínimo encabezados + 1 fila)');
    const headers = lines[0].split(delimiter);
    const headerMap = new Map<string, string>();
    const buildHeaderMap = () => {
      const map = new Map<string, string>();
            const getSimilarityScore = (str1: string, str2: string): number => {
        const words1 = str1.split(' ').filter(w => w.length > 0);
        const words2 = str2.split(' ').filter(w => w.length > 0);
        
        let matchedCount = 0;
        for (const w1 of words1) {
          if (words2.some(w2 => w2.includes(w1) || w1.includes(w2))) {
            matchedCount++;
          }
        }
                const score = words1.length > 0 ? matchedCount / Math.max(words1.length, words2.length) : 0;
        return score;
      }; 
      for (const required of REQUIRED_HEADERS) {
        const requiredNorm = normalizeHeader(required);
        let bestMatch: string | null = null;
        let bestScore = 0;
                for (const header of headers) {
          if (!header || map.has(requiredNorm)) continue;
          const normalized = normalizeHeader(header);
          const score = getSimilarityScore(requiredNorm, normalized);
                    if (score > bestScore && score >= 0.4) {
            bestScore = score;
            bestMatch = header;
          }
        }
        if (bestMatch) {
          map.set(requiredNorm, bestMatch);
        }
      }
      return map;
    };
    const headerMap2 = buildHeaderMap();
    const missing = REQUIRED_HEADERS.filter((h) => !headerMap2.has(normalizeHeader(h)));
    if (missing.length > 0) {
      console.error('[PASTE] Headers encontrados:', Array.from(headerMap2.keys()));
      throw new Error(`Faltan columnas requeridas: ${missing.join(', ')}`);
    }
    const rows: RawRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(delimiter);
      const row: RawRow = {};
      for (const canonical of REQUIRED_HEADERS) {
        const originalHeader = headerMap2.get(normalizeHeader(canonical));
        const idx = headers.indexOf(originalHeader || '');
        row[canonical] = idx >= 0 ? values[idx] ?? null : null;
      }
      rows.push(row);
    }
    if (rows.length === 0) throw new Error('No hay filas de datos (solo encabezados)');
    return rows;
  };
  const processRows = async (rows: RawRow[]) => {
    // Keep a local preview but do not persist locally unless DB insert succeeds
    try {
      setLocalPreview(rows);
    } catch {}

    let batchId: string | undefined = undefined;
    let savedToDb = false;

    try {
      batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const transformedRows = rows.map((row: RawRow, idx: number) => ({
        codigo_evaluado: row['Codigo del Evaluado'] || row['Código del Evaluado'] || row['Codigo Evaluado'] || null,
        nombre_evaluado: row['Nombre del Evaluado'] || row['Nombre Evaluado'] || null,
        cargo_evaluado: row['Cargo del Evaluado'] || row['Cargo Evaluado'] || null,
        correo_evaluado: row['Correo del Evaluado'] || row['Correo Evaluado'] || row['Correo'] || row['Email'] || row['email'] || null,
        area_evaluado: row['Área del Evaluado'] || row['Area del Evaluado'] || row['Area Evaluado'] || null,
        gerencia_evaluado: row['Gerencia del Evaluado'] || row['Gerencia Evaluado'] || null,
        regional_evaluado: row['Regional del Evaluado'] || row['Regional Evaluado'] || row['Regional'] || row['regional'] || null,
        codigo_evaluador: row['Codigo del Evaluador'] || row['Código del Evaluador'] || row['Codigo Evaluador'] || null,
        nombre_evaluador: row['Nombre Evaluador'] || row['Nombre del Evaluador'] || row['Nombre Evaluador'] || null,
        cargo_evaluador: row['Cargo del Evaluador'] || row['Cargo Evaluador'] || null,
        correo_evaluador: row['Correo del Evaluador'] || row['Correo Evaluador'] || row['Correo'] || row['Email'] || row['email'] || null,
        area_evaluador: row['Área del Evaluador'] || row['Area del Evaluador'] || row['Area Evaluador'] || null,
        gerencia_evaluador: row['Gerencia del Evaluador'] || row['Gerencia Evaluador'] || null,
        regional_evaluador: row['Regional del Evaluador'] || row['Regional Evaluador'] || row['Regional'] || row['regional'] || null,
        row_index: idx,
        import_batch: batchId,
      }));
      try {
        console.log('[IMPORT] First transformed row:', transformedRows[0]);
        const res = await fetch('/api/import-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: transformedRows }),
        });
        const json = await res.json();
        if (!res.ok) {
          console.warn('/api/import-save error', json);
          setError(json?.error || 'Error saving via server API');
          savedToDb = false;
        } else {
          // show inserted count and any removed columns for debugging
          const inserted = json?.inserted ?? json?.ok ? transformedRows.length : 0;
          const removed = Array.isArray(json?.removedColumns) ? json.removedColumns : [];
          if (removed.length > 0) {
            setError(`Se eliminaron columnas no existentes en BD: ${removed.join(', ')}`);
          }
          setSuccess(`✓ Importados ${inserted} registros correctamente${removed.length > 0 ? ' (columnas eliminadas: ' + removed.join(', ') + ')' : ''}`);
          savedToDb = true;
        }
      } catch (callErr) {
        console.error('/api/import-save exception', callErr);
        setError(`Error calling import-save API: ${callErr instanceof Error ? callErr.message : String(callErr)}`);
        savedToDb = false;
      }
    } catch (supaErr) {
      console.error('[SUPABASE] Exception:', supaErr);
      setError(`Error de conexión con BD: ${supaErr instanceof Error ? supaErr.message : String(supaErr)}`);
      savedToDb = false;
    }

    if (!savedToDb) {
      // Do not persist local history or redirect when DB insert failed
      return;
    }

    // Persist last-import locally and adminImports history after successful DB save
    try {
      localStorage.setItem(LOCAL_IMPORT_DATA_KEY, JSON.stringify({ rows, savedAt: new Date().toISOString() }));
    } catch (e) {
      console.warn('could not persist local import data', e);
    }

    const rec = {
      id: typeof batchId !== 'undefined' ? batchId : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fileName: `import-${new Date().toISOString().slice(0, 10)}`,
      type: 'users',
      timestamp: Date.now(),
    };
    saveImports([rec, ...imports]);
    setSuccess(`✓ Importados ${rows.length} registros correctamente`);
    setTimeout(() => {
      try {
        router.push('/admin/datos-importados');
      } catch {
        window.location.href = '/admin/datos-importados';
      }
    }, 1200);
  };
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const processFile = async (file: File) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        try {
          // Use server-side parsing to avoid client-side XLSX issues
          const fd = new FormData();
          fd.append('file', file);
          const res = await fetch('/api/upload', { method: 'POST', body: fd });
          const json = await res.json();
          if (!res.ok || json?.error) {
            console.warn('[UPLOAD API] error', json);
            setError(json?.error || json?.details || 'Error al procesar el archivo en el servidor');
            return;
          }

          const jsonRows: any[] = json.rows || [];
          if (!Array.isArray(jsonRows) || jsonRows.length === 0) {
            setError('El archivo no contiene filas válidas');
            return;
          }

          // Map server-returned JSON rows (object with headers as keys) to RawRow[]
          const keys = Object.keys(jsonRows[0]);

          const findKey = (candidates: string[], mustContain: string[], anyOf?: string[]) => {
            for (const key of candidates) {
              const nk = normalizeHeader(key);
              const hasAllMust = mustContain.every(m => nk.includes(m));
              if (!hasAllMust) continue;
              if (!anyOf || anyOf.length === 0) return key;
              for (const a of anyOf) {
                if (nk.includes(a)) return key;
              }
            }
            return null;
          };

          const rows: RawRow[] = jsonRows.map((r: any) => {
            const out: RawRow = {};
            // Evaluado fields
            out['Codigo del Evaluado'] = r[findKey(keys, ['codigo'], ['evaluado', 'evaluado']) ?? ''] ?? r['CÃ³digo del Evaluado'] ?? r['CÃ³digo del Evaluado'] ?? null;
            out['Nombre del Evaluado'] = r[findKey(keys, ['nombre'], ['evaluado']) ?? ''] ?? r['Nombre del Evaluado'] ?? null;
            out['Cargo del Evaluado'] = r[findKey(keys, ['cargo'], ['evaluado']) ?? ''] ?? r['Cargo del Evaluado'] ?? null;
            out['Correo del Evaluado'] = r[findKey(keys, ['correo','email'], ['evaluado']) ?? ''] ?? r['Correo del Evaluado'] ?? null;
            out['Area del Evaluado'] = r[findKey(keys, ['area'], ['evaluado']) ?? ''] ?? r['Ãrea del Evaluado'] ?? r['Área del Evaluado'] ?? null;
            out['Gerencia del Evaluado'] = r[findKey(keys, ['gerencia'], ['evaluado']) ?? ''] ?? r['Gerencia del Evaluado'] ?? null;
            out['Regional del Evaluado'] = r[findKey(keys, ['regional'], ['evaluado']) ?? ''] ?? r['Regional del Evaluado'] ?? null;

            // Evaluador fields
            out['Codigo del Evaluador'] = r[findKey(keys, ['codigo'], ['evaluador']) ?? ''] ?? r['Codigo del Evaluador'] ?? null;
            out['Nombre del Evaluador'] = r[findKey(keys, ['nombre'], ['evaluador']) ?? ''] ?? r['Nombre Evaluador'] ?? r['Nombre del Evaluador'] ?? null;
            out['Cargo del Evaluador'] = r[findKey(keys, ['cargo'], ['evaluador']) ?? ''] ?? r['Cargo del Evaluador'] ?? null;
            out['Correo del Evaluador'] = r[findKey(keys, ['correo','email'], ['evaluador']) ?? ''] ?? r['Correo del Evaluador'] ?? null;
            out['Area del Evaluador'] = r[findKey(keys, ['area'], ['evaluador']) ?? ''] ?? r['Ãrea del Evaluador'] ?? r['Area del Evaluador'] ?? null;
            out['Gerencia del Evaluador'] = r[findKey(keys, ['gerencia'], ['evaluador']) ?? ''] ?? r['Gerencia del Evaluador'] ?? null;
            out['Regional del Evaluador'] = r[findKey(keys, ['regional'], ['evaluador']) ?? ''] ?? r['Regional del Evaluador'] ?? null;

            return out;
          });

          await processRows(rows);
        } catch (xlsxErr) {
          console.error('[CLIENT] Error uploading/parsing XLSX via API', xlsxErr);
          setError('No se pudo procesar el archivo .xlsx en el servidor. Alternativa: exporta a CSV y vuelve a subir.');
        }
      } else {
        setError('Solo se permiten archivos .xls o .xlsx');
        return;
      }
    } catch (err: unknown) {
      console.error('[FILE] Error parsing file', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      // clear input value to allow same file re-upload
      try { if (fileInputRef.current) fileInputRef.current.value = ''; } catch {}
    }
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };
  return (
    <section>
      <h2 style={{ margin: '0 0 24px 24px', fontSize: 32, fontWeight: 800, transform: 'translateY(-62px)' }}>IMPORTAR DATOS
</h2>
      <div style={{ marginLeft: 24, maxWidth: 1150 }}>
          <div style={{ marginBottom: 20, maxWidth: 1200 }}>
          <div style={{ flex: 1 }}>
            <div
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) processFile(f); }}
              onDragOver={(e) => e.preventDefault()}
              role="button"
              tabIndex={0}
              onKeyDown={() => {}}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed rgba(14,165,233,0.22)',
                padding: 18,
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: 'linear-gradient(90deg, rgba(14,165,233,0.06), rgba(125,211,252,0.02))',
                boxShadow: '0 6px 18px rgba(14,165,233,0.06)',
                cursor: 'pointer',
                minHeight: 140,
                transition: 'box-shadow 160ms ease, transform 120ms ease'
              }}>
              <div style={{ fontSize: 40, color: '#06b6d4' }}>📁</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Arrastra y suelta tu archivo aquí</div>
              <button
                onClick={(ev) => { ev.stopPropagation(); fileInputRef.current?.click(); }}
                className="btn-press"
                style={{ marginTop: 6, padding: '8px 12px', borderRadius: 8 }}
              >Seleccionar archivo</button>
              <input ref={fileInputRef} type="file" accept=".xls,.xlsx" onChange={handleFileChange} disabled={loading} style={{ display: 'none' }} />
            </div>
          </div>
        </div>
        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
          }}>
            ✗ {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#dcfce7',
            border: '1px solid #86efac',
            color: '#166534',
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
          }}>
            {success}
          </div>
        )}
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>
              Importaciones Recientes:
            </h3>
            <div>
              <button
                onClick={clearHistory}
                className="btn-press"
                style={{ padding: '6px 10px', borderRadius: 8, fontSize: 13 }}
              >Borrar historial</button>
            </div>
          </div>
          {imports.length === 0 ? (
            <p style={{ color: '#666' }}>No hay importaciones registradas</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Importación</th>
                  <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((imp) => (
                  <tr key={imp.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: 8 }}>{imp.fileName}</td>
                    <td style={{ padding: 8 }}>
                      {new Date(imp.timestamp).toLocaleString('es-ES')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
