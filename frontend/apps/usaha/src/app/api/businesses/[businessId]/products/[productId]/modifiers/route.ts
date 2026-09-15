import { NextResponse } from 'next/server';
import { normalizeBusinessApiError } from '@/lib/business-api-error';
import {
  getCanonicalProductModifiers,
  replaceCanonicalProductModifiers,
} from '@/lib/product-mutation-server';

export async function GET(
  _request: Request,
  context: { params: Promise<{ businessId: string; productId: string }> },
) {
  const { businessId, productId } = await context.params;
  try {
    const payload = await getCanonicalProductModifiers(businessId, productId);
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Gagal memuat pilihan produk.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ businessId: string; productId: string }> },
) {
  const { businessId, productId } = await context.params;
  try {
    const body = (await request.json()) as unknown;
    const payload = await replaceCanonicalProductModifiers(businessId, productId, body);
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Gagal menyimpan pilihan produk.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}
