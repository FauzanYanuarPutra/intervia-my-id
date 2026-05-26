import { NextRequest, NextResponse } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const response = await proxyCommunityBackend(req, '/v1/reels/feed');
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json(
      payload ?? { data: [], nextCursor: null, hasMore: false },
      {
        status: response.status,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  return NextResponse.json(
    payload ?? { data: [], nextCursor: null, hasMore: false },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
