-- Backend-backed search enrichment.
-- This keeps /search useful from marketplace_service seed data instead of
-- frontend-local fallback catalog data.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_content_metadata_search_text_trgm
ON content_items USING GIN ((COALESCE(metadata->>'search_text', '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_content_metadata_city_trgm
ON content_items USING GIN ((COALESCE(metadata->>'city', '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_content_metadata_location_trgm
ON content_items USING GIN ((COALESCE(metadata->>'location', '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_content_metadata_sub_sector_trgm
ON content_items USING GIN ((COALESCE(metadata->>'sub_sector', '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_umkm_stores_name_trgm
ON umkm_stores USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_umkm_stores_description_trgm
ON umkm_stores USING GIN ((COALESCE(description, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_umkm_stores_metadata_search_trgm
ON umkm_stores USING GIN ((COALESCE(metadata->>'search_text', '')) gin_trgm_ops);

WITH seed_cities(city, city_slug, service_area, price_factor) AS (
  VALUES
    ('Jakarta', 'jakarta', 'Jabodetabek', 1.18::numeric),
    ('Bandung', 'bandung', 'Bandung Raya', 1.00::numeric),
    ('Surabaya', 'surabaya', 'Gerbangkertosusila', 1.08::numeric),
    ('Yogyakarta', 'yogyakarta', 'DIY dan Jawa Tengah selatan', 0.92::numeric),
    ('Bekasi', 'bekasi', 'Bekasi, Jakarta Timur, dan Karawang', 1.02::numeric),
    ('Tangerang', 'tangerang', 'Tangerang Raya dan Jakarta Barat', 1.04::numeric),
    ('Denpasar', 'denpasar', 'Denpasar, Badung, dan Gianyar', 1.12::numeric),
    ('Makassar', 'makassar', 'Makassar dan Gowa', 0.96::numeric)
),
seed_templates(
  owner_id, content_type, slug_seed, title_template, summary_template, body_template,
  pricing_mode, base_price_cents, sector, sub_sector, market_side, tags, attrs,
  rating, review_count
) AS (
  VALUES
    ('00000000-0000-0000-0000-000000000511', 'product', 'supplier-cemilan-reseller', 'Supplier cemilan reseller {{city}}', 'Snack kiloan, keripik, makaroni, dan bumbu tabur untuk warung {{city}}.', 'Stok cocok untuk reseller, kantin, dan toko kecil yang perlu restock mingguan. Bisa campur SKU dan diskusi kemasan sederhana.', 'fixed', 18500000, 'food_supply', 'snack_reseller', 'supply', ARRAY['supplier', 'cemilan', 'snack grosir', 'reseller'], '{"minimum_order":"mulai 10 pack per SKU","lead_time":"1-2 hari kerja"}'::jsonb, 4.78, 42),
    ('00000000-0000-0000-0000-000000000511', 'product', 'bahan-baku-frozen-food', 'Bahan baku frozen food {{city}}', 'Ayam marinated, saus, tepung, dan topping untuk outlet frozen food {{city}}.', 'Paket bahan baku untuk cloud kitchen, booth sekolah, dan kedai cepat saji. Pengiriman bisa dijadwalkan untuk menjaga stok dingin.', 'fixed', 24500000, 'food_supply', 'frozen_food', 'supply', ARRAY['frozen food', 'bahan baku', 'ayam marinasi', 'supplier fnb'], '{"minimum_order":"1 karton per item","cold_chain":true}'::jsonb, 4.84, 58),
    ('00000000-0000-0000-0000-000000000512', 'product', 'pouch-label-stiker-kemasan', 'Pouch label dan stiker kemasan {{city}}', 'Kemasan pouch, stiker label, dan print-ready mockup untuk brand kecil {{city}}.', 'Cocok untuk skincare lokal, snack, kopi, hampers, dan produk retail yang butuh tampilan lebih rapi sebelum masuk marketplace.', 'fixed', 12500000, 'brand_support', 'packaging', 'supply', ARRAY['kemasan', 'pouch', 'stiker label', 'packaging'], '{"minimum_order":"mulai 100 pcs","design_file":"AI, PDF, PNG"}'::jsonb, 4.72, 35),
    ('00000000-0000-0000-0000-000000000516', 'product', 'biji-kopi-roastery', 'Biji kopi roastery untuk cafe {{city}}', 'Arabica, robusta, house blend, dan private label untuk kedai kopi {{city}}.', 'Roast profile bisa disesuaikan untuk espresso, manual brew, atau minuman susu. Tersedia sample batch untuk uji menu.', 'fixed', 9800000, 'food_supply', 'coffee_roastery', 'supply', ARRAY['kopi', 'roastery', 'cafe', 'private label'], '{"minimum_order":"2 kg per blend","sample_available":true}'::jsonb, 4.81, 49),
    ('00000000-0000-0000-0000-000000000511', 'product', 'beras-sembako-warung', 'Supplier beras dan sembako warung {{city}}', 'Beras premium, gula, minyak, telur, dan kebutuhan toko harian area {{city}}.', 'Fokus pada stok cepat putar untuk warung, katering, dan kios sembako. Bisa bantu jadwal kirim rutin dan harga volume.', 'fixed', 32000000, 'food_supply', 'sembako', 'supply', ARRAY['beras', 'sembako', 'warung', 'grosir'], '{"minimum_order":"mulai 5 karung campur","delivery_schedule":"harian"}'::jsonb, 4.76, 61),
    ('00000000-0000-0000-0000-000000000517', 'product', 'fashion-muslim-ready-stock', 'Fashion muslim ready stock {{city}}', 'Gamis, hijab, tunik, dan set keluarga untuk reseller fashion {{city}}.', 'Katalog disiapkan untuk live selling, toko online, dan reseller komunitas. Tersedia ukuran campur dan konten foto basic.', 'fixed', 27500000, 'retail', 'fashion_muslim', 'supply', ARRAY['fashion muslim', 'hijab', 'gamis', 'reseller'], '{"size_range":"S-XXL","content_pack":true}'::jsonb, 4.69, 27),
    ('00000000-0000-0000-0000-000000000518', 'product', 'hampers-souvenir-corporate', 'Hampers dan souvenir corporate {{city}}', 'Paket hampers, souvenir kantor, dan gift set custom untuk event {{city}}.', 'Bisa dipakai untuk acara kantor, seminar, komunitas, dan seasonal campaign. Isi paket dapat disesuaikan budget dan tema.', 'fixed', 45000000, 'corporate_gift', 'hampers', 'supply', ARRAY['hampers', 'souvenir', 'gift set', 'event'], '{"minimum_order":"mulai 25 paket","custom_card":true}'::jsonb, 4.74, 33),
    ('00000000-0000-0000-0000-000000000517', 'product', 'skincare-lokal-reseller', 'Skincare lokal reseller {{city}}', 'Toner, serum, sunscreen, dan body care BPOM-ready untuk reseller {{city}}.', 'Listing ini untuk reseller yang butuh stok produk perawatan dengan materi edukasi singkat, varian jelas, dan repeat order mudah.', 'fixed', 38000000, 'beauty', 'skincare_reseller', 'supply', ARRAY['skincare', 'beauty', 'reseller', 'bpom'], '{"minimum_order":"paket reseller 20 pcs","bpom_ready":true}'::jsonb, 4.82, 46),

    ('00000000-0000-0000-0000-000000000512', 'service', 'jasa-admin-marketplace', 'Jasa admin marketplace {{city}}', 'Upload katalog, variasi produk, cek stok, dan follow up chat buyer untuk seller {{city}}.', 'Cocok untuk owner yang sudah punya produk tetapi belum sempat menjaga dashboard harian. Bisa bantu ritme Shopee, Tokopedia, TikTok Shop, dan katalog Lajukan.', 'fixed', 65000000, 'operations_support', 'marketplace_admin', 'supply', ARRAY['admin marketplace', 'upload katalog', 'chat buyer', 'operasional'], '{"work_mode":"remote","delivery_time":"mulai 1 hari onboarding"}'::jsonb, 4.79, 31),
    ('00000000-0000-0000-0000-000000000515', 'service', 'jasa-live-shopping-host', 'Jasa host live shopping {{city}}', 'Host live untuk beauty, fashion, snack, dan produk UMKM area {{city}}.', 'Paket mencakup rundown, hook opening, demo produk, dan laporan sederhana setelah live. Bisa remote studio atau onsite sesuai kebutuhan.', 'fixed', 120000000, 'marketing', 'live_commerce', 'supply', ARRAY['live shopping', 'host live', 'tiktok shop', 'jualan live'], '{"work_mode":"hybrid","session_duration":"2 jam"}'::jsonb, 4.86, 52),
    ('00000000-0000-0000-0000-000000000512', 'service', 'foto-produk-katalog', 'Foto produk katalog {{city}}', 'Foto produk clean, lifestyle, dan crop marketplace untuk brand {{city}}.', 'Cocok untuk SKU snack, fashion, beauty, craft, dan menu F&B. Output siap dipakai untuk marketplace, katalog WhatsApp, dan poster promo.', 'fixed', 90000000, 'creative_service', 'product_photography', 'supply', ARRAY['foto produk', 'katalog', 'marketplace', 'konten'], '{"work_mode":"onsite atau kirim produk","deliverables":"20 foto edit"}'::jsonb, 4.75, 40),
    ('00000000-0000-0000-0000-000000000512', 'service', 'desain-kemasan-branding', 'Desain kemasan dan branding {{city}}', 'Logo ringan, label, guideline warna, dan mockup kemasan untuk UMKM {{city}}.', 'Dirancang untuk bisnis yang ingin naik kelas tanpa proses branding yang terlalu berat. Output fokus pada kebutuhan jualan cepat.', 'fixed', 175000000, 'brand_support', 'packaging_design', 'supply', ARRAY['desain kemasan', 'branding', 'logo', 'mockup'], '{"work_mode":"remote","revision":"2 putaran"}'::jsonb, 4.83, 44),
    ('00000000-0000-0000-0000-000000000518', 'service', 'pembukuan-umkm-bulanan', 'Pembukuan UMKM bulanan {{city}}', 'Rekap penjualan, biaya, stok sederhana, dan laporan laba rugi untuk usaha {{city}}.', 'Layanan membantu owner melihat arus kas tanpa spreadsheet yang berantakan. Cocok untuk warung, cafe kecil, reseller, dan toko offline.', 'fixed', 85000000, 'finance_ops', 'bookkeeping', 'supply', ARRAY['pembukuan', 'akuntansi umkm', 'laporan keuangan', 'cashflow'], '{"work_mode":"remote","monthly_close":"tanggal 5"}'::jsonb, 4.77, 36),
    ('00000000-0000-0000-0000-000000000515', 'service', 'iklan-digital-umkm', 'Iklan digital UMKM {{city}}', 'Setup iklan Meta, TikTok, dan Google untuk campaign lokal {{city}}.', 'Paket mencakup struktur campaign, copy awal, audience, dan monitoring baseline. Cocok untuk launching produk atau traffic toko.', 'fixed', 135000000, 'marketing', 'paid_ads', 'supply', ARRAY['iklan digital', 'meta ads', 'tiktok ads', 'google ads'], '{"work_mode":"remote","minimum_duration":"14 hari"}'::jsonb, 4.71, 28),
    ('00000000-0000-0000-0000-000000000518', 'service', 'legalitas-nib-pirt-halal', 'Bantu legalitas NIB PIRT halal {{city}}', 'Pendampingan dokumen NIB, PIRT, halal self declare, dan checklist usaha {{city}}.', 'Cocok untuk brand makanan kecil yang ingin masuk reseller, event, atau retail modern. Proses mengikuti kesiapan dokumen owner.', 'fixed', 70000000, 'business_support', 'licensing', 'supply', ARRAY['nib', 'pirt', 'halal', 'legalitas umkm'], '{"work_mode":"hybrid","document_checklist":true}'::jsonb, 4.73, 24),

    ('00000000-0000-0000-0000-000000000514', 'property', 'booth-pop-up-weekend', 'Booth pop-up weekend {{city}}', 'Spot booth untuk F&B, craft, beauty, dan komunitas lokal di {{city}}.', 'Lokasi cocok untuk brand yang ingin tes produk, campaign musiman, atau aktivasi komunitas. Durasi fleksibel sesuai event.', 'fixed', 42000000, 'event_space', 'booth_popup', 'supply', ARRAY['booth', 'pop up', 'bazaar', 'tenant'], '{"property_type":"booth","lease_term":"3 hari","available_slots":4}'::jsonb, 4.62, 18),
    ('00000000-0000-0000-0000-000000000514', 'property', 'kios-food-court', 'Kios food court {{city}}', 'Kios siap pakai untuk minuman, rice bowl, snack, atau dessert di {{city}}.', 'Sudah ada area duduk bersama dan alur operasional tenant. Cocok untuk ekspansi outlet kecil tanpa renovasi besar.', 'fixed', 85000000, 'food_space', 'food_court_kiosk', 'supply', ARRAY['kios', 'food court', 'lokasi jualan', 'tenant'], '{"property_type":"kios","lease_term":"bulanan","area_sqm":18}'::jsonb, 4.66, 23),
    ('00000000-0000-0000-0000-000000000514', 'property', 'dapur-produksi-cloud-kitchen', 'Dapur produksi cloud kitchen {{city}}', 'Dapur produksi untuk katering, frozen food, dan delivery brand {{city}}.', 'Tersedia area prep, sink, listrik memadai, dan akses kurir. Cocok untuk scale up tanpa sewa ruko penuh.', 'fixed', 160000000, 'food_space', 'cloud_kitchen', 'supply', ARRAY['cloud kitchen', 'dapur produksi', 'katering', 'frozen food'], '{"property_type":"production_kitchen","lease_term":"bulanan","area_sqm":32}'::jsonb, 4.7, 19),
    ('00000000-0000-0000-0000-000000000514', 'property', 'gudang-micro-fulfillment', 'Gudang micro fulfillment {{city}}', 'Ruang simpan stok kecil untuk seller online dan reseller area {{city}}.', 'Cocok untuk stok fashion, kemasan, hampers, dan produk kering. Bisa dipakai sebagai titik packing harian.', 'fixed', 110000000, 'warehouse', 'micro_fulfillment', 'supply', ARRAY['gudang', 'fulfillment', 'packing', 'stok'], '{"property_type":"warehouse","lease_term":"bulanan","area_sqm":45}'::jsonb, 4.63, 16),

    ('00000000-0000-0000-0000-000000000513', 'tool_rental', 'sewa-freezer-display', 'Sewa freezer display {{city}}', 'Freezer display dan chiller showcase untuk tenant frozen food {{city}}.', 'Paket sewa cocok untuk event, launching menu beku, atau outlet sementara. Tersedia opsi antar pasang dan pickup.', 'fixed', 7800000, 'tool_rental', 'cold_storage', 'supply', ARRAY['sewa freezer', 'chiller', 'frozen food', 'alat dingin'], '{"asset_type":"freezer_display","rental_period":"harian atau mingguan"}'::jsonb, 4.8, 22),
    ('00000000-0000-0000-0000-000000000515', 'tool_rental', 'sewa-kamera-live-streaming', 'Sewa kamera live streaming {{city}}', 'Kamera, lighting, tripod, dan mic wireless untuk live selling {{city}}.', 'Cocok untuk host live, brand kecil, event komunitas, dan sesi foto katalog sederhana. Bisa tambah operator bila diperlukan.', 'fixed', 5500000, 'tool_rental', 'live_streaming_gear', 'supply', ARRAY['sewa kamera', 'live streaming', 'lighting', 'mic wireless'], '{"asset_type":"camera_live_set","rental_period":"harian"}'::jsonb, 4.74, 29),
    ('00000000-0000-0000-0000-000000000514', 'tool_rental', 'sewa-tenda-event-booth', 'Sewa tenda event booth {{city}}', 'Tenda lipat, meja tenant, kursi, dan signage dasar untuk bazaar {{city}}.', 'Perlengkapan cocok untuk pop-up market, car free day, kampus, dan event komunitas. Tersedia tim bongkar pasang.', 'fixed', 6200000, 'tool_rental', 'event_booth_equipment', 'supply', ARRAY['sewa tenda', 'event', 'booth', 'bazaar'], '{"asset_type":"event_tent_set","rental_period":"harian"}'::jsonb, 4.68, 17),
    ('00000000-0000-0000-0000-000000000513', 'tool_rental', 'sewa-vacuum-sealer', 'Sewa vacuum sealer makanan {{city}}', 'Vacuum sealer dan impulse sealer untuk frozen food, snack, dan sample produksi {{city}}.', 'Cocok untuk uji batch, produksi seasonal, atau brand baru yang belum perlu beli mesin sendiri.', 'fixed', 3800000, 'tool_rental', 'packaging_tools', 'supply', ARRAY['vacuum sealer', 'sewa mesin', 'kemasan makanan', 'frozen food'], '{"asset_type":"vacuum_sealer","rental_period":"harian atau mingguan"}'::jsonb, 4.71, 14),

    ('00000000-0000-0000-0000-000000000518', 'job', 'loker-admin-toko-online', 'Loker admin toko online {{city}}', 'Butuh admin marketplace untuk upload produk, balas chat, dan cek pesanan di {{city}}.', 'Peran ini untuk usaha yang sedang menambah kapasitas operasional. Kandidat perlu teliti, cepat follow up, dan paham dashboard toko online.', 'request', 420000000, 'operations', 'marketplace_admin', 'demand', ARRAY['loker', 'admin toko online', 'marketplace', 'customer chat'], '{"employment_type":"full_time","level":"junior","work_mode":"hybrid"}'::jsonb, 4.6, 12),
    ('00000000-0000-0000-0000-000000000516', 'job', 'loker-crew-outlet-fnb', 'Loker crew outlet F&B {{city}}', 'Cari crew outlet untuk kasir, prep menu, packing, dan kebersihan area {{city}}.', 'Cocok untuk kandidat yang siap shift, ramah dengan pelanggan, dan bisa menjaga ritme operasional harian.', 'request', 380000000, 'hospitality', 'outlet_crew', 'demand', ARRAY['loker fnb', 'crew outlet', 'kasir', 'barista'], '{"employment_type":"shift","level":"entry","work_mode":"onsite"}'::jsonb, 4.58, 11),
    ('00000000-0000-0000-0000-000000000511', 'job', 'loker-kurir-area', 'Loker kurir area {{city}}', 'Butuh kurir motor untuk pickup stok, antar order, dan rute toko sekitar {{city}}.', 'Kandidat perlu paham area, punya kendaraan aktif, dan mampu update status pengiriman dengan rapi.', 'request', 450000000, 'logistics', 'courier', 'demand', ARRAY['loker kurir', 'delivery', 'motor', 'logistik'], '{"employment_type":"contract","level":"entry","work_mode":"onsite"}'::jsonb, 4.57, 9),
    ('00000000-0000-0000-0000-000000000515', 'job', 'loker-content-creator-umkm', 'Loker content creator UMKM {{city}}', 'Cari content creator untuk video pendek, foto produk, dan kalender konten {{city}}.', 'Peran cocok untuk kreator yang bisa eksekusi cepat, paham hook jualan, dan nyaman bekerja dengan produk lokal.', 'request', 520000000, 'marketing', 'content_creator', 'demand', ARRAY['loker content creator', 'video pendek', 'foto produk', 'social media'], '{"employment_type":"part_time","level":"mid","work_mode":"hybrid"}'::jsonb, 4.65, 13),
    ('00000000-0000-0000-0000-000000000517', 'job', 'loker-sales-kanvas-reseller', 'Loker sales kanvas reseller {{city}}', 'Butuh sales kanvas untuk buka reseller, follow up toko, dan demo produk {{city}}.', 'Fokus pada akuisisi toko kecil, komunitas reseller, dan repeat order. Komisi bisa dibahas sesuai target.', 'request', 480000000, 'sales', 'reseller_sales', 'demand', ARRAY['loker sales', 'sales kanvas', 'reseller', 'akuisisi toko'], '{"employment_type":"contract","level":"mid","work_mode":"field"}'::jsonb, 4.61, 10),

    ('00000000-0000-0000-0000-000000000515', 'freelancer', 'fotografer-produk-umkm', 'Fotografer produk UMKM {{city}}', 'Talent foto produk untuk snack, fashion, beauty, dan menu F&B di {{city}}.', 'Portofolio cocok untuk katalog marketplace, poster promo, dan konten social. Bisa basic styling produk dan edit warna natural.', 'fixed', 65000000, 'creative_service', 'product_photographer', 'supply', ARRAY['fotografer produk', 'talent', 'katalog', 'foto umkm'], '{"profession":"product photographer","work_mode":"onsite","entity_kind":"person"}'::jsonb, 4.88, 57),
    ('00000000-0000-0000-0000-000000000515', 'freelancer', 'host-live-commerce', 'Host live commerce {{city}}', 'Talent host live untuk demo produk, flash sale, dan campaign UMKM {{city}}.', 'Cocok untuk brand yang butuh host komunikatif, familiar dengan selling script, dan mampu menjaga energi live.', 'fixed', 80000000, 'marketing', 'live_host', 'supply', ARRAY['host live', 'talent', 'live commerce', 'jualan live'], '{"profession":"live commerce host","work_mode":"hybrid","entity_kind":"person"}'::jsonb, 4.86, 49),
    ('00000000-0000-0000-0000-000000000512', 'freelancer', 'desainer-kemasan-freelance', 'Desainer kemasan freelance {{city}}', 'Talent desain label, pouch, box, dan katalog ringan untuk brand {{city}}.', 'Bisa bantu mulai dari brief singkat sampai file siap print. Cocok untuk produk makanan, beauty, craft, dan hampers.', 'fixed', 95000000, 'brand_support', 'packaging_designer', 'supply', ARRAY['desainer kemasan', 'freelancer', 'label', 'mockup'], '{"profession":"packaging designer","work_mode":"remote","entity_kind":"person"}'::jsonb, 4.79, 38),
    ('00000000-0000-0000-0000-000000000518', 'freelancer', 'akuntan-umkm-freelance', 'Akuntan UMKM freelance {{city}}', 'Talent pembukuan, rekonsiliasi, dan laporan sederhana untuk usaha {{city}}.', 'Membantu owner melihat penjualan, biaya, stok, dan kas bulanan dengan format yang mudah dibaca.', 'fixed', 70000000, 'finance_ops', 'bookkeeper', 'supply', ARRAY['akuntan umkm', 'bookkeeper', 'freelancer', 'laporan keuangan'], '{"profession":"bookkeeper","work_mode":"remote","entity_kind":"person"}'::jsonb, 4.76, 34),
    ('00000000-0000-0000-0000-000000000513', 'freelancer', 'teknisi-pos-kasir', 'Teknisi POS dan kasir {{city}}', 'Talent setup printer struk, POS, QR order, dan perangkat kasir untuk outlet {{city}}.', 'Cocok untuk cafe, restoran kecil, dan toko retail yang butuh perangkat siap operasional tanpa ribet.', 'fixed', 55000000, 'operations_support', 'pos_technician', 'supply', ARRAY['teknisi pos', 'kasir', 'printer struk', 'qr order'], '{"profession":"POS technician","work_mode":"onsite","entity_kind":"person"}'::jsonb, 4.73, 25)
),
seed_rows AS (
  SELECT
    ROW_NUMBER() OVER (ORDER BY template.slug_seed, city.city_slug) AS rn,
    template.owner_id,
    template.content_type,
    format('%s-%s', template.slug_seed, city.city_slug) AS slug,
    replace(template.title_template, '{{city}}', city.city) AS title,
    replace(template.summary_template, '{{city}}', city.city) AS summary,
    replace(template.body_template, '{{city}}', city.city) AS body,
    template.pricing_mode,
    GREATEST(0, (template.base_price_cents * city.price_factor)::bigint) AS price_cents,
    template.sector,
    template.sub_sector,
    template.market_side,
    template.tags || ARRAY[lower(city.city), template.sector, template.sub_sector] AS tags,
    CASE
      WHEN template.content_type = 'property' THEN '/images/umkm/content-property.svg'
      WHEN template.content_type = 'service' THEN '/images/umkm/content-service.svg'
      WHEN template.content_type = 'job' THEN '/images/umkm/content-job.svg'
      WHEN template.content_type = 'freelancer' THEN '/images/umkm/content-talent.svg'
      WHEN template.content_type = 'tool_rental' THEN '/images/umkm/content-listing.svg'
      ELSE '/images/umkm/content-product.svg'
    END AS cover_image,
    city.city,
    city.service_area,
    template.attrs,
    template.rating,
    template.review_count
  FROM seed_templates template
  CROSS JOIN seed_cities city
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
  currency,
  tags,
  cover_image,
  category,
  content_status,
  rating,
  review_count,
  metadata,
  created_at,
  updated_at
)
SELECT
  owner_id::uuid,
  content_type,
  slug,
  title,
  summary,
  body,
  pricing_mode,
  price_cents,
  'IDR',
  tags,
  cover_image,
  content_type,
  'active',
  LEAST(5.0, rating + ((rn % 4)::numeric * 0.03)),
  review_count + (rn % 23),
  jsonb_build_object(
    'market_side', market_side,
    'location', city,
    'city', city,
    'service_area', service_area,
    'sector', sector,
    'sub_sector', sub_sector,
    'verified', true,
    'seed_source', 'marketplace_service_curated_search_grid_v1',
    'image_urls', jsonb_build_array(cover_image),
    'search_text', concat_ws(' ', title, summary, body, array_to_string(tags, ' '), city, service_area, sector, sub_sector)
  ) || attrs,
  NOW() - ((7 + (rn % 45))::text || ' days')::interval,
  NOW() - ((1 + (rn % 72))::text || ' hours')::interval
FROM seed_rows
ON CONFLICT (slug) DO UPDATE
SET
  owner_id = EXCLUDED.owner_id,
  content_type = EXCLUDED.content_type,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  body = EXCLUDED.body,
  pricing_mode = EXCLUDED.pricing_mode,
  price_cents = EXCLUDED.price_cents,
  currency = EXCLUDED.currency,
  tags = EXCLUDED.tags,
  cover_image = EXCLUDED.cover_image,
  category = EXCLUDED.category,
  content_status = EXCLUDED.content_status,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

WITH store_seed(
  id, owner_user_id, name, slug, description, city, address, lat, lng, phone,
  segment, keywords, rating_label
) AS (
  VALUES
    ('50000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000516', 'Kedai Sore Cikini', 'kedai-sore-cikini', 'Kopi susu, pastry, dan snack ringan untuk meeting kecil.', 'Jakarta', 'Jl. Cikini Raya No. 18, Jakarta Pusat', -6.190830, 106.839180, '+6281200010101', 'coffee_shop', ARRAY['kopi', 'pastry', 'meeting', 'takeaway'], 'ramai sore'),
    ('50000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000518', 'Dapur Kawan Setiabudi', 'dapur-kawan-setiabudi', 'Rice bowl, lauk rumahan, dan paket katering harian.', 'Bandung', 'Jl. Setiabudi No. 88, Bandung', -6.859120, 107.595620, '+6281200010102', 'daily_catering', ARRAY['rice bowl', 'katering', 'rumahan', 'delivery'], 'repeat order tinggi'),
    ('50000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000517', 'Butik Selaras Gejayan', 'butik-selaras-gejayan', 'Fashion muslim, hijab, dan basic wear ready stock.', 'Yogyakarta', 'Jl. Gejayan No. 41, Yogyakarta', -7.769530, 110.389820, '+6281200010103', 'fashion_retail', ARRAY['fashion muslim', 'hijab', 'reseller', 'pickup'], 'koleksi mingguan'),
    ('50000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000511', 'Gudang Rasa Bekasi', 'gudang-rasa-bekasi', 'Snack grosir, bumbu tabur, dan paket reseller warung.', 'Bekasi', 'Jl. Ahmad Yani No. 22, Bekasi', -6.238270, 106.992420, '+6281200010104', 'snack_supplier', ARRAY['snack grosir', 'cemilan', 'reseller', 'warung'], 'stok cepat putar'),
    ('50000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000512', 'Kembang Kulit Print House', 'kembang-kulit-print-house', 'Stiker label, pouch, box hampers, dan mockup katalog.', 'Tangerang', 'Jl. BSD Raya Utama No. 9, Tangerang', -6.301750, 106.652210, '+6281200010105', 'packaging_print', ARRAY['kemasan', 'stiker', 'pouch', 'hampers'], 'print cepat'),
    ('50000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000513', 'Ruang Pendingin Bali', 'ruang-pendingin-bali', 'Sewa freezer display dan chiller showcase untuk tenant.', 'Denpasar', 'Jl. Teuku Umar No. 77, Denpasar', -8.680760, 115.206950, '+6281200010106', 'cold_equipment', ARRAY['freezer', 'chiller', 'frozen food', 'event'], 'alat siap kirim'),
    ('50000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000515', 'Panggung Live Surabaya', 'panggung-live-surabaya', 'Studio live selling, host, lighting, dan konten pendek.', 'Surabaya', 'Jl. Manyar Kertoarjo No. 32, Surabaya', -7.284910, 112.770210, '+6281200010107', 'live_commerce', ARRAY['live selling', 'host', 'konten', 'studio'], 'slot malam'),
    ('50000000-0000-0000-0000-000000000108', '00000000-0000-0000-0000-000000000514', 'Pasar Akhir Pekan Makassar', 'pasar-akhir-pekan-makassar', 'Operator booth pop-up dan tenant event komunitas.', 'Makassar', 'Jl. Penghibur No. 12, Makassar', -5.139020, 119.407730, '+6281200010108', 'event_booth', ARRAY['booth', 'event', 'tenant', 'bazaar'], 'traffic weekend'),
    ('50000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000518', 'Laundry Kilat Antapani', 'laundry-kilat-antapani', 'Laundry kiloan, satuan, dan pickup delivery area Antapani.', 'Bandung', 'Jl. Purwakarta No. 57, Bandung', -6.909420, 107.659310, '+6281200010109', 'laundry_service', ARRAY['laundry', 'pickup', 'delivery', 'kiloan'], 'proses 24 jam'),
    ('50000000-0000-0000-0000-000000000110', '00000000-0000-0000-0000-000000000517', 'Teras Craft Kotagede', 'teras-craft-kotagede', 'Craft perak, souvenir kecil, dan gift custom.', 'Yogyakarta', 'Jl. Kemasan No. 15, Yogyakarta', -7.827110, 110.399460, '+6281200010110', 'craft_gift', ARRAY['craft', 'souvenir', 'gift', 'custom'], 'produk handmade'),
    ('50000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000511', 'Frozen Mart Rawamangun', 'frozen-mart-rawamangun', 'Frozen food, dimsum, nugget, dan bahan baku rumah makan.', 'Jakarta', 'Jl. Balai Pustaka Timur No. 6, Jakarta Timur', -6.193180, 106.890640, '+6281200010111', 'frozen_mart', ARRAY['frozen food', 'dimsum', 'nugget', 'stok dingin'], 'stok harian'),
    ('50000000-0000-0000-0000-000000000112', '00000000-0000-0000-0000-000000000516', 'Roti Pagi Panakkukang', 'roti-pagi-panakkukang', 'Roti manis, roti sobek, dan paket snack box kantor.', 'Makassar', 'Jl. Boulevard Panakkukang No. 19, Makassar', -5.157910, 119.444420, '+6281200010112', 'bakery', ARRAY['roti', 'bakery', 'snack box', 'kantor'], 'fresh pagi')
)
INSERT INTO umkm_stores (
  id,
  owner_user_id,
  name,
  slug,
  description,
  city,
  address,
  lat,
  lng,
  phone,
  is_active,
  online_order_enabled,
  offline_order_enabled,
  metadata,
  created_at,
  updated_at
)
SELECT
  id::uuid,
  owner_user_id::uuid,
  name,
  slug,
  description,
  city,
  address,
  lat,
  lng,
  phone,
  TRUE,
  TRUE,
  TRUE,
  jsonb_build_object(
    'segment', segment,
    'recommended_qr', 'offline',
    'open_hours', '08:00-22:00',
    'keywords', keywords,
    'rating_label', rating_label,
    'source', 'marketplace_service_curated_search_seed_v1',
    'search_text', concat_ws(' ', name, slug, description, city, address, array_to_string(keywords, ' '), segment, rating_label)
  ),
  NOW() - INTERVAL '9 days',
  NOW() - INTERVAL '3 hours'
FROM store_seed
ON CONFLICT (slug) DO UPDATE
SET
  owner_user_id = EXCLUDED.owner_user_id,
  name = EXCLUDED.name,
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
