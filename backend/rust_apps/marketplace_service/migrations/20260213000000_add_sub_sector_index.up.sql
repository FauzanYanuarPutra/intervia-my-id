-- Sub-sector filter: index for fast filtering
CREATE INDEX IF NOT EXISTS idx_content_metadata_sub_sector ON content_items ((metadata->>'sub_sector'));
