import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getBusinessForCurrentActor, updateBusiness } from '@/lib/business-server';
import type { ProductRecord, ProductStockHealth } from '@/lib/portal-types';
import { normalizeBusinessApiError } from '@/lib/business-api-error';

function num(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Number(parsed) : null;
}

function stockHealth(stock: number | null, minimum: number | null): ProductStockHealth {
  if (stock === null) return 'perlu-cocokkan';
  if (stock <= 0) return 'habis';
  if (minimum !== null && stock <= minimum) return 'tipis';
  return 'aman';
}

export async function POST(request: Request, context: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await context.params;
  try {
    const business = await getBusinessForCurrentActor(businessId);
    if (!business) return NextResponse.json({ error: 'Usaha tidak ditemukan.' }, { status: 404 });
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2) return NextResponse.json({ error: 'Isi nama produk.' }, { status: 400 });
    const stockCount = num(body.stockCount);
    const minStockAlert = num(body.minStockAlert);
    const product: ProductRecord = {
      id: randomUUID(),
      name,
      category: typeof body.category === 'string' ? body.category.trim() : 'Umum',
      priceLabel: typeof body.priceLabel === 'string' ? body.priceLabel.trim() : '',
      stockLabel: typeof body.stockLabel === 'string' ? body.stockLabel.trim() : '',
      status: 'live',
      sourceType: body.sourceType === 'consignment' ? 'consignment' : 'owned',
      ownerLabel: typeof body.ownerLabel === 'string' ? body.ownerLabel.trim() : '',
      stockCount,
      stockUnit: typeof body.stockUnit === 'string' ? body.stockUnit.trim() : 'pcs',
      minStockAlert,
      stockMode: body.stockMode === 'estimated' ? 'estimated' : 'manual',
      stockHealth: stockHealth(stockCount, minStockAlert),
      stockUpdatedAt: new Date().toISOString(),
      consignmentTerms: typeof body.consignmentTerms === 'string' ? body.consignmentTerms.trim() : '',
      notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    };
    const products = [...business.products, product];
    const updated = await updateBusiness(business.id, { metadataPatch: { products } });
    return NextResponse.json({ ok: true, business: updated });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Gagal tambah produk.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}
