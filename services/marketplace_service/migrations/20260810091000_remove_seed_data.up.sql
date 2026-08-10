-- Remove marketplace demo/reference data while preserving structural taxonomy,
-- matching weights, schemas, and genuine user-owned records.

SET search_path = public, events;

CREATE TEMP TABLE seed_marketplace_user_ids (
  id uuid PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO seed_marketplace_user_ids (id)
VALUES
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000005'),
  ('00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000102'),
  ('00000000-0000-0000-0000-000000000103'),
  ('00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000000202'),
  ('00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000401'),
  ('00000000-0000-0000-0000-000000000511'),
  ('00000000-0000-0000-0000-000000000512'),
  ('00000000-0000-0000-0000-000000000513'),
  ('00000000-0000-0000-0000-000000000514'),
  ('00000000-0000-0000-0000-000000000515'),
  ('00000000-0000-0000-0000-000000000516'),
  ('00000000-0000-0000-0000-000000000517'),
  ('00000000-0000-0000-0000-000000000518'),
  ('00000000-0000-0000-0000-000000000701'),
  ('00000000-0000-0000-0000-000000000702'),
  ('00000000-0000-0000-0000-000000000703'),
  ('00000000-0000-0000-0000-000000000704'),
  ('00000000-0000-0000-0000-000000000705'),
  ('00000000-0000-0000-0000-000000000706'),
  ('00000000-0000-0000-0000-000000000707'),
  ('00000000-0000-0000-0000-000000000708'),
  ('00000000-0000-0000-0000-000000000709'),
  ('00000000-0000-0000-0000-000000000710'),
  ('00000000-0000-0000-0000-000000000801'),
  ('00000000-0000-0000-0000-000000000802'),
  ('00000000-0000-0000-0000-000000000803'),
  ('00000000-0000-0000-0000-000000000804'),
  ('00000000-0000-0000-0000-000000000805'),
  ('00000000-0000-0000-0000-000000000806');

CREATE TEMP TABLE seed_content_ids (
  id uuid PRIMARY KEY,
  slug text NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_content_ids (id, slug)
SELECT item.id, item.slug
FROM content_items item
WHERE item.metadata->>'seed_pack' IN (
    'indonesia_demo_20260709',
    'real_indonesia_open_data_20260723',
    'real_indonesia_bulk_open_data',
    'osm_open_reference_20260730'
  )
  OR item.metadata->>'record_kind' = 'real_openstreetmap_reference'
  OR item.metadata->>'seed_source' = 'marketplace_service_curated_search_grid_v1'
  OR EXISTS (
    SELECT 1
    FROM seed_marketplace_user_ids seed_user
    WHERE seed_user.id = item.owner_id
  );

CREATE TEMP TABLE seed_umkm_store_ids (
  id uuid PRIMARY KEY,
  slug text NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_umkm_store_ids (id, slug)
SELECT store.id, store.slug
FROM umkm_stores store
WHERE store.metadata->>'seed_pack' IN (
    'indonesia_demo_20260709',
    'real_indonesia_open_data_20260723',
    'real_indonesia_bulk_open_data'
  )
  OR store.metadata->>'source' = 'marketplace_service_curated_search_seed_v1'
  OR EXISTS (
    SELECT 1
    FROM seed_marketplace_user_ids seed_user
    WHERE seed_user.id = store.owner_user_id
  )
  OR store.id IN (
    '50000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000004',
    '50000000-0000-0000-0000-000000000005',
    '50000000-0000-0000-0000-000000000006',
    '50000000-0000-0000-0000-000000000007',
    '50000000-0000-0000-0000-000000000008',
    '50000000-0000-0000-0000-000000000009',
    '50000000-0000-0000-0000-000000000010',
    '50000000-0000-0000-0000-000000000101',
    '50000000-0000-0000-0000-000000000102',
    '50000000-0000-0000-0000-000000000103',
    '50000000-0000-0000-0000-000000000104',
    '50000000-0000-0000-0000-000000000105',
    '50000000-0000-0000-0000-000000000106',
    '50000000-0000-0000-0000-000000000107',
    '50000000-0000-0000-0000-000000000108',
    '50000000-0000-0000-0000-000000000109',
    '50000000-0000-0000-0000-000000000110',
    '50000000-0000-0000-0000-000000000111',
    '50000000-0000-0000-0000-000000000112',
    '57000000-0000-0000-0000-000000000701',
    '57000000-0000-0000-0000-000000000702',
    '57000000-0000-0000-0000-000000000703',
    '57000000-0000-0000-0000-000000000704',
    '57000000-0000-0000-0000-000000000705',
    '58000000-0000-0000-0000-000000000801',
    '58000000-0000-0000-0000-000000000802',
    '58000000-0000-0000-0000-000000000803',
    '58000000-0000-0000-0000-000000000804',
    '58000000-0000-0000-0000-000000000805'
  );

CREATE TEMP TABLE seed_food_merchant_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_food_merchant_ids (id)
VALUES
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003');

CREATE TEMP TABLE seed_mart_store_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_mart_store_ids (id)
VALUES
  ('30000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000003');

CREATE TEMP TABLE seed_catalog_item_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_catalog_item_ids (id)
SELECT product.id
FROM umkm_products product
JOIN seed_umkm_store_ids store ON store.id = product.store_id
UNION
SELECT item.id
FROM super_app_food_menu_items item
JOIN seed_food_merchant_ids merchant ON merchant.id = item.merchant_id
UNION
SELECT item.id
FROM super_app_mart_items item
JOIN seed_mart_store_ids store ON store.id = item.store_id;

-- Remove CRM material derived from seeded parents before those parents vanish.
CREATE TEMP TABLE seed_requirement_review_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_requirement_review_ids (id)
SELECT review.id
FROM crm_requirement_reviews review
WHERE EXISTS (
    SELECT 1 FROM seed_marketplace_user_ids seed_user
    WHERE seed_user.id IN (review.requester_user_id, review.assigned_to, review.created_by)
  )
  OR EXISTS (
    SELECT 1 FROM seed_content_ids seed
    WHERE review.source_id IN (seed.id::text, seed.slug)
  )
  OR EXISTS (
    SELECT 1 FROM seed_umkm_store_ids seed
    WHERE review.source_id IN (seed.id::text, seed.slug)
  );

CREATE TEMP TABLE affected_matching_run_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO affected_matching_run_ids (id)
SELECT DISTINCT candidate.matching_run_id
FROM crm_matching_candidates candidate
WHERE EXISTS (
    SELECT 1 FROM seed_content_ids seed
    WHERE candidate.candidate_id IN (seed.id::text, seed.slug)
  )
  OR EXISTS (
    SELECT 1 FROM seed_umkm_store_ids seed
    WHERE candidate.candidate_id IN (seed.id::text, seed.slug)
  )
  OR EXISTS (
    SELECT 1 FROM seed_catalog_item_ids seed
    WHERE candidate.candidate_id = seed.id::text
  )
  OR EXISTS (
    SELECT 1 FROM seed_marketplace_user_ids seed
    WHERE seed.id = candidate.provider_user_id
  )
  OR EXISTS (
    SELECT 1 FROM seed_umkm_store_ids seed
    WHERE seed.id = candidate.provider_business_id
  );

CREATE TEMP TABLE seed_matching_candidate_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_matching_candidate_ids (id)
SELECT candidate.id
FROM crm_matching_candidates candidate
WHERE candidate.matching_run_id IN (
    SELECT run.id
    FROM crm_matching_runs run
    JOIN seed_requirement_review_ids review ON review.id = run.requirement_review_id
  )
  OR EXISTS (
    SELECT 1 FROM seed_content_ids seed
    WHERE candidate.candidate_id IN (seed.id::text, seed.slug)
  )
  OR EXISTS (
    SELECT 1 FROM seed_umkm_store_ids seed
    WHERE candidate.candidate_id IN (seed.id::text, seed.slug)
  )
  OR EXISTS (
    SELECT 1 FROM seed_catalog_item_ids seed
    WHERE candidate.candidate_id = seed.id::text
  )
  OR EXISTS (
    SELECT 1 FROM seed_marketplace_user_ids seed
    WHERE seed.id = candidate.provider_user_id
  )
  OR EXISTS (
    SELECT 1 FROM seed_umkm_store_ids seed
    WHERE seed.id = candidate.provider_business_id
  );

CREATE TEMP TABLE seed_connection_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_connection_ids (id)
SELECT connection.id
FROM crm_connections connection
WHERE connection.requirement_review_id IN (SELECT id FROM seed_requirement_review_ids)
  OR connection.matching_candidate_id IN (SELECT id FROM seed_matching_candidate_ids)
  OR EXISTS (
    SELECT 1 FROM seed_marketplace_user_ids seed
    WHERE seed.id IN (connection.requester_user_id, connection.provider_user_id)
  )
  OR EXISTS (
    SELECT 1 FROM seed_umkm_store_ids seed
    WHERE seed.id = connection.provider_business_id
       OR connection.provider_entity_id IN (seed.id::text, seed.slug)
  )
  OR EXISTS (
    SELECT 1 FROM seed_content_ids seed
    WHERE connection.provider_entity_id IN (seed.id::text, seed.slug)
  );

DELETE FROM crm_matching_feedback feedback
WHERE feedback.requirement_review_id IN (SELECT id FROM seed_requirement_review_ids)
   OR feedback.matching_candidate_id IN (SELECT id FROM seed_matching_candidate_ids)
   OR feedback.connection_id IN (SELECT id FROM seed_connection_ids);

DELETE FROM crm_connections connection
WHERE connection.id IN (SELECT id FROM seed_connection_ids);

DELETE FROM crm_matching_candidates candidate
WHERE candidate.id IN (SELECT id FROM seed_matching_candidate_ids);

DELETE FROM crm_requirement_reviews review
WHERE review.id IN (SELECT id FROM seed_requirement_review_ids);

UPDATE crm_matching_runs run
SET candidate_count = (
      SELECT COUNT(*)::int
      FROM crm_matching_candidates candidate
      WHERE candidate.matching_run_id = run.id
    ),
    top_score = (
      SELECT MAX(candidate.score_total)
      FROM crm_matching_candidates candidate
      WHERE candidate.matching_run_id = run.id
    )
WHERE run.id IN (SELECT id FROM affected_matching_run_ids);

DELETE FROM crm_leads lead
WHERE lead.content_id IN (SELECT id FROM seed_content_ids)
   OR EXISTS (
     SELECT 1 FROM seed_marketplace_user_ids seed
     WHERE seed.id IN (lead.requester_user_id, lead.owner_id, lead.contact_user_id)
   );

-- Remove order records that point to seeded users/catalogs through non-FK IDs.
CREATE TEMP TABLE seed_super_app_order_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_super_app_order_ids (id)
SELECT app_order.id
FROM super_app_orders app_order
WHERE EXISTS (
    SELECT 1 FROM seed_marketplace_user_ids seed
    WHERE seed.id IN (
      app_order.requester_id,
      app_order.partner_id,
      app_order.provider_id,
      app_order.merchant_id
    )
  )
  OR app_order.merchant_id IN (SELECT id FROM seed_umkm_store_ids)
  OR app_order.merchant_id IN (SELECT id FROM seed_food_merchant_ids)
  OR app_order.merchant_id IN (SELECT id FROM seed_mart_store_ids);

DELETE FROM trip_location_points point
WHERE point.order_id IN (SELECT id::text FROM seed_super_app_order_ids);

DELETE FROM dispatch_orders dispatch
WHERE dispatch.order_id IN (SELECT id::text FROM seed_super_app_order_ids)
   OR EXISTS (
     SELECT 1 FROM seed_marketplace_user_ids seed
     WHERE seed.id::text IN (dispatch.requester_id, dispatch.matched_driver_id)
   );

DELETE FROM super_app_orders app_order
WHERE app_order.id IN (SELECT id FROM seed_super_app_order_ids);

DELETE FROM driver_locations_latest location
USING seed_marketplace_user_ids seed
WHERE location.driver_id = seed.id::text;

DELETE FROM super_app_trust_profiles profile
USING seed_marketplace_user_ids seed
WHERE profile.user_id = seed.id;

CREATE TEMP TABLE seed_order_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_order_ids (id)
SELECT app_order.id
FROM orders app_order
WHERE EXISTS (
    SELECT 1 FROM seed_marketplace_user_ids seed
    WHERE seed.id IN (app_order.user_id, app_order.merchant_id)
  )
  OR app_order.merchant_id IN (SELECT id FROM seed_umkm_store_ids)
  OR app_order.merchant_id IN (SELECT id FROM seed_food_merchant_ids)
  OR app_order.merchant_id IN (SELECT id FROM seed_mart_store_ids)
  OR EXISTS (
    SELECT 1
    FROM order_items item
    JOIN seed_catalog_item_ids seed ON seed.id IN (item.product_id, item.service_id, item.sku_id)
    WHERE item.order_id = app_order.id
  );

DELETE FROM outbox_events outbox
WHERE outbox.aggregate_id IN (SELECT id FROM seed_order_ids);

DELETE FROM orders app_order
WHERE app_order.id IN (SELECT id FROM seed_order_ids);

-- Explicit deterministic transactions cover historical DBs whose parent content
-- had already been deleted before this cleanup migration was introduced.
DELETE FROM transactions transaction_row
WHERE transaction_row.id IN (
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000008',
    '51000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000002',
    '51000000-0000-0000-0000-000000000003',
    '51000000-0000-0000-0000-000000000004',
    '51000000-0000-0000-0000-000000000005',
    '51000000-0000-0000-0000-000000000006'
  )
  OR transaction_row.content_id IN (SELECT id FROM seed_content_ids)
  OR EXISTS (
    SELECT 1 FROM seed_marketplace_user_ids seed
    WHERE seed.id IN (transaction_row.buyer_id, transaction_row.seller_id)
  );

-- Seed parents now have no non-FK consumers. Their FK children cascade.
DELETE FROM content_items item
USING seed_content_ids seed
WHERE item.id = seed.id;

DELETE FROM umkm_stores store
USING seed_umkm_store_ids seed
WHERE store.id = seed.id;

DELETE FROM listings listing
WHERE (listing.owner_id = '00000000-0000-0000-0000-000000000001' AND listing.listing_type = 'job')
   OR (listing.owner_id = '00000000-0000-0000-0000-000000000002' AND listing.listing_type = 'property')
   OR (listing.owner_id = '00000000-0000-0000-0000-000000000003' AND listing.listing_type = 'talent');

DELETE FROM super_app_food_merchants merchant
USING seed_food_merchant_ids seed
WHERE merchant.id = seed.id;

DELETE FROM super_app_mart_stores store
USING seed_mart_store_ids seed
WHERE store.id = seed.id;

-- The like-user FKs were intentionally removed in 20260708093000.
DELETE FROM content_item_likes like_row
USING seed_marketplace_user_ids seed
WHERE like_row.user_id = seed.id;

DELETE FROM umkm_store_gallery_likes like_row
USING seed_marketplace_user_ids seed
WHERE like_row.user_id = seed.id;

DELETE FROM users_read_model read_model
USING seed_marketplace_user_ids seed
WHERE read_model.user_id = seed.id;

-- Remove database provenance rows for reference images that no longer have a
-- content link. Blob/object garbage collection remains a storage operation.
DELETE FROM public_media_assets asset
WHERE asset.provider = 'wikimedia_commons'
  AND asset.object_key LIKE 'content/public-reference/%'
  AND NOT EXISTS (
    SELECT 1
    FROM public_media_asset_links link
    WHERE link.asset_id = asset.id
  );
