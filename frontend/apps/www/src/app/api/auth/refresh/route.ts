import { NextRequest, NextResponse } from 'next/server';
import {
  clearAuthCookies,
  forwardSetCookieHeaders,
  readSetCookiesFromFetchResponse,
  shouldUseSecureCookies,
} from '@/lib/server/forwardCookies';
import { authSecurityHeaders, enforceAuthRouteSecurity } from '@/lib/authSecurity';
import {
  isRefreshSessionRevoked,
  isRefreshTokenRevoked,
} from '@/lib/redis';

const API_URL = process.env.INTERNAL_API_URL || 'http://identity_service:8080';
const IS_PROD = process.env.NODE_ENV === 'production';

export async function POST(req: NextRequest) {
  const secure = shouldUseSecureCookies(req);
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'refresh',
      ipLimit: 360,
      deviceLimit: 240,
      windowSeconds: 900,
    });
    if (!security.ok) return security.response;

    const body = await req.json().catch(() => ({}));
    // Prefer HttpOnly cookies as source of truth because refresh token rotates on every refresh.
    const refreshToken =
      req.cookies.get('refresh_token')?.value || body.refresh_token;
    const sessionId = req.cookies.get('session_id')?.value || body.session_id;

    if (!refreshToken || !sessionId) {
      const response = NextResponse.json(
        {
          access_token: null,
          active: false,
          error: 'Missing tokens',
          shouldClearLocalAuth: !IS_PROD,
        },
        { status: 401 },
      );
      clearAuthCookies(response, secure);
      return response;
    }

    const [revokedToken, revokedSession] = await Promise.all([
      isRefreshTokenRevoked(refreshToken),
      isRefreshSessionRevoked(sessionId),
    ]);
    if (revokedToken || revokedSession) {
      const response = NextResponse.json(
        {
          access_token: null,
          active: false,
          error: 'Refresh token revoked',
          shouldClearLocalAuth: !IS_PROD,
        },
        { status: 401 },
      );
      clearAuthCookies(response, secure);
      return response;
    }

    const backendRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authSecurityHeaders(security),
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
        session_id: sessionId,
      }),
    });

    const text = await backendRes.text();
    let data: Record<string, unknown> = {};
    try {
      const parsed = text ? JSON.parse(text) : {};
      data = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      data = {};
    }

    if (!backendRes.ok) {
      if (backendRes.status === 401 || backendRes.status === 403) {
        const response = NextResponse.json(
          {
            ...data,
            access_token: null,
            active: false,
            shouldClearLocalAuth: !IS_PROD,
          },
          { status: backendRes.status },
        );
        clearAuthCookies(response, secure);
        return response;
      }

      return NextResponse.json(
        { ...data, shouldClearLocalAuth: !IS_PROD },
        { status: backendRes.status },
      );
    }

    const response = NextResponse.json(data);
    forwardSetCookieHeaders(response, readSetCookiesFromFetchResponse(backendRes), {
      secure,
    });
    response.cookies.set({
      name: 'auth_present',
      value: '1',
      path: '/',
      httpOnly: false,
      secure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (err) {
    console.error('[REFRESH_CRITICAL_ERROR]', err);
    return NextResponse.json(
      { error: 'Authentication service down', shouldClearLocalAuth: !IS_PROD },
      { status: 503 },
    );
  }
}

