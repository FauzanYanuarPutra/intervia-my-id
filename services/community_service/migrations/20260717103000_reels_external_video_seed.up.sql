SET search_path = forum, reel, public, events;

WITH seeded_videos (
  id,
  media_url,
  source_url,
  source_title
) AS (
  VALUES
    (
      'demo-reel-mesin-sangrai-kopi-bandung',
      'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      'MDN CC0 direct MP4 sample video'
    ),
    (
      'demo-reel-mocaf-garut-bakery',
      'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
      'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
      'MDN CC0 direct WebM sample video'
    ),
    (
      'demo-reel-rumput-laut-ntt',
      'https://media.w3.org/2010/05/sintel/trailer.mp4',
      'https://media.w3.org/2010/05/sintel/trailer.mp4',
      'W3C direct MP4 sample video'
    ),
    (
      'demo-reel-kemasan-bambu-tasik',
      'https://media.w3.org/2010/05/sintel/trailer.webm',
      'https://media.w3.org/2010/05/sintel/trailer.webm',
      'W3C direct WebM sample video'
    ),
    (
      'demo-reel-jamu-modern-kemitraan',
      'https://media.w3.org/2010/05/bunny/trailer.mp4',
      'https://media.w3.org/2010/05/bunny/trailer.mp4',
      'W3C direct MP4 sample video'
    ),
    (
      'demo-reel-kakao-sulawesi-craft',
      'https://media.w3.org/2010/05/video/movie_300.mp4',
      'https://media.w3.org/2010/05/video/movie_300.mp4',
      'W3C direct MP4 sample video'
    ),
    (
      'demo-reel-jasa-foto-produk-umkm',
      'https://media.w3.org/2010/05/video/movie_300.webm',
      'https://media.w3.org/2010/05/video/movie_300.webm',
      'W3C direct WebM sample video'
    ),
    (
      'demo-reel-kios-gejayan',
      'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',
      'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',
      'Samplelib direct MP4 sample video'
    )
)
UPDATE reel.lajukan_reels reels
SET media_url = seeded_videos.media_url,
  video_src = seeded_videos.media_url,
  source_url = seeded_videos.source_url,
  media_type = 'video',
  capture_mode = 'upload',
  metadata = reels.metadata || jsonb_build_object(
    'mediaSource',
    'external_direct_video',
    'sourceTitle',
    seeded_videos.source_title,
    'sourceKind',
    'direct_browser_playable_video',
    'sourceUrl',
    seeded_videos.source_url,
    'external',
    true,
    'seedPack',
    'indonesia_demo_reels_external_video_20260717',
    'seedUpdatedAt',
    '2026-07-17'
  ),
  updated_at = now()
FROM seeded_videos
WHERE reels.id = seeded_videos.id;
