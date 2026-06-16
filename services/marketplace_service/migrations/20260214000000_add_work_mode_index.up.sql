-- Work mode filter: index for fast filtering (remote/onsite/hybrid)
CREATE INDEX IF NOT EXISTS idx_content_metadata_work_mode ON content_items ((metadata->>'work_mode'));
