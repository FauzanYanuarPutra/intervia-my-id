import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { shouldUseSecureAuthCookies } from '@/lib/auth-session';
import {
  resolveUsahaGoogleCallbackUri,
  resolveUsahaPublicOrigin,
} from '@/lib/oauth-origin';

const GOOGLE_OAUTH_STATE_COOKIE = 'google_oauth_state';

function safeCallback(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value.slice(0, 2048);
}

function publicOrigin(req: NextRequest): string {
  return resolveUsahaPublicOrigin({
    configuredOrigin:
      process.env.NEXT_PUBLIC_USAHA_URL || process.env.NEXT_PUBLIC_APP_URL,
    requestOrigin: req.nextUrl.origin,
  });
}

function redirectUri(req: NextRequest): string {
  return resolveUsahaGoogleCallbackUri({
    publicOrigin: publicOrigin(req),
    configuredRedirectUri: process.env.USAHA_GOOGLE_REDIRECT_URI,
  });
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL('/login?error=oauth_not_configured', publicOrigin(req)),
    );
  }

  const callbackUrl = safeCallback(req.nextUrl.searchParams.get('callbackUrl'));
  const nonce = randomUUID();
  const state = Buffer.from(JSON.stringify({ nonce, callbackUrl })).toString(
    'base64url',
  );
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });
  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: shouldUseSecureAuthCookies(req.url),
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });
  return response;
}
