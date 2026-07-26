import { describe, expect, it } from 'vitest';

import {
  getListingCardCtaLabel,
  getListingSideActorLabel,
  getListingSideCounterpartyLabel,
  getListingSideObjectLabel,
  getListingSideVerbLabel,
  getListingValueFallback,
  resolveListingSide,
} from './listingSide';

describe('listing side presentation', () => {
  it('keeps buyer demand and provider supply labels distinct', () => {
    expect(getListingSideActorLabel('demand', 'id')).toBe('Pembeli');
    expect(getListingSideActorLabel('supply', 'id')).toBe('Penyedia');
    expect(getListingSideVerbLabel('demand', 'id')).toBe('Mencari');
    expect(getListingSideVerbLabel('supply', 'id')).toBe('Menawarkan');
    expect(getListingSideObjectLabel('demand', 'id')).toBe('Kebutuhan');
    expect(getListingSideObjectLabel('supply', 'id')).toBe('Penawaran');
    expect(getListingSideCounterpartyLabel('demand', 'id')).toBe('penyedia');
    expect(getListingSideCounterpartyLabel('supply', 'id')).toBe('pembeli');
  });

  it('uses budget language for demand and price language for supply cards', () => {
    expect(getListingValueFallback('demand', 'id', 'product')).toBe(
      'Budget fleksibel',
    );
    expect(getListingValueFallback('supply', 'id', 'service')).toBe(
      'Konsultasikan harga',
    );
    expect(getListingCardCtaLabel('demand', 'service', 'id')).toBe(
      'Kirim proposal',
    );
    expect(getListingCardCtaLabel('supply', 'product', 'id')).toBe(
      'Cek penawaran',
    );
  });

  it('recognizes listing_intent=request as demand', () => {
    expect(
      resolveListingSide({
        type: 'product',
        metadata: { listing_intent: 'request' },
      }),
    ).toBe('demand');
  });
});
