-- He habilitado Row Level Security (RLS) y agregué políticas conservadoras para las tablas principales
-- Ejecutar esto en el editor SQL de Supabase o con psql como usuario con privilegios.

-- - He tenido en cuenta que la clave `service_role` omite RLS, por lo que el código servidor que use esa clave seguirá funcionando.
-- - Asumí que las tablas relevantes tienen la columna `created_by uuid` cuando procede; la app debe poblarla al insertar.
-- - Recomiendo revisar y adaptar estas políticas a los roles y reglas de negocio antes de aplicarlas en producción.

-- Enable RLS for tables
ALTER TABLE IF EXISTS forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS form_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS form_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS formulario ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS evaluators ENABLE ROW LEVEL SECURITY;

-- Política: permito que usuarios autenticados inserten/consulten/actualicen/eliminen sus propios `forms`.
-- Requisito: `created_by` debe establecerse con auth.uid() en el INSERT (el servidor debe asignarlo).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'forms_owner_policy') THEN
    EXECUTE $policy$
      CREATE POLICY forms_owner_policy ON forms
        FOR ALL
        USING (created_by = auth.uid())
        WITH CHECK (created_by = auth.uid());
    $policy$;
  END IF;
END$$;

-- Política: permito acceso a `form_versions` sólo cuando el formulario padre pertenece al usuario.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'form_versions_owner_policy') THEN
    EXECUTE $policy$
      CREATE POLICY form_versions_owner_policy ON form_versions
        FOR ALL
        USING (EXISTS (SELECT 1 FROM forms f WHERE f.id = form_versions.form_id AND f.created_by = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM forms f WHERE f.id = form_versions.form_id AND f.created_by = auth.uid()));
    $policy$;
  END IF;
END$$;

-- Política similar para `form_items` (sólo acceso si el formulario padre pertenece al usuario).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'form_items_owner_policy') THEN
    EXECUTE $policy$
      CREATE POLICY form_items_owner_policy ON form_items
        FOR ALL
        USING (EXISTS (SELECT 1 FROM forms f WHERE f.id = form_items.form_id AND f.created_by = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM forms f WHERE f.id = form_items.form_id AND f.created_by = auth.uid()));
    $policy$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'form_item_options_owner_policy') THEN
    EXECUTE $policy$
      CREATE POLICY form_item_options_owner_policy ON form_item_options
        FOR ALL
        USING (EXISTS (SELECT 1 FROM forms f WHERE f.id = (SELECT form_id FROM form_items fi WHERE fi.id = form_item_options.item_id) AND f.created_by = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM forms f WHERE f.id = (SELECT form_id FROM form_items fi WHERE fi.id = form_item_options.item_id) AND f.created_by = auth.uid()));
    $policy$;
  END IF;
END$$;

-- Imports: permito que los usuarios lean/inserten sus propios imports (se espera `created_by`).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'imports_owner_policy') THEN
    EXECUTE $policy$
      CREATE POLICY imports_owner_policy ON imports
        FOR ALL
        USING (created_by = auth.uid())
        WITH CHECK (created_by = auth.uid());
    $policy$;
  END IF;
END$$;

-- Formulario (snapshots legacy): restrinjo acceso sólo al propietario.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'formulario_owner_policy') THEN
    EXECUTE $policy$
      CREATE POLICY formulario_owner_policy ON formulario
        FOR ALL
        USING (created_by = auth.uid())
        WITH CHECK (created_by = auth.uid());
    $policy$;
  END IF;
END$$;

-- Evaluators: por defecto permito que sólo el service role escriba; permito que usuarios autenticados lean sus propias filas.
-- Política de lectura para `evaluators` (asumo que `evaluators` tiene `created_by` que vincula al usuario).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'evaluators_owner_read') THEN
    EXECUTE $policy$
      CREATE POLICY evaluators_owner_read ON evaluators
        FOR SELECT
        USING (created_by = auth.uid());
    $policy$;
  END IF;
END$$;

-- Evito INSERTs directos desde clientes anónimos: requiero `created_by = auth.uid()` al insertar.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'evaluators_owner_insert') THEN
    EXECUTE $policy$
      CREATE POLICY evaluators_owner_insert ON evaluators
        FOR INSERT
        WITH CHECK (created_by = auth.uid());
    $policy$;
  END IF;
END$$;

-- Helper: creo la extensión `pgcrypto` si no existe (ya la añadí en migraciones anteriores).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- End of migration
