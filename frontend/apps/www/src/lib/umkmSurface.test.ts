import { describe, expect, it } from 'vitest';
import {
  buildUmkmMapPlacePath,
  buildUmkmDiscoveryPath,
  buildUmkmProfilePath,
  buildUmkmStorefrontPath,
  buildUsahaPath,
  buildUsahaPathFromWorkspace,
  isUmkmMapPublicReference,
} from './umkmSurface';

describe('UMKM public route helpers', () => {
  it('builds a discovery deep link with the selected store id', () => {
    expect(buildUmkmDiscoveryPath({ storeId: 'store / 1' })).toBe(
      '/umkm?storeId=store+%2F+1',
    );
  });

  it('aliases the legacy profile helper to the canonical storefront', () => {
    expect(buildUmkmProfilePath('toko kopi')).toBe('/toko/toko%20kopi');
    expect(buildUmkmProfilePath('toko kopi')).toBe(
      buildUmkmStorefrontPath('toko kopi'),
    );
  });

  it('keeps public map references on the map surface', () => {
    const reference = {
      slug: 'osm-node-1',
      public_path: '/content/pasar-uji-reference-id',
      metadata: {
        record_kind: 'real_openstreetmap_reference',
        market_side: 'reference',
      },
    };

    expect(isUmkmMapPublicReference(reference)).toBe(true);
    expect(buildUmkmMapPlacePath(reference)).toBe(
      '/umkm?store=osm-node-1&view=map',
    );
  });

  it('keeps public Wikidata references on the map surface instead of pretending they are stores', () => {
    expect(
      buildUmkmMapPlacePath({
        id: 'reference:wikidata-q111754951',
        slug: 'wikidata-q111754951-mcdonald-s-banjar-baru-6f9f6ab8-ac91-48eb-88af-0b12f1aa9d6e',
        public_path: '/content/legacy-reference',
        metadata: {
          record_kind: 'wikidata_reference',
          source_kind: 'external_content_reference',
          market_side: 'reference',
          is_public_reference: true,
        },
      }),
    ).toBe(
      '/umkm?store=wikidata-q111754951-mcdonald-s-banjar-baru-6f9f6ab8-ac91-48eb-88af-0b12f1aa9d6e&storeId=reference%3Awikidata-q111754951&view=map',
    );
  });

  it('ignores an unsafe reference path and stays on the map surface', () => {
    expect(
      buildUmkmMapPlacePath({
        slug: 'osm-node-1',
        public_path: '//example.test/unsafe',
        metadata: { is_public_reference: true },
      }),
    ).toBe('/umkm?store=osm-node-1&view=map');
  });

  it('uses a storefront slug from metadata when the map point has no top-level slug', () => {
    expect(
      buildUmkmMapPlacePath({
        id: 'reference:bank-permata-bintaro',
        metadata: {
          is_public_reference: true,
          storefront_slug: 'bank-permata-bintaro',
        },
      }),
    ).toBe(
      '/umkm?store=bank-permata-bintaro&storeId=reference%3Abank-permata-bintaro&view=map',
    );
  });

  it('routes a Lajukan store map point to its storefront', () => {
    expect(
      buildUmkmMapPlacePath({
        slug: 'lajukan-juice-31f8206d',
        metadata: {
          source_kind: 'lajukan_store',
          source: 'usaha_portal',
        },
      }),
    ).toBe('/toko/lajukan-juice-31f8206d');
  });

  it('routes an owned Lajukan content projection to its storefront', () => {
    expect(
      buildUmkmMapPlacePath({
        id: 'store-1',
        slug: 'lajukan-juice-31f8206d',
        public_path: '/content/legacy-store',
        metadata: {
          source_kind: 'lajukan_content',
          owner_user_id: 'user-1',
        },
      }),
    ).toBe('/toko/lajukan-juice-31f8206d');
  });

  it('routes Lajukan listing map points to their content path', () => {
    expect(
      buildUmkmMapPlacePath({
        slug: 'listing-slug',
        public_path: '/content/123',
        metadata: {
          source_kind: 'lajukan_listing',
          record_kind: 'lajukan_listing',
        },
      }),
    ).toBe('/content/123');
  });

  it('opens owner actions directly in the dedicated Usaha workspace', () => {
    expect(buildUsahaPath('catalog', { storeId: 'store / 1' })).toBe(
      'https://usaha.lajukan.com/businesses/store%20%2F%201/products',
    );
    expect(buildUsahaPath('home', { storeId: 'business-1' })).toBe(
      'https://usaha.lajukan.com/?business=business-1',
    );
  });

  it('preserves workspace intent and anchors when leaving WWW', () => {
    expect(
      buildUsahaPathFromWorkspace('operations', {
        storeId: 'business-1',
        hash: 'stok-menipis',
      }),
    ).toBe(
      'https://usaha.lajukan.com/businesses/business-1/operations#stok-menipis',
    );
  });
});
