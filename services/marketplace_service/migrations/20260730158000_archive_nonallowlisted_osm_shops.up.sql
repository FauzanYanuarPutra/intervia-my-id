-- Bring legacy active OSM rows onto the same explicit shop allowlist used by
-- the v2 importer. This is a category-policy cleanup, not a statement that the
-- mapped place is fictitious.
WITH invalid_shops AS (
  SELECT
    id,
    jsonb_build_object(
      'migration', '20260730158000_archive_nonallowlisted_osm_shops',
      'archived_at', now(),
      'reason', 'OSM shop type is outside the Lajukan B2B/service/tools/business-place allowlist.',
      'osm_shop_value', metadata->>'osm_primary_value',
      'previous_state', jsonb_build_object(
        'content_status', content_status,
        'listing_status', listing_status,
        'updated_at', updated_at
      )
    ) AS archive_state
  FROM content_items
  WHERE content_status = 'active'
    AND metadata->>'record_kind' = 'real_openstreetmap_reference'
    AND metadata->>'source_dataset' = 'openstreetmap'
    AND lower(btrim(COALESCE(metadata->>'osm_primary_key', ''))) = 'shop'
    AND lower(btrim(COALESCE(metadata->>'osm_primary_value', ''))) NOT IN (
      'department_store', 'kiosk', 'mall', 'photo_studio',
      'shopping_centre', 'storage_rental',
      'agricultural_engines', 'appliance', 'car_parts', 'computer',
      'doityourself', 'electrical', 'electronics', 'furniture', 'hardware',
      'kitchen', 'lighting', 'machine', 'medical_supply', 'motorcycle_parts',
      'office_supplies', 'printer_ink', 'radiotechnics', 'security',
      'stationery', 'tool_hire', 'tyres',
      'car_repair', 'copyshop', 'dry_cleaning', 'estate_agent', 'laundry',
      'locksmith', 'motorcycle_repair', 'photo', 'printing', 'repair',
      'tailor', 'travel_agency',
      'agrarian', 'animal_feed', 'bathroom_furnishing', 'beverages',
      'building_materials', 'butcher', 'carpet', 'ceramics', 'coffee',
      'curtain', 'dairy', 'doors', 'fabric', 'farm', 'flooring',
      'frozen_food', 'gas', 'garden_centre', 'glass', 'greengrocer',
      'health_food', 'herbalist', 'leather', 'nuts', 'packaging', 'paint',
      'pasta', 'rice', 'roofing', 'seafood', 'spices', 'tea', 'tiles',
      'trade', 'water', 'wholesale', 'windows'
    )
    AND NOT (
      COALESCE(metadata, '{}'::jsonb)
        ? 'nonallowlisted_osm_shop_archive'
    )
)
UPDATE content_items AS item
SET content_status = 'archived',
    listing_status = 'archived',
    metadata = COALESCE(item.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'nonallowlisted_osm_shop_archive',
        invalid_shops.archive_state
      ),
    updated_at = now()
FROM invalid_shops
WHERE item.id = invalid_shops.id;
