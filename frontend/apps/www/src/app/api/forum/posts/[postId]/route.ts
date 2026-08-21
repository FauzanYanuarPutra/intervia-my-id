import { NextRequest } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

type RouteContext = {
  params: Promise<{ postId: string }>;
};

function path(postId: string) {
  return `/v1/forum/posts/${encodeURIComponent(postId)}`;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { postId } = await params;
  return proxyCommunityBackend(req, path(postId));
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { postId } = await params;
  return proxyCommunityBackend(req, path(postId));
}
