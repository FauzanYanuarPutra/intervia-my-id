import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  shouldUseSecureAuthCookies,
  writeAuthCookies,
} from '@/lib/auth-session';
import {
  resolveUsahaGoogleCallbackUri,
  resolveUsahaPublicOrigin,
} from '@/lib/oauth-origin';

const IDENTITY_URL =
  process.env.INTERNAL_API_URL ||
  process.env.INTERNAL_IDENTITY_URL ||
  'http://identity_service:8080';
const GOOGLE_OAUTH_STATE_COOKIE = 'google_oauth_state';

function requestOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedHost && forwardedProto) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return req.nextUrl.origin;
}

function publicOrigin(req: NextRequest): string {
  return resolveUsahaPublicOrigin({
    configuredOrigin:
      process.env.NEXT_PUBLIC_USAHA_URL || process.env.NEXT_PUBLIC_APP_URL,
    requestOrigin: requestOrigin(req),
  });
}

function redirectUri(req: NextRequest): string {
  return resolveUsahaGoogleCallbackUri({
    publicOrigin: publicOrigin(req),
    configuredRedirectUri: process.env.USAHA_GOOGLE_REDIRECT_URI,
  });
}

function safeCallback(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value.slice(0, 2048)
    : '/';
}

function stateMatches(a: string, b: string): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function failure(req: NextRequest, code: string) {
  const response = NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(code)}`, publicOrigin(req)),
  );
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    secure: shouldUseSecureAuthCookies(req.url),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    const rawState = req.nextUrl.searchParams.get('state');
    if (!code || !rawState) return failure(req, 'oauth_callback_invalid');

    let state: { nonce?: string; callbackUrl?: string } = {};
    try {
      state = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8'));
    } catch {
      return failure(req, 'oauth_state_invalid');
    }
    const cookieNonce = req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value || '';
    if (!stateMatches(state.nonce || '', cookieNonce)) {
      return failure(req, 'oauth_state_invalid');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return failure(req, 'oauth_not_configured');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri(req),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) return failure(req, 'token_exchange_failed');
    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token: string;
    };

    const infoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );
    if (!infoResponse.ok) return failure(req, 'google_profile_failed');
    const googleUser = (await infoResponse.json()) as {
      sub: string;
      email: string;
      email_verified: boolean;
      name: string;
      picture?: string;
    };

    const backendResponse = await fetch(`${IDENTITY_URL}/auth/oauth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_token: tokens.id_token,
        provider_user_id: googleUser.sub,
        email: googleUser.email,
        email_verified: googleUser.email_verified,
        name: googleUser.name,
        avatar_url: googleUser.picture || '',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      }),
    });
    if (!backendResponse.ok) return failure(req, 'identity_oauth_failed');
    const auth = (await backendResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      session_id?: string;
    };
    if (!auth.access_token) return failure(req, 'identity_oauth_invalid');

    const response = NextResponse.redirect(
      new URL(safeCallback(state.callbackUrl), publicOrigin(req)),
    );
    writeAuthCookies(
      response,
      {
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
        session_id: auth.session_id,
      },
      shouldUseSecureAuthCookies(req.url),
    );
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', {
      httpOnly: true,
      secure: shouldUseSecureAuthCookies(req.url),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch {
    return failure(req, 'oauth_error');
  }
}
