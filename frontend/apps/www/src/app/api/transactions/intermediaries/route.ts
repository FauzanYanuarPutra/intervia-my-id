import { NextRequest, NextResponse } from 'next/server';

import {
  buildForwardAuthHeaders,
  withProtectedRoute,
} from '@/lib/api/withProtectedRoute';

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
      async ctx =>
        fetch(MARKETPLACE_URL + '/v1/transaction-intermediaries', {
          method: 'GET',
          headers: buildForwardAuthHeaders(ctx),
          cache: 'no-store',
        }),
    );
  } catch (error) {
    console.error('[TRANSACTION_INTERMEDIARIES_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
