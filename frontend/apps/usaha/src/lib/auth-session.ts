import 'server-only';

import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const SESSION_ID_COOKIE = 'session_id';
export const AUTH_PRESENT_COOKIE = 'auth_present';

export type IdentityAuthPayload = {
  access_token: string;
  refresh_token?: string | null;
  session_id?: string | null;
};

export async function readAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value?.trim() || null;
}

export function shouldUseSecureAuthCookies(requestUrl?: string): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  return requestUrl?.startsWith('https://') ?? false;
}

export function writeAuthCookies(
  response: NextResponse,
  payload: IdentityAuthPayload,
  secure: boolean,
) {
  const shared = {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
  };

  response.cookies.set(ACCESS_TOKEN_COOKIE, payload.access_token, {
    ...shared,
    maxAge: 60 * 60,
  });

  if (payload.refresh_token) {
    response.cookies.set(REFRESH_TOKEN_COOKIE, payload.refresh_token, {
      ...shared,
      maxAge: 30 * 24 * 60 * 60,
    });
  }

  if (payload.session_id) {
    response.cookies.set(SESSION_ID_COOKIE, payload.session_id, {
      ...shared,
      maxAge: 30 * 24 * 60 * 60,
    });
  }

  response.cookies.set(AUTH_PRESENT_COOKIE, '1', {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearAuthCookies(response: NextResponse, secure: boolean) {
  for (const [name, httpOnly] of [
    [ACCESS_TOKEN_COOKIE, true],
    [REFRESH_TOKEN_COOKIE, true],
    [SESSION_ID_COOKIE, true],
    [AUTH_PRESENT_COOKIE, false],
  ] as const) {
    response.cookies.set(name, '', {
      httpOnly,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
}
