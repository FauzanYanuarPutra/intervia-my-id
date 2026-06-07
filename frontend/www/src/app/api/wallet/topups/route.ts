import { NextRequest, NextResponse } from 'next/server';
import { withIdempotency } from '@/lib/idempotency';
import { buildForwardAuthHeaders, withProtectedRoute } from '@/lib/api/withProtectedRoute';
import { withValidatedBody } from '@/lib/api/withValidatedBody';
import { errorResponse } from '@/lib/api/errorResponse';
import { CreateWalletTopupSchema } from '@/lib/walletSchemas';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function GET(req: NextRequest) {
  try {
    return withProtectedRoute(
      req,
      {
        routeKey: 'wallet-topups',
        ipLimit: 300,
        deviceLimit: 180,
        windowSeconds: 900,
      },
      async (ctx) => {
        const query = req.nextUrl.searchParams.toString();
        const upstreamUrl = query
          ? `${MARKETPLACE_URL}/v1/wallet/topups?${query}`
          : `${MARKETPLACE_URL}/v1/wallet/topups`;

        const upstream = await fetch(upstreamUrl, {
          method: 'GET',
          headers: buildForwardAuthHeaders(ctx),
          cache: 'no-store',
        });

        const payload = await upstream.json().catch(() => ({}));
        return NextResponse.json(payload, { status: upstream.status });
      },
    );
  } catch (error) {
    console.error('[WALLET_TOPUPS_GET_ERROR]', error);
    return errorResponse(503, 'Service unavailable');
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await withValidatedBody(req, CreateWalletTopupSchema);
    if (!body.ok) return body.response;

    return withProtectedRoute(
      req,
      {
        routeKey: 'wallet-topup-create',
        ipLimit: 120,
        deviceLimit: 80,
        windowSeconds: 900,
      },
      async (ctx) =>
        withIdempotency(req, {
          scope: `wallet-topup:${body.data.environment || 'default'}:${body.data.currency || 'IDR'}`,
          actorHint: ctx.userId,
          forward: () =>
            fetch(`${MARKETPLACE_URL}/v1/wallet/topups`, {
              method: 'POST',
              headers: buildForwardAuthHeaders(ctx, {
                'Content-Type': 'application/json',
                'X-Idempotency-Key': req.headers.get('x-idempotency-key') || '',
              }),
              body: JSON.stringify(body.data),
            }),
        }),
    );
  } catch (error) {
    console.error('[WALLET_TOPUPS_POST_ERROR]', error);
    return errorResponse(503, 'Service unavailable');
  }
}

