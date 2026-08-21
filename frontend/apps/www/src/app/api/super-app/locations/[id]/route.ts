import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { deleteLocation } from '@/lib/super-app/locations';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-locations-delete',
      ipLimit: 120,
      deviceLimit: 90,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:locations:delete:${auth.ctx.userId}:${security.ip}`,
      limit: 120,
      windowSeconds: 3600,
      message: 'Too many location deletions. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Missing location id' }, { status: 400 });
    }

    const items = await deleteLocation(auth.ctx.userId, id);
    return NextResponse.json({ data: items });
  } catch (error) {
    console.error('[SUPER_APP_LOCATIONS_DELETE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to delete location' }, { status: 500 });
  }
}
