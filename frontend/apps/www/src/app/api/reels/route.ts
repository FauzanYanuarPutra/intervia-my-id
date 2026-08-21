import { NextRequest, NextResponse } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';
import { requireAuth } from '@/lib/serverAuth';
import {
  enforceCreatorBudget,
  refundCreatorBudget,
} from '@/lib/server/creatorBudget';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const response = await proxyCommunityBackend(req, '/v1/reels');
  const payload = await response.json().catch(() => null);

  return NextResponse.json(
    payload ?? { items: [], nextCursor: null, hasMore: false },
    {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const creatorBudget = await enforceCreatorBudget({
    userId: auth.ctx.userId,
    action: 'create_reel',
    cost: 10,
    dailyLimit: 10,
  });
  if (!creatorBudget.ok) return creatorBudget.response;

  const response = await proxyCommunityBackend(req, '/v1/reels', {
    method: 'POST',
  });
  if (!response.ok && response.status >= 500) {
    await refundCreatorBudget({
      userId: auth.ctx.userId,
      action: 'create_reel',
      cost: 10,
    });
  }
  return response;
}
