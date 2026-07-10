SET search_path = forum, reel, public, events;

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
    '00000000-0000-0000-0000-000000000701',
    'sari_gayo_demo',
    'Sari Gayo',
    '/default-avatar.svg',
    'Supplier kopi Gayo dan mentor reseller',
    840,
    840,
    ARRAY ['supplier', 'kopi', 'mentor'],
    '{"seed_pack":"indonesia_demo_20260709","city":"Banda Aceh","focus":"kopi gayo"}'::jsonb,
    now() - interval '120 days',
    now() - interval '2 hours'
  ),
  (
    '00000000-0000-0000-0000-000000000702',
    'bima_mesin_demo',
    'Bima Mesin',
    '/default-avatar.svg',
    'Perakit mesin produksi UMKM',
    790,
    790,
    ARRAY ['mesin-lokal', 'produksi'],
    '{"seed_pack":"indonesia_demo_20260709","city":"Bandung","focus":"mesin produksi lokal"}'::jsonb,
    now() - interval '115 days',
    now() - interval '3 hours'
  ),
  (
    '00000000-0000-0000-0000-000000000703',
    'naya_laut_demo',
    'Naya Laut Timur',
    '/default-avatar.svg',
    'Supplier rumput laut NTT',
    720,
    720,
    ARRAY ['bahan-nusantara', 'laut'],
    '{"seed_pack":"indonesia_demo_20260709","city":"Kupang","focus":"rumput laut"}'::jsonb,
    now() - interval '108 days',
    now() - interval '4 hours'
  ),
  (
    '00000000-0000-0000-0000-000000000704',
    'raka_bambu_demo',
    'Raka Bambu',
    '/default-avatar.svg',
    'Pengrajin kemasan bambu Tasik',
    690,
    690,
    ARRAY ['kemasan', 'kerajinan'],
    '{"seed_pack":"indonesia_demo_20260709","city":"Tasikmalaya","focus":"kemasan bambu"}'::jsonb,
    now() - interval '101 days',
    now() - interval '5 hours'
  ),
  (
    '00000000-0000-0000-0000-000000000705',
    'dewi_mocaf_demo',
    'Dewi Mocaf',
    '/default-avatar.svg',
    'Produsen tepung mocaf Garut',
    760,
    760,
    ARRAY ['mocaf', 'bahan-baku'],
    '{"seed_pack":"indonesia_demo_20260709","city":"Garut","focus":"mocaf"}'::jsonb,
    now() - interval '96 days',
    now() - interval '6 hours'
  ),
  (
    '00000000-0000-0000-0000-000000000706',
    'arif_digital_demo',
    'Arif Digital',
    '/default-avatar.svg',
    'Fotografer produk dan admin marketplace',
    620,
    620,
    ARRAY ['jasa', 'konten'],
    '{"seed_pack":"indonesia_demo_20260709","city":"Surabaya","focus":"jasa digital umkm"}'::jsonb,
    now() - interval '89 days',
    now() - interval '8 hours'
  ),
  (
    '00000000-0000-0000-0000-000000000707',
    'lestari_booth_demo',
    'Lestari Booth',
    '/default-avatar.svg',
    'Kurator kios dan dapur produksi',
    580,
    580,
    ARRAY ['lokasi', 'operasional'],
    '{"seed_pack":"indonesia_demo_20260709","city":"Yogyakarta","focus":"tempat usaha"}'::jsonb,
    now() - interval '82 days',
    now() - interval '10 hours'
  ),
  (
    '00000000-0000-0000-0000-000000000708',
    'hana_jamu_demo',
    'Hana Jamu',
    '/default-avatar.svg',
    'Founder kemitraan jamu modern',
    810,
    810,
    ARRAY ['peluang-usaha', 'jamu'],
    '{"seed_pack":"indonesia_demo_20260709","city":"Solo","focus":"jamu modern"}'::jsonb,
    now() - interval '78 days',
    now() - interval '12 hours'
  ),
  (
    '00000000-0000-0000-0000-000000000709',
    'tio_reseller_demo',
    'Tio Reseller',
    '/default-avatar.svg',
    'Reseller produk lokal Indonesia',
    540,
    540,
    ARRAY ['reseller', 'komunitas'],
    '{"seed_pack":"indonesia_demo_20260709","city":"Jakarta","focus":"reseller produk lokal"}'::jsonb,
    now() - interval '70 days',
    now() - interval '14 hours'
  ),
  (
    '00000000-0000-0000-0000-000000000710',
    'made_kakao_demo',
    'Made Kakao',
    '/default-avatar.svg',
    'Supplier kakao fermentasi Sulawesi',
    705,
    705,
    ARRAY ['kakao', 'bahan-baku'],
    '{"seed_pack":"indonesia_demo_20260709","city":"Makassar","focus":"kakao fermentasi"}'::jsonb,
    now() - interval '64 days',
    now() - interval '16 hours'
  ) ON CONFLICT (id) DO UPDATE
SET username = EXCLUDED.username,
  name = EXCLUDED.name,
  avatar_url = EXCLUDED.avatar_url,
  title = EXCLUDED.title,
  reputation = EXCLUDED.reputation,
  base_reputation = EXCLUDED.base_reputation,
  badges = EXCLUDED.badges,
  metadata = forum.lajukan_forum_users.metadata || EXCLUDED.metadata,
  updated_at = now();

INSERT INTO forum.lajukan_forum_categories (
    id,
    name,
    slug,
    description,
    icon,
    color,
    position,
    created_at,
    updated_at
  )
