import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map(normalizeBaseUrl);

  return Array.from(new Set(candidates));
}

function buildIdentityProxyHeaders(req: NextRequest, hasBody: boolean): Headers {
  const headers = new Headers();
  if (hasBody) headers.set('Content-Type', 'application/json');

  for (const key of [
    'authorization',
    'user-agent',
    'x-forwarded-for',
    'x-real-ip',
    'x-device-id',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

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

      const payload = await upstream.text();
      return new NextResponse(payload, {
        status: upstream.status,
        headers: {
          'Content-Type':
            upstream.headers.get('content-type') || 'application/json',
          'x-identity-proxy-target': baseUrl,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${baseUrl} -> ${message}`);
    }
  }

  console.error(input.logKey, {
    path: input.path,
    candidates,
    errors,
  });

  return NextResponse.json(
    { error: input.unavailableMessage },
    { status: 503 },
  );
}
