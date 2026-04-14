import { NextRequest, NextResponse } from 'next/server';
import { buildForwardAuthHeaders, withProtectedRoute } from '@/lib/api/withProtectedRoute';
import { errorResponse } from '@/lib/api/errorResponse';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function POST(req: NextRequest) {
  try {
    return withProtectedRoute(
      req,
      {
        routeKey: 'notifications-read-all',
        ipLimit: 180,
        deviceLimit: 120,
        windowSeconds: 900,
      },
      async (ctx) => {
        const upstream = await fetch(`${MARKETPLACE_URL}/v1/notifications/read-all`, {
          method: 'POST',
          headers: buildForwardAuthHeaders(ctx),
        });

        const payload = await upstream.json().catch(() => ({}));
        return NextResponse.json(payload, { status: upstream.status });
      },
    );
  } catch (error) {
    console.error('[NOTIFICATIONS_READ_ALL_ERROR]', error);
    return errorResponse(503, 'Service unavailable');
  }
}
