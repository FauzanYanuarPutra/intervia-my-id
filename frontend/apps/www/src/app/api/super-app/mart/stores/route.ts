import { NextRequest, NextResponse } from 'next/server';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { haversineKm } from '@/lib/super-app/location-guard';
import { getMartPromoFromMetadata, listMartStores } from '@/lib/super-app/mart-catalog';
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

function mapUmkmStoreToMartStore(store: {
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
  const ratingCount = Number(store.metadata.rating_count ?? 110);
  const etaMin = Number(store.metadata.eta_min_minutes ?? 26);
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
    rating_count: Number.isFinite(ratingCount) ? Math.max(1, Math.round(ratingCount)) : 110,
    eta_min_minutes: Number.isFinite(etaMin) ? Math.max(10, Math.round(etaMin)) : 26,
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
      routeKey: 'super-app-mart-stores',
      ipLimit: 300,
      deviceLimit: 220,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:mart:stores:${security.ip}`,
      limit: 240,
      windowSeconds: 3600,
      message: 'Too many mart store requests. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const url = new URL(req.url);
    const viewerLat = parseCoord(url.searchParams.get('viewer_lat'));
    const viewerLng = parseCoord(url.searchParams.get('viewer_lng'));
    const hasViewer = viewerLat !== null && viewerLng !== null;

    const baseStores = await listMartStores();
    const umkmStores = await listUmkmStores({ activeOnly: true, limit: 200 });
    const umkmMartStores = umkmStores
      .filter((store) => getUmkmPublishServices(store).includes('mart'))
      .filter((store) => checkUmkmStorePublishReady(store, 'mart').ok)
      .map(mapUmkmStoreToMartStore);

    const merged = new Map<string, typeof baseStores[number]>();
    for (const store of [...baseStores, ...umkmMartStores]) {
      if (!merged.has(store.id)) merged.set(store.id, store);
    }

    const items = Array.from(merged.values())
      .map((store) => {
        const promo = getMartPromoFromMetadata(store.metadata);
        const distanceKm = hasViewer
          ? haversineKm(
              { lat: viewerLat as number, lng: viewerLng as number },
              { lat: store.lat, lng: store.lng },
            )
          : null;
        return {
          ...store,
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
    console.error('[SUPER_APP_MART_STORES_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load mart stores' }, { status: 500 });
  }
}
