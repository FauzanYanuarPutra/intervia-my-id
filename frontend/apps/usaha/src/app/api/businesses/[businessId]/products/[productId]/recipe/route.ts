import { NextResponse } from 'next/server';
import {
  BusinessControlHttpError,
  deleteControlRecipe,
  getControlRecipe,
  listControlRecipeHistory,
  replaceControlRecipe,
} from '@/lib/business-control-server';

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof BusinessControlHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string; productId: string }> },
) {
  const { businessId, productId } = await context.params;
  try {
    const url = new URL(request.url);
    if (url.searchParams.get('history') === '1') {
      const history = await listControlRecipeHistory(businessId, productId);
      return NextResponse.json({ data: { history } });
    }
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

export async function DELETE(
  request: Request,
  context: { params: Promise<{ businessId: string; productId: string }> },
) {
  const { businessId, productId } = await context.params;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const payload = await deleteControlRecipe(businessId, productId, body);
    return NextResponse.json(payload);
  } catch (error) {
    return errorResponse(error, 'Gagal menghapus resep aktif.');
  }
}
