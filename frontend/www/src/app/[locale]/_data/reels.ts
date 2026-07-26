export type ReelTone = 'emerald' | 'orange' | 'blue' | 'amber' | 'rose';
export type ReelFilterPreset =
  'natural' | 'warm' | 'fresh' | 'cinema' | 'mono' | 'pop';
export type ReelCaptureMode = 'upload' | 'camera' | 'live';
export type ReelLiveStatus = 'none' | 'scheduled' | 'live' | 'ended';

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
  filterPreset?: ReelFilterPreset;
  captureMode?: ReelCaptureMode;
  liveStatus?: ReelLiveStatus;
  liveTitle?: string | null;
  liveScheduledAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type ReelsPageResult = {
  items: LajukanReel[];
  nextCursor: number | null;
  hasMore: boolean;
};

export const FALLBACK_REEL_COUNT = 0;
export const REELS_PAGE_SIZE = 24;
export const MAX_REELS_PAGE_LIMIT = 120;

function looksLikeImageMedia(value: string) {
  const lower = value.split('?')[0]?.toLowerCase() || '';
  return /\.(avif|gif|jpe?g|png|webp)$/.test(lower);
}

export function isVideoReel(reel: Pick<LajukanReel, 'mediaType' | 'videoSrc'>) {
  return reel.mediaType !== 'image' && !looksLikeImageMedia(reel.videoSrc);
}

export function normalizePlayableReel(
  reel: LajukanReel,
  index = 0,
): LajukanReel {
  void index;
  return reel;
}

export function normalizePlayableReels(reels: LajukanReel[], startIndex = 0) {
  return reels
    .filter(isVideoReel)
    .map((reel, index) => normalizePlayableReel(reel, startIndex + index));
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
