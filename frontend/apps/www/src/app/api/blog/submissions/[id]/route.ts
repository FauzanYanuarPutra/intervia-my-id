import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBody } from '@/lib/serverRequest';
import { enforceRateLimit } from '@/lib/rateLimit';
const MARKETPLACE_URL = (process.env.INTERNAL_MARKETPLACE_URL || process.env.MARKETPLACE_URL || process.env.NEXT_PUBLIC_MARKETPLACE_URL || 'http://localhost:8081').replace(/\/+$/, '');

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.res;
  const rate = await enforceRateLimit({ key: 'blog:revise:user:' + auth.ctx.userId, limit: 30, windowSeconds: 3600 });
  if (!rate.ok) return rate.response;
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  const upstream = await fetch(MARKETPLACE_URL + '/v1/blog/submissions/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + auth.ctx.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data),
    cache: 'no-store',
  });
  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' } });
}
