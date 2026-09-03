import { NextResponse } from 'next/server';
import { normalizeBusinessApiError } from '@/lib/business-api-error';
import { adjustCanonicalInventory } from '@/lib/product-mutation-server';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ businessId: string; productId: string }> },
) {
  const { businessId, productId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const rawStock = body.stockCount;
    const stockCount = rawStock === null || rawStock === ''
      ? null
      : typeof rawStock === 'number'
        ? rawStock
        : Number(rawStock);

    if (stockCount !== null && (!Number.isFinite(stockCount) || stockCount < 0)) {
      return NextResponse.json(
        { error: 'Jumlah stok harus berupa angka nol atau lebih.', code: 'invalid_product_stock_count' },
        { status: 400 },
      );
    }

    await adjustCanonicalInventory(businessId, productId, {
      stockCount,
      reason: typeof body.reason === 'string' ? body.reason : 'manual_adjustment',
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Gagal memperbarui stok.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}
