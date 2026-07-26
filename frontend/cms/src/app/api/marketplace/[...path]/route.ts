import { NextRequest, NextResponse } from 'next/server';

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function getMarketplaceProxyCandidates(): string[] {
  const candidates = [
    process.env.INTERNAL_MARKETPLACE_URL,
    process.env.MARKETPLACE_URL,
    process.env.NEXT_PUBLIC_MARKETPLACE_URL,
    'http://marketplace_service:8081',
    'http://127.0.0.1:8081',
    'http://localhost:8081',
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map(normalizeBaseUrl);

  return Array.from(new Set(candidates));
}

function buildMarketplaceHeaders(req: NextRequest, hasBody: boolean): Headers {
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

async function forwardToMarketplace(
  req: NextRequest,
  params: Promise<{ path?: string[] }>,
) {
  const resolvedParams = await params;
  const path = `/${(resolvedParams.path || []).join('/')}`;
  const query = req.nextUrl.search || '';
  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  const body = hasBody ? await req.text() : undefined;
  const candidates = getMarketplaceProxyCandidates();
  const errors: string[] = [];

  for (const baseUrl of candidates) {
    try {
      const upstream = await fetch(`${baseUrl}${path}${query}`, {
        method,
        headers: buildMarketplaceHeaders(req, hasBody),
        body,
        cache: 'no-store',
      });

      const payload = await upstream.text();
      return new NextResponse(payload, {
        status: upstream.status,
        headers: {
          'Content-Type':
            upstream.headers.get('content-type') || 'application/json',
          'x-marketplace-proxy-target': baseUrl,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${baseUrl} -> ${message}`);
    }
  }

  console.error('[CMS_MARKETPLACE_PROXY_ERROR]', {
    path,
    candidates,
    errors,
  });

  return NextResponse.json(
    { error: 'Marketplace service unavailable' },
    { status: 503 },
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return forwardToMarketplace(req, params);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return forwardToMarketplace(req, params);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return forwardToMarketplace(req, params);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return forwardToMarketplace(req, params);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return forwardToMarketplace(req, params);
}
