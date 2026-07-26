CREATE INDEX IF NOT EXISTS idx_content_items_blog_publication
  ON content_items (
    content_type,
    content_status,
    ((metadata->'blog'->>'published_at')) DESC,
    updated_at DESC
  )
  WHERE content_type IN ('article', 'news')
    AND content_status <> 'deleted';

CREATE INDEX IF NOT EXISTS idx_content_items_blog_category
  ON content_items ((metadata->'blog'->>'category'))
  WHERE content_type IN ('article', 'news')
    AND content_status <> 'deleted';
