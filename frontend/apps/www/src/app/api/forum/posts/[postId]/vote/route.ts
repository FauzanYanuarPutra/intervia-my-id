import { NextRequest } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  return proxyCommunityBackend(
    req,
    `/v1/forum/posts/${encodeURIComponent(postId)}/vote`,
  );
}
