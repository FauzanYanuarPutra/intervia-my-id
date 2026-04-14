import { NextRequest, NextResponse } from 'next/server';
import {
  buildForwardAuthHeaders,
  withProtectedRoute,
} from '@/lib/api/withProtectedRoute';
import { withIdempotency } from '@/lib/idempotency';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    return withProtectedRoute(
      req,
      {
        routeKey: 'tx-fund',
        ipLimit: 180,
        deviceLimit: 120,
        windowSeconds: 900,
      },
      async ctx =>
        withIdempotency(req, {
          scope: `tx-fund:${id}`,
          actorHint: ctx.token,
          forward: () =>
            fetch(`${MARKETPLACE_URL}/v1/transactions/${id}/fund`, {
              method: 'POST',
              headers: buildForwardAuthHeaders(ctx, {
                'X-Idempotency-Key': req.headers.get('x-idempotency-key') || '',
              }),
            }),
        }),
    );
  } catch (error) {
    console.error('[TRANSACTION_FUND_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
