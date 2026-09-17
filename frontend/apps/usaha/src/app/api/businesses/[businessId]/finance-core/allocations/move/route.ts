import { NextResponse } from 'next/server';
import {
  FinanceCoreHttpError,
  moveFinanceCoreAllocation,
} from '@/lib/finance-core-server';

function errorResponse(error: unknown) {
  if (error instanceof FinanceCoreHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: 'Gagal memindahkan kantong uang.' }, { status: 500 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'missing_idempotency_key' }, { status: 400 });
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = await moveFinanceCoreAllocation(
      businessId,
      idempotencyKey,
      body,
    );
    return NextResponse.json(payload);
  } catch (error) {
    return errorResponse(error);
  }
}
