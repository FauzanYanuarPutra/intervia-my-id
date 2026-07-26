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

DELETE FROM forum.lajukan_forum_tags
WHERE id IN (
  'real-tag-pasar-tradisional',
  'real-tag-bahan-usaha',
  'real-tag-produk-lokal',
  'real-tag-kawasan-usaha'
);

DELETE FROM forum.lajukan_group_members
WHERE group_id IN (
  'real-g-komunitas-usaha-data-indonesia',
  'real-g-komunitas-usaha-supplier-bahan-lokal',
  'real-g-komunitas-usaha-mesin-alat-ikm',
  'real-g-komunitas-usaha-tempat-pasar',
  'real-g-komunitas-usaha-peluang-kemitraan'
);

DELETE FROM forum.lajukan_groups
WHERE id IN (
  'real-g-komunitas-usaha-data-indonesia',
  'real-g-komunitas-usaha-supplier-bahan-lokal',
  'real-g-komunitas-usaha-mesin-alat-ikm',
  'real-g-komunitas-usaha-tempat-pasar',
  'real-g-komunitas-usaha-peluang-kemitraan'
);

DELETE FROM forum.lajukan_forum_categories
WHERE id IN (
  'real-c-komunitas-usaha-data-publik',
  'real-c-komunitas-usaha-supplier-lokal',
  'real-c-komunitas-usaha-mesin-alat',
  'real-c-komunitas-usaha-tempat',
  'real-c-komunitas-usaha-peluang-kemitraan'
);

DELETE FROM forum.lajukan_forum_users
WHERE id = '00000000-0000-0000-0000-000000000801'
  AND metadata->>'seed_pack' = 'real_indonesia_open_data_20260723';

UPDATE reel.lajukan_reels
SET status = 'published',
    metadata = metadata - 'archived_by_seed_pack' - 'archived_reason',
    updated_at = NOW()
WHERE metadata->>'archived_by_seed_pack' = 'real_indonesia_open_data_20260723';
