-- 004_create_areas_gerencias_personas.sql
-- Create lookup tables `areas` and `gerencias`, and `personas` core table
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
