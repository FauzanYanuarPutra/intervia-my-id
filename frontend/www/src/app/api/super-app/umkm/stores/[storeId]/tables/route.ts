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
  listUmkmTables,
  upsertUmkmTables,
} from '@/lib/super-app/umkm-commerce';

const UpsertTablesSchema = z.object({
  tables: z
    .array(
      z.object({
        table_code: z.string().min(1).max(20),
        capacity: z.number().int().min(1).max(40).optional(),
        status: z.enum(['available', 'occupied', 'disabled']).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(400)
    .optional(),
  generate: z
    .object({
      count: z.number().int().min(1).max(400),
      prefix: z.string().min(1).max(8).optional(),
      start_number: z.number().int().min(1).max(10_000).optional(),
      capacity: z.number().int().min(1).max(40).optional(),
    })
    .optional(),
  create_offline_qr: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-tables',
      ipLimit: 320,
      deviceLimit: 240,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const resolvedParams = await params;
    const store = await getUmkmStoreById(resolvedParams.storeId);
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const items = await listUmkmTables(store.id);
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
    console.error('[UMKM_TABLES_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load UMKM tables' }, { status: 500 });
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
      routeKey: 'super-app-umkm-tables-upsert',
      ipLimit: 140,
      deviceLimit: 100,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:tables:upsert:${auth.ctx.userId}:${security.ip}`,
      limit: 80,
      windowSeconds: 3600,
      message: 'Too many table update requests. Please retry later.',
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
        permission: 'table:manage',
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = await parseJsonBodyWithSchema(req, UpsertTablesSchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data;

    const rows =
      payload.tables && payload.tables.length > 0
        ? payload.tables
        : payload.generate
          ? Array.from({ length: payload.generate.count }).map((_, idx) => {
              const prefix = (payload.generate?.prefix || 'T').toUpperCase();
              const start = payload.generate?.start_number || 1;
              const number = String(start + idx).padStart(2, '0');
              return {
                table_code: `${prefix}${number}`,
                capacity: payload.generate?.capacity || 2,
                status: 'available' as const,
                metadata: {},
              };
            })
          : [];

    const items = await upsertUmkmTables({
      storeId: store.id,
      tables: rows,
    });

    if (payload.create_offline_qr !== false) {
      await Promise.all(
        items.map((table) =>
          ensureUmkmQrToken({
            storeId: store.id,
            mode: 'offline',
            tableId: table.id,
          }),
        ),
      );
    }

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
    console.error('[UMKM_TABLES_UPSERT_ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update tables' },
      { status: 400 },
    );
  }
}
