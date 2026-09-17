import { NextResponse } from 'next/server';
import {
  createFinanceCoreEntry,
  FinanceCoreHttpError,
  listFinanceCoreEntries,
} from '@/lib/finance-core-server';

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof FinanceCoreHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  try {
    const items = await listFinanceCoreEntries(businessId);
    return NextResponse.json({ data: { items, count: items.length } });
  } catch (error) {
    return errorResponse(error, 'Gagal memuat riwayat keuangan.');
  }
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
    const payload = await createFinanceCoreEntry(businessId, idempotencyKey, body);
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Gagal menyimpan transaksi.');
  }
}
