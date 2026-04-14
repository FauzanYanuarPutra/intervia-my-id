-- Add mart catalog tables with starter seed data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS super_app_mart_stores (
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

CREATE INDEX IF NOT EXISTS idx_super_app_mart_stores_active_city
ON super_app_mart_stores (is_active, city, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_app_mart_stores_provider
ON super_app_mart_stores (provider_user_id);

CREATE INDEX IF NOT EXISTS idx_super_app_mart_stores_metadata_gin
ON super_app_mart_stores USING GIN (metadata);

CREATE TABLE IF NOT EXISTS super_app_mart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES super_app_mart_stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
  stock_qty INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_app_mart_items_store_available
ON super_app_mart_items (store_id, is_available, category, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_app_mart_items_metadata_gin
ON super_app_mart_items USING GIN (metadata);

-- Seed stores (provider account for mart already seeded in identity_service).
INSERT INTO super_app_mart_stores (
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
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000301',
    'Mart Nusantara',
    'mart-nusantara',
    'Jakarta',
    'Jl. Kuningan Barat No. 8, Jakarta Selatan',
    -6.232200,
    106.823100,
    4.79,
    2100,
    19,
    TRUE,
    '{"segment":"daily_needs","promo":{"label":"Diskon Rp12.000","type":"flat_discount","value_cents":1200000,"min_order_cents":400000}}'::jsonb
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000301',
    'Hemat Mart Express',
    'hemat-mart-express',
    'Jakarta',
    'Jl. Thamrin No. 11, Jakarta Pusat',
    -6.194100,
    106.821800,
    4.72,
    1820,
    22,
    TRUE,
    '{"segment":"value_store","promo":{"label":"Potong Biaya Layanan Rp5.000","type":"service_discount","value_cents":500000,"min_order_cents":250000}}'::jsonb
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000301',
    'Fresh Market Point',
    'fresh-market-point',
    'Jakarta',
    'Jl. Pakubuwono No. 17, Jakarta Selatan',
    -6.244600,
    106.794800,
    4.84,
    1540,
    24,
    TRUE,
    '{"segment":"fresh_food","promo":{"label":"Diskon Rp15.000","type":"flat_discount","value_cents":1500000,"min_order_cents":600000}}'::jsonb
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

INSERT INTO super_app_mart_items (
  id,
  store_id,
  name,
  description,
  category,
  price_cents,
  stock_qty,
  is_available,
  image_url,
  metadata
)
VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Beras Premium 5kg',
    'Beras premium kualitas super.',
    'staples',
    720000,
    120,
    TRUE,
    '/images/umkm/product-retail.svg',
    '{}'::jsonb
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    'Minyak Goreng 2L',
    'Minyak goreng sawit kemasan botol.',
    'kitchen',
    360000,
    200,
    TRUE,
    '/images/umkm/product-retail.svg',
    '{}'::jsonb
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000002',
    'Susu UHT 1L',
    'Susu UHT plain 1 liter.',
    'dairy',
    220000,
    180,
    TRUE,
    '/images/umkm/product-retail.svg',
    '{}'::jsonb
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000002',
    'Telur Ayam 1kg',
    'Telur ayam segar 1 kilogram.',
    'fresh',
    310000,
    90,
    TRUE,
    '/images/umkm/product-fresh.svg',
    '{}'::jsonb
  ),
  (
    '40000000-0000-0000-0000-000000000005',
    '30000000-0000-0000-0000-000000000003',
    'Apel Fuji 1kg',
    'Buah apel fuji impor premium.',
    'fruit',
    470000,
    75,
    TRUE,
    '/images/umkm/product-fresh.svg',
    '{}'::jsonb
  ),
  (
    '40000000-0000-0000-0000-000000000006',
    '30000000-0000-0000-0000-000000000003',
    'Dada Ayam Fillet 500g',
    'Dada ayam fillet segar.',
    'fresh_protein',
    390000,
    110,
    TRUE,
    '/images/umkm/product-fresh.svg',
    '{}'::jsonb
  )
ON CONFLICT (id) DO UPDATE
SET
  store_id = EXCLUDED.store_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price_cents = EXCLUDED.price_cents,
  stock_qty = EXCLUDED.stock_qty,
  is_available = EXCLUDED.is_available,
  image_url = EXCLUDED.image_url,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
