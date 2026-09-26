import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const res = await fetch(`${MARKETPLACE_URL}/v1/crm/match-candidates/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${auth.ctx.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[CRM_MATCH_CANDIDATE_PATCH_ERROR]', error);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}