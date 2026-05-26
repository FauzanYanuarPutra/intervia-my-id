import { NextRequest } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  return proxyCommunityBackend(
    req,
    `/v1/forum/threads/${encodeURIComponent(threadId)}/solution`,
  );
}
