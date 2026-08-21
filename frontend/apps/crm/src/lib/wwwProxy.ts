import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function getWwwProxyCandidates(): string[] {
  const candidates = [
    process.env.WWW_URL,
    process.env.NEXT_PUBLIC_WWW_URL,
    'http://www:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3000',
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map(normalizeBaseUrl);

  return Array.from(new Set(candidates));
}

export function buildWwwProxyHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  const passthrough = [
    'user-agent',
    'x-forwarded-for',
    'x-real-ip',
    'x-device-id',
    'cookie',
  ];
  for (const key of passthrough) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  return headers;
}

export async function forwardToWwwAuthRoute(input: {
  req: NextRequest;
  path: '/api/auth/send-otp' | '/api/auth/verify-otp';
  body: string;
  unavailableMessage: string;
  logKey: string;
}): Promise<NextResponse> {
  const candidates = getWwwProxyCandidates();
  const errors: string[] = [];

  for (const baseUrl of candidates) {
    try {
      const upstream = await fetch(`${baseUrl}${input.path}`, {
        method: 'POST',
        headers: buildWwwProxyHeaders(input.req),
        body: input.body,
        cache: 'no-store',
      });

      const payload = await upstream.text();
      return new NextResponse(payload, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
          'x-www-proxy-target': baseUrl,
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
