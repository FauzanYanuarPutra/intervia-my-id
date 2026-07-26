import { proxyCommunityBackend } from '@/lib/community/backendProxy';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  const { userId } = await context.params;

  return proxyCommunityBackend(
    req,
    `/v1/community/users/${encodeURIComponent(userId)}/social`,
  );
}
