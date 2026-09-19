import { NextRequest, NextResponse } from 'next/server';
import { buildForwardAuthHeaders, withProtectedRoute } from '@/lib/api/withProtectedRoute';
import { errorResponse } from '@/lib/api/errorResponse';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080';

async function forward(req: NextRequest, method: 'GET' | 'POST', body?: string) {
  try {
    return withProtectedRoute(
      req,
      {
        routeKey: 'privacy-request-center',
        ipLimit: method === 'POST' ? 30 : 120,
        deviceLimit: method === 'POST' ? 20 : 80,
        windowSeconds: 900,
      },
      async ctx => {
        const response = await fetch(
          `${API_URL}/privacy/requests${method === 'GET' ? '/mine' : ''}`,
          {
            method,
            headers: buildForwardAuthHeaders(ctx),
            ...(method === 'POST'
              ? {
                  body,
                  headers: {
                    ...buildForwardAuthHeaders(ctx),
                    'content-type': 'application/json',
                  },
                }
              : {}),
            cache: 'no-store',
            signal: AbortSignal.timeout(15_000),
          },
        );

        const payload = await response.text();
        return new NextResponse(payload, {
          status: response.status,
          headers: {
            'Content-Type': response.headers.get('content-type') || 'application/json',
            'Cache-Control': 'no-store',
          },
        });
      },
    );
  } catch (error) {
    console.error('[PRIVACY_REQUEST_API_ERROR]', error);
    return errorResponse(503, 'Service unavailable');
  }
}

export async function GET(req: NextRequest) {
  return forward(req, 'GET');
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  if (body.length > 20_000) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }
  return forward(req, 'POST', body);
}
