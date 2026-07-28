-- Supports canonical /v1/content?side=supply|demand filtering while preserving
-- market_side as the primary metadata key and listing_side as its fallback.
CREATE INDEX IF NOT EXISTS idx_content_items_status_listing_side_updated_at
  ON content_items (
    lower(content_status),
    (
      CASE
        WHEN regexp_replace(lower(btrim(coalesce(metadata->>'market_side', ''))), '[_-]+', ' ', 'g')
          IN ('demand', 'need', 'needs', 'needed', 'request', 'requested', 'wanted', 'looking', 'seeker', 'buyer request', 'buy request', 'pencari', 'mencari', 'dibutuhkan', 'butuh', 'minta')
          THEN 'demand'
        WHEN regexp_replace(lower(btrim(coalesce(metadata->>'market_side', ''))), '[_-]+', ' ', 'g')
          IN ('supply', 'offer', 'offering', 'available', 'provider', 'seller', 'sell', 'penyedia', 'menawarkan', 'menyediakan', 'tersedia')
          THEN 'supply'
        WHEN regexp_replace(lower(btrim(coalesce(metadata->>'listing_side', ''))), '[_-]+', ' ', 'g')
          IN ('demand', 'need', 'needs', 'needed', 'request', 'requested', 'wanted', 'looking', 'seeker', 'buyer request', 'buy request', 'pencari', 'mencari', 'dibutuhkan', 'butuh', 'minta')
          THEN 'demand'
        WHEN regexp_replace(lower(btrim(coalesce(metadata->>'listing_side', ''))), '[_-]+', ' ', 'g')
          IN ('supply', 'offer', 'offering', 'available', 'provider', 'seller', 'sell', 'penyedia', 'menawarkan', 'menyediakan', 'tersedia')
          THEN 'supply'
        WHEN btrim(coalesce(metadata->>'market_side', '')) = ''
          AND btrim(coalesce(metadata->>'listing_side', '')) = ''
          THEN 'supply'
        ELSE NULL
      END
    ),
    updated_at DESC,
    created_at DESC
  )
  WHERE content_status <> 'deleted';
