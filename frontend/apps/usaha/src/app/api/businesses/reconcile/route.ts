import { NextResponse } from 'next/server';
import { reconcileBusiness } from '@/lib/business-server';

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
    const message = error instanceof Error ? error.message : 'Usaha lama belum bisa dipulihkan.';
    const status = message === 'AUTH_REQUIRED' ? 401 : message.includes('selection') ? 409 : 400;
    return NextResponse.json({ error: message === 'AUTH_REQUIRED' ? 'Login dulu.' : message }, { status });
  }
}
