import { NextResponse } from 'next/server';
import { getPortalAccount } from '@/lib/portal-server';
import { addProductToBusiness } from '@/lib/portal-store';

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const account = await getPortalAccount({ clearInvalidSession: true });
  const { businessId } = await context.params;

  if (!account) {
    return NextResponse.json(
      { error: 'Sesi habis atau akun tidak ditemukan. Login lagi dulu.' },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    name?: string;
    category?: string;
    priceLabel?: string;
    stockLabel?: string;
    sourceType?: 'owned' | 'consignment';
    ownerLabel?: string;
    stockCount?: number | string | null;
    stockUnit?: string;
    minStockAlert?: number | string | null;
    stockMode?: 'manual' | 'estimated';
    consignmentTerms?: string;
    notes?: string;
  };

  const stockCount =
    typeof body.stockCount === 'number'
      ? body.stockCount
      : typeof body.stockCount === 'string' && body.stockCount.trim()
        ? Number(body.stockCount)
        : null;
  const minStockAlert =
    typeof body.minStockAlert === 'number'
      ? body.minStockAlert
      : typeof body.minStockAlert === 'string' && body.minStockAlert.trim()
        ? Number(body.minStockAlert)
        : null;

  try {
    const business = addProductToBusiness(account.id, businessId, {
      name: body.name?.trim() ?? '',
      category: body.category?.trim() ?? '',
      priceLabel: body.priceLabel?.trim() ?? '',
      stockLabel: body.stockLabel?.trim() ?? '',
      sourceType: body.sourceType,
      ownerLabel: body.ownerLabel?.trim() ?? '',
      stockCount: Number.isFinite(stockCount) ? stockCount : null,
      stockUnit: body.stockUnit?.trim() ?? '',
      minStockAlert: Number.isFinite(minStockAlert) ? minStockAlert : null,
      stockMode: body.stockMode,
      consignmentTerms: body.consignmentTerms?.trim() ?? '',
      notes: body.notes?.trim() ?? '',
    });

    return NextResponse.json({ ok: true, business });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal tambah produk.' },
      { status: 400 },
    );
  }
}