VALUES (
    'demo-c-supplier-lokal',
    'Supplier Lokal',
    'supplier-lokal-indonesia',
    'Diskusi supplier tangan pertama, bahan usaha, dan rantai pasok dari Indonesia.',
    'package-check',
    '#059669',
    10,
    now() - interval '60 days',
    now()
  ),
  (
    'demo-c-mesin-produksi',
    'Mesin Produksi',
    'mesin-produksi-indonesia',
    'Rekomendasi mesin dan alat produksi lokal untuk UMKM.',
    'wrench',
    '#2563eb',
    11,
    now() - interval '60 days',
    now()
  ),
  (
    'demo-c-bahan-nusantara',
    'Bahan Nusantara',
    'bahan-nusantara',
    'Ide bahan baku Indonesia seperti mocaf, sagu, rempah, kakao, kopi, dan rumput laut.',
    'leaf',
    '#16a34a',
    12,
    now() - interval '60 days',
    now()
  ),
  (
    'demo-c-peluang-usaha',
    'Peluang Usaha',
    'peluang-usaha-indonesia',
    'Kemitraan, reseller, franchise, oper usaha, dan ide bisnis berbasis produk lokal.',
    'rocket',
    '#f97316',
    13,
    now() - interval '60 days',
    now()
  ),
  (
    'demo-c-operasional-umkm',
    'Operasional UMKM',
    'operasional-umkm-indonesia',
    'Legalitas, lokasi, konten, pengiriman, stok, dan SOP harian usaha kecil.',
    'clipboard-check',
    '#7c3aed',
    14,
    now() - interval '60 days',
    now()
  ) ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  position = EXCLUDED.position,
  updated_at = now();

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
VALUES (
    'demo-g-supplier-lokal',
    'demo-c-supplier-lokal',
    'Supplier Lokal Indonesia',
    'supplier-lokal-indonesia',
    'Tempat berbagi supplier bahan, produsen, dan cara menjaga kualitas pasokan lokal.',
    'public',
    'public',
    'open',
    '/images/hero/menu/bahan-01.png',
    ARRAY [
      'Cantumkan kota, minimum order, dan kapasitas produksi kalau berbagi supplier.',
      'Hindari klaim harga tanpa konteks ukuran, grade, dan ongkir.',
      'Utamakan bahan, produk, dan produsen Indonesia.'
    ],
    '00000000-0000-0000-0000-000000000701',
    'active',
    now() - interval '58 days',
    now()
  ),
  (
    'demo-g-mesin-produksi',
    'demo-c-mesin-produksi',
    'Mesin dan Alat UMKM Lokal',
    'mesin-dan-alat-umkm-lokal',
    'Diskusi kapasitas mesin, perawatan, instalasi, dan suku cadang lokal.',
    'public',
    'public',
    'open',
    '/images/hero/menu/mesin-01.png',
    ARRAY [
      'Sebutkan kapasitas, daya listrik, material food grade, dan garansi.',
      'Bantu anggota memilih mesin sesuai volume produksi, bukan sekadar harga.',
      'Bagikan pengalaman servis dan ketersediaan spare part.'
    ],
    '00000000-0000-0000-0000-000000000702',
    'active',
    now() - interval '58 days',
    now()
  ),
  (
    'demo-g-bahan-nusantara',
    'demo-c-bahan-nusantara',
    'Bahan Nusantara Naik Kelas',
    'bahan-nusantara-naik-kelas',
    'Eksplorasi bahan lokal Indonesia untuk produk makanan, minuman, craft, dan wellness.',
    'public',
    'public',
    'open',
    '/images/hero/menu/bahan-01.png',
    ARRAY [
      'Jelaskan asal bahan, grade, kadar air, dan cara simpan.',
      'Tulis ide produk dengan hitungan kasar agar bisa dicoba UMKM.',
      'Hormati sumber bahan dan komunitas produsen daerah.'
    ],
    '00000000-0000-0000-0000-000000000705',
    'active',
    now() - interval '58 days',
    now()
  ),
  (
    'demo-g-peluang-usaha',
    'demo-c-peluang-usaha',
    'Peluang Usaha Produk Lokal',
    'peluang-usaha-produk-lokal',
    'Bahas franchise, kemitraan, reseller, oper usaha, dan paket mulai usaha.',
    'public',
    'public',
    'open',
    '/images/hero/menu/peluang-01.png',
    ARRAY [
      'Cantumkan modal, isi paket, margin realistis, dan dukungan operasional.',
      'Tidak menjanjikan keuntungan pasti.',
      'Utamakan peluang yang jelas legalitas dan produknya.'
    ],
    '00000000-0000-0000-0000-000000000708',
    'active',
    now() - interval '58 days',
    now()
  ),
  (
    'demo-g-operasional-umkm',
    'demo-c-operasional-umkm',
    'Operasional UMKM Rapi',
    'operasional-umkm-rapi',
    'SOP stok, foto produk, legalitas, tempat usaha, dan rutinitas penjualan harian.',
    'public',
    'public',
    'open',
    '/images/hero/menu/jasa-01.png',
    ARRAY [
      'Tulis masalah operasional dengan konteks usaha dan kota.',
      'Bagikan checklist praktis yang bisa langsung dipakai.',
      'Jaga diskusi tetap aman, sopan, dan tidak membuka data pribadi.'
    ],
    '00000000-0000-0000-0000-000000000706',
    'active',
    now() - interval '58 days',
    now()
  ) ON CONFLICT (category_id) DO UPDATE
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
  updated_at = now();

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
  m.user_id,
  m.role,
  'active',
  true,
  now() - (m.age_days || ' days')::interval,
  now()
FROM (
    VALUES (
        'demo-c-supplier-lokal',
        '00000000-0000-0000-0000-000000000701',
        'owner',
        56
      ),
      (
        'demo-c-supplier-lokal',
        '00000000-0000-0000-0000-000000000703',
        'member',
        44
      ),
      (
        'demo-c-supplier-lokal',
        '00000000-0000-0000-0000-000000000710',
        'member',
        42
      ),
      (
        'demo-c-mesin-produksi',
        '00000000-0000-0000-0000-000000000702',
        'owner',
        55
      ),
      (
        'demo-c-mesin-produksi',
        '00000000-0000-0000-0000-000000000709',
        'member',
        37
      ),
      (
        'demo-c-bahan-nusantara',
        '00000000-0000-0000-0000-000000000705',
        'owner',
        54
      ),
      (
        'demo-c-bahan-nusantara',
        '00000000-0000-0000-0000-000000000703',
        'member',
        41
      ),
      (
        'demo-c-bahan-nusantara',
        '00000000-0000-0000-0000-000000000710',
        'member',
        35
      ),
      (
        'demo-c-peluang-usaha',
        '00000000-0000-0000-0000-000000000708',
        'owner',
        53
      ),
      (
        'demo-c-peluang-usaha',
        '00000000-0000-0000-0000-000000000709',
        'member',
        32
      ),
      (
        'demo-c-operasional-umkm',
        '00000000-0000-0000-0000-000000000706',
        'owner',
        52
      ),
      (
        'demo-c-operasional-umkm',
        '00000000-0000-0000-0000-000000000707',
        'member',
        28
      )
  ) AS m(category_id, user_id, role, age_days)
  JOIN forum.lajukan_groups g ON g.category_id = m.category_id ON CONFLICT (group_id, user_id) DO UPDATE
