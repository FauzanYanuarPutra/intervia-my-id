-- Curated marketplace discover profiles for realistic search results.
-- Password for all seeded accounts: "Test123!@#"

INSERT INTO users (
    id, email, password_hash,
    email_verified, status, created_at, updated_at
) VALUES
(
    '00000000-0000-0000-0000-000000000511',
    'gudang.rasa@lajukan.com',
    '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068',
    TRUE,
    'active',
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '8 days'
),
(
    '00000000-0000-0000-0000-000000000512',
    'kembang.kulit@lajukan.com',
    '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068',
    TRUE,
    'active',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days'
),
(
    '00000000-0000-0000-0000-000000000513',
    'ruang.pendingin@lajukan.com',
    '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068',
    TRUE,
    'active',
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '6 days'
),
(
    '00000000-0000-0000-0000-000000000514',
    'pasar.akhirpekan@lajukan.com',
    '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068',
    TRUE,
    'active',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
),
(
    '00000000-0000-0000-0000-000000000515',
    'panggung.live@lajukan.com',
    '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068',
    TRUE,
    'active',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days'
),
(
    '00000000-0000-0000-0000-000000000516',
    'kedai.sore@lajukan.com',
    '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068',
    TRUE,
    'active',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
),
(
    '00000000-0000-0000-0000-000000000517',
    'butik.selaras@lajukan.com',
    '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068',
    TRUE,
    'active',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
),
(
    '00000000-0000-0000-0000-000000000518',
    'dapur.kawan@lajukan.com',
    '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068',
    TRUE,
    'active',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
)
ON CONFLICT (email) DO UPDATE
SET
    password_hash = EXCLUDED.password_hash,
    email_verified = EXCLUDED.email_verified,
    status = EXCLUDED.status,
    failed_login_attempts = 0,
    lockout_expires_at = NULL,
    deleted_at = NULL,
    updated_at = NOW();

