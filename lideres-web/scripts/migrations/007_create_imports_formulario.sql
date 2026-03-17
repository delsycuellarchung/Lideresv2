-- 007_create_imports_formulario.sql
-- Create `imports` and `formulario` tables used by APIs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
