import { NextResponse } from 'next/server';
import {
  FinanceCoreHttpError,
  getFinanceCoreAllocations,
} from '@/lib/finance-core-server';

function errorResponse(error: unknown) {
  if (error instanceof FinanceCoreHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: 'Gagal memuat kantong uang.' }, { status: 500 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  try {
    const items = await getFinanceCoreAllocations(businessId);
    return NextResponse.json({ data: { items } });
  } catch (error) {
    return errorResponse(error);
  }
}