SET role = EXCLUDED.role,
  status = 'active',
  notifications_enabled = true,
  updated_at = now();

INSERT INTO forum.lajukan_forum_tags (
    id,
    name,
    slug,
    description,
    color,
    usage_count
  )
VALUES (
    'tag-demo-kopi-indonesia',
    'Kopi Indonesia',
    'kopi-indonesia',
    'Diskusi kopi Gayo, Kintamani, Toraja, Temanggung, dan rantai pasok kopi lokal.',
    '#92400e',
    0
  ),
  (
    'tag-demo-mocaf',
    'Mocaf',
    'mocaf',
    'Tepung singkong modifikasi untuk bakery, snack, dan produk bebas gluten.',
    '#a16207',
    0
  ),
  (
    'tag-demo-rumput-laut',
    'Rumput Laut',
    'rumput-laut',
    'Rumput laut Indonesia untuk pangan, minuman, kosmetik, dan bahan industri.',
    '#0891b2',
    0
  ),
  (
    'tag-demo-mesin-lokal',
    'Mesin Lokal',
    'mesin-lokal',
    'Mesin produksi buatan Indonesia, instalasi, servis, dan spare part.',
    '#2563eb',
    0
  ),
  (
    'tag-demo-kemitraan',
    'Kemitraan',
    'kemitraan',
    'Paket kemitraan, franchise, reseller, dan model kerja sama usaha.',
    '#f97316',
    0
  ),
  (
    'tag-demo-legalitas-umkm',
    'Legalitas UMKM',
    'legalitas-umkm',
    'NIB, PIRT, halal, BPOM, merek, dan dokumen pendukung bisnis kecil.',
    '#7c3aed',
    0
  ),
  (
    'tag-demo-reseller',
    'Reseller',
    'reseller-produk-lokal',
    'Strategi stok, konten, margin, dan repeat order untuk reseller produk lokal.',
    '#db2777',
    0
  ) ON CONFLICT (slug) DO UPDATE
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
    is_solved,
    status,
    image_urls
  )
VALUES (
    'demo-th-supplier-bahan-indonesia',
    'Supplier bahan Indonesia apa yang paling stabil untuk reseller pemula?',
    'supplier-bahan-indonesia-reseller-pemula',
    'demo-c-supplier-lokal',
    (
      SELECT id
      FROM forum.lajukan_groups
      WHERE category_id = 'demo-c-supplier-lokal'
      LIMIT 1
    ),
    '00000000-0000-0000-0000-000000000709',
    now() - interval '20 days',
    now() - interval '2 hours',
    1420,
    0,
    38,
    14,
    true,
    false,
    'open',
    ARRAY ['/images/hero/menu/bahan-01.png']
  ),
  (
    'demo-th-checklist-mesin-lokal',
    'Checklist beli mesin produksi lokal supaya tidak salah kapasitas',
    'checklist-beli-mesin-produksi-lokal',
    'demo-c-mesin-produksi',
    (
      SELECT id
      FROM forum.lajukan_groups
      WHERE category_id = 'demo-c-mesin-produksi'
      LIMIT 1
    ),
    '00000000-0000-0000-0000-000000000702',
    now() - interval '18 days',
    now() - interval '4 hours',
    1188,
    0,
    52,
    19,
    true,
    true,
    'open',
    ARRAY ['/images/hero/menu/mesin-01.png']
  ),
  (
    'demo-th-mocaf-sagu-sorgum',
    'Mocaf, sagu, dan sorgum: ide produk bakery lokal yang bisa dicoba',
    'mocaf-sagu-sorgum-ide-bakery-lokal',
    'demo-c-bahan-nusantara',
    (
      SELECT id
      FROM forum.lajukan_groups
      WHERE category_id = 'demo-c-bahan-nusantara'
      LIMIT 1
    ),
    '00000000-0000-0000-0000-000000000705',
    now() - interval '14 days',
    now() - interval '7 hours',
    986,
    0,
    44,
    17,
    false,
    false,
    'open',
    ARRAY ['/images/hero/menu/bahan-01.png']
  ),
  (
    'demo-th-rumput-laut-ntt',
    'Rumput laut NTT cocok diolah jadi apa selain agar-agar?',
    'rumput-laut-ntt-ide-produk-umkm',
    'demo-c-bahan-nusantara',
    (
      SELECT id
      FROM forum.lajukan_groups
      WHERE category_id = 'demo-c-bahan-nusantara'
      LIMIT 1
    ),
    '00000000-0000-0000-0000-000000000703',
    now() - interval '11 days',
    now() - interval '6 hours',
    801,
    0,
    31,
    11,
    false,
    false,
    'open',
    ARRAY ['/images/hero/menu/bahan-01.png']
  ),
  (
    'demo-th-kemitraan-jamu-modern',
    'Kemitraan jamu modern: apa saja yang harus dicek sebelum bayar paket?',
    'kemitraan-jamu-modern-checklist',
    'demo-c-peluang-usaha',
    (
      SELECT id
      FROM forum.lajukan_groups
      WHERE category_id = 'demo-c-peluang-usaha'
      LIMIT 1
    ),
    '00000000-0000-0000-0000-000000000708',
    now() - interval '9 days',
    now() - interval '5 hours',
    1326,
    0,
    57,
    23,
    true,
    false,
    'open',
    ARRAY ['/images/hero/menu/peluang-01.png']
  ),
  (
    'demo-th-legalitas-produk-lokal',
    'Urutan legalitas produk lokal: NIB, PIRT, halal, merek, atau BPOM dulu?',
    'urutan-legalitas-produk-lokal-umkm',
    'demo-c-operasional-umkm',
    (
      SELECT id
      FROM forum.lajukan_groups
      WHERE category_id = 'demo-c-operasional-umkm'
      LIMIT 1
    ),
    '00000000-0000-0000-0000-000000000706',
    now() - interval '7 days',
    now() - interval '3 hours',
    905,
    0,
    36,
    15,
    false,
    false,
    'open',
    ARRAY ['/images/hero/menu/jasa-01.png']
  ),
  (
    'demo-th-kios-vs-dapur-produksi',
    'Kapan lebih baik sewa kios kecil dan kapan cukup dapur produksi?',
    'sewa-kios-kecil-vs-dapur-produksi',
    'demo-c-operasional-umkm',
    (
      SELECT id
      FROM forum.lajukan_groups
      WHERE category_id = 'demo-c-operasional-umkm'
      LIMIT 1
    ),
    '00000000-0000-0000-0000-000000000707',
    now() - interval '5 days',
    now() - interval '90 minutes',
    714,
    0,
    27,
    8,
    false,
    false,
    'open',
    ARRAY ['/images/hero/menu/lokasi-01.png']
  ) ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
  slug = EXCLUDED.slug,
  category_id = EXCLUDED.category_id,
  group_id = EXCLUDED.group_id,
  author_id = EXCLUDED.author_id,
  views = EXCLUDED.views,
  like_count = EXCLUDED.like_count,
  bookmark_count = EXCLUDED.bookmark_count,
  is_pinned = EXCLUDED.is_pinned,
  is_solved = EXCLUDED.is_solved,
  status = EXCLUDED.status,
  image_urls = EXCLUDED.image_urls,
  last_activity_at = EXCLUDED.last_activity_at;

