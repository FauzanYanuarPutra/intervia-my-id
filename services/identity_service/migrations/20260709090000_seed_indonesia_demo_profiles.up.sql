-- Indonesia-first demo profiles for local development and product demos.
-- All names, businesses, and emails are fictional.
-- Password hash matches the existing demo seed convention: Test123!@#

INSERT INTO core.users (
    id,
    email,
    password_hash,
    email_verified,
    status,
    is_active,
    created_at,
    updated_at
)
VALUES
  ('00000000-0000-0000-0000-000000000701', 'sari.gayo@lajukan.demo', '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068', TRUE, 'active', TRUE, NOW() - INTERVAL '18 days', NOW()),
  ('00000000-0000-0000-0000-000000000702', 'bima.mesin@lajukan.demo', '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068', TRUE, 'active', TRUE, NOW() - INTERVAL '17 days', NOW()),
  ('00000000-0000-0000-0000-000000000703', 'naya.laut@lajukan.demo', '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068', TRUE, 'active', TRUE, NOW() - INTERVAL '16 days', NOW()),
  ('00000000-0000-0000-0000-000000000704', 'raka.bambu@lajukan.demo', '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068', TRUE, 'active', TRUE, NOW() - INTERVAL '15 days', NOW()),
  ('00000000-0000-0000-0000-000000000705', 'dewi.mocaf@lajukan.demo', '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068', TRUE, 'active', TRUE, NOW() - INTERVAL '14 days', NOW()),
  ('00000000-0000-0000-0000-000000000706', 'arif.digital@lajukan.demo', '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068', TRUE, 'active', TRUE, NOW() - INTERVAL '13 days', NOW()),
  ('00000000-0000-0000-0000-000000000707', 'lestari.booth@lajukan.demo', '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068', TRUE, 'active', TRUE, NOW() - INTERVAL '12 days', NOW()),
  ('00000000-0000-0000-0000-000000000708', 'hana.jamu@lajukan.demo', '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068', TRUE, 'active', TRUE, NOW() - INTERVAL '11 days', NOW()),
  ('00000000-0000-0000-0000-000000000709', 'tio.reseller@lajukan.demo', '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068', TRUE, 'active', TRUE, NOW() - INTERVAL '10 days', NOW()),
  ('00000000-0000-0000-0000-000000000710', 'made.kakao@lajukan.demo', '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068', TRUE, 'active', TRUE, NOW() - INTERVAL '9 days', NOW())
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    email_verified = EXCLUDED.email_verified,
    status = EXCLUDED.status,
    is_active = EXCLUDED.is_active,
    failed_login_attempts = 0,
    lockout_expires_at = NULL,
    deleted_at = NULL,
    updated_at = NOW();

