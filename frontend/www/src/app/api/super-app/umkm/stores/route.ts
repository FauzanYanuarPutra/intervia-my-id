import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { haversineKm } from '@/lib/super-app/location-guard';
import {
  createUmkmStore,
  ensureUmkmQrToken,
  getStoreRecommendedQr,
  listUmkmTables,
  listUmkmStoresForActor,
  listUmkmStores,
  upsertUmkmTables,
} from '@/lib/super-app/umkm-commerce';

function parseCoord(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRadiusKm(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, 200);
}

const CreateStoreSchema = z.object({
  name: z.string().min(3).max(120),
  slug: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional(),
  city: z.string().min(2).max(80),
  address: z.string().min(3).max(240),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  phone: z.string().max(40).optional(),
  online_order_enabled: z.boolean().optional(),
  offline_order_enabled: z.boolean().optional(),
  table_count: z.number().int().min(0).max(200).optional(),
  table_prefix: z.string().min(1).max(8).optional(),
  default_capacity: z.number().int().min(1).max(40).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-stores',
      ipLimit: 400,
      deviceLimit: 300,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:stores:${security.ip}`,
      limit: 360,
      windowSeconds: 3600,
      message: 'Too many UMKM store list requests. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const url = new URL(req.url);
    const mine = url.searchParams.get('mine') === '1' || url.searchParams.get('mine') === 'true';
    let actorUserId: string | undefined;
    let actorEmail: string | undefined;
    if (mine) {
      const auth = await requireAuth(req);
      if (!auth.ok) return auth.res;
      actorUserId = auth.ctx.userId;
      actorEmail = auth.ctx.email;
    }

    const query = (url.searchParams.get('q') || '').trim();
    const city = (url.searchParams.get('city') || '').trim();
    const slug = (url.searchParams.get('slug') || '').trim();
    const backendOnly =
      url.searchParams.get('backend_only') === '1' ||
      url.searchParams.get('backend_only') === 'true';
    const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '80', 10) || 80;
    const limit = Math.max(1, Math.min(500, requestedLimit));
    const viewerLat = parseCoord(url.searchParams.get('viewer_lat'));
    const viewerLng = parseCoord(url.searchParams.get('viewer_lng'));
    const radiusKm = parseRadiusKm(url.searchParams.get('radius_km'));
    const hasViewer = viewerLat !== null && viewerLng !== null;

    const stores = mine
      ? await listUmkmStoresForActor({
          actorUserId: actorUserId as string,
          actorEmail,
          query: query || undefined,
          city: city || undefined,
          slug: slug || undefined,
          limit: 500,
        })
      : await listUmkmStores({
          query: query || undefined,
          city: city || undefined,
          slug: slug || undefined,
          backendOnly,
          activeOnly: true,
          limit: 500,
        });

    const items = stores
      .map(async (store) => {
        const distanceKm = hasViewer
          ? haversineKm(
              { lat: viewerLat as number, lng: viewerLng as number },
              { lat: store.lat, lng: store.lng },
            )
          : null;
        const tables = await listUmkmTables(store.id);
        const availableTables = tables.filter((table) => table.status === 'available');
        const maxTableCapacity =
          tables.length > 0 ? Math.max(...tables.map((table) => table.capacity)) : 0;
        return {
          ...store,
          distance_km: distanceKm !== null ? Number(distanceKm.toFixed(2)) : null,
          recommended_qr: getStoreRecommendedQr(store),
          table_count: tables.length,
          available_table_count: availableTables.length,
          max_table_capacity: maxTableCapacity,
          reservation_enabled: store.offline_order_enabled && tables.length > 0,
        };
      });
    const resolvedItems = await Promise.all(items);
    const visibleItems = (mine
      ? resolvedItems
      : resolvedItems.filter((item) => {
          if (item.metadata?.source === 'usaha_portal') {
            return item.is_active !== false;
          }
          return item.metadata?.outlet_active !== false;
        }))
      .filter((item) => {
        if (!hasViewer || radiusKm === null) return true;
        if (typeof item.distance_km !== 'number' || !Number.isFinite(item.distance_km)) return false;
        return item.distance_km <= radiusKm;
      });

    const sortedItems = visibleItems
      .sort((a, b) => {
        if (a.distance_km !== null && b.distance_km !== null) return a.distance_km - b.distance_km;
        if (a.distance_km !== null) return -1;
        if (b.distance_km !== null) return 1;
        return b.updated_at.localeCompare(a.updated_at);
      });
    const limitedItems = sortedItems.slice(0, limit);

    return NextResponse.json(
      {
        data: {
          items: limitedItems,
          count: sortedItems.length,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[UMKM_STORES_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load UMKM stores' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-stores-create',
      ipLimit: 120,
      deviceLimit: 90,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:stores:create:${auth.ctx.userId}:${security.ip}`,
      limit: 40,
      windowSeconds: 3600,
      message: 'Too many UMKM registration attempts. Please retry later.',
    });
    if (!rl.ok) return rl.response;

    const parsed = await parseJsonBodyWithSchema(req, CreateStoreSchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data;

    const store = await createUmkmStore({
      ownerUserId: auth.ctx.userId,
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      city: payload.city,
      address: payload.address,
      lat: payload.lat,
      lng: payload.lng,
      phone: payload.phone,
      onlineOrderEnabled: payload.online_order_enabled,
      offlineOrderEnabled: payload.offline_order_enabled,
      metadata: {
        recommended_qr: (payload.table_count || 0) > 0 ? 'offline' : 'online',
        ...(payload.metadata || {}),
      },
    });

    let tables = [] as Awaited<ReturnType<typeof upsertUmkmTables>>;
    if ((payload.table_count || 0) > 0) {
      const prefix = (payload.table_prefix || 'T').toUpperCase();
      const tableRows = Array.from({ length: payload.table_count || 0 }).map((_, idx) => {
        const number = String(idx + 1).padStart(2, '0');
        return {
          table_code: `${prefix}${number}`,
          capacity: payload.default_capacity || 2,
          status: 'available' as const,
          metadata: {},
        };
      });
      tables = await upsertUmkmTables({
        storeId: store.id,
        tables: tableRows,
      });
      await Promise.all(
        tables.map((table) =>
          ensureUmkmQrToken({
            storeId: store.id,
            mode: 'offline',
            tableId: table.id,
          }),
        ),
      );
    }

    const onlineQr = await ensureUmkmQrToken({
      storeId: store.id,
      mode: 'online',
    });

    return NextResponse.json(
      {
        data: {
          store,
          tables,
          qr: {
            online: onlineQr,
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[UMKM_STORES_CREATE_ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create UMKM store' },
      { status: 400 },
    );
  }
}
