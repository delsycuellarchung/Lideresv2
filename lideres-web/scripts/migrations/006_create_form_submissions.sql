-- 006_create_form_submissions.sql
-- Create canonical `form_submissions` table used by APIs and admin pages
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
