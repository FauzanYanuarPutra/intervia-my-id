import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { hasUmkmStorePermission } from '@/lib/super-app/umkm-authorization';
import { getUmkmStoreById, updateUmkmStoreMetadata } from '@/lib/super-app/umkm-commerce';

const UpdateStoreSchema = z.object({
  name: z.string().min(3).max(120).optional(),
  city: z.string().min(2).max(80).optional(),
  address: z.string().min(3).max(240).optional(),
  phone: z.string().max(40).optional(),
  description: z.string().max(500).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  online_order_enabled: z.boolean().optional(),
  offline_order_enabled: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-store-update',
      ipLimit: 160,
      deviceLimit: 120,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:stores:update:${auth.ctx.userId}:${security.ip}`,
      limit: 120,
      windowSeconds: 3600,
      message: 'Too many UMKM update requests. Please retry later.',
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
        permission: 'store:update',
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = await parseJsonBodyWithSchema(req, UpdateStoreSchema);
    if (!parsed.ok) return parsed.response;

    const updated = await updateUmkmStoreMetadata({
      storeId: store.id,
      metadataPatch: parsed.data.metadata,
      name: parsed.data.name,
      city: parsed.data.city,
      address: parsed.data.address,
      phone: parsed.data.phone,
      description: parsed.data.description,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      onlineOrderEnabled: parsed.data.online_order_enabled,
      offlineOrderEnabled: parsed.data.offline_order_enabled,
    });

    return NextResponse.json({ data: { store: updated } }, { status: 200 });
  } catch (error) {
    console.error('[UMKM_STORE_UPDATE_ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update UMKM store' },
      { status: 400 },
    );
  }
}
