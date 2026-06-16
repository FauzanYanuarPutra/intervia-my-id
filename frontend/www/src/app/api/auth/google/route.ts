import { NextRequest, NextResponse } from 'next/server';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

function getPublicBaseUrl(req: NextRequest): string {
  const envBase =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_WWW_URL || '';
  if (envBase.trim()) return envBase.replace(/\/$/, '');
  return req.nextUrl.origin || 'https://www.lajukan.com';
}

function getGoogleRedirectUri(req: NextRequest): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `${getPublicBaseUrl(req)}/api/auth/google/callback`
  );
}

function getPreferredLocale(req: NextRequest, callbackUrl?: string | null): 'id' | 'en' {
  if (callbackUrl?.startsWith('/en')) return 'en';
  if (callbackUrl?.startsWith('/id')) return 'id';
  const cookieLocale =
    req.cookies.get('NEXT_LOCALE')?.value || req.cookies.get('locale')?.value;
  return cookieLocale === 'en' ? 'en' : 'id';
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
  const callbackUrl = searchParams.get('callbackUrl') || '/home';
  const preferredLocale = getPreferredLocale(req, callbackUrl);
  const baseUrl = getPublicBaseUrl(req);

  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.redirect(`${baseUrl}/${preferredLocale}/login?error=oauth_not_configured`);
  }

  // Store callback URL in a cookie for use after OAuth
  const state = Buffer.from(JSON.stringify({ callbackUrl })).toString('base64');

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

  return NextResponse.redirect(url);
}
