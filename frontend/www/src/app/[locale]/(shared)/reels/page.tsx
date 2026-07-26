import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  MAX_REELS_PAGE_LIMIT,
  REELS_PAGE_SIZE,
  isVideoReel,
  type LajukanReel,
  type ReelsPageResult,
} from '../../_data/reels';
import ReelsClient from './ReelsClient';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    video?: string;
    q?: string;
    upload?: string;
    create?: string;
  }>;
};

const REELS_INITIAL_REQUEST_TIMEOUT_MS = 1_800;

export async function generateMetadata({
  params,
}: Pick<PageProps, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== 'id' && locale !== 'en') notFound();
  const isId = locale === 'id';
  const canonical = `https://www.lajukan.com/${locale}/reels`;
  const title = isId
    ? 'Video Usaha dan Inspirasi UMKM | Lajukan'
    : 'Business Videos and SME Ideas | Lajukan';
  const description = isId
    ? 'Tonton video singkat tentang produk lokal, supplier, alat usaha, pemasaran, dan pengalaman UMKM Indonesia.'
    : 'Watch short videos about local products, suppliers, business tools, marketing, and Indonesian SME experiences.';

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        'id-ID': 'https://www.lajukan.com/id/reels',
        'en-US': 'https://www.lajukan.com/en/reels',
        'x-default': 'https://www.lajukan.com/id/reels',
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Lajukan',
      type: 'website',
      locale: isId ? 'id_ID' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

function getCommunityBackendBases(): string[] {
  return [
    process.env.COMMUNITY_SERVICE_URL,
    process.env.INTERNAL_COMMUNITY_URL,
    process.env.NEXT_PUBLIC_COMMUNITY_URL,
  ]
    .map(value => value?.trim() || '')
    .filter((value, index, source) => value && source.indexOf(value) === index);
}

async function getInitialReelsPage(
  cursor: number,
  limit: number,
  q?: string,
): Promise<ReelsPageResult> {
  const candidates = await Promise.all(
    getCommunityBackendBases().map(async base => {
      const url = new URL('/v1/reels', base.endsWith('/') ? base : `${base}/`);
      url.searchParams.set('cursor', String(cursor));
      url.searchParams.set('limit', String(limit));
      if (q?.trim()) url.searchParams.set('q', q.trim());

      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: AbortSignal.timeout(REELS_INITIAL_REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as Partial<ReelsPageResult>;
        return {
          items: Array.isArray(payload.items)
            ? payload.items.filter(isVideoReel)
            : [],
          nextCursor:
            typeof payload.nextCursor === 'number' ? payload.nextCursor : null,
          hasMore: Boolean(payload.hasMore),
        } satisfies ReelsPageResult;
      } catch {
        return null;
      }
    }),
  );

  return (
    candidates.find(
      (candidate): candidate is ReelsPageResult => candidate !== null,
    ) ?? { items: [], nextCursor: null, hasMore: false }
  );
}

async function getInitialReel(reelId?: string): Promise<LajukanReel | null> {
  const cleanReelId = decodeURIComponent(reelId || '').trim();
  if (!cleanReelId) return null;

  const candidates = await Promise.all(
    getCommunityBackendBases().map(async base => {
      const url = new URL(
        `/v1/reels/${encodeURIComponent(cleanReelId)}`,
        base.endsWith('/') ? base : `${base}/`,
      );

      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: AbortSignal.timeout(REELS_INITIAL_REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as {
          reel?: LajukanReel | null;
        };
        const reel = payload.reel ?? null;
        return reel && isVideoReel(reel) ? reel : null;
      } catch {
        return null;
      }
    }),
  );

  return candidates.find((reel): reel is LajukanReel => reel !== null) ?? null;
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
  const { video, q, upload, create } = await searchParams;
  const uploadRequest = String(upload || create || '').toLowerCase();
  const initialUploadOpen = [
    '1',
    'true',
    'camera',
    'reel',
    'reels',
    'studio',
  ].includes(uploadRequest);

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
      initialUploadOpen={initialUploadOpen}
    />
  );
}
