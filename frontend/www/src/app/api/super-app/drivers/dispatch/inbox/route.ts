import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit } from '@/lib/rateLimit';
import { getDriverDispatchInbox } from '@/lib/super-app/dispatch';

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(10),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      limit: url.searchParams.get('limit') || '10',
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    const rl = await enforceRateLimit({
      key: `superapp:driver:inbox:${auth.ctx.userId}`,
      limit: 1000,
      windowSeconds: 3600,
      message: 'Too many inbox checks',
    });
    if (!rl.ok) return rl.response;

    const items = await getDriverDispatchInbox({
      driverId: auth.ctx.userId,
      limit: parsed.data.limit,
    });

    return NextResponse.json({ data: items, total: items.length }, { status: 200 });
  } catch (error) {
    console.error('[SUPER_APP_DRIVER_INBOX_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load driver inbox' }, { status: 500 });
  }
}

