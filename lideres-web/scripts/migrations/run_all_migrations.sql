-- Run all migrations for LideresV1 (created by assistant)
-- Order: create core tables, then optional alters/backfills
-- WARNING: review before running in production.

BEGIN;

-- Ensure pgcrypto for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 004_create_areas_gerencias_personas.sql
-- Create lookup tables `areas` and `gerencias`, and `personas` core table
CREATE TABLE IF NOT EXISTS areas (
  id serial PRIMARY KEY,
  nombre text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS gerencias (
  id serial PRIMARY KEY,
  nombre text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nombre text,
  cargo text,
  correo text,
  area_id integer REFERENCES areas(id) ON DELETE SET NULL,
  gerencia_id integer REFERENCES gerencias(id) ON DELETE SET NULL,
  tipo text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personas_codigo ON personas (codigo);
CREATE INDEX IF NOT EXISTS idx_personas_correo ON personas (correo);

-- 005_create_evaluators.sql
CREATE TABLE IF NOT EXISTS evaluators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- evaluado fields
  codigo_evaluado text,
  nombre_evaluado text,
  cargo_evaluado text,
  correo_evaluado text,
  area_evaluado text,
  gerencia_evaluado text,
  regional_evaluado text,

  -- evaluador fields
  codigo_evaluador text,
  nombre_evaluador text,
  cargo_evaluador text,
  correo_evaluador text,
  area_evaluador text,
  gerencia_evaluador text,
  regional_evaluador text,

  row_index integer,
  import_batch text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evaluators_import_batch_row_index ON evaluators (import_batch, row_index);
CREATE INDEX IF NOT EXISTS idx_evaluators_correo_evaluador ON evaluators (correo_evaluador);

-- 006_create_form_submissions.sql
CREATE TABLE IF NOT EXISTS form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text,
  evaluator_email text,
  evaluator_name text,
  form_data jsonb DEFAULT '{}'::jsonb,
  responses jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_token ON form_submissions (token);
CREATE INDEX IF NOT EXISTS idx_form_submissions_evaluator_email ON form_submissions (evaluator_email);

-- 007_create_imports_formulario.sql
CREATE TABLE IF NOT EXISTS imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content jsonb,
  saved_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imports_saved_at ON imports (saved_at DESC);

CREATE TABLE IF NOT EXISTS formulario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content jsonb,
  saved_at timestamptz DEFAULT now()
);

-- 008_create_gestion_tables.sql
CREATE TABLE IF NOT EXISTS gestiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text,
  descripcion text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gestion_id uuid REFERENCES gestiones(id) ON DELETE CASCADE,
  persona_id uuid,
  tipo text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evaluaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gestion_id uuid REFERENCES gestiones(id) ON DELETE CASCADE,
  nombre text,
  estado text,
  created_at timestamptz DEFAULT now()
);

-- Existing migrations (001 - add row_index/import_batch)
-- 001_add_row_index_and_import_batch.sql (safe: uses IF NOT EXISTS / IF EXISTS)
ALTER TABLE IF EXISTS evaluators
  ADD COLUMN IF NOT EXISTS row_index integer;

ALTER TABLE IF EXISTS evaluators
  ADD COLUMN IF NOT EXISTS import_batch text;

CREATE INDEX IF NOT EXISTS idx_evaluators_import_batch_row_index ON evaluators (import_batch, row_index);

-- 002_backfill_row_index.sql (non-destructive but intended for existing data)
WITH numbered AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (PARTITION BY import_batch ORDER BY id) - 1) AS rn
  FROM evaluators
)
UPDATE evaluators
SET row_index = numbered.rn
FROM numbered
WHERE evaluators.id = numbered.id;

-- 003_create_form_responses.sql (kept for compatibility; code also uses form_responses)
CREATE TABLE IF NOT EXISTS form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text,
  evaluator_name text,
  evaluado_nombre text,
  evaluado_codigo text,
  responses jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_responses_token ON form_responses (token);
CREATE INDEX IF NOT EXISTS idx_form_responses_evaluado_codigo ON form_responses (evaluado_codigo);

COMMIT;

-- End of migrations
