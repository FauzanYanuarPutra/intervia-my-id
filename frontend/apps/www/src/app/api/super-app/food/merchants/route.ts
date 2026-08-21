import { NextRequest, NextResponse } from 'next/server';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { haversineKm } from '@/lib/super-app/location-guard';
import { getFoodPromoFromMetadata, listFoodMerchants } from '@/lib/super-app/food-catalog';
import {
  checkUmkmStorePublishReady,
  getUmkmPublishServices,
  listUmkmStores,
} from '@/lib/super-app/umkm-commerce';

function parseCoord(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
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
      routeKey: 'super-app-food-merchants',
      ipLimit: 300,
      deviceLimit: 220,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:food:merchants:${security.ip}`,
      limit: 240,
      windowSeconds: 3600,
      message: 'Too many merchant list requests. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const url = new URL(req.url);
    const viewerLat = parseCoord(url.searchParams.get('viewer_lat'));
    const viewerLng = parseCoord(url.searchParams.get('viewer_lng'));
    const hasViewer = viewerLat !== null && viewerLng !== null;

    const baseMerchants = await listFoodMerchants();
    const umkmStores = await listUmkmStores({ activeOnly: true, limit: 200 });
    const umkmMerchants = umkmStores
      .filter((store) => getUmkmPublishServices(store).includes('food'))
      .filter((store) => checkUmkmStorePublishReady(store, 'food').ok)
      .map(mapUmkmStoreToFoodMerchant);

    const merged = new Map<string, typeof baseMerchants[number]>();
    for (const merchant of [...baseMerchants, ...umkmMerchants]) {
      if (!merged.has(merchant.id)) merged.set(merchant.id, merchant);
    }

    const items = Array.from(merged.values())
      .map((merchant) => {
        const promo = getFoodPromoFromMetadata(merchant.metadata);
        const distanceKm = hasViewer
          ? haversineKm(
              { lat: viewerLat as number, lng: viewerLng as number },
              { lat: merchant.lat, lng: merchant.lng },
            )
          : null;
        return {
          ...merchant,
          distance_km: distanceKm !== null ? Number(distanceKm.toFixed(2)) : null,
          promo_label: promo?.label || null,
          promo_type: promo?.type || null,
          promo_value_cents: promo?.value_cents || null,
          promo_min_order_cents: promo?.min_order_cents || null,
        };
      })
      .sort((a, b) => {
        if (a.distance_km !== null && b.distance_km !== null) return a.distance_km - b.distance_km;
        if (a.distance_km !== null) return -1;
        if (b.distance_km !== null) return 1;
        if (b.rating_avg !== a.rating_avg) return b.rating_avg - a.rating_avg;
        return a.eta_min_minutes - b.eta_min_minutes;
      });

    return NextResponse.json(
      {
        data: {
          items,
          count: items.length,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[SUPER_APP_FOOD_MERCHANTS_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load food merchants' }, { status: 500 });
  }
}
