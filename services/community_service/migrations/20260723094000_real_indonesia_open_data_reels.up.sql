SET search_path = forum, reel, public, events;

DELETE FROM reel.lajukan_reels
WHERE metadata->>'seed_pack' = 'real_indonesia_open_data_20260723';

DELETE FROM forum.lajukan_forum_posts
WHERE id IN (
  'real-post-pasar-beringharjo-yogyakarta',
  'real-post-kopi-tasikmalaya-supplier-bahan',
  'real-post-batik-pekalongan-produk-lokal',
  'real-post-laweyan-kawasan-usaha-kreatif',
  'real-post-lok-baintan-pasar-sungai'
);

DELETE FROM forum.lajukan_forum_thread_tags
WHERE thread_id IN (
  'real-th-pasar-beringharjo-yogyakarta',
  'real-th-kopi-tasikmalaya-supplier-bahan',
  'real-th-batik-pekalongan-produk-lokal',
  'real-th-laweyan-kawasan-usaha-kreatif',
  'real-th-lok-baintan-pasar-sungai'
);

DELETE FROM forum.lajukan_forum_threads
WHERE id IN (
  'real-th-pasar-beringharjo-yogyakarta',
  'real-th-kopi-tasikmalaya-supplier-bahan',
  'real-th-batik-pekalongan-produk-lokal',
  'real-th-laweyan-kawasan-usaha-kreatif',
  'real-th-lok-baintan-pasar-sungai'
);

UPDATE reel.lajukan_reels
SET status = 'archived',
    metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'archived_by_seed_pack', 'real_indonesia_open_data_20260723',
        'archived_reason', 'Fictional demo reels hidden so real open-media Indonesia references become the primary seed surface.'
      ),
    updated_at = NOW()
WHERE metadata->>'seed_pack' = 'indonesia_demo_20260709'
  AND status = 'published';

UPDATE forum.lajukan_groups
SET status = 'archived',
    cover_url = NULL,
    updated_at = NOW()
WHERE id LIKE 'demo-g-%'
   OR category_id LIKE 'demo-c-%';

UPDATE forum.lajukan_forum_posts
SET image_urls = ARRAY[]::text[],
    updated_at = NOW()
WHERE thread_id IN (
  SELECT id
  FROM forum.lajukan_forum_threads
  WHERE id LIKE 'demo-th-%'
     OR category_id LIKE 'demo-c-%'
);

UPDATE forum.lajukan_forum_threads
SET status = 'archived',
    image_urls = ARRAY[]::text[],
    last_activity_at = NOW(),
    is_locked = TRUE
WHERE id LIKE 'demo-th-%'
   OR category_id LIKE 'demo-c-%';

INSERT INTO forum.lajukan_forum_users (
    id,
    username,
    name,
    avatar_url,
    title,
    reputation,
    base_reputation,
    badges,
    metadata,
    created_at,
    updated_at
  )
