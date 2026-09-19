import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080';

async function proxy(req: NextRequest, path: string, init?: RequestInit) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${auth.ctx.token}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      cache: 'no-store',
    });

    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'Identity service unavailable' }, { status: 503 });
  }
}

export async function GET(req: NextRequest) {
  return proxy(req, '/privacy/requests/mine');
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  if (body.length > 20_000) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  return proxy(req, '/privacy/requests', {
    method: 'POST',
    body,
  });
}
