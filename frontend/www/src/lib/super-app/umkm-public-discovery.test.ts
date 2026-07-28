import { describe, expect, it } from 'vitest';

import {
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
