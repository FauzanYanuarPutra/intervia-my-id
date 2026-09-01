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

  it('routes public map references to their content detail', () => {
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

  it('does not accept an external or protocol-relative reference path', () => {
    expect(
      buildUmkmMapPlacePath({
        slug: 'osm-node-1',
        public_path: '//example.test/unsafe',
        metadata: { is_public_reference: true },
      }),
    ).toBe('/toko/osm-node-1');
  });

  it('opens owner actions directly in the dedicated Usaha workspace', () => {
    expect(buildUsahaPath('catalog', { storeId: 'store / 1' })).toBe(
      'http://localhost:3003/businesses/store%20%2F%201/products',
    );
    expect(buildUsahaPath('home', { storeId: 'business-1' })).toBe(
      'http://localhost:3003/?business=business-1',
    );
  });

  it('preserves workspace intent and anchors when leaving WWW', () => {
    expect(
      buildUsahaPathFromWorkspace('operations', {
        storeId: 'business-1',
        hash: 'stok-menipis',
      }),
    ).toBe(
      'http://localhost:3003/businesses/business-1/operations#stok-menipis',
    );
  });
});
