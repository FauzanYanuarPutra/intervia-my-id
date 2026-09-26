import { NextResponse } from 'next/server';
import {
  CommercialCoreHttpError,
  createCommercialParty,
  listCommercialParties,
} from '@/lib/business-commercial-core-server';

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof CommercialCoreHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  const includeArchived =
    new URL(request.url).searchParams.get('include_archived') === 'true';

  try {
    const items = await listCommercialParties(businessId, includeArchived);
    return NextResponse.json({ data: { items, count: items.length } });
  } catch (error) {
    return errorResponse(error, 'Gagal memuat pelanggan dan mitra.');
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: 'missing_idempotency_key' },
      { status: 400 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const party = await createCommercialParty(
      businessId,
      idempotencyKey,
      body,
    );
    return NextResponse.json({ data: { party } }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Gagal menyimpan pelanggan atau mitra.');
  }
}
