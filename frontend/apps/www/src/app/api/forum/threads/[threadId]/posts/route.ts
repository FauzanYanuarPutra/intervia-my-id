import { NextRequest } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';
import { requireAuth } from '@/lib/serverAuth';
import {
  enforceCreatorBudget,
  refundCreatorBudget,
} from '@/lib/server/creatorBudget';

type RouteContext = {
  params: Promise<{ threadId: string }>;
};

function path(threadId: string) {
  return `/v1/forum/threads/${encodeURIComponent(threadId)}/posts`;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { threadId } = await params;
  return proxyCommunityBackend(req, path(threadId));
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { threadId } = await params;
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const budget = await enforceCreatorBudget({
    userId: auth.ctx.userId,
    action: 'create_community',
    cost: 10,
    dailyLimit: 10,
  });
  if (!budget.ok) return budget.response;

  const response = await proxyCommunityBackend(req, path(threadId));
  if (!response.ok && response.status >= 500) {
    await refundCreatorBudget({
      userId: auth.ctx.userId,
      action: 'create_community',
      cost: 10,
    });
  }
  return response;
}
