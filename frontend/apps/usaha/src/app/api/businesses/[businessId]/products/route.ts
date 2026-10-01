import { NextResponse } from 'next/server';
import { createBusinessProduct } from '@/lib/business-server';
import { normalizeBusinessApiError } from '@/lib/business-api-error';
import { parseBusinessImageValue } from '@/lib/media-crop';

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
    const stockProvided = body.stockCount !== undefined && body.stockCount !== null && body.stockCount !== '';
    const minStockAlertProvided = body.minStockAlert !== undefined && body.minStockAlert !== null && body.minStockAlert !== '';
    const stockCount = num(body.stockCount);
    const minStockAlert = num(body.minStockAlert);
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const priceLabel = typeof body.priceLabel === 'string' ? body.priceLabel.trim() : '';
    const stockUnit = typeof body.stockUnit === 'string' ? body.stockUnit.trim() : '';
    const ownerLabel = typeof body.ownerLabel === 'string' ? body.ownerLabel.trim() : '';
    const consignmentTerms = typeof body.consignmentTerms === 'string' ? body.consignmentTerms.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    if (name.length > 160) return NextResponse.json({ error: 'Nama produk maksimal 160 karakter.', code: 'invalid_product_name' }, { status: 400 });
    if (category.length < 1 || category.length > 100) return NextResponse.json({ error: 'Kategori produk belum valid.', code: 'invalid_product_category' }, { status: 400 });
    if (!priceLabel || priceLabel.length > 100) return NextResponse.json({ error: 'Isi harga produk.', code: 'invalid_product_price_label' }, { status: 400 });
    if (stockProvided && (stockCount === null || stockCount < 0)) return NextResponse.json({ error: 'Jumlah stok harus berupa angka nol atau lebih.', code: 'invalid_product_stock_count' }, { status: 400 });
    if (minStockAlertProvided && (minStockAlert === null || minStockAlert < 0)) return NextResponse.json({ error: 'Batas stok tipis harus berupa angka nol atau lebih.', code: 'invalid_product_min_stock_alert' }, { status: 400 });
    if (stockUnit.length < 1 || stockUnit.length > 40) return NextResponse.json({ error: 'Isi satuan stok, misalnya pcs atau botol.', code: 'invalid_product_stock_unit' }, { status: 400 });
    if (ownerLabel.length > 160) return NextResponse.json({ error: 'Nama penitip atau supplier terlalu panjang.', code: 'invalid_product_owner_label' }, { status: 400 });
    if (consignmentTerms.length > 1000) return NextResponse.json({ error: 'Skema titip jual terlalu panjang.', code: 'invalid_product_consignment_terms' }, { status: 400 });
    if (notes.length > 4000) return NextResponse.json({ error: 'Catatan produk terlalu panjang.', code: 'invalid_product_notes' }, { status: 400 });

    const updated = await createBusinessProduct(businessId, {
      name,
      category,
      priceLabel,
      sourceType: body.sourceType === 'consignment' ? 'consignment' : 'owned',
      ownerLabel,
      stockCount,
      stockUnit,
      minStockAlert,
      stockMode: body.stockMode === 'estimated' ? 'estimated' : 'manual',
      consignmentTerms,
      notes,
      image: parseBusinessImageValue(body.image),
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
