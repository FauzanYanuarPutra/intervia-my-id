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

  it('keeps opening status unknown when business hours are not provided', () => {
    const ui = buildUmkmPlacePresentation(buildPlace(), true, null);

    expect(ui.openNow).toBeNull();
    expect(ui.openHours).toBe('Jam buka belum diisi');
    expect(ui.statusLabel).toBe('Jam buka belum diisi');
  });

  it('uses configured business hours without claiming a live status', () => {
    const ui = buildUmkmPlacePresentation(
      buildPlace({ metadata: { open_hours: 'Senin–Jumat' } }),
      true,
      null,
    );

    expect(ui.openHours).toBe('Senin–Jumat');
    expect(ui.openNow).toBeNull();
    expect(ui.statusLabel).toBe('Senin–Jumat');
  });

  it('uses a neutral placeholder instead of category imagery when media is missing', () => {
    const ui = buildUmkmPlacePresentation(buildPlace(), true, null);

    expect(ui.coverImage).toBe('/images/placeholders/business-default.svg');
    expect(ui.gallery).toEqual(['/images/placeholders/business-default.svg']);
  });

  it('keeps owner-provided storefront media', () => {
    const ui = buildUmkmPlacePresentation(
      buildPlace({
        metadata: {
          cover_image_url: 'https://cdn.example.test/store.jpg',
          gallery_images: [
            'https://cdn.example.test/product-1.jpg',
            'https://cdn.example.test/product-2.jpg',
          ],
        },
      }),
      true,
      null,
    );

    expect(ui.coverImage).toBe('https://cdn.example.test/store.jpg');
    expect(ui.gallery).toEqual([
      'https://cdn.example.test/store.jpg',
      'https://cdn.example.test/product-1.jpg',
      'https://cdn.example.test/product-2.jpg',
    ]);
  });
});
