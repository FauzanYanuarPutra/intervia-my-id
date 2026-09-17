import { NextResponse } from 'next/server';
import { BusinessControlHttpError } from '@/lib/business-control-server';
import { updateControlIngredient } from '@/lib/ingredient-management-server';

function errorResponse(error: unknown) {
  if (error instanceof BusinessControlHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json(
    { error: 'Gagal memperbarui bahan usaha.' },
    { status: 500 },
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ businessId: string; ingredientId: string }> },
) {
  const { businessId, ingredientId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = await updateControlIngredient(
      businessId,
      ingredientId,
      body,
    );
    return NextResponse.json(payload);
  } catch (error) {
    return errorResponse(error);
  }
}
