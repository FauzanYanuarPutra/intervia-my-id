import { NextRequest, NextResponse } from 'next/server';

import { getClientIp, enforceRateLimit } from '@/lib/rateLimit';
import { getPublishedNews } from '@/lib/news';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: string | null, maxLength: number): string | undefined {
  const trimmed = (value || '').trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function readLimit(value: string | null): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return 36;
  return Math.min(Math.max(parsed, 1), 48);
}

export async function GET(req: NextRequest) {
  const rateLimit = await enforceRateLimit({
    key: `public-news-feed:${getClientIp(req)}`,
    limit: 120,
    windowSeconds: 60,
    message: 'Too many news requests. Please retry shortly.',
  });
  if (!rateLimit.ok) return rateLimit.response;

  const params = req.nextUrl.searchParams;
  const language = params.get('language') === 'en' ? 'en' : 'id';

  const result = await getPublishedNews({
    category: clean(params.get('category'), 80),
    topic: clean(params.get('topic'), 80),
    location: clean(params.get('location'), 120),
    language,
    query: clean(params.get('q'), 160),
    cursor: clean(params.get('cursor'), 120),
    limit: readLimit(params.get('limit')),
  });

  return NextResponse.json(
    {
      items: result.items,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  );
}
