import { NextRequest, NextResponse } from 'next/server';
import { extractContentId } from '@/lib/content/routes';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const ipLimit = await enforceRateLimit({
      key: `market-signal:ip:${getClientIp(req)}`,
      limit: 30,
      windowSeconds: 600,
      message: 'Too many negotiation attempts. Please retry later.',
    });
    if (!ipLimit.ok) return ipLimit.response;

    const userLimit = await enforceRateLimit({
      key: `market-signal:user:${auth.ctx.userId}`,
      limit: 60,
      windowSeconds: 3600,
      message: 'Too many negotiation attempts. Please retry later.',
    });
    if (!userLimit.ok) return userLimit.response;

    const { id } = await params;
    const resolvedId = extractContentId(id) || id;
    const body = await req.json().catch(() => ({}));

    const response = await fetch(
      `${MARKETPLACE_URL}/v1/content/${encodeURIComponent(resolvedId)}/market-signals`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.ctx.token}`,
          'Content-Type': 'application/json',
          ...(req.headers.get('x-idempotency-key')
            ? { 'X-Idempotency-Key': req.headers.get('x-idempotency-key') as string }
            : {}),
        },
        body: JSON.stringify(body),
        cache: 'no-store',
      },
    );

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[CONTENT_MARKET_SIGNAL_POST_ERROR]', error);
    return NextResponse.json(
      { error: 'Market signal temporarily unavailable' },
      { status: 503 },
    );
  }
}