INSERT INTO forum.lajukan_forum_thread_tags (thread_id, tag_slug, position)
VALUES (
    'demo-th-supplier-bahan-indonesia',
    'kopi-indonesia',
    1
  ),
  (
    'demo-th-supplier-bahan-indonesia',
    'reseller-produk-lokal',
    2
  ),
  (
    'demo-th-checklist-mesin-lokal',
    'mesin-lokal',
    1
  ),
  (
    'demo-th-mocaf-sagu-sorgum',
    'mocaf',
    1
  ),
  (
    'demo-th-rumput-laut-ntt',
    'rumput-laut',
    1
  ),
  (
    'demo-th-kemitraan-jamu-modern',
    'kemitraan',
    1
  ),
  (
    'demo-th-kemitraan-jamu-modern',
    'reseller-produk-lokal',
    2
  ),
  (
    'demo-th-legalitas-produk-lokal',
    'legalitas-umkm',
    1
  ),
  (
    'demo-th-kios-vs-dapur-produksi',
    'legalitas-umkm',
    1
  ) ON CONFLICT (thread_id, tag_slug) DO UPDATE
SET position = EXCLUDED.position;

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
VALUES (
    'demo-post-supplier-root',
    'demo-th-supplier-bahan-indonesia',
    '00000000-0000-0000-0000-000000000709',
    'Saya mau mulai reseller produk lokal Indonesia. Menurut teman-teman, bahan atau produk mana yang stoknya paling stabil untuk pemula: kopi, sambal, snack singkong, mocaf, atau jamu botol?',
    now() - interval '20 days',
    now() - interval '20 days',
    17,
    NULL,
    false,
    '{"heart":12,"insightful":5}'::jsonb,
    ARRAY ['/images/hero/menu/bahan-01.png']
  ),
  (
    'demo-post-supplier-sari',
    'demo-th-supplier-bahan-indonesia',
    '00000000-0000-0000-0000-000000000701',
    'Kalau targetnya repeat order cepat, mulai dari kopi drip, kopi bubuk, dan sambal kemasan kecil. Minta supplier kasih COA batch sederhana, jadwal roasting atau produksi, dan minimum order yang bisa naik bertahap.',
    now() - interval '19 days 22 hours',
    now() - interval '19 days 22 hours',
    24,
    'demo-post-supplier-root',
    false,
    '{"heart":18,"insightful":6}'::jsonb,
    ARRAY []::text []
  ),
  (
    'demo-post-supplier-dewi',
    'demo-th-supplier-bahan-indonesia',
    '00000000-0000-0000-0000-000000000705',
    'Mocaf juga menarik untuk reseller B2B kecil karena pembelinya bisa bakery rumahan. Kuncinya edukasi resep, ukuran 1 kg, dan kemasan yang tahan lembap.',
    now() - interval '19 days 18 hours',
    now() - interval '19 days 18 hours',
    16,
    'demo-post-supplier-root',
    false,
    '{"heart":11,"insightful":5}'::jsonb,
    ARRAY []::text []
  ),
  (
    'demo-post-mesin-root',
    'demo-th-checklist-mesin-lokal',
    '00000000-0000-0000-0000-000000000702',
    'Sebelum beli mesin lokal, tulis dulu target produksi harian, daya listrik tersedia, ukuran ruang, bahan yang diolah, dan siapa operatornya. Mesin yang tepat itu yang mudah dirawat, bukan cuma yang paling besar.',
    now() - interval '18 days',
    now() - interval '18 days',
    32,
    NULL,
    true,
    '{"heart":21,"insightful":11}'::jsonb,
    ARRAY ['/images/hero/menu/mesin-01.png']
  ),
  (
    'demo-post-mesin-tio',
    'demo-th-checklist-mesin-lokal',
    '00000000-0000-0000-0000-000000000709',
    'Setuju. Saya pernah salah beli sealer kecil karena tidak hitung jumlah pouch per hari. Setelah ganti pedal sealer lokal, packing jadi jauh lebih cepat.',
    now() - interval '17 days 18 hours',
    now() - interval '17 days 18 hours',
    13,
    'demo-post-mesin-root',
    false,
    '{"heart":9,"insightful":4}'::jsonb,
    ARRAY []::text []
  ),
  (
    'demo-post-bakery-root',
    'demo-th-mocaf-sagu-sorgum',
    '00000000-0000-0000-0000-000000000705',
    'Mocaf cocok untuk cookies, brownies, dan kulit pie. Sagu bagus untuk snack renyah. Sorgum menarik untuk granola lokal. Mulai dari satu resep unggulan dulu agar kontrol stok tidak berat.',
    now() - interval '14 days',
    now() - interval '14 days',
    21,
    NULL,
    false,
    '{"heart":16,"insightful":5}'::jsonb,
    ARRAY ['/images/hero/menu/bahan-01.png']
  ),
  (
    'demo-post-rumput-laut-root',
    'demo-th-rumput-laut-ntt',
    '00000000-0000-0000-0000-000000000703',
    'Selain agar-agar, rumput laut bisa jadi minuman serat, keripik, masker natural, dan bahan campuran sabun. Yang perlu dijaga: kadar air, sortasi, aroma, dan ukuran potongan.',
    now() - interval '11 days',
    now() - interval '11 days',
    18,
    NULL,
    false,
    '{"heart":12,"insightful":6}'::jsonb,
    ARRAY ['/images/hero/menu/bahan-01.png']
  ),
  (
    'demo-post-jamu-root',
    'demo-th-kemitraan-jamu-modern',
    '00000000-0000-0000-0000-000000000708',
    'Untuk kemitraan jamu modern, cek legalitas produk, isi paket awal, bahan baku, SOP seduh atau simpan, materi promosi, pelatihan, dan apakah ada target belanja ulang yang masuk akal.',
    now() - interval '9 days',
    now() - interval '9 days',
    29,
    NULL,
    false,
    '{"heart":22,"insightful":7}'::jsonb,
    ARRAY ['/images/hero/menu/peluang-01.png']
  ),
  (
    'demo-post-jamu-tio',
    'demo-th-kemitraan-jamu-modern',
    '00000000-0000-0000-0000-000000000709',
    'Paling penting menurut saya ada repeat product dan konten edukasi. Kalau cuma paket booth tanpa stok repeat, reseller bingung lanjutnya.',
    now() - interval '8 days 18 hours',
    now() - interval '8 days 18 hours',
    14,
    'demo-post-jamu-root',
    false,
    '{"heart":10,"insightful":4}'::jsonb,
    ARRAY []::text []
  ),
  (
    'demo-post-legalitas-root',
    'demo-th-legalitas-produk-lokal',
    '00000000-0000-0000-0000-000000000706',
    'Urutan praktis untuk banyak UMKM: NIB dulu, lalu PIRT atau izin edar sesuai kategori produk, halal jika makanan/minuman, lalu merek. BPOM perlu dicek jika masuk kategori risiko lebih tinggi.',
    now() - interval '7 days',
    now() - interval '7 days',
    20,
    NULL,
    false,
    '{"heart":15,"insightful":5}'::jsonb,
    ARRAY []::text []
  ),
  (
    'demo-post-kios-root',
    'demo-th-kios-vs-dapur-produksi',
    '00000000-0000-0000-0000-000000000707',
    'Kalau penjualan masih dominan online, dapur produksi kecil lebih ringan. Sewa kios cocok saat produk butuh impulse buying, sampling, dan lokasi ramai yang jelas traffic-nya.',
    now() - interval '5 days',
    now() - interval '5 days',
    15,
    NULL,
    false,
    '{"heart":11,"insightful":4}'::jsonb,
    ARRAY ['/images/hero/menu/lokasi-01.png']
  ) ON CONFLICT (id) DO UPDATE
