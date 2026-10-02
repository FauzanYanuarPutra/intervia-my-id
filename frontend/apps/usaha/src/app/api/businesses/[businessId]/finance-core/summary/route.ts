import { NextResponse } from 'next/server';
import {
  FinanceCoreHttpError,
  getFinanceCoreSummary,
} from '@/lib/finance-core-server';

function errorResponse(error: unknown) {
  if (error instanceof FinanceCoreHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: 'Gagal memuat ringkasan keuangan.' }, { status: 500 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from')?.trim() || undefined;
    const to = url.searchParams.get('to')?.trim() || undefined;
    const summary = await getFinanceCoreSummary(businessId, { from, to });
    return NextResponse.json({ data: { summary } });
  } catch (error) {
    return errorResponse(error);
  }
}
