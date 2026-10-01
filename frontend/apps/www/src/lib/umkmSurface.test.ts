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

  it('routes public map references to their explicit public detail path', () => {
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
      '/content/pasar-uji-reference-id',
    );
  });

  it('routes Wikidata references to their content-style public detail path', () => {
    expect(
      buildUmkmMapPlacePath({
        slug: 'wikidata-q111754951-mcdonald-s-banjar-baru-6f9f6ab8-ac91-48eb-88af-0b12f1aa9d6e',
        public_path: '/content/legacy-reference',
        metadata: {
          record_kind: 'wikidata_reference',
          source_kind: 'external_content_reference',
          market_side: 'reference',
          is_public_reference: true,
        },
      }),
    ).toBe('/content/legacy-reference');
  });

  it('does not accept an external or protocol-relative reference path', () => {
    expect(
      buildUmkmMapPlacePath({
        slug: 'osm-node-1',
        public_path: '//example.test/unsafe',
        metadata: { is_public_reference: true },
      }),
    ).toBe('/toko/osm-node-1');
  });

  it('uses metadata public_path for a public reference when top-level public_path is absent', () => {
    expect(
      buildUmkmMapPlacePath({
        metadata: {
          is_public_reference: true,
          public_path: '/content/reference-only',
        },
      }),
    ).toBe('/content/reference-only');
  });

  it('uses a storefront slug from metadata when the map point has no top-level slug', () => {
    expect(
      buildUmkmMapPlacePath({
        metadata: {
          is_public_reference: true,
          storefront_slug: 'bank-permata-bintaro',
        },
      }),
    ).toBe('/toko/bank-permata-bintaro');
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
