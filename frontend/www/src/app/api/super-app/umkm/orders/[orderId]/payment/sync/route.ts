import { NextRequest, NextResponse } from 'next/server';
import { buildForwardAuthHeaders, withProtectedRoute } from '@/lib/api/withProtectedRoute';
import { errorResponse } from '@/lib/api/errorResponse';
import { requireAuth } from '@/lib/serverAuth';
import {
  checkoutUmkmOrder,
  getUmkmOrderById,
  updateUmkmOrderPaymentCheckout,
} from '@/lib/super-app/umkm-commerce';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

type WalletTopup = {
  id: string;
  environment: 'development' | 'live';
  payment_provider: string;
  payment_method?: string | null;
  external_reference?: string | null;
  checkout_url?: string | null;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired';
  paid_at?: string | null;
  updated_at: string;
};

type WalletTopupSyncResponse = {
  topup?: WalletTopup;
  synced?: boolean;
  reason?: string;
  error?: string;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function attachOrderPaymentCheckout(input: {
  orderId: string;
  paymentMethod: 'bank_transfer';
  topup: WalletTopup;
}) {
  return updateUmkmOrderPaymentCheckout({
    orderId: input.orderId,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.topup.status === 'paid' ? 'paid' : 'unpaid',
    paymentStage: input.topup.status === 'paid' ? 'paid' : 'awaiting_prepayment',
    metadataPatch: {
      payment_checkout: {
        topup_id: input.topup.id,
        status: input.topup.status,
        environment: input.topup.environment,
        payment_provider: input.topup.payment_provider,
        payment_method: input.topup.payment_method || input.paymentMethod,
        checkout_url: input.topup.checkout_url || null,
        external_reference: input.topup.external_reference || null,
        synced_at: new Date().toISOString(),
      },
    },
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const { orderId } = await context.params;

  try {
    return withProtectedRoute(
      req,
      {
        routeKey: 'super-app-umkm-order-payment-sync',
        ipLimit: 180,
        deviceLimit: 140,
        windowSeconds: 900,
      },
      async (ctx) => {
        const current = await getUmkmOrderById(orderId);
        if (!current) {
          return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const orderMeta = asObject(current.order.metadata);
        const customerUserId = asString(orderMeta.customer_user_id);
        if (customerUserId && customerUserId !== auth.ctx.userId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const paymentCheckout = asObject(orderMeta.payment_checkout);
        const topupId = asString(paymentCheckout.topup_id);
        if (!topupId) {
          return NextResponse.json({ error: 'No linked payment session found for this order' }, { status: 400 });
        }

        const upstream = await fetch(
          `${MARKETPLACE_URL}/v1/wallet/topups/${encodeURIComponent(topupId)}/sync`,
          {
            method: 'POST',
            headers: buildForwardAuthHeaders(ctx, {
              'X-Idempotency-Key':
                req.headers.get('x-idempotency-key') || `umkm-order-payment-sync-${orderId}-${topupId}`,
            }),
          },
        );
        const payload = (await upstream.json().catch(() => ({}))) as WalletTopupSyncResponse;
        if (!upstream.ok || !payload.topup) {
          return NextResponse.json(
            { error: payload.error || 'Failed to sync UMKM payment status' },
            { status: upstream.status || 502 },
          );
        }

        const topup = payload.topup;
        const paymentMethod = 'bank_transfer' as const;

        const updatedBundle =
          topup.status === 'paid' && current.order.payment_status !== 'paid'
            ? await (async () => {
                await attachOrderPaymentCheckout({
                  orderId: current.order.id,
                  paymentMethod,
                  topup,
                });
                return checkoutUmkmOrder({
                  orderId: current.order.id,
                  paymentMethod,
                  paymentMetadata: {
                    topup_id: topup.id,
                    topup_status: topup.status,
                    topup_paid_at: topup.paid_at || topup.updated_at,
                    topup_environment: topup.environment,
                    payment_provider: topup.payment_provider,
                    payment_method: topup.payment_method || paymentMethod,
                    external_reference: topup.external_reference || null,
                    checkout_url: topup.checkout_url || null,
                  },
                });
              })()
            : await attachOrderPaymentCheckout({
                orderId: current.order.id,
                paymentMethod,
                topup,
              });

        return NextResponse.json(
          {
            data: {
              ...updatedBundle,
              payment: {
                topup,
                synced: payload.synced === true,
                reason: payload.reason || null,
                requires_action: topup.status !== 'paid',
              },
            },
          },
          { status: 200 },
        );
      },
    );
  } catch (error) {
    console.error('[UMKM_ORDER_PAYMENT_SYNC_ERROR]', error);
    return errorResponse(503, 'Service unavailable');
  }
}
