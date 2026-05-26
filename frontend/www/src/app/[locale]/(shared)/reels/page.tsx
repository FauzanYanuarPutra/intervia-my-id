import {
  MAX_REELS_PAGE_LIMIT,
  REELS_PAGE_SIZE,
  type LajukanReel,
  type ReelsPageResult,
} from '../../_data/reels';
import ReelsClient from './ReelsClient';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ video?: string; q?: string }>;
};

function getCommunityBackendBase(): string | null {
  const base =
    process.env.COMMUNITY_SERVICE_URL ||
    process.env.INTERNAL_COMMUNITY_URL ||
    process.env.NEXT_PUBLIC_COMMUNITY_URL ||
    '';
  return base.trim() || null;
}

async function getInitialReelsPage(
  cursor: number,
  limit: number,
  q?: string,
): Promise<ReelsPageResult> {
  const base = getCommunityBackendBase();
  if (!base) return { items: [], nextCursor: null, hasMore: false };

  const url = new URL('/v1/reels', base.endsWith('/') ? base : `${base}/`);
  url.searchParams.set('cursor', String(cursor));
  url.searchParams.set('limit', String(limit));
  if (q?.trim()) url.searchParams.set('q', q.trim());

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return { items: [], nextCursor: null, hasMore: false };
    const payload = (await response.json()) as Partial<ReelsPageResult>;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      nextCursor:
        typeof payload.nextCursor === 'number' ? payload.nextCursor : null,
      hasMore: Boolean(payload.hasMore),
    };
  } catch {
    return { items: [], nextCursor: null, hasMore: false };
  }
}

async function getInitialReel(reelId?: string): Promise<LajukanReel | null> {
  const cleanReelId = decodeURIComponent(reelId || '').trim();
  if (!cleanReelId) return null;

  const base = getCommunityBackendBase();
  if (!base) return null;

  const url = new URL(
    `/v1/reels/${encodeURIComponent(cleanReelId)}`,
    base.endsWith('/') ? base : `${base}/`,
  );

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { reel?: LajukanReel | null };
    return payload.reel ?? null;
  } catch {
    return null;
  }
}

function getRequestedNumericIndex(video?: string): number | null {
  const cleanVideo = video?.trim();
  if (!cleanVideo) return 0;
  if (!/^\d+$/.test(cleanVideo)) return null;

  return Math.min(Math.max(Number(cleanVideo) - 1, 0), 240);
}

function getRequestedReelIndex(
  items: ReelsPageResult['items'],
  video?: string,
): number {
  const numericIndex = getRequestedNumericIndex(video);
  if (numericIndex !== null) return numericIndex;

  const cleanVideo = decodeURIComponent(video || '').trim();
  if (!cleanVideo) return 0;

  const matchedIndex = items.findIndex(item => {
    const record = item as ReelsPageResult['items'][number] & {
      baseId?: string | null;
    };
    return record.id === cleanVideo || record.baseId === cleanVideo;
  });

  return matchedIndex >= 0 ? matchedIndex : 0;
}

export default async function ReelsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { video, q } = await searchParams;

  const requestedIndex = getRequestedNumericIndex(video);
  const needsIdLookup = requestedIndex === null;

  const initialLimit = Math.min(
    MAX_REELS_PAGE_LIMIT,
    needsIdLookup
      ? MAX_REELS_PAGE_LIMIT
      : Math.max(REELS_PAGE_SIZE, requestedIndex + REELS_PAGE_SIZE),
  );
  const initialPage = await getInitialReelsPage(0, initialLimit, q);
  const requestedReel = needsIdLookup ? await getInitialReel(video) : null;
  const initialItems = requestedReel
    ? [
        requestedReel,
        ...initialPage.items.filter(item => item.id !== requestedReel.id),
      ]
    : initialPage.items;
  const initialIndex = requestedReel
    ? 0
    : getRequestedReelIndex(initialItems, video);

  return (
    <ReelsClient
      locale={locale}
      initialIndex={initialIndex}
      initialItems={initialItems}
      initialCursor={initialPage.nextCursor}
      initialHasMore={initialPage.hasMore}
      initialSearchQuery={q || ''}
    />
  );
}
