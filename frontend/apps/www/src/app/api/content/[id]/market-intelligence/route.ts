import { NextRequest, NextResponse } from 'next/server';
import { extractContentId } from '@/lib/content/routes';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const ipLimit = await enforceRateLimit({
      key: `market-intelligence:ip:${getClientIp(req)}`,
      limit: 120,
      windowSeconds: 3600,
      message: 'Too many market intelligence requests. Please retry later.',
    });
    if (!ipLimit.ok) return ipLimit.response;

    const userLimit = await enforceRateLimit({
      key: `market-intelligence:user:${auth.ctx.userId}`,
      limit: 300,
      windowSeconds: 3600,
      message: 'Too many market intelligence requests. Please retry later.',
    });
    if (!userLimit.ok) return userLimit.response;

    const { id } = await params;
    const resolvedId = extractContentId(id) || id;
    const url = new URL(
      MARKETPLACE_URL + '/v1/content/' + resolvedId + '/market-intelligence',
    );

    for (const key of ['city', 'category', 'price_unit', 'days']) {
      const value = req.nextUrl.searchParams.get(key);
      if (value) url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${auth.ctx.token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[CONTENT_MARKET_INTELLIGENCE_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Market Intelligence temporarily unavailable' },
      { status: 503 },
    );
  }
}
