import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { hasUmkmStorePermission } from '@/lib/super-app/umkm-authorization';
import { superAppEntityIdSchema } from '@/lib/super-app/idSchema';
import {
  createUmkmOrder,
  getUmkmOrderById,
  listUmkmProducts,
  getUmkmStoreById,
  listUmkmOrdersByStore,
} from '@/lib/super-app/umkm-commerce';
import { buildUmkmShippingQuote } from '@/lib/super-app/umkm-shipping';

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
  address_confirmed: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  try {
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

    if (payload.delivery_lat !== undefined && payload.delivery_lng === undefined) {
      return NextResponse.json({ error: 'delivery_lat and delivery_lng must be provided together' }, { status: 400 });
    }
    if (payload.delivery_lng !== undefined && payload.delivery_lat === undefined) {
      return NextResponse.json({ error: 'delivery_lat and delivery_lng must be provided together' }, { status: 400 });
    }

    const hasBearer = req.headers.get('authorization')?.startsWith('Bearer ');
    const hasCookie = Boolean(req.cookies.get('access_token')?.value);
    const shouldAuth = payload.payment_method === 'wallet' || hasBearer || hasCookie;
    const auth = shouldAuth ? await requireAuth(req) : null;
    if (auth && !auth.ok) return auth.res;
    const authCtx = auth && auth.ok ? auth.ctx : null;

    let shippingQuote:
      | Awaited<
          ReturnType<typeof buildUmkmShippingQuote>
        >
      | null = null;
    let selectedShippingOption:
      | Awaited<ReturnType<typeof buildUmkmShippingQuote>>['options'][number]
      | null = null;
    let resolvedFulfillmentMode: 'courier' | 'pickup' | 'digital' = 'courier';

    if (payload.channel === 'online') {
      const address = (payload.delivery_address || '').trim();
      const name = (payload.customer_name || '').trim();
      const phone = (payload.customer_phone || '').trim();
      if (!name || name.length < 2) {
        return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
      }
      if (!phone || phone.length < 6) {
        return NextResponse.json({ error: 'Customer phone is required' }, { status: 400 });
      }
      if ((payload.payment_timing || 'prepay') === 'prepay' && payload.payment_method === 'wallet') {
        return NextResponse.json(
          { error: 'Wallet balance payment is not available yet for UMKM online checkout' },
          { status: 409 },
        );
      }
      if (payload.payment_method === 'wallet' && !authCtx) {
        return NextResponse.json({ error: 'Login required for wallet payment' }, { status: 401 });
      }

      const store = await getUmkmStoreById(payload.store_id);
      if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

      const products = await listUmkmProducts({
        storeId: store.id,
        channel: 'online',
        includeUnavailable: false,
        limit: 500,
      });
      const productMap = new Map(products.map((product) => [product.id, product]));
      const missingProducts = payload.items
        .filter((item) => !productMap.has(item.product_id))
        .map((item) => item.product_id);
      if (missingProducts.length > 0) {
        return NextResponse.json(
          {
            error: `Some products are no longer available for online checkout: ${missingProducts.join(', ')}`,
          },
          { status: 409 },
        );
      }

      const selectedProducts = payload.items.map((item) => {
        const product = productMap.get(item.product_id)!;
        return {
          id: product.id,
          name: product.name,
          price_cents: product.price_cents,
          metadata: product.metadata,
          quantity: item.quantity,
        };
      });

      shippingQuote = await buildUmkmShippingQuote({
        store,
        selectedProducts,
        deliveryAddress: payload.delivery_address,
        deliveryLat: payload.delivery_lat,
        deliveryLng: payload.delivery_lng,
        preferredMode: payload.fulfillment_mode,
      });
      const recommendedOptionId = shippingQuote.recommended_option_id;
      resolvedFulfillmentMode = payload.fulfillment_mode || shippingQuote.profile.default_mode;
      selectedShippingOption =
        (payload.shipping_option_id
          ? shippingQuote.options.find((option) => option.id === payload.shipping_option_id)
          : null) ||
        shippingQuote.options.find(
          (option) =>
            option.mode === resolvedFulfillmentMode &&
            option.id === recommendedOptionId,
        ) ||
        shippingQuote.options.find((option) => option.mode === resolvedFulfillmentMode) ||
        shippingQuote.options.find((option) => option.id === recommendedOptionId) ||
        shippingQuote.options[0] ||
        null;

      if (!selectedShippingOption) {
        return NextResponse.json(
          { error: 'No fulfillment option is available for the selected items' },
          { status: 400 },
        );
      }
      if (payload.fulfillment_mode && selectedShippingOption.mode !== payload.fulfillment_mode) {
        return NextResponse.json(
          { error: `Selected items do not support fulfillment mode: ${payload.fulfillment_mode}` },
          { status: 400 },
        );
      }
      resolvedFulfillmentMode = selectedShippingOption.mode;

      if (selectedShippingOption.mode === 'courier') {
        if (address.length < 6) {
          return NextResponse.json({ error: 'Delivery address is required' }, { status: 400 });
        }
        if (payload.address_confirmed !== true) {
          return NextResponse.json(
            { error: 'Delivery address confirmation is required' },
            { status: 400 },
          );
        }
      }
    }

    const metadata = {
      ...payload.metadata,
      ...(payload.delivery_address ? { delivery_address: payload.delivery_address } : {}),
      ...(payload.delivery_lat !== undefined && payload.delivery_lng !== undefined
        ? { delivery_lat: payload.delivery_lat, delivery_lng: payload.delivery_lng }
        : {}),
      ...(payload.address_confirmed
        ? { address_confirmed: true, address_confirmed_at: new Date().toISOString() }
        : {}),
      ...(payload.payment_timing ? { payment_timing: payload.payment_timing } : {}),
      ...(authCtx ? { customer_user_id: authCtx.userId } : {}),
      ...(payload.channel === 'online'
        ? {
            fulfillment_mode: resolvedFulfillmentMode,
            order_composition: shippingQuote?.profile || null,
            shipping_option: selectedShippingOption || null,
            shipping_integration: shippingQuote?.integration || null,
            shipping_fee_cents:
              selectedShippingOption?.mode === 'courier'
                ? selectedShippingOption.fee_cents
                : 0,
          }
        : { fulfillment_mode: 'dine_in' }),
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
      fulfillmentMode: payload.channel === 'online' ? resolvedFulfillmentMode : 'dine_in',
      shippingFeeCents:
        payload.channel === 'online' && selectedShippingOption?.mode === 'courier'
          ? selectedShippingOption.fee_cents
          : 0,
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
