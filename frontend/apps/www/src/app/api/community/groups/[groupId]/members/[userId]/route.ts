import { NextRequest } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ groupId: string; userId: string }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { groupId, userId } = await context.params;
  return proxyCommunityBackend(
    req,
    `/v1/community/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
    { method: 'PATCH' },
  );
}