SET thread_id = EXCLUDED.thread_id,
  author_id = EXCLUDED.author_id,
  content = EXCLUDED.content,
  updated_at = now(),
  like_count = EXCLUDED.like_count,
  reply_to_post_id = EXCLUDED.reply_to_post_id,
  is_answer = EXCLUDED.is_answer,
  reactions = EXCLUDED.reactions,
  image_urls = EXCLUDED.image_urls;

UPDATE forum.lajukan_forum_threads t
SET reply_count = GREATEST(
    (
      SELECT COUNT(*)::integer
      FROM forum.lajukan_forum_posts p
      WHERE p.thread_id = t.id
    ) - 1,
    0
  ),
  last_activity_at = COALESCE(
    (
      SELECT MAX(p.created_at)
      FROM forum.lajukan_forum_posts p
      WHERE p.thread_id = t.id
    ),
    t.last_activity_at
  )
WHERE t.id LIKE 'demo-th-%';

UPDATE forum.lajukan_forum_categories c
SET thread_count = (
    SELECT COUNT(*)::integer
    FROM forum.lajukan_forum_threads t
    WHERE t.category_id = c.id
  ),
  post_count = (
    SELECT COUNT(*)::integer
    FROM forum.lajukan_forum_posts p
      JOIN forum.lajukan_forum_threads t ON t.id = p.thread_id
    WHERE t.category_id = c.id
  ),
  updated_at = now()
WHERE c.id LIKE 'demo-c-%';

UPDATE forum.lajukan_forum_tags tag
SET usage_count = COALESCE(stats.usage_count, 0)
FROM (
    SELECT tag_slug,
      COUNT(*)::integer AS usage_count
    FROM forum.lajukan_forum_thread_tags
    GROUP BY tag_slug
  ) stats
