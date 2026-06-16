import { NextRequest, NextResponse } from 'next/server';
import { buildForwardAuthHeaders, withProtectedRoute } from '@/lib/api/withProtectedRoute';
import { errorResponse } from '@/lib/api/errorResponse';
import { paymentsEnabled } from '@/lib/server/paymentFeature';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function GET(req: NextRequest) {
  try {
    if (!paymentsEnabled()) {
      return NextResponse.json(
        { error: 'Wallet is disabled for now' },
        { status: 404 },
      );
    }
    return withProtectedRoute(
      req,
      {
        routeKey: 'wallet-balance',
        ipLimit: 300,
        deviceLimit: 180,
        windowSeconds: 900,
      },
      async (ctx) => {
        const upstream = await fetch(`${MARKETPLACE_URL}/v1/wallet/balance`, {
          method: 'GET',
          headers: buildForwardAuthHeaders(ctx),
          cache: 'no-store',
        });

        const payload = await upstream.json().catch(() => ({}));
        return NextResponse.json(payload, { status: upstream.status });
      },
    );
  } catch (error) {
    console.error('[WALLET_BALANCE_GET_ERROR]', error);
    return errorResponse(503, 'Service unavailable');
  }
}

