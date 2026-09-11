import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { enforceRateLimit } from '@/lib/rateLimit';
import { createPublicCommerceOrder } from '@/lib/server/publicCommerceOrder';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { hasUmkmStorePermission } from '@/lib/super-app/umkm-authorization';
import {
  createUmkmOrder,
  getUmkmOrderById,
  getUmkmStoreById,
  listUmkmOrdersByStore,
} from '@/lib/super-app/umkm-commerce';
import { superAppEntityIdSchema } from '@/lib/super-app/idSchema';

const CreateOrderSchema = z.object({
  store_id: superAppEntityIdSchema,
  channel: z.enum(['online', 'offline']),
  table_id: superAppEntityIdSchema.optional(),
  table_code: z.string().max(20).optional(),
  customer_name: z.string().max(120).optional(),
  customer_phone: z.string().max(40).optional(),
  notes: z.string().max(500).optional(),
  merge_into_open_offline_order: z.boolean().optional(),
  items: z
    .array(
      z.object({
        product_id: superAppEntityIdSchema,
        quantity: z.number().int().min(1).max(200),
        notes: z.string().max(200).optional(),
      }),
    )
    .min(1)
    .max(120),
  payment_method: z.enum(['wallet', 'bank_transfer', 'cash']).optional(),
  payment_timing: z.enum(['prepay', 'postpay']).optional(),
  fulfillment_mode: z.enum(['courier', 'pickup', 'digital']).optional(),
  shipping_option_id: z.string().max(80).optional(),
  delivery_address: z.string().max(500).optional(),
  delivery_lat: z.number().min(-90).max(90).optional(),
  delivery_lng: z.number().min(-180).max(180).optional(),
  delivery_destination_id: z.string().max(80).optional(),
  address_confirmed: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function optionalTrimmed(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveIdempotencyKey(req: NextRequest): string {
  const supplied = req.headers.get('idempotency-key')?.trim();
  if (supplied && z.string().uuid().safeParse(supplied).success) return supplied;
  return randomUUID();
}

export async function GET(req: NextRequest) {
  try {
    if (PROMO_ONLY_MODE) {
      return NextResponse.json(
        { error: 'UMKM orders are disabled for now' },
        { status: 404 },
      );
    }
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-orders',
      ipLimit: 240,
      deviceLimit: 180,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const url = new URL(req.url);
    const orderId = (url.searchParams.get('id') || '').trim();
    if (orderId) {
      const bundle = await getUmkmOrderById(orderId);
      if (!bundle) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      const store = await getUmkmStoreById(bundle.order.store_id);
      if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      if (
        !hasUmkmStorePermission({
          storeId: store.id,
          ownerUserId: store.owner_user_id,
          actorUserId: auth.ctx.userId,
          actorEmail: auth.ctx.email,
          roles: auth.ctx.roles,
          permission: 'order:manage',
        }) &&
        !hasUmkmStorePermission({
          storeId: store.id,
          ownerUserId: store.owner_user_id,
          actorUserId: auth.ctx.userId,
          actorEmail: auth.ctx.email,
          roles: auth.ctx.roles,
          permission: 'payment:manage',
        })
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.json({ data: { store, ...bundle } }, { status: 200 });
    }

    const storeId = (url.searchParams.get('store_id') || '').trim();
    if (!storeId) {
      return NextResponse.json({ error: 'store_id or id is required' }, { status: 400 });
    }

    const store = await getUmkmStoreById(storeId);
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    if (
      !hasUmkmStorePermission({
        storeId: store.id,
        ownerUserId: store.owner_user_id,
        actorUserId: auth.ctx.userId,
        actorEmail: auth.ctx.email,
        roles: auth.ctx.roles,
        permission: 'order:manage',
      }) &&
      !hasUmkmStorePermission({
        storeId: store.id,
        ownerUserId: store.owner_user_id,
        actorUserId: auth.ctx.userId,
        actorEmail: auth.ctx.email,
        roles: auth.ctx.roles,
        permission: 'payment:manage',
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const status = (url.searchParams.get('status') || '').trim();
    const paymentStatus = (url.searchParams.get('payment_status') || '').trim();
    const limit = Number.parseInt(url.searchParams.get('limit') || '100', 10) || 100;
    const items = await listUmkmOrdersByStore({
      storeId: store.id,
      status:
        status === 'pending' ||
        status === 'preparing' ||
        status === 'served' ||
        status === 'paid' ||
        status === 'cancelled'
          ? status
          : undefined,
      paymentStatus:
        paymentStatus === 'unpaid' ||
        paymentStatus === 'paid' ||
        paymentStatus === 'refunded'
          ? paymentStatus
          : undefined,
      limit,
    });

    return NextResponse.json(
      {
        data: {
          store,
          items,
          count: items.length,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[UMKM_ORDERS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load UMKM orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (PROMO_ONLY_MODE) {
      return NextResponse.json(
        { error: 'UMKM orders are disabled for now' },
        { status: 404 },
      );
    }
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-orders-create',
      ipLimit: 260,
      deviceLimit: 220,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:orders:create:${security.ip}`,
      limit: 160,
      windowSeconds: 3600,
      message: 'Too many UMKM checkout attempts. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const parsed = await parseJsonBodyWithSchema(req, CreateOrderSchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data;

    if (payload.channel === 'online') {
      const auth = await requireAuth(req);
      if (!auth.ok) return auth.res;

      const canonicalOrder = await createPublicCommerceOrder({
        token: auth.ctx.token,
        idempotencyKey: resolveIdempotencyKey(req),
        intent: {
          items: payload.items.map((item) => {
            const note = optionalTrimmed(item.notes);
            return {
              product_id: item.product_id,
              quantity: item.quantity,
              ...(note ? { note } : {}),
            };
          }),
          ...(payload.fulfillment_mode
            ? { fulfillment_mode: payload.fulfillment_mode }
            : {}),
          ...(optionalTrimmed(payload.notes)
            ? { note: optionalTrimmed(payload.notes) }
            : {}),
          source_surface: 'www_umkm_storefront',
        },
      });

      if (!canonicalOrder.ok) {
        return NextResponse.json(
          { error: canonicalOrder.error },
          { status: canonicalOrder.status },
        );
      }

      return NextResponse.json(
        { data: canonicalOrder.data },
        { status: canonicalOrder.status },
      );
    }

    if (payload.delivery_lat !== undefined && payload.delivery_lng === undefined) {
      return NextResponse.json(
        { error: 'delivery_lat and delivery_lng must be provided together' },
        { status: 400 },
      );
    }
    if (payload.delivery_lng !== undefined && payload.delivery_lat === undefined) {
      return NextResponse.json(
        { error: 'delivery_lat and delivery_lng must be provided together' },
        { status: 400 },
      );
    }

    const hasBearer = req.headers.get('authorization')?.startsWith('Bearer ');
    const hasCookie = Boolean(req.cookies.get('access_token')?.value);
    const shouldAuth = payload.payment_method === 'wallet' || hasBearer || hasCookie;
    const auth = shouldAuth ? await requireAuth(req) : null;
    if (auth && !auth.ok) return auth.res;
    const authCtx = auth && auth.ok ? auth.ctx : null;

    const metadata = {
      ...payload.metadata,
      ...(payload.delivery_address ? { delivery_address: payload.delivery_address } : {}),
      ...(payload.delivery_lat !== undefined && payload.delivery_lng !== undefined
        ? { delivery_lat: payload.delivery_lat, delivery_lng: payload.delivery_lng }
        : {}),
      ...(payload.delivery_destination_id
        ? { delivery_destination_id: payload.delivery_destination_id }
        : {}),
      ...(payload.address_confirmed
        ? { address_confirmed: true, address_confirmed_at: new Date().toISOString() }
        : {}),
      ...(payload.payment_timing ? { payment_timing: payload.payment_timing } : {}),
      ...(authCtx ? { customer_user_id: authCtx.userId } : {}),
      fulfillment_mode: 'dine_in',
    };

    const bundle = await createUmkmOrder({
      storeId: payload.store_id,
      channel: payload.channel,
      tableId: payload.table_id,
      tableCode: payload.table_code,
      customerName: payload.customer_name,
      customerPhone: payload.customer_phone,
      notes: payload.notes,
      items: payload.items,
      metadata,
      mergeIntoOpenOfflineOrder: payload.merge_into_open_offline_order,
      paymentMethod: payload.payment_method,
      paymentTiming: payload.payment_timing,
      fulfillmentMode: 'dine_in',
      shippingFeeCents: 0,
    });

    return NextResponse.json({ data: bundle }, { status: 201 });
  } catch (error) {
    console.error('[UMKM_ORDERS_CREATE_ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create UMKM order' },
      { status: 400 },
    );
  }
}
