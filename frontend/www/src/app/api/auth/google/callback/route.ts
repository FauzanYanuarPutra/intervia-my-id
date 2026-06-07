import { NextRequest, NextResponse } from 'next/server';
import { logAuditEvent } from '@/lib/audit';
import { createSession } from '@/lib/session';
import {
  authSecurityHeaders,
  enforceAuthRouteSecurity,
} from '@/lib/authSecurity';
import { shouldUseSecureCookies } from '@/lib/server/forwardCookies';
import { DEFAULT_PROFILE_AVATAR } from '@/lib/profile/avatar';
import { z } from 'zod';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || `${BASE_URL}/api/auth/google/callback`;
const API_URL = process.env.INTERNAL_API_URL || 'http://identity_service:8080';
const GoogleCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token: string;
  expires_in: number;
  token_type: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  given_name?: string;
  family_name?: string;
}

interface BackendOAuthResponse {
  access_token: string;
  refresh_token?: string;
  session_id?: string;
  user?: {
    id?: string;
  };
}

function sanitizeCallbackPath(input: string | undefined): string {
  const fallback = '/home';
  if (!input) return fallback;
  if (!input.startsWith('/')) return fallback;
  if (input.startsWith('//')) return fallback;
  return input;
}

function getPreferredLocale(
  req: NextRequest,
  callbackUrl?: string,
): 'id' | 'en' {
  if (callbackUrl?.startsWith('/en')) return 'en';
  if (callbackUrl?.startsWith('/id')) return 'id';
  const cookieLocale =
    req.cookies.get('NEXT_LOCALE')?.value || req.cookies.get('locale')?.value;
  return cookieLocale === 'en' ? 'en' : 'id';
}

/**
 * Handle Google OAuth callback
 */
export async function GET(req: NextRequest) {
  const secure = shouldUseSecureCookies(req);
  try {
    const { searchParams } = new URL(req.url);
    const parsedQuery = GoogleCallbackQuerySchema.safeParse({
      code: searchParams.get('code') ?? undefined,
      state: searchParams.get('state') ?? undefined,
      error: searchParams.get('error') ?? undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Invalid callback query' },
        { status: 400 },
      );
    }

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'google-oauth-callback',
      ipLimit: 180,
      deviceLimit: 120,
      windowSeconds: 900,
    });
    if (!security.ok) return security.response;

    const { code, state, error } = parsedQuery.data;

    // Parse callback URL from state
    let callbackUrl = '/home';
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        callbackUrl = sanitizeCallbackPath(stateData.callbackUrl);
      } catch {}
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const preferredLocale = getPreferredLocale(req, callbackUrl);

    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(
        `${baseUrl}/${preferredLocale}/login?error=oauth_failed`,
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${baseUrl}/${preferredLocale}/login?error=no_code`,
      );
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.redirect(
        `${baseUrl}/${preferredLocale}/login?error=oauth_not_configured`,
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Failed to exchange code for tokens');
      return NextResponse.redirect(
        `${baseUrl}/${preferredLocale}/login?error=token_exchange_failed`,
      );
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // Get user info from Google
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info from Google');
      return NextResponse.redirect(
        `${baseUrl}/${preferredLocale}/login?error=user_info_failed`,
      );
    }

    const googleUser: GoogleUserInfo = await userInfoResponse.json();

    // Send to our backend to create/link user
    const backendResponse = await fetch(`${API_URL}/auth/oauth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authSecurityHeaders(security),
      },
      body: JSON.stringify({
        provider_user_id: googleUser.sub,
        email: googleUser.email,
        email_verified: googleUser.email_verified,
        name: googleUser.name,
        avatar_url: DEFAULT_PROFILE_AVATAR,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      }),
    });

    if (!backendResponse.ok) {
      console.error('Backend OAuth failed');
      return NextResponse.redirect(
        `${baseUrl}/${preferredLocale}/login?error=backend_failed`,
      );
    }

    const authData: BackendOAuthResponse = await backendResponse.json();
    const userId = authData.user?.id;
    const backendSessionId = authData.session_id?.trim() || undefined;
    if (!userId || !authData.access_token) {
      console.error('Backend OAuth response missing required fields');
      return NextResponse.redirect(
        `${baseUrl}/${preferredLocale}/login?error=backend_invalid_response`,
      );
    }

    // Mirror backend session_id to local session registry when provided.
    const session = await createSession(userId, {
      userAgent: req.headers.get('user-agent') || 'Unknown',
      ipAddress:
        req.headers.get('x-forwarded-for') ||
        req.headers.get('x-real-ip') ||
        '127.0.0.1',
      sessionId: backendSessionId,
    });
    const sessionId = backendSessionId || session.id;

    // Log audit event
    await logAuditEvent(userId, 'user.login.success', {
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
      eventData: { method: 'google_oauth', email: googleUser.email },
    });

    // Create response with cookies
    const response = NextResponse.redirect(
      `${baseUrl}/${preferredLocale}${callbackUrl}`,
    );

    response.cookies.set('access_token', authData.access_token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
    });

    if (authData.refresh_token) {
      response.cookies.set('refresh_token', authData.refresh_token, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    }

    response.cookies.set('session_id', sessionId, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (e) {
    console.error('Google OAuth callback error:', e);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const preferredLocale = getPreferredLocale(req);
    return NextResponse.redirect(
      `${baseUrl}/${preferredLocale}/login?error=oauth_error`,
    );
  }
}
