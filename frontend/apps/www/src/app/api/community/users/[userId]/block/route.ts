import { NextRequest } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  const { userId } = await context.params;
  return proxyCommunityBackend(
    req,
    `/v1/community/users/${encodeURIComponent(userId)}/block`,
    { method: 'POST', includeSearch: false },
  );
}
