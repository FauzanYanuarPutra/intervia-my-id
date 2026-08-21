import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { deleteOrderTemplate } from '@/lib/super-app/templates';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-templates-delete',
      ipLimit: 120,
      deviceLimit: 90,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:templates:delete:${auth.ctx.userId}:${security.ip}`,
      limit: 120,
      windowSeconds: 3600,
      message: 'Too many template deletions. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Missing template id' }, { status: 400 });
    }

    const items = await deleteOrderTemplate(auth.ctx.userId, id);
    return NextResponse.json({ data: items });
  } catch (error) {
    console.error('[SUPER_APP_TEMPLATES_DELETE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
