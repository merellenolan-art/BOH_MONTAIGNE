/*
# BOH Mountain — Extended Schema

Extends the existing BOH Operations Hub schema with new entities required by the
BOH Mountain dashboards. Does NOT modify or drop existing tables/columns — only
adds new tables and (where safe) new columns to existing tables.

## 1. New tables

### `boh_departments` (reference)
- Lookup of Gucci departments in the 100–945 friendly range used by the boutique.
- `dept_code` (text, PK) — friendly numeric id like "100", "110"
- `sap_code` (text) — corresponding SAP/MB52 department code (e.g. "K112100"),
  nullable because some friendly rows may not map to a SAP code yet.
- `name` (text) — human label, e.g. "Femme prêt-à-porter".
- `division` (text) — high level grouping: "Femme" / "Homme" / "Bagages" / etc.

### `boh_kpi_overrides` (single-tenant, editable from the Home dashboard)
- Manual KPI values entered by the team lead. Replaces hard-coded demo numbers.
- `key` (text, PK): annual_sales | ytd_sales | mtd_sales | shrinkage_3m |
  compression_rate | conversion_rate | saturation_rate
- `label` (text) — display label
- `value_numeric` (numeric) — the numeric value
- `unit` (text) — "EUR" | "%" | "ratio"
- `updated_at` (timestamptz)
- `updated_by` (text) — optional note

### `boh_cites_items`
- Products subject to CITES regulation tracked in store.
- `id` (uuid, PK)
- `sku` (text)
- `description` (text)
- `quantity` (int, default 1)
- `location` (text) — boutique location / shelf
- `value` (numeric)
- `dossier_status` (text) — todo | in_progress | complete | reexport_required
- `docs_certificate` (bool) — manual checkbox: CITES certificate present
- `docs_invoice` (bool)
- `docs_export` (bool) — re-export permit
- `docs_photo` (bool) — product photo on file
- `notes` (text)
- `updated_at` (timestamptz)

### `boh_packaging_items`
- Visual packaging library.
- `id` (uuid, PK)
- `sku` (text)
- `barcode` (text)
- `name` (text)
- `description` (text)
- `usage` (text)
- `tsl` (text) — colour/styling code if applicable
- `on_hand` (int, default 0)
- `in_transit` (int, default 0)
- `reorder_threshold` (int, default 50)
- `sensitive` (bool, default false) — sensitive packaging flag
- `image_url` (text) — stock photo URL
- `updated_at` (timestamptz)

### `boh_dept_notes`
- Per-department analyst notes keyed by dept_code. Replaces the hypothesis/
  action columns baked into boh_department_summary so notes survive rebuilds
  independent of the consolidation engine.
- `dept_code` (text, PK)
- `risk` (text) — ok | attention | action (manual override)
- `comment` (text) — free-form action/comment
- `updated_at` (timestamptz)

## 2. Existing tables — additions
- `boh_imports.guessed_file_type` is NOT added; the existing `file_type` column
  is reused. No structural change to existing tables (data safety: no DROPs,
  no type changes, no renames).
- `boh_file_types`: a new row for "fastshipment" (Expeditions FastShipment) and
  "packaging_lib" (Packaging library import) and "cites_extract" is added via
  INSERT ... ON CONFLICT — existing reference data is preserved.

## 3. Security
- RLS enabled on every new table. Single-tenant internal tool, data is shared:
  TO anon, authenticated with full CRUD, identical to existing tables.
*/

-- Departments reference (100 → 945 friendly range). Gucci Montaigne uses ~40.
CREATE TABLE IF NOT EXISTS boh_departments (
  dept_code text PRIMARY KEY,
  sap_code text,
  name text NOT NULL DEFAULT '',
  division text NOT NULL DEFAULT ''
);

