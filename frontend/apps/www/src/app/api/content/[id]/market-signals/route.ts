import { NextRequest, NextResponse } from 'next/server';
import { extractContentId } from '@/lib/content/routes';
import { requireAuth } from '@/lib/serverAuth';

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
