import { describe, expect, it } from 'vitest';
import {
  buildUmkmPlacePresentation,
  formatUmkmPlaceDistance,
  type UmkmPlaceLike,
} from './umkm-place-ui';

function buildPlace(overrides: Partial<UmkmPlaceLike> = {}): UmkmPlaceLike {
  return {
    id: 'store-1',
    slug: 'store-1',
    name: 'Toko Uji',
    description: 'Warung uji',
    city: 'Bandung',
    address: 'Bandung',
    lat: -6.9,
    lng: 107.6,
    phone: null,
    metadata: {},
    ...overrides,
  };
}

describe('umkm place distance presentation', () => {
  it('uses the shared meter/kilometer formatter', () => {
    expect(formatUmkmPlaceDistance(0.32, true)).toBe('320 m');
    expect(formatUmkmPlaceDistance(2.25, false)).toBe('2.3 km');
    expect(formatUmkmPlaceDistance(-1, true)).toBeNull();
  });

  it('does not show distance without a viewer location or backend distance', () => {
    const ui = buildUmkmPlacePresentation(buildPlace(), true, null);
    expect(ui.distanceLabel).toBeNull();
  });

  it('does not compute distance from invalid target coordinates', () => {
    const ui = buildUmkmPlacePresentation(
      buildPlace({ lat: 120, lng: 107.6 }),
      true,
      { lat: -6.9, lng: 107.6 },
    );
    expect(ui.distanceLabel).toBeNull();
  });

  it('shows distance when viewer and target coordinates are valid', () => {
    const ui = buildUmkmPlacePresentation(buildPlace(), true, {
      lat: -6.901,
      lng: 107.6,
    });
    expect(ui.distanceLabel).toMatch(/m|km/);
  });
});
