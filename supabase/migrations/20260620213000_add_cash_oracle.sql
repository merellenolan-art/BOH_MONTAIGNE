INSERT INTO boh_file_types (code, name, category, expected_fields)
VALUES ('cash_oracle', 'Caisse / Oracle', 'sales', '["reference","sku","department","quantity","value","date"]'::jsonb)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    expected_fields = EXCLUDED.expected_fields;

UPDATE boh_file_types
SET expected_fields = '["sku","quantity"]'::jsonb
WHERE code = 'packaging';
