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
    {
      accept:
        'image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8',
      cacheControl: 'public, max-age=300, stale-while-revalidate=86400',
    },
  );
}
