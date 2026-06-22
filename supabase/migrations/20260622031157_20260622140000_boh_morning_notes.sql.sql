-- Persistent analyst notes for Morning dashboard rows.
-- Negative stock notes: keyed by import_id + sku + department so a note never
-- drifts onto a different line when a new MB52 file is imported.
-- Transit notes: keyed by import_id + reference (external delivery) + sku.

CREATE TABLE IF NOT EXISTS boh_negative_stock_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES boh_imports(id) ON DELETE CASCADE,
  sku text NOT NULL,
  department text NOT NULL,
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_id, sku, department)
);

CREATE TABLE IF NOT EXISTS boh_transit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES boh_imports(id) ON DELETE CASCADE,
  reference text NOT NULL,
  sku text NOT NULL,
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_id, reference, sku)
);

ALTER TABLE boh_negative_stock_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE boh_transit_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_sel_neg_notes" ON boh_negative_stock_notes;
CREATE POLICY "anon_sel_neg_notes" ON boh_negative_stock_notes
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_neg_notes" ON boh_negative_stock_notes;
CREATE POLICY "anon_ins_neg_notes" ON boh_negative_stock_notes
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_neg_notes" ON boh_negative_stock_notes;
CREATE POLICY "anon_upd_neg_notes" ON boh_negative_stock_notes
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_neg_notes" ON boh_negative_stock_notes;
CREATE POLICY "anon_del_neg_notes" ON boh_negative_stock_notes
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_sel_transit_notes" ON boh_transit_notes;
CREATE POLICY "anon_sel_transit_notes" ON boh_transit_notes
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_transit_notes" ON boh_transit_notes;
CREATE POLICY "anon_ins_transit_notes" ON boh_transit_notes
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_transit_notes" ON boh_transit_notes;
CREATE POLICY "anon_upd_transit_notes" ON boh_transit_notes
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_transit_notes" ON boh_transit_notes;
CREATE POLICY "anon_del_transit_notes" ON boh_transit_notes
  FOR DELETE TO anon, authenticated USING (true);