\set ON_ERROR_STOP on

BEGIN;

SELECT pg_advisory_xact_lock(
  hashtext('lajukan:openstreetmap-public-reference-import')
);

CREATE TEMP TABLE osm_reference_stage (
  osm_type text NOT NULL,
  osm_id text NOT NULL,
  name text NOT NULL,
  city text NOT NULL,
  address text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  brand text,
  operator_name text,
  source_description text,
  opening_hours text,
  website text,
  wikimedia_commons text,
  wikidata text,
  brand_wikidata text,
  operator_wikidata text,
  image_ref text,
  primary_key text NOT NULL,
  primary_value text NOT NULL,
  marketplace_category_slug text NOT NULL,
  marketplace_subcategory_slug text NOT NULL,
  content_type text NOT NULL,
  legacy_category text NOT NULL,
  create_category text NOT NULL,
  accessed_at text NOT NULL
) ON COMMIT DROP;

\copy osm_reference_stage FROM '/tmp/lajukan-osm-open-references.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

CREATE TEMP TABLE osm_reference_policy_rejected_stage (
  external_id text NOT NULL,
  reason text NOT NULL
) ON COMMIT DROP;

\copy osm_reference_policy_rejected_stage FROM '/tmp/lajukan-osm-open-references-policy-rejected.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

DELETE FROM osm_reference_policy_rejected_stage
WHERE external_id !~ '^(node|way|relation)/[0-9]+$'
   OR reason NOT IN (
     'unsafe_name',
     'non_operational_lifecycle',
     'category_not_allowed',
     'consumer_retail_chain'
   );

CREATE UNIQUE INDEX osm_reference_policy_rejected_stage_external_id_idx
  ON osm_reference_policy_rejected_stage (external_id);

ANALYZE osm_reference_stage;
ANALYZE osm_reference_policy_rejected_stage;

