-- Store BO flows used by the Evening dashboard.
INSERT INTO boh_file_types (code, name, category, expected_fields) VALUES
  (
    'sending_store_bo',
    'SENDING_STORE_BO',
    'movement',
    '["reference","sku","department","quantity","date","destination","status"]'::jsonb
  ),
  (
    'received_store_bo',
    'RECEIVED_STORE_BO',
    'movement',
    '["reference","sku","department","quantity","date","destination","status"]'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  expected_fields = EXCLUDED.expected_fields;
