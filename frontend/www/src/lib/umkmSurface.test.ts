import { describe, expect, it } from 'vitest';
import {
  buildUmkmDiscoveryPath,
  buildUmkmProfilePath,
  buildUmkmStorefrontPath,
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
});
