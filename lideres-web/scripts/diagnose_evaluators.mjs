#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('Exporta las variables y vuelve a ejecutar. Ej:');
  console.error('  set SUPABASE_URL=... && set SUPABASE_SERVICE_ROLE_KEY=... && node scripts/diagnose_evaluators.mjs');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
const codes = args.length ? args : ['868','917','999','111'];

const lastImportPath = path.resolve(process.cwd(), 'uploads-debug', 'last-import.json');
const readLastImport = () => {
  try {
    const raw = fs.readFileSync(lastImportPath, 'utf8');
    const j = JSON.parse(raw);
    return Array.isArray(j.rows) ? j.rows : [];
  } catch (e) {
    return [];
  }
};

async function run() {
  console.log('Diagnóstico - códigos:', codes.join(', '));

  const imported = readLastImport();
  console.log('\n-- Filas en uploads-debug/last-import.json relacionadas --');
  const related = imported.filter(r => {
    try {
      const ce = String(r['Código del Evaluado'] ?? r['Codigo del Evaluado'] ?? '').trim();
      const cev = String(r['Código del Evaluador'] ?? r['Codigo del Evaluador'] ?? r['Codigo del Evaluador'] ?? '').trim();
      return codes.includes(ce) || codes.includes(cev);
    } catch { return false; }
  });
  console.log(JSON.stringify(related, null, 2));

  try {
    console.log('\n-- Registros en tabla `evaluators` por codigo_evaluado --');
    const byEvaluado = await client.from('evaluators').select('*').in('codigo_evaluado', codes).limit(1000);
    console.log('error:', byEvaluado.error || null);
    console.log(JSON.stringify(byEvaluado.data || [], null, 2));

    console.log('\n-- Registros en tabla `evaluators` por codigo_evaluador --');
    const byEvaluador = await client.from('evaluators').select('*').in('codigo_evaluador', codes).limit(1000);
    console.log('error:', byEvaluador.error || null);
    console.log(JSON.stringify(byEvaluador.data || [], null, 2));

    console.log('\n-- Registros en tabla `personas` por codigo --');
    const personas = await client.from('personas').select('*').in('codigo', codes).limit(1000);
    console.log('error:', personas.error || null);
    console.log(JSON.stringify(personas.data || [], null, 2));
  } catch (err) {
    console.error('Error consultando Supabase:', err);
  }
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(2); });
