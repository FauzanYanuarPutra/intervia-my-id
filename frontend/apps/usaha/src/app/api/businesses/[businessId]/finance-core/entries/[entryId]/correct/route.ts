import { NextResponse } from 'next/server';
import {
  correctFinanceCoreEntry,
  FinanceCoreHttpError,
} from '@/lib/finance-core-server';

function errorResponse(error: unknown) {
  if (error instanceof FinanceCoreHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: 'Gagal mengoreksi transaksi.' }, { status: 500 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string; entryId: string }> },
) {
  const { businessId, entryId } = await context.params;
  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'missing_idempotency_key' }, { status: 400 });
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = await correctFinanceCoreEntry(
      businessId,
      entryId,
      idempotencyKey,
      body,
    );
    return NextResponse.json(payload);
  } catch (error) {
    return errorResponse(error);
  }
}
