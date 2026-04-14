-- Remove deprecated `franchise` super-app service type and
-- add food merchant/menu catalog with seed data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------------------------------------------------
-- 1) Service type cleanup: franchise -> services
-- -------------------------------------------------------------------
UPDATE super_app_orders
SET service_type = 'services'
WHERE service_type = 'franchise';

UPDATE driver_locations_latest
SET service_type = 'services'
WHERE service_type = 'franchise';

UPDATE dispatch_orders
SET service_type = 'services'
WHERE service_type = 'franchise';

-- Rebuild service_type checks without `franchise`.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'super_app_orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%service_type%'
  LOOP
    EXECUTE format('ALTER TABLE super_app_orders DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE super_app_orders
ADD CONSTRAINT chk_super_app_orders_service_type
CHECK (service_type IN ('ride', 'car', 'food', 'send', 'mart', 'services'));

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'driver_locations_latest'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%service_type%'
  LOOP
    EXECUTE format('ALTER TABLE driver_locations_latest DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE driver_locations_latest
ADD CONSTRAINT chk_driver_locations_latest_service_type
CHECK (service_type IN ('ride', 'car', 'food', 'send', 'mart', 'services'));

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'dispatch_orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%service_type%'
  LOOP
    EXECUTE format('ALTER TABLE dispatch_orders DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE dispatch_orders
ADD CONSTRAINT chk_dispatch_orders_service_type
CHECK (service_type IN ('ride', 'car', 'food', 'send', 'mart', 'services'));

-- -------------------------------------------------------------------
-- 2) Food catalog tables
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS super_app_food_merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL DEFAULT 'Jakarta',
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 4.70 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  rating_count INT NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  eta_min_minutes INT NOT NULL DEFAULT 25 CHECK (eta_min_minutes >= 5 AND eta_min_minutes <= 180),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_app_food_merchants_active_city
ON super_app_food_merchants (is_active, city, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_app_food_merchants_provider
ON super_app_food_merchants (provider_user_id);

CREATE INDEX IF NOT EXISTS idx_super_app_food_merchants_metadata_gin
ON super_app_food_merchants USING GIN (metadata);

CREATE TABLE IF NOT EXISTS super_app_food_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES super_app_food_merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NULL,
  category TEXT NOT NULL DEFAULT 'main_course',
  price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
  prep_minutes INT NOT NULL DEFAULT 15 CHECK (prep_minutes >= 1 AND prep_minutes <= 180),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_app_food_menu_items_merchant_available
ON super_app_food_menu_items (merchant_id, is_available, category, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_app_food_menu_items_metadata_gin
ON super_app_food_menu_items USING GIN (metadata);

-- -------------------------------------------------------------------
-- 3) Seed merchants and menus
--    Password for these accounts in identity seed: Test123!@#
-- -------------------------------------------------------------------
INSERT INTO super_app_food_merchants (
  id,
  provider_user_id,
  name,
  slug,
  city,
  address,
  lat,
  lng,
  rating_avg,
  rating_count,
  eta_min_minutes,
  is_active,
  metadata
)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000101',
    'Warung Nusantara',
    'warung-nusantara',
    'Jakarta',
    'Jl. Sudirman No. 21, Jakarta Pusat',
    -6.208700,
    106.845000,
    4.80,
    1420,
    22,
    TRUE,
    '{"segment":"local_favorites","halal_certified":true,"promo":{"label":"Diskon Rp8.000","type":"flat_discount","value_cents":800000,"min_order_cents":250000}}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000102',
    'Kopi Senja & Bites',
    'kopi-senja-bites',
    'Jakarta',
    'Jl. Gatot Subroto No. 99, Jakarta Selatan',
    -6.229100,
    106.821900,
    4.75,
    980,
    18,
    TRUE,
    '{"segment":"coffee_snacks","open_24h":false,"promo":{"label":"Potong Ongkir Rp5.000","type":"delivery_discount","value_cents":500000,"min_order_cents":200000}}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000103',
    'Dapur Sehat Harian',
    'dapur-sehat-harian',
    'Jakarta',
    'Jl. Rasuna Said No. 13, Jakarta Selatan',
    -6.225600,
    106.832100,
    4.86,
    1250,
    20,
    TRUE,
    '{"segment":"healthy_food","diet_options":["low_carb","high_protein"],"promo":{"label":"Diskon Rp10.000","type":"flat_discount","value_cents":1000000,"min_order_cents":320000}}'::jsonb
  )
ON CONFLICT (id) DO UPDATE
SET
  provider_user_id = EXCLUDED.provider_user_id,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  city = EXCLUDED.city,
  address = EXCLUDED.address,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  rating_avg = EXCLUDED.rating_avg,
  rating_count = EXCLUDED.rating_count,
  eta_min_minutes = EXCLUDED.eta_min_minutes,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO super_app_food_menu_items (
  id,
  merchant_id,
  name,
  description,
  category,
  price_cents,
  prep_minutes,
  is_available,
  metadata
)
VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Nasi Goreng Kampung',
    'Nasi goreng tradisional dengan ayam suwir dan telur.',
    'main_course',
    320000,
    15,
    TRUE,
    '{"spicy_level":"medium"}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Ayam Bakar Madu',
    'Ayam bakar bumbu madu dengan sambal dan lalapan.',
    'main_course',
    420000,
    18,
    TRUE,
    '{"spicy_level":"low"}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'Es Teh Manis Jumbo',
    'Teh melati dingin ukuran jumbo.',
    'beverage',
    90000,
    4,
    TRUE,
    '{}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'Sate Taichan',
    '10 tusuk sate taichan + sambal jeruk.',
    'snack',
    260000,
    12,
    TRUE,
    '{"spicy_level":"high"}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000002',
    'Latte Gula Aren',
    'Kopi susu gula aren signature.',
    'beverage',
    280000,
    7,
    TRUE,
    '{"size":"large"}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000002',
    'Americano',
    'Single origin americano tanpa gula.',
    'beverage',
    220000,
    6,
    TRUE,
    '{"size":"regular"}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000002',
    'Croissant Butter',
    'Croissant butter fresh baked.',
    'snack',
    240000,
    9,
    TRUE,
    '{}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000002',
    'Chicken Sandwich',
    'Sandwich ayam panggang dan sayur segar.',
    'main_course',
    360000,
    14,
    TRUE,
    '{}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000009',
    '10000000-0000-0000-0000-000000000003',
    'Chicken Breast Bowl',
    'Nasi merah, ayam panggang, brokoli, telur rebus.',
    'main_course',
    440000,
    16,
    TRUE,
    '{"calories":540}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000010',
    '10000000-0000-0000-0000-000000000003',
    'Salad Tuna Protein',
    'Salad tuna, alpukat, dan mixed greens.',
    'main_course',
    470000,
    12,
    TRUE,
    '{"calories":410}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000003',
    'Jus Detox Green',
    'Cold-pressed apple, spinach, cucumber.',
    'beverage',
    250000,
    8,
    TRUE,
    '{"sugar":"no_added_sugar"}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000012',
    '10000000-0000-0000-0000-000000000003',
    'Greek Yogurt Granola',
    'Greek yogurt dengan buah segar dan granola.',
    'snack',
    230000,
    6,
    TRUE,
    '{"calories":260}'::jsonb
  )
ON CONFLICT (id) DO UPDATE
SET
  merchant_id = EXCLUDED.merchant_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price_cents = EXCLUDED.price_cents,
  prep_minutes = EXCLUDED.prep_minutes,
  is_available = EXCLUDED.is_available,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

SELECT 1;
