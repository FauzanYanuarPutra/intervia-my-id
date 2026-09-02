import { NextResponse } from 'next/server';
import { createBusinessProduct } from '@/lib/business-server';
import { normalizeBusinessApiError } from '@/lib/business-api-error';

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Number(parsed) : null;
}

export async function POST(request: Request, context: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2) return NextResponse.json({ error: 'Isi nama produk.' }, { status: 400 });
    const stockCount = num(body.stockCount);
    const minStockAlert = num(body.minStockAlert);
    const updated = await createBusinessProduct(businessId, {
      name,
      category: typeof body.category === 'string' ? body.category.trim() : 'Umum',
      priceLabel: typeof body.priceLabel === 'string' ? body.priceLabel.trim() : '',
      sourceType: body.sourceType === 'consignment' ? 'consignment' : 'owned',
      ownerLabel: typeof body.ownerLabel === 'string' ? body.ownerLabel.trim() : '',
      stockCount,
      stockUnit: typeof body.stockUnit === 'string' ? body.stockUnit.trim() : 'pcs',
      minStockAlert,
      stockMode: body.stockMode === 'estimated' ? 'estimated' : 'manual',
      consignmentTerms: typeof body.consignmentTerms === 'string' ? body.consignmentTerms.trim() : '',
      notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    });
    return NextResponse.json({ ok: true, business: updated });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Gagal tambah produk.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}
