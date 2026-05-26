import { NextRequest } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

export async function POST(req: NextRequest) {
  return proxyCommunityBackend(req, '/v1/forum/upload-images');
}
