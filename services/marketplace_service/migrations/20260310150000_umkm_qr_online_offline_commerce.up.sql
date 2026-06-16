-- UMKM omnichannel module:
-- - Public online storefront
-- - Offline dine-in ordering via table QR
-- - QR token resolver for online/offline modes
-- - Table occupancy lifecycle and checkout release

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS umkm_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NULL,
  city TEXT NOT NULL DEFAULT 'Jakarta',
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  phone TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  online_order_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  offline_order_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_umkm_stores_city_active
ON umkm_stores (city, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_umkm_stores_owner
ON umkm_stores (owner_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_umkm_stores_lat_lng
ON umkm_stores (lat, lng);

CREATE INDEX IF NOT EXISTS idx_umkm_stores_metadata_gin
ON umkm_stores USING GIN (metadata);

CREATE TABLE IF NOT EXISTS umkm_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES umkm_stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
  stock_qty INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_umkm_products_store_available
ON umkm_products (store_id, is_available, category, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_umkm_products_metadata_gin
ON umkm_products USING GIN (metadata);

CREATE TABLE IF NOT EXISTS umkm_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES umkm_stores(id) ON DELETE CASCADE,
  table_code TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 2 CHECK (capacity > 0 AND capacity <= 40),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'disabled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, table_code)
);

CREATE INDEX IF NOT EXISTS idx_umkm_tables_store_status
ON umkm_tables (store_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS umkm_qr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES umkm_stores(id) ON DELETE CASCADE,
  table_id UUID NULL REFERENCES umkm_tables(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('online', 'offline')),
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_umkm_qr_tokens_store_mode
ON umkm_qr_tokens (store_id, mode, is_active, updated_at DESC);

CREATE TABLE IF NOT EXISTS umkm_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES umkm_stores(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('online', 'offline')),
  table_id UUID NULL REFERENCES umkm_tables(id) ON DELETE SET NULL,
  table_code TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'served', 'paid', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  customer_name TEXT NULL,
  customer_phone TEXT NULL,
  notes TEXT NULL,
  subtotal_cents BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  discount_cents BIGINT NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  service_fee_cents BIGINT NOT NULL DEFAULT 0 CHECK (service_fee_cents >= 0),
  tax_cents BIGINT NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents BIGINT NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  checked_out_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_umkm_orders_store_time
ON umkm_orders (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_umkm_orders_store_status
ON umkm_orders (store_id, status, payment_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_umkm_orders_table_open
ON umkm_orders (table_id, payment_status, status, created_at DESC)
WHERE table_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_umkm_orders_metadata_gin
ON umkm_orders USING GIN (metadata);

CREATE TABLE IF NOT EXISTS umkm_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES umkm_orders(id) ON DELETE CASCADE,
  product_id UUID NULL REFERENCES umkm_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0 AND quantity <= 200),
  unit_price_cents BIGINT NOT NULL CHECK (unit_price_cents >= 0),
  line_total_cents BIGINT NOT NULL CHECK (line_total_cents >= 0),
  notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_umkm_order_items_order
ON umkm_order_items (order_id, created_at ASC);

CREATE TABLE IF NOT EXISTS umkm_table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES umkm_stores(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES umkm_tables(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'moved', 'cancelled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_umkm_table_sessions_store
ON umkm_table_sessions (store_id, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_umkm_table_sessions_table_open
ON umkm_table_sessions (table_id, status, opened_at DESC);

-- -------------------------------------------------------------------
-- Seed stores and products (realistic starter data)
-- -------------------------------------------------------------------
INSERT INTO umkm_stores (
  id, owner_user_id, name, slug, description,
  city, address, lat, lng, phone,
  is_active, online_order_enabled, offline_order_enabled, metadata
)
VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000101',
    'Kedai Nusantara Tebet',
    'kedai-nusantara-tebet',
    'Masakan rumahan nusantara dengan layanan dine-in dan delivery.',
    'Jakarta',
    'Jl. Tebet Barat Dalam Raya No. 14, Jakarta Selatan',
    -6.235120,
    106.848830,
    '+628111111001',
    TRUE, TRUE, TRUE,
    '{"segment":"kuliner_nusantara","recommended_qr":"offline","open_hours":"09:00-22:00"}'::jsonb
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000102',
    'Kopi Sudut Braga',
    'kopi-sudut-braga',
    'Coffee shop UMKM dengan menu kopi, pastry, dan brunch.',
    'Bandung',
    'Jl. Braga No. 78, Bandung',
    -6.917460,
    107.609810,
    '+628111111002',
    TRUE, TRUE, TRUE,
    '{"segment":"coffee_shop","recommended_qr":"offline","open_hours":"07:00-23:00"}'::jsonb
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000103',
    'Dapur Pesisir Surabaya',
    'dapur-pesisir-surabaya',
    'Seafood dan makanan keluarga dengan pemesanan online dan scan meja.',
    'Surabaya',
    'Jl. Raya Darmo No. 110, Surabaya',
    -7.290920,
    112.734390,
    '+628111111003',
    TRUE, TRUE, TRUE,
    '{"segment":"seafood_family","recommended_qr":"offline","open_hours":"10:00-22:30"}'::jsonb
  ),
  (
    '50000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000301',
    'Pasar Rasa Malioboro',
    'pasar-rasa-malioboro',
    'UMKM jajanan tradisional dan oleh-oleh khas Jogja.',
    'Yogyakarta',
    'Jl. Malioboro No. 45, Yogyakarta',
    -7.792250,
    110.365840,
    '+628111111004',
    TRUE, TRUE, TRUE,
    '{"segment":"snack_souvenir","recommended_qr":"online","open_hours":"08:00-21:00"}'::jsonb
  ),
  (
    '50000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000301',
    'Warung Sehat Ubud',
    'warung-sehat-ubud',
    'Healthy bowls, juice, dan menu vegan lokal.',
    'Bali',
    'Jl. Raya Ubud No. 22, Gianyar',
    -8.506900,
    115.262500,
    '+628111111005',
    TRUE, TRUE, TRUE,
    '{"segment":"healthy_food","recommended_qr":"online","open_hours":"07:30-20:30"}'::jsonb
  ),
  (
    '50000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000401',
    'Roti & Rempah Makassar',
    'roti-rempah-makassar',
    'Bakery artisan dan menu sarapan cepat.',
    'Makassar',
    'Jl. Penghibur No. 19, Makassar',
    -5.147660,
    119.432730,
    '+628111111006',
    TRUE, TRUE, TRUE,
    '{"segment":"bakery_breakfast","recommended_qr":"offline","open_hours":"06:00-21:00"}'::jsonb
  )
ON CONFLICT (id) DO UPDATE
SET
  owner_user_id = EXCLUDED.owner_user_id,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  city = EXCLUDED.city,
  address = EXCLUDED.address,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  phone = EXCLUDED.phone,
  is_active = EXCLUDED.is_active,
  online_order_enabled = EXCLUDED.online_order_enabled,
  offline_order_enabled = EXCLUDED.offline_order_enabled,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO umkm_products (
  id, store_id, name, slug, description,
  category, price_cents, stock_qty, is_available, image_url, metadata
)
VALUES
  ('51000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','Nasi Bakar Ayam Kemangi','nasi-bakar-ayam-kemangi','Nasi bakar ayam suwir dan sambal matah.','main_course',3400000,180,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','Soto Betawi','soto-betawi','Soto betawi kuah santan gurih.','main_course',3800000,140,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000001','Es Jeruk Peras','es-jeruk-peras','Jeruk peras segar tanpa pemanis tambahan.','beverage',1200000,250,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),

  ('51000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000002','Cappuccino House Blend','cappuccino-house-blend','Kopi blend signature dengan foam lembut.','coffee',3200000,220,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000002','Croissant Butter','croissant-butter','Croissant butter artisan fresh bake.','pastry',2600000,160,TRUE,'/images/umkm/product-bakery.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000002','Chicken Brunch Bowl','chicken-brunch-bowl','Bowl ayam panggang, telur, dan salad.','main_course',4100000,90,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),

  ('51000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000003','Ikan Bakar Rica','ikan-bakar-rica','Ikan bakar sambal rica khas pesisir.','main_course',5600000,120,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000008','50000000-0000-0000-0000-000000000003','Cumi Saus Padang','cumi-saus-padang','Cumi segar saus padang pedas manis.','main_course',5200000,130,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000009','50000000-0000-0000-0000-000000000003','Kelapa Muda','kelapa-muda','Air kelapa muda dingin.','beverage',1500000,210,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),

  ('51000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000004','Bakpia Premium Box','bakpia-premium-box','Bakpia campur premium isi 10 pcs.','souvenir',3900000,240,TRUE,'/images/umkm/product-retail.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000011','50000000-0000-0000-0000-000000000004','Gudeg Kaleng','gudeg-kaleng','Gudeg kaleng siap bawa untuk oleh-oleh.','souvenir',6800000,100,TRUE,'/images/umkm/product-retail.svg','{"channel":["online","offline"]}'::jsonb),

  ('51000000-0000-0000-0000-000000000012','50000000-0000-0000-0000-000000000005','Vegan Green Bowl','vegan-green-bowl','Salad bowl quinoa, tempe, avocado.','healthy_food',4700000,95,TRUE,'/images/umkm/product-fresh.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000013','50000000-0000-0000-0000-000000000005','Cold Pressed Detox','cold-pressed-detox','Jus detox apple-spinach-cucumber.','beverage',2900000,150,TRUE,'/images/umkm/product-fresh.svg','{"channel":["online","offline"]}'::jsonb),

  ('51000000-0000-0000-0000-000000000014','50000000-0000-0000-0000-000000000006','Sourdough Loaf','sourdough-loaf','Roti sourdough artisan 500gr.','bakery',3300000,120,TRUE,'/images/umkm/product-bakery.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000015','50000000-0000-0000-0000-000000000006','Roti Coklat Keju','roti-coklat-keju','Roti manis coklat keju.','bakery',1800000,260,TRUE,'/images/umkm/product-bakery.svg','{"channel":["online","offline"]}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET
  store_id = EXCLUDED.store_id,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price_cents = EXCLUDED.price_cents,
  stock_qty = EXCLUDED.stock_qty,
  is_available = EXCLUDED.is_available,
  image_url = EXCLUDED.image_url,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO umkm_stores (
  id, owner_user_id, name, slug, description,
  city, address, lat, lng, phone,
  is_active, online_order_enabled, offline_order_enabled, metadata
)
VALUES
  ('50000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000402','Soto Melayu Medan','soto-melayu-medan','Soto khas Medan, teh tarik, dan snack gurih untuk dine-in ramai.','Medan','Jl. Teuku Cik Ditiro No. 11, Medan',3.589665,98.673826,'+628111111007',TRUE,TRUE,TRUE,'{"segment":"soto_melayu","recommended_qr":"offline","open_hours":"07:00-22:00"}'::jsonb),
  ('50000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000403','Lesehan Tugu Semarang','lesehan-tugu-semarang','Ayam bakar, nasi liwet, dan minuman rempah untuk keluarga.','Semarang','Jl. Pandanaran No. 66, Semarang',-6.991647,110.420296,'+628111111008',TRUE,TRUE,TRUE,'{"segment":"family_javanese","recommended_qr":"offline","open_hours":"10:00-23:00"}'::jsonb),
  ('50000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000404','Sambal Hutan Balikpapan','sambal-hutan-balikpapan','Rice bowl Kalimantan, seafood lokal, dan sambal signature.','Balikpapan','Jl. Jenderal Sudirman No. 28, Balikpapan',-1.265386,116.831200,'+628111111009',TRUE,TRUE,TRUE,'{"segment":"rice_bowl_seafood","recommended_qr":"offline","open_hours":"10:30-22:30"}'::jsonb),
  ('50000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000405','Ayam Taliwang Senggigi','ayam-taliwang-senggigi','Ayam taliwang, plecing kangkung, dan menu bakar khas Lombok.','Lombok','Jl. Raya Senggigi No. 18, Lombok Barat',-8.489207,116.046432,'+628111111010',TRUE,TRUE,TRUE,'{"segment":"lombok_grill","recommended_qr":"offline","open_hours":"11:00-22:00"}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET
  owner_user_id = EXCLUDED.owner_user_id,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  city = EXCLUDED.city,
  address = EXCLUDED.address,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  phone = EXCLUDED.phone,
  is_active = EXCLUDED.is_active,
  online_order_enabled = EXCLUDED.online_order_enabled,
  offline_order_enabled = EXCLUDED.offline_order_enabled,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO umkm_products (
  id, store_id, name, slug, description,
  category, price_cents, stock_qty, is_available, image_url, metadata
)
VALUES
  ('51000000-0000-0000-0000-000000000016','50000000-0000-0000-0000-000000000007','Soto Medan Daging','soto-medan-daging','Soto medan kuah santan rempah.','main_course',4500000,120,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000017','50000000-0000-0000-0000-000000000007','Teh Tarik Dingin','teh-tarik-dingin','Teh tarik creamy khas Melayu.','beverage',1900000,180,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000018','50000000-0000-0000-0000-000000000007','Roti Jala Kari','roti-jala-kari','Roti jala lembut dengan kari ayam.','main_course',3600000,90,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000019','50000000-0000-0000-0000-000000000008','Ayam Bakar Tugu','ayam-bakar-tugu','Ayam bakar kecap dengan sambal terasi.','main_course',4800000,130,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000020','50000000-0000-0000-0000-000000000008','Nasi Liwet Komplit','nasi-liwet-komplit','Nasi liwet lengkap dengan lauk kampung.','main_course',4200000,110,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000021','50000000-0000-0000-0000-000000000008','Wedang Uwuh','wedang-uwuh','Minuman rempah hangat khas Jawa.','beverage',1700000,160,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000022','50000000-0000-0000-0000-000000000009','Rice Bowl Sambal Hutan','rice-bowl-sambal-hutan','Rice bowl ayam asap sambal signature.','main_course',4400000,150,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000023','50000000-0000-0000-0000-000000000009','Udang Bakar Kalimantan','udang-bakar-kalimantan','Udang bakar dengan glaze manis pedas.','main_course',6300000,80,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000024','50000000-0000-0000-0000-000000000009','Es Timun Selasih','es-timun-selasih','Minuman segar timun, selasih, dan jeruk.','beverage',1600000,170,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000025','50000000-0000-0000-0000-000000000010','Ayam Taliwang Bakar','ayam-taliwang-bakar','Ayam taliwang bakar pedas manis.','main_course',5200000,120,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000026','50000000-0000-0000-0000-000000000010','Plecing Kangkung','plecing-kangkung','Plecing kangkung segar dengan sambal Lombok.','side_dish',2200000,140,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb),
  ('51000000-0000-0000-0000-000000000027','50000000-0000-0000-0000-000000000010','Es Kelapa Senggigi','es-kelapa-senggigi','Kelapa muda dingin khas pesisir.','beverage',1800000,180,TRUE,'/images/umkm/product-food.svg','{"channel":["online","offline"]}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET
  store_id = EXCLUDED.store_id,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price_cents = EXCLUDED.price_cents,
  stock_qty = EXCLUDED.stock_qty,
  is_available = EXCLUDED.is_available,
  image_url = EXCLUDED.image_url,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO umkm_tables (id, store_id, table_code, capacity, status, metadata)
VALUES
  ('52000000-0000-0000-0000-000000000011','50000000-0000-0000-0000-000000000007','M01',4,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000012','50000000-0000-0000-0000-000000000007','M02',4,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000013','50000000-0000-0000-0000-000000000008','G01',4,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000014','50000000-0000-0000-0000-000000000008','G02',6,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000015','50000000-0000-0000-0000-000000000009','B01',2,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000016','50000000-0000-0000-0000-000000000009','B02',4,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000017','50000000-0000-0000-0000-000000000010','L01',4,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000018','50000000-0000-0000-0000-000000000010','L02',6,'available','{}'::jsonb)
ON CONFLICT (store_id, table_code) DO UPDATE
SET
  capacity = EXCLUDED.capacity,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO umkm_qr_tokens (id, store_id, table_id, mode, token, is_active, metadata)
VALUES
  ('53000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000007',NULL,'online','UMKM-ONLINE-SOTO-MELAYU',TRUE,'{"label":"Online Storefront QR"}'::jsonb),
  ('53000000-0000-0000-0000-000000000008','50000000-0000-0000-0000-000000000008',NULL,'online','UMKM-ONLINE-LESEHAN-TUGU',TRUE,'{"label":"Online Storefront QR"}'::jsonb),
  ('53000000-0000-0000-0000-000000000009','50000000-0000-0000-0000-000000000009',NULL,'online','UMKM-ONLINE-SAMBAL-HUTAN',TRUE,'{"label":"Online Storefront QR"}'::jsonb),
  ('53000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000010',NULL,'online','UMKM-ONLINE-TALIWANG-SENGGIGI',TRUE,'{"label":"Online Storefront QR"}'::jsonb),
  ('53000000-0000-0000-0000-000000000106','50000000-0000-0000-0000-000000000007','52000000-0000-0000-0000-000000000011','offline','UMKM-OFFLINE-MEDAN-M01',TRUE,'{"label":"Table QR M01"}'::jsonb),
  ('53000000-0000-0000-0000-000000000107','50000000-0000-0000-0000-000000000007','52000000-0000-0000-0000-000000000012','offline','UMKM-OFFLINE-MEDAN-M02',TRUE,'{"label":"Table QR M02"}'::jsonb),
  ('53000000-0000-0000-0000-000000000108','50000000-0000-0000-0000-000000000008','52000000-0000-0000-0000-000000000013','offline','UMKM-OFFLINE-SEMARANG-G01',TRUE,'{"label":"Table QR G01"}'::jsonb),
  ('53000000-0000-0000-0000-000000000109','50000000-0000-0000-0000-000000000008','52000000-0000-0000-0000-000000000014','offline','UMKM-OFFLINE-SEMARANG-G02',TRUE,'{"label":"Table QR G02"}'::jsonb),
  ('53000000-0000-0000-0000-000000000110','50000000-0000-0000-0000-000000000009','52000000-0000-0000-0000-000000000015','offline','UMKM-OFFLINE-BALIKPAPAN-B01',TRUE,'{"label":"Table QR B01"}'::jsonb),
  ('53000000-0000-0000-0000-000000000111','50000000-0000-0000-0000-000000000009','52000000-0000-0000-0000-000000000016','offline','UMKM-OFFLINE-BALIKPAPAN-B02',TRUE,'{"label":"Table QR B02"}'::jsonb),
  ('53000000-0000-0000-0000-000000000112','50000000-0000-0000-0000-000000000010','52000000-0000-0000-0000-000000000017','offline','UMKM-OFFLINE-LOMBOK-L01',TRUE,'{"label":"Table QR L01"}'::jsonb),
  ('53000000-0000-0000-0000-000000000113','50000000-0000-0000-0000-000000000010','52000000-0000-0000-0000-000000000018','offline','UMKM-OFFLINE-LOMBOK-L02',TRUE,'{"label":"Table QR L02"}'::jsonb)
ON CONFLICT (token) DO UPDATE
SET
  store_id = EXCLUDED.store_id,
  table_id = EXCLUDED.table_id,
  mode = EXCLUDED.mode,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- Seed table layouts for dine-in capable stores
INSERT INTO umkm_tables (id, store_id, table_code, capacity, status, metadata)
VALUES
  ('52000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','T01',2,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','T02',4,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000001','T03',4,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000002','A01',2,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000002','A02',2,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000002','A03',4,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000003','S01',4,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000008','50000000-0000-0000-0000-000000000003','S02',6,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000009','50000000-0000-0000-0000-000000000006','R01',2,'available','{}'::jsonb),
  ('52000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000006','R02',4,'available','{}'::jsonb)
ON CONFLICT (store_id, table_code) DO UPDATE
SET
  capacity = EXCLUDED.capacity,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- Seed QR tokens
INSERT INTO umkm_qr_tokens (id, store_id, table_id, mode, token, is_active, metadata)
VALUES
  -- Online storefront QR per store
  ('53000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',NULL,'online','UMKM-ONLINE-KEDAI-TEBET',TRUE,'{"label":"Online Storefront QR"}'::jsonb),
  ('53000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002',NULL,'online','UMKM-ONLINE-KOPI-BRAGA',TRUE,'{"label":"Online Storefront QR"}'::jsonb),
  ('53000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000003',NULL,'online','UMKM-ONLINE-DAPUR-PESISIR',TRUE,'{"label":"Online Storefront QR"}'::jsonb),
  ('53000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000004',NULL,'online','UMKM-ONLINE-PASAR-RASA',TRUE,'{"label":"Online Storefront QR"}'::jsonb),
  ('53000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000005',NULL,'online','UMKM-ONLINE-WARUNG-SEHAT',TRUE,'{"label":"Online Storefront QR"}'::jsonb),
  ('53000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000006',NULL,'online','UMKM-ONLINE-ROTI-REMPAH',TRUE,'{"label":"Online Storefront QR"}'::jsonb),
  -- Offline dine-in table QR
  ('53000000-0000-0000-0000-000000000101','50000000-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000001','offline','UMKM-OFFLINE-KEDAI-T01',TRUE,'{"label":"Table QR T01"}'::jsonb),
  ('53000000-0000-0000-0000-000000000102','50000000-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000002','offline','UMKM-OFFLINE-KEDAI-T02',TRUE,'{"label":"Table QR T02"}'::jsonb),
  ('53000000-0000-0000-0000-000000000103','50000000-0000-0000-0000-000000000002','52000000-0000-0000-0000-000000000004','offline','UMKM-OFFLINE-KOPI-A01',TRUE,'{"label":"Table QR A01"}'::jsonb),
  ('53000000-0000-0000-0000-000000000104','50000000-0000-0000-0000-000000000003','52000000-0000-0000-0000-000000000007','offline','UMKM-OFFLINE-PESISIR-S01',TRUE,'{"label":"Table QR S01"}'::jsonb),
  ('53000000-0000-0000-0000-000000000105','50000000-0000-0000-0000-000000000006','52000000-0000-0000-0000-000000000009','offline','UMKM-OFFLINE-ROTI-R01',TRUE,'{"label":"Table QR R01"}'::jsonb)
ON CONFLICT (token) DO UPDATE
SET
  store_id = EXCLUDED.store_id,
  table_id = EXCLUDED.table_id,
  mode = EXCLUDED.mode,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
