import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  try {
    const upstream = await fetch(
      `${MARKETPLACE_URL}/v1/content/${encodeURIComponent(id)}/moderation/history`,
      { headers: { Authorization: `Bearer ${auth.ctx.token}` }, cache: 'no-store' },
    );
    const payload = await upstream.json().catch(() => ({}));
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Moderation service unavailable' }, { status: 503 });
  }
}
