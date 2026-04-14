-- Drop trigram indexes
DROP INDEX IF EXISTS idx_content_tags_trgm;
DROP INDEX IF EXISTS idx_content_summary_trgm;
DROP INDEX IF EXISTS idx_content_title_trgm;

-- Note: We don't drop pg_trgm extension as it might be used elsewhere