WHERE tag.slug = stats.tag_slug
  AND tag.id LIKE 'tag-demo-%';

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
VALUES (
    'demo-reel-mesin-sangrai-kopi-bandung',
    '00000000-0000-0000-0000-000000000702',
    'Bima Mesin',
    'Mesin sangrai kopi lokal untuk roastery kecil',
    'Kapasitas 5 kg per batch, cocok untuk kedai dan supplier kopi daerah yang ingin roasting sendiri.',
    'Mesin & Alat',
    'Mesin sangrai kopi lokal Bandung 5 kg',
    'Mulai Rp 32.500.000/unit',
    '/id/search?type=product&q=mesin%20usaha',
    '/images/hero/menu/mesin-01.png',
    '/images/hero/menu/mesin-01.png',
    1240,
    0,
    88,
    'emerald',
    'tool',
    '/images/hero/menu/mesin-01.png',
    'image',
    'Hitung kapasitas mesin dari target produksi harian, bukan dari ukuran terbesar.',
    'warm',
    'upload',
    'none',
    NULL,
    NULL,
    '{"seed_pack":"indonesia_demo_20260709","category":"equipment","city":"Bandung","local_made":true}'::jsonb,
    '',
    '',
    'Bima Mesin Bandung',
    'Bandung',
    NULL,
    '',
    'published',
    now() - interval '3 days',
    now() - interval '3 days',
    now()
  ),
  (
    'demo-reel-mocaf-garut-bakery',
    '00000000-0000-0000-0000-000000000705',
    'Dewi Mocaf',
    'Mocaf Garut untuk cookies dan brownies lokal',
    'Tepung mocaf bisa jadi bahan bakery yang lebih Indonesia banget, asal resep dan ukuran kemasannya jelas.',
    'Bahan Usaha',
    'Tepung mocaf Garut food grade',
    'Rp 18.500/kg',
    '/id/search?type=product&q=bahan%20usaha',
    '/images/hero/menu/bahan-01.png',
    '/images/hero/menu/bahan-01.png',
    1088,
    0,
    74,
    'amber',
    'ingredient',
    '/images/hero/menu/bahan-01.png',
    'image',
    'Produk lokal lebih mudah naik kelas saat resep dan cerita asal bahannya jelas.',
    'natural',
    'upload',
    'none',
    NULL,
    NULL,
    '{"seed_pack":"indonesia_demo_20260709","category":"supplies","city":"Garut","local_material":"singkong"}'::jsonb,
    '',
    '',
    'Dewi Mocaf Garut',
    'Garut',
    NULL,
    '',
    'published',
    now() - interval '2 days 20 hours',
    now() - interval '2 days 20 hours',
    now()
  ),
  (
    'demo-reel-rumput-laut-ntt',
    '00000000-0000-0000-0000-000000000703',
    'Naya Laut Timur',
    'Rumput laut NTT untuk minuman serat dan snack',
    'Bahan laut Indonesia bisa masuk ke minuman, snack, kosmetik natural, sampai produk wellness.',
    'Bahan Usaha',
    'Rumput laut kering NTT grade A',
    'Rp 42.000/kg',
    '/id/search?type=product&q=bahan%20usaha',
    '/images/hero/menu/bahan-01.png',
    '/images/hero/menu/bahan-01.png',
    934,
    0,
    59,
    'cyan',
    'ingredient',
    '/images/hero/menu/bahan-01.png',
    'image',
    'Kadar air, sortasi, dan aroma menentukan harga rumput laut.',
    'fresh',
    'upload',
    'none',
    NULL,
    NULL,
    '{"seed_pack":"indonesia_demo_20260709","category":"supplies","city":"Kupang","local_material":"rumput laut"}'::jsonb,
    '',
    '',
    'Naya Laut Timur',
    'Kupang',
    NULL,
    '',
    'published',
    now() - interval '2 days 12 hours',
    now() - interval '2 days 12 hours',
    now()
  ),
  (
    'demo-reel-kemasan-bambu-tasik',
    '00000000-0000-0000-0000-000000000704',
    'Raka Bambu',
    'Kemasan bambu bikin hampers lokal terasa premium',
    'Bambu Tasik bisa jadi tray, display, dan kemasan hadiah untuk kopi, jamu, cokelat, dan snack lokal.',
    'Bahan Usaha',
    'Kemasan bambu custom UMKM',
    'Mulai Rp 9.500/pcs',
    '/id/search?type=product&q=bahan%20usaha',
    '/images/hero/menu/bahan-01.png',
    '/images/hero/menu/bahan-01.png',
    812,
    0,
    46,
    'lime',
    'packaging',
    '/images/hero/menu/bahan-01.png',
    'image',
    'Kemasan natural bekerja paling bagus saat ukuran produk dan labelnya konsisten.',
    'warm',
    'upload',
    'none',
    NULL,
    NULL,
    '{"seed_pack":"indonesia_demo_20260709","category":"supplies","city":"Tasikmalaya","local_material":"bambu"}'::jsonb,
    '',
    '',
    'Raka Bambu Pack',
    'Tasikmalaya',
    NULL,
    '',
    'published',
    now() - interval '2 days 4 hours',
    now() - interval '2 days 4 hours',
    now()
  ),
  (
    'demo-reel-jamu-modern-kemitraan',
    '00000000-0000-0000-0000-000000000708',
    'Hana Jamu',
    'Kemitraan jamu modern yang mudah dijalankan',
    'Paket awal harus jelas: bahan, SOP, materi promosi, margin, dan support repeat order.',
    'Peluang Usaha',
    'Kemitraan gerai jamu modern Solo',
    'Mulai Rp 18.000.000',
    '/id/search?q=peluang%20usaha%20franchise%20kemitraan%20reseller',
    '/images/hero/menu/peluang-01.png',
    '/images/hero/menu/peluang-01.png',
    1422,
    0,
    112,
    'orange',
    'business',
    '/images/hero/menu/peluang-01.png',
    'image',
    'Jangan cuma lihat booth, cek repeat product dan dukungan operasionalnya.',
    'pop',
    'upload',
    'none',
    NULL,
    NULL,
    '{"seed_pack":"indonesia_demo_20260709","category":"opportunity","city":"Solo","model":"kemitraan"}'::jsonb,
    '',
    '',
    'Hana Jamu Modern',
    'Solo',
    NULL,
    '',
    'published',
    now() - interval '1 day 20 hours',
    now() - interval '1 day 20 hours',
    now()
  ),
  (
    'demo-reel-kakao-sulawesi-craft',
    '00000000-0000-0000-0000-000000000710',
    'Made Kakao',
    'Kakao Sulawesi untuk cokelat craft Indonesia',
    'Batch kecil kakao fermentasi bisa jadi produk premium kalau profil rasa, kadar air, dan cerita petaninya kuat.',
    'Bahan Usaha',
    'Kakao fermentasi Sulawesi',
    'Rp 68.000/kg',
    '/id/search?type=product&q=bahan%20usaha',
    '/images/hero/menu/bahan-01.png',
    '/images/hero/menu/bahan-01.png',
    876,
    0,
    53,
    'amber',
    'ingredient',
    '/images/hero/menu/bahan-01.png',
    'image',
    'Bahan premium perlu cerita asal, konsistensi batch, dan sampel kecil.',
    'cinema',
    'upload',
    'none',
    NULL,
    NULL,
    '{"seed_pack":"indonesia_demo_20260709","category":"supplies","city":"Makassar","local_material":"kakao"}'::jsonb,
    '',
    '',
    'Made Kakao Sulawesi',
    'Makassar',
    NULL,
    '',
    'published',
    now() - interval '1 day 12 hours',
    now() - interval '1 day 12 hours',
    now()
  ),
  (
    'demo-reel-jasa-foto-produk-umkm',
    '00000000-0000-0000-0000-000000000706',
    'Arif Digital',
    'Foto produk sederhana yang bikin katalog lebih dipercaya',
    'Cukup siapkan background bersih, detail ukuran, foto kemasan, dan video pendek proses packing.',
    'Cari Jasa',
    'Foto produk dan admin marketplace UMKM',
    'Mulai Rp 200.000/paket',
    '/id/search?type=service&q=jasa',
    '/images/hero/menu/jasa-01.png',
    '/images/hero/menu/jasa-01.png',
    745,
    0,
    41,
    'blue',
    'service',
    '/images/hero/menu/jasa-01.png',
    'image',
    'Foto yang jujur dan rapi sering lebih menjual daripada edit berlebihan.',
    'natural',
    'upload',
    'none',
    NULL,
    NULL,
    '{"seed_pack":"indonesia_demo_20260709","category":"service","city":"Surabaya","service":"foto produk"}'::jsonb,
    '',
    '',
    'Arif Digital UMKM',
    'Surabaya',
    NULL,
    '',
    'published',
    now() - interval '21 hours',
    now() - interval '21 hours',
    now()
  ),
  (
    'demo-reel-kios-gejayan',
    '00000000-0000-0000-0000-000000000707',
    'Lestari Booth',
    'Kios kecil dekat kampus: cocok untuk produk apa?',
    'Lokasi ramai belum tentu cocok untuk semua usaha. Cocokkan jam ramai, harga sewa, dan produk impulse buying.',
    'Tempat Usaha',
    'Kios kecil Gejayan untuk kopi dan snack',
    'Rp 3.500.000/bulan',
    '/id/search?type=property&q=tempat%20usaha',
    '/images/hero/menu/lokasi-01.png',
    '/images/hero/menu/lokasi-01.png',
    689,
    0,
    36,
    'violet',
    'location',
    '/images/hero/menu/lokasi-01.png',
    'image',
    'Sewa tempat harus dihitung dari traffic, jam ramai, dan margin produk.',
    'fresh',
    'upload',
    'none',
    NULL,
    NULL,
    '{"seed_pack":"indonesia_demo_20260709","category":"property","city":"Yogyakarta","location_type":"kios"}'::jsonb,
    '',
    '',
    'Lestari Booth',
    'Yogyakarta',
    NULL,
    '',
    'published',
    now() - interval '18 hours',
    now() - interval '18 hours',
    now()
  ) ON CONFLICT (id) DO UPDATE
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
  metadata = reel.lajukan_reels.metadata || EXCLUDED.metadata,
  store_id = EXCLUDED.store_id,
  store_slug = EXCLUDED.store_slug,
  store_name = EXCLUDED.store_name,
  store_city = EXCLUDED.store_city,
  store_phone = EXCLUDED.store_phone,
  storefront_path = EXCLUDED.storefront_path,
  status = EXCLUDED.status,
  published_at = EXCLUDED.published_at,
  updated_at = now();

