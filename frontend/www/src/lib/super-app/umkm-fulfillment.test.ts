import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildUmkmOrderComposition,
  normalizeUmkmProductMetadata,
  readUmkmProductFulfillmentProfile,
} from './umkm-fulfillment';
import { buildUmkmShippingQuote } from './umkm-shipping';

const baseStore = {
  id: 'store-1',
  name: 'UMKM Test',
  city: 'Jakarta',
  address: 'Jl. Sudirman No. 10, Jakarta',
  lat: -6.2,
  lng: 106.8,
};

afterEach(() => {
  delete process.env.UMKM_SHIPPING_ENV;
  delete process.env.UMKM_SHIPPING_PROVIDER;
  delete process.env.UMKM_SHIPPING_QUOTE_API_URL;
  delete process.env.UMKM_SHIPPING_ENABLE_PROVIDER_API;
  vi.restoreAllMocks();
});

describe('umkm fulfillment', () => {
  it('normalizes digital product metadata', () => {
    const metadata = normalizeUmkmProductMetadata({
      item_kind: 'digital',
      digital_delivery_note: 'Kirim via WhatsApp',
    });

    expect(metadata.item_kind).toBe('digital');
    expect(metadata.allow_courier_shipping).toBe(false);
    expect(metadata.online_fulfillment_modes).toEqual(['digital']);
  });

  it('builds digital-only order composition', () => {
    const composition = buildUmkmOrderComposition([
      {
        id: 'p1',
        name: 'Voucher Streaming',
        price_cents: 150_000,
        metadata: {
          item_kind: 'digital',
          digital_delivery_note: 'Kode dikirim otomatis',
        },
        quantity: 2,
      },
    ]);

    expect(composition.contains_digital).toBe(true);
    expect(composition.contains_physical).toBe(false);
    expect(composition.available_modes).toEqual(['digital']);
    expect(composition.default_mode).toBe('digital');
  });

  it('reads physical product defaults with pickup and courier', () => {
    const profile = readUmkmProductFulfillmentProfile({
      metadata: {
        channel: ['online', 'offline'],
      },
    });

    expect(profile.item_kind).toBe('physical');
    expect(profile.allow_pickup).toBe(true);
    expect(profile.allow_courier_shipping).toBe(true);
    expect(profile.online_fulfillment_modes).toEqual(['courier', 'pickup']);
    expect(profile.weight_grams).toBe(500);
  });

  it('estimates courier and pickup options for physical items', async () => {
    const quote = await buildUmkmShippingQuote({
      store: baseStore,
      selectedProducts: [
        {
          id: 'p1',
          name: 'Bakpia Box',
          price_cents: 390_000,
          metadata: {
            item_kind: 'physical',
            weight_grams: 900,
            allow_pickup: true,
            allow_courier_shipping: true,
          },
          quantity: 2,
        },
      ],
      deliveryAddress: 'Jl. Sudirman No. 1, Jakarta',
      preferredMode: 'courier',
    });

    expect(quote.profile.contains_physical).toBe(true);
    expect(quote.options.some((option) => option.mode === 'pickup')).toBe(true);
    expect(quote.options.some((option) => option.mode === 'courier')).toBe(true);
    expect(quote.recommended_option_id).toBe('courier-regular');
    expect(quote.integration.environment).toBe('sandbox');
    expect(quote.integration.quote_source).toBe('local_estimate');
  });

  it('enables live tracking option for same-day courier when coordinates exist', async () => {
    const quote = await buildUmkmShippingQuote({
      store: baseStore,
      selectedProducts: [
        {
          id: 'p1',
          name: 'Snack Box',
          price_cents: 120_000,
          metadata: {
            item_kind: 'physical',
            weight_grams: 500,
          },
          quantity: 1,
        },
      ],
      deliveryAddress: 'Jl. Gatot Subroto No. 2, Jakarta',
      deliveryLat: -6.214,
      deliveryLng: 106.817,
      preferredMode: 'courier',
    });

    const sameDay = quote.options.find((option) => option.id === 'courier-same_day');
    expect(sameDay).toBeTruthy();
    expect(sameDay?.tracking_kind).toBe('live');
    expect(sameDay?.requires_dispatch).toBe(true);
  });

  it('uses provider API when live shipping integration is enabled', async () => {
    process.env.UMKM_SHIPPING_ENV = 'live';
    process.env.UMKM_SHIPPING_PROVIDER = 'biteship';
    process.env.UMKM_SHIPPING_QUOTE_API_URL = 'https://shipping.example.test/quote';
    process.env.UMKM_SHIPPING_ENABLE_PROVIDER_API = 'true';

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            recommended_option_id: 'biteship-reg',
            options: [
              {
                id: 'biteship-reg',
                label: 'Biteship Regular',
                provider: 'biteship',
                service_level: 'regular',
                fee_cents: 245000,
                eta_label: '1-2 hari',
                tracking_kind: 'standard',
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const quote = await buildUmkmShippingQuote({
      store: baseStore,
      selectedProducts: [
        {
          id: 'p1',
          name: 'Bakpia Box',
          price_cents: 390_000,
          metadata: {
            item_kind: 'physical',
            weight_grams: 900,
            allow_pickup: true,
            allow_courier_shipping: true,
          },
          quantity: 1,
        },
      ],
      deliveryAddress: 'Jl. Sudirman No. 1, Jakarta',
      preferredMode: 'courier',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(quote.integration.environment).toBe('live');
    expect(quote.integration.quote_source).toBe('provider_api');
    expect(quote.integration.uses_live_rates).toBe(true);
    expect(quote.options.some((option) => option.id === 'biteship-reg')).toBe(true);
  });
});
