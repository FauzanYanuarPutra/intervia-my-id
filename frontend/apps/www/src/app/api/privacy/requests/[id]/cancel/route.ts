import { NextRequest, NextResponse } from 'next/server';
import { buildForwardAuthHeaders, withProtectedRoute } from '@/lib/api/withProtectedRoute';
import { errorResponse } from '@/lib/api/errorResponse';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080';

type Props = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
    }

    return withProtectedRoute(
      req,
      {
        routeKey: 'privacy-request-cancel',
        ipLimit: 30,
        deviceLimit: 20,
        windowSeconds: 900,
      },
      async ctx => {
        const upstream = await fetch(
          `${API_URL}/privacy/requests/${encodeURIComponent(id)}/cancel`,
          {
            method: 'POST',
            headers: buildForwardAuthHeaders(ctx),
            cache: 'no-store',
            signal: AbortSignal.timeout(15_000),
          },
        );

        const payload = await upstream.text();
        return new NextResponse(payload, {
          status: upstream.status,
          headers: {
            'Content-Type': upstream.headers.get('content-type') || 'application/json',
            'Cache-Control': 'no-store',
          },
        });
      },
    );
  } catch (error) {
    console.error('[PRIVACY_REQUEST_CANCEL_ERROR]', error);
    return errorResponse(503, 'Service unavailable');
  }
}
