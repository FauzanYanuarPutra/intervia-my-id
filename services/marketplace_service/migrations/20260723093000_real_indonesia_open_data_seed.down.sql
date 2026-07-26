DELETE FROM umkm_stores
WHERE metadata->>'seed_pack' = 'real_indonesia_open_data_20260723';

DELETE FROM content_items
WHERE metadata->>'seed_pack' = 'real_indonesia_open_data_20260723';

DELETE FROM users_read_model
WHERE user_id = '00000000-0000-0000-0000-000000000801'
  AND metadata->>'seed_pack' = 'real_indonesia_open_data_20260723';

UPDATE content_items
SET content_status = 'active',
    listing_status = CASE
      WHEN listing_status = 'archived' THEN 'published'
      ELSE listing_status
    END,
    published_at = COALESCE(published_at, updated_at, created_at, NOW()),
    metadata = metadata - 'archived_by_seed_pack' - 'archived_reason',
    updated_at = NOW()
WHERE metadata->>'archived_by_seed_pack' = 'real_indonesia_open_data_20260723';

UPDATE umkm_stores
SET is_active = TRUE,
    online_order_enabled = TRUE,
    offline_order_enabled = TRUE,
    metadata = metadata - 'archived_by_seed_pack' - 'archived_reason',
    updated_at = NOW()
WHERE metadata->>'archived_by_seed_pack' = 'real_indonesia_open_data_20260723';

UPDATE umkm_products
SET is_available = TRUE,
    metadata = metadata - 'archived_by_seed_pack' - 'archived_reason',
    updated_at = NOW()
WHERE metadata->>'archived_by_seed_pack' = 'real_indonesia_open_data_20260723';
