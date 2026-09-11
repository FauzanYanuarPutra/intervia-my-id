import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STORE_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

const mocks = vi.hoisted(() => ({
  enforceAuthRouteSecurity: vi.fn(),
  enforceRateLimit: vi.fn(),
  requireAuth: vi.fn(),
  parseJsonBodyWithSchema: vi.fn(),
  createUmkmOrder: vi.fn(),
  getUmkmOrderById: vi.fn(),
  getUmkmStoreById: vi.fn(),
  listUmkmOrdersByStore: vi.fn(),
  listUmkmProducts: vi.fn(),
  buildUmkmShippingQuote: vi.fn(),
}));

vi.mock('@/lib/authSecurity', () => ({
  enforceAuthRouteSecurity: mocks.enforceAuthRouteSecurity,
}));

vi.mock('@/lib/rateLimit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('@/lib/serverAuth', () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock('@/lib/serverRequest', () => ({
  parseJsonBodyWithSchema: mocks.parseJsonBodyWithSchema,
}));

vi.mock('@/lib/super-app/umkm-authorization', () => ({
  hasUmkmStorePermission: vi.fn(() => true),
}));

vi.mock('@/lib/featureFlags', () => ({
  PROMO_ONLY_MODE: false,
}));

vi.mock('@/lib/super-app/umkm-commerce', () => ({
  createUmkmOrder: mocks.createUmkmOrder,
  getUmkmOrderById: mocks.getUmkmOrderById,
  getUmkmStoreById: mocks.getUmkmStoreById,
  listUmkmOrdersByStore: mocks.listUmkmOrdersByStore,
  listUmkmProducts: mocks.listUmkmProducts,
}));

vi.mock('@/lib/super-app/umkm-shipping', () => ({
  buildUmkmShippingQuote: mocks.buildUmkmShippingQuote,
}));

import { POST } from './route';

function onlinePayload() {
  return {
    store_id: STORE_ID,
    channel: 'online' as const,
    customer_name: 'Tampered Customer',
    customer_phone: '081234567890',
    notes: 'Tolong dikemas aman',
    items: [
      {
        product_id: PRODUCT_ID,
        quantity: 2,
        notes: 'tanpa plastik',
      },
    ],
    payment_method: 'cash' as const,
    payment_timing: 'postpay' as const,
    fulfillment_mode: 'pickup' as const,
    metadata: {
      product_name: 'Nama palsu',
      unit_price: 1,
      store_id: 'attacker-store',
    },
  };
}

function request(headers?: HeadersInit) {
  return new NextRequest('http://localhost/api/super-app/umkm/orders', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: '{}',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforceAuthRouteSecurity.mockResolvedValue({ ok: true, ip: '127.0.0.1' });
  mocks.enforceRateLimit.mockResolvedValue({ ok: true });
  mocks.parseJsonBodyWithSchema.mockResolvedValue({ ok: true, data: onlinePayload() });
  mocks.requireAuth.mockResolvedValue({
    ok: true,
    ctx: {
      token: 'verified-jwt',
      userId: USER_ID,
      roles: ['user'],
      payload: { sub: USER_ID },
    },
  });
  mocks.getUmkmStoreById.mockResolvedValue({
    id: STORE_ID,
    owner_user_id: '44444444-4444-4444-8444-444444444444',
    online_order_enabled: true,
  });
  mocks.listUmkmProducts.mockResolvedValue([
    {
      id: PRODUCT_ID,
      store_id: STORE_ID,
      name: 'Harga canonical',
      price_cents: 1_250_000,
      metadata: {},
      is_available: true,
    },
  ]);
  mocks.buildUmkmShippingQuote.mockResolvedValue({
    profile: { default_mode: 'pickup' },
    options: [{ id: 'pickup', mode: 'pickup', fee_cents: 0 }],
    recommended_option_id: 'pickup',
    integration: null,
  });
  mocks.createUmkmOrder.mockResolvedValue({
    order: { id: 'legacy-local-order' },
    items: [],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/super-app/umkm/orders online channel', () => {
  it('requires an authenticated buyer even for non-wallet checkout', async () => {
    mocks.requireAuth.mockResolvedValue({
      ok: false,
      res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.requireAuth).toHaveBeenCalledTimes(1);
    expect(mocks.createUmkmOrder).not.toHaveBeenCalled();
  });

  it('sends only canonical-safe order intent to Marketplace and never creates a local online order', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          order: {
            id: '55555555-5555-4555-8555-555555555555',
            order_number: 'LJK-20260911-TEST',
            business_id: '66666666-6666-4666-8666-666666666666',
            base_status: 'PENDING_PAYMENT',
            payment_status: 'UNPAID',
            currency: 'IDR',
            subtotal_amount: '25000.00',
            total_amount: '25000.00',
            source_type: 'www',
            source_surface: 'www_umkm_storefront',
            created_at: '2026-09-11T05:00:00Z',
          },
          items: [],
          replayed: false,
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ authorization: 'Bearer verified-jwt' }));

    expect(response.status).toBe(201);
    expect(mocks.createUmkmOrder).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/v1\/public\/commerce\/orders$/);
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer verified-jwt');
    expect(new Headers(init.headers).get('idempotency-key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const forwarded = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(forwarded).toEqual({
      items: [{ product_id: PRODUCT_ID, quantity: 2, note: 'tanpa plastik' }],
      fulfillment_mode: 'pickup',
      note: 'Tolong dikemas aman',
      source_surface: 'www_umkm_storefront',
    });
    expect(forwarded).not.toHaveProperty('store_id');
    expect(forwarded).not.toHaveProperty('customer_name');
    expect(forwarded).not.toHaveProperty('customer_phone');
    expect(forwarded).not.toHaveProperty('payment_method');
    expect(forwarded).not.toHaveProperty('metadata');
  });

  it('fails closed when Marketplace rejects the order and does not fall back to runtime storage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'product_unavailable' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ authorization: 'Bearer verified-jwt' }));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(body.error).toBe('product_unavailable');
    expect(mocks.createUmkmOrder).not.toHaveBeenCalled();
  });
});
