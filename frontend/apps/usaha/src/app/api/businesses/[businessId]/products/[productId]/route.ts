import { NextResponse } from 'next/server';
import { normalizeBusinessApiError } from '@/lib/business-api-error';
import { updateCanonicalProduct } from '@/lib/product-mutation-server';

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Number(parsed) : undefined;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ businessId: string; productId: string }> },
) {
  const { businessId, productId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    await updateCanonicalProduct(businessId, productId, {
      name: optionalString(body.name),
      category: optionalString(body.category),
      priceLabel: optionalString(body.priceLabel),
      status: body.status === 'live' || body.status === 'draft' ? body.status : undefined,
      sourceType:
        body.sourceType === 'owned' || body.sourceType === 'consignment'
          ? body.sourceType
          : undefined,
      ownerLabel: optionalString(body.ownerLabel),
      minStockAlert: optionalNumber(body.minStockAlert),
      stockUnit: optionalString(body.stockUnit),
      stockMode:
        body.stockMode === 'manual' || body.stockMode === 'estimated'
          ? body.stockMode
          : undefined,
      consignmentTerms: optionalString(body.consignmentTerms),
      notes: optionalString(body.notes),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Gagal memperbarui produk.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}
