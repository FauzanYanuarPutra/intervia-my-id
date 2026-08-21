import { NextRequest } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ reelId: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  const { reelId } = await context.params;
  return proxyCommunityBackend(
    req,
    `/v1/reels/${encodeURIComponent(reelId)}/actions`,
    { method: 'POST', includeSearch: false },
  );
}

