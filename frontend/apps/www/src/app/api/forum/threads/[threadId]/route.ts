import { NextRequest } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

type RouteContext = {
  params: Promise<{ threadId: string }>;
};

function path(threadId: string) {
  return `/v1/forum/threads/${encodeURIComponent(threadId)}`;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { threadId } = await params;
  return proxyCommunityBackend(req, path(threadId));
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { threadId } = await params;
  return proxyCommunityBackend(req, path(threadId));
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { threadId } = await params;
  return proxyCommunityBackend(req, path(threadId));
}
