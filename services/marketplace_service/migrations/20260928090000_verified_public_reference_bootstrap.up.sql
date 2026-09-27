-- Deterministic fallback reference pack for fresh/local environments.
-- These are real public places documented by public/CC-licensed sources.
-- They are unowned, non-transactional references; the live importers remain the
-- primary mechanism for larger/fresher datasets.

WITH places (
  slug, title, summary, body, city, address, lat, lng,
  source_title, source_url, source_license,
  media_title, media_source_url, media_author, media_license_url, media_license_name
) AS (
  VALUES
  (
    'pasar-beringharjo-yogyakarta-reference',
    'Pasar Beringharjo Yogyakarta',
    'Referensi pasar publik nyata di Yogyakarta.',
    'Pasar Beringharjo adalah pasar nyata di Yogyakarta. Data ini hanya referensi lokasi publik; tidak menyatakan kepemilikan kios, harga, stok, atau kontak penjual tertentu.',
    'Yogyakarta',
    'Jl. Marga Mulya No.16, Yogyakarta',
    -7.798925, 110.365616,
    'Cagar Budaya - Pasar Beringharjo',
    'https://budaya.data.kemdikbud.go.id/cagarbudaya/objek/KB001567',
    'Public cultural heritage data',
    'Jalan-jalan ke Pasar Beringharjo-12.jpg',
    'https://commons.wikimedia.org/wiki/File:Jalan-jalan_ke_Pasar_Beringharjo-12.jpg',
    'Indonesiagood',
    'https://creativecommons.org/licenses/by/3.0/',
    'CC BY 3.0'
  ),
  (
    'pasar-tanah-abang-jakarta-reference',
    'Pasar Tanah Abang Jakarta',
    'Referensi kawasan pasar tekstil publik di Jakarta Pusat.',
    'Tanah Abang adalah kawasan perdagangan nyata di Jakarta Pusat. Data ini merupakan referensi lokasi publik, bukan listing toko individual dan bukan klaim ketersediaan kios.',
    'Jakarta Pusat',
    'Tanah Abang, Jakarta Pusat',
    -6.2028, 106.8196,
    'Wikimedia Commons Category: Tanah Abang',
    'https://commons.wikimedia.org/wiki/Category:Tanah_Abang',
    'Free Wikimedia text/media subject page',
    'Flood Canal Bisecting Pasar Tanah Abang.jpg',
    'https://commons.wikimedia.org/wiki/File:Flood_Canal_Bisecting_Pasar_Tanah_Abang.jpg',
    'christian r',
    'https://creativecommons.org/licenses/by-sa/2.0/',
    'CC BY-SA 2.0'
  ),
  (
    'pasar-klewer-surakarta-reference',
    'Pasar Klewer Surakarta',
    'Referensi pasar tekstil dan batik publik di Surakarta.',
    'Pasar Klewer adalah pasar nyata di Surakarta. Data ini membantu discovery lokasi dan sentra perdagangan tanpa mengarang kontak, harga, atau status tenant.',
    'Surakarta',
    'Pasar Klewer, Surakarta, Jawa Tengah',
    -7.57547, 110.82653,
    'Indonesia Travel - Pasar Klewer',
    'https://www.indonesia.travel/id/id/destination/java/central-java/klewer-market',
    'Public tourism reference',
    'Pasar Klewer.jpg',
    'https://commons.wikimedia.org/wiki/File:Pasar_Klewer.jpg',
    'CoolFrame Photography / WikiSanktGerard',
    'https://commons.wikimedia.org/wiki/File:Pasar_Klewer.jpg',
    'Public domain'
  ),
  (
    'kampung-batik-laweyan-surakarta-reference',
    'Kampung Batik Laweyan',
    'Referensi sentra batik dan usaha kreatif di Surakarta.',
    'Laweyan adalah kawasan nyata di Surakarta yang dikenal sebagai sentra batik. Data ini hanya konteks lokasi dan ekosistem usaha, bukan klaim tenant aktif atau harga.',
    'Surakarta',
    'Laweyan, Surakarta, Jawa Tengah',
    -7.56083, 110.79306,
    'Kampoeng Batik Laweyan',
    'https://kampoengbatiklaweyan.org/',
    'Public website reference',
    'Becak Kampung Batik Laweyan.jpg',
    'https://commons.wikimedia.org/wiki/File:Becak_Kampung_Batik_Laweyan.jpg',
    'Herusutimbul',
    'https://creativecommons.org/licenses/by-sa/4.0/',
    'CC BY-SA 4.0'
  ),
  (
    'pasar-terapung-lok-baintan-reference',
    'Pasar Terapung Lok Baintan',
    'Referensi pasar terapung publik di Kabupaten Banjar.',
    'Pasar Terapung Lok Baintan adalah pasar budaya dan perdagangan sungai yang nyata. Referensi ini tidak mewakili pedagang individual, harga, stok, atau kontak privat.',
    'Banjar',
    'Sungai Pinang, Kabupaten Banjar, Kalimantan Selatan',
    -3.296355, 114.691953,
    'Wikimedia Commons Category: Lok Baintan Floating Market',
    'https://commons.wikimedia.org/wiki/Category:Lok_Baintan_Floating_Market',
    'Free Wikimedia text/media subject page',
    'Lokbaintan.jpg',
    'https://commons.wikimedia.org/wiki/File:Lokbaintan.jpg',
    'Rifki Muslim',
    'https://creativecommons.org/licenses/by-sa/4.0/',
    'CC BY-SA 4.0'
  ),
  (
    'pasar-beringharjo-yogyakarta-reference-2',
    'Pasar Beringharjo — referensi perdagangan tradisional',
    'Referensi tambahan untuk discovery pasar tradisional Yogyakarta.',
    'Entri referensi publik tambahan untuk membantu map/discovery. Tidak mengandung kepemilikan atau transaksi.',
    'Yogyakarta',
    'Jl. Marga Mulya No.16, Yogyakarta',
    -7.798925, 110.365616,
    'Cagar Budaya - Pasar Beringharjo',
    'https://budaya.data.kemdikbud.go.id/cagarbudaya/objek/KB001567',
    'Public cultural heritage data',
    'Jalan-jalan ke Pasar Beringharjo-12.jpg',
    'https://commons.wikimedia.org/wiki/File:Jalan-jalan_ke_Pasar_Beringharjo-12.jpg',
    'Indonesiagood',
    'https://creativecommons.org/licenses/by/3.0/',
    'CC BY 3.0'
  )
)
INSERT INTO content_items (
  owner_id, content_type, slug, title, summary, body,
  pricing_mode, currency, tags, category, content_status,
  metadata, listing_status, listing_intent, current_step,
  completion_percentage, last_saved_at, published_at
)
SELECT
  NULL,
  'profile',
  slug,
  title,
  summary,
  body,
  'fixed',
  'IDR',
  ARRAY['reference','public-data','business-places']::text[],
  'umkm_reference',
  'active',
  jsonb_strip_nulls(jsonb_build_object(
    'record_kind', 'external_content_reference',
    'reference_subtype', 'place_reference',
    'market_side', 'reference',
    'listing_side', 'reference',
    'is_transactional', false,
    'reference_publication_status', 'published',
    'claimable', false,
    'source_dataset', 'verified_public_place_bootstrap',
    'source_title', source_title,
    'source_url', source_url,
    'source_license', source_license,
    'city', city,
    'address', address,
    'latitude', lat,
    'longitude', lng,
    'marketplace_category_slug', 'business-places',
    'image_url', 'https://commons.wikimedia.org/wiki/Special:FilePath/' || replace(media_title, ' ', '_') || '?width=1200',
    'image_attribution', jsonb_build_object(
      'provider', 'Wikimedia Commons',
      'title', media_title,
      'source_url', media_source_url,
      'author', media_author,
      'license_url', media_license_url,
      'license_name', media_license_name
    ),
    'trust_note', 'Real public place reference; unowned and non-transactional.'
  )),
  'published',
  'offer',
  1,
  100,
  NOW(),
  NOW()
FROM places
ON CONFLICT (slug) DO UPDATE SET
  owner_id = NULL,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  body = EXCLUDED.body,
  cover_image = EXCLUDED.cover_image,
  category = EXCLUDED.category,
  content_status = 'active',
  metadata = EXCLUDED.metadata,
  listing_status = 'published',
  updated_at = NOW();
