import { NextRequest, NextResponse } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

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

export function POST(req: NextRequest) {
  return proxyCommunityBackend(req, '/v1/reels', { method: 'POST' });
}
