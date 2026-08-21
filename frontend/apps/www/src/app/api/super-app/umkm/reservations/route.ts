import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { hasUmkmStorePermission } from '@/lib/super-app/umkm-authorization';
import { superAppEntityIdSchema } from '@/lib/super-app/idSchema';
import {
  createUmkmReservation,
  getUmkmReservationById,
  getUmkmStoreById,
  listUmkmReservationsByStore,
  updateUmkmReservationStatus,
} from '@/lib/super-app/umkm-commerce';

const CreateReservationSchema = z.object({
  store_id: superAppEntityIdSchema,
  table_id: superAppEntityIdSchema.optional(),
  table_code: z.string().max(20).optional(),
  customer_name: z.string().min(2).max(120),
  customer_phone: z.string().min(6).max(40),
  guest_count: z.number().int().min(1).max(40),
  reserved_for: z.string().min(10).max(80),
  duration_minutes: z.number().int().min(30).max(240).optional(),
  notes: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const UpdateReservationSchema = z.object({
  reservation_id: superAppEntityIdSchema,
  status: z.enum(['pending', 'confirmed', 'seated', 'completed', 'cancelled']),
  metadata_patch: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-reservations',
      ipLimit: 220,
      deviceLimit: 180,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const url = new URL(req.url);
    const reservationId = (url.searchParams.get('id') || '').trim();
    if (reservationId) {
      const reservation = await getUmkmReservationById(reservationId);
      if (!reservation) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
      const store = await getUmkmStoreById(reservation.store_id);
      if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      if (
        !hasUmkmStorePermission({
          storeId: store.id,
          ownerUserId: store.owner_user_id,
          actorUserId: auth.ctx.userId,
          actorEmail: auth.ctx.email,
          roles: auth.ctx.roles,
          permission: 'reservation:manage',
        })
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.json({ data: { store, reservation } }, { status: 200 });
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
        permission: 'reservation:manage',
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const status = (url.searchParams.get('status') || '').trim();
    const limit = Number.parseInt(url.searchParams.get('limit') || '120', 10) || 120;
    const items = await listUmkmReservationsByStore({
      storeId: store.id,
      status:
        status === 'pending' ||
        status === 'confirmed' ||
        status === 'seated' ||
        status === 'completed' ||
        status === 'cancelled'
          ? status
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
    console.error('[UMKM_RESERVATIONS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load UMKM reservations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-reservations-create',
      ipLimit: 180,
      deviceLimit: 140,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:reservations:create:${security.ip}`,
      limit: 60,
      windowSeconds: 3600,
      message: 'Too many reservation attempts. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const parsed = await parseJsonBodyWithSchema(req, CreateReservationSchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data;

    const hasBearer = req.headers.get('authorization')?.startsWith('Bearer ');
    const hasCookie = Boolean(req.cookies.get('access_token')?.value);
    const auth = hasBearer || hasCookie ? await requireAuth(req) : null;
    if (auth && !auth.ok) return auth.res;

    const reservation = await createUmkmReservation({
      storeId: payload.store_id,
      tableId: payload.table_id,
      tableCode: payload.table_code,
      customerName: payload.customer_name,
      customerPhone: payload.customer_phone,
      guestCount: payload.guest_count,
      reservedFor: payload.reserved_for,
      durationMinutes: payload.duration_minutes,
      notes: payload.notes,
      metadata: {
        ...payload.metadata,
        ...(auth && auth.ok ? { customer_user_id: auth.ctx.userId } : {}),
      },
    });

    return NextResponse.json({ data: reservation }, { status: 201 });
  } catch (error) {
    console.error('[UMKM_RESERVATIONS_CREATE_ERROR]', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create UMKM reservation',
      },
      { status: 400 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-reservations-update',
      ipLimit: 160,
      deviceLimit: 120,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const parsed = await parseJsonBodyWithSchema(req, UpdateReservationSchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data;

    const reservation = await getUmkmReservationById(payload.reservation_id);
    if (!reservation) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });

    const store = await getUmkmStoreById(reservation.store_id);
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    if (
      !hasUmkmStorePermission({
        storeId: store.id,
        ownerUserId: store.owner_user_id,
        actorUserId: auth.ctx.userId,
        actorEmail: auth.ctx.email,
        roles: auth.ctx.roles,
        permission: 'reservation:manage',
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await updateUmkmReservationStatus({
      reservationId: payload.reservation_id,
      status: payload.status,
      metadataPatch: payload.metadata_patch,
    });

    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (error) {
    console.error('[UMKM_RESERVATIONS_PATCH_ERROR]', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update UMKM reservation',
      },
      { status: 400 },
    );
  }
}
