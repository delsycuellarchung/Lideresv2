import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan las variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local');
  process.exit(1);
}

const evaluadoNombre = process.argv[2];
const mensajePersonalizado = process.argv[3] || '';
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 500;

if (!evaluadoNombre) {
  console.error('Uso: node scripts/send_emails_from_import.mjs "Nombre Evaluado" "Mensaje opcional" [--limit=200]');
  process.exit(1);
}

console.log(`Buscando evaluadores en Supabase y enviando formularios para: ${evaluadoNombre}`);

async function fetchPersonas() {
  const url = `${SUPABASE_URL.replace(/\/+$, '')}/rest/v1/personas?select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error fetching personas: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data;
}

function buildEvaluators(personas, evaluadoNombre) {
  const evaluators = [];
  for (const p of personas) {
    if (!p.correo) continue;
    // Only evaluadores
    if (String(p.tipo || '').toLowerCase() !== 'evaluador') continue;
    evaluators.push({
      correo: p.correo,
      nombre_evaluador: p.nombre || 'Evaluador',
      nombre_evaluado: evaluadoNombre,
      cargo_evaluado: null,
      area_evaluador: p.area_id || null,
      area_evaluado: null,
    });
    if (evaluators.length >= limit) break;
  }
  return evaluators;
}

async function sendBatch(evaluators) {
  const url = `${APP_URL.replace(/\/+$, '')}/api/send-forms`;
  const body = {
    evaluators,
    formData: {},
    mensajePersonalizado,
  };
  console.log(`Enviando POST a ${url} con ${evaluators.length} evaluadores...`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

(async () => {
  try {
    const personas = await fetchPersonas();
    const evaluators = buildEvaluators(personas, evaluadoNombre);
    if (evaluators.length === 0) {
      console.log('No se encontraron evaluadores con correo. Revisa la tabla `personas`.');
      process.exit(0);
    }
    const result = await sendBatch(evaluators);
    console.log('Resultado:', result.status);
    console.dir(result.json, { depth: 4 });
    process.exit(0);
  } catch (err) {
    console.error('Error en script:', err.message || err);
    process.exit(1);
  }
})();
