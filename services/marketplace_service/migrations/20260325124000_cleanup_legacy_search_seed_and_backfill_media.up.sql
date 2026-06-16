-- Archive noisy legacy search rows and enrich active marketplace listings
-- with deterministic Picsum galleries plus richer typed metadata.

UPDATE content_items
SET
  content_status = 'archived',
  updated_at = NOW()
WHERE content_status = 'active'
  AND (
    content_type = 'image'
    OR (
      content_type = 'user'
      AND COALESCE(metadata ->> 'public_path', '') = ''
      AND COALESCE(metadata ->> 'entity_kind', '') <> 'person'
    )
  );

WITH base AS (
  SELECT
    id,
    content_type,
    title,
    summary,
    body,
    COALESCE(metadata, '{}'::jsonb) AS meta,
    COALESCE(
      NULLIF(
        trim(
          both '-' FROM regexp_replace(
            lower(COALESCE(NULLIF(slug, ''), NULLIF(title, ''), id::text)),
            '[^a-z0-9]+',
            '-',
            'g'
          )
        ),
        ''
      ),
      replace(id::text, '-', '')
    ) AS seed_key,
    CASE
      WHEN content_type = 'property' THEN 'property'
      WHEN content_type = 'tool_rental' THEN 'tool_rental'
      WHEN content_type IN ('freelancer', 'talent', 'profile') THEN 'freelancer'
      WHEN content_type = 'job' THEN 'job'
      WHEN content_type = 'request' THEN 'request'
      WHEN content_type = 'service' THEN 'service'
      ELSE 'product'
    END AS normalized_type
  FROM content_items
  WHERE content_status = 'active'
    AND content_type IN (
      'product',
      'service',
      'job',
      'property',
      'tool_rental',
      'freelancer',
      'talent',
      'profile',
      'request'
    )
),
payload AS (
  SELECT
    id,
    normalized_type,
    jsonb_build_array(
      format('https://picsum.photos/seed/%s-cover/1280/960', seed_key),
      format('https://picsum.photos/seed/%s-gallery-1/1280/960', seed_key),
      format('https://picsum.photos/seed/%s-gallery-2/1280/960', seed_key)
    ) AS gallery,
    CASE
      WHEN normalized_type = 'product' THEN
        jsonb_build_object(
          'market_side', COALESCE(NULLIF(meta ->> 'market_side', ''), 'supply'),
          'brand', COALESCE(NULLIF(meta ->> 'brand', ''), 'Katalog usaha'),
          'condition', COALESCE(NULLIF(meta ->> 'condition', ''), 'ready_stock'),
          'stock', COALESCE(NULLIF(meta ->> 'stock', ''), 'siap restock mingguan'),
          'delivery_estimate', COALESCE(NULLIF(meta ->> 'delivery_estimate', ''), '1-3 hari kerja'),
          'minimum_order', COALESCE(NULLIF(meta ->> 'minimum_order', ''), NULLIF(meta ->> 'moq', ''), 'mulai 1 karton atau bundle campur'),
          'shipping_note', COALESCE(NULLIF(meta ->> 'shipping_note', ''), 'Pengiriman dijadwalkan per area agar restock usaha lebih stabil'),
          'catalog_focus', COALESCE(NULLIF(meta ->> 'catalog_focus', ''), 'stok cepat putar untuk usaha, reseller, dan repeat order'),
          'highlights', jsonb_build_array(
            'Galeri menampilkan contoh stok, kemasan, dan display yang relevan',
            'Cocok untuk repeat order, uji SKU baru, dan penambahan channel jual',
            'Harga di listing bisa dipakai sebagai acuan awal sebelum negosiasi volume'
          )
        )
      WHEN normalized_type = 'service' THEN
        jsonb_build_object(
          'market_side', COALESCE(NULLIF(meta ->> 'market_side', ''), 'supply'),
          'work_mode', COALESCE(NULLIF(meta ->> 'work_mode', ''), 'remote'),
          'availability', COALESCE(NULLIF(meta ->> 'availability', ''), 'slot mingguan tersedia'),
          'delivery_time', COALESCE(NULLIF(meta ->> 'delivery_time', ''), '3-5 hari kerja'),
          'next_available', COALESCE(NULLIF(meta ->> 'next_available', ''), to_char(CURRENT_DATE + 2, 'YYYY-MM-DD')),
          'service_scope', 'Scope mencakup briefing, eksekusi inti, revisi seperlunya, dan handoff yang siap dipakai buyer.',
          'deliverables', 'Buyer menerima output kerja utama, ringkasan tindak lanjut, serta file akhir atau checklist eksekusi.',
          'client_requirements', 'Siapkan brief, referensi, target audience, dan akses dasar yang memang diperlukan untuk eksekusi.',
          'highlights', jsonb_build_array(
            'Visual di galeri memperlihatkan contoh output, style, dan konteks penggunaan layanan',
            'Cocok untuk owner yang butuh support operasional tanpa membangun tim penuh',
            'Scope dan hasil kerja sudah diposisikan agar mudah dipakai saat negosiasi awal'
          )
        )
      WHEN normalized_type = 'job' THEN
        jsonb_build_object(
          'market_side', COALESCE(NULLIF(meta ->> 'market_side', ''), 'demand'),
          'company_name', COALESCE(NULLIF(meta ->> 'company_name', ''), 'Usaha lokal yang sedang ekspansi'),
          'employment_type', COALESCE(NULLIF(meta ->> 'employment_type', ''), 'contract'),
          'level', COALESCE(NULLIF(meta ->> 'level', ''), 'mid'),
          'work_mode', COALESCE(NULLIF(meta ->> 'work_mode', ''), 'onsite'),
          'salary_range', COALESCE(NULLIF(meta ->> 'salary_range', ''), 'kompensasi mengikuti ritme operasional dan pengalaman'),
          'openings', COALESCE(NULLIF(meta ->> 'openings', ''), '1'),
          'start_date', COALESCE(NULLIF(meta ->> 'start_date', ''), to_char(CURRENT_DATE + 7, 'YYYY-MM-DD')),
          'application_deadline', COALESCE(NULLIF(meta ->> 'application_deadline', ''), to_char(CURRENT_DATE + 21, 'YYYY-MM-DD')),
          'must_have_skills', 'Komunikasi cepat, follow up rapi, dan nyaman bekerja dengan dashboard atau SOP dasar.',
          'responsibilities', 'Menjaga ritme operasional harian, update status pekerjaan, dan koordinasi lintas fungsi seperlunya.',
          'requirements', 'Pengalaman relevan, disiplin pada jadwal, serta mampu mengikuti target kerja yang jelas.',
          'highlights', jsonb_build_array(
            'Galeri memberi konteks area kerja, tools, dan ritme peran yang ditawarkan',
            'Role disusun agar kandidat cepat memahami ekspektasi, level, dan pola kerja',
            'Cocok untuk bisnis yang sedang menambah kapasitas operasional atau penjualan'
          )
        )
      WHEN normalized_type = 'property' THEN
        jsonb_build_object(
          'market_side', COALESCE(NULLIF(meta ->> 'market_side', ''), 'supply'),
          'property_type', COALESCE(
            NULLIF(meta ->> 'property_type', ''),
            CASE
              WHEN lower(title) LIKE '%booth%' THEN 'booth'
              WHEN lower(title) LIKE '%kios%' THEN 'kios'
              WHEN lower(title) LIKE '%ruko%' THEN 'ruko'
              WHEN lower(title) LIKE '%food court%' THEN 'food_court_space'
              WHEN lower(title) LIKE '%restoran%' THEN 'restaurant_space'
              ELSE 'commercial_space'
            END
          ),
          'area_sqm', COALESCE(
            NULLIF(meta ->> 'area_sqm', ''),
            CASE
              WHEN lower(title) LIKE '%booth%' THEN '9'
              WHEN lower(title) LIKE '%kios%' THEN '18'
              WHEN lower(title) LIKE '%food court%' THEN '12'
              ELSE '24'
            END
          ),
          'available_from', COALESCE(NULLIF(meta ->> 'available_from', ''), to_char(CURRENT_DATE + 3, 'YYYY-MM-DD')),
          'lease_term', COALESCE(NULLIF(meta ->> 'lease_term', ''), NULLIF(meta ->> 'rental_period', ''), 'mingguan atau bulanan'),
          'address', COALESCE(NULLIF(meta ->> 'address', ''), COALESCE(NULLIF(meta ->> 'location', ''), 'Area usaha strategis')),
          'usage_restrictions', COALESCE(NULLIF(meta ->> 'usage_restrictions', ''), 'Aktivitas mengikuti jam operasional, aturan tenant, dan standar kebersihan lokasi'),
          'legal_docs', COALESCE(NULLIF(meta ->> 'legal_docs', ''), 'Dokumen kerja sama dan aturan tenant tersedia pada tahap negosiasi lanjut'),
          'highlights', jsonb_build_array(
            'Galeri memperlihatkan fasad, area jual, dan sirkulasi pengunjung yang relevan',
            'Cocok untuk tenant pop-up, outlet kecil, atau ekspansi titik jual cepat',
            'Detail area, durasi sewa, dan catatan akses dibuat supaya screening lokasi lebih cepat'
          )
        )
      WHEN normalized_type = 'tool_rental' THEN
        jsonb_build_object(
          'market_side', COALESCE(NULLIF(meta ->> 'market_side', ''), 'supply'),
          'brand', COALESCE(NULLIF(meta ->> 'brand', ''), 'Rental equipment'),
          'model_name', COALESCE(NULLIF(meta ->> 'model_name', ''), 'Unit siap pakai'),
          'condition', COALESCE(NULLIF(meta ->> 'condition', ''), 'well_maintained'),
          'deposit_amount_cents', COALESCE(NULLIF(meta ->> 'deposit_amount_cents', ''), '1500000'),
          'minimum_rental_days', COALESCE(NULLIF(meta ->> 'minimum_rental_days', ''), '1'),
          'pickup_location', COALESCE(NULLIF(meta ->> 'pickup_location', ''), COALESCE(NULLIF(meta ->> 'location', ''), 'Area operasional utama')),
          'availability_status', COALESCE(NULLIF(meta ->> 'availability_status', ''), 'ready'),
          'complaint_window_hours', COALESCE(NULLIF(meta ->> 'complaint_window_hours', ''), '24'),
          'identity_requirements', COALESCE(NULLIF(meta ->> 'identity_requirements', ''), 'KTP, nomor aktif, dan kontak PIC usaha saat serah terima'),
          'usage_restrictions', COALESCE(NULLIF(meta ->> 'usage_restrictions', ''), 'Unit dipakai sesuai SOP, area operasi, dan jadwal return yang disepakati'),
          'highlights', jsonb_build_array(
            'Galeri menunjukkan unit, aksesoris utama, dan konteks pemakaian alat',
            'Cocok untuk event, tenant musiman, atau kebutuhan operasional jangka pendek',
            'Deposit, durasi minimum, dan area pickup dibuat eksplisit sejak awal'
          )
        )
      WHEN normalized_type = 'freelancer' THEN
        jsonb_build_object(
          'entity_kind', 'person',
          'market_side', COALESCE(NULLIF(meta ->> 'market_side', ''), 'supply'),
          'professional_title', COALESCE(NULLIF(meta ->> 'professional_title', ''), NULLIF(meta ->> 'profession', ''), 'Freelancer operasional'),
          'skills', 'live commerce, follow up buyer, katalog, koordinasi harian, dan eksekusi campaign ringan',
          'availability', COALESCE(NULLIF(meta ->> 'availability', ''), 'tersedia mulai minggu ini'),
          'response_sla', COALESCE(NULLIF(meta ->> 'response_sla', ''), 'balas awal kurang dari 2 jam saat jam kerja'),
          'delivery_time', COALESCE(NULLIF(meta ->> 'delivery_time', ''), 'mulai 1-2 hari setelah briefing'),
          'highlights', jsonb_build_array(
            'Galeri menampilkan profil kerja, sample output, dan konteks industri yang pernah ditangani',
            'Cocok untuk owner yang perlu eksekutor cepat tanpa proses hiring penuh',
            'Scope talent dibuat cukup jelas untuk chat awal, test task, atau trial campaign'
          )
        )
      ELSE
        jsonb_build_object(
          'market_side', COALESCE(NULLIF(meta ->> 'market_side', ''), 'demand'),
          'delivery_time', COALESCE(NULLIF(meta ->> 'delivery_time', ''), 'sesuai brief kebutuhan'),
          'requirements', 'Tulis kebutuhan inti, volume, target area, dan batas waktu respon agar supplier atau partner bisa menawar dengan tepat.',
          'highlights', jsonb_build_array(
            'Galeri dipakai untuk memperjelas konteks kebutuhan, referensi, dan target hasil',
            'Brief sudah disiapkan agar penjual atau partner bisa respon lebih cepat',
            'Cocok untuk sourcing, request penawaran, atau validasi partner baru'
          )
        )
    END AS type_metadata,
    CASE
      WHEN normalized_type = 'product' THEN
        'Listing ini sudah dilengkapi galeri visual dan konteks operasional supaya buyer bisa menilai kecocokan stok, kemasan, dan ritme restock lebih cepat.'
      WHEN normalized_type = 'service' THEN
        'Konten diposisikan agar owner cepat memahami scope, output, dan data apa saja yang perlu disiapkan sebelum kerja dimulai.'
      WHEN normalized_type = 'job' THEN
        'Deskripsi ini ditambah konteks ritme kerja, ekspektasi hasil, dan sinyal kesiapan tim supaya kandidat tidak menebak-nebak brief utama.'
      WHEN normalized_type = 'property' THEN
        'Visual dan spesifikasi area dibuat lebih utuh agar screening lokasi bisa dilakukan sebelum survei atau negosiasi lapangan.'
      WHEN normalized_type = 'tool_rental' THEN
        'Informasi unit, durasi minimum, dan proses serah terima dirapikan supaya kebutuhan sewa tidak berhenti di chat awal saja.'
      WHEN normalized_type = 'freelancer' THEN
        'Profil kerja diperjelas lewat galeri, fokus skill, dan pola availability agar owner bisa lebih cepat memutuskan lanjut briefing atau trial.'
      ELSE
        'Brief ini diberi konteks tambahan, galeri referensi, dan metadata inti agar penawaran yang masuk lebih relevan dengan tujuan listing.'
    END AS body_appendix
  FROM base
)
UPDATE content_items AS content
SET
  cover_image = payload.gallery ->> 0,
  body = CASE
    WHEN length(trim(COALESCE(content.body, ''))) >= 140 THEN content.body
    ELSE concat_ws(E'\n\n', NULLIF(trim(COALESCE(content.body, '')), ''), payload.body_appendix)
  END,
  metadata = jsonb_strip_nulls(
    COALESCE(content.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'cover_image', payload.gallery ->> 0,
      'image_urls', payload.gallery,
      'images', payload.gallery,
      'gallery_images', payload.gallery,
      'detail_images', payload.gallery,
      'media_gallery', payload.gallery
    )
    || CASE
      WHEN payload.normalized_type = 'freelancer'
        THEN jsonb_build_object('portfolio_images', payload.gallery)
      WHEN payload.normalized_type = 'property'
        THEN jsonb_build_object('property_images', payload.gallery)
      ELSE jsonb_build_object('listing_images', payload.gallery)
    END
    || payload.type_metadata
  ),
  updated_at = NOW()
FROM payload
WHERE content.id = payload.id;
