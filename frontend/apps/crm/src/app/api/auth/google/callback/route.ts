import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

const IDENTITY_URL =
  process.env.INTERNAL_API_URL ||
  process.env.INTERNAL_IDENTITY_URL ||
  'http://identity_service:8080';
const GOOGLE_OAUTH_STATE_COOKIE = 'crm_google_oauth_state';
const ALLOWED_ROLES = new Set(["sales","admin","support","super_admin"]);

function requestOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedHost && forwardedProto) return forwardedProto + '://' + forwardedHost;
  return req.nextUrl.origin;
}

function redirectUri(req: NextRequest): string {
  return process.env.CRM_GOOGLE_REDIRECT_URI || requestOrigin(req) + '/api/auth/google/callback';
}

function safeCallback(value: unknown): string {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\')
    ? value.slice(0, 2048)
    : '/';
}

function stateMatches(a: string, b: string): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function clearState(response: NextResponse, secure: boolean) {
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

function failure(req: NextRequest, code: string) {
  const response = NextResponse.redirect(
    new URL('/login?error=' + encodeURIComponent(code), requestOrigin(req)),
  );
  clearState(response, req.nextUrl.protocol === 'https:');
  return response;
}

async function revokeSession(token: string) {
  try {
    await fetch(IDENTITY_URL + '/auth/logout', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    });
  } catch {}
}

export async function GET(req: NextRequest) {
  const secure = req.nextUrl.protocol === 'https:';
  try {
    const code = req.nextUrl.searchParams.get('code');
    const stateParam = req.nextUrl.searchParams.get('state');
    const providerError = req.nextUrl.searchParams.get('error');
    if (providerError) return failure(req, 'google_oauth_cancelled');
    if (!code || !stateParam) return failure(req, 'oauth_callback_invalid');

    let state: { nonce?: string; callbackUrl?: string };
    try {
      state = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8'));
    } catch {
      return failure(req, 'oauth_state_invalid');
    }

    const cookieNonce = req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value || '';
    if (!stateMatches(state.nonce || '', cookieNonce)) {
      return failure(req, 'oauth_state_invalid');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return failure(req, 'google_not_configured');

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
    if (!tokenResponse.ok) return failure(req, 'google_token_exchange_failed');

    const tokens = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      id_token?: string;
    };
    if (!tokens.access_token || !tokens.id_token) return failure(req, 'google_token_invalid');

    const infoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: 'Bearer ' + tokens.access_token } },
    );
    if (!infoResponse.ok) return failure(req, 'google_profile_failed');

    const googleUser = (await infoResponse.json()) as {
      sub: string;
      email: string;
      email_verified: boolean;
      name?: string;
      picture?: string;
    };

    if (!googleUser.email || !googleUser.email_verified) {
      return failure(req, 'google_email_not_verified');
    }

    const backendResponse = await fetch(IDENTITY_URL + '/auth/oauth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_token: tokens.id_token,
        provider_user_id: googleUser.sub,
        email: googleUser.email,
        email_verified: googleUser.email_verified,
        name: googleUser.name || '',
        application: 'crm',
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
      user?: { id?: string };
    };
    if (!auth.access_token || !auth.user?.id) return failure(req, 'identity_oauth_invalid');

    const meResponse = await fetch(IDENTITY_URL + '/auth/me', {
      headers: { Authorization: 'Bearer ' + auth.access_token },
    });
    if (!meResponse.ok) {
      await revokeSession(auth.access_token);
      return failure(req, 'backoffice_identity_unavailable');
    }

    const me = (await meResponse.json()) as { roles?: string[] };
    const roles = Array.isArray(me.roles) ? me.roles.map(String) : [];
    if (!roles.some(role => ALLOWED_ROLES.has(role.toLowerCase()))) {
      await revokeSession(auth.access_token);
      return failure(req, 'google_account_not_authorized_for_crm');
    }

    const response = NextResponse.redirect(
      new URL(safeCallback(state.callbackUrl), requestOrigin(req)),
    );

    response.cookies.set('access_token', auth.access_token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60,
    });
    if (auth.refresh_token) {
      response.cookies.set('refresh_token', auth.refresh_token, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    if (auth.session_id) {
      response.cookies.set('session_id', auth.session_id, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    response.cookies.set('auth_present', '1', {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    clearState(response, secure);
    return response;
  } catch {
    return failure(req, 'google_oauth_error');
  }
}
