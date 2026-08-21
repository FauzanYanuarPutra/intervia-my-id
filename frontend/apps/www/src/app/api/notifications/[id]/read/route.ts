import { NextRequest, NextResponse } from 'next/server';
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
        routeKey: 'notifications-mark-read',
        ipLimit: 300,
        deviceLimit: 220,
        windowSeconds: 900,
      },
      async (ctx) => {
        const upstream = await fetch(
          `${MARKETPLACE_URL}/v1/notifications/${encodeURIComponent(id)}/read`,
          {
            method: 'POST',
            headers: buildForwardAuthHeaders(ctx),
          },
        );

        const payload = await upstream.json().catch(() => ({}));
        return NextResponse.json(payload, { status: upstream.status });
      },
    );
  } catch (error) {
    console.error('[NOTIFICATIONS_MARK_READ_ERROR]', error);
    return errorResponse(503, 'Service unavailable');
  }
}
