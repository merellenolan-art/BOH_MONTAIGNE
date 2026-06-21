/*
# BOH Operations Hub — Core Schema (single-tenant, no auth)

This migration creates the data layer for the Gucci Montaigne BOH Operations Hub.
The app imports SAP / FAST / MAO / field extract files (XLSX/CSV), stores their
raw rows in a normalized JSONB column, applies a per-file-type column mapping, and
consolidates everything into a single department-level summary table that drives
the Morning Report, Evening Report, and BOH Tracker dashboards.

## 1. Tables

### `boh_file_types` (reference / config)
- Lookup of the 13 supported file categories (Stock, Transit, Inbound, ...).
- `code` (text, PK) — short identifier used by the import + consolidation engine.
- `name` (text) — display label.
- `expected_fields` (jsonb) — ordered list of canonical fields this file type
  is expected to provide, used to drive auto-mapping suggestions and the status
  of each import (recognized / mapping required / incompatible).
- `category` (text) — groups file types for KPI cards
  ("stock", "movement", "sales", "logistics", "regulation").

### `boh_imports`
- One row per uploaded file.
- `id` (uuid, PK).
- `file_type` (text, FK → boh_file_types.code) — detected category.
- `file_name` (text) — original filename.
- `sheet_names` (text[]) — sheets detected by SheetJS.
- `headers` (jsonb) — { sheetName: string[] } detected column headers per sheet.
- `row_count` (int) — number of data rows ingested.
- `status` (text) — "recognized" | "mapping_required" | "incompatible".
- `rows` (jsonb) — the normalized rows array (each row is a {col:val} object).
- `imported_at` (timestamptz) — when the file was loaded.

### `boh_mappings`
- One row per (file_type, canonical_field) mapping the user saved.
- `id` (uuid, PK).
- `file_type` (text, FK → boh_file_types.code).
- `canonical_field` (text) — e.g. "sku", "department", "quantity", "value", "date".
- `source_column` (text) — the header from the import file that maps to the canonical field.
- `updated_at` (timestamptz).

### `boh_department_summary`
- Consolidated, department-level operational snapshot that powers every dashboard.
- One row per (dept_id, dept_name); refreshed by the consolidation engine after
  every successful import / mapping change.
- `dept_id` (text) — department identifier.
- `dept_name` (text).
- `stock_qty`, `transit_qty`, `inbound_qty`, `outbound_qty`, `newness_qty`,
  `sales_qty`, `sales_value`, `adjust_qty`, `adjust_value` (numeric, default 0).
- `reservations_qty`, `consignment_qty`, `expeditions_qty` (numeric, default 0).
- `fast_open`, `mao_open` (int, default 0) — counts of open FAST / MAO records.
- `risk` (text) — "ok" | "attention" | "action" derived from thresholds.
- `hypothesis` (text) — analyst's "Main Hypothesis" note (editable later).
- `action_taken` (text) — analyst's "Action Taken" note (editable later).
- `status` (text) — "open" | "in_progress" | "closed" (editable later).
- `updated_at` (timestamptz).

## 2. Security
- RLS enabled on every table.
- This is a single-tenant internal tool with no sign-in requested, so all tables
  are intentionally shared: TO anon, authenticated with full CRUD. Documented here.
*/



CREATE TABLE IF NOT EXISTS boh_file_types (
  code text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  expected_fields jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS boh_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_type text REFERENCES boh_file_types(code) ON DELETE CASCADE,
  file_name text NOT NULL,
  sheet_names text[] NOT NULL DEFAULT '{}',
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'incompatible',
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boh_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_type text NOT NULL REFERENCES boh_file_types(code) ON DELETE CASCADE,
  canonical_field text NOT NULL,
  source_column text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (file_type, canonical_field)
);

