import { describe, expect, it } from 'vitest';

import {
  getListingCardCtaLabel,
  getListingSideActorLabel,
  getListingSideCounterpartyLabel,
  getListingSideObjectLabel,
  getListingSideVerbLabel,
  getListingSideLabel,
  getListingValueFallback,
  resolveListingSide,
} from './listingSide';

describe('listing side presentation', () => {
  it('keeps buyer demand and provider supply labels distinct', () => {
    expect(getListingSideLabel('demand', 'id')).toBe('Sedang mencari');
    expect(getListingSideLabel('supply', 'id')).toBe('Sedang menawarkan');
    expect(getListingSideActorLabel('demand', 'id')).toBe('Pencari');
    expect(getListingSideActorLabel('supply', 'id')).toBe('Penyedia');
    expect(getListingSideVerbLabel('demand', 'id')).toBe('Sedang mencari');
    expect(getListingSideVerbLabel('supply', 'id')).toBe('Sedang menawarkan');
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

  it('maps canonical pricing modes when no explicit side is persisted', () => {
    expect(
      resolveListingSide({
        type: 'product',
        pricing_mode: 'request',
      }),
    ).toBe('demand');

    expect(
      resolveListingSide({
        type: 'product',
        pricing_mode: 'fixed',
      }),
    ).toBe('supply');

    expect(
      resolveListingSide({
        type: 'product',
        side: 'supply',
        pricing_mode: 'request',
      }),
    ).toBe('supply');
  });

  it('accepts a top-level persisted side as the source of truth', () => {
    expect(
      resolveListingSide({
        type: 'product',
        side: 'demand',
        title: 'Produk yang ditawarkan',
      }),
    ).toBe('demand');

    expect(
      resolveListingSide({
        type: 'product',
        side: 'supply',
        title: 'Sedang mencari supplier',
      }),
    ).toBe('supply');
  });

  it('recognizes explicit demand and supply aliases without reading prose', () => {
    expect(
      resolveListingSide({
        type: 'product',
        title: 'Butuh supplier kemasan',
        metadata: { listing_intent: 'request' },
      }),
    ).toBe('demand');

    expect(
      resolveListingSide({
        type: 'product',
        title: 'Butuh supplier kemasan',
        metadata: { market_side: 'provider' },
      }),
    ).toBe('supply');

    expect(
      resolveListingSide({
        type: 'service',
        metadata: { market_side: 'seeker' },
      }),
    ).toBe('demand');

    expect(
      resolveListingSide({
        type: 'product',
        metadata: { intent: 'request' },
      }),
    ).toBe('demand');

    expect(
      resolveListingSide({
        type: 'product',
        metadata: { side: 'provider' },
      }),
    ).toBe('supply');

    expect(
      resolveListingSide({
        kind: 'needs',
        type: 'product',
      }),
    ).toBe('demand');

    expect(
      resolveListingSide({
        type: 'product',
        title: 'Looking for supplier',
      }),
    ).toBe('supply');
  });
});
