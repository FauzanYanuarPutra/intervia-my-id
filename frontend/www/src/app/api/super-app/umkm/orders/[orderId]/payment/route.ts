import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { buildForwardAuthHeaders, withProtectedRoute } from '@/lib/api/withProtectedRoute';
import { errorResponse } from '@/lib/api/errorResponse';
import { withValidatedBody } from '@/lib/api/withValidatedBody';
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

const CreateUmkmOrderPaymentSchema = z.object({
  environment: z.enum(['development', 'live']).optional(),
  payment_provider: z
    .enum(['midtrans', 'stripe', 'xendit', 'paypal', 'adyen', 'manual', 'mock'])
    .optional(),
  payment_method: z.string().max(60).optional(),
});

type WalletTopup = {
  id: string;
  account_id: string;
  environment: 'development' | 'live';
  amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  currency: string;
  payment_provider: string;
  payment_method?: string | null;
  external_reference?: string | null;
  checkout_url?: string | null;
  payment_payload?: Record<string, unknown>;
  description?: string | null;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired';
  payment_due_at?: string | null;
  paid_at?: string | null;
  expired_at?: string | null;
  created_at: string;
  updated_at: string;
};

type WalletTopupListResponse = {
  items?: WalletTopup[];
  error?: string;
};

type WalletTopupResponse = {
  topup?: WalletTopup;
  error?: string;
  reused_pending_topup?: boolean;
};

const SUPPORTED_GATEWAY_METHODS = new Set([
  'bank_transfer',
  'bca_va',
  'mandiri_va',
  'qris',
  'gopay',
  'shopeepay',
]);

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeGatewayMethod(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'qris';
  if (normalized === 'wallet') return 'wallet';
  return SUPPORTED_GATEWAY_METHODS.has(normalized) ? normalized : 'qris';
}

function readPaymentTiming(orderMeta: Record<string, unknown>): 'prepay' | 'postpay' {
  const paymentFlow = asObject(orderMeta.payment_flow);
  const timing = asString(paymentFlow.timing || orderMeta.payment_timing).toLowerCase();
  if (timing === 'postpay') return 'postpay';
  return 'prepay';
}

function readCustomerUserId(orderMeta: Record<string, unknown>): string {
  return asString(orderMeta.customer_user_id);
}

function parseTopupPaymentDueAt(topup: WalletTopup): Date | null {
  const direct = asString(topup.payment_due_at);
  const payload = asObject(topup.payment_payload);
  const walletFlow = asObject(payload.wallet_flow);
  const fallback = asString(walletFlow.payment_due_at);
  const raw = direct || fallback;
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function readTopupClientMetadata(topup: WalletTopup): Record<string, unknown> {
  const payload = asObject(topup.payment_payload);
  return asObject(payload.client_metadata);
}

function matchesOrderPendingTopup(input: {
  topup: WalletTopup;
  orderId: string;
  storeId: string;
  totalCents: number;
  paymentProvider: string;
  paymentMethod: string;
}): boolean {
  const clientMeta = readTopupClientMetadata(input.topup);
  if (asString(clientMeta.umkm_order_id) !== input.orderId) return false;
  if (asString(clientMeta.umkm_store_id) !== input.storeId) return false;
  if (Number(input.topup.amount_cents || 0) !== input.totalCents) return false;
  if (asString(input.topup.payment_provider).toLowerCase() !== input.paymentProvider) return false;

  const topupMethod = asString(input.topup.payment_method).toLowerCase();
  if (topupMethod && topupMethod !== input.paymentMethod) return false;

  const dueAt = parseTopupPaymentDueAt(input.topup);
  if (dueAt && dueAt.getTime() <= Date.now()) return false;

  return input.topup.status === 'pending';
}

async function attachOrderPaymentCheckout(input: {
  orderId: string;
  paymentMethod: 'bank_transfer';
  topup: WalletTopup;
  reusedPendingTopup?: boolean;
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
        linked_at: new Date().toISOString(),
        reused_pending_topup: input.reusedPendingTopup === true,
      },
    },
  });
}

