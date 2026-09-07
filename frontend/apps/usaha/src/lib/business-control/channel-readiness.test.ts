import { describe, expect, it } from 'vitest';
import { parseRecordedProductPrice } from './channel-readiness';

describe('parseRecordedProductPrice', () => {
  it('returns null when no durable product price exists', () => {
    expect(parseRecordedProductPrice(undefined)).toBeNull();
    expect(parseRecordedProductPrice('')).toBeNull();
    expect(parseRecordedProductPrice('Hubungi penjual')).toBeNull();
  });

  it('parses a recorded positive rupiah price without inventing a fallback', () => {
    expect(parseRecordedProductPrice('Rp 15.000')).toBe(15000);
    expect(parseRecordedProductPrice('10000')).toBe(10000);
  });

  it('rejects zero or invalid prices', () => {
    expect(parseRecordedProductPrice('Rp 0')).toBeNull();
    expect(parseRecordedProductPrice('gratis')).toBeNull();
  });
});
