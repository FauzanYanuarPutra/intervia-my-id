UPDATE content_items
SET
  metadata = '{
    "market_side": "demand",
    "location": "Jakarta Timur",
    "city": "Jakarta",
    "sector": "food_operations",
    "brand": "Bumbu dasar, sambal kemasan, item restock cepat",
    "stock": 8,
    "delivery_estimate": "mulai minggu ini",
    "min_order_qty": 1,
    "specs": "Cari partner pasokan konsisten untuk bumbu dasar, sambal kemasan, dan item cepat restock. Prioritas kirim rutin ke Jakarta Timur dan Bekasi.",
    "address": "Jakarta Timur dan Bekasi",
    "listing_mode": "detail",
    "listing_form_version": 4
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'butuh-supplier-bumbu-dan-sambal-untuk-8-outlet-jakarta';

UPDATE content_items
SET
  content_type = 'service',
  category = 'service',
  slug = 'cari-reseller-skincare-dan-channel-live-commerce-untuk-koleksi-launch-baru',
  title = 'Cari reseller skincare dan channel live commerce untuk koleksi launch baru.',
  summary = 'Butuh reseller aktif, booth kampus, dan host live yang siap bantu aktivasi launch batch awal.',
  body = 'Brand sedang test distribusi baru untuk paket launch dan butuh partner yang bisa gerak cepat. Lebih cocok untuk channel reseller, host live, dan booth/event kecil yang sudah punya audience awal.',
  metadata = '{
    "market_side": "demand",
    "location": "Bandung",
    "city": "Bandung",
    "sector": "beauty_retail",
    "work_mode": "hybrid",
    "service_scope": "Aktivasi channel reseller, booth kampus, dan live commerce untuk koleksi launch baru.",
    "deliverables": "Shortlist partner channel, host live siap jualan, dan rencana aktivasi awal.",
    "area_served": "Bandung dan distribusi online nasional",
    "delivery_time": "launch akhir bulan",
    "client_requirements": "Open untuk reseller aktif, booth kampus, host live dengan audience kecil, dan partner yang bisa gerak cepat.",
    "listing_mode": "detail",
    "listing_form_version": 4
  }'::jsonb,
  updated_at = NOW()
WHERE slug IN (
  'cari-reseller-skincare-dan-channel-live-commerce-bandung',
  'cari-reseller-skincare-dan-channel-live-commerce-untuk-koleksi-launch-baru'
) OR title = 'Cari reseller skincare dan channel live commerce untuk koleksi launch baru.';

UPDATE content_items
SET
  metadata = '{
    "market_side": "demand",
    "location": "Bekasi",
    "city": "Bekasi",
    "sector": "brand_support",
    "work_mode": "hybrid",
    "service_scope": "Kemasan pouch, label, dan revisi visual dasar untuk batch baru.",
    "deliverables": "Pouch siap cetak, label, mockup, dan revisi ringan.",
    "area_served": "Bekasi / remote",
    "delivery_time": "maksimal 5 hari",
    "client_requirements": "Batch awal sudah siap produksi dan butuh vendor yang bisa mockup cepat tanpa proses panjang.",
    "listing_mode": "detail",
    "listing_form_version": 4
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'butuh-jasa-kemasan-frozen-food-plus-desain-label-bekasi';

UPDATE content_items
SET
  metadata = '{
    "market_side": "demand",
    "location": "Bandung Timur",
    "city": "Bandung",
    "sector": "event_space",
    "listing_purpose": "rent",
    "property_type": "commercial",
    "area_sqm": 12,
    "available_from": "2026-04-20",
    "address": "Bandung Timur, dekat tenant keluarga dengan akses loading mudah",
    "amenities": "Traffic keluarga dan komunitas, tenant campuran F&B, gift, dan fashion",
    "listing_mode": "detail",
    "listing_form_version": 4
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'cari-booth-bazaar-ramadan-area-bandung-timur';

UPDATE content_items
SET
  metadata = '{
    "market_side": "demand",
    "location": "Medan",
    "city": "Medan",
    "sector": "tool_rental",
    "brand": "Chiller showcase event",
    "model_name": "Display minuman kapasitas besar",
    "specs": "Target alat siap H-1 dan stabil selama jam ramai untuk event 3 hari.",
    "condition": "good",
    "rental_rate_type": "daily",
    "minimum_rental_days": 3,
    "pickup_location": "Medan",
    "delivery_estimate": "event minggu depan",
    "usage_restrictions": "Butuh antar pasang H-1 dan pickup setelah acara.",
    "listing_mode": "detail",
    "listing_form_version": 4
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'butuh-chiller-showcase-untuk-event-3-hari-di-medan';