async function settlePaidUmkmOrder(input: {
  orderId: string;
  paymentMethod: 'bank_transfer';
  topup: WalletTopup;
}) {
  await attachOrderPaymentCheckout({
    orderId: input.orderId,
    paymentMethod: input.paymentMethod,
    topup: input.topup,
  });

  return checkoutUmkmOrder({
    orderId: input.orderId,
    paymentMethod: input.paymentMethod,
    paymentMetadata: {
      topup_id: input.topup.id,
      topup_status: input.topup.status,
      topup_paid_at: input.topup.paid_at || input.topup.updated_at,
      topup_environment: input.topup.environment,
      payment_provider: input.topup.payment_provider,
      payment_method: input.topup.payment_method || input.paymentMethod,
      external_reference: input.topup.external_reference || null,
      checkout_url: input.topup.checkout_url || null,
    },
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const body = await withValidatedBody(req, CreateUmkmOrderPaymentSchema);
  if (!body.ok) return body.response;

  const { orderId } = await context.params;

  try {
    return withProtectedRoute(
      req,
      {
        routeKey: 'super-app-umkm-order-payment',
        ipLimit: 120,
        deviceLimit: 90,
        windowSeconds: 900,
      },
      async (ctx) => {
        const bundle = await getUmkmOrderById(orderId);
        if (!bundle) {
          return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const orderMeta = asObject(bundle.order.metadata);
        const customerUserId = readCustomerUserId(orderMeta);
        if (customerUserId && customerUserId !== auth.ctx.userId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (bundle.order.channel !== 'online') {
          return NextResponse.json({ error: 'Only online UMKM orders support this payment flow' }, { status: 400 });
        }

        if (readPaymentTiming(orderMeta) !== 'prepay') {
          return NextResponse.json({ error: 'This order does not require online prepayment' }, { status: 400 });
        }

        if (bundle.order.payment_status === 'paid') {
          return NextResponse.json(
            {
              data: {
                ...bundle,
                payment: {
                  topup: null,
                  reused_pending_topup: false,
                  requires_action: false,
                },
              },
            },
            { status: 200 },
          );
        }

        const requestedMethod = normalizeGatewayMethod(
          asString(body.data.payment_method || bundle.order.payment_method),
        );
        if (requestedMethod === 'wallet') {
          return NextResponse.json(
            { error: 'Wallet balance payment is not available yet for UMKM online checkout' },
            { status: 409 },
          );
        }

        const orderPaymentMethod = 'bank_transfer' as const;
        const gatewayPaymentMethod = requestedMethod || 'qris';
        const paymentProvider = asString(body.data.payment_provider || 'midtrans').toLowerCase() || 'midtrans';
        const environment =
          body.data.environment ||
          (String(process.env.WALLET_DEFAULT_ENV || '').trim().toLowerCase() === 'live'
            ? 'live'
            : 'development');

        let matchedPendingTopup: WalletTopup | null = null;
        try {
          const params = new URLSearchParams({
            environment,
            status: 'pending',
            limit: '25',
            offset: '0',
          });
          const pendingRes = await fetch(`${MARKETPLACE_URL}/v1/wallet/topups?${params.toString()}`, {
            method: 'GET',
            headers: buildForwardAuthHeaders(ctx),
            cache: 'no-store',
          });
          const pendingPayload = (await pendingRes.json().catch(() => ({}))) as WalletTopupListResponse;
          if (pendingRes.ok) {
            const items = Array.isArray(pendingPayload.items) ? pendingPayload.items : [];
            matchedPendingTopup =
              items.find((topup) =>
                matchesOrderPendingTopup({
                  topup,
                  orderId: bundle.order.id,
                  storeId: bundle.order.store_id,
                  totalCents: bundle.order.total_cents,
                  paymentProvider,
                  paymentMethod: gatewayPaymentMethod,
                }),
              ) || null;
          }
        } catch (error) {
          console.warn('[UMKM_ORDER_PAYMENT_PENDING_LOOKUP_ERROR]', error);
        }

        let topup = matchedPendingTopup;
        let reusedPendingTopup = Boolean(matchedPendingTopup);

        if (!topup) {
          const upstream = await fetch(`${MARKETPLACE_URL}/v1/wallet/topups`, {
            method: 'POST',
            headers: buildForwardAuthHeaders(ctx, {
              'Content-Type': 'application/json',
              'X-Idempotency-Key':
                req.headers.get('x-idempotency-key') || `umkm-order-payment-${bundle.order.id}`,
            }),
            body: JSON.stringify({
              amount_cents: bundle.order.total_cents,
              currency: 'IDR',
              environment,
              payment_provider: paymentProvider,
              payment_method: gatewayPaymentMethod,
              description: `UMKM order ${bundle.order.id}`,
              metadata: {
                source: 'umkm_order_payment',
                umkm_order_id: bundle.order.id,
                umkm_store_id: bundle.order.store_id,
                umkm_channel: bundle.order.channel,
                customer_user_id: auth.ctx.userId,
              },
            }),
          });

          const payload = (await upstream.json().catch(() => ({}))) as WalletTopupResponse;
          if (!upstream.ok || !payload.topup) {
            return NextResponse.json(
              { error: payload.error || 'Failed to create UMKM payment session' },
              { status: upstream.status || 502 },
            );
          }

          topup = payload.topup;
          reusedPendingTopup = payload.reused_pending_topup === true;
        }

        const updatedBundle =
          topup.status === 'paid'
            ? await settlePaidUmkmOrder({
                orderId: bundle.order.id,
                paymentMethod: orderPaymentMethod,
                topup,
              })
            : await attachOrderPaymentCheckout({
                orderId: bundle.order.id,
                paymentMethod: orderPaymentMethod,
                topup,
                reusedPendingTopup,
              });

        return NextResponse.json(
          {
            data: {
              ...updatedBundle,
              payment: {
                topup,
                reused_pending_topup: reusedPendingTopup,
                requires_action: topup.status !== 'paid',
              },
            },
          },
          { status: reusedPendingTopup ? 200 : 201 },
        );
      },
    );
  } catch (error) {
    console.error('[UMKM_ORDER_PAYMENT_CREATE_ERROR]', error);
    return errorResponse(503, 'Service unavailable');
  }
}
