import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/serverAuth';
import { getRedis } from '@/lib/redis';
import { getDispatchOrder, getOrderStreamChannel } from '@/lib/super-app/dispatch';
import { logSuperAppEvent } from '@/lib/super-app/observability';

export const runtime = 'nodejs';

const QuerySchema = z.object({
  order_id: z.string().min(8).max(120),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    order_id: url.searchParams.get('order_id') || '',
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }

  const orderId = parsed.data.order_id;
  const dispatch = await getDispatchOrder(orderId);
  if (!dispatch) {
    return NextResponse.json({ error: 'Dispatch order not found' }, { status: 404 });
  }

  const canView =
    dispatch.requester_id === auth.ctx.userId ||
    dispatch.matched_driver_id === auth.ctx.userId ||
    auth.ctx.roles.includes('admin');
  if (!canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const redis = getRedis();
  const subscriber = redis.duplicate();
  const streamChannel = getOrderStreamChannel(orderId);
  await subscriber.connect();

  logSuperAppEvent('tracking_stream_subscribe', {
    order_id: orderId,
    user_id: auth.ctx.userId,
    channel: streamChannel,
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const push = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      push('connected', {
        order_id: orderId,
        ts: new Date().toISOString(),
      });

      const onMessage = (channel: string, message: string) => {
        if (channel !== streamChannel) return;
        try {
          const payload = JSON.parse(message) as Record<string, unknown>;
          push('update', payload);
        } catch {
          // ignore broken payload
        }
      };

      await subscriber.subscribe(streamChannel);
      subscriber.on('message', onMessage);

      const keepAlive = setInterval(() => {
        push('ping', { ts: new Date().toISOString() });
      }, 15000);
      req.signal.addEventListener(
        'abort',
        () => {
          clearInterval(keepAlive);
          subscriber.off('message', onMessage);
          void subscriber.unsubscribe(streamChannel).catch(() => {
            // ignore
          });
          subscriber.disconnect();
          logSuperAppEvent('tracking_stream_unsubscribe', {
            order_id: orderId,
            user_id: auth.ctx.userId,
            channel: streamChannel,
          });
        },
        { once: true },
      );
    },
    async cancel() {
      try {
        await subscriber.unsubscribe(streamChannel);
      } catch {
        // ignore
      }
      try {
        subscriber.disconnect();
      } catch {
        // ignore
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
