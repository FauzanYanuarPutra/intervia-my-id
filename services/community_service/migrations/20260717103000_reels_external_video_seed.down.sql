SET search_path = forum, reel, public, events;

WITH original_media (
  id,
  media_url
) AS (
  VALUES
    ('demo-reel-mesin-sangrai-kopi-bandung', '/images/hero/menu/mesin-01.png'),
    ('demo-reel-mocaf-garut-bakery', '/images/hero/menu/bahan-01.png'),
    ('demo-reel-rumput-laut-ntt', '/images/hero/menu/bahan-01.png'),
    ('demo-reel-kemasan-bambu-tasik', '/images/hero/menu/bahan-01.png'),
    ('demo-reel-jamu-modern-kemitraan', '/images/hero/menu/peluang-01.png'),
    ('demo-reel-kakao-sulawesi-craft', '/images/hero/menu/bahan-01.png'),
    ('demo-reel-jasa-foto-produk-umkm', '/images/hero/menu/jasa-01.png'),
    ('demo-reel-kios-gejayan', '/images/hero/menu/lokasi-01.png')
)
UPDATE reel.lajukan_reels reels
SET media_url = original_media.media_url,
  video_src = original_media.media_url,
  source_url = original_media.media_url,
  media_type = 'image',
  capture_mode = 'upload',
  metadata = reels.metadata - 'media_source' - 'source_title' - 'source_kind' - 'seed_updated_at' - 'mediaSource' - 'sourceTitle' - 'sourceKind' - 'sourceUrl' - 'external' - 'seedPack' - 'seedUpdatedAt',
  updated_at = now()
FROM original_media
WHERE reels.id = original_media.id;
