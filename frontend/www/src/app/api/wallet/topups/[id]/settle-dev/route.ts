import { NextRequest } from 'next/server';
import { withIdempotency } from '@/lib/idempotency';
import { buildForwardAuthHeaders, withProtectedRoute } from '@/lib/api/withProtectedRoute';
import { errorResponse } from '@/lib/api/errorResponse';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

function isProductionLikeEnv(): boolean {
  const appEnv = (
    process.env.APP_ENV ||
    process.env.ENV ||
    process.env.NEXT_PUBLIC_APP_ENV ||
    ''
  )
    .trim()
    .toLowerCase();

  return ['production', 'prod', 'live'].includes(appEnv);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    if (isProductionLikeEnv()) {
      return errorResponse(404, 'Not found');
    }

    return withProtectedRoute(
      req,
      {
        routeKey: 'wallet-topup-settle-dev',
        ipLimit: 120,
        deviceLimit: 80,
        windowSeconds: 900,
      },
      async (ctx) =>
        withIdempotency(req, {
          scope: `wallet-topup-settle-dev:${id}`,
          actorHint: ctx.userId,
          forward: () =>
            fetch(`${MARKETPLACE_URL}/v1/wallet/topups/${encodeURIComponent(id)}/settle-dev`, {
              method: 'POST',
              headers: buildForwardAuthHeaders(ctx, {
                'X-Idempotency-Key': req.headers.get('x-idempotency-key') || '',
              }),
            }),
        }),
    );
  } catch (error) {
    console.error('[WALLET_TOPUP_SETTLE_DEV_POST_ERROR]', error);
    return errorResponse(503, 'Service unavailable');
  }
}

