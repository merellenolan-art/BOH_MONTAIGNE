-- Add rejection tracking + per-family source provenance.
-- Non-destructive: only ADDS columns / tables. No drops, renames, or type changes.

-- Track accepted vs rejected rows + structured rejection reasons per import.
ALTER TABLE boh_imports
  ADD COLUMN IF NOT EXISTS accepted_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preview_rows jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Per-indicator-family provenance: which file/date produced each metric on Home.
-- One row per indicator family (stock, transit, newness, sales, adjust, inbound,
-- outbound, consignment, reservations, terrain). Replaced wholesale after each rebuild.
CREATE TABLE IF NOT EXISTS boh_indicator_sources (
  family text PRIMARY KEY,
  file_type text,
  file_name text,
  file_id uuid REFERENCES boh_imports(id) ON DELETE SET NULL,
  imported_at timestamptz,
  row_count integer NOT NULL DEFAULT 0,
  has_data boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE boh_indicator_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_sel_indicator_sources" ON boh_indicator_sources;
CREATE POLICY "anon_sel_indicator_sources" ON boh_indicator_sources
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_indicator_sources" ON boh_indicator_sources;
CREATE POLICY "anon_ins_indicator_sources" ON boh_indicator_sources
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_indicator_sources" ON boh_indicator_sources;
CREATE POLICY "anon_upd_indicator_sources" ON boh_indicator_sources
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_indicator_sources" ON boh_indicator_sources;
CREATE POLICY "anon_del_indicator_sources" ON boh_indicator_sources
  FOR DELETE TO anon, authenticated USING (true);
