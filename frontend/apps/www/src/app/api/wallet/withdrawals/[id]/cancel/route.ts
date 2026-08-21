import { NextRequest } from 'next/server';
import { withIdempotency } from '@/lib/idempotency';
import { buildForwardAuthHeaders, withProtectedRoute } from '@/lib/api/withProtectedRoute';
import { errorResponse } from '@/lib/api/errorResponse';

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
        routeKey: 'wallet-withdrawal-cancel',
        ipLimit: 60,
        deviceLimit: 30,
        windowSeconds: 900,
      },
      async (ctx) =>
        withIdempotency(req, {
          scope: `wallet-withdrawal-cancel:${id}`,
          actorHint: ctx.userId,
          forward: () =>
            fetch(`${MARKETPLACE_URL}/v1/wallet/withdrawals/${encodeURIComponent(id)}/cancel`, {
              method: 'POST',
              headers: buildForwardAuthHeaders(ctx, {
                'X-Idempotency-Key': req.headers.get('x-idempotency-key') || '',
              }),
            }),
        }),
    );
  } catch (error) {
    console.error('[WALLET_WITHDRAWAL_CANCEL_POST_ERROR]', error);
    return errorResponse(503, 'Service unavailable');
  }
}
