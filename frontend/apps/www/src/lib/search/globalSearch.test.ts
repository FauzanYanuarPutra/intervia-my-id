import { describe, expect, it } from 'vitest';

import {
  dedupeGlobalSearchItems,
  parseGlobalSearchState,
  rankGlobalSearchItems,
  serializeGlobalSearchState,
  type GlobalSearchItem,
} from './globalSearch';

function item(id: string, title: string, href = `/content/${id}`): GlobalSearchItem {
  return {
    id,
    kind: 'products',
    title,
    summary: '',
    href,
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
  };
}

describe('global search URL state', () => {
  it('parses and normalizes shareable state', () => {
    const state = parseGlobalSearchState(new URLSearchParams('q=botol+plastik&tab=products&category=materials-suppliers&subcategory=packaging&location=Bandung&distance=25&sort=latest'));
    expect(state).toMatchObject({ query: 'botol plastik', tab: 'products', side: 'all', category: 'materials-suppliers', subcategory: 'packaging', location: 'Bandung', distanceKm: 25, sort: 'latest' });
  });

  it('adapts legacy type parameters without preserving redundant state', () => {
    const state = parseGlobalSearchState(new URLSearchParams('q=desain&type=service&category=unknown'));
    expect(state.tab).toBe('services');
    expect(state.category).toBe('');
    expect(serializeGlobalSearchState(state)).toBe('q=desain&tab=services');
  });

  it('keeps existing people links compatible with the public user directory', () => {
    for (const legacyType of ['people', 'orang', 'user', 'freelancer']) {
      const state = parseGlobalSearchState(new URLSearchParams(`type=${legacyType}`));
      expect(state.tab).toBe('users');
      expect(serializeGlobalSearchState(state)).toBe('tab=users');
    }
  });

  it('parses marketplace side aliases for need and offer pages', () => {
    const demand = parseGlobalSearchState(new URLSearchParams('q=kaos&side=seeker'));
    const supply = parseGlobalSearchState(new URLSearchParams('q=kaos&side=offer'));
    expect(demand.side).toBe('demand');
    expect(serializeGlobalSearchState(demand)).toBe('q=kaos&side=demand');
    expect(supply.side).toBe('supply');
    expect(serializeGlobalSearchState(supply)).toBe('q=kaos&side=supply');
  });

  it('caps invalid distance and rejects unknown tabs', () => {
    const state = parseGlobalSearchState(new URLSearchParams('tab=anything&distance=999'));
    expect(state.tab).toBe('all');
    expect(state.distanceKm).toBe(100);
  });

  it('round-trips the distinct public reference tab', () => {
    const state = parseGlobalSearchState(new URLSearchParams('tab=references&q=kopi'));
    expect(state.tab).toBe('references');
    expect(serializeGlobalSearchState(state)).toBe('q=kopi&tab=references');
  });
});

describe('global search result ordering', () => {
  it('preserves backend order instead of applying a second frontend relevance model', () => {
    const backendOrder = [item('backend-first', 'Kios kampus'), item('backend-second', 'AK')];
    expect(rankGlobalSearchItems(backendOrder, 'ak').map(result => result.id)).toEqual(['backend-first', 'backend-second']);
  });

  it('deduplicates repeated entity identities while preserving first-seen order', () => {
    const results = dedupeGlobalSearchItems([
      item('a', 'Kemasan A'),
      item('b', 'Kemasan B'),
      item('a', 'Kemasan A duplicate', '/another-href'),
    ]);
    expect(results.map(result => result.id)).toEqual(['a', 'b']);
  });

  it('deduplicates repeated canonical hrefs but never fuzzy-deduplicates matching titles', () => {
    const results = dedupeGlobalSearchItems([
      item('a', 'Supplier Botol', '/id/content/supplier-botol'),
      item('b', 'Supplier Botol', '/id/content/supplier-botol'),
      item('c', 'Supplier Botol', '/id/content/supplier-botol-bandung'),
    ]);
    expect(results.map(result => result.id)).toEqual(['a', 'c']);
  });
});