-- Manual KPI overrides from the Home dashboard.
CREATE TABLE IF NOT EXISTS boh_kpi_overrides (
  key text PRIMARY KEY,
  label text NOT NULL,
  value_numeric numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'EUR',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

-- CITES regulated items.
CREATE TABLE IF NOT EXISTS boh_cites_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  location text NOT NULL DEFAULT '',
  value numeric NOT NULL DEFAULT 0,
  dossier_status text NOT NULL DEFAULT 'todo',
  docs_certificate boolean NOT NULL DEFAULT false,
  docs_invoice boolean NOT NULL DEFAULT false,
  docs_export boolean NOT NULL DEFAULT false,
  docs_photo boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Packaging library.
CREATE TABLE IF NOT EXISTS boh_packaging_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL DEFAULT '',
  barcode text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  usage text NOT NULL DEFAULT '',
  tsl text NOT NULL DEFAULT '',
  on_hand integer NOT NULL DEFAULT 0,
  in_transit integer NOT NULL DEFAULT 0,
  reorder_threshold integer NOT NULL DEFAULT 50,
  sensitive boolean NOT NULL DEFAULT false,
  image_url text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Per-department analyst notes (survives consolidation rebuilds).
CREATE TABLE IF NOT EXISTS boh_dept_notes (
  dept_code text PRIMARY KEY,
  risk text NOT NULL DEFAULT 'ok',
  comment text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE boh_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE boh_kpi_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE boh_cites_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE boh_packaging_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE boh_dept_notes ENABLE ROW LEVEL SECURITY;

-- boh_departments
DROP POLICY IF EXISTS "anon_all_departments" ON boh_departments;
CREATE POLICY "anon_all_departments" ON boh_departments
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_manage_departments_ins" ON boh_departments;
CREATE POLICY "anon_manage_departments_ins" ON boh_departments
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_manage_departments_upd" ON boh_departments;
CREATE POLICY "anon_manage_departments_upd" ON boh_departments
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_manage_departments_del" ON boh_departments;
CREATE POLICY "anon_manage_departments_del" ON boh_departments
  FOR DELETE TO anon, authenticated USING (true);

-- boh_kpi_overrides
DROP POLICY IF EXISTS "anon_all_kpi" ON boh_kpi_overrides;
CREATE POLICY "anon_all_kpi" ON boh_kpi_overrides
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_kpi" ON boh_kpi_overrides;
CREATE POLICY "anon_ins_kpi" ON boh_kpi_overrides
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_kpi" ON boh_kpi_overrides;
CREATE POLICY "anon_upd_kpi" ON boh_kpi_overrides
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_kpi" ON boh_kpi_overrides;
CREATE POLICY "anon_del_kpi" ON boh_kpi_overrides
  FOR DELETE TO anon, authenticated USING (true);

-- boh_cites_items
DROP POLICY IF EXISTS "anon_all_cites" ON boh_cites_items;
CREATE POLICY "anon_all_cites" ON boh_cites_items
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_cites" ON boh_cites_items;
CREATE POLICY "anon_ins_cites" ON boh_cites_items
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_cites" ON boh_cites_items;
CREATE POLICY "anon_upd_cites" ON boh_cites_items
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_cites" ON boh_cites_items;
CREATE POLICY "anon_del_cites" ON boh_cites_items
  FOR DELETE TO anon, authenticated USING (true);

-- boh_packaging_items
DROP POLICY IF EXISTS "anon_all_packaging" ON boh_packaging_items;
CREATE POLICY "anon_all_packaging" ON boh_packaging_items
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_packaging" ON boh_packaging_items;
CREATE POLICY "anon_ins_packaging" ON boh_packaging_items
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_packaging" ON boh_packaging_items;
CREATE POLICY "anon_upd_packaging" ON boh_packaging_items
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_packaging" ON boh_packaging_items;
CREATE POLICY "anon_del_packaging" ON boh_packaging_items
  FOR DELETE TO anon, authenticated USING (true);

-- boh_dept_notes
DROP POLICY IF EXISTS "anon_all_dept_notes" ON boh_dept_notes;
CREATE POLICY "anon_all_dept_notes" ON boh_dept_notes
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_dept_notes" ON boh_dept_notes;
CREATE POLICY "anon_ins_dept_notes" ON boh_dept_notes
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_dept_notes" ON boh_dept_notes;
CREATE POLICY "anon_upd_dept_notes" ON boh_dept_notes
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_dept_notes" ON boh_dept_notes;
CREATE POLICY "anon_del_dept_notes" ON boh_dept_notes
  FOR DELETE TO anon, authenticated USING (true);

-- Additional file-type reference rows (idempotent — existing 14 preserved).
INSERT INTO boh_file_types (code, name, category, expected_fields) VALUES
  ('fastshipment', 'FastShipment / Expéditions', 'logistics',
   '["reference","sku","department","quantity","value","date","destination","status"]'::jsonb),
  ('packaging_lib', 'Packaging Library', 'regulation',
   '["sku","barcode","department","quantity","name","description"]'::jsonb),
  ('cites_extract', 'CITES (extraction SAP)', 'regulation',
   '["sku","department","quantity","value","location","description"]'::jsonb),
  ('oracle_sales', 'Oracle Caisse', 'sales',
   '["sku","quantity","value","date"]'::jsonb),
  ('sap_sales', 'SAP Ventes', 'sales',
   '["sku","quantity","value","date"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- Seed Gucci Montaigne department reference (friendly 100→945 range, ~40 rows).
-- Codes are a representative sample; the boutique can extend via import.
INSERT INTO boh_departments (dept_code, sap_code, name, division) VALUES
  ('100', 'K112100', 'Femme Prêt-à-porter', 'Femme'),
  ('110', 'K112110', 'Femme Tailleur', 'Femme'),
  ('120', 'K112120', 'Femme Fourrure', 'Femme'),
  ('130', 'K112130', 'Femme Soie', 'Femme'),
  ('140', 'K112140', 'Femme Maille', 'Femme'),
  ('150', 'K112150', 'Femme Shoes', 'Femme'),
  ('160', 'K112160', 'Femme Sneakers', 'Femme'),
  ('170', 'K112170', 'Femme Small Leather Goods', 'Femme'),
  ('180', 'K112180', 'Femme Handbags', 'Femme'),
  ('190', 'K112190', 'Femme Travel', 'Femme'),
  ('200', 'K112200', 'Femme Jewellery', 'Femme'),
  ('210', 'K112210', 'Femme Watches', 'Femme'),
  ('220', 'K112220', 'Femme Fragrances', 'Femme'),
  ('230', 'K112230', 'Femme Cosmetics', 'Femme'),
  ('240', 'K112240', 'Femme Eyewear', 'Femme'),
  ('250', 'K112250', 'Femme Textile accessories', 'Femme'),
  ('300', 'K112300', 'Homme Prêt-à-porter', 'Homme'),
  ('310', 'K112310', 'Homme Tailleur', 'Homme'),
  ('320', 'K112320', 'Homme Outerwear', 'Homme'),
  ('330', 'K112330', 'Homme Shoes', 'Homme'),
  ('340', 'K112340', 'Homme Sneakers', 'Homme'),
  ('350', 'K112350', 'Homme Small Leather Goods', 'Homme'),
  ('360', 'K112360', 'Homme Handbags', 'Homme'),
  ('370', 'K112370', 'Homme Travel', 'Homme'),
  ('380', 'K112380', 'Homme Jewellery', 'Homme'),
  ('390', 'K112390', 'Homme Watches', 'Homme'),
  ('400', 'K112400', 'Homme Fragrances', 'Homme'),
  ('410', 'K112410', 'Homme Textile accessories', 'Homme'),
  ('500', 'K112500', 'Bagages', 'Maison'),
  ('510', 'K112510', 'Soft Luggage', 'Maison'),
  ('520', 'K112520', 'Décoratif Maison', 'Maison'),
  ('600', 'K112600', 'Gift Collection', 'Maison'),
  ('700', 'K112700', 'Kids & Baby', 'Maison'),
  ('800', 'K112800', 'Art de la Table', 'Maison'),
  ('850', 'K112850', 'Stations & Fragrances Décor', 'Maison'),
  ('900', 'K112900', 'Décoration', 'Maison'),
  ('910', 'K112910', 'Livres & Catalogues', 'Maison'),
  ('920', 'K112920', 'Communication', 'Maison'),
  ('930', 'K112930', 'Visual Merchandising', 'Maison'),
  ('940', 'K112940', 'Packaging Boutique', 'Maison'),
  ('945', 'K112945', 'Autres / Divers', 'Maison')
ON CONFLICT (dept_code) DO NOTHING;

-- Seed editable KPI placeholders (team lead fills real values).
INSERT INTO boh_kpi_overrides (key, label, value_numeric, unit) VALUES
  ('annual_sales',    'Ventes annuelles',        0, 'EUR'),
  ('ytd_sales',       'Ventes YTD',             0, 'EUR'),
  ('mtd_sales',       'Ventes MTD',             0, 'EUR'),
  ('shrinkage_3m',    'Shrinkage 3 mois',       0, '%'),
  ('compression_rate','Taux de compression',   0, '%'),
  ('conversion_rate', 'Taux de conversion',    0, '%'),
  ('saturation_rate', 'Taux de saturation',     0, '%')
ON CONFLICT (key) DO NOTHING;