CREATE TABLE IF NOT EXISTS boh_department_summary (
  dept_id text PRIMARY KEY,
  dept_name text NOT NULL DEFAULT '',
  stock_qty numeric NOT NULL DEFAULT 0,
  transit_qty numeric NOT NULL DEFAULT 0,
  inbound_qty numeric NOT NULL DEFAULT 0,
  outbound_qty numeric NOT NULL DEFAULT 0,
  newness_qty numeric NOT NULL DEFAULT 0,
  sales_qty numeric NOT NULL DEFAULT 0,
  sales_value numeric NOT NULL DEFAULT 0,
  adjust_qty numeric NOT NULL DEFAULT 0,
  adjust_value numeric NOT NULL DEFAULT 0,
  reservations_qty numeric NOT NULL DEFAULT 0,
  consignment_qty numeric NOT NULL DEFAULT 0,
  expeditions_qty numeric NOT NULL DEFAULT 0,
  fast_open integer NOT NULL DEFAULT 0,
  mao_open integer NOT NULL DEFAULT 0,
  risk text NOT NULL DEFAULT 'ok',
  hypothesis text NOT NULL DEFAULT '',
  action_taken text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE boh_file_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE boh_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE boh_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE boh_department_summary ENABLE ROW LEVEL SECURITY;

-- Single-tenant internal tool: data intentionally shared (anon + authenticated).
DROP POLICY IF EXISTS "anon_all_file_types" ON boh_file_types;
CREATE POLICY "anon_all_file_types" ON boh_file_types
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_manage_file_types" ON boh_file_types;
CREATE POLICY "anon_manage_file_types" ON boh_file_types
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_upd_file_types" ON boh_file_types
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_del_file_types" ON boh_file_types
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_sel_imports" ON boh_imports;
CREATE POLICY "anon_sel_imports" ON boh_imports
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_imports" ON boh_imports;
CREATE POLICY "anon_ins_imports" ON boh_imports
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_imports" ON boh_imports;
CREATE POLICY "anon_upd_imports" ON boh_imports
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_imports" ON boh_imports;
CREATE POLICY "anon_del_imports" ON boh_imports
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_sel_mappings" ON boh_mappings;
CREATE POLICY "anon_sel_mappings" ON boh_mappings
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_mappings" ON boh_mappings;
CREATE POLICY "anon_ins_mappings" ON boh_mappings
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_mappings" ON boh_mappings;
CREATE POLICY "anon_upd_mappings" ON boh_mappings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_mappings" ON boh_mappings;
CREATE POLICY "anon_del_mappings" ON boh_mappings
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_sel_summary" ON boh_department_summary;
CREATE POLICY "anon_sel_summary" ON boh_department_summary
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_summary" ON boh_department_summary;
CREATE POLICY "anon_ins_summary" ON boh_department_summary
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_summary" ON boh_department_summary;
CREATE POLICY "anon_upd_summary" ON boh_department_summary
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_summary" ON boh_department_summary;
CREATE POLICY "anon_del_summary" ON boh_department_summary
  FOR DELETE TO anon, authenticated USING (true);

-- Seed the 13 supported file types with their expected canonical fields.
INSERT INTO boh_file_types (code, name, category, expected_fields) VALUES
  ('terrain',   'Données Terrain',         'stock',      '["sku","department","quantity","value","date","comment"]'::jsonb),
  ('stock',     'Stock OH / Stock Online', 'stock',      '["sku","department","quantity","value"]'::jsonb),
  ('transit',   'Transit',                 'movement',   '["sku","department","quantity","value","date"]'::jsonb),
  ('inbound',   'Inbound',                 'movement',   '["reference","sku","department","quantity","value","date"]'::jsonb),
  ('outbound',  'Outbound',                'movement',   '["reference","sku","department","quantity","value","date"]'::jsonb),
  ('sales',     'Sales SAP',               'sales',      '["sku","department","quantity","value","date"]'::jsonb),
  ('reservations','Reservations SAP',      'logistics',  '["reference","sku","department","quantity","date"]'::jsonb),
  ('consignment','Consignment SAP',        'logistics',  '["reference","sku","department","quantity","value","date"]'::jsonb),
  ('adjust',    'Adjust SAP',             'sales',      '["sku","department","quantity","value","date"]'::jsonb),
  ('expeditions','Expéditions',           'logistics',  '["reference","sku","department","quantity","date"]'::jsonb),
  ('fast',      'FAST',                    'logistics',  '["reference","sku","department","quantity","value","date","status"]'::jsonb),
  ('mao',       'MAO / E-commerce',        'logistics',  '["reference","sku","department","quantity","value","date","status"]'::jsonb),
  ('cites',     'CITES',                   'regulation', '["reference","sku","department","quantity","date"]'::jsonb),
  ('packaging', 'Packaging',               'regulation', '["sku","department","quantity","value"]'::jsonb)
ON CONFLICT (code) DO NOTHING;
