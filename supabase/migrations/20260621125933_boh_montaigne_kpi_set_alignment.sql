-- Align the manual KPI set shown on the Home dashboard with the requested list.
-- Safe: inserts the two new keys, then deletes the obsolete ones via DELETE.

INSERT INTO boh_kpi_overrides (key, label, value_numeric, unit) VALUES
  ('completion_rate', 'Taux de complétion', 0, '%'),
  ('shrinkage',       'Shrinkage',          0, '%')
ON CONFLICT (key) DO NOTHING;

DELETE FROM boh_kpi_overrides
  WHERE key IN ('mtd_sales', 'shrinkage_3m', 'compression_rate');