INSERT INTO reel.lajukan_reel_comments (
    id,
    reel_id,
    parent_comment_id,
    author_user_id,
    author_name,
    author_avatar_url,
    body,
    status,
    reply_count,
    created_at,
    updated_at
  )
VALUES (
    'demo-rc-mesin-1',
    'demo-reel-mesin-sangrai-kopi-bandung',
    NULL,
    '00000000-0000-0000-0000-000000000701',
    'Sari Gayo',
    '/default-avatar.svg',
    'Kalau untuk kopi Gayo 5 kg per batch sudah enak buat sample roast dan produksi kedai kecil.',
    'published',
    1,
    now() - interval '2 days 18 hours',
    now()
  ),
  (
    'demo-rc-mesin-2',
    'demo-reel-mesin-sangrai-kopi-bandung',
    'demo-rc-mesin-1',
    '00000000-0000-0000-0000-000000000702',
    'Bima Mesin',
    '/default-avatar.svg',
    'Betul, nanti kalau sudah stabil baru naik ke kapasitas 10 kg.',
    'published',
    0,
    now() - interval '2 days 16 hours',
    now()
  ),
  (
    'demo-rc-mocaf-1',
    'demo-reel-mocaf-garut-bakery',
    NULL,
    '00000000-0000-0000-0000-000000000709',
    'Tio Reseller',
    '/default-avatar.svg',
    'Mocaf ukuran 1 kg menarik buat reseller bakery rumahan.',
    'published',
    0,
    now() - interval '2 days 10 hours',
    now()
  ),
  (
    'demo-rc-rumputlaut-1',
    'demo-reel-rumput-laut-ntt',
    NULL,
    '00000000-0000-0000-0000-000000000705',
    'Dewi Mocaf',
    '/default-avatar.svg',
    'Ini bisa disandingkan dengan minuman herbal lokal, konsepnya bagus.',
    'published',
    0,
    now() - interval '2 days',
    now()
  ),
  (
    'demo-rc-bambu-1',
    'demo-reel-kemasan-bambu-tasik',
    NULL,
    '00000000-0000-0000-0000-000000000708',
    'Hana Jamu',
    '/default-avatar.svg',
    'Tray bambu seperti ini cocok buat paket jamu kering dan rempah.',
    'published',
    0,
    now() - interval '1 day 18 hours',
    now()
  ),
  (
    'demo-rc-jamu-1',
    'demo-reel-jamu-modern-kemitraan',
    NULL,
    '00000000-0000-0000-0000-000000000709',
    'Tio Reseller',
    '/default-avatar.svg',
    'Checklist repeat product ini penting. Banyak reseller butuh stok lanjutan yang gampang dijual.',
    'published',
    1,
    now() - interval '1 day 12 hours',
    now()
  ),
  (
    'demo-rc-jamu-2',
    'demo-reel-jamu-modern-kemitraan',
    'demo-rc-jamu-1',
    '00000000-0000-0000-0000-000000000708',
    'Hana Jamu',
    '/default-avatar.svg',
    'Iya, paket awal harus jadi pintu masuk, bukan transaksi sekali saja.',
    'published',
    0,
    now() - interval '1 day 10 hours',
    now()
  ),
  (
    'demo-rc-kakao-1',
    'demo-reel-kakao-sulawesi-craft',
    NULL,
    '00000000-0000-0000-0000-000000000701',
    'Sari Gayo',
    '/default-avatar.svg',
    'Kakao dan kopi lokal sama-sama butuh story batch. Ini bisa jadi bundle menarik.',
    'published',
    0,
    now() - interval '1 day 4 hours',
    now()
  ),
  (
    'demo-rc-jasa-1',
    'demo-reel-jasa-foto-produk-umkm',
    NULL,
    '00000000-0000-0000-0000-000000000704',
    'Raka Bambu',
    '/default-avatar.svg',
    'Foto produk natural begini cocok untuk katalog kemasan bambu.',
    'published',
    0,
    now() - interval '16 hours',
    now()
  ),
  (
    'demo-rc-kios-1',
    'demo-reel-kios-gejayan',
    NULL,
    '00000000-0000-0000-0000-000000000708',
    'Hana Jamu',
    '/default-avatar.svg',
    'Untuk jamu dingin, lokasi kampus bagus kalau jam operasionalnya ikut sore sampai malam.',
    'published',
    0,
    now() - interval '12 hours',
    now()
  ) ON CONFLICT (id) DO UPDATE
