import { NextResponse } from 'next/server';
import { getSalesPeriodSummary } from '@/lib/sales-summary-server';

export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from')?.trim() || undefined;
    const to = url.searchParams.get('to')?.trim() || undefined;
    const summary = await getSalesPeriodSummary(businessId, { from, to });
    return NextResponse.json({ data: { summary } });
  } catch (error) {
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number((error as { status?: unknown }).status) || 500
        : 500;
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code || 'sales_summary_request_failed')
        : 'sales_summary_request_failed';
    return NextResponse.json({ error: code }, { status });
  }
}
