export type ReelTone = 'emerald' | 'orange' | 'blue' | 'amber' | 'rose';

export type LajukanReel = {
  id: string;
  baseId?: string;
  title: string;
  creator: string;
  creatorUserId?: string | null;
  caption: string;
  tag: string;

  productName?: string;
  productPrice?: string;
  productHref?: string;

  videoSrc: string;
  sourceUrl: string;

  likes: string;
  comments: string;
  shares: string;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;

  tone: ReelTone;
  iconKey: 'supplier' | 'marketing' | 'finance' | 'packaging' | 'frozen';
  mediaType?: 'video' | 'image';
};

export type ReelsPageResult = {
  items: LajukanReel[];
  nextCursor: number | null;
  hasMore: boolean;
};

type PlayableReelVideoSource = {
  videoSrc: string;
  sourceUrl: string;
  durationSeconds: number;
  hasAudio: true;
  label: string;
};

export const FALLBACK_REEL_COUNT = 0;
export const REELS_PAGE_SIZE = 24;
export const MAX_REELS_PAGE_LIMIT = 120;

export const PLAYABLE_REEL_VIDEO_SOURCES: PlayableReelVideoSource[] = [
  {
    videoSrc: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    sourceUrl: 'https://www.w3.org/2010/05/video/mediaevents.html',
    durationSeconds: 52,
    hasAudio: true,
    label: 'Sintel trailer MP4',
  },
  {
    videoSrc: 'https://media.w3.org/2010/05/sintel/trailer.webm',
    sourceUrl: 'https://www.w3.org/2010/05/video/mediaevents.html',
    durationSeconds: 52,
    hasAudio: true,
    label: 'Sintel trailer WebM',
  },
  {
    videoSrc: 'https://media.w3.org/2010/05/video/movie_300.webm',
    sourceUrl: 'https://www.w3.org/2010/05/video/mediaevents.html',
    durationSeconds: 300,
    hasAudio: true,
    label: 'W3C sample WebM',
  },
  {
    videoSrc: 'https://media.w3.org/2010/05/sintel/trailer.ogv',
    sourceUrl: 'https://www.w3.org/2010/05/video/mediaevents.html',
    durationSeconds: 52,
    hasAudio: true,
    label: 'Sintel trailer OGV',
  },
  {
    videoSrc: 'https://media.w3.org/2010/05/bunny/trailer.ogv',
    sourceUrl: 'https://www.w3.org/2010/05/video/mediaevents.html',
    durationSeconds: 33,
    hasAudio: true,
    label: 'Bunny trailer OGV',
  },
];

function stableVideoIndex(seed: string | number) {
  if (typeof seed === 'number') {
    return Math.abs(seed) % PLAYABLE_REEL_VIDEO_SOURCES.length;
  }

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }

  return Math.abs(hash) % PLAYABLE_REEL_VIDEO_SOURCES.length;
}

function withMediaFragment(
  source: PlayableReelVideoSource,
  seed: string | number,
) {
  const duration = Math.max(source.durationSeconds - 8, 1);
  const numericSeed =
    typeof seed === 'number'
      ? seed
      : Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0);
  const startAt = Math.max(0, numericSeed % duration);

  return {
    ...source,
    videoSrc: startAt > 0 ? `${source.videoSrc}#t=${startAt}` : source.videoSrc,
  };
}

export function getPlayableReelVideoSource(seed: string | number) {
  return withMediaFragment(
    PLAYABLE_REEL_VIDEO_SOURCES[stableVideoIndex(seed)],
    seed,
  );
}

export function getPrimaryPlayableReelVideoSource(seed: string | number) {
  return withMediaFragment(PLAYABLE_REEL_VIDEO_SOURCES[0], seed);
}

function looksLikeImageMedia(value: string) {
  const lower = value.split('?')[0]?.toLowerCase() || '';
  return /\.(avif|gif|jpe?g|png|webp)$/.test(lower);
}

function isKnownAudioSource(value: string) {
  const withoutFragment = value.split('#')[0];
  return PLAYABLE_REEL_VIDEO_SOURCES.some(
    source => source.videoSrc === withoutFragment,
  );
}

function shouldReplaceVideoSource(value: string) {
  const src = value.trim();
  if (!src) return true;
  if (isKnownAudioSource(src)) return false;

  try {
    const url = new URL(src);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();

    return (
      ((host === 'pexels.com' || host === 'www.pexels.com') &&
        (path.includes('/download/video') || path.includes('/video/'))) ||
      host === 'upload.wikimedia.org' ||
      host === 'interactive-examples.mdn.mozilla.net'
    );
  } catch {
    return false;
  }
}

export function normalizePlayableReel(
  reel: LajukanReel,
  index = 0,
): LajukanReel {
  void index;
  if (reel.mediaType === 'image' || looksLikeImageMedia(reel.videoSrc)) {
    return reel;
  }

  return reel;
}

export function normalizePlayableReels(reels: LajukanReel[], startIndex = 0) {
  return reels.map((reel, index) =>
    normalizePlayableReel(reel, startIndex + index),
  );
}

function normalizeReelsCursor(cursor = 0) {
  return Math.max(0, Math.floor(Number.isFinite(cursor) ? cursor : 0));
}

function normalizeReelsLimit(limit = REELS_PAGE_SIZE) {
  return Math.min(
    MAX_REELS_PAGE_LIMIT,
    Math.max(1, Math.floor(Number.isFinite(limit) ? limit : REELS_PAGE_SIZE)),
  );
}

function getFallbackReelsPool(q = '') {
  void q;
  return [] as LajukanReel[];
}

export function getFallbackReelsCount(q = '') {
  return getFallbackReelsPool(q).length;
}

export function getFallbackReelsPage({
  cursor = 0,
  limit = REELS_PAGE_SIZE,
  q = '',
}: {
  cursor?: number;
  limit?: number;
  q?: string;
} = {}): ReelsPageResult {
  const safeCursor = normalizeReelsCursor(cursor);
  const safeLimit = normalizeReelsLimit(limit);
  void safeCursor;
  void safeLimit;
  void q;

  return {
    items: [],
    nextCursor: null,
    hasMore: false,
  };
}

export function completeReelsPageWithFallback(
  payload: Partial<ReelsPageResult>,
  {
    cursor = 0,
    limit = REELS_PAGE_SIZE,
    q = '',
  }: {
    cursor?: number;
    limit?: number;
    q?: string;
  } = {},
): ReelsPageResult {
  const safeCursor = normalizeReelsCursor(cursor);
  void limit;
  void q;
  const backendItems = Array.isArray(payload.items)
    ? normalizePlayableReels(payload.items as LajukanReel[], safeCursor)
    : [];
  const backendHasMore = Boolean(payload.hasMore);
  const backendNextCursor =
    typeof payload.nextCursor === 'number'
      ? normalizeReelsCursor(payload.nextCursor)
      : safeCursor + backendItems.length;

  return {
    items: backendItems,
    nextCursor: backendHasMore ? backendNextCursor : null,
    hasMore: backendHasMore,
  };
}

export const FALLBACK_REELS: LajukanReel[] = [];
