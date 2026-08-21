import { NextRequest } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ groupId: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  const { groupId } = await context.params;
  return proxyCommunityBackend(
    req,
    `/v1/community/groups/${encodeURIComponent(groupId)}/members`,
  );
}
