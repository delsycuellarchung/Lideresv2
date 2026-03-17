#!/usr/bin/env node
const { Client } = require('pg');

const expected = {
  areas: ['id','nombre'],
  gerencias: ['id','nombre'],
  personas: ['id','codigo','nombre','cargo','correo','area_id','gerencia_id','tipo','created_at'],
  evaluators: ['id','codigo_evaluado','nombre_evaluado','cargo_evaluado','correo_evaluado','area_evaluado','gerencia_evaluado','regional_evaluado','codigo_evaluador','nombre_evaluador','cargo_evaluador','correo_evaluador','area_evaluador','gerencia_evaluador','regional_evaluador','row_index','import_batch','created_at'],
  form_submissions: ['id','token','evaluator_email','evaluator_name','form_data','responses','status','created_at','completed_at'],
  imports: ['id','content','saved_at'],
  formulario: ['id','content','saved_at'],
  gestiones: ['id','nombre','descripcion','created_at'],
  asignaciones: ['id','gestion_id','persona_id','tipo','created_at'],
  evaluaciones: ['id','gestion_id','nombre','estado','created_at'],
  form_responses: ['id','token','evaluator_name','evaluado_nombre','evaluado_codigo','responses','created_at']
};

async function run() {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!databaseUrl) {
    console.error('Set DATABASE_URL env var first. Example: postgres://user:pass@host:5432/db');
    process.exit(1);
  }
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const report = {};
  try {
    for (const [table, cols] of Object.entries(expected)) {
      const tableExistsRes = await client.query(
        `SELECT to_regclass($1) AS exists`, [table]
      );
      const exists = tableExistsRes.rows[0].exists !== null;
      report[table] = { exists, missingColumns: [], extraColumns: [], indexes: [] };
      if (!exists) continue;

      const colRes = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]
      );
      const present = colRes.rows.map(r => r.column_name);
      const missing = cols.filter(c => !present.includes(c));
      const extra = present.filter(c => !cols.includes(c));
      report[table].missingColumns = missing;
      report[table].extraColumns = extra;

      // indexes
      const idxRes = await client.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1`, [table]);
      report[table].indexes = idxRes.rows.map(r => ({ name: r.indexname, def: r.indexdef }));
    }

    // Check foreign keys for personas.area_id -> areas.id and personas.gerencia_id -> gerencias.id
    const fkRes = await client.query(`
      SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('personas','asignaciones','asignaciones');
    `);
    report.foreignKeys = fkRes.rows;

    console.log(JSON.stringify(report, null, 2));
  } catch (err) {
    console.error('Error checking schema:', err.message || err);
  } finally {
    await client.end();
  }
}

run();
