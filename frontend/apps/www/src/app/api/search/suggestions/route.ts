import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function GET(req: NextRequest) {
  const rateLimit = await enforceRateLimit({
    key: `search-suggestions:${getClientIp(req)}`,
    limit: 240,
    windowSeconds: 3600,
    message: 'Too many search suggestions requests.',
  });
  if (!rateLimit.ok) return rateLimit.response;

  const query = (req.nextUrl.searchParams.get('q') || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  if (query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const upstream = new URL('/v1/search/suggestions', MARKETPLACE_URL);
  req.nextUrl.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  try {
    const response = await fetch(upstream, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload ?? { items: [] }, {
      status: response.status,
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
      },
    });
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
