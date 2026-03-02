-- Create table to store each form submission as a separate row
-- Run this in Supabase SQL editor or via psql as a privileged user

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

-- Note: `gen_random_uuid()` requires the `pgcrypto` extension or `pgcrypto`/`pgcrypto`-equivalent; alternatively use uuid_generate_v4().