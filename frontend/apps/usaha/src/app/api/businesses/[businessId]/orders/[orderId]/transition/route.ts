import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  BusinessControlHttpError,
  transitionControlOrder,
} from '@/lib/business-control-server';

function errorResponse(error: unknown) {
  if (error instanceof BusinessControlHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json(
    { error: 'business_order_transition_failed' },
    { status: 500 },
  );
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ businessId: string; orderId: string }>;
  },
) {
  const { businessId, orderId } = await context.params;
  try {
    const body = (await request.json()) as {
      expected_version?: unknown;
      next_status?: unknown;
      reason?: unknown;
      metadata?: unknown;
    };
    const expectedVersion = Number(body.expected_version);
    const nextStatus =
      typeof body.next_status === 'string' ? body.next_status.trim() : '';
    const reason =
      typeof body.reason === 'string' ? body.reason.trim() : null;
    const metadata =
      body.metadata &&
      typeof body.metadata === 'object' &&
      !Array.isArray(body.metadata)
        ? body.metadata as Record<string, unknown>
        : null;

    if (!Number.isSafeInteger(expectedVersion) || expectedVersion <= 0 || !nextStatus) {
      return NextResponse.json(
        { error: 'invalid_order_transition_request' },
        { status: 400 },
      );
    }

    const incomingKey = request.headers.get('idempotency-key')?.trim();
    const result = await transitionControlOrder(
      businessId,
      orderId,
      incomingKey || randomUUID(),
      {
        expected_version: expectedVersion,
        next_status: nextStatus,
        reason,
        metadata,
      },
    );
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
