DROP INDEX IF EXISTS idx_data_source_registry_auto_publish_reference;
ALTER TABLE data_source_registry
  DROP COLUMN IF EXISTS auto_publish_reference;
