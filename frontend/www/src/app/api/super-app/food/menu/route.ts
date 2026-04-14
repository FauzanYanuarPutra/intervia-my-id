import { NextRequest, NextResponse } from 'next/server';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { getFoodMerchantById, listFoodMenuItems } from '@/lib/super-app/food-catalog';
import {
  checkUmkmStorePublishReady,
  getUmkmPublishServices,
  getUmkmStoreById,
  listUmkmProducts,
} from '@/lib/super-app/umkm-commerce';

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

function mapUmkmStoreToFoodMerchant(store: {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  metadata: Record<string, unknown>;
}) {
  const ratingAvg = Number(store.metadata.rating_avg ?? 4.7);
  const ratingCount = Number(store.metadata.rating_count ?? 120);
  const etaMin = Number(store.metadata.eta_min_minutes ?? 24);
  return {
    id: store.id,
    provider_user_id: store.owner_user_id,
    name: store.name,
    slug: store.slug,
    city: store.city,
    address: store.address,
    lat: store.lat,
    lng: store.lng,
    rating_avg: Number.isFinite(ratingAvg) ? ratingAvg : 4.7,
    rating_count: Number.isFinite(ratingCount) ? Math.max(1, Math.round(ratingCount)) : 120,
    eta_min_minutes: Number.isFinite(etaMin) ? Math.max(8, Math.round(etaMin)) : 24,
    is_active: true,
    metadata: {
      ...store.metadata,
      source: 'umkm',
      umkm_store_id: store.id,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-food-menu',
      ipLimit: 300,
      deviceLimit: 220,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const merchantId = (new URL(req.url).searchParams.get('merchant_id') || '').trim();
    if (!merchantId) {
      return NextResponse.json({ error: 'merchant_id is required' }, { status: 400 });
    }

    const rl = await enforceRateLimit({
      key: `superapp:food:menu:${security.ip}:${merchantId}`,
      limit: 240,
      windowSeconds: 3600,
      message: 'Too many menu requests. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const umkmStore = await getUmkmStoreById(merchantId);
    if (umkmStore && getUmkmPublishServices(umkmStore).includes('food')) {
      const readiness = checkUmkmStorePublishReady(umkmStore, 'food');
      if (!readiness.ok) {
        return NextResponse.json(
          { error: 'UMKM store is not verified for food listing.' },
          { status: 403 },
        );
      }

      const products = await listUmkmProducts({
        storeId: umkmStore.id,
        includeUnavailable: false,
        limit: 500,
      });
      const items = products
        .filter((product) => {
          const meta = product.metadata || {};
          const publish = normalizePublishServices(
            meta.publish_services ?? meta.publish_service ?? meta.services,
          );
          if (publish.length > 0 && !publish.includes('food')) return false;
          const channels = normalizeChannels(meta.channel);
          return channels.length === 0 || channels.includes('online');
        })
        .map((product) => ({
          id: product.id,
          merchant_id: umkmStore.id,
          name: product.name,
          description: product.description,
          category: product.category || 'main_course',
          price_cents: product.price_cents,
          prep_minutes: Math.max(
            5,
            Math.round(Number(product.metadata?.prep_minutes ?? 12) || 12),
          ),
          is_available: product.is_available,
          image_url: product.image_url,
          metadata: {
            ...product.metadata,
            source: 'umkm',
          },
        }));

      return NextResponse.json(
        {
          data: {
            merchant: mapUmkmStoreToFoodMerchant(umkmStore),
            items,
            count: items.length,
          },
        },
        { status: 200 },
      );
    }

    const merchant = await getFoodMerchantById(merchantId);
    if (!merchant) {
      return NextResponse.json({ error: 'Food merchant not found' }, { status: 404 });
    }

    const items = await listFoodMenuItems(merchantId);
    return NextResponse.json(
      {
        data: {
          merchant,
          items,
          count: items.length,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[SUPER_APP_FOOD_MENU_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load food menu' }, { status: 500 });
  }
}
