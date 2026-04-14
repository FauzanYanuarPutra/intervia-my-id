import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { hasUmkmStorePermission } from '@/lib/super-app/umkm-authorization';
import {
  checkUmkmStorePublishReady,
  createUmkmProduct,
  getUmkmPublishServices,
  getUmkmStoreById,
  listUmkmProducts,
} from '@/lib/super-app/umkm-commerce';

const CreateProductSchema = z.object({
  name: z.string().min(2).max(160),
  slug: z.string().min(2).max(120).optional(),
  description: z.string().max(600).optional(),
  category: z.string().max(80).optional(),
  price_cents: z.number().int().min(1).max(2_000_000_000),
  stock_qty: z.number().int().min(0).max(1_000_000).optional(),
  is_available: z.boolean().optional(),
  image_url: z.string().max(500).optional(),
  product_kind: z.enum(['physical', 'digital']).optional(),
  weight_grams: z.number().int().min(0).max(500_000).optional(),
  allow_pickup: z.boolean().optional(),
  allow_courier_shipping: z.boolean().optional(),
  digital_delivery_note: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type PublishService = 'food' | 'mart';

const PUBLISH_SERVICES: PublishService[] = ['food', 'mart'];
const CHANNELS = ['online', 'offline'] as const;

function normalizePublishServices(value: unknown): PublishService[] {
  const tokens = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : [];

  return tokens
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
    .filter((item): item is PublishService => PUBLISH_SERVICES.includes(item as PublishService));
}

function normalizeChannels(value: unknown): Array<'online' | 'offline'> {
  const tokens = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : [];

  const filtered = tokens
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
    .filter((item): item is 'online' | 'offline' => CHANNELS.includes(item as 'online' | 'offline'));

  return Array.from(new Set(filtered));
}

function derivePublishServices(
  metadata: Record<string, unknown> | undefined,
  storeServices: PublishService[],
): PublishService[] {
  if (!metadata) return storeServices;
  const hasDirectServices =
    Object.prototype.hasOwnProperty.call(metadata, 'publish_services') ||
    Object.prototype.hasOwnProperty.call(metadata, 'publish_service') ||
    Object.prototype.hasOwnProperty.call(metadata, 'services');
  const direct = normalizePublishServices(metadata.publish_services ?? metadata.publish_service ?? metadata.services);
  if (hasDirectServices) return direct;

  const toggles: PublishService[] = [];
  if (metadata.publish_food === true) toggles.push('food');
  if (metadata.publish_mart === true) toggles.push('mart');
  if (
    Object.prototype.hasOwnProperty.call(metadata, 'publish_food') ||
    Object.prototype.hasOwnProperty.call(metadata, 'publish_mart')
  ) {
    return toggles;
  }

  return storeServices;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-products',
      ipLimit: 360,
      deviceLimit: 280,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const resolvedParams = await params;
    const store = await getUmkmStoreById(resolvedParams.storeId);
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const url = new URL(req.url);
    const channel = (url.searchParams.get('channel') || '').trim();
    const includeUnavailable =
      url.searchParams.get('include_unavailable') === '1' ||
      url.searchParams.get('include_unavailable') === 'true';
    const limit = Number.parseInt(url.searchParams.get('limit') || '300', 10) || 300;

    const items = await listUmkmProducts({
      storeId: store.id,
      channel: channel === 'online' || channel === 'offline' ? channel : undefined,
      includeUnavailable,
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
    console.error('[UMKM_PRODUCTS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load UMKM products' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-products-create',
      ipLimit: 160,
      deviceLimit: 120,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:products:create:${auth.ctx.userId}:${security.ip}`,
      limit: 120,
      windowSeconds: 3600,
      message: 'Too many product create requests. Please retry later.',
    });
    if (!rl.ok) return rl.response;

    const resolvedParams = await params;
    const store = await getUmkmStoreById(resolvedParams.storeId);
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    if (
      !hasUmkmStorePermission({
        storeId: store.id,
        ownerUserId: store.owner_user_id,
        actorUserId: auth.ctx.userId,
        actorEmail: auth.ctx.email,
        roles: auth.ctx.roles,
        permission: 'product:manage',
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = await parseJsonBodyWithSchema(req, CreateProductSchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data;

    const storeServices = getUmkmPublishServices(store) as PublishService[];
    const publishServices = derivePublishServices(payload.metadata, storeServices);
    const channelList = normalizeChannels(payload.metadata?.channel);
    const normalizedChannels =
      channelList.length > 0 ? channelList : ['online', 'offline'];
    const productKind = payload.product_kind || 'physical';
    const pickupEnabled = productKind === 'physical' ? payload.allow_pickup !== false : false;
    const courierEnabled =
      productKind === 'physical' ? payload.allow_courier_shipping !== false : false;
    const digitalDeliveryNote = (payload.digital_delivery_note || '').trim();

    if (publishServices.length > 0 && !store.online_order_enabled) {
      return NextResponse.json(
        { error: 'Online ordering must be enabled before activating Food or Mart publish channels.' },
        { status: 400 },
      );
    }

    if (normalizedChannels.includes('online') && store.online_order_enabled === false) {
      return NextResponse.json(
        { error: 'Store online ordering is disabled. Enable it before creating online products.' },
        { status: 400 },
      );
    }

    if (normalizedChannels.includes('offline') && store.offline_order_enabled === false) {
      return NextResponse.json(
        { error: 'Store offline ordering is disabled. Enable it before creating offline products.' },
        { status: 400 },
      );
    }

    if (publishServices.length > 0 && !normalizedChannels.includes('online')) {
      normalizedChannels.push('online');
    }

    for (const service of publishServices) {
      const readiness = checkUmkmStorePublishReady(store, service);
      if (!readiness.ok) {
        return NextResponse.json(
          {
            error: `Store verification incomplete for ${service}. Missing: ${readiness.missing.join(
              ', ',
            )}`,
          },
          { status: 400 },
        );
      }
    }

    if (publishServices.length > 0 && !payload.image_url) {
      return NextResponse.json(
        { error: 'Listings that use Food or Mart publish channels require a product photo (image_url).' },
        { status: 400 },
      );
    }

    if (
      productKind === 'physical' &&
      normalizedChannels.includes('online') &&
      !pickupEnabled &&
      !courierEnabled
    ) {
      return NextResponse.json(
        {
          error:
            'Physical online products must enable at least one fulfillment mode: pickup or courier shipping.',
        },
        { status: 400 },
      );
    }

    if (productKind === 'physical' && courierEnabled && (payload.weight_grams || 0) <= 0) {
      return NextResponse.json(
        { error: 'Courier-enabled products must include weight_grams greater than 0.' },
        { status: 400 },
      );
    }

    if (
      productKind === 'digital' &&
      normalizedChannels.includes('online') &&
      digitalDeliveryNote.length < 6
    ) {
      return NextResponse.json(
        {
          error:
            'Digital online products must include a clear digital_delivery_note so buyers know how delivery works.',
        },
        { status: 400 },
      );
    }

    const metadata = {
      ...(payload.metadata || {}),
      channel: normalizedChannels,
      publish_services: publishServices,
      ...(payload.product_kind ? { item_kind: payload.product_kind } : {}),
      ...(payload.weight_grams !== undefined ? { weight_grams: payload.weight_grams } : {}),
      ...(payload.allow_pickup !== undefined ? { allow_pickup: payload.allow_pickup } : {}),
      ...(payload.allow_courier_shipping !== undefined
        ? { allow_courier_shipping: payload.allow_courier_shipping }
        : {}),
      ...(payload.digital_delivery_note
        ? { digital_delivery_note: payload.digital_delivery_note }
        : {}),
    };

    const product = await createUmkmProduct({
      storeId: store.id,
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      category: payload.category,
      priceCents: payload.price_cents,
      stockQty: payload.stock_qty,
      isAvailable: payload.is_available,
      imageUrl: payload.image_url,
      metadata,
    });

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    console.error('[UMKM_PRODUCTS_CREATE_ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create product' },
      { status: 400 },
    );
  }
}
