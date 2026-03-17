-- 005_create_evaluators.sql
-- Create `evaluators` table to store rows imported from files (both evaluador and evaluado columns)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
