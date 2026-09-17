import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  BusinessControlHttpError,
  createControlSale,
  listControlSales,
} from '@/lib/business-control-server';

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof BusinessControlHttpError) {
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
    const items = await listControlSales(businessId);
    return NextResponse.json({ data: { items, count: items.length } });
  } catch (error) {
    return errorResponse(error, 'Gagal memuat penjualan tercatat.');
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const incomingKey = request.headers.get('idempotency-key')?.trim();
    const result = await createControlSale(
      businessId,
      incomingKey || randomUUID(),
      body,
    );
    return NextResponse.json(
      { data: result },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (error) {
    return errorResponse(error, 'Gagal menyimpan penjualan.');
  }
}
