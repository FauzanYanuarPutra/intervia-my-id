import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_OAUTH_STATE_COOKIE = 'crm_google_oauth_state';

function requestOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedHost && forwardedProto) return forwardedProto + '://' + forwardedHost;
  return req.nextUrl.origin;
}

function redirectUri(req: NextRequest): string {
  return process.env.CRM_GOOGLE_REDIRECT_URI || requestOrigin(req) + '/api/auth/google/callback';
}

function safeCallback(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  return value.slice(0, 2048);
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = requestOrigin(req);
  if (!clientId) {
    return NextResponse.redirect(new URL('/login?error=google_not_configured', baseUrl));
  }

  const callbackUrl = safeCallback(req.nextUrl.searchParams.get('callbackUrl'));
  const nonce = randomUUID();
  const state = Buffer.from(JSON.stringify({ nonce, callbackUrl })).toString('base64url');

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
    'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString(),
  );
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });
  return response;
}