VALUES (
    '00000000-0000-0000-0000-000000000801',
    'lajukan_open_data',
    'Lajukan Open Data',
    '',
    'Kurator data publik',
    0,
    0,
    ARRAY['open-data'],
    jsonb_build_object(
      'seed_pack', 'real_indonesia_open_data_20260723',
      'account_type', 'system_seed_curator',
      'contact_policy', 'no_private_contact_seeded'
    ),
    NOW() - INTERVAL '1 day',
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET username = EXCLUDED.username,
    name = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url,
    title = EXCLUDED.title,
    reputation = EXCLUDED.reputation,
    base_reputation = EXCLUDED.base_reputation,
    badges = EXCLUDED.badges,
    metadata = COALESCE(lajukan_forum_users.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = NOW();

INSERT INTO forum.lajukan_forum_categories (
    id,
    name,
    slug,
    description,
    icon,
    color,
    position,
    thread_count,
    post_count,
    created_at,
    updated_at
  )
VALUES
  (
    'real-c-komunitas-usaha-data-publik',
    'Komunitas Usaha & Data Publik',
    'komunitas-usaha-data-publik',
    'Rujukan komunitas usaha untuk membaca data publik Indonesia sebelum mengambil keputusan bisnis.',
    'community',
    '#2563eb',
    110,
    0,
    0,
    NOW() - INTERVAL '1 day',
    NOW()
  ),
  (
    'real-c-komunitas-usaha-supplier-lokal',
    'Komunitas Usaha Supplier Lokal',
    'komunitas-usaha-supplier-lokal',
    'Rujukan komunitas usaha untuk bahan, pemasok, asal produk, dan data komoditas Indonesia.',
    'package',
    '#059669',
    120,
    0,
    0,
    NOW() - INTERVAL '1 day',
    NOW()
  ),
  (
    'real-c-komunitas-usaha-mesin-alat',
    'Komunitas Usaha Mesin & Alat',
    'komunitas-usaha-mesin-alat',
    'Rujukan komunitas usaha untuk mesin produksi, peralatan IKM, dan pengadaan alat.',
    'tools',
    '#7c3aed',
    130,
    0,
    0,
    NOW() - INTERVAL '1 day',
    NOW()
  ),
  (
    'real-c-komunitas-usaha-tempat',
    'Komunitas Usaha Tempat & Pasar',
    'komunitas-usaha-tempat-pasar',
    'Rujukan komunitas usaha untuk pasar, lokasi usaha, sentra produksi, dan tempat publik Indonesia.',
    'map-pin',
    '#2563eb',
    140,
    0,
    0,
    NOW() - INTERVAL '1 day',
    NOW()
  ),
  (
    'real-c-komunitas-usaha-peluang-kemitraan',
    'Komunitas Usaha Peluang & Kemitraan',
    'komunitas-usaha-peluang-kemitraan',
    'Rujukan komunitas usaha untuk peluang, reseller, kemitraan, dan pasar pengadaan yang perlu diverifikasi.',
    'handshake',
    '#d97706',
    150,
    0,
    0,
    NOW() - INTERVAL '1 day',
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    position = EXCLUDED.position,
    updated_at = NOW();

INSERT INTO forum.lajukan_groups (
    id,
    category_id,
    name,
    slug,
    description,
    privacy,
    posting_permission,
    membership_permission,
    cover_url,
    rules,
    created_by_user_id,
    status,
    created_at,
    updated_at
  )
VALUES
  (
    'real-g-komunitas-usaha-data-indonesia',
    'real-c-komunitas-usaha-data-publik',
    'Komunitas Usaha: Data Publik Indonesia',
    'komunitas-usaha-data-publik-indonesia',
    'Grup rujukan komunitas usaha untuk membaca data BPS, OSS/BKPM, LKPP, dan sumber publik Indonesia sebelum menentukan pasar, lokasi, atau supplier.',
    'public',
    'public',
    'open',
    NULL,
    ARRAY[
      'Ini grup rujukan publik, bukan klaim komunitas eksternal resmi.',
      'Cantumkan sumber saat berbagi data usaha.',
      'Verifikasi angka, syarat, dan jadwal di situs resmi seperti BPS, OSS/BKPM, LKPP, atau SMESCO.'
    ],
    '00000000-0000-0000-0000-000000000801',
    'active',
    NOW() - INTERVAL '1 day',
    NOW()
  ),
  (
    'real-g-komunitas-usaha-supplier-bahan-lokal',
    'real-c-komunitas-usaha-supplier-lokal',
    'Komunitas Usaha: Supplier & Bahan Lokal',
    'komunitas-usaha-supplier-bahan-lokal',
    'Grup rujukan komunitas usaha untuk bahan baku, Indikasi Geografis DJKI, publikasi BPS IMK, dan asal produk Indonesia.',
    'public',
    'public',
    'open',
    NULL,
    ARRAY[
      'Bedakan rujukan komoditas dari supplier individual.',
      'Jangan menulis nomor kontak pribadi tanpa izin.',
      'Gunakan sumber resmi seperti DJKI, BPS, atau pemerintah daerah saat menyebut asal produk.'
    ],
    '00000000-0000-0000-0000-000000000801',
    'active',
    NOW() - INTERVAL '1 day',
    NOW()
  ),
  (
    'real-g-komunitas-usaha-mesin-alat-ikm',
    'real-c-komunitas-usaha-mesin-alat',
    'Komunitas Usaha: Mesin, Alat, dan IKM',
    'komunitas-usaha-mesin-alat-ikm',
    'Grup rujukan komunitas usaha untuk mesin produksi, peralatan IKM, program Kemenperin, dan rencana pengadaan alat yang perlu dibaca hati-hati.',
    'public',
    'public',
    'open',
    NULL,
    ARRAY[
      'Sebutkan kapasitas, listrik, material, dan keamanan alat bila berdiskusi teknis.',
      'Rujukan pemerintah tidak berarti stok atau vendor tersedia di Lajukan.',
      'Cek sumber resmi Kemenperin atau LKPP sebelum mengambil keputusan.'
    ],
    '00000000-0000-0000-0000-000000000801',
    'active',
    NOW() - INTERVAL '1 day',
    NOW()
  ),
  (
    'real-g-komunitas-usaha-tempat-pasar',
    'real-c-komunitas-usaha-tempat',
    'Komunitas Usaha: Tempat, Pasar, dan Sentra',
    'komunitas-usaha-tempat-pasar-sentra',
    'Grup rujukan komunitas usaha untuk membaca lokasi pasar nyata, sentra usaha, dan peluang tempat usaha tanpa klaim kontak privat.',
    'public',
    'public',
    'open',
    NULL,
    ARRAY[
      'Bedakan rujukan tempat publik dari penawaran sewa atau jual tempat.',
      'Jangan menulis nomor kontak pribadi tanpa izin.',
      'Cantumkan sumber dan jangan mengklaim jam buka, harga, atau ketersediaan tanpa data resmi.'
    ],
    '00000000-0000-0000-0000-000000000801',
    'active',
    NOW() - INTERVAL '1 day',
    NOW()
  ),
  (
    'real-g-komunitas-usaha-peluang-kemitraan',
    'real-c-komunitas-usaha-peluang-kemitraan',
    'Komunitas Usaha: Peluang, Reseller, dan Kemitraan',
    'komunitas-usaha-peluang-reseller-kemitraan',
    'Grup rujukan komunitas usaha untuk membaca peluang reseller, kemitraan, e-Katalog, OSS/KBLI, dan business matching SMESCO tanpa janji keuntungan.',
    'public',
    'public',
    'open',
    NULL,
    ARRAY[
      'Tidak menjanjikan keuntungan pasti.',
      'Tulis modal, risiko, legalitas, dan sumber informasi secara jelas.',
      'Verifikasi peluang di OSS/KBLI, LKPP, atau sumber resmi penyelenggara program.'
    ],
    '00000000-0000-0000-0000-000000000801',
    'active',
    NOW() - INTERVAL '1 day',
    NOW()
  )
ON CONFLICT (category_id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    privacy = EXCLUDED.privacy,
    posting_permission = EXCLUDED.posting_permission,
    membership_permission = EXCLUDED.membership_permission,
    cover_url = EXCLUDED.cover_url,
    rules = EXCLUDED.rules,
    created_by_user_id = EXCLUDED.created_by_user_id,
    status = EXCLUDED.status,
    updated_at = NOW();

INSERT INTO forum.lajukan_group_members (
    group_id,
    user_id,
    role,
    status,
    notifications_enabled,
    joined_at,
    updated_at
  )
SELECT g.id,
       '00000000-0000-0000-0000-000000000801',
       'owner',
       'active',
       true,
       NOW() - INTERVAL '1 day',
       NOW()
FROM forum.lajukan_groups g
WHERE g.id IN (
  'real-g-komunitas-usaha-data-indonesia',
  'real-g-komunitas-usaha-supplier-bahan-lokal',
  'real-g-komunitas-usaha-mesin-alat-ikm',
  'real-g-komunitas-usaha-tempat-pasar',
  'real-g-komunitas-usaha-peluang-kemitraan'
)
ON CONFLICT (group_id, user_id) DO UPDATE
SET role = EXCLUDED.role,
    status = EXCLUDED.status,
    notifications_enabled = EXCLUDED.notifications_enabled,
    updated_at = NOW();

INSERT INTO forum.lajukan_forum_tags (
    id,
    name,
    slug,
    description,
    color,
    usage_count
  )
VALUES
  (
    'real-tag-pasar-tradisional',
    'Pasar Tradisional',
    'pasar-tradisional',
    'Diskusi berbasis rujukan publik tentang pasar tradisional dan aktivitas usaha lokal.',
    '#f59e0b',
    0
  ),
  (
    'real-tag-bahan-usaha',
    'Bahan Usaha',
    'bahan-usaha',
    'Diskusi bahan, komoditas, dan asal produk berbasis sumber publik.',
    '#059669',
    0
  ),
  (
    'real-tag-produk-lokal',
    'Produk Lokal',
    'produk-lokal',
    'Diskusi produk lokal Indonesia, identitas daerah, dan peluang pengembangan pasar.',
    '#e11d48',
    0
  ),
  (
    'real-tag-kawasan-usaha',
    'Kawasan Usaha',
    'kawasan-usaha',
    'Diskusi kawasan, sentra, dan tempat usaha berbasis rujukan publik.',
    '#ea580c',
    0
  )
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    color = EXCLUDED.color;

INSERT INTO forum.lajukan_forum_threads (
    id,
    title,
    slug,
    category_id,
    group_id,
    author_id,
    created_at,
    last_activity_at,
    views,
    reply_count,
    like_count,
    bookmark_count,
    is_pinned,
    is_locked,
    is_solved,
    status,
    image_urls
  )
VALUES
  (
    'real-th-pasar-beringharjo-yogyakarta',
    'Membaca Pasar Beringharjo sebagai konteks tempat usaha Yogyakarta',
    'membaca-pasar-beringharjo-konteks-tempat-usaha-yogyakarta',
    'real-c-komunitas-usaha-tempat',
    'real-g-komunitas-usaha-tempat-pasar',
    '00000000-0000-0000-0000-000000000801',
    NOW() - INTERVAL '6 hours',
    NOW() - INTERVAL '6 hours',
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    'open',
    ARRAY['https://commons.wikimedia.org/wiki/Special:FilePath/Jalan-jalan_ke_Pasar_Beringharjo-12.jpg']
  ),
  (
    'real-th-kopi-tasikmalaya-supplier-bahan',
    'Kopi Tasikmalaya sebagai referensi bahan usaha, bukan klaim stok supplier',
    'kopi-tasikmalaya-referensi-bahan-usaha-bukan-klaim-stok',
    'real-c-komunitas-usaha-supplier-lokal',
    'real-g-komunitas-usaha-supplier-bahan-lokal',
    '00000000-0000-0000-0000-000000000801',
    NOW() - INTERVAL '5 hours',
    NOW() - INTERVAL '5 hours',
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    'open',
    ARRAY['https://commons.wikimedia.org/wiki/Special:FilePath/Coffee_beans_from_Tasikmalaya_in_a_glass_container_20170518.jpg']
  ),
  (
    'real-th-batik-pekalongan-produk-lokal',
    'Batik Pekalongan sebagai contoh produk lokal yang perlu sumber jelas',
    'batik-pekalongan-contoh-produk-lokal-sumber-jelas',
    'real-c-komunitas-usaha-supplier-lokal',
    'real-g-komunitas-usaha-supplier-bahan-lokal',
    '00000000-0000-0000-0000-000000000801',
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '4 hours',
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    'open',
    ARRAY['https://commons.wikimedia.org/wiki/Special:FilePath/Batik_Khas_Pekalongan.jpg']
  ),
  (
    'real-th-laweyan-kawasan-usaha-kreatif',
    'Kampung Batik Laweyan sebagai rujukan kawasan usaha kreatif',
    'kampung-batik-laweyan-rujukan-kawasan-usaha-kreatif',
    'real-c-komunitas-usaha-tempat',
    'real-g-komunitas-usaha-tempat-pasar',
    '00000000-0000-0000-0000-000000000801',
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '3 hours',
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    'open',
    ARRAY['https://commons.wikimedia.org/wiki/Special:FilePath/Becak_Kampung_Batik_Laweyan.jpg']
  ),
  (
    'real-th-lok-baintan-pasar-sungai',
    'Lok Baintan sebagai pasar sungai nyata, bukan listing pedagang individual',
    'lok-baintan-pasar-sungai-bukan-listing-pedagang-individual',
    'real-c-komunitas-usaha-tempat',
    'real-g-komunitas-usaha-tempat-pasar',
    '00000000-0000-0000-0000-000000000801',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours',
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    'open',
    ARRAY['https://commons.wikimedia.org/wiki/Special:FilePath/Lokbaintan.jpg']
  )
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    slug = EXCLUDED.slug,
    category_id = EXCLUDED.category_id,
    group_id = EXCLUDED.group_id,
    author_id = EXCLUDED.author_id,
    last_activity_at = EXCLUDED.last_activity_at,
    is_locked = EXCLUDED.is_locked,
    status = EXCLUDED.status,
    image_urls = EXCLUDED.image_urls;

INSERT INTO forum.lajukan_forum_posts (
    id,
    thread_id,
    author_id,
    content,
    created_at,
    updated_at,
    like_count,
    reply_to_post_id,
    is_answer,
    reactions,
    image_urls
  )
VALUES
  (
    'real-post-pasar-beringharjo-yogyakarta',
    'real-th-pasar-beringharjo-yogyakarta',
    '00000000-0000-0000-0000-000000000801',
    'Rujukan visual Pasar Beringharjo ini dipakai untuk membantu diskusi lokasi pasar dan pola tempat usaha di Yogyakarta. Sumber: https://commons.wikimedia.org/wiki/File:Jalan-jalan_ke_Pasar_Beringharjo-12.jpg. Lisensi: CC BY 3.0. Catatan: ini bukan klaim lapak, harga sewa, atau kontak pedagang.',
    NOW() - INTERVAL '6 hours',
    NOW(),
    0,
    NULL,
    false,
    '{}'::jsonb,
    ARRAY['https://commons.wikimedia.org/wiki/Special:FilePath/Jalan-jalan_ke_Pasar_Beringharjo-12.jpg']
  ),
  (
    'real-post-kopi-tasikmalaya-supplier-bahan',
    'real-th-kopi-tasikmalaya-supplier-bahan',
    '00000000-0000-0000-0000-000000000801',
    'Foto biji kopi Tasikmalaya ini berguna sebagai konteks bahan usaha dan pencarian supplier. Sumber: https://commons.wikimedia.org/wiki/File:Coffee_beans_from_Tasikmalaya_in_a_glass_container_20170518.jpg. Lisensi: CC BY-SA 4.0. Catatan: ini bukan data stok, harga, MOQ, atau penyedia terverifikasi.',
    NOW() - INTERVAL '5 hours',
    NOW(),
    0,
    NULL,
    false,
    '{}'::jsonb,
    ARRAY['https://commons.wikimedia.org/wiki/Special:FilePath/Coffee_beans_from_Tasikmalaya_in_a_glass_container_20170518.jpg']
  ),
  (
    'real-post-batik-pekalongan-produk-lokal',
    'real-th-batik-pekalongan-produk-lokal',
    '00000000-0000-0000-0000-000000000801',
    'Foto batik khas Pekalongan ini dipakai untuk diskusi produk lokal dan konteks asal produk. Sumber: https://commons.wikimedia.org/wiki/File:Batik_Khas_Pekalongan.jpg. Lisensi: CC BY 4.0. Catatan: ini bukan katalog toko, harga, atau klaim ketersediaan barang.',
    NOW() - INTERVAL '4 hours',
    NOW(),
    0,
    NULL,
    false,
    '{}'::jsonb,
    ARRAY['https://commons.wikimedia.org/wiki/Special:FilePath/Batik_Khas_Pekalongan.jpg']
  ),
  (
    'real-post-laweyan-kawasan-usaha-kreatif',
    'real-th-laweyan-kawasan-usaha-kreatif',
    '00000000-0000-0000-0000-000000000801',
    'Foto Kampung Batik Laweyan ini dipakai sebagai rujukan kawasan usaha kreatif di Surakarta. Sumber: https://commons.wikimedia.org/wiki/File:Becak_Kampung_Batik_Laweyan.jpg. Lisensi: CC BY-SA 4.0. Catatan: ini bukan promosi paket wisata, kontak, atau vendor tertentu.',
    NOW() - INTERVAL '3 hours',
    NOW(),
    0,
    NULL,
    false,
    '{}'::jsonb,
    ARRAY['https://commons.wikimedia.org/wiki/Special:FilePath/Becak_Kampung_Batik_Laweyan.jpg']
  ),
  (
    'real-post-lok-baintan-pasar-sungai',
    'real-th-lok-baintan-pasar-sungai',
    '00000000-0000-0000-0000-000000000801',
    'Foto Lok Baintan ini dipakai untuk konteks pasar sungai dan perdagangan lokal. Sumber: https://commons.wikimedia.org/wiki/File:Lokbaintan.jpg. Lisensi: CC BY-SA 4.0. Catatan: ini bukan listing pedagang individual, nomor kontak, atau klaim jam buka.',
    NOW() - INTERVAL '2 hours',
    NOW(),
    0,
    NULL,
    false,
    '{}'::jsonb,
    ARRAY['https://commons.wikimedia.org/wiki/Special:FilePath/Lokbaintan.jpg']
  )
ON CONFLICT (id) DO UPDATE
SET content = EXCLUDED.content,
    updated_at = NOW(),
    reactions = EXCLUDED.reactions,
    image_urls = EXCLUDED.image_urls;

INSERT INTO forum.lajukan_forum_thread_tags (
    thread_id,
    tag_slug,
    position
  )
VALUES
  ('real-th-pasar-beringharjo-yogyakarta', 'pasar-tradisional', 0),
  ('real-th-kopi-tasikmalaya-supplier-bahan', 'bahan-usaha', 0),
  ('real-th-batik-pekalongan-produk-lokal', 'produk-lokal', 0),
  ('real-th-laweyan-kawasan-usaha-kreatif', 'kawasan-usaha', 0),
  ('real-th-lok-baintan-pasar-sungai', 'pasar-tradisional', 0)
ON CONFLICT (thread_id, tag_slug) DO UPDATE
SET position = EXCLUDED.position;

UPDATE forum.lajukan_forum_categories c
SET thread_count = counted.thread_count,
    post_count = counted.post_count,
    updated_at = NOW()
FROM (
  SELECT category_id,
         COUNT(*)::int AS thread_count,
         COALESCE(SUM(reply_count + 1), 0)::int AS post_count
  FROM forum.lajukan_forum_threads
  WHERE category_id IN (
    'real-c-komunitas-usaha-data-publik',
    'real-c-komunitas-usaha-supplier-lokal',
    'real-c-komunitas-usaha-tempat'
  )
  GROUP BY category_id
) counted
WHERE c.id = counted.category_id;

UPDATE forum.lajukan_forum_tags tag
SET usage_count = usage.usage_count
FROM (
  SELECT tag_slug, COUNT(*)::int AS usage_count
  FROM forum.lajukan_forum_thread_tags
  WHERE tag_slug IN (
    'pasar-tradisional',
    'bahan-usaha',
    'produk-lokal',
    'kawasan-usaha'
  )
  GROUP BY tag_slug
) usage
WHERE tag.slug = usage.tag_slug;

INSERT INTO reel.lajukan_reels (
    id,
    creator_user_id,
    creator,
    title,
    caption,
    tag,
    product_name,
    product_price,
    product_href,
    video_src,
    source_url,
    likes_count,
    comments_count,
    shares_count,
    tone,
    icon_key,
    media_url,
    media_type,
    hook,
    filter_preset,
    capture_mode,
    live_status,
    live_title,
    live_scheduled_at,
    metadata,
    store_id,
    store_slug,
    store_name,
    store_city,
    store_phone,
    storefront_path,
    status,
    published_at,
    created_at,
    updated_at
  )
VALUES
  (
    'real-reel-ondel-ondel-jakarta-wikimedia',
    '00000000-0000-0000-0000-000000000801',
    'Wikimedia Commons / gunjakarta',
    'Ondel-ondel Betawi di jalan Jakarta',
    'Dokumentasi budaya Jakarta dari Wikimedia Commons. Ini referensi event dan ekonomi kreatif, bukan vendor atau kontak pribadi.',
    'Budaya Jakarta',
    'Referensi event budaya Betawi',
    'Sumber bebas, bukan listing berbayar',
    '/id/explore/services',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Ondel-Ondel_Betawi_Street_Performance_in_Jakarta.webm',
    'https://commons.wikimedia.org/wiki/File:Ondel-Ondel_Betawi_Street_Performance_in_Jakarta.webm',
    0,
    0,
    0,
    'rose',
    'service',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Ondel-Ondel_Betawi_Street_Performance_in_Jakarta.webm',
    'video',
    'Pakai sebagai referensi budaya dan event lokal, bukan klaim penyedia jasa.',
    'cinema',
    'upload',
    'none',
    NULL,
    NULL,
    jsonb_build_object(
      'seed_pack', 'real_indonesia_open_data_20260723',
      'record_kind', 'real_open_media_reference',
      'is_transactional', false,
      'contact_policy', 'no_private_contact_seeded',
      'subject_city', 'Jakarta',
      'source', jsonb_build_object(
        'provider', 'Wikimedia Commons',
        'title', 'Ondel-Ondel Betawi Street Performance in Jakarta.webm',
        'url', 'https://commons.wikimedia.org/wiki/File:Ondel-Ondel_Betawi_Street_Performance_in_Jakarta.webm',
        'direct_media_url', 'https://commons.wikimedia.org/wiki/Special:FilePath/Ondel-Ondel_Betawi_Street_Performance_in_Jakarta.webm',
        'author', 'gunjakarta',
        'license', 'CC BY 3.0',
        'license_url', 'https://creativecommons.org/licenses/by/3.0/',
        'access', 'free_public_media'
      )
    ),
    '',
    '',
    'Referensi budaya Jakarta',
    'Jakarta',
    NULL,
    '',
    'published',
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '4 hours',
    NOW()
  ),
  (
    'real-reel-cagar-budaya-indonesia-wikimedia',
    '00000000-0000-0000-0000-000000000801',
    'Wikimedia Commons / Minsky Alton',
    'Cagar budaya Indonesia untuk konteks usaha lokal',
    'Video bebas CC0 tentang cagar budaya Indonesia. Cocok untuk discovery wisata, tempat usaha, dan jasa kreatif lokal.',
    'Tempat Usaha',
    'Referensi wisata dan tempat usaha',
    'Sumber bebas, bukan listing berbayar',
    '/id/explore/business-places',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Cagar_Budaya_Indonesia.webm',
    'https://commons.wikimedia.org/wiki/File:Cagar_Budaya_Indonesia.webm',
    0,
    0,
    0,
    'emerald',
    'location',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Cagar_Budaya_Indonesia.webm',
    'video',
    'Tampilkan sebagai inspirasi lokasi, tanpa menyiratkan stok, harga, atau kontak.',
    'natural',
    'upload',
    'none',
    NULL,
    NULL,
    jsonb_build_object(
      'seed_pack', 'real_indonesia_open_data_20260723',
      'record_kind', 'real_open_media_reference',
      'is_transactional', false,
      'contact_policy', 'no_private_contact_seeded',
      'subject_city', 'Indonesia',
      'source', jsonb_build_object(
        'provider', 'Wikimedia Commons',
        'title', 'Cagar Budaya Indonesia.webm',
        'url', 'https://commons.wikimedia.org/wiki/File:Cagar_Budaya_Indonesia.webm',
        'direct_media_url', 'https://commons.wikimedia.org/wiki/Special:FilePath/Cagar_Budaya_Indonesia.webm',
        'author', 'Minsky Alton',
        'license', 'CC0 1.0',
        'license_url', 'https://creativecommons.org/publicdomain/zero/1.0/',
        'access', 'free_public_media'
      )
    ),
    '',
    '',
    'Referensi cagar budaya Indonesia',
    'Indonesia',
    NULL,
    '',
    'published',
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '3 hours',
    NOW()
  ),
  (
    'real-reel-sunset-yogyakarta-wikimedia',
    '00000000-0000-0000-0000-000000000801',
    'Wikimedia Commons / Joaquim Baeta',
    'Yogyakarta sebagai konteks lokasi wisata dan usaha sore',
    'Video sunset Yogyakarta berlisensi CC BY 4.0. Dipakai sebagai referensi visual lokasi, bukan promosi toko tertentu.',
    'Yogyakarta',
    'Referensi lokasi wisata dan usaha',
    'Sumber bebas, bukan listing berbayar',
    '/id/explore/business-places',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Sunset_in_Yogyakarta.webm',
    'https://commons.wikimedia.org/wiki/File:Sunset_in_Yogyakarta.webm',
    0,
    0,
    0,
    'amber',
    'location',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Sunset_in_Yogyakarta.webm',
    'video',
    'Gunakan sebagai konteks kota dan jam ramai, bukan klaim sewa tempat.',
    'warm',
    'upload',
    'none',
    NULL,
    NULL,
    jsonb_build_object(
      'seed_pack', 'real_indonesia_open_data_20260723',
      'record_kind', 'real_open_media_reference',
      'is_transactional', false,
      'contact_policy', 'no_private_contact_seeded',
      'subject_city', 'Yogyakarta',
      'source', jsonb_build_object(
        'provider', 'Wikimedia Commons',
        'title', 'Sunset in Yogyakarta.webm',
        'url', 'https://commons.wikimedia.org/wiki/File:Sunset_in_Yogyakarta.webm',
        'direct_media_url', 'https://commons.wikimedia.org/wiki/Special:FilePath/Sunset_in_Yogyakarta.webm',
        'author', 'Joaquim Baeta',
        'license', 'CC BY 4.0',
        'license_url', 'https://creativecommons.org/licenses/by/4.0/',
        'access', 'free_public_media'
      )
    ),
    '',
    '',
    'Referensi lokasi Yogyakarta',
    'Yogyakarta',
    NULL,
    '',
    'published',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours',
    NOW()
  ),
  (
    'real-reel-lok-baintan-floating-market-wikimedia',
    '00000000-0000-0000-0000-000000000801',
    'Wikimedia Commons / Midori',
    'Pasar Terapung Lok Baintan sebagai pasar nyata Indonesia',
    'Video pasar terapung Lok Baintan, Kalimantan Selatan. Ini referensi pasar sungai nyata, bukan listing pedagang individual.',
    'Pasar Tradisional',
    'Referensi pasar terapung',
    'Sumber bebas, bukan listing berbayar',
    '/id/explore/business-places',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Lok_Baintan_Floating_Market,_South_Kalimantan,_Indonesia.ogv',
    'https://commons.wikimedia.org/wiki/File:Lok_Baintan_Floating_Market,_South_Kalimantan,_Indonesia.ogv',
    0,
    0,
    0,
    'cyan',
    'location',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Lok_Baintan_Floating_Market,_South_Kalimantan,_Indonesia.ogv',
    'video',
    'Pisahkan referensi tempat dari penawaran dagang individual.',
    'fresh',
    'upload',
    'none',
    NULL,
    NULL,
    jsonb_build_object(
      'seed_pack', 'real_indonesia_open_data_20260723',
      'record_kind', 'real_open_media_reference',
      'is_transactional', false,
      'contact_policy', 'no_private_contact_seeded',
      'subject_city', 'Banjar',
      'source', jsonb_build_object(
        'provider', 'Wikimedia Commons',
        'title', 'Lok Baintan Floating Market, South Kalimantan, Indonesia.ogv',
        'url', 'https://commons.wikimedia.org/wiki/File:Lok_Baintan_Floating_Market,_South_Kalimantan,_Indonesia.ogv',
        'direct_media_url', 'https://commons.wikimedia.org/wiki/Special:FilePath/Lok_Baintan_Floating_Market,_South_Kalimantan,_Indonesia.ogv',
        'author', 'Midori',
        'license', 'CC BY-SA 3.0',
        'license_url', 'https://creativecommons.org/licenses/by-sa/3.0/',
        'access', 'free_public_media'
      )
    ),
    '',
    '',
    'Referensi pasar Lok Baintan',
    'Banjar',
    NULL,
    '',
    'published',
    NOW() - INTERVAL '90 minutes',
    NOW() - INTERVAL '90 minutes',
    NOW()
  ),
  (
    'real-reel-bahasa-isyarat-yogyakarta-wikimedia',
    '00000000-0000-0000-0000-000000000801',
    'Wikimedia Commons / Annidafattiya',
    'Bahasa isyarat Yogyakarta untuk layanan yang lebih inklusif',
    'Video bahasa isyarat varian Yogyakarta berlisensi CC BY-SA 4.0. Dipakai sebagai referensi edukasi layanan lokal.',
    'Layanan Inklusif',
    'Referensi layanan dan pelatihan',
    'Sumber bebas, bukan listing berbayar',
    '/id/explore/services',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Mandi.webm',
    'https://commons.wikimedia.org/wiki/File:Mandi.webm',
    0,
    0,
    0,
    'blue',
    'service',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Mandi.webm',
    'video',
    'Konten ini membantu contoh layanan inklusif, bukan klaim penyedia pelatihan.',
    'natural',
    'upload',
    'none',
    NULL,
    NULL,
    jsonb_build_object(
      'seed_pack', 'real_indonesia_open_data_20260723',
      'record_kind', 'real_open_media_reference',
      'is_transactional', false,
      'contact_policy', 'no_private_contact_seeded',
      'subject_city', 'Yogyakarta',
      'source', jsonb_build_object(
        'provider', 'Wikimedia Commons',
        'title', 'Mandi.webm',
        'url', 'https://commons.wikimedia.org/wiki/File:Mandi.webm',
        'direct_media_url', 'https://commons.wikimedia.org/wiki/Special:FilePath/Mandi.webm',
        'author', 'Annidafattiya',
        'license', 'CC BY-SA 4.0',
        'license_url', 'https://creativecommons.org/licenses/by-sa/4.0/',
        'access', 'free_public_media'
      )
    ),
    '',
    '',
    'Referensi layanan inklusif',
    'Yogyakarta',
    NULL,
    '',
    'published',
    NOW() - INTERVAL '45 minutes',
    NOW() - INTERVAL '45 minutes',
    NOW()
  ),
  (
    'real-reel-beringharjo-yogyakarta-wikimedia',
    '00000000-0000-0000-0000-000000000801',
    'Wikimedia Commons / Indonesiagood',
    'Pasar Beringharjo sebagai referensi tempat usaha Yogyakarta',
    'Foto Pasar Beringharjo berlisensi CC BY 3.0. Dipakai untuk konteks pasar nyata, bukan klaim lapak atau kontak pedagang.',
    'Pasar Tradisional',
    'Referensi Pasar Beringharjo',
    'Sumber bebas, bukan listing berbayar',
    '/id/explore/business-places',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Jalan-jalan_ke_Pasar_Beringharjo-12.jpg',
    'https://commons.wikimedia.org/wiki/File:Jalan-jalan_ke_Pasar_Beringharjo-12.jpg',
    0,
    0,
    0,
    'amber',
    'location',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Jalan-jalan_ke_Pasar_Beringharjo-12.jpg',
    'image',
    'Gunakan sebagai referensi lokasi pasar, bukan penawaran sewa kios.',
    'warm',
    'upload',
    'none',
    NULL,
    NULL,
    jsonb_build_object(
      'seed_pack', 'real_indonesia_open_data_20260723',
      'record_kind', 'real_open_media_reference',
      'is_transactional', false,
      'contact_policy', 'no_private_contact_seeded',
      'subject_city', 'Yogyakarta',
      'source', jsonb_build_object(
        'provider', 'Wikimedia Commons',
        'title', 'Jalan-jalan ke Pasar Beringharjo-12.jpg',
        'url', 'https://commons.wikimedia.org/wiki/File:Jalan-jalan_ke_Pasar_Beringharjo-12.jpg',
        'direct_media_url', 'https://commons.wikimedia.org/wiki/Special:FilePath/Jalan-jalan_ke_Pasar_Beringharjo-12.jpg',
        'author', 'Indonesiagood',
        'license', 'CC BY 3.0',
        'license_url', 'https://creativecommons.org/licenses/by/3.0/',
        'access', 'free_public_media'
      )
    ),
    '',
    '',
    'Referensi Pasar Beringharjo',
    'Yogyakarta',
    NULL,
    '',
    'published',
    NOW() - INTERVAL '38 minutes',
    NOW() - INTERVAL '38 minutes',
    NOW()
  ),
  (
    'real-reel-kopi-tasikmalaya-wikimedia',
    '00000000-0000-0000-0000-000000000801',
    'Wikimedia Commons / Abdulrohmatt',
    'Biji kopi Tasikmalaya untuk konteks supplier bahan lokal',
    'Foto biji kopi dari Tasikmalaya berlisensi CC BY-SA 4.0. Dipakai sebagai referensi komoditas, bukan stok supplier tertentu.',
    'Bahan Usaha',
    'Referensi biji kopi Tasikmalaya',
    'Sumber bebas, bukan listing berbayar',
    '/id/explore/materials-suppliers',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Coffee_beans_from_Tasikmalaya_in_a_glass_container_20170518.jpg',
    'https://commons.wikimedia.org/wiki/File:Coffee_beans_from_Tasikmalaya_in_a_glass_container_20170518.jpg',
    0,
    0,
    0,
    'emerald',
    'supplier',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Coffee_beans_from_Tasikmalaya_in_a_glass_container_20170518.jpg',
    'image',
    'Cocok untuk contoh pencarian bahan kopi, bukan klaim harga atau stok.',
    'natural',
    'upload',
    'none',
    NULL,
    NULL,
    jsonb_build_object(
      'seed_pack', 'real_indonesia_open_data_20260723',
      'record_kind', 'real_open_media_reference',
      'is_transactional', false,
      'contact_policy', 'no_private_contact_seeded',
      'subject_city', 'Tasikmalaya',
      'source', jsonb_build_object(
        'provider', 'Wikimedia Commons',
        'title', 'Coffee beans from Tasikmalaya in a glass container 20170518.jpg',
        'url', 'https://commons.wikimedia.org/wiki/File:Coffee_beans_from_Tasikmalaya_in_a_glass_container_20170518.jpg',
        'direct_media_url', 'https://commons.wikimedia.org/wiki/Special:FilePath/Coffee_beans_from_Tasikmalaya_in_a_glass_container_20170518.jpg',
        'author', 'Abdulrohmatt',
        'license', 'CC BY-SA 4.0',
        'license_url', 'https://creativecommons.org/licenses/by-sa/4.0/',
        'access', 'free_public_media'
      )
    ),
    '',
    '',
    'Referensi biji kopi Tasikmalaya',
    'Tasikmalaya',
    NULL,
    '',
    'published',
    NOW() - INTERVAL '31 minutes',
    NOW() - INTERVAL '31 minutes',
    NOW()
  ),
  (
    'real-reel-batik-pekalongan-wikimedia',
    '00000000-0000-0000-0000-000000000801',
    'Wikimedia Commons / Sekar Jarwo Soekarno',
    'Batik Pekalongan sebagai referensi produk kreatif lokal',
    'Foto batik khas Pekalongan berlisensi CC BY 4.0. Dipakai sebagai referensi visual produk lokal, bukan katalog toko tertentu.',
    'Produk Lokal',
    'Referensi batik Pekalongan',
    'Sumber bebas, bukan listing berbayar',
    '/id/explore/materials-suppliers',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Batik_Khas_Pekalongan.jpg',
    'https://commons.wikimedia.org/wiki/File:Batik_Khas_Pekalongan.jpg',
    0,
    0,
    0,
    'rose',
    'packaging',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Batik_Khas_Pekalongan.jpg',
    'image',
    'Tampilkan sebagai inspirasi produk kreatif, tanpa klaim vendor atau harga.',
    'pop',
    'upload',
    'none',
    NULL,
    NULL,
    jsonb_build_object(
      'seed_pack', 'real_indonesia_open_data_20260723',
      'record_kind', 'real_open_media_reference',
      'is_transactional', false,
      'contact_policy', 'no_private_contact_seeded',
      'subject_city', 'Pekalongan',
      'source', jsonb_build_object(
        'provider', 'Wikimedia Commons',
        'title', 'Batik Khas Pekalongan.jpg',
        'url', 'https://commons.wikimedia.org/wiki/File:Batik_Khas_Pekalongan.jpg',
        'direct_media_url', 'https://commons.wikimedia.org/wiki/Special:FilePath/Batik_Khas_Pekalongan.jpg',
        'author', 'Sekar Jarwo Soekarno',
        'license', 'CC BY 4.0',
        'license_url', 'https://creativecommons.org/licenses/by/4.0/',
        'access', 'free_public_media'
      )
    ),
    '',
    '',
    'Referensi batik Pekalongan',
    'Pekalongan',
    NULL,
    '',
    'published',
    NOW() - INTERVAL '24 minutes',
    NOW() - INTERVAL '24 minutes',
    NOW()
  ),
  (
    'real-reel-kampung-batik-laweyan-wikimedia',
    '00000000-0000-0000-0000-000000000801',
    'Wikimedia Commons / Herusutimbul',
    'Kampung Batik Laweyan sebagai referensi kawasan usaha kreatif',
    'Foto Becak Kampung Batik Laweyan berlisensi CC BY-SA 4.0. Dipakai sebagai referensi kawasan, bukan promosi penyedia jasa wisata.',
    'Kawasan Usaha',
    'Referensi Kampung Batik Laweyan',
    'Sumber bebas, bukan listing berbayar',
    '/id/explore/business-places',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Becak_Kampung_Batik_Laweyan.jpg',
    'https://commons.wikimedia.org/wiki/File:Becak_Kampung_Batik_Laweyan.jpg',
    0,
    0,
    0,
    'orange',
    'marketing',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Becak_Kampung_Batik_Laweyan.jpg',
    'image',
    'Gunakan untuk konteks kawasan kreatif Solo, bukan klaim kontak atau paket wisata.',
    'cinema',
    'upload',
    'none',
    NULL,
    NULL,
    jsonb_build_object(
      'seed_pack', 'real_indonesia_open_data_20260723',
      'record_kind', 'real_open_media_reference',
      'is_transactional', false,
      'contact_policy', 'no_private_contact_seeded',
      'subject_city', 'Surakarta',
      'source', jsonb_build_object(
        'provider', 'Wikimedia Commons',
        'title', 'Becak Kampung Batik Laweyan.jpg',
        'url', 'https://commons.wikimedia.org/wiki/File:Becak_Kampung_Batik_Laweyan.jpg',
        'direct_media_url', 'https://commons.wikimedia.org/wiki/Special:FilePath/Becak_Kampung_Batik_Laweyan.jpg',
        'author', 'Herusutimbul',
        'license', 'CC BY-SA 4.0',
        'license_url', 'https://creativecommons.org/licenses/by-sa/4.0/',
        'access', 'free_public_media'
      )
    ),
    '',
    '',
    'Referensi Kampung Batik Laweyan',
    'Surakarta',
    NULL,
    '',
    'published',
    NOW() - INTERVAL '17 minutes',
    NOW() - INTERVAL '17 minutes',
    NOW()
  ),
  (
    'real-reel-lokbaintan-photo-wikimedia',
    '00000000-0000-0000-0000-000000000801',
    'Wikimedia Commons / Rifki Muslim',
    'Foto Lok Baintan untuk konteks pasar sungai dan perdagangan lokal',
    'Foto Lok Baintan berlisensi CC BY-SA 4.0. Dipakai sebagai visual pasar nyata, bukan klaim toko atau nomor pedagang.',
    'Pasar Tradisional',
    'Referensi foto Lok Baintan',
    'Sumber bebas, bukan listing berbayar',
    '/id/explore/business-places',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Lokbaintan.jpg',
    'https://commons.wikimedia.org/wiki/File:Lokbaintan.jpg',
    0,
    0,
    0,
    'blue',
    'location',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Lokbaintan.jpg',
    'image',
    'Pisahkan inspirasi pasar nyata dari listing pedagang individual.',
    'fresh',
    'upload',
    'none',
    NULL,
    NULL,
    jsonb_build_object(
      'seed_pack', 'real_indonesia_open_data_20260723',
      'record_kind', 'real_open_media_reference',
      'is_transactional', false,
      'contact_policy', 'no_private_contact_seeded',
      'subject_city', 'Banjar',
      'source', jsonb_build_object(
        'provider', 'Wikimedia Commons',
        'title', 'Lokbaintan.jpg',
        'url', 'https://commons.wikimedia.org/wiki/File:Lokbaintan.jpg',
        'direct_media_url', 'https://commons.wikimedia.org/wiki/Special:FilePath/Lokbaintan.jpg',
        'author', 'Rifki Muslim',
        'license', 'CC BY-SA 4.0',
        'license_url', 'https://creativecommons.org/licenses/by-sa/4.0/',
        'access', 'free_public_media'
      )
    ),
    '',
    '',
    'Referensi foto Lok Baintan',
    'Banjar',
    NULL,
    '',
    'published',
    NOW() - INTERVAL '10 minutes',
    NOW() - INTERVAL '10 minutes',
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET creator_user_id = EXCLUDED.creator_user_id,
    creator = EXCLUDED.creator,
    title = EXCLUDED.title,
    caption = EXCLUDED.caption,
    tag = EXCLUDED.tag,
    product_name = EXCLUDED.product_name,
    product_price = EXCLUDED.product_price,
    product_href = EXCLUDED.product_href,
    video_src = EXCLUDED.video_src,
    source_url = EXCLUDED.source_url,
    likes_count = EXCLUDED.likes_count,
    comments_count = EXCLUDED.comments_count,
    shares_count = EXCLUDED.shares_count,
    tone = EXCLUDED.tone,
    icon_key = EXCLUDED.icon_key,
    media_url = EXCLUDED.media_url,
    media_type = EXCLUDED.media_type,
    hook = EXCLUDED.hook,
    filter_preset = EXCLUDED.filter_preset,
    capture_mode = EXCLUDED.capture_mode,
    live_status = EXCLUDED.live_status,
    live_title = EXCLUDED.live_title,
    live_scheduled_at = EXCLUDED.live_scheduled_at,
    metadata = EXCLUDED.metadata,
    store_id = EXCLUDED.store_id,
    store_slug = EXCLUDED.store_slug,
    store_name = EXCLUDED.store_name,
    store_city = EXCLUDED.store_city,
    store_phone = EXCLUDED.store_phone,
    storefront_path = EXCLUDED.storefront_path,
    status = EXCLUDED.status,
    published_at = EXCLUDED.published_at,
    updated_at = NOW();
