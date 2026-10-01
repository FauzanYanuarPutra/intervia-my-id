import { NextRequest, NextResponse } from 'next/server';
import { withIdempotency } from '@/lib/idempotency';
import { TransactionActionSchema } from '@/lib/transactionSchemas';
import {
  buildForwardAuthHeaders,
  withProtectedRoute,
} from '@/lib/api/withProtectedRoute';
import { withValidatedBody } from '@/lib/api/withValidatedBody';

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
    const body = await withValidatedBody(req, TransactionActionSchema);
    if (!body.ok) return body.response;

    return withProtectedRoute(
      req,
      {
        routeKey: 'tx-correction',
        ipLimit: 60,
        deviceLimit: 30,
        windowSeconds: 900,
      },
      async ctx =>
        withIdempotency(req, {
          scope: `tx-correction:${id}`,
          actorHint: ctx.userId,
          forward: () =>
            fetch(`${MARKETPLACE_URL}/v1/transactions/${id}/correction`, {
              method: 'POST',
              headers: buildForwardAuthHeaders(ctx, {
                'Content-Type': 'application/json',
                'X-Idempotency-Key':
                  req.headers.get('x-idempotency-key') || '',
              }),
              body: JSON.stringify(body.data),
            }),
        }),
    );
  } catch (error) {
    console.error('[TRANSACTION_CORRECTION_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
