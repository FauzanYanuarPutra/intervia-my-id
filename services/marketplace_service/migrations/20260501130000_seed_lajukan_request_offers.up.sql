-- Lajukan marketplace enrichment:
-- - Strengthen UMKM storefront metadata for discovery/search surfaces
-- - Attach structured request details to curated demand listings
-- - Seed realistic incoming offers so request/deal flows are backed by DB data

UPDATE umkm_stores
SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'verified', TRUE,
    'rating_avg', CASE slug
      WHEN 'kedai-nusantara-tebet' THEN 4.8
      WHEN 'kopi-sudut-braga' THEN 4.9
      WHEN 'dapur-pesisir-surabaya' THEN 4.7
      WHEN 'pasar-rasa-malioboro' THEN 4.6
      WHEN 'warung-sehat-ubud' THEN 4.8
      WHEN 'roti-rempah-makassar' THEN 4.7
      ELSE 4.6
    END,
    'rating_count', CASE slug
      WHEN 'kedai-nusantara-tebet' THEN 148
      WHEN 'kopi-sudut-braga' THEN 214
      WHEN 'dapur-pesisir-surabaya' THEN 126
      WHEN 'pasar-rasa-malioboro' THEN 92
      WHEN 'warung-sehat-ubud' THEN 108
      WHEN 'roti-rempah-makassar' THEN 84
      ELSE 36
    END,
    'response_time_minutes', CASE slug
      WHEN 'kedai-nusantara-tebet' THEN 4
      WHEN 'kopi-sudut-braga' THEN 3
      WHEN 'dapur-pesisir-surabaya' THEN 6
      WHEN 'pasar-rasa-malioboro' THEN 9
      WHEN 'warung-sehat-ubud' THEN 5
      WHEN 'roti-rempah-makassar' THEN 7
      ELSE 8
    END,
    'umkm_category', CASE slug
      WHEN 'kedai-nusantara-tebet' THEN 'kuliner_nusantara'
      WHEN 'kopi-sudut-braga' THEN 'coffee_shop'
      WHEN 'dapur-pesisir-surabaya' THEN 'seafood_family'
      WHEN 'pasar-rasa-malioboro' THEN 'snack_souvenir'
      WHEN 'warung-sehat-ubud' THEN 'healthy_food'
      WHEN 'roti-rempah-makassar' THEN 'bakery_breakfast'
      ELSE 'umkm_general'
    END,
    'focus_label', CASE slug
      WHEN 'kedai-nusantara-tebet' THEN 'Masakan harian & catering outlet'
      WHEN 'kopi-sudut-braga' THEN 'Coffee, pastry, dan brunch'
      WHEN 'dapur-pesisir-surabaya' THEN 'Seafood keluarga & delivery'
      WHEN 'pasar-rasa-malioboro' THEN 'Oleh-oleh & jajanan tradisional'
      WHEN 'warung-sehat-ubud' THEN 'Healthy bowl & juice bar'
      WHEN 'roti-rempah-makassar' THEN 'Bakery artisan & sarapan cepat'
      ELSE 'Usaha aktif di jaringan Lajukan'
    END,
    'owner_name', CASE slug
      WHEN 'kedai-nusantara-tebet' THEN 'Nadia Putri'
      WHEN 'kopi-sudut-braga' THEN 'Reza Firmansyah'
      WHEN 'dapur-pesisir-surabaya' THEN 'Sinta Permata'
      WHEN 'pasar-rasa-malioboro' THEN 'Dewi Laras'
      WHEN 'warung-sehat-ubud' THEN 'Ayu Lestari'
      WHEN 'roti-rempah-makassar' THEN 'Fajar Mahendra'
      ELSE 'Pemilik usaha'
    END,
    'owner_phone', phone,
    'outlet_active', is_active
  ),
  updated_at = NOW()
WHERE slug IN (
  'kedai-nusantara-tebet',
  'kopi-sudut-braga',
  'dapur-pesisir-surabaya',
  'pasar-rasa-malioboro',
  'warung-sehat-ubud',
  'roti-rempah-makassar'
);

