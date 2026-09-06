import { NextResponse } from 'next/server';
import {
  BusinessControlHttpError,
  createControlFinanceEntry,
  listControlFinanceEntries,
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
    const items = await listControlFinanceEntries(businessId);
    return NextResponse.json({ data: { items, count: items.length } });
  } catch (error) {
    return errorResponse(error, 'Gagal memuat transaksi uang.');
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = await createControlFinanceEntry(businessId, body);
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Gagal menyimpan transaksi uang.');
  }
}
