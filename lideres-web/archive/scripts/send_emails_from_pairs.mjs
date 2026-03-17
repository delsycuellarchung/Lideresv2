import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const inputFile = process.argv[2] || 'uploads-debug/last-import.json';
const filterEvaluado = process.argv[3] || null; // optionally pass a codigo or nombre to filter
const batchSizeArg = process.argv.find(a => a.startsWith('--batch='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 200;

if (!fs.existsSync(inputFile)) {
  console.error(`Archivo no encontrado: ${inputFile}`);
  process.exit(1);
}

const raw = fs.readFileSync(inputFile, 'utf8');
let obj;
try {
  obj = JSON.parse(raw);
} catch (e) {
  console.error('Error parseando JSON de import:', e.message);
  process.exit(1);
}

const rows = Array.isArray(obj.rows) ? obj.rows : obj;

function getField(r, candidates) {
  for (const k of candidates) {
    if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') return String(r[k]).trim();
  }
  return null;
}

// Build unique evaluator-evaluado pairs
const pairs = [];
const seen = new Set();
for (const row of rows) {
  const evaluadoCodigo = getField(row, ['Código del Evaluado', 'Codigo del Evaluado', 'codigo_evaluado', 'evaluadoCodigo', 'COD_EVALUADO', 'Código']);
  const evaluadoNombre = getField(row, ['Nombre del Evaluado', 'Nombre Evaluado', 'Nombre', 'nombre', 'nombre_evaluado']);
  const evaluadoCargo = getField(row, ['Cargo del Evaluado', 'Cargo', 'cargo']);

  const evaluadorCodigo = getField(row, ['Código del Evaluador', 'Codigo del Evaluador', 'codigo_evaluador']);
  const evaluadorNombre = getField(row, ['Nombre Evaluador', 'Nombre del Evaluador', 'nombre_evaluador', 'Nombre']);
  const evaluadorCorreo = getField(row, ['Correo del Evaluador', 'Correo', 'correo', 'Email', 'email']);

  if (!evaluadorCorreo) continue;
  // optional filter by evaluado
  if (filterEvaluado) {
    const f = String(filterEvaluado).toLowerCase();
    const matches = (evaluadoCodigo && String(evaluadoCodigo).toLowerCase().includes(f)) || (evaluadoNombre && evaluadoNombre.toLowerCase().includes(f));
    if (!matches) continue;
  }

  const key = `${evaluadorCorreo}::${evaluadoCodigo || ''}::${evaluadoNombre || ''}`;
  if (seen.has(key)) continue;
  seen.add(key);

  pairs.push({
    correo: evaluadorCorreo,
    nombre_evaluador: evaluadorNombre || 'Evaluador',
    nombre_evaluado: evaluadoNombre || 'Evaluado',
    evaluadoCodigo: evaluadoCodigo || null,
    cargo_evaluado: evaluadoCargo || null,
  });
}

if (pairs.length === 0) {
  console.log('No se encontraron pares evaluador→evaluado con correo.');
  process.exit(0);
}

console.log(`Preparados ${pairs.length} pares para envío. Enviando en lotes de ${batchSize}...`);

async function sendBatch(batch) {
  const url = `${APP_URL.replace(/\/+$, '')}/api/send-forms`;
  const evaluators = batch.map(p => ({
    correo: p.correo,
    nombre_evaluador: p.nombre_evaluador,
    nombre_evaluado: p.nombre_evaluado,
    cargo_evaluado: p.cargo_evaluado,
  }));
  const body = { evaluators, formData: {}, mensajePersonalizado: '' };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

(async () => {
  try {
    for (let i = 0; i < pairs.length; i += batchSize) {
      const batch = pairs.slice(i, i + batchSize);
      console.log(`Enviando lote ${i / batchSize + 1} (${batch.length} evaluadores)`);
      const r = await sendBatch(batch);
      console.log('Respuesta:', r.status);
      if (r.json) console.dir(r.json, { depth: 2 });
      // small delay to avoid bursting
      await new Promise((res) => setTimeout(res, 400));
    }
    console.log('Envío completado.');
    process.exit(0);
  } catch (e) {
    console.error('Error al enviar:', e.message || e);
    process.exit(1);
  }
})();
