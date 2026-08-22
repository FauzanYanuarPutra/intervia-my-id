import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { shouldUseSecureCookies } from '@/lib/server/forwardCookies';
import { isExternalHttpsRequired } from '@/lib/auth/runtimeConfig';
import {
  preferredLocaleForCallback,
  resolvePublicOrigin,
  sanitizeInternalCallbackPath,
} from '@/lib/auth/oauthRedirects';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_OAUTH_STATE_COOKIE = 'google_oauth_state';

function getPublicBaseUrl(req: NextRequest): string {
  return resolvePublicOrigin({
    configuredOrigin:
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_WWW_URL,
    requestOrigin: req.nextUrl.origin,
    production: isExternalHttpsRequired(),
  });
}

function getGoogleRedirectUri(req: NextRequest): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `${getPublicBaseUrl(req)}/api/auth/google/callback`
  );
}

function getPreferredLocale(req: NextRequest, callbackUrl: string): 'id' | 'en' {
  const cookieLocale =
    req.cookies.get('NEXT_LOCALE')?.value || req.cookies.get('locale')?.value;
  return preferredLocaleForCallback(callbackUrl, cookieLocale);
}

/**
 * Redirect to Google OAuth consent page
 */
export async function GET(req: NextRequest) {
  const security = await enforceAuthRouteSecurity(req, {
    routeKey: 'google-oauth-start',
    ipLimit: 120,
    deviceLimit: 80,
    windowSeconds: 900,
  });
  if (!security.ok) return security.response;

  const { searchParams } = new URL(req.url);
  const callbackUrl = sanitizeInternalCallbackPath(
    searchParams.get('callbackUrl'),
  );
  const preferredLocale = getPreferredLocale(req, callbackUrl);
  const baseUrl = getPublicBaseUrl(req);

  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.redirect(`${baseUrl}/${preferredLocale}/login?error=oauth_not_configured`);
  }

  const nonce = randomUUID();
  const state = Buffer.from(JSON.stringify({ callbackUrl, nonce })).toString(
    'base64url',
  );

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getGoogleRedirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: shouldUseSecureCookies(req),
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });

  return response;
}
