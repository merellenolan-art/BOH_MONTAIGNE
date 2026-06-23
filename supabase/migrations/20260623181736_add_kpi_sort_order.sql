ALTER TABLE boh_kpi_overrides ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 99;

UPDATE boh_kpi_overrides SET sort_order = CASE key
  WHEN 'mtd_sales'       THEN 1
  WHEN 'ytd_sales'       THEN 2
  WHEN 'completion_rate' THEN 3
  WHEN 'conversion_rate' THEN 4
  WHEN 'saturation_rate' THEN 5
  WHEN 'shrinkage'       THEN 6
  ELSE 99
END;
