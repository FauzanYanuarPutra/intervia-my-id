-- Public discovery is filtered heavily by listing intent and marketplace
-- category. Keep active public browse queries index-friendly without changing
-- the canonical content/search semantics.

CREATE INDEX IF NOT EXISTS idx_content_items_public_listing_intent_updated
  ON content_items (listing_intent, updated_at DESC)
  WHERE content_status IN ('active', 'published');

CREATE INDEX IF NOT EXISTS idx_content_items_public_marketplace_category_updated
  ON content_items (
    (metadata->>'marketplace_category_slug'),
    (metadata->>'marketplace_subcategory_slug'),
    updated_at DESC
  )
  WHERE content_status IN ('active', 'published');
