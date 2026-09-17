import { NextResponse } from 'next/server';
import { BusinessControlHttpError } from '@/lib/business-control-server';
import { archiveControlIngredient } from '@/lib/ingredient-management-server';

function errorResponse(error: unknown) {
  if (error instanceof BusinessControlHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json(
    { error: 'Gagal mengarsipkan bahan.' },
    { status: 500 },
  );
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ businessId: string; ingredientId: string }> },
) {
  const { businessId, ingredientId } = await context.params;
  try {
    const payload = await archiveControlIngredient(businessId, ingredientId);
    return NextResponse.json(payload);
  } catch (error) {
    return errorResponse(error);
  }
}
