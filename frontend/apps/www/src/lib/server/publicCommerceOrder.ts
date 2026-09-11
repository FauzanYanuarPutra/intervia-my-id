import 'server-only';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

export type PublicCommerceOrderIntent = {
  items: Array<{
    product_id: string;
    quantity: number;
    note?: string;
  }>;
  fulfillment_mode?: 'courier' | 'pickup' | 'digital';
  note?: string;
  source_surface: string;
};

type PublicCommerceOrderBundle = {
  order: {
    id: string;
    order_number: string;
    business_id: string;
    base_status: string;
    payment_status: string;
    currency: string;
    subtotal_amount: string | number;
    total_amount: string | number;
    source_type: string;
    source_surface?: string | null;
    created_at: string;
  };
  items: Array<{
    product_id: string;
    item_name: string;
    quantity: string | number;
    unit_price: string | number;
    line_total: string | number;
  }>;
  replayed: boolean;
};

export type PublicCommerceOrderResult =
  | {
      ok: true;
      status: 200 | 201;
      data: PublicCommerceOrderBundle;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

function normalizeMarketplaceStatus(status: number): number {
  if ([400, 401, 404, 409, 422, 429].includes(status)) return status;
  if (status >= 500) return 502;
  return 502;
}

export async function createPublicCommerceOrder(input: {
  token: string;
  idempotencyKey: string;
  intent: PublicCommerceOrderIntent;
}): Promise<PublicCommerceOrderResult> {
  let response: Response;
  try {
    response = await fetch(`${MARKETPLACE_URL}/v1/public/commerce/orders`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.token}`,
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify(input.intent),
    });
  } catch {
    return {
      ok: false,
      status: 503,
      error: 'marketplace_order_unavailable',
    };
  }

  const payload = (await response.json().catch(() => null)) as
    | PublicCommerceOrderBundle
    | { error?: unknown }
    | null;

  if (!response.ok) {
    const backendError =
      payload && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : 'marketplace_order_failed';
    return {
      ok: false,
      status: normalizeMarketplaceStatus(response.status),
      error: backendError,
    };
  }

  if (
    !payload ||
    !('order' in payload) ||
    typeof payload.order !== 'object' ||
    payload.order === null ||
    !('id' in payload.order) ||
    typeof payload.order.id !== 'string'
  ) {
    return {
      ok: false,
      status: 502,
      error: 'marketplace_invalid_order_response',
    };
  }

  return {
    ok: true,
    status: response.status === 200 ? 200 : 201,
    data: payload as PublicCommerceOrderBundle,
  };
}
