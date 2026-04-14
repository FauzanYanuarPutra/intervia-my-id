import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { superAppEntityIdSchema } from '@/lib/super-app/idSchema';
import { getUmkmStoreById, listUmkmProducts } from '@/lib/super-app/umkm-commerce';
import { buildUmkmShippingQuote } from '@/lib/super-app/umkm-shipping';

const ShippingQuoteSchema = z.object({
  store_id: superAppEntityIdSchema,
  delivery_address: z.string().max(500).optional(),
  delivery_lat: z.number().min(-90).max(90).optional(),
  delivery_lng: z.number().min(-180).max(180).optional(),
  preferred_mode: z.enum(['courier', 'pickup', 'digital']).optional(),
  items: z
    .array(
      z.object({
        product_id: superAppEntityIdSchema,
        quantity: z.number().int().min(1).max(200),
      }),
    )
    .min(1)
    .max(120),
});

export async function POST(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-shipping-quote',
      ipLimit: 320,
      deviceLimit: 240,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:shipping:quote:${security.ip}`,
      limit: 240,
      windowSeconds: 3600,
      message: 'Too many shipping quote requests. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const parsed = await parseJsonBodyWithSchema(req, ShippingQuoteSchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data;

    if (payload.delivery_lat !== undefined && payload.delivery_lng === undefined) {
      return NextResponse.json({ error: 'delivery_lat and delivery_lng must be provided together' }, { status: 400 });
    }
    if (payload.delivery_lng !== undefined && payload.delivery_lat === undefined) {
      return NextResponse.json({ error: 'delivery_lat and delivery_lng must be provided together' }, { status: 400 });
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

    const quote = await buildUmkmShippingQuote({
      store,
      selectedProducts,
      deliveryAddress: payload.delivery_address,
      deliveryLat: payload.delivery_lat,
      deliveryLng: payload.delivery_lng,
      preferredMode: payload.preferred_mode,
    });

    return NextResponse.json({ data: quote }, { status: 200 });
  } catch (error) {
    console.error('[UMKM_SHIPPING_QUOTE_ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build shipping quote' },
      { status: 400 },
    );
  }
}
