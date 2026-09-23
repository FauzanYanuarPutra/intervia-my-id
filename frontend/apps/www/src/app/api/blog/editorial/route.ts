import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
const MARKETPLACE_URL = (process.env.INTERNAL_MARKETPLACE_URL || process.env.MARKETPLACE_URL || process.env.NEXT_PUBLIC_MARKETPLACE_URL || 'http://localhost:8081').replace(/\/+$/, '');

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.res;
  const status = request.nextUrl.searchParams.get('status') || 'pending_review';
  const upstream = await fetch(MARKETPLACE_URL + '/v1/blog/editorial/queue?status=' + encodeURIComponent(status), {
    headers: { Authorization: 'Bearer ' + auth.ctx.token },
    cache: 'no-store',
  });
  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' } });
}
