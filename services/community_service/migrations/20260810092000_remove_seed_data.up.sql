-- Remove legacy, fictional-demo, and open-reference community seed data while
-- preserving the structural public category used by genuine user posts.

SET search_path = forum, reel, public, events;

CREATE TEMP TABLE seed_identity_values (id text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_identity_values (id)
VALUES
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000005'),
  ('00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000102'),
  ('00000000-0000-0000-0000-000000000103'),
  ('00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000000202'),
  ('00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000401'),
  ('00000000-0000-0000-0000-000000000511'),
  ('00000000-0000-0000-0000-000000000512'),
  ('00000000-0000-0000-0000-000000000513'),
  ('00000000-0000-0000-0000-000000000514'),
  ('00000000-0000-0000-0000-000000000515'),
  ('00000000-0000-0000-0000-000000000516'),
  ('00000000-0000-0000-0000-000000000517'),
  ('00000000-0000-0000-0000-000000000518'),
  ('00000000-0000-0000-0000-000000000701'),
  ('00000000-0000-0000-0000-000000000702'),
  ('00000000-0000-0000-0000-000000000703'),
  ('00000000-0000-0000-0000-000000000704'),
  ('00000000-0000-0000-0000-000000000705'),
  ('00000000-0000-0000-0000-000000000706'),
  ('00000000-0000-0000-0000-000000000707'),
  ('00000000-0000-0000-0000-000000000708'),
  ('00000000-0000-0000-0000-000000000709'),
  ('00000000-0000-0000-0000-000000000710'),
  ('00000000-0000-0000-0000-000000000801');

CREATE TEMP TABLE seed_forum_user_ids (id text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_forum_user_ids (id)
SELECT forum_user.id
FROM forum.lajukan_forum_users forum_user
WHERE forum_user.metadata->>'seed_pack' IN (
    'indonesia_demo_20260709',
    'real_indonesia_open_data_20260723'
  )
  OR forum_user.id IN ('u-1', 'u-2', 'u-3', 'u-4', 'u-5')
  OR forum_user.id IN (SELECT id FROM seed_identity_values)
  OR forum_user.id IN (SELECT 'auth-' || id FROM seed_identity_values);

CREATE TEMP TABLE seed_category_ids (id text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_category_ids (id)
SELECT category.id
FROM forum.lajukan_forum_categories category
WHERE category.id LIKE 'demo-c-%'
   OR category.id LIKE 'real-c-%'
   OR category.id IN ('c-1', 'c-2', 'c-3', 'c-4', 'c-5');

CREATE TEMP TABLE seed_group_ids (id text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_group_ids (id)
SELECT community_group.id
FROM forum.lajukan_groups community_group
WHERE community_group.id LIKE 'demo-g-%'
   OR community_group.id LIKE 'real-g-%'
   OR community_group.id IN ('g-c-1', 'g-c-2', 'g-c-3', 'g-c-4', 'g-c-5')
   OR community_group.category_id IN (SELECT id FROM seed_category_ids)
   OR community_group.created_by_user_id IN (SELECT id FROM seed_forum_user_ids);

CREATE TEMP TABLE seed_thread_ids (id text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_thread_ids (id)
SELECT thread.id
FROM forum.lajukan_forum_threads thread
WHERE thread.id LIKE 'demo-th-%'
   OR thread.id LIKE 'real-th-%'
   OR thread.id IN ('th-1', 'th-2', 'th-3')
   OR thread.author_id IN (SELECT id FROM seed_forum_user_ids);

CREATE TEMP TABLE seed_post_ids (id text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_post_ids (id)
SELECT post.id
FROM forum.lajukan_forum_posts post
WHERE post.id LIKE 'demo-post-%'
   OR post.id LIKE 'real-post-%'
   OR post.id IN ('p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-7')
   OR post.thread_id IN (SELECT id FROM seed_thread_ids)
   OR post.author_id IN (SELECT id FROM seed_forum_user_ids);

CREATE TEMP TABLE seed_tag_ids (id text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_tag_ids (id)
SELECT tag.id
FROM forum.lajukan_forum_tags tag
WHERE tag.id LIKE 'tag-demo-%'
   OR tag.id LIKE 'real-tag-%'
   OR tag.id IN ('t-1', 't-2', 't-3', 't-4', 't-5');

CREATE TEMP TABLE seed_reel_ids (id text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_reel_ids (id)
SELECT short_video.id
FROM reel.lajukan_reels short_video
WHERE short_video.metadata->>'seed_pack' IN (
    'indonesia_demo_20260709',
    'real_indonesia_open_data_20260723'
  )
  OR short_video.id LIKE 'demo-reel-%'
  OR short_video.id LIKE 'real-reel-%'
  OR short_video.creator_user_id IN (SELECT id FROM seed_forum_user_ids)
  OR short_video.creator_user_id IN (SELECT id FROM seed_identity_values)
  OR short_video.id IN (
    'supplier-terpercaya',
    'packaging-naik-kelas',
    'kopi-laris',
    'keuangan-umkm',
    'packing-online-shop',
    'reel-1779786343124-70966b3b',
    'reel-kopi-braga-menu-pagi',
    'reel-supplier-bahan-baku-cepat',
    'reel-packaging-reseller-ready',
    'reel-frozen-food-stok-aman',
    'reel-cashflow-harian-umkm',
    'reel-gudang-rasa-packing-cepat',
    'reel-panggung-live-surabaya',
    'reel-dapur-kawan-setiabudi',
    'reel-warung-sehat-ubud',
    'reel-ruang-pendingin-bali',
    'reel-butik-selaras-gejayan',
    'reel-kembang-kulit-print-house',
    'reel-kedai-nusantara-tebet',
    'reel-admin-online-shop-rapi'
  );

-- Genuine threads cannot keep a category/group that is about to be removed.
UPDATE forum.lajukan_forum_threads thread
SET category_id = 'c-fyp',
    group_id = NULL
WHERE thread.id NOT IN (SELECT id FROM seed_thread_ids)
  AND (
    thread.category_id IN (SELECT id FROM seed_category_ids)
    OR thread.group_id IN (SELECT id FROM seed_group_ids)
  );

-- Remove non-FK activity/audit references before deleting their targets.
DELETE FROM forum.lajukan_reel_events event_row
WHERE event_row.reel_id IN (SELECT id FROM seed_reel_ids)
   OR event_row.actor_user_id IN (SELECT id FROM seed_forum_user_ids)
   OR event_row.actor_user_id IN (SELECT id FROM seed_identity_values);

DELETE FROM forum.lajukan_forum_votes vote
WHERE vote.user_id IN (SELECT id FROM seed_forum_user_ids)
   OR vote.target_id IN (SELECT id FROM seed_thread_ids)
   OR vote.target_id IN (SELECT id FROM seed_post_ids)
   OR vote.target_id IN (SELECT id FROM seed_reel_ids);

DELETE FROM forum.lajukan_forum_audit_logs audit_row
WHERE audit_row.actor_user_id IN (SELECT id FROM seed_forum_user_ids)
   OR audit_row.target_id IN (SELECT id FROM seed_forum_user_ids)
   OR audit_row.target_id IN (SELECT id FROM seed_category_ids)
   OR audit_row.target_id IN (SELECT id FROM seed_group_ids)
   OR audit_row.target_id IN (SELECT id FROM seed_thread_ids)
   OR audit_row.target_id IN (SELECT id FROM seed_post_ids)
   OR audit_row.target_id IN (SELECT id FROM seed_reel_ids);

DELETE FROM forum.lajukan_reel_user_actions action_row
WHERE action_row.reel_id IN (SELECT id FROM seed_reel_ids)
   OR action_row.actor_user_id IN (SELECT id FROM seed_forum_user_ids)
   OR action_row.target_user_id IN (SELECT id FROM seed_forum_user_ids);

DELETE FROM reel.lajukan_reel_comments comment_row
WHERE comment_row.reel_id IN (SELECT id FROM seed_reel_ids)
   OR comment_row.author_user_id IN (SELECT id FROM seed_forum_user_ids);

UPDATE forum.lajukan_forum_threads thread
SET solution_post_id = NULL,
    is_solved = FALSE
WHERE thread.solution_post_id IN (SELECT id FROM seed_post_ids);

DELETE FROM reel.lajukan_reels short_video
USING seed_reel_ids seed
WHERE short_video.id = seed.id;

DELETE FROM forum.lajukan_forum_posts post
USING seed_post_ids seed
WHERE post.id = seed.id;

DELETE FROM forum.lajukan_forum_threads thread
USING seed_thread_ids seed
WHERE thread.id = seed.id;

DELETE FROM forum.lajukan_groups community_group
USING seed_group_ids seed
WHERE community_group.id = seed.id;

DELETE FROM forum.lajukan_forum_categories category
USING seed_category_ids seed
WHERE category.id = seed.id;

DELETE FROM forum.lajukan_forum_tags tag
USING seed_tag_ids seed
WHERE tag.id = seed.id;

DELETE FROM forum.lajukan_forum_users forum_user
USING seed_forum_user_ids seed
WHERE forum_user.id = seed.id;

-- Reconcile denormalized counters after removing seed-derived interactions.
UPDATE forum.lajukan_forum_threads thread
SET reply_count = GREATEST(
      (SELECT COUNT(*)::int FROM forum.lajukan_forum_posts post WHERE post.thread_id = thread.id) - 1,
      0
    ),
    like_count = COALESCE(
      (
        SELECT SUM(vote.value)::int
        FROM forum.lajukan_forum_votes vote
        WHERE vote.target_type = 'thread'
          AND vote.target_id = thread.id
      ),
      0
    );

UPDATE forum.lajukan_forum_categories category
SET thread_count = (
      SELECT COUNT(*)::int
      FROM forum.lajukan_forum_threads thread
      WHERE thread.category_id = category.id
    ),
    post_count = (
      SELECT COUNT(*)::int
      FROM forum.lajukan_forum_posts post
      JOIN forum.lajukan_forum_threads thread ON thread.id = post.thread_id
      WHERE thread.category_id = category.id
    );

UPDATE forum.lajukan_forum_tags tag
SET usage_count = (
  SELECT COUNT(*)::int
  FROM forum.lajukan_forum_thread_tags link
  WHERE link.tag_slug = tag.slug
);

UPDATE reel.lajukan_reels short_video
SET comments_count = (
      SELECT COUNT(*)::bigint
      FROM reel.lajukan_reel_comments comment_row
      WHERE comment_row.reel_id = short_video.id
        AND comment_row.status = 'published'
    ),
    likes_count = (
      SELECT COUNT(*)::bigint
      FROM forum.lajukan_reel_user_actions action_row
      WHERE action_row.reel_id = short_video.id
        AND action_row.action = 'like'
    ),
    updated_at = NOW();

