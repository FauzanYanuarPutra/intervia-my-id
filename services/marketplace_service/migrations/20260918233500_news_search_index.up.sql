CREATE INDEX IF NOT EXISTS idx_content_items_news_search
ON content_items
USING GIN (
  to_tsvector(
    'simple'::regconfig,
    COALESCE(title, '') || ' ' || COALESCE(summary, '') || ' ' || COALESCE(body, '')
  )
)
WHERE content_type = 'news'
  AND content_status = 'active';

CREATE INDEX IF NOT EXISTS idx_content_items_news_tags
ON content_items
USING GIN (tags)
WHERE content_type = 'news'
  AND content_status = 'active';

CREATE INDEX IF NOT EXISTS idx_content_items_news_language_cursor
ON content_items (
  (COALESCE(NULLIF(metadata->'news'->>'language', ''), 'id')),
  COALESCE(published_at, created_at) DESC,
  id DESC
)
WHERE content_type = 'news'
  AND content_status = 'active';

CREATE INDEX IF NOT EXISTS idx_content_items_news_category_language_cursor
ON content_items (
  (metadata->'news'->>'category'),
  (COALESCE(NULLIF(metadata->'news'->>'language', ''), 'id')),
  COALESCE(published_at, created_at) DESC,
  id DESC
)
WHERE content_type = 'news'
  AND content_status = 'active';

CREATE INDEX IF NOT EXISTS idx_content_items_news_location_language_cursor
ON content_items (
  (lower(COALESCE(metadata->'news'->>'location', ''))),
  (COALESCE(NULLIF(metadata->'news'->>'language', ''), 'id')),
  COALESCE(published_at, created_at) DESC,
  id DESC
)
WHERE content_type = 'news'
  AND content_status = 'active';
