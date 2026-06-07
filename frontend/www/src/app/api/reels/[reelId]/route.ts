import { NextRequest, NextResponse } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ reelId: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  const { reelId } = await context.params;
  const response = await proxyCommunityBackend(
    req,
    `/v1/reels/${encodeURIComponent(reelId)}`,
    { includeSearch: false },
  );
  const payload = await response.json().catch(() => null);

  return NextResponse.json(
    payload ?? { reel: null },
    {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { reelId } = await context.params;
  return proxyCommunityBackend(
    req,
    `/v1/reels/${encodeURIComponent(reelId)}`,
    { method: 'PATCH', includeSearch: false },
  );
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { reelId } = await context.params;
  return proxyCommunityBackend(
    req,
    `/v1/reels/${encodeURIComponent(reelId)}`,
    { method: 'DELETE', includeSearch: false },
  );
}
