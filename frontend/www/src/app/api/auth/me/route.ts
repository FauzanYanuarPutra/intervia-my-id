import { NextRequest, NextResponse } from 'next/server';
import {
  withProtectedRoute,
  buildForwardAuthHeaders,
} from '@/lib/api/withProtectedRoute';
import { errorResponse } from '@/lib/api/errorResponse';
import { normalizeProfilePayloadMedia } from '@/lib/profile/profileMedia';

const API_URL = process.env.INTERNAL_API_URL || 'http://identity_service:8080';
const IS_DEV = process.env.NODE_ENV !== 'production';

function normalizeMePayload(payload: unknown): unknown {
  return normalizeProfilePayloadMedia(payload);
}

export async function GET(req: NextRequest) {
  try {
    return withProtectedRoute(
      req,
      {
        routeKey: 'me',
        ipLimit: 600,
        deviceLimit: 500,
        windowSeconds: 900,
      },
      async ctx => {
        const backendRes = await fetch(`${API_URL}/auth/me`, {
          method: 'GET',
          headers: buildForwardAuthHeaders(ctx, {
            ...(req.headers.get('cookie')
              ? { Cookie: req.headers.get('cookie')! }
              : {}),
          }),
          cache: 'no-store',
        });

        const text = await backendRes.text();
        let payload: unknown = {};
        try {
          payload = text ? JSON.parse(text) : {};
        } catch {
          payload = { error: 'Invalid JSON response from auth service' };
        }

        if (!backendRes.ok) {
          const body = payload as Record<string, unknown>;
          return NextResponse.json(
            { ...body, shouldClearLocalAuth: IS_DEV },
            { status: backendRes.status },
          );
        }

        return NextResponse.json(normalizeMePayload(payload));
      },
    );
  } catch (error) {
    console.error('[AUTH_ME_CRITICAL_ERROR]', error);
    return errorResponse(503, 'Service unavailable');
  }
}
