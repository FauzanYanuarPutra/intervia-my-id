-- Public-reference search previously evaluated many unindexed ILIKE branches.
-- Keep one normalized expression aligned with the `side=reference` query path
-- and index it with pg_trgm for substring and typo-tolerant discovery.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_content_items_reference_search_trgm
ON content_items USING GIN (
  (
    lower(
      COALESCE(title, '') || ' ' ||
      COALESCE(summary, '') || ' ' ||
      COALESCE(body, '') || ' ' ||
      COALESCE(slug, '') || ' ' ||
      COALESCE(metadata->>'search_text', '') || ' ' ||
      COALESCE(metadata->>'location', '') || ' ' ||
      COALESCE(metadata->>'city', '') || ' ' ||
      COALESCE(metadata->>'address', '') || ' ' ||
      COALESCE(metadata->>'brand', '') || ' ' ||
      COALESCE(metadata->>'operator', '') || ' ' ||
      COALESCE(metadata->>'source_description', '') || ' ' ||
      COALESCE(metadata->>'marketplace_category_slug', '') || ' ' ||
      COALESCE(metadata->>'marketplace_subcategory_slug', '')
    )
  ) gin_trgm_ops
);
