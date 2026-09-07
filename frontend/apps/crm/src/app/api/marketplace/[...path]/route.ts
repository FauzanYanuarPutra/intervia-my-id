import { NextRequest, NextResponse } from 'next/server';
import { accessTokenFromCookieHeader } from '@/lib/sessionProxy';

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function marketplaceCandidates(): string[] {
  return Array.from(new Set([
    process.env.INTERNAL_MARKETPLACE_URL,
    process.env.MARKETPLACE_URL,
    'http://marketplace_service:8081',
    'http://127.0.0.1:8081',
    'http://localhost:8081',
  ].filter((value): value is string => Boolean(value && value.trim())).map(normalizeBaseUrl)));
}

function upstreamHeaders(req: NextRequest, hasBody: boolean): Headers {
  const headers = new Headers();
  if (hasBody) headers.set('Content-Type', req.headers.get('content-type') || 'application/json');
  for (const key of ['user-agent', 'x-forwarded-for', 'x-real-ip', 'x-device-id']) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }
  const accessToken = accessTokenFromCookieHeader(req.headers.get('cookie'));
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  else {
    const authorization = req.headers.get('authorization');
    if (authorization) headers.set('Authorization', authorization);
  }
  return headers;
}

async function proxy(req: NextRequest, params: Promise<{ path?: string[] }>) {
  const { path = [] } = await params;
  const suffix = `/${path.join('/')}${req.nextUrl.search}`;
  const hasBody = !['GET', 'HEAD'].includes(req.method.toUpperCase());
  const body = hasBody ? await req.text() : undefined;
  const errors: string[] = [];

  for (const baseUrl of marketplaceCandidates()) {
    try {
      const upstream = await fetch(`${baseUrl}${suffix}`, {
        method: req.method,
        headers: upstreamHeaders(req, hasBody),
        body,
        cache: 'no-store',
      });
      return new NextResponse(await upstream.text(), {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
          'Cache-Control': 'no-store',
          'x-marketplace-proxy-target': baseUrl,
        },
      });
    } catch (error) {
      errors.push(`${baseUrl} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.error('[CRM_MARKETPLACE_PROXY_ERROR]', { suffix, errors });
  return NextResponse.json({ error: 'Marketplace service unavailable' }, { status: 503 });
}

type Context = { params: Promise<{ path?: string[] }> };
export async function GET(req: NextRequest, { params }: Context) { return proxy(req, params); }
export async function POST(req: NextRequest, { params }: Context) { return proxy(req, params); }
export async function PUT(req: NextRequest, { params }: Context) { return proxy(req, params); }
export async function PATCH(req: NextRequest, { params }: Context) { return proxy(req, params); }
export async function DELETE(req: NextRequest, { params }: Context) { return proxy(req, params); }
