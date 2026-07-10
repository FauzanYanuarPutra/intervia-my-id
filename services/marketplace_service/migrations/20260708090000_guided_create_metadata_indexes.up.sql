CREATE INDEX IF NOT EXISTS idx_content_guided_create_category
  ON content_items ((metadata->>'create_category'))
  WHERE metadata->>'listing_mode' = 'guided_business_create';

CREATE INDEX IF NOT EXISTS idx_content_guided_market_side
  ON content_items ((metadata->>'market_side'))
  WHERE metadata->>'listing_mode' = 'guided_business_create';

CREATE INDEX IF NOT EXISTS idx_content_guided_location
  ON content_items ((metadata->>'location'))
  WHERE metadata->>'listing_mode' = 'guided_business_create';

CREATE INDEX IF NOT EXISTS idx_content_guided_lat_lng
  ON content_items ((metadata->>'latitude'), (metadata->>'longitude'))
  WHERE metadata->>'listing_mode' = 'guided_business_create';
