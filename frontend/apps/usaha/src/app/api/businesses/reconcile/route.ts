import { NextResponse } from 'next/server';
import { reconcileBusiness } from '@/lib/business-server';
import { normalizeBusinessApiError } from '@/lib/business-api-error';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const storeId = typeof body.storeId === 'string' ? body.storeId.trim() : null;
    const idempotencyKey =
      request.headers.get('Idempotency-Key')?.trim() ||
      (typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '') ||
      crypto.randomUUID();
    const result = await reconcileBusiness({ storeId, idempotencyKey });
    return NextResponse.json({
      ok: true,
      replayed: result.replayed,
      businessId: result.businessId,
      redirectTo: `/?business=${encodeURIComponent(result.businessId)}&reconciled=1`,
    });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Usaha lama belum bisa dipulihkan.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}
