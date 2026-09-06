import { NextResponse } from 'next/server';
import {
  BusinessControlHttpError,
  getControlRecipe,
  replaceControlRecipe,
} from '@/lib/business-control-server';

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof BusinessControlHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ businessId: string; productId: string }> },
) {
  const { businessId, productId } = await context.params;
  try {
    const recipe = await getControlRecipe(businessId, productId);
    if (!recipe) return NextResponse.json({ error: 'recipe_not_found' }, { status: 404 });
    return NextResponse.json({ data: { recipe } });
  } catch (error) {
    return errorResponse(error, 'Gagal memuat resep produk.');
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ businessId: string; productId: string }> },
) {
  const { businessId, productId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = await replaceControlRecipe(businessId, productId, body);
    return NextResponse.json(payload);
  } catch (error) {
    return errorResponse(error, 'Gagal menyimpan resep produk.');
  }
}
