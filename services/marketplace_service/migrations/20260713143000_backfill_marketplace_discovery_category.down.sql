UPDATE content_items
SET metadata = metadata
  - 'marketplace_category_legacy_key'
  - 'business_discovery_category'
WHERE metadata->>'marketplace_category_slug' IN (
  'materials-suppliers',
  'services',
  'machines-tools',
  'business-places',
  'business-opportunities'
)
  AND metadata->>'listing_mode' = 'guided_business_create';
