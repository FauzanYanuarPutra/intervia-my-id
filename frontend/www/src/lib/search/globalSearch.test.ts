import { describe, expect, it } from 'vitest';

import {
  parseGlobalSearchState,
  rankGlobalSearchItems,
  serializeGlobalSearchState,
  type GlobalSearchItem,
} from './globalSearch';

describe('global search URL state', () => {
  it('parses and normalizes shareable state', () => {
    const state = parseGlobalSearchState(
      new URLSearchParams(
        'q=botol+plastik&tab=products&category=materials-suppliers&subcategory=packaging&location=Bandung&distance=25&sort=latest',
      ),
    );

    expect(state).toMatchObject({
      query: 'botol plastik',
      tab: 'products',
      side: 'all',
      category: 'materials-suppliers',
      subcategory: 'packaging',
      location: 'Bandung',
      distanceKm: 25,
      sort: 'latest',
    });
  });

  it('adapts legacy type parameters without preserving redundant state', () => {
    const state = parseGlobalSearchState(
      new URLSearchParams('q=desain&type=service&category=unknown'),
    );

    expect(state.tab).toBe('services');
    expect(state.category).toBe('');
    expect(serializeGlobalSearchState(state)).toBe('q=desain&tab=services');
  });

  it('parses marketplace side aliases for need and offer pages', () => {
    const demand = parseGlobalSearchState(
      new URLSearchParams('q=kaos&side=seeker'),
    );
    const supply = parseGlobalSearchState(
      new URLSearchParams('q=kaos&side=offer'),
    );

    expect(demand.side).toBe('demand');
    expect(serializeGlobalSearchState(demand)).toBe('q=kaos&side=demand');
    expect(supply.side).toBe('supply');
    expect(serializeGlobalSearchState(supply)).toBe('q=kaos&side=supply');
  });

  it('caps invalid distance and rejects unknown tabs', () => {
    const state = parseGlobalSearchState(
      new URLSearchParams('tab=anything&distance=999'),
    );
    expect(state.tab).toBe('all');
    expect(state.distanceKm).toBe(100);
  });

  it('prioritizes exact and prefix matches for short queries', () => {
    const item = (
      id: string,
      title: string,
      summary = '',
    ): GlobalSearchItem => ({
      id,
      kind: 'products',
      title,
      summary,
      href: `/content/${id}`,
      image: null,
      label: 'Produk',
      location: '',
      priceLabel: '',
      ownerName: '',
      verified: false,
      side: 'supply',
      memberCount: null,
      viewCount: null,
      durationLabel: '',
      metadata: {},
    });

    const ranked = rankGlobalSearchItems(
      [
        item('summary', 'Kios kampus', 'Menjual snack lokal'),
        item('prefix', 'Aksesoris kemasan'),
        item('exact', 'AK'),
      ],
      'ak',
    );

    expect(ranked.map(result => result.id)).toEqual([
      'exact',
      'prefix',
      'summary',
    ]);
  });
});
