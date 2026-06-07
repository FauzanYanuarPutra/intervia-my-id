import { NextRequest, NextResponse } from 'next/server';
import { withIdempotency } from '@/lib/idempotency';
import { TransactionDisputeResolveSchema } from '@/lib/transactionSchemas';
import { withProtectedRoute, buildForwardAuthHeaders } from '@/lib/api/withProtectedRoute';
import { withValidatedBody } from '@/lib/api/withValidatedBody';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const body = await withValidatedBody(req, TransactionDisputeResolveSchema);
    if (!body.ok) return body.response;

    return withProtectedRoute(
      req,
      {
        routeKey: 'tx-resolve',
        ipLimit: 120,
        deviceLimit: 80,
        windowSeconds: 900,
      },
      async (ctx) =>
        withIdempotency(req, {
          scope: `tx-resolve:${id}`,
          actorHint: ctx.userId,
          forward: () =>
            fetch(`${MARKETPLACE_URL}/v1/transactions/${id}/resolve`, {
              method: 'PUT',
              headers: buildForwardAuthHeaders(ctx, {
                'Content-Type': 'application/json',
                'X-Idempotency-Key': req.headers.get('x-idempotency-key') || '',
              }),
              body: JSON.stringify(body.data),
            }),
        }),
    );
  } catch (error) {
    console.error('[TRANSACTION_RESOLVE_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
