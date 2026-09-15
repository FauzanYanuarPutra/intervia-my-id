import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { createPublicCommerceOrder } from '@/lib/server/publicCommerceOrder';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { superAppEntityIdSchema } from '@/lib/super-app/idSchema';

const SelectionSchema = z.object({
  group_id: z.string().uuid(),
  option_ids: z.array(z.string().uuid()).max(50),
});

const StorefrontOrderSchema = z.object({
  store_id: superAppEntityIdSchema,
  items: z.array(z.object({
    product_id: superAppEntityIdSchema,
    quantity: z.number().int().min(1).max(200),
    note: z.string().max(200).optional(),
    selections: z.array(SelectionSchema).max(20).optional(),
  })).min(1).max(120),
  fulfillment_mode: z.enum(['courier', 'pickup', 'digital']).optional(),
  note: z.string().max(500).optional(),
  source_surface: z.string().max(120).optional(),
});

function idempotencyKey(req: NextRequest): string {
  const supplied = req.headers.get('idempotency-key')?.trim();
  return supplied && z.string().uuid().safeParse(supplied).success ? supplied : randomUUID();
}

export async function POST(req: NextRequest) {
  const security = await enforceAuthRouteSecurity(req, {
    routeKey: 'storefront-canonical-order',
    ipLimit: 220,
    deviceLimit: 180,
    windowSeconds: 3600,
  });
  if (!security.ok) return security.response;

  const rateLimit = await enforceRateLimit({
    key: `storefront:orders:create:${security.ip}`,
    limit: 140,
    windowSeconds: 3600,
    message: 'Terlalu banyak percobaan checkout. Coba lagi sebentar.',
  });
  if (!rateLimit.ok) return rateLimit.response;

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const parsed = await parseJsonBodyWithSchema(req, StorefrontOrderSchema);
  if (!parsed.ok) return parsed.response;
  const payload = parsed.data;

  const canonicalOrder = await createPublicCommerceOrder({
    token: auth.ctx.token,
    idempotencyKey: idempotencyKey(req),
    intent: {
      items: payload.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        ...(item.note?.trim() ? { note: item.note.trim() } : {}),
        ...(item.selections?.length ? { selections: item.selections } : {}),
      })),
      ...(payload.fulfillment_mode ? { fulfillment_mode: payload.fulfillment_mode } : {}),
      ...(payload.note?.trim() ? { note: payload.note.trim() } : {}),
      source_surface: payload.source_surface?.trim() || 'www_umkm_storefront',
    },
  });

  if (!canonicalOrder.ok) {
    return NextResponse.json({ error: canonicalOrder.error }, { status: canonicalOrder.status });
  }

  return NextResponse.json({ data: canonicalOrder.data }, { status: canonicalOrder.status });
}
