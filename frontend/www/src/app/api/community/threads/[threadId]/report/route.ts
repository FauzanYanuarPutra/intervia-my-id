import { NextRequest } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ threadId: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  const { threadId } = await context.params;
  return proxyCommunityBackend(
    req,
    `/v1/forum/threads/${encodeURIComponent(threadId)}/report`,
    { method: 'POST', includeSearch: false },
  );
}

