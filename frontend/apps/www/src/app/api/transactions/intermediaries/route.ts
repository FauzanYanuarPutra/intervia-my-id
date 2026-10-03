import { NextRequest, NextResponse } from 'next/server';
import { withProtectedRoute, buildForwardAuthHeaders } from '@/lib/api/withProtectedRoute';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function GET(req: NextRequest) {
  try {
    return withProtectedRoute(
      req,
      {
        routeKey: 'tx-intermediaries',
        ipLimit: 120,
        deviceLimit: 80,
        windowSeconds: 900,
      },
      async ctx => {
        const response = await fetch(MARKETPLACE_URL + '/v1/transaction-intermediaries', {
          method: 'GET',
          headers: buildForwardAuthHeaders(ctx),
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));
        return NextResponse.json(payload, { status: response.status });
      },
    );
  } catch (error) {
    console.error('[TRANSACTION_INTERMEDIARIES_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
