import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { hasUmkmStorePermission } from '@/lib/super-app/umkm-authorization';
import {
  checkoutUmkmOrder,
  confirmUmkmOrderBill,
  getUmkmOrderById,
  getUmkmStoreById,
  moveUmkmOrderTable,
  updateUmkmOrderStatus,
} from '@/lib/super-app/umkm-commerce';

const LifecycleSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update_status'),
    order_id: z.string().uuid(),
    status: z.enum(['pending', 'preparing', 'served', 'paid', 'cancelled']),
    metadata_patch: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    action: z.literal('checkout'),
    order_id: z.string().uuid(),
    payment_metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    action: z.literal('confirm_bill'),
    order_id: z.string().uuid(),
    metadata_patch: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    action: z.literal('move_table'),
    order_id: z.string().uuid(),
    to_table_id: z.string().uuid(),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-order-lifecycle',
      ipLimit: 180,
      deviceLimit: 140,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:orders:lifecycle:${auth.ctx.userId}:${security.ip}`,
      limit: 160,
      windowSeconds: 3600,
      message: 'Too many UMKM order lifecycle updates. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const parsed = await parseJsonBodyWithSchema(req, LifecycleSchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data;

    const current = await getUmkmOrderById(payload.order_id);
    if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const store = await getUmkmStoreById(current.order.store_id);
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    const requiredPermission =
      payload.action === 'checkout' || payload.action === 'confirm_bill'
        ? 'payment:manage'
        : payload.action === 'move_table'
          ? 'table:manage'
          : 'order:manage';

    if (
      !hasUmkmStorePermission({
        storeId: store.id,
        ownerUserId: store.owner_user_id,
        actorUserId: auth.ctx.userId,
        actorEmail: auth.ctx.email,
        roles: auth.ctx.roles,
        permission: requiredPermission,
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bundle =
      payload.action === 'checkout'
        ? await checkoutUmkmOrder({
            orderId: payload.order_id,
            paymentMetadata: payload.payment_metadata,
          })
        : payload.action === 'confirm_bill'
          ? await confirmUmkmOrderBill({
              orderId: payload.order_id,
              metadataPatch: payload.metadata_patch,
            })
        : payload.action === 'move_table'
          ? await moveUmkmOrderTable({
              orderId: payload.order_id,
              toTableId: payload.to_table_id,
            })
          : await updateUmkmOrderStatus({
              orderId: payload.order_id,
              status: payload.status,
              metadataPatch: payload.metadata_patch,
            });

    return NextResponse.json(
      {
        data: {
          store,
          ...bundle,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[UMKM_ORDER_LIFECYCLE_ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update UMKM order' },
      { status: 400 },
    );
  }
}
