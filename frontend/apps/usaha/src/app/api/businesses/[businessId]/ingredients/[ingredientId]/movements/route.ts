import { NextResponse } from 'next/server';
import { BusinessControlHttpError } from '@/lib/business-control-server';
import { listControlIngredientMovements } from '@/lib/ingredient-management-server';

function errorResponse(error: unknown) {
  if (error instanceof BusinessControlHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json(
    { error: 'Gagal memuat riwayat stok bahan.' },
    { status: 500 },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string; ingredientId: string }> },
) {
  const { businessId, ingredientId } = await context.params;
  const locationId = new URL(request.url).searchParams.get('locationId') || '';
  if (!locationId) {
    return NextResponse.json({ error: 'location_required' }, { status: 400 });
  }

  try {
    const items = await listControlIngredientMovements(
      businessId,
      locationId,
      ingredientId,
    );
    return NextResponse.json({ data: { items, count: items.length } });
  } catch (error) {
    return errorResponse(error);
  }
}