INSERT INTO core.user_profiles (
    user_id,
    full_name,
    bio,
    picture,
    username,
    location,
    metadata,
    updated_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000701',
    'Sari Gayo Mandiri',
    'Kolektif kopi Gayo, rempah Aceh, dan edukasi roasting untuk kedai lokal.',
    '/default-avatar.svg',
    'sari_gayo',
    'Banda Aceh, Aceh',
    '{"seed_pack":"indonesia_demo_20260709","avatar_url":"/default-avatar.svg","roles":["provider","supplier","umkm_owner"],"profile_level":"usaha","provider_profile":{"headline":"Supplier kopi arabika Gayo, cascara, dan gula aren untuk kedai Indonesia","skills":["kopi gayo","green bean","roasting kecil","cascara","gula aren"],"service_coverage":["Aceh","Medan","Jakarta","Bandung"],"response_time":"< 1 jam"}}'::jsonb,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000702',
    'Bima Mesin Nusantara',
    'Perakit alat produksi skala UMKM: sangrai kopi, sealer, pengering rempah, dan mesin parut.',
    '/default-avatar.svg',
    'bima_mesin',
    'Bandung, Jawa Barat',
    '{"seed_pack":"indonesia_demo_20260709","avatar_url":"/default-avatar.svg","roles":["provider","manufacturer","supplier"],"profile_level":"usaha","provider_profile":{"headline":"Mesin produksi UMKM rakitan lokal, fokus perawatan mudah dan suku cadang dekat","skills":["mesin sangrai","sealer pedal","pengering rempah","vacuum fryer","training operator"],"service_coverage":["Jawa Barat","Jawa Tengah","Jabodetabek"],"response_time":"< 45 menit"}}'::jsonb,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000703',
    'Naya Laut Timur',
    'Pemasok rumput laut, garam, ikan asap, dan bahan pesisir dari NTT dan Sulawesi.',
    '/default-avatar.svg',
    'naya_laut',
    'Kupang, Nusa Tenggara Timur',
    '{"seed_pack":"indonesia_demo_20260709","avatar_url":"/default-avatar.svg","roles":["provider","supplier","cooperative"],"profile_level":"usaha","provider_profile":{"headline":"Bahan pesisir Indonesia timur untuk pangan, kosmetik, dan produk olahan","skills":["rumput laut","garam lokal","ikan asap","quality sorting","cold chain"],"service_coverage":["Kupang","Makassar","Surabaya","Denpasar"],"response_time":"< 2 jam"}}'::jsonb,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000704',
    'Raka Bambu Pack',
    'Kemasan bambu, anyaman, label kertas, dan display produk untuk brand lokal.',
    '/default-avatar.svg',
    'raka_bambu',
    'Tasikmalaya, Jawa Barat',
    '{"seed_pack":"indonesia_demo_20260709","avatar_url":"/default-avatar.svg","roles":["provider","packaging","craft"],"profile_level":"usaha","provider_profile":{"headline":"Kemasan dan display berbahan bambu, kertas, dan serat alam untuk produk lokal","skills":["kemasan bambu","display retail","label kraft","souvenir korporat"],"service_coverage":["Tasikmalaya","Bandung","Jakarta"],"response_time":"< 1 jam"}}'::jsonb,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000705',
    'Dewi Mocaf Garut',
    'Produsen tepung mocaf, singkong olahan, dan bahan bakery bebas gluten skala UMKM.',
    '/default-avatar.svg',
    'dewi_mocaf',
    'Garut, Jawa Barat',
    '{"seed_pack":"indonesia_demo_20260709","avatar_url":"/default-avatar.svg","roles":["provider","supplier","umkm_owner"],"profile_level":"usaha","provider_profile":{"headline":"Tepung mocaf dan bahan bakery lokal dari singkong Garut","skills":["mocaf","tepung singkong","bakery lokal","supplier bahan kue"],"service_coverage":["Garut","Bandung","Jakarta","Yogyakarta"],"response_time":"< 1 jam"}}'::jsonb,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000706',
    'Arif Digital Warung',
    'Jasa foto produk, katalog marketplace, admin toko, dan setup live commerce untuk UMKM.',
    '/default-avatar.svg',
    'arif_digital',
    'Surabaya, Jawa Timur',
    '{"seed_pack":"indonesia_demo_20260709","avatar_url":"/default-avatar.svg","roles":["provider","service","freelancer"],"profile_level":"senior","freelancer_profile":{"professional_title":"UMKM digital operator","skills":["foto produk","admin marketplace","live commerce","katalog toko","konten pendek"],"rating":"4.9","completed_jobs":"146","hourly_rate":"175000"}}'::jsonb,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000707',
    'Lestari Booth Lokal',
    'Operator kios, booth kampus, dan pop-up market untuk brand makanan, craft, dan fashion.',
    '/default-avatar.svg',
    'lestari_booth',
    'Yogyakarta, DI Yogyakarta',
    '{"seed_pack":"indonesia_demo_20260709","avatar_url":"/default-avatar.svg","roles":["provider","space_operator"],"profile_level":"usaha","provider_profile":{"headline":"Tempat usaha kecil, booth, dan pop-up market untuk brand lokal","skills":["booth bazaar","kios kampus","tenant event","market curator"],"service_coverage":["Yogyakarta","Solo","Semarang","Bandung"],"response_time":"< 2 jam"}}'::jsonb,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000708',
    'Hana Jamu Kemitraan',
    'Program kemitraan jamu modern, minuman rempah, dan reseller bahan sehat nusantara.',
    '/default-avatar.svg',
    'hana_jamu',
    'Solo, Jawa Tengah',
    '{"seed_pack":"indonesia_demo_20260709","avatar_url":"/default-avatar.svg","roles":["provider","opportunity","umkm_owner"],"profile_level":"usaha","provider_profile":{"headline":"Kemitraan jamu modern dan minuman rempah siap jual","skills":["jamu modern","kemitraan booth","training resep","reseller kit"],"service_coverage":["Jawa","Bali","Sumatera"],"response_time":"< 1 jam"}}'::jsonb,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000709',
    'Tio Reseller Nusantara',
    'Buyer dan reseller aktif yang mencari produk lokal cepat putar untuk channel online dan event.',
    '/default-avatar.svg',
    'tio_reseller',
    'Jakarta, DKI Jakarta',
    '{"seed_pack":"indonesia_demo_20260709","avatar_url":"/default-avatar.svg","roles":["buyer","reseller"],"profile_level":"usaha","buyer_profile":{"intent":"Cari produk lokal cepat putar: sambal, kopi, jamu, snack, dan craft premium","preferred_location":"Jabodetabek dan pengiriman nasional","budget_min":3000000,"budget_max":25000000,"work_mode":"ongoing"}}'::jsonb,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000710',
    'Made Kakao Sulawesi',
    'Supplier kakao fermentasi, nibs, dan produk cokelat craft dari Sulawesi.',
    '/default-avatar.svg',
    'made_kakao',
    'Makassar, Sulawesi Selatan',
    '{"seed_pack":"indonesia_demo_20260709","avatar_url":"/default-avatar.svg","roles":["provider","supplier","cooperative"],"profile_level":"usaha","provider_profile":{"headline":"Kakao fermentasi Sulawesi untuk cokelat craft, bakery, dan minuman","skills":["kakao fermentasi","cocoa nibs","cokelat craft","quality grading"],"service_coverage":["Makassar","Surabaya","Jakarta","Bali"],"response_time":"< 2 jam"}}'::jsonb,
    NOW()
  )
ON CONFLICT (user_id) DO UPDATE
SET full_name = EXCLUDED.full_name,
    bio = EXCLUDED.bio,
    picture = EXCLUDED.picture,
    username = EXCLUDED.username,
    location = EXCLUDED.location,
    metadata = COALESCE(core.user_profiles.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = NOW();
