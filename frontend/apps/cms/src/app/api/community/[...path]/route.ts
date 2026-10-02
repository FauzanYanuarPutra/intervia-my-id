import { NextRequest, NextResponse } from 'next/server';
import { accessTokenFromCookieHeader } from '@/lib/sessionProxy';

function bases(): string[] {
  return Array.from(new Set([
    process.env.INTERNAL_COMMUNITY_URL,
    process.env.COMMUNITY_SERVICE_URL,
    process.env.NEXT_PUBLIC_COMMUNITY_URL,
    'http://community_service:8082',
    'http://127.0.0.1:8082',
    'http://localhost:8082',
  ].filter((value): value is string => Boolean(value && value.trim())).map(value => value.trim().replace(/\/+$/, ''))));
}

async function forward(req: NextRequest, params: Promise<{ path?: string[] }>) {
  const resolved = await params;
  const path = `/${(resolved.path || []).join('/')}`;
  const query = req.nextUrl.search || '';
  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  const body = hasBody ? await req.text() : undefined;
  const headers = new Headers();
  if (hasBody) headers.set('Content-Type', 'application/json');

  const cookieToken = accessTokenFromCookieHeader(req.headers.get('cookie'));
  const auth = cookieToken || req.headers.get('authorization');
  if (auth) headers.set('Authorization', cookieToken ? `Bearer ${cookieToken}` : auth);

  const errors: string[] = [];
  for (const base of bases()) {
    try {
      const upstream = await fetch(`${base}${path}${query}`, {
        method,
        headers,
        body,
        cache: 'no-store',
      });
      const payload = await upstream.text();
      return new NextResponse(payload, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  console.error('[CMS_COMMUNITY_PROXY_ERROR]', { path, errors });
  return NextResponse.json({ error: 'Community service unavailable' }, { status: 503 });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) { return forward(req, params); }
export async function POST(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) { return forward(req, params); }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) { return forward(req, params); }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) { return forward(req, params); }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) { return forward(req, params); }