import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { BusinessControlHttpError } from '@/lib/business-control-server';
import { adjustControlIngredientStock } from '@/lib/ingredient-management-server';

function errorResponse(error: unknown) {
  if (error instanceof BusinessControlHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json(
    { error: 'Gagal memperbarui stok bahan.' },
    { status: 500 },
  );
}

type StockAction = 'purchase' | 'waste' | 'other_usage' | 'correction';

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string; ingredientId: string }> },
) {
  const { businessId, ingredientId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const locationId = typeof body.location_id === 'string' ? body.location_id : '';
    const action = typeof body.action === 'string' ? (body.action as StockAction) : null;
    const quantity = Number(body.quantity);
    const direction = body.direction === 'out' ? 'out' : 'in';
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    if (!locationId || !action || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: 'invalid_stock_adjustment' },
        { status: 400 },
      );
    }

    let payload: Record<string, unknown>;
    switch (action) {
      case 'purchase':
        payload = {
          ingredient_id: ingredientId,
          operation: 'purchase_receipt',
          quantity,
          reason: note || null,
          evidence_refs: [],
        };
        break;
      case 'waste':
        payload = {
          ingredient_id: ingredientId,
          operation: 'waste',
          quantity,
          reason: note || 'Rusak / terbuang',
          evidence_refs: [],
        };
        break;
      case 'other_usage':
        payload = {
          ingredient_id: ingredientId,
          operation: 'return_out',
          quantity,
          reason: note || 'Pemakaian lain',
          evidence_refs: [],
        };
        break;
      case 'correction':
        payload = {
          ingredient_id: ingredientId,
          operation: 'adjustment',
          quantity_delta: direction === 'out' ? -quantity : quantity,
          reason: note || 'Koreksi stok',
          evidence_refs: [],
        };
        break;
      default:
        return NextResponse.json(
          { error: 'invalid_stock_adjustment' },
          { status: 400 },
        );
    }

    const result = await adjustControlIngredientStock(
      businessId,
      locationId,
      randomUUID(),
      payload,
    );
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