SET reel_id = EXCLUDED.reel_id,
  parent_comment_id = EXCLUDED.parent_comment_id,
  author_user_id = EXCLUDED.author_user_id,
  author_name = EXCLUDED.author_name,
  author_avatar_url = EXCLUDED.author_avatar_url,
  body = EXCLUDED.body,
  status = EXCLUDED.status,
  reply_count = EXCLUDED.reply_count,
  updated_at = now();

INSERT INTO forum.lajukan_reel_user_actions (
    id,
    reel_id,
    actor_user_id,
    target_user_id,
    action,
    created_at,
    updated_at
  )
VALUES (
    'demo-rua-like-mesin-sari',
    'demo-reel-mesin-sangrai-kopi-bandung',
    '00000000-0000-0000-0000-000000000701',
    '00000000-0000-0000-0000-000000000702',
    'like',
    now() - interval '2 days 18 hours',
    now()
  ),
  (
    'demo-rua-save-mesin-tio',
    'demo-reel-mesin-sangrai-kopi-bandung',
    '00000000-0000-0000-0000-000000000709',
    '00000000-0000-0000-0000-000000000702',
    'save',
    now() - interval '2 days 14 hours',
    now()
  ),
  (
    'demo-rua-like-mocaf-tio',
    'demo-reel-mocaf-garut-bakery',
    '00000000-0000-0000-0000-000000000709',
    '00000000-0000-0000-0000-000000000705',
    'like',
    now() - interval '2 days 8 hours',
    now()
  ),
  (
    'demo-rua-like-rumput-dewi',
    'demo-reel-rumput-laut-ntt',
    '00000000-0000-0000-0000-000000000705',
    '00000000-0000-0000-0000-000000000703',
    'like',
    now() - interval '2 days',
    now()
  ),
  (
    'demo-rua-like-jamu-tio',
    'demo-reel-jamu-modern-kemitraan',
    '00000000-0000-0000-0000-000000000709',
    '00000000-0000-0000-0000-000000000708',
    'like',
    now() - interval '1 day 12 hours',
    now()
  ),
  (
    'demo-rua-save-jamu-sari',
    'demo-reel-jamu-modern-kemitraan',
    '00000000-0000-0000-0000-000000000701',
    '00000000-0000-0000-0000-000000000708',
    'save',
    now() - interval '1 day 6 hours',
    now()
  ),
  (
    'demo-rua-like-kakao-sari',
    'demo-reel-kakao-sulawesi-craft',
    '00000000-0000-0000-0000-000000000701',
    '00000000-0000-0000-0000-000000000710',
    'like',
    now() - interval '1 day 3 hours',
    now()
  ),
  (
    'demo-rua-like-kios-hana',
    'demo-reel-kios-gejayan',
    '00000000-0000-0000-0000-000000000708',
    '00000000-0000-0000-0000-000000000707',
    'like',
    now() - interval '11 hours',
    now()
  ) ON CONFLICT (reel_id, actor_user_id, action) DO UPDATE
SET target_user_id = EXCLUDED.target_user_id,
  updated_at = now();

UPDATE reel.lajukan_reels r
SET comments_count = (
    SELECT COUNT(*)::bigint
    FROM reel.lajukan_reel_comments c
    WHERE c.reel_id = r.id
      AND c.status = 'published'
  ),
  likes_count = GREATEST(
    r.likes_count,
    (
      SELECT COUNT(*)::bigint
      FROM forum.lajukan_reel_user_actions a
      WHERE a.reel_id = r.id
        AND a.action = 'like'
    )
  ),
  updated_at = now()
WHERE r.metadata ->> 'seed_pack' = 'indonesia_demo_20260709';