INSERT INTO user_profiles (user_id, full_name, bio, username, location, metadata, updated_at)
VALUES
(
    '00000000-0000-0000-0000-000000000511',
    'Gudang Rasa Nusantara',
    'Distributor camilan, bumbu, dan kebutuhan toko dengan pengiriman rutin Jabodetabek.',
    'gudang_rasa',
    'Bekasi',
    '{
      "avatar_url": "https://picsum.photos/seed/lajukan-gudang-rasa/480/480",
      "roles": ["provider", "supplier", "umkm_owner"],
      "profile_level": "usaha",
      "provider_profile": {
        "headline": "Supplier sembako, snack grosir, dan bumbu dapur untuk warung serta outlet F&B",
        "skills": ["supplier sembako", "snack grosir", "private label", "kirim harian"],
        "service_coverage": ["Bekasi", "Jakarta", "Depok"],
        "work_mode": "gudang + pengiriman",
        "response_time": "< 30 menit"
      }
    }'::jsonb,
    NOW()
),
(
    '00000000-0000-0000-0000-000000000512',
    'Kembang Kulit Studio',
    'Partner packaging dan visual brand untuk skincare, hampers, dan produk retail kecil.',
    'kembang_kulit',
    'Bandung',
    '{
      "avatar_url": "https://picsum.photos/seed/lajukan-kembang-kulit/480/480",
      "roles": ["provider", "brand_support", "umkm_owner"],
      "profile_level": "usaha",
      "provider_profile": {
        "headline": "Jasa kemasan pouch, stiker, dan mockup katalog untuk brand kecil dan reseller",
        "skills": ["kemasan produk", "stiker label", "mockup katalog", "design handoff"],
        "service_coverage": ["Bandung", "Jakarta", "remote"],
        "work_mode": "hybrid",
        "response_time": "< 1 jam"
      }
    }'::jsonb,
    NOW()
),
(
    '00000000-0000-0000-0000-000000000513',
    'Ruang Pendingin Pro',
    'Penyedia alat pendingin untuk event, toko frozen food, dan booth kuliner.',
    'ruang_pendingin',
    'Denpasar',
    '{
      "avatar_url": "https://picsum.photos/seed/lajukan-ruang-pendingin/480/480",
      "roles": ["provider", "rental_partner"],
      "profile_level": "usaha",
      "provider_profile": {
        "headline": "Sewa freezer, chiller showcase, dan peralatan dingin untuk event sampai outlet tetap",
        "skills": ["freezer display", "chiller showcase", "setup event", "maintenance ringan"],
        "service_coverage": ["Denpasar", "Badung", "Gianyar"],
        "work_mode": "onsite",
        "response_time": "< 45 menit"
      }
    }'::jsonb,
    NOW()
),
(
    '00000000-0000-0000-0000-000000000514',
    'Pasar Akhir Pekan',
    'Operator booth pop-up dan tenant event untuk brand lokal, komunitas, dan kampus.',
    'pasar_akhirpekan',
    'Jakarta',
    '{
      "avatar_url": "https://picsum.photos/seed/lajukan-pasar-akhirpekan/480/480",
      "roles": ["provider", "space_operator"],
      "profile_level": "usaha",
      "provider_profile": {
        "headline": "Booth bazaar, titik pop-up, dan area tenant untuk brand F&B, craft, dan beauty",
        "skills": ["tenant placement", "event booth", "weekend market", "mall activation"],
        "service_coverage": ["Jakarta", "Bandung", "Tangerang"],
        "work_mode": "onsite",
        "response_time": "< 2 jam"
      }
    }'::jsonb,
    NOW()
),
(
    '00000000-0000-0000-0000-000000000515',
    'Panggung Live Creator',
    'Live host dan content creator untuk brand beauty, fashion, dan snack lokal.',
    'panggung_live',
    'Surabaya',
    '{
      "avatar_url": "https://picsum.photos/seed/lajukan-panggung-live/480/480",
      "roles": ["freelancer", "creator", "provider"],
      "profile_level": "senior",
      "freelancer_profile": {
        "professional_title": "Live host & content creator",
        "tagline": "Biasa handle live commerce beauty, F&B, dan fashion lokal",
        "skills": ["live host", "short video", "script selling", "product demo"],
        "level": "senior",
        "rating": "4.9",
        "completed_jobs": "128",
        "hourly_rate": "175000"
      }
    }'::jsonb,
    NOW()
),
(
    '00000000-0000-0000-0000-000000000516',
    'Kedai Sore Group',
    'Operator beberapa kedai minuman yang sedang cari supplier stabil dan support operasional.',
    'kedai_sore',
    'Yogyakarta',
    '{
      "avatar_url": "https://picsum.photos/seed/lajukan-kedai-sore/480/480",
      "roles": ["buyer", "umkm_owner"],
      "profile_level": "usaha",
      "buyer_profile": {
        "intent": "Cari supplier bubuk minuman, cup, dan chiller untuk 6 titik jual",
        "preferred_sector": "food_supply",
        "preferred_sub_sector": "minuman & packaging",
        "preferred_location": "Yogyakarta dan Solo",
        "budget_min": 3000000,
        "budget_max": 18000000,
        "work_mode": "ongoing"
      }
    }'::jsonb,
    NOW()
),
(
    '00000000-0000-0000-0000-000000000517',
    'Butik Selaras',
    'Brand modest fashion yang rutin cari booth event, live host, dan vendor packaging.',
    'butik_selaras',
    'Bandung',
    '{
      "avatar_url": "https://picsum.photos/seed/lajukan-butik-selaras/480/480",
      "roles": ["buyer", "brand_owner"],
      "profile_level": "usaha",
      "buyer_profile": {
        "intent": "Butuh booth bazaar, host live, dan vendor kemasan untuk launch koleksi baru",
        "preferred_sector": "fashion_retail",
        "preferred_sub_sector": "event & creator support",
        "preferred_location": "Bandung dan Jakarta",
        "budget_min": 5000000,
        "budget_max": 25000000,
        "work_mode": "campaign"
      }
    }'::jsonb,
    NOW()
),
(
    '00000000-0000-0000-0000-000000000518',
    'Dapur Kawan Tumbuh',
    'Cloud kitchen yang sedang ekspansi ke area kantor dan kampus dengan kebutuhan supplier harian.',
    'dapur_kawan',
    'Jakarta',
    '{
      "avatar_url": "https://picsum.photos/seed/lajukan-dapur-kawan/480/480",
      "roles": ["buyer", "umkm_owner"],
      "profile_level": "usaha",
      "buyer_profile": {
        "intent": "Cari supplier ayam marinated, booth kampus, dan admin marketplace shift sore",
        "preferred_sector": "food_operations",
        "preferred_sub_sector": "supplier + operasional harian",
        "preferred_location": "Jakarta, Bekasi, Depok",
        "budget_min": 4000000,
        "budget_max": 22000000,
        "work_mode": "ongoing"
      }
    }'::jsonb,
    NOW()
)
ON CONFLICT (user_id) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  bio = EXCLUDED.bio,
  username = EXCLUDED.username,
  location = EXCLUDED.location,
  metadata = COALESCE(user_profiles.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = EXCLUDED.updated_at;

SELECT 1;
