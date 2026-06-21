SET search_path = forum,
  reel,
  public,
  events;
CREATE TABLE IF NOT EXISTS forum.lajukan_forum_categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'forum',
  color text NOT NULL DEFAULT '#0ea5e9',
  parent_id text NULL,
  position integer NOT NULL DEFAULT 0,
  thread_count integer NOT NULL DEFAULT 0,
  post_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lajukan_forum_categories_position_idx ON forum.lajukan_forum_categories (position, name);
CREATE TABLE IF NOT EXISTS lajukan_forum_users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  name text NOT NULL,
  avatar_url text NOT NULL DEFAULT '/default-avatar.svg',
  title text NOT NULL DEFAULT 'Community Member',
  reputation integer NOT NULL DEFAULT 0,
  base_reputation integer NOT NULL DEFAULT 0,
  badges text [] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  identity_synced_at timestamptz NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lajukan_forum_users_search_idx ON lajukan_forum_users USING gin (
  to_tsvector(
    'simple',
    coalesce(username, '') || ' ' || coalesce(name, '') || ' ' || coalesce(title, '')
  )
);
CREATE INDEX IF NOT EXISTS lajukan_forum_users_reputation_idx ON lajukan_forum_users (reputation DESC, updated_at DESC);
CREATE TABLE IF NOT EXISTS lajukan_forum_tags (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#64748b',
  usage_count integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS lajukan_forum_tags_usage_idx ON lajukan_forum_tags (usage_count DESC, name);
CREATE TABLE IF NOT EXISTS lajukan_forum_threads (
  id text PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL,
  category_id text NOT NULL REFERENCES lajukan_forum_categories(id),
  author_id text NOT NULL REFERENCES lajukan_forum_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  views integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  bookmark_count integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  is_solved boolean NOT NULL DEFAULT false,
  solution_post_id text NULL,
  status text NOT NULL DEFAULT 'open',
  image_urls text [] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS lajukan_forum_threads_feed_idx ON lajukan_forum_threads (last_activity_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS lajukan_forum_threads_category_idx ON lajukan_forum_threads (category_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS lajukan_forum_threads_search_idx ON lajukan_forum_threads USING gin (
  to_tsvector(
    'simple',
    coalesce(title, '') || ' ' || coalesce(slug, '')
  )
);
CREATE TABLE IF NOT EXISTS forum.lajukan_forum_thread_tags (
  thread_id text NOT NULL REFERENCES lajukan_forum_threads(id) ON DELETE CASCADE,
  tag_slug text NOT NULL REFERENCES lajukan_forum_tags(slug) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (thread_id, tag_slug)
);
CREATE INDEX IF NOT EXISTS lajukan_forum_thread_tags_tag_idx ON forum.lajukan_forum_thread_tags (tag_slug, thread_id);
CREATE TABLE IF NOT EXISTS forum.lajukan_forum_posts (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES lajukan_forum_threads(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES lajukan_forum_users(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NULL,
  like_count integer NOT NULL DEFAULT 0,
  reply_to_post_id text NULL,
  is_answer boolean NOT NULL DEFAULT false,
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_urls text [] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS lajukan_forum_posts_thread_created_idx ON forum.lajukan_forum_posts (thread_id, created_at);
CREATE INDEX IF NOT EXISTS lajukan_forum_posts_parent_idx ON forum.lajukan_forum_posts (reply_to_post_id);
CREATE INDEX IF NOT EXISTS lajukan_forum_posts_search_idx ON forum.lajukan_forum_posts USING gin (to_tsvector('simple', coalesce(content, '')));
CREATE TABLE IF NOT EXISTS lajukan_forum_votes (
  id text PRIMARY KEY,
  target_type text NOT NULL,
  target_id text NOT NULL,
  user_id text NOT NULL REFERENCES lajukan_forum_users(id) ON DELETE CASCADE,
  value integer NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, user_id)
);
CREATE INDEX IF NOT EXISTS lajukan_forum_votes_target_idx ON lajukan_forum_votes (target_type, target_id);
CREATE TABLE IF NOT EXISTS lajukan_forum_audit_logs (
  id text PRIMARY KEY,
  action text NOT NULL,
  actor_user_id text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lajukan_forum_audit_logs_target_idx ON lajukan_forum_audit_logs (target_type, target_id, created_at DESC);
-- INSERT INTO lajukan_forum_users (
--     id,
--     username,
--     name,
--     avatar_url,
--     title,
--     reputation,
--     base_reputation,
--     badges,
--     created_at,
--     updated_at
--   )
-- VALUES (
--     'u-1',
--     'sariayu',
--     'Sari Ayu',
--     'default-avatar.svg',
--     'UMKM Owner',
--     150,
--     150,
--     ARRAY ['gold', 'silver', 'bronze'],
--     now() - interval '30 days',
--     now() - interval '1 day'
--   ),
--   (
--     'u-2',
--     'budi_santoso',
--     'Budi Santoso',
--     'default-avatar.svg',
--     'Supplier Packaging',
--     120,
--     120,
--     ARRAY ['silver', 'bronze'],
--     now() - interval '25 days',
--     now() - interval '2 days'
--   ),
--   (
--     'u-3',
--     'lina_wulandari',
--     'Lina Wulandari',
--     'default-avatar.svg',
--     'Community Manager',
--     200,
--     200,
--     ARRAY ['gold', 'silver', 'mentor'],
--     now() - interval '40 days',
--     now() - interval '5 hours'
--   ),
--   (
--     'u-4',
--     'andi_pratama',
--     'Andi Pratama',
--     'default-avatar.svg',
--     'Logistics Expert',
--     80,
--     80,
--     ARRAY ['silver', 'logistics'],
--     now() - interval '20 days',
--     now() - interval '10 hours'
--   ) ON CONFLICT (id) DO NOTHING;
-- INSERT INTO forum.lajukan_forum_categories (
--     id,
--     name,
--     slug,
--     description,
--     icon,
--     color,
--     position
--   )
-- VALUES (
--     'c-1',
--     'Announcements',
--     'announcements',
--     'Update platform, fitur baru, dan roadmap.',
--     'megaphone',
--     '#10b981',
--     1
--   ),
--   (
--     'c-2',
--     'Product & Sourcing',
--     'product-ux',
--     'Diskusi sourcing flow, trust, dan UX untuk UMKM.',
--     'sparkles',
--     '#6366f1',
--     2
--   ),
--   (
--     'c-3',
--     'Supply & Operasional',
--     'marketplace-projects',
--     'Supplier, alat, jasa operasional, dan pricing paket.',
--     'puzzle',
--     '#f59e0b',
--     3
--   ),
--   (
--     'c-4',
--     'Community & Events',
--     'community-events',
--     'Kolaborasi, acara, dan inisiatif komunitas.',
--     'community',
--     '#ef4444',
--     4
--   ),
--   (
--     'c-5',
--     'Support & Help',
--     'support-help',
--     'Bantuan teknis, bug report, dan solusi.',
--     'wrench',
--     '#0ea5e9',
--     5
--   ) ON CONFLICT (id) DO NOTHING;
-- INSERT INTO lajukan_forum_tags (id, name, slug, description, color, usage_count)
-- VALUES (
--     't-1',
--     'Sourcing',
--     'ui-ux',
--     'Supplier, distributor, dan alur supply UMKM.',
--     '#6366f1',
--     34
--   ),
--   (
--     't-2',
--     'Growth',
--     'growth',
--     'Akuisisi, activation, dan retention.',
--     '#10b981',
--     28
--   ),
--   (
--     't-3',
--     'Operasional',
--     'marketplace',
--     'Jasa, packaging, admin, dan trust & safety.',
--     '#f59e0b',
--     31
--   ),
--   (
--     't-4',
--     'Event',
--     'event',
--     'Kegiatan komunitas dan kolaborasi.',
--     '#ef4444',
--     18
--   ),
--   (
--     't-5',
--     'Support',
--     'support',
--     'Bantuan teknis dan bug report.',
--     '#0ea5e9',
--     22
--   ) ON CONFLICT (id) DO NOTHING;
-- INSERT INTO lajukan_forum_threads (
--     id,
--     title,
--     slug,
--     category_id,
--     author_id,
--     created_at,
--     last_activity_at,
--     views,
--     reply_count,
--     like_count,
--     bookmark_count,
--     is_pinned,
--     status
--   )
-- VALUES (
--     'th-1',
--     'Cari supplier packaging kecil tapi konsisten kualitasnya?',
--     'cari-supplier-packaging-kecil-tapi-konsisten-kualitasnya',
--     'c-2',
--     'u-1',
--     now() - interval '6 hours',
--     now() - interval '35 minutes',
--     420,
--     2,
--     18,
--     7,
--     true,
--     'open'
--   ),
--   (
--     'th-2',
--     'Template alur order UMKM biar admin tidak kewalahan',
--     'template-alur-order-umkm-biar-admin-tidak-kewalahan',
--     'c-3',
--     'u-4',
--     now() - interval '1 day',
--     now() - interval '2 hours',
--     310,
--     1,
--     12,
--     4,
--     false,
--     'open'
--   ),
--   (
--     'th-3',
--     'Meetup komunitas reseller lokal minggu ini',
--     'meetup-komunitas-reseller-lokal-minggu-ini',
--     'c-4',
--     'u-3',
--     now() - interval '2 days',
--     now() - interval '1 day',
--     188,
--     1,
--     9,
--     3,
--     false,
--     'open'
--   ) ON CONFLICT (id) DO NOTHING;
-- INSERT INTO forum.lajukan_forum_thread_tags (thread_id, tag_slug, position)
-- VALUES ('th-1', 'ui-ux', 0),
--   ('th-1', 'marketplace', 1),
--   ('th-2', 'marketplace', 0),
--   ('th-2', 'growth', 1),
--   ('th-3', 'event', 0),
--   ('th-3', 'growth', 1) ON CONFLICT DO NOTHING;
-- INSERT INTO forum.lajukan_forum_posts (
--     id,
--     thread_id,
--     author_id,
--     content,
--     created_at,
--     like_count,
--     reply_to_post_id,
--     image_urls
--   )
-- VALUES (
--     'p-1',
--     'th-1',
--     'u-1',
--     'Ada rekomendasi supplier packaging untuk batch kecil 100-300 pcs? Aku butuh yang bisa repeat order dan warna cetaknya stabil.',
--     now() - interval '6 hours',
--     18,
--     NULL,
--     ARRAY ['/images/company/company-1.svg']
--   ),
--   (
--     'p-2',
--     'th-1',
--     'u-2',
--     'Coba minta sample proof dulu dan kunci spesifikasi bahan. Kalau bisa, buat checklist penerimaan supaya batch berikutnya gampang dicek.',
--     now() - interval '5 hours',
--     8,
--     'p-1',
--     '{}'
--   ),
--   (
--     'p-3',
--     'th-1',
--     'u-4',
--     'Untuk batch kecil, negosiasikan kalender produksi. Supplier biasanya lebih fleksibel kalau jadwalnya jelas.',
--     now() - interval '35 minutes',
--     6,
--     'p-1',
--     '{}'
--   ),
--   (
--     'p-4',
--     'th-2',
--     'u-4',
--     'Aku pakai flow: masuk order, cek stok, invoice, packing, pickup, follow up. Semua diberi SLA kecil supaya admin baru tidak bingung.',
--     now() - interval '1 day',
--     12,
--     NULL,
--     '{}'
--   ),
--   (
--     'p-5',
--     'th-2',
--     'u-3',
--     'Tambahkan status problem: alamat kurang jelas, stok pending, payment review. Ini menyelamatkan banyak chat bolak-balik.',
--     now() - interval '2 hours',
--     5,
--     'p-4',
--     '{}'
--   ),
--   (
--     'p-6',
--     'th-3',
--     'u-3',
--     'Minggu ini kita test meetup kecil untuk reseller lokal. Fokusnya bukan seminar, tapi tukar supplier dan problem operasional nyata.',
--     now() - interval '2 days',
--     9,
--     NULL,
--     '{}'
--   ),
--   (
--     'p-7',
--     'th-3',
--     'u-1',
--     'Aku ikut. Bagus juga kalau ada sesi cepat untuk validasi harga grosir vs harga marketplace.',
--     now() - interval '1 day',
--     4,
--     'p-6',
--     '{}'
--   ) ON CONFLICT (id) DO NOTHING;
-- UPDATE lajukan_forum_threads t
-- SET reply_count = GREATEST(
--     (
--       SELECT COUNT(*)::int - 1
--       FROM forum.lajukan_forum_posts p
--       WHERE p.thread_id = t.id
--     ),
--     0
--   ),
--   like_count = COALESCE(
--     (
--       SELECT SUM(
--           CASE
--             WHEN value = 1 THEN 1
--             WHEN value = -1 THEN -1
--             ELSE 0
--           END
--         )::int
--       FROM lajukan_forum_votes v
--       WHERE v.target_type = 'thread'
--         AND v.target_id = t.id
--     ),
--     t.like_count
--   );
-- UPDATE forum.lajukan_forum_categories c
-- SET thread_count = (
--     SELECT COUNT(*)::int
--     FROM lajukan_forum_threads t
--     WHERE t.category_id = c.id
--   ),
--   post_count = (
--     SELECT COUNT(*)::int
--     FROM forum.lajukan_forum_posts p
--       JOIN lajukan_forum_threads t ON t.id = p.thread_id
--     WHERE t.category_id = c.id
--   );