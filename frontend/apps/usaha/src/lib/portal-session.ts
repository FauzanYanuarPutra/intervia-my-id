import 'server-only';

import { cookies } from 'next/headers';

export const PORTAL_SESSION_COOKIE = 'usaha_session';

export type PortalSession = {
  accountId: string;
};

export async function readPortalSession() {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(PORTAL_SESSION_COOKIE)?.value;

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as PortalSession;
    if (!parsed.accountId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writePortalSession(accountId: string) {
  const cookieStore = await cookies();
  cookieStore.set(PORTAL_SESSION_COOKIE, JSON.stringify({ accountId }), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearPortalSession() {
  const cookieStore = await cookies();
  cookieStore.delete(PORTAL_SESSION_COOKIE);
}