WITH normalized AS (
  SELECT DISTINCT ON (osm_type, osm_id)
    osm_type,
    osm_id,
    left(btrim(name), 180) AS name,
    left(btrim(city), 120) AS city,
    CASE
      WHEN btrim(address) ~* '@[a-z0-9.-]+\.[a-z]{2,}'
        OR btrim(address) ~ '(^|[^0-9])(\+?62|0)[0-9 ()\.-]{7,}[0-9]([^0-9]|$)'
      THEN NULL
      ELSE nullif(left(btrim(address), 300), '')
    END AS address,
    latitude,
    longitude,
    CASE
      WHEN btrim(brand) ~* '@[a-z0-9.-]+\.[a-z]{2,}'
        OR btrim(brand) ~ '(^|[^0-9])(\+?62|0)[0-9 ()\.-]{7,}[0-9]([^0-9]|$)'
      THEN NULL
      ELSE nullif(left(btrim(brand), 160), '')
    END AS brand,
    CASE
      WHEN btrim(operator_name) ~* '@[a-z0-9.-]+\.[a-z]{2,}'
        OR btrim(operator_name) ~ '(^|[^0-9])(\+?62|0)[0-9 ()\.-]{7,}[0-9]([^0-9]|$)'
      THEN NULL
      ELSE nullif(left(btrim(operator_name), 160), '')
    END AS operator_name,
    CASE
      WHEN btrim(source_description) ~* '@[a-z0-9.-]+\.[a-z]{2,}'
        OR btrim(source_description) ~ '(^|[^0-9])(\+?62|0)[0-9 ()\.-]{7,}[0-9]([^0-9]|$)'
      THEN NULL
      ELSE nullif(left(btrim(source_description), 500), '')
    END AS source_description,
    nullif(left(btrim(opening_hours), 300), '') AS opening_hours,
    nullif(left(btrim(website), 500), '') AS website,
    nullif(left(btrim(wikimedia_commons), 500), '') AS wikimedia_commons,
    nullif(left(btrim(wikidata), 80), '') AS wikidata,
    nullif(left(btrim(brand_wikidata), 80), '') AS brand_wikidata,
    nullif(left(btrim(operator_wikidata), 80), '') AS operator_wikidata,
    nullif(left(btrim(image_ref), 500), '') AS image_ref,
    left(btrim(primary_key), 80) AS primary_key,
    left(btrim(primary_value), 120) AS primary_value,
    marketplace_category_slug,
    marketplace_subcategory_slug,
    content_type,
    legacy_category,
    create_category,
    accessed_at,
    'osm-' || osm_type || '-' || osm_id AS canonical_slug,
    osm_type || '/' || osm_id AS external_id,
    'https://www.openstreetmap.org/' || osm_type || '/' || osm_id AS source_url
  FROM osm_reference_stage
  WHERE osm_type IN ('node', 'way', 'relation')
    AND osm_id ~ '^[0-9]+$'
    AND btrim(name) <> ''
    AND btrim(name) ~ '[[:alpha:]]'
    AND btrim(name) !~* '^(yes|no|unknown|unnamed|test|bengkel|fotocopy|kantor|kios|laundry|market|minimarket|office|pasar|ruko|shop|store|supermarket|toko|warung)$'
    AND btrim(name) !~* '^(indomaret|alfamart|alfamidi|circle[[:space:]]*k|super[[:space:]]*indo|lawson|transmart|hypermart|familymart|farmers[[:space:]]*market|ranch[[:space:]]*market|lotte[[:space:]]*mart)([[:space:]-]|$)'
    AND btrim(name) !~* '^(https?://|www\.)'
    AND btrim(name) !~* '@[a-z0-9.-]+\.[a-z]{2,}'
    AND lower(btrim(primary_value)) NOT IN (
      'alcohol',
      'abandoned',
      'bookmaker',
      'cannabis',
      'closed',
      'construction',
      'demolished',
      'disused',
      'e-cigarette',
      'erotic',
      'lottery',
      'no',
      'proposed',
      'razed',
      'removed',
      'tobacco',
      'vacant',
      'weapons'
    )
    AND (
      lower(btrim(primary_key)) <> 'shop'
      OR (
        lower(btrim(primary_value)) IN (
          'department_store', 'kiosk', 'mall', 'photo_studio',
          'shopping_centre', 'storage_rental'
        )
        AND marketplace_category_slug = 'business-places'
      )
      OR (
        lower(btrim(primary_value)) IN (
          'agricultural_engines', 'appliance', 'car_parts', 'computer',
          'doityourself', 'electrical', 'electronics', 'furniture', 'hardware',
          'kitchen', 'lighting', 'machine', 'medical_supply',
          'motorcycle_parts', 'office_supplies', 'printer_ink',
          'radiotechnics', 'security', 'stationery', 'tool_hire', 'tyres'
        )
        AND marketplace_category_slug = 'machines-tools'
      )
      OR (
        lower(btrim(primary_value)) IN (
          'car_repair', 'copyshop', 'dry_cleaning', 'estate_agent', 'laundry',
          'locksmith', 'motorcycle_repair', 'photo', 'printing', 'repair',
          'tailor', 'travel_agency'
        )
        AND marketplace_category_slug = 'services'
      )
      OR (
        lower(btrim(primary_value)) IN (
          'agrarian', 'animal_feed', 'bathroom_furnishing', 'beverages',
          'building_materials', 'butcher', 'carpet', 'ceramics', 'coffee',
          'curtain', 'dairy', 'doors', 'fabric', 'farm', 'flooring',
          'frozen_food', 'gas', 'garden_centre', 'glass', 'greengrocer',
          'health_food', 'herbalist', 'leather', 'nuts', 'packaging', 'paint',
          'pasta', 'rice', 'roofing', 'seafood', 'spices', 'tea', 'tiles',
          'trade', 'water', 'wholesale', 'windows'
        )
        AND marketplace_category_slug = 'materials-suppliers'
      )
    )
    AND (
      lower(btrim(primary_key)) <> 'office'
      OR lower(btrim(primary_value)) IN (
        'accountant',
        'accounting',
        'advertising_agency',
        'architect',
        'company',
        'consulting',
        'coworking',
        'employment_agency',
        'estate_agent',
        'financial',
        'insurance',
        'it',
        'lawyer',
        'logistics',
        'notary',
        'property_management',
        'research',
        'tax_advisor',
        'telecommunication',
        'travel_agent',
        'web_design'
      )
    )
    AND latitude BETWEEN -90 AND 90
    AND longitude BETWEEN -180 AND 180
  ORDER BY osm_type, osm_id, name
),
prepared AS (
  SELECT
    n.*,
    mc.id AS marketplace_category_id,
    ms.id AS marketplace_subcategory_id,
    '/images/placeholders/business-default.svg' AS reference_image,
    md5(concat_ws(
      E'\x1f',
      'osm-reference-v2',
      n.name,
      n.city,
      n.address,
      n.latitude::text,
      n.longitude::text,
      n.brand,
      n.operator_name,
      n.source_description,
      n.opening_hours,
      n.website,
      n.wikimedia_commons,
      n.wikidata,
      n.brand_wikidata,
      n.operator_wikidata,
      n.image_ref,
      n.primary_key,
      n.primary_value,
      n.marketplace_category_slug,
      n.marketplace_subcategory_slug,
      n.content_type,
      n.legacy_category,
      n.create_category
    )) AS source_payload_fingerprint
  FROM normalized n
  JOIN marketplace_categories mc
    ON mc.slug = n.marketplace_category_slug
   AND mc.is_active = true
  JOIN marketplace_subcategories ms
    ON ms.category_id = mc.id
   AND ms.slug = n.marketplace_subcategory_slug
   AND ms.is_active = true
)
INSERT INTO content_items (
  owner_id,
  content_type,
  slug,
  title,
  summary,
  body,
  pricing_mode,
  price_cents,
  price_unit,
  original_price_cents,
  seller_type,
  minimum_order,
  promo_label,
  promo_start_at,
  promo_end_at,
  currency,
  tags,
  cover_image,
  category,
  content_status,
  rating,
  review_count,
  marketplace_category_id,
  marketplace_subcategory_id,
  listing_intent,
  listing_status,
  completion_percentage,
  last_saved_at,
  published_at,
  attributes,
  contact_snapshot,
  metadata,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000801'::uuid,
  p.content_type,
  p.canonical_slug,
  p.name,
  COALESCE(
    p.source_description,
    'Referensi lokasi usaha bernama di ' || p.city || ' dari OpenStreetMap.'
  ),
  p.name || ' tercatat sebagai ' || p.primary_key || '=' || p.primary_value ||
    COALESCE(' dengan alamat ' || p.address, '') ||
    ' di OpenStreetMap. Periksa sumber untuk perubahan terbaru. Data ini bukan penawaran, stok, harga, atau bukti verifikasi Lajukan.',
  'fixed',
  NULL,
  NULL,
  NULL,
  'public_reference',
  NULL,
  NULL,
  NULL,
  NULL,
  'IDR',
  array_remove(ARRAY[
    'referensi usaha',
    'OpenStreetMap',
    p.city,
    p.brand,
    p.operator_name,
    p.primary_key,
    p.primary_value,
    p.marketplace_category_slug,
    p.marketplace_subcategory_slug
  ]::text[], NULL),
  p.reference_image,
  p.legacy_category,
  'active',
  0,
  0,
  p.marketplace_category_id,
  p.marketplace_subcategory_id,
  NULL,
  'published',
  100,
  now(),
  now(),
  jsonb_build_object(
    'seed_pack', 'osm_open_reference_20260730',
    'import_schema_version', 'osm-reference-v2',
    'source_payload_fingerprint', p.source_payload_fingerprint,
    'record_kind', 'real_openstreetmap_reference',
    'source_dataset', 'openstreetmap',
    'external_id', p.external_id,
    'category_slug', p.marketplace_category_slug,
    'subcategory_slug', p.marketplace_subcategory_slug
  ),
  jsonb_build_object(
    'source_only', true,
    'contact_policy', 'no_private_contact_seeded',
    'official_source_url', p.source_url
  ),
  jsonb_build_object(
    'seed_pack', 'osm_open_reference_20260730',
    'import_schema_version', 'osm-reference-v2',
    'source_payload_fingerprint', p.source_payload_fingerprint,
    'record_kind', 'real_openstreetmap_reference',
    'is_transactional', false,
    'market_side', 'reference',
    'listing_side', 'reference',
    'listing_mode', 'source_reference',
    'source_dataset', 'openstreetmap',
    'external_id', p.external_id,
    'osm_type', p.osm_type,
    'osm_id', p.osm_id,
    'osm_primary_key', p.primary_key,
    'osm_primary_value', p.primary_value,
    'create_category', p.create_category,
    'business_discovery_category', p.create_category,
    'marketplace_category_slug', p.marketplace_category_slug,
    'marketplace_subcategory_slug', p.marketplace_subcategory_slug,
    'subcategory', p.marketplace_subcategory_slug,
    'sub_category', p.marketplace_subcategory_slug,
    'city', p.city,
    'location', p.city,
    'address', p.address,
    'latitude', p.latitude,
    'longitude', p.longitude,
    'brand', p.brand,
    'operator', p.operator_name,
    'source_description', p.source_description,
    'opening_hours', p.opening_hours,
    'source_website', p.website,
    'source_website_status', CASE
      WHEN p.website IS NULL THEN NULL
      ELSE 'openstreetmap_contributed_unverified'
    END,
    'wikimedia_commons', p.wikimedia_commons,
    'wikidata', p.wikidata,
    'brand_wikidata', p.brand_wikidata,
    'operator_wikidata', p.operator_wikidata,
    'unreviewed_image_reference', p.image_ref,
    'source_title', 'OpenStreetMap contributors',
    'source_url', p.source_url,
    'source_license', 'Open Data Commons Open Database License (ODbL) 1.0',
    'source_license_url', 'https://opendatacommons.org/licenses/odbl/1-0/',
    'source_accessed_at', p.accessed_at,
    'source', jsonb_build_object(
      'title', 'OpenStreetMap contributors',
      'url', p.source_url,
      'license', 'Open Data Commons Open Database License (ODbL) 1.0',
      'license_url', 'https://opendatacommons.org/licenses/odbl/1-0/',
      'attribution', '© OpenStreetMap contributors',
      'accessed_at', p.accessed_at
    ),
    'contact_policy', 'no_private_contact_seeded',
    'cover_image', p.reference_image,
    'image_url', p.reference_image,
    'gallery_images', jsonb_build_array(p.reference_image),
    'media_kind', 'neutral_reference_placeholder',
    'media_is_place_specific', false,
    'image_credit', jsonb_build_object(
      'provider', 'Lajukan',
      'title', 'Placeholder referensi usaha',
      'license', 'Lajukan-owned project asset',
      'note', 'Placeholder netral, bukan foto lokasi atau usaha yang tercantum.'
    ),
    'trust_note', 'Referensi peta nyata saja. Keaktifan, ketersediaan, kepemilikan, kontak, dan verifikasi usaha tidak tersirat.'
  ),
  now(),
  now()
FROM prepared p
ON CONFLICT (slug) DO UPDATE
SET title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    body = EXCLUDED.body,
    content_type = EXCLUDED.content_type,
    pricing_mode = EXCLUDED.pricing_mode,
    price_cents = NULL,
    price_unit = NULL,
    original_price_cents = NULL,
    seller_type = EXCLUDED.seller_type,
    minimum_order = NULL,
    currency = EXCLUDED.currency,
    tags = EXCLUDED.tags,
    cover_image = CASE
      WHEN content_items.metadata->>'media_storage' = 'minio'
        OR content_items.cover_image LIKE '/api/content/media/%'
      THEN content_items.cover_image
      ELSE EXCLUDED.cover_image
    END,
    category = EXCLUDED.category,
    content_status = CASE
      WHEN content_items.metadata
        ->'osm_import_policy_archive'->>'policy_version'
        = 'osm-reference-v2'
      THEN 'active'
      ELSE content_items.content_status
    END,
    rating = 0,
    review_count = 0,
    marketplace_category_id = EXCLUDED.marketplace_category_id,
    marketplace_subcategory_id = EXCLUDED.marketplace_subcategory_id,
    listing_intent = NULL,
    listing_status = CASE
      WHEN content_items.content_status = 'active'
        OR content_items.metadata
          ->'osm_import_policy_archive'->>'policy_version'
          = 'osm-reference-v2'
      THEN 'published'
      ELSE content_items.listing_status
    END,
    completion_percentage = 100,
    last_saved_at = now(),
    published_at = COALESCE(content_items.published_at, now()),
    attributes = (
      COALESCE(content_items.attributes, '{}'::jsonb)
        - 'phone'
        - 'email'
        - 'whatsapp'
        - 'contact'
        - 'website'
    )
      || EXCLUDED.attributes,
    contact_snapshot = EXCLUDED.contact_snapshot,
    metadata = CASE
      WHEN content_items.metadata->>'media_storage' = 'minio'
        OR content_items.cover_image LIKE '/api/content/media/%'
      THEN (
        COALESCE(content_items.metadata, '{}'::jsonb)
          - 'official_website'
          - 'phone'
          - 'email'
          - 'whatsapp'
          - 'contact'
          - 'website'
          - 'osm_import_policy_archive'
      )
        || EXCLUDED.metadata
        || jsonb_strip_nulls(jsonb_build_object(
        'cover_image', to_jsonb(content_items.cover_image),
        'image_url', content_items.metadata->'image_url',
        'image_urls', content_items.metadata->'image_urls',
        'gallery_images', content_items.metadata->'gallery_images',
        'media_kind', content_items.metadata->'media_kind',
        'media_is_place_specific', content_items.metadata->'media_is_place_specific',
        'media_storage', content_items.metadata->'media_storage',
        'media_sha256', content_items.metadata->'media_sha256',
        'media_asset_id', content_items.metadata->'media_asset_id',
        'media_object_bucket', content_items.metadata->'media_object_bucket',
        'media_object_key', content_items.metadata->'media_object_key',
        'media_license_key', content_items.metadata->'media_license_key',
        'media_match_method', content_items.metadata->'media_match_method',
        'media_match_confidence', content_items.metadata->'media_match_confidence',
        'media_downloaded_at', content_items.metadata->'media_downloaded_at',
        'media_provenance', content_items.metadata->'media_provenance',
        'image_credit', content_items.metadata->'image_credit'
      ))
      ELSE (
        COALESCE(content_items.metadata, '{}'::jsonb)
          - 'official_website'
          - 'phone'
          - 'email'
          - 'whatsapp'
          - 'contact'
          - 'website'
          - 'osm_import_policy_archive'
      )
        || EXCLUDED.metadata
    END,
    updated_at = now()
WHERE content_items.metadata->>'record_kind'
        = 'real_openstreetmap_reference'
  AND content_items.metadata->>'source_dataset' = 'openstreetmap'
  AND content_items.metadata->>'external_id'
        = EXCLUDED.metadata->>'external_id'
  AND (
    content_items.metadata->>'source_payload_fingerprint'
      IS DISTINCT FROM EXCLUDED.metadata->>'source_payload_fingerprint'
    OR content_items.metadata->>'import_schema_version'
      IS DISTINCT FROM EXCLUDED.metadata->>'import_schema_version'
    OR content_items.metadata
      ->'osm_import_policy_archive'->>'policy_version'
      = 'osm-reference-v2'
    OR (
      COALESCE(content_items.metadata->>'media_storage', '') <> 'minio'
      AND (
        COALESCE(content_items.metadata->>'media_kind', '')
          <> 'neutral_reference_placeholder'
        OR content_items.cover_image
          IS DISTINCT FROM '/images/placeholders/business-default.svg'
      )
    )
  );

UPDATE content_items AS item
SET content_status = 'archived',
    listing_status = 'archived',
    metadata = COALESCE(item.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'osm_import_policy_archive',
        jsonb_build_object(
          'importer', 'import-osm-open-references.ps1',
          'policy_version', 'osm-reference-v2',
          'reason', rejected.reason,
          'archived_at', now(),
          'previous_state', jsonb_build_object(
            'content_status', item.content_status,
            'listing_status', item.listing_status,
            'updated_at', item.updated_at
          )
        )
      ),
    updated_at = now()
FROM osm_reference_policy_rejected_stage AS rejected
WHERE item.content_status = 'active'
  AND item.metadata->>'record_kind' = 'real_openstreetmap_reference'
  AND item.metadata->>'source_dataset' = 'openstreetmap'
  AND item.metadata->>'external_id' = rejected.external_id
  AND NOT (
    COALESCE(item.metadata, '{}'::jsonb) ? 'osm_import_policy_archive'
  );

COMMIT;

SELECT
  count(*) AS active_osm_references,
  count(DISTINCT metadata->>'external_id') AS distinct_external_ids,
  count(*) FILTER (WHERE price_cents IS NOT NULL) AS rows_with_price,
  count(*) FILTER (
    WHERE metadata ? 'phone'
       OR metadata ? 'email'
       OR metadata ? 'website'
       OR metadata ? 'contact'
  ) AS rows_with_private_contact_metadata,
  (
    SELECT count(*)
    FROM content_items archived
    WHERE archived.content_status = 'archived'
      AND archived.metadata->>'record_kind'
        = 'real_openstreetmap_reference'
      AND archived.metadata
        ->'osm_import_policy_archive'->>'policy_version'
        = 'osm-reference-v2'
  ) AS policy_archived_references
FROM content_items
WHERE content_status = 'active'
  AND metadata->>'record_kind' = 'real_openstreetmap_reference';

SELECT
  metadata->>'marketplace_category_slug' AS category_slug,
  count(*) AS reference_count
FROM content_items
WHERE content_status = 'active'
  AND metadata->>'record_kind' = 'real_openstreetmap_reference'
GROUP BY metadata->>'marketplace_category_slug'
ORDER BY reference_count DESC, category_slug;
