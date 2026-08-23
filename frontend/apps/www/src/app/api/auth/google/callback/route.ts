import { NextRequest, NextResponse } from 'next/server';
import { logAuditEvent } from '@/lib/audit';
import { createSession } from '@/lib/session';
import {
  authSecurityHeaders,
  enforceAuthRouteSecurity,
} from '@/lib/authSecurity';
import { shouldUseSecureCookies } from '@/lib/server/forwardCookies';
import { DEFAULT_PROFILE_AVATAR } from '@/lib/profile/avatar';
import {
  localizeCallbackPath,
  preferredLocaleForCallback,
  resolvePublicOrigin,
  safeEqualState,
  sanitizeInternalCallbackPath,
} from '@/lib/auth/oauthRedirects';
import { safeErrorCode } from '@/lib/server/safeLog';
import { isExternalHttpsRequired } from '@/lib/auth/runtimeConfig';
import { z } from 'zod';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const API_URL = process.env.INTERNAL_API_URL || 'http://identity_service:8080';
const GOOGLE_OAUTH_STATE_COOKIE = 'google_oauth_state';
const GoogleCallbackQuerySchema = z.object({
  code: z.string().min(1).max(4096).optional(),
  state: z.string().min(1).max(8192).optional(),
  error: z.string().max(256).optional(),
});
const GoogleStateSchema = z.object({
  callbackUrl: z.string().max(2048).optional(),
  nonce: z.string().uuid(),
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

function getPublicBaseUrl(req: NextRequest): string {
  return resolvePublicOrigin({
    configuredOrigin:
      process.env.NEXT_PUBLIC_WWW_URL || process.env.NEXT_PUBLIC_APP_URL,
    requestOrigin: req.nextUrl.origin,
    production: isExternalHttpsRequired(),
  });
}

function getGoogleRedirectUri(req: NextRequest): string {
  return (
    process.env.WWW_GOOGLE_REDIRECT_URI ||
    process.env.GOOGLE_REDIRECT_URI ||
    `${getPublicBaseUrl(req)}/api/auth/google/callback`
  );
}

function clearGoogleOAuthState(response: NextResponse, secure: boolean) {
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

function getPreferredLocale(
  req: NextRequest,
  callbackUrl = '/home',
): 'id' | 'en' {
  const cookieLocale =
    req.cookies.get('NEXT_LOCALE')?.value || req.cookies.get('locale')?.value;
  return preferredLocaleForCallback(callbackUrl, cookieLocale);
}

function oauthFailureResponse(
  baseUrl: string,
  locale: 'id' | 'en',
  errorCode: string,
  secure: boolean,
) {
  const url = new URL(`/${locale}/login`, baseUrl);
  url.searchParams.set('error', errorCode);
  const response = NextResponse.redirect(url);
  clearGoogleOAuthState(response, secure);
  return response;
}

/**
 * Handle Google OAuth callback.
 *
 * WWW and Usaha share the Google client identity, but each app owns an
 * explicit callback URI so configuration cannot silently drift between hosts.
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

    let callbackUrl = '/home';
    let stateNonce = '';
    if (state) {
      try {
        const parsedState = GoogleStateSchema.safeParse(
          JSON.parse(Buffer.from(state, 'base64url').toString()),
        );
        if (parsedState.success) {
          callbackUrl = sanitizeInternalCallbackPath(
            parsedState.data.callbackUrl,
          );
          stateNonce = parsedState.data.nonce;
        }
      } catch {}
    }

    const baseUrl = getPublicBaseUrl(req);
    const preferredLocale = getPreferredLocale(req, callbackUrl);

    if (error) {
      console.warn('Google OAuth provider returned an error', {
        providerError: error.slice(0, 64),
      });
      return oauthFailureResponse(
        baseUrl,
        preferredLocale,
        'oauth_failed',
        secure,
      );
    }

    if (!code) {
      return oauthFailureResponse(
        baseUrl,
        preferredLocale,
        'no_code',
        secure,
      );
    }

    const cookieNonce = req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value || '';
    if (!safeEqualState(stateNonce, cookieNonce)) {
      return oauthFailureResponse(
        baseUrl,
        preferredLocale,
        'oauth_state_invalid',
        secure,
      );
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return oauthFailureResponse(
        baseUrl,
        preferredLocale,
        'oauth_not_configured',
        secure,
      );
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: getGoogleRedirectUri(req),
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Failed to exchange code for tokens');
      return oauthFailureResponse(
        baseUrl,
        preferredLocale,
        'token_exchange_failed',
        secure,
      );
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info from Google');
      return oauthFailureResponse(
        baseUrl,
        preferredLocale,
        'user_info_failed',
        secure,
      );
    }

    const googleUser: GoogleUserInfo = await userInfoResponse.json();

    const backendResponse = await fetch(`${API_URL}/auth/oauth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authSecurityHeaders(security),
      },
      body: JSON.stringify({
        id_token: tokens.id_token,
        provider_user_id: googleUser.sub,
        email: googleUser.email,
        email_verified: googleUser.email_verified,
        name: googleUser.name,
        avatar_url: googleUser.picture || DEFAULT_PROFILE_AVATAR,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      }),
    });

    if (!backendResponse.ok) {
      console.error('Backend OAuth failed', {
        status: backendResponse.status,
      });
      return oauthFailureResponse(
        baseUrl,
        preferredLocale,
        'backend_failed',
        secure,
      );
    }

    const authData: BackendOAuthResponse = await backendResponse.json();
    const userId = authData.user?.id;
    const backendSessionId = authData.session_id?.trim() || undefined;
    if (!userId || !authData.access_token) {
      console.error('Backend OAuth response missing required fields');
      return oauthFailureResponse(
        baseUrl,
        preferredLocale,
        'backend_invalid_response',
        secure,
      );
    }

    const session = await createSession(userId, {
      userAgent: req.headers.get('user-agent') || 'Unknown',
      ipAddress:
        req.headers.get('x-forwarded-for') ||
        req.headers.get('x-real-ip') ||
        '127.0.0.1',
      sessionId: backendSessionId,
    });
    const sessionId = backendSessionId || session.id;

    await logAuditEvent(userId, 'user.login.success', {
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
      eventData: { method: 'google_oauth', email: googleUser.email },
    });

    const response = NextResponse.redirect(
      new URL(localizeCallbackPath(callbackUrl, preferredLocale), baseUrl),
    );

    response.cookies.set('access_token', authData.access_token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 60 * 60,
    });

    if (authData.refresh_token) {
      response.cookies.set('refresh_token', authData.refresh_token, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    response.cookies.set('session_id', sessionId, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    });

    response.cookies.set('auth_present', '1', {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    clearGoogleOAuthState(response, secure);

    return response;
  } catch (error) {
    console.error('Google OAuth callback error', {
      error: safeErrorCode(error),
    });
    const baseUrl = getPublicBaseUrl(req);
    const preferredLocale = getPreferredLocale(req);
    return oauthFailureResponse(
      baseUrl,
      preferredLocale,
      'oauth_error',
      secure,
    );
  }
}
