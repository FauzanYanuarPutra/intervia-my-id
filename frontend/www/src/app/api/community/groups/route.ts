import { NextRequest } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  return proxyCommunityBackend(req, '/v1/community/groups');
}

export function POST(req: NextRequest) {
  return proxyCommunityBackend(req, '/v1/community/groups', { method: 'POST' });
}
