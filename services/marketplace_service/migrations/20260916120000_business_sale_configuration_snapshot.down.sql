ALTER TABLE business_sale_lines
  DROP COLUMN IF EXISTS line_note,
  DROP COLUMN IF EXISTS configuration_snapshot;
