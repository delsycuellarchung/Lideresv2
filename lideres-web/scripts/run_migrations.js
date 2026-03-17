#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const sqlPath = path.resolve(__dirname, 'migrations', 'run_all_migrations.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('SQL file not found:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!databaseUrl) {
    console.error('Please set DATABASE_URL environment variable with your Postgres connection string.');
    console.error('Example: postgres://user:password@host:5432/database');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected. Executing migrations...');
    // Split by semicolon + newline might not be necessary; run whole script
    await client.query(sql);
    console.log('Migrations executed successfully.');
  } catch (err) {
    console.error('Migration error:', err.message || err);
    process.exitCode = 2;
  } finally {
    try { await client.end(); } catch {}
  }
}

main();
