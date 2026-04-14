import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { hasUmkmStorePermission } from '@/lib/super-app/umkm-authorization';
import {
  ensureUmkmQrToken,
  getUmkmStoreById,
  listUmkmQrTokens,
} from '@/lib/super-app/umkm-commerce';

const CreateQrSchema = z.object({
  mode: z.enum(['online', 'offline']),
  table_id: z.string().uuid().optional(),
  force_new: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-qr',
      ipLimit: 320,
      deviceLimit: 240,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const resolvedParams = await params;
    const store = await getUmkmStoreById(resolvedParams.storeId);
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const items = await listUmkmQrTokens(store.id);
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
    console.error('[UMKM_QR_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load QR tokens' }, { status: 500 });
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
      routeKey: 'super-app-umkm-qr-create',
      ipLimit: 120,
      deviceLimit: 90,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:qr:create:${auth.ctx.userId}:${security.ip}`,
      limit: 80,
      windowSeconds: 3600,
      message: 'Too many QR generation requests. Please retry later.',
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
        permission: 'qr:manage',
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = await parseJsonBodyWithSchema(req, CreateQrSchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data;

    const qr = await ensureUmkmQrToken({
      storeId: store.id,
      mode: payload.mode,
      tableId: payload.table_id,
      forceNew: payload.force_new,
    });

    return NextResponse.json({ data: qr }, { status: 201 });
  } catch (error) {
    console.error('[UMKM_QR_CREATE_ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate QR' },
      { status: 400 },
    );
  }
}
