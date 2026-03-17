-- Migration: 006_add_regional_columns.sql
-- Añade las columnas regional_evaluado y regional_evaluador a la tabla evaluators
-- No hace nada si ya existen (IF NOT EXISTS)

ALTER TABLE public.evaluators
  ADD COLUMN IF NOT EXISTS regional_evaluado text,
  ADD COLUMN IF NOT EXISTS regional_evaluador text;

-- Fin de migración
