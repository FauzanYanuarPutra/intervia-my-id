import { NextResponse } from 'next/server';
import {
  FinanceCoreHttpError,
  transferFinanceCoreAccounts,
} from '@/lib/finance-core-server';

function errorResponse(error: unknown) {
  if (error instanceof FinanceCoreHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: 'Gagal memindahkan uang antar akun.' }, { status: 500 });
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
    const payload = await transferFinanceCoreAccounts(
      businessId,
      idempotencyKey,
      body,
    );
    const replayed =
      payload &&
      typeof payload === 'object' &&
      'data' in payload &&
      Boolean(
        (payload as { data?: { replayed?: boolean } }).data?.replayed,
      );
    return NextResponse.json(payload, { status: replayed ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
