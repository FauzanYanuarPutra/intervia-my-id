import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { accessTokenFromCookieHeader, forwardedSetCookies, sanitizeAuthPayload } from '@/lib/sessionProxy';

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function getIdentityProxyCandidates(): string[] {
  const candidates = [
    process.env.INTERNAL_API_URL,
    process.env.NEXT_PUBLIC_API_URL,
    'http://identity_service:8080',
    'http://127.0.0.1:8080',
    'http://localhost:8080',
  ].filter((value): value is string => Boolean(value && value.trim())).map(normalizeBaseUrl);
  return Array.from(new Set(candidates));
}

function buildIdentityProxyHeaders(req: NextRequest, hasBody: boolean): Headers {
  const headers = new Headers();
  if (hasBody) headers.set('Content-Type', 'application/json');
  for (const key of ['user-agent', 'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip', 'x-device-id', 'cookie']) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }
  const cookieAccessToken = accessTokenFromCookieHeader(req.headers.get('cookie'));
  const incomingAuthorization = req.headers.get('authorization');
  if (cookieAccessToken) headers.set('Authorization', `Bearer ${cookieAccessToken}`);
  else if (incomingAuthorization) headers.set('Authorization', incomingAuthorization);
  return headers;
}

export async function forwardToIdentity(input: {
  req: NextRequest;
  path: '/auth/login' | '/auth/me' | '/auth/logout' | '/auth/refresh';
  method: 'GET' | 'POST';
  body?: string;
  unavailableMessage: string;
  logKey: string;
}): Promise<NextResponse> {
  const candidates = getIdentityProxyCandidates();
  const errors: string[] = [];
  for (const baseUrl of candidates) {
    try {
      const upstream = await fetch(`${baseUrl}${input.path}`, {
        method: input.method,
        headers: buildIdentityProxyHeaders(input.req, Boolean(input.body)),
        body: input.body,
        cache: 'no-store',
      });
      const response = new NextResponse(sanitizeAuthPayload(await upstream.text()), {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
          'Cache-Control': 'no-store',
          'x-identity-proxy-target': baseUrl,
        },
      });
      for (const cookie of forwardedSetCookies(upstream.headers)) response.headers.append('Set-Cookie', cookie);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${baseUrl} -> ${message}`);
    }
  }
  console.error(input.logKey, { path: input.path, candidates, errors });
  return NextResponse.json({ error: input.unavailableMessage }, { status: 503 });
}
