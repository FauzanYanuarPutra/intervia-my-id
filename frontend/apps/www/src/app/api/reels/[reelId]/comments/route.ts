import { NextRequest } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ reelId: string }>;
};

function reelCommentsPath(reelId: string) {
  return `/v1/reels/${encodeURIComponent(reelId)}/comments`;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { reelId } = await context.params;
  return proxyCommunityBackend(req, reelCommentsPath(reelId));
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { reelId } = await context.params;
  return proxyCommunityBackend(
    req,
    reelCommentsPath(reelId),
    { method: 'POST' },
  );
}
