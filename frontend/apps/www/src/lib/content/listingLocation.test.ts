import { describe, expect, it } from 'vitest';
import { resolveListingLocation } from './listingLocation';

describe('resolveListingLocation', () => {
  it('prefers listing form values over profile-like metadata', () => {
    expect(
      resolveListingLocation({
        metadata: {
          form_values: {
            location: 'Jawa Tengah',
            address: 'Semarang',
          },
          location: 'Bandung',
        },
      }),
    ).toBe('Jawa Tengah');
  });

  it('uses the explicit listing location before linked store fallback', () => {
    expect(
      resolveListingLocation({
        metadata: {
          location: 'Jawa Tengah',
          linked_umkm_stores: [
            { city: 'Tangerang Selatan', address: 'Pondok Jaya' },
          ],
        },
      }),
    ).toBe('Jawa Tengah');
  });

  it('uses the linked store only when the listing has no own location', () => {
    expect(
      resolveListingLocation({
        metadata: {
          linked_umkm_stores: [
            { city: 'Tangerang Selatan', address: 'Pondok Jaya' },
          ],
        },
      }),
    ).toBe('Pondok Jaya');
  });

  it('does not invent a country-level fallback', () => {
    expect(
      resolveListingLocation({
        metadata: {},
      }),
    ).toBe('');
  });
});