UPDATE content_items
SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'request_status', 'active',
    'request_detail', jsonb_build_object(
      'category', 'Bahan Baku',
      'need_type', 'Supplier',
      'quantity_label', '8 outlet / restock mingguan',
      'deadline_label', 'Mulai minggu ini',
      'budget_label', 'Rp 120.000 - Rp 180.000 / batch',
      'location_label', 'Jakarta Timur dan Bekasi',
      'extra_label', 'Prioritas vendor yang bisa kirim rutin pagi hari dan menjaga rasa tetap konsisten.'
    )
  ),
  updated_at = NOW()
WHERE slug = 'butuh-supplier-bumbu-dan-sambal-untuk-8-outlet-jakarta';

UPDATE content_items
SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'request_status', 'waiting',
    'request_detail', jsonb_build_object(
      'category', 'Distribusi & Channel',
      'need_type', 'Reseller / Live Commerce',
      'quantity_label', '3 channel awal',
      'deadline_label', 'Launch akhir bulan',
      'budget_label', 'Rp 90.000 - Rp 150.000 / paket aktivasi',
      'location_label', 'Bandung dan distribusi online nasional',
      'extra_label', 'Butuh partner yang bisa bergerak cepat untuk batch launch dan sudah paham ritme live commerce kecil.'
    )
  ),
  updated_at = NOW()
WHERE slug = 'cari-reseller-skincare-dan-channel-live-commerce-untuk-koleksi-launch-baru';

UPDATE content_items
SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'request_status', 'active',
    'request_detail', jsonb_build_object(
      'category', 'Kemasan',
      'need_type', 'Jasa Kemasan + Label',
      'quantity_label', '1 batch awal / 3 SKU',
      'deadline_label', 'Maksimal 5 hari',
      'budget_label', 'Rp 60.000 - Rp 95.000 / batch desain',
      'location_label', 'Bekasi / remote',
      'extra_label', 'Fokus ke pouch siap cetak, label cepat, dan mockup yang tidak bertele-tele.'
    )
  ),
  updated_at = NOW()
WHERE slug = 'butuh-jasa-kemasan-frozen-food-plus-desain-label-bekasi';

UPDATE content_items
SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'request_status', 'completed',
    'request_detail', jsonb_build_object(
      'category', 'Sewa Alat',
      'need_type', 'Chiller Showcase',
      'quantity_label', '2 unit / 3 hari event',
      'deadline_label', 'Selesai',
      'budget_label', 'Rp 45.000 - Rp 75.000 / hari',
      'location_label', 'Medan',
      'extra_label', 'Vendor terpilih menangani antar pasang H-1, standby singkat saat event, lalu pickup setelah acara selesai.'
    )
  ),
  updated_at = NOW()
WHERE slug = 'butuh-chiller-showcase-untuk-event-3-hari-di-medan';

UPDATE content_items
SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'request_status', 'completed',
    'request_detail', jsonb_build_object(
      'category', 'Lokasi Usaha',
      'need_type', 'Booth Bazaar',
      'quantity_label', '3 - 5 hari event',
      'deadline_label', 'Selesai',
      'budget_label', 'Rp 95.000 - Rp 140.000 / hari',
      'location_label', 'Bandung Timur',
      'extra_label', 'Venue terpilih punya traffic keluarga sore-malam dan akses loading yang rapi untuk modest fashion dan gift set.'
    )
  ),
  updated_at = NOW()
WHERE slug = 'cari-booth-bazaar-ramadan-area-bandung-timur';

