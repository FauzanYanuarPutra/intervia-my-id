import { NextRequest } from 'next/server';
import { withIdempotency } from '@/lib/idempotency';
import { CreateCounterOfferSchema } from '@/lib/transactionSchemas';
import { withProtectedRoute, buildForwardAuthHeaders } from '@/lib/api/withProtectedRoute';
import { withValidatedBody } from '@/lib/api/withValidatedBody';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const body = await withValidatedBody(req, CreateCounterOfferSchema);
  if (!body.ok) return body.response;

  return withProtectedRoute(
    req,
    {
      routeKey: 'tx-counter-offer',
      ipLimit: 180,
      deviceLimit: 120,
      windowSeconds: 900,
    },
    async (ctx) =>
      withIdempotency(req, {
        scope: `tx-counter-offer:${id}`,
        actorHint: ctx.token,
        forward: () =>
          fetch(`${MARKETPLACE_URL}/v1/transactions/${id}/counter-offer`, {
            method: 'PUT',
            headers: buildForwardAuthHeaders(ctx, {
              'Content-Type': 'application/json',
              'X-Idempotency-Key': req.headers.get('x-idempotency-key') || '',
            }),
            body: JSON.stringify(body.data),
          }),
      }),
  );
}

