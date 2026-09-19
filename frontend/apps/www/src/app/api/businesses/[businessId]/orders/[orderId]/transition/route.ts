import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { buildForwardAuthHeaders, withProtectedRoute } from '@/lib/api/withProtectedRoute';
import { errorResponse } from '@/lib/api/errorResponse';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ businessId: string; orderId: string }> },
) {
  try {
    return withProtectedRoute(
      req,
      {
        routeKey: 'notifications-order-transition',
        ipLimit: 120,
        deviceLimit: 90,
        windowSeconds: 900,
      },
      async (ctx) => {
        const { businessId, orderId } = await context.params;
        if (!isUuid(businessId) || !isUuid(orderId)) {
          return NextResponse.json(
            { error: 'invalid_order_transition_identity' },
            { status: 400 },
          );
        }

        const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
        const expectedVersion = Number(body?.expected_version);
        const nextStatus = typeof body?.next_status === 'string' ? body.next_status.trim() : '';
        const reason = typeof body?.reason === 'string' ? body.reason.trim() : null;

        if (!Number.isSafeInteger(expectedVersion) || expectedVersion <= 0 || !nextStatus) {
          return NextResponse.json(
            { error: 'invalid_order_transition_request' },
            { status: 400 },
          );
        }

        const idempotencyKey =
          req.headers.get('idempotency-key')?.trim() || randomUUID();
        const upstream = await fetch(
          `${MARKETPLACE_URL}/v1/businesses/${businessId}/orders/${orderId}/transition`,
          {
            method: 'POST',
            headers: {
              ...buildForwardAuthHeaders(ctx),
              'content-type': 'application/json',
              'idempotency-key': idempotencyKey,
            },
            body: JSON.stringify({
              expected_version: expectedVersion,
              next_status: nextStatus,
              reason,
            }),
            cache: 'no-store',
          },
        );

        const payload = await upstream.json().catch(() => ({}));
        return NextResponse.json(payload, { status: upstream.status });
      },
    );
  } catch (error) {
    console.error('[NOTIFICATIONS_ORDER_TRANSITION_ERROR]', error);
    return errorResponse(503, 'Service unavailable');
  }
}
