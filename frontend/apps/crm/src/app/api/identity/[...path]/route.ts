import { NextRequest, NextResponse } from 'next/server';
import { accessTokenFromCookieHeader } from '@/lib/sessionProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IDENTITY_URL =
  process.env.INTERNAL_API_URL || 'http://identity_service:8080';

type RouteContext = { params: Promise<{ path: string[] }> };

function allowedIdentityPath(parts: string[]): string | null {
  if (parts.length === 1 && parts[0] === 'users') return '/users';
  if (
    parts.length === 3 &&
    parts[0] === 'users' &&
    parts[1] === 'public' &&
    /^[A-Za-z0-9_-]{1,128}$/.test(parts[2] || '')
  ) {
    return `/users/public/${encodeURIComponent(parts[2])}`;
  }
  return null;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const upstreamPath = allowedIdentityPath(path);
  if (!upstreamPath) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const headers = new Headers({ Accept: 'application/json' });
  const sessionAccessToken = accessTokenFromCookieHeader(req.headers.get('cookie'));
  if (sessionAccessToken) headers.set('Authorization', `Bearer ${sessionAccessToken}`);
  else {
    const authorization = req.headers.get('authorization');
    if (authorization && authorization !== 'Bearer cookie-session') {
      headers.set('Authorization', authorization);
    }
  }
  for (const name of ['user-agent', 'x-device-id']) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(`${IDENTITY_URL}${upstreamPath}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[CRM_IDENTITY_PROXY_UNAVAILABLE]', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { error: 'Identity service unavailable' },
      { status: 503 },
    );
  }
}
