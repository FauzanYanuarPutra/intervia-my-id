import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { readAccessToken } = vi.hoisted(() => ({
  readAccessToken: vi.fn(),
}));

vi.mock('@/lib/auth-session', () => ({ readAccessToken }));

import { createBusiness, getBusinessForCurrentActor } from './business-server';

const ACTOR_ID = '44444444-4444-4444-8444-444444444444';
const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const BUSINESS_ID = '22222222-2222-4222-8222-222222222222';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  readAccessToken.mockResolvedValue('actor-token');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('typed business profile adapter', () => {
  it('sends the selected template explicitly even when the display category suggests another vertical', async () => {
    const fetchMock = vi.fn<typeof fetch>((url, init) => {
      const target = String(url);
      if (target.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse({ data: { user: { id: ACTOR_ID, name: 'Cuk' } } }));
      }
      if (target.endsWith('/v1/businesses/provision') && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ data: { business: {
          business: { id: BUSINESS_ID, organization_id: ORGANIZATION_ID },
        } } }));
      }
      return Promise.resolve(jsonResponse({ data: {} }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await createBusiness({
      name: 'Bersih Kilat',
      templateKey: 'laundry',
      category: 'Makanan dan minuman',
      city: 'Jakarta',
      address: 'Jl. Contoh',
      phone: '+628111111111',
      locationQuery: 'Jl. Contoh, Jakarta',
      latitude: -6.2,
      longitude: 106.8,
      idempotencyKey: '55555555-5555-4555-8555-555555555555',
    });

    const provisionCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/v1/businesses/provision'),
    );
    const body = JSON.parse(String(provisionCall?.[1]?.body)) as {
      business: {
        capability_key: string;
        profile: { template_key: string };
      };
      storefront: { public_metadata: { category: string } };
    };
    expect(body.business).toEqual({
      name: 'Bersih Kilat',
      capability_key: 'services',
      profile: { template_key: 'laundry' },
    });
    expect(body.storefront.public_metadata.category).toBe('Makanan dan minuman');
  });

  it('maps canonical profile and active capabilities into the portal record', async () => {
    const fetchMock = vi.fn<typeof fetch>((url) => {
      const target = String(url);
      if (target.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse({ data: { user: { id: ACTOR_ID, name: 'Cuk' } } }));
      }
      if (target.endsWith('/organizations')) {
        return Promise.resolve(jsonResponse({ data: { items: [{
          id: ORGANIZATION_ID,
          name: 'Lajukan Juice',
          slug: 'lajukan-juice',
          current_user_role: 'org_admin',
        }] } }));
      }
      if (target.endsWith(`/v1/businesses/${BUSINESS_ID}`)) {
        return Promise.resolve(jsonResponse({ data: { business: {
          business: {
            id: BUSINESS_ID,
            organization_id: ORGANIZATION_ID,
            name: 'Lajukan Juice',
            capability_key: 'food_beverage',
            status: 'active',
            version: 2,
          },
          profile: {
            business_id: BUSINESS_ID,
            organization_id: ORGANIZATION_ID,
            template_key: 'juice_fnb',
            template_version: 1,
            currency: 'IDR',
            timezone: 'Asia/Jakarta',
            costing_policy: 'weighted_average',
            accounting_mode: 'simple',
            approval_policy: 'owner_managed',
            branch_mode: 'single',
            negative_stock_policy: 'deny',
            document_prefix: 'FNB',
            version: 1,
          },
          capabilities: [
            { capability_key: 'inventory', enabled: true },
            { capability_key: 'recipes', enabled: true },
            { capability_key: 'payroll', enabled: false },
          ],
          primary_store: {
            id: '33333333-3333-4333-8333-333333333333',
            name: 'Lajukan Juice',
            slug: 'lajukan-juice',
            city: 'Jakarta',
            address: 'Jl. Contoh',
            lat: -6.2,
            lng: 106.8,
            phone: '+628111111111',
            is_active: true,
            metadata: { public: { category: 'Minuman', schedule: 'Setiap hari' } },
          },
          primary_location: {
            id: '66666666-6666-4666-8666-666666666666',
            store_id: '33333333-3333-4333-8333-333333333333',
            name: 'Lokasi utama',
            address: 'Jl. Contoh',
            city: 'Jakarta',
            lat: -6.2,
            lng: 106.8,
            phone: '+628111111111',
            status: 'active',
            is_primary: true,
            public_visibility: true,
          },
          products: [],
        } } }));
      }
      return Promise.resolve(jsonResponse({ data: {} }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const business = await getBusinessForCurrentActor(BUSINESS_ID);

    expect(business?.templateKey).toBe('juice_fnb');
    expect(business?.profile).toMatchObject({
      templateKey: 'juice_fnb',
      currency: 'IDR',
      timezone: 'Asia/Jakarta',
      documentPrefix: 'FNB',
    });
    expect(business?.activeCapabilityKeys).toEqual(['inventory', 'recipes']);
  });
});
