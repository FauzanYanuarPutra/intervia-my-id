import { NextRequest } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  return proxyCommunityBackend(
    req,
    `/v1/forum/media/${encodeURIComponent(filename)}`,
  );
}
