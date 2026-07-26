WITH category_map(marketplace_slug, discovery_id) AS (
  VALUES
    ('materials-suppliers', 'supplies'),
    ('services', 'service'),
    ('machines-tools', 'equipment'),
    ('business-places', 'property'),
    ('business-opportunities', 'opportunity')
),
resolved AS (
  SELECT DISTINCT ON (ci.id)
    ci.id,
    c.slug AS marketplace_slug,
    COALESCE(c.legacy_key, cm.discovery_id) AS discovery_id
  FROM content_items ci
  LEFT JOIN marketplace_categories c
    ON c.id = ci.marketplace_category_id
    OR c.slug = ci.metadata->>'marketplace_category_slug'
    OR c.legacy_key = ci.metadata->>'create_category'
    OR c.legacy_key = ci.metadata->>'business_discovery_category'
  LEFT JOIN category_map cm
    ON cm.marketplace_slug = COALESCE(c.slug, ci.metadata->>'marketplace_category_slug')
  WHERE COALESCE(c.slug, ci.metadata->>'marketplace_category_slug') IS NOT NULL
  ORDER BY ci.id, c.sort_order ASC NULLS LAST, c.slug ASC
)
UPDATE content_items ci
SET metadata = COALESCE(ci.metadata, '{}'::jsonb)
  || jsonb_build_object(
    'marketplace_category_slug', resolved.marketplace_slug,
    'marketplace_category_legacy_key', resolved.discovery_id,
    'create_category', resolved.discovery_id,
    'business_discovery_category', resolved.discovery_id
  )
FROM resolved
WHERE ci.id = resolved.id
  AND resolved.discovery_id IS NOT NULL
  AND (
    ci.metadata->>'create_category' IS DISTINCT FROM resolved.discovery_id
    OR ci.metadata->>'business_discovery_category' IS DISTINCT FROM resolved.discovery_id
    OR ci.metadata->>'marketplace_category_legacy_key' IS DISTINCT FROM resolved.discovery_id
    OR ci.metadata->>'marketplace_category_slug' IS DISTINCT FROM resolved.marketplace_slug
  );
