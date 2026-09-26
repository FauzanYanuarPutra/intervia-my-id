import { NextResponse } from 'next/server';
import {
  CommercialCoreHttpError,
  updateCommercialParty,
} from '@/lib/business-commercial-core-server';

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof CommercialCoreHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ businessId: string; partyId: string }> },
) {
  const { businessId, partyId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const party = await updateCommercialParty(businessId, partyId, body);
    return NextResponse.json({ data: { party } });
  } catch (error) {
    return errorResponse(error, 'Gagal memperbarui pelanggan atau mitra.');
  }
}
