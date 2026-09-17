import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  StorefrontOrderClientError,
  createStorefrontOrderSubmitter,
  submitStorefrontProductOrder,
} from './storefront-order-client';

const STORE_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const IDEMPOTENCY_KEY = '33333333-3333-4333-8333-333333333333';

function canonicalResponse(orderNumber = 'LJK-20260911-TEST') {
  return {
    data: {
      order: {
        id: '44444444-4444-4444-8444-444444444444',
        order_number: orderNumber,
        business_id: '55555555-5555-4555-8555-555555555555',
        base_status: 'PENDING_PAYMENT',
        payment_status: 'UNPAID',
        currency: 'IDR',
        subtotal_amount: '25000.00',
        total_amount: '25000.00',
        source_type: 'www',
        source_surface: 'www_umkm_storefront',
        created_at: '2026-09-11T07:00:00Z',
      },
      items: [
        {
          product_id: PRODUCT_ID,
          item_name: 'Produk canonical',
          quantity: '1',
          unit_price: '25000.00',
          line_total: '25000.00',
        },
      ],
      replayed: false,
    },
  };
}

function input() {
  return {
    storeId: STORE_ID,
    productId: PRODUCT_ID,
    quantity: 1,
    idempotencyKey: IDEMPOTENCY_KEY,
    fulfillmentMode: 'pickup' as const,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storefront canonical order client', () => {
  it('submits buyer intent only and returns the canonical buyer-visible reference', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(canonicalResponse()), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitStorefrontProductOrder(input());

    expect(result.order.order_number).toBe('LJK-20260911-TEST');
    expect(result.order.total_amount).toBe('25000.00');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/super-app/umkm/orders');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(new Headers(init.headers).get('idempotency-key')).toBe(IDEMPOTENCY_KEY);

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      store_id: STORE_ID,
      channel: 'online',
      items: [{ product_id: PRODUCT_ID, quantity: 1 }],
      fulfillment_mode: 'pickup',
    });
    expect(body).not.toHaveProperty('product_name');
    expect(body).not.toHaveProperty('price_cents');
    expect(body).not.toHaveProperty('total_cents');
    expect(body).not.toHaveProperty('payment_method');
    expect(body).not.toHaveProperty('payment_timing');
    expect(body).not.toHaveProperty('metadata');
  });

  it('coalesces concurrent submit attempts into one request', async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const pendingResponse = new Promise<Response>(resolve => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pendingResponse);
    vi.stubGlobal('fetch', fetchMock);

    const submitter = createStorefrontOrderSubmitter();
    const first = submitter.submit(input());
    const second = submitter.submit(input());

    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse?.(
      new Response(JSON.stringify(canonicalResponse()), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(first).resolves.toMatchObject({
      order: { order_number: 'LJK-20260911-TEST' },
    });
    await expect(second).resolves.toMatchObject({
      order: { order_number: 'LJK-20260911-TEST' },
    });
  });

  it('fails closed on adapter errors instead of fabricating a local order', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'product_unavailable' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    await expect(submitStorefrontProductOrder(input())).rejects.toEqual(
      expect.objectContaining<Partial<StorefrontOrderClientError>>({
        name: 'StorefrontOrderClientError',
        status: 409,
        code: 'product_unavailable',
      }),
    );
  });

  it('rejects malformed successful responses without losing the trust boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              ...canonicalResponse().data,
              order: {
                ...canonicalResponse().data.order,
                order_number: '',
              },
            },
          }),
          {
            status: 201,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    );

    await expect(submitStorefrontProductOrder(input())).rejects.toEqual(
      expect.objectContaining<Partial<StorefrontOrderClientError>>({
        status: 502,
        code: 'invalid_order_response',
      }),
    );
  });
});
