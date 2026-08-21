import { NextRequest } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';
import { requireAuth } from '@/lib/serverAuth';
import {
  enforceCreatorBudget,
  refundCreatorBudget,
} from '@/lib/server/creatorBudget';

export async function GET(req: NextRequest) {
  return proxyCommunityBackend(req, '/v1/forum/threads');
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const budget = await enforceCreatorBudget({
    userId: auth.ctx.userId,
    action: 'create_community',
    cost: 10,
    dailyLimit: 10,
  });
  if (!budget.ok) return budget.response;

  const response = await proxyCommunityBackend(req, '/v1/forum/threads');
  if (!response.ok && response.status >= 500) {
    await refundCreatorBudget({
      userId: auth.ctx.userId,
      action: 'create_community',
      cost: 10,
    });
  }
  return response;
}
