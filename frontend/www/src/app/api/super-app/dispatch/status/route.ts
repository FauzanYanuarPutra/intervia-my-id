import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit } from '@/lib/rateLimit';
import { getDispatchOrder } from '@/lib/super-app/dispatch';
import { logSuperAppEvent } from '@/lib/super-app/observability';

const QuerySchema = z.object({
  order_id: z.string().min(8).max(120),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const parsed = QuerySchema.safeParse({
      order_id: new URL(req.url).searchParams.get('order_id') || '',
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    const rl = await enforceRateLimit({
      key: `superapp:dispatch:status:${auth.ctx.userId}:${parsed.data.order_id}`,
      limit: 1000,
      windowSeconds: 3600,
      message: 'Too many status checks',
    });
    if (!rl.ok) return rl.response;

    const state = await getDispatchOrder(parsed.data.order_id);
    if (!state) {
      return NextResponse.json({ error: 'Dispatch order not found' }, { status: 404 });
    }

    if (state.requester_id !== auth.ctx.userId && !auth.ctx.roles.includes('admin')) {
      if (state.matched_driver_id !== auth.ctx.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    logSuperAppEvent('dispatch_status_checked', {
      order_id: state.order_id,
      status: state.status,
      requester_id: state.requester_id,
      matched_driver_id: state.matched_driver_id || null,
      actor_id: auth.ctx.userId,
    });

    return NextResponse.json({ data: state }, { status: 200 });
  } catch (error) {
    console.error('[SUPER_APP_DISPATCH_STATUS_ERROR]', error);
    return NextResponse.json({ error: 'Failed to get dispatch status' }, { status: 500 });
  }
}
