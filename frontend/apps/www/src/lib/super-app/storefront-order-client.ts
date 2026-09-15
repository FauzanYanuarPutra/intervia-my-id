export type StorefrontOrderFulfillmentMode = 'courier' | 'pickup' | 'digital';

export type StorefrontOrderSelectionInput = {
  groupId: string;
  optionIds: string[];
};

export type StorefrontOrderLineInput = {
  productId: string;
  quantity: number;
  note?: string | null;
  selections?: StorefrontOrderSelectionInput[];
};

export type StorefrontCanonicalOrderBundle = {
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
    metadata?: Record<string, unknown>;
  }>;
  replayed: boolean;
};

export type StorefrontProductOrderInput = {
  storeId: string;
  /** Backward-compatible single-line fields. Prefer items for configured carts. */
  productId?: string;
  quantity?: number;
  items?: StorefrontOrderLineInput[];
  idempotencyKey: string;
  fulfillmentMode?: StorefrontOrderFulfillmentMode;
};

export class StorefrontOrderClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'StorefrontOrderClientError';
    this.status = status;
    this.code = code;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isAmount(value: unknown): value is string | number {
  return (
    (typeof value === 'number' && Number.isFinite(value)) ||
    (typeof value === 'string' &&
      value.trim().length > 0 &&
      Number.isFinite(Number(value)))
  );
}

function parseCanonicalOrderBundle(
  value: unknown,
): StorefrontCanonicalOrderBundle | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<StorefrontCanonicalOrderBundle>;
  const order = candidate.order;
  if (!order || typeof order !== 'object') return null;

  if (
    !isNonEmptyString(order.id) ||
    !isNonEmptyString(order.order_number) ||
    !isNonEmptyString(order.business_id) ||
    !isNonEmptyString(order.base_status) ||
    !isNonEmptyString(order.payment_status) ||
    !isNonEmptyString(order.currency) ||
    !isAmount(order.subtotal_amount) ||
    !isAmount(order.total_amount) ||
    !isNonEmptyString(order.source_type) ||
    !isNonEmptyString(order.created_at) ||
    !Array.isArray(candidate.items) ||
    typeof candidate.replayed !== 'boolean'
  ) {
    return null;
  }

  return candidate as StorefrontCanonicalOrderBundle;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizedLines(input: StorefrontProductOrderInput): StorefrontOrderLineInput[] {
  if (input.items?.length) return input.items;
  if (input.productId && Number.isInteger(input.quantity) && Number(input.quantity) > 0) {
    return [{ productId: input.productId, quantity: Number(input.quantity) }];
  }
  throw new StorefrontOrderClientError(400, 'items_required');
}

export async function submitStorefrontProductOrder(
  input: StorefrontProductOrderInput,
): Promise<StorefrontCanonicalOrderBundle> {
  const items = normalizedLines(input);
  const response = await fetch('/api/super-app/umkm/orders', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      store_id: input.storeId,
      channel: 'online',
      items: items.map(item => ({
        product_id: item.productId,
        quantity: item.quantity,
        ...(item.note?.trim() ? { notes: item.note.trim() } : {}),
        selections: (item.selections ?? []).map(selection => ({
          group_id: selection.groupId,
          option_ids: selection.optionIds,
        })),
      })),
      fulfillment_mode: input.fulfillmentMode ?? 'pickup',
    }),
  });

  const payload = await readJson(response);
  if (!response.ok) {
    const errorCode =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      isNonEmptyString((payload as { error?: unknown }).error)
        ? String((payload as { error: string }).error)
        : 'order_request_failed';
    throw new StorefrontOrderClientError(response.status, errorCode);
  }

  const data =
    payload && typeof payload === 'object' && 'data' in payload
      ? (payload as { data?: unknown }).data
      : null;
  const bundle = parseCanonicalOrderBundle(data);
  if (!bundle) {
    throw new StorefrontOrderClientError(502, 'invalid_order_response');
  }

  return bundle;
}

export function createStorefrontOrderSubmitter(): {
  submit: (
    input: StorefrontProductOrderInput,
  ) => Promise<StorefrontCanonicalOrderBundle>;
} {
  let inFlight: Promise<StorefrontCanonicalOrderBundle> | null = null;

  return {
    submit(input) {
      if (inFlight) return inFlight;
      inFlight = submitStorefrontProductOrder(input).finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}
