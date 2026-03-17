-- 008_create_gestion_tables.sql
-- Minimal tables for gestiones / asignaciones / evaluaciones referenced by admin/gestion
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
