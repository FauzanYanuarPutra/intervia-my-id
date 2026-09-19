import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  BusinessControlHttpError,
  voidControlSale,
} from '@/lib/business-control-server';

function errorResponse(error: unknown) {
  if (error instanceof BusinessControlHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json(
    { error: 'business_sale_void_failed' },
    { status: 500 },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string; saleId: string }> },
) {
  const { businessId, saleId } = await context.params;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const incomingKey = request.headers.get('idempotency-key')?.trim();
    const result = await voidControlSale(
      businessId,
      saleId,
      incomingKey || randomUUID(),
      reason,
    );
    return NextResponse.json(
      { data: result },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
