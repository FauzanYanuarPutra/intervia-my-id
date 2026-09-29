import { describe, expect, it } from 'vitest';

import {
  isPublicUmkmDiscoveryVisible,
  isPublicUmkmReferenceVisible,
  isPublicUmkmStoreVisible,
  mergeDeepLinkedUmkmStore,
} from './umkm-public-discovery';

describe('isPublicUmkmStoreVisible', () => {
  it('shows an active regular store unless its outlet is explicitly disabled', () => {
    expect(
      isPublicUmkmStoreVisible({
        is_active: true,
        metadata: {},
      }),
    ).toBe(true);
    expect(
      isPublicUmkmStoreVisible({
        is_active: true,
        metadata: { outlet_active: false },
      }),
    ).toBe(false);
  });

  it('uses the store active state for usaha portal records', () => {
    expect(
      isPublicUmkmStoreVisible({
        is_active: true,
        metadata: { source: 'usaha_portal', outlet_active: false },
      }),
    ).toBe(true);
    expect(
      isPublicUmkmStoreVisible({
        is_active: false,
        metadata: { source: 'usaha_portal' },
      }),
    ).toBe(false);
  });

  it('never exposes an inactive regular store', () => {
    expect(
      isPublicUmkmStoreVisible({
        is_active: false,
        metadata: { outlet_active: true },
      }),
    ).toBe(false);
  });

  it.each([
    { record_kind: 'real_place_reference' },
    { record_kind: 'REAL_OPENSTREETMAP_REFERENCE' },
    { market_side: 'reference' },
    { is_transactional: false },
    {
      source: 'usaha_portal',
      outlet_active: true,
      record_kind: 'real_place_reference',
    },
  ])('keeps non-transactional references out of the store layer', metadata => {
    expect(
      isPublicUmkmStoreVisible({
        is_active: true,
        metadata,
      }),
    ).toBe(false);
  });
});

describe('isPublicUmkmReferenceVisible', () => {
  const publishedReference = {
    is_active: true,
    metadata: {
      reference_publication_status: 'published',
      record_kind: 'government_reference',
      market_side: 'reference',
      is_transactional: false,
      claimable: true,
      source_dataset: 'data-go-id-denpasar-umkm',
      source_url: 'https://data.go.id/dataset/dataset/umkm',
      source_license: 'Creative Commons Attribution',
    },
  };

  it('allows a fully-provenanced published reference', () => {
    expect(isPublicUmkmReferenceVisible(publishedReference)).toBe(true);
    expect(isPublicUmkmDiscoveryVisible(publishedReference)).toBe(true);
  });

  it('rejects missing publication or provenance requirements', () => {
    expect(
      isPublicUmkmReferenceVisible({
        ...publishedReference,
        metadata: {
          ...publishedReference.metadata,
          reference_publication_status: 'draft',
        },
      }),
    ).toBe(false);
    expect(
      isPublicUmkmReferenceVisible({
        ...publishedReference,
        metadata: {
          ...publishedReference.metadata,
          source_license: '',
        },
      }),
    ).toBe(false);
    expect(
      isPublicUmkmReferenceVisible({
        ...publishedReference,
        metadata: {
          ...publishedReference.metadata,
          market_side: 'supply',
        },
      }),
    ).toBe(false);
  });

  it('does not let a normal transactional store pass as a reference', () => {
    expect(
      isPublicUmkmReferenceVisible({
        is_active: true,
        metadata: {
          ...publishedReference.metadata,
          is_transactional: true,
        },
      }),
    ).toBe(false);
  });
});

describe('mergeDeepLinkedUmkmStore', () => {
  const listed = [
    { id: 'store-a', slug: 'usaha-a', name: 'Usaha A' },
    { id: 'store-b', slug: 'usaha-b', name: 'Usaha B' },
  ];

  it('prepends a target outside the bounded discovery batch', () => {
    const merged = mergeDeepLinkedUmkmStore(listed, {
      id: 'store-target',
      slug: 'usaha-target',
      name: 'Usaha Target',
    });

    expect(merged.map(store => store.id)).toEqual([
      'store-target',
      'store-a',
      'store-b',
    ]);
    expect(listed.map(store => store.id)).toEqual(['store-a', 'store-b']);
  });

  it('does not duplicate an existing target by id or slug', () => {
    expect(
      mergeDeepLinkedUmkmStore(listed, {
        id: 'store-a',
        slug: 'usaha-a-baru',
        name: 'Usaha A Baru',
      }),
    ).toEqual(listed);
    expect(
      mergeDeepLinkedUmkmStore(listed, {
        id: 'store-lain',
        slug: 'usaha-b',
        name: 'Usaha B Duplikat',
      }),
    ).toEqual(listed);
  });
});
