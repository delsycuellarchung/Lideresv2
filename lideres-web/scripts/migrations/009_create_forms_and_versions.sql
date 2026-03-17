-- 009_create_forms_and_versions.sql
-- Create `forms`, `form_versions`, `form_items` and `form_item_options` for versioned editable forms
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  current_version_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_forms_created_at ON forms (created_at DESC);

CREATE TABLE IF NOT EXISTS form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid REFERENCES forms(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  note text
);

CREATE INDEX IF NOT EXISTS idx_form_versions_form_id ON form_versions (form_id);
CREATE INDEX IF NOT EXISTS idx_form_versions_created_at ON form_versions (created_at DESC);

CREATE TABLE IF NOT EXISTS form_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid REFERENCES forms(id) ON DELETE CASCADE,
  version_id uuid REFERENCES form_versions(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  position integer NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_form_items_form_id ON form_items (form_id);

CREATE TABLE IF NOT EXISTS form_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES form_items(id) ON DELETE CASCADE,
  content jsonb NOT NULL,
  position integer,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_form_item_options_item_id ON form_item_options (item_id);

-- Optional helper: ensure a forms.current_version_id integrity trigger could be added later.
