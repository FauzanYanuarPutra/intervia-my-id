import { NextRequest, NextResponse } from 'next/server';
import { authSecurityHeaders, enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { revokeRefreshSession, revokeRefreshToken } from '@/lib/redis';
import { shouldUseSecureCookies, clearAuthCookies } from '@/lib/server/forwardCookies';

const API_URL = process.env.INTERNAL_API_URL || 'http://identity_service:8080';

export async function POST(req: NextRequest) {
  const secure = shouldUseSecureCookies(req);

  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'logout',
      ipLimit: 240,
      deviceLimit: 160,
      windowSeconds: 900,
    });
    if (!security.ok) return security.response;

    const refreshToken = req.cookies.get('refresh_token')?.value;
    const sessionId = req.cookies.get('session_id')?.value;
    const cookieHeader = req.headers.get('cookie');

    const backendRes = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authSecurityHeaders(security),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    }).catch((error) => {
      console.warn('[LOGOUT_BACKEND_UNREACHABLE]', error);
      return null;
    });

    await Promise.all([
      refreshToken ? revokeRefreshToken(refreshToken) : Promise.resolve(),
      sessionId ? revokeRefreshSession(sessionId) : Promise.resolve(),
    ]);

    const response = NextResponse.json(
      {
        success: true,
        message: 'Logged out successfully',
        shouldClearLocalAuth: true,
        backendUnavailable: backendRes === null,
      },
      { status: 200 },
    );
    clearAuthCookies(response, secure);
    return response;
  } catch (error) {
    console.error('[LOGOUT_CRITICAL_ERROR]', error);
    const response = NextResponse.json(
      {
        success: false,
        error: 'Logout failed. Please retry.',
        shouldClearLocalAuth: true,
      },
      { status: 503 },
    );
    clearAuthCookies(response, secure);
    return response;
  }
}
