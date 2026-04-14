import { describe, expect, it } from 'vitest';
import {
  buildDiscountSummary,
  inferPricingModeFromPayload,
  parseRichCardPayload,
  resolveListingCtas,
} from './orderFlow';

describe('buildDiscountSummary', () => {
  it('returns valid discount for fixed listing when original price is higher', () => {
    const result = buildDiscountSummary({
      pricingMode: 'fixed',
      finalPriceCents: 100_000,
      originalPriceCents: 125_000,
    });

    expect(result.hasDiscount).toBe(true);
    expect(result.discountPercent).toBe(20);
    expect(result.savingsCents).toBe(25_000);
  });

  it('returns no discount for edge cases', () => {
    expect(
      buildDiscountSummary({
        pricingMode: 'fixed',
        finalPriceCents: 100_000,
        originalPriceCents: 100_000,
      }).hasDiscount,
    ).toBe(false);

    expect(
      buildDiscountSummary({
        pricingMode: 'request',
        finalPriceCents: 100_000,
        originalPriceCents: 140_000,
      }).hasDiscount,
    ).toBe(false);
  });
});

describe('resolveListingCtas', () => {
  it('maps CTA by pricing mode and kind', () => {
    expect(resolveListingCtas('fixed', 'marketplace')).toEqual(['Beli', 'Tawar', 'Chat']);
    expect(resolveListingCtas('request', 'marketplace')).toEqual(['Tanya Harga', 'Chat']);
    expect(resolveListingCtas('request', 'job')).toEqual(['Tanya Detail', 'Chat']);
    expect(resolveListingCtas('fixed', 'talent')).toEqual(['Hire', 'Tawar', 'Chat']);
  });
});

describe('parseRichCardPayload', () => {
  it('parses valid object payload and rejects invalid payload', () => {
    const parsed = parseRichCardPayload('{"content_id":"abc","price_cents":120000}');
    expect(parsed).toEqual({ content_id: 'abc', price_cents: 120000 });

    expect(parseRichCardPayload('[]')).toBeNull();
    expect(parseRichCardPayload('invalid-json')).toBeNull();
    expect(parseRichCardPayload(undefined)).toBeNull();
  });

  it('infers pricing mode from payload safely', () => {
    expect(inferPricingModeFromPayload({ pricing_mode: 'request' })).toBe('request');
    expect(inferPricingModeFromPayload({ price_cents: 10_000 })).toBe('fixed');
    expect(inferPricingModeFromPayload({})).toBe('request');
  });
});
