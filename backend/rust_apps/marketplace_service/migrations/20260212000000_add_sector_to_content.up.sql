-- Sector filter: store in metadata. Add index for fast filtering.
CREATE INDEX IF NOT EXISTS idx_content_metadata_sector ON content_items ((metadata->>'sector'));
