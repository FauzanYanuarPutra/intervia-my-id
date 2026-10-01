import { NextResponse } from 'next/server';
import { applyBusinessReset, previewBusinessReset, type BusinessResetRequest } from '@/lib/business-reset-server';

type RouteContext = {
  params: Promise<{ businessId: string }>;
};

function readRequest(body: Record<string, unknown>): BusinessResetRequest {
  const scopes = Array.isArray(body.scopes)
    ? body.scopes.filter((value): value is BusinessResetRequest['scopes'][number] => typeof value === 'string')
    : [];
  return {
    scopes,
    reason: typeof body.reason === 'string' ? body.reason : '',
    confirmation: typeof body.confirmation === 'string' ? body.confirmation : '',
    effective_on:
      typeof body.effective_on === 'string' && body.effective_on.trim()
        ? body.effective_on
        : null,
  };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { businessId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = body.action === 'apply' ? 'apply' : 'preview';
    const input = readRequest(body);

    if (action === 'preview') {
      return NextResponse.json({ data: await previewBusinessReset(businessId, input) });
    }

    const idempotencyKey =
      request.headers.get('Idempotency-Key')?.trim() || crypto.randomUUID();

    return NextResponse.json({
      data: await applyBusinessReset(businessId, input, idempotencyKey),
    });
  } catch (error) {
    const status =
      error && typeof error === 'object' && 'status' in error &&
      typeof (error as { status?: unknown }).status === 'number'
        ? (error as { status: number }).status
        : 502;
    const code =
      error && typeof error === 'object' && 'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : 'business_data_reset_request_failed';

    return NextResponse.json({ error: code }, { status });
  }
}
