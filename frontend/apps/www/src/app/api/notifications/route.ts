import { NextRequest, NextResponse } from 'next/server';
import { buildForwardAuthHeaders, withProtectedRoute } from '@/lib/api/withProtectedRoute';
import { errorResponse } from '@/lib/api/errorResponse';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function GET(req: NextRequest) {
  try {
    return withProtectedRoute(
      req,
      {
        routeKey: 'notifications-list',
        ipLimit: 360,
        deviceLimit: 240,
        windowSeconds: 900,
      },
      async (ctx) => {
        const query = req.nextUrl.searchParams.toString();
        const upstreamUrl = query
          ? `${MARKETPLACE_URL}/v1/notifications?${query}`
          : `${MARKETPLACE_URL}/v1/notifications`;
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
    console.error('[NOTIFICATIONS_LIST_ERROR]', error);
    return errorResponse(503, 'Service unavailable');
  }
}