WITH request_map AS (
  SELECT
    id,
    slug,
    owner_id,
    title,
    content_type,
    price_cents,
    currency
  FROM content_items
  WHERE slug IN (
    'butuh-supplier-bumbu-dan-sambal-untuk-8-outlet-jakarta',
    'butuh-jasa-kemasan-frozen-food-plus-desain-label-bekasi',
    'butuh-chiller-showcase-untuk-event-3-hari-di-medan',
    'cari-booth-bazaar-ramadan-area-bandung-timur'
  )
),
seed_offer AS (
  SELECT
    '51000000-0000-0000-0000-000000000001'::uuid AS id,
    'butuh-supplier-bumbu-dan-sambal-untuk-8-outlet-jakarta'::text AS slug,
    '00000000-0000-0000-0000-000000000801'::uuid AS seller_id,
    13200000::bigint AS amount_cents,
    'pending'::text AS transaction_status,
    'product'::text AS deal_kind,
    'shipping'::text AS fulfillment_mode,
    'awaiting_funding'::text AS protection_status,
    'Bisa bantu kirim sambal dasar dan bumbu mingguan untuk 8 outlet.'::text AS offer_message,
    'Siap mulai trial pengiriman minggu ini dengan batch awal kecil lebih dulu.'::text AS response_message,
    '{
      "vendor_name": "Bumbu Nusantara Collective",
      "vendor_rating": 4.8,
      "vendor_review_count": 128,
      "delivery_label": "Mulai 2 hari",
      "guarantee_label": "Batch QC per kiriman",
      "offer_note": "Punya jalur produksi sambal dan bumbu dasar dengan ritme restock mingguan untuk outlet F&B."
    }'::jsonb AS transaction_meta,
    NOW() - INTERVAL '19 hours' AS created_at
  UNION ALL
  SELECT
    '51000000-0000-0000-0000-000000000002'::uuid,
    'butuh-supplier-bumbu-dan-sambal-untuk-8-outlet-jakarta',
    '00000000-0000-0000-0000-000000000802'::uuid,
    12400000,
    'accepted',
    'product',
    'shipping',
    'funds_held',
    'Kami bisa kirim sambal kemasan dan bumbu dasar dengan ritme pagi.',
    'MOQ awal fleksibel, lalu bisa naik setelah 2 minggu trial.',
    '{
      "vendor_name": "Sambal Niaga Sentra",
      "vendor_rating": 4.7,
      "vendor_review_count": 96,
      "delivery_label": "Mulai besok pagi",
      "guarantee_label": "Harga stabil 30 hari",
      "offer_note": "Cocok untuk owner yang ingin mulai trial cepat tanpa kontrak panjang di awal."
    }'::jsonb,
    NOW() - INTERVAL '12 hours'
  UNION ALL
  SELECT
    '51000000-0000-0000-0000-000000000003'::uuid,
    'butuh-jasa-kemasan-frozen-food-plus-desain-label-bekasi',
    '00000000-0000-0000-0000-000000000803'::uuid,
    7800000,
    'pending',
    'service',
    'remote',
    'awaiting_funding',
    'Kami bisa kerjakan pouch, label, dan mockup dalam satu jalur revisi ringan.',
    'Sanggup deliver file siap cetak dalam 4-5 hari kerja.',
    '{
      "vendor_name": "PouchLab Bekasi",
      "vendor_rating": 4.9,
      "vendor_review_count": 74,
      "delivery_label": "4 - 5 hari",
      "guarantee_label": "2 revisi cepat",
      "offer_note": "Punya paket kemasan cepat untuk frozen food, termasuk mockup dasar agar batch awal langsung siap jual."
    }'::jsonb,
    NOW() - INTERVAL '11 hours'
  UNION ALL
  SELECT
    '51000000-0000-0000-0000-000000000004'::uuid,
    'butuh-jasa-kemasan-frozen-food-plus-desain-label-bekasi',
    '00000000-0000-0000-0000-000000000804'::uuid,
    8400000,
    'accepted',
    'service',
    'remote',
    'funds_held',
    'Bisa bantu pouch, label, dan layout dasar dengan workflow ringan.',
    'Lebih cocok kalau batch awal ingin cepat naik ke toko online minggu ini.',
    '{
      "vendor_name": "Label Kilat Studio",
      "vendor_rating": 4.6,
      "vendor_review_count": 52,
      "delivery_label": "3 - 4 hari",
      "guarantee_label": "Preview H+1",
      "offer_note": "Workflow ringkas dengan fokus ke label siap cetak dan mockup untuk approval cepat."
    }'::jsonb,
    NOW() - INTERVAL '8 hours'
  UNION ALL
  SELECT
    '51000000-0000-0000-0000-000000000005'::uuid,
    'butuh-chiller-showcase-untuk-event-3-hari-di-medan',
    '00000000-0000-0000-0000-000000000805'::uuid,
    6200000,
    'completed',
    'other',
    'onsite',
    'released',
    'Kami siap antar pasang dua unit chiller dan standby singkat saat event.',
    'Event selesai rapi, pickup dilakukan malam terakhir tanpa biaya tambahan.',
    '{
      "vendor_name": "ColdHub Event Medan",
      "vendor_rating": 4.8,
      "vendor_review_count": 41,
      "delivery_label": "H-1 pemasangan",
      "guarantee_label": "Teknisi standby",
      "offer_note": "Spesialis pendingin event dengan teknisi lapangan dan pickup terjadwal setelah acara."
    }'::jsonb,
    NOW() - INTERVAL '4 days'
  UNION ALL
  SELECT
    '51000000-0000-0000-0000-000000000006'::uuid,
    'cari-booth-bazaar-ramadan-area-bandung-timur',
    '00000000-0000-0000-0000-000000000806'::uuid,
    11800000,
    'completed',
    'property',
    'onsite',
    'released',
    'Kami punya venue bazaar keluarga dengan tenant campuran F&B dan fashion.',
    'Booth dipakai 4 hari, akses loading lancar, dan traffic malam sesuai target brand.',
    '{
      "vendor_name": "Timur Space Hall",
      "vendor_rating": 4.7,
      "vendor_review_count": 37,
      "delivery_label": "Survey 1 hari",
      "guarantee_label": "Akses loading terjaga",
      "offer_note": "Venue event keluarga dengan kombinasi tenant F&B, gift, dan modest fashion yang sudah terbukti ramai sore-malam."
    }'::jsonb,
    NOW() - INTERVAL '6 days'
)
INSERT INTO transactions (
  id,
  content_id,
  buyer_id,
  seller_id,
  amount_cents,
  currency,
  transaction_status,
  protection_status,
  deal_kind,
  fulfillment_mode,
  snapshot_listing,
  transaction_meta,
  offer_message,
  response_message,
  created_at,
  updated_at
)
SELECT
  seed_offer.id,
  request_map.id,
  request_map.owner_id,
  seed_offer.seller_id,
  seed_offer.amount_cents,
  COALESCE(request_map.currency, 'IDR'),
  seed_offer.transaction_status,
  seed_offer.protection_status,
  seed_offer.deal_kind,
  seed_offer.fulfillment_mode,
  jsonb_build_object(
    'content_id', request_map.id,
    'title', request_map.title,
    'slug', request_map.slug,
    'content_type', request_map.content_type,
    'price_cents', request_map.price_cents,
    'currency', COALESCE(request_map.currency, 'IDR')
  ),
  seed_offer.transaction_meta,
  seed_offer.offer_message,
  seed_offer.response_message,
  seed_offer.created_at,
  seed_offer.created_at + INTERVAL '2 hours'
FROM seed_offer
JOIN request_map
  ON request_map.slug = seed_offer.slug
ON CONFLICT (id) DO UPDATE
SET
  amount_cents = EXCLUDED.amount_cents,
  currency = EXCLUDED.currency,
  transaction_status = EXCLUDED.transaction_status,
  protection_status = EXCLUDED.protection_status,
  deal_kind = EXCLUDED.deal_kind,
  fulfillment_mode = EXCLUDED.fulfillment_mode,
  snapshot_listing = EXCLUDED.snapshot_listing,
  transaction_meta = EXCLUDED.transaction_meta,
  offer_message = EXCLUDED.offer_message,
  response_message = EXCLUDED.response_message,
  updated_at = EXCLUDED.updated_at;

SELECT 1;
