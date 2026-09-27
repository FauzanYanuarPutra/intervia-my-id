ALTER TABLE data_source_registry
  ADD COLUMN IF NOT EXISTS auto_publish_reference BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_data_source_registry_auto_publish_reference
  ON data_source_registry(auto_publish_reference, enabled, reuse_mode)
  WHERE auto_publish_reference = TRUE;

-- Only explicitly approved persistent sources may opt into deterministic
-- publication of unowned reference records. This never grants ownership.
