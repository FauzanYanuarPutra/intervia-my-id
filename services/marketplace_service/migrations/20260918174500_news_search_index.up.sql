CREATE INDEX IF NOT EXISTS idx_content_items_news_search
ON content_items
USING GIN (
  to_tsvector(
    'simple'::regconfig,
    COALESCE(title, '') || ' ' || COALESCE(summary, '') || ' ' || COALESCE(body, '')
  )
)
WHERE content_type = 'news';
