import { NextRequest, NextResponse } from 'next/server';
import { accessTokenFromCookieHeader } from '@/lib/sessionProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IDENTITY_URL = process.env.INTERNAL_API_URL || 'http://identity_service:8080';
type Ctx = { params: Promise<{ path: string[] }> };

function allow(parts: string[]): string | null {
  if (parts[0] === 'candidates') return '/backoffice/candidates';
  if (parts[0] === 'invitations' && parts.length === 1) return '/backoffice/invitations';
  if (parts[0] === 'invitations' && parts[1] === 'mine') return '/backoffice/invitations/mine';
  if (parts[0] === 'invitations' && parts[1] && parts[2] === 'revoke') {
    return '/backoffice/invitations/' + encodeURIComponent(parts[1]) + '/revoke';
  }
  if (parts[0] === 'invitations' && parts[1] && parts[2] === 'respond') {
    return '/backoffice/invitations/' + encodeURIComponent(parts[1]) + '/respond';
  }
  if (parts[0] === 'google-access' && parts.length === 1) return '/backoffice/google-access';
  if (parts[0] === 'governance' && parts[1] === 'privacy' && parts.length === 2) return '/privacy/requests';
  if (parts[0] === 'governance' && parts[1] === 'privacy' && parts[2] && parts[3] === 'transition') {
    return '/privacy/requests/' + encodeURIComponent(parts[2]) + '/transition';
  }
  if (parts[0] === 'governance' && parts[1] === 'security' && parts.length === 2) return '/security/incidents';
  if (parts[0] === 'governance' && parts[1] === 'security' && parts[2] && parts[3] === 'transition') {
    return '/security/incidents/' + encodeURIComponent(parts[2]) + '/transition';
  }
  return null;
}

async function forward(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const upstreamPath = allow(path);
  if (!upstreamPath) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const token = accessTokenFromCookieHeader(req.headers.get('cookie'));
  const headers = new Headers({ Accept: 'application/json' });
  const incoming = req.headers.get('authorization');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  else if (incoming) headers.set('Authorization', incoming);
  if (req.method !== 'GET') headers.set('Content-Type', 'application/json');

  const query = req.nextUrl.search;
  try {
    const upstream = await fetch(`${IDENTITY_URL}${upstreamPath}${query}`, {
      method: req.method,
      headers,
      body: req.method === 'GET' ? undefined : await req.text(),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[CRM_BACKOFFICE_PROXY_ERROR]', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Identity service unavailable' }, { status: 503 });
  }
}

export const GET = forward;
export const POST = forward;
