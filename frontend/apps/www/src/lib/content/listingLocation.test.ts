import { describe, expect, it } from 'vitest';

import { resolveListingLocation } from './listingLocation';

describe('resolveListingLocation', () => {
  it('prefers the listing form location over a generic item location', () => {
    expect(
      resolveListingLocation(
        {
          location: 'Bandung',
          owner_profile: { city: 'Bandung' },
        },
        {
          form_values: {
            city: 'Jawa Tengah',
            address: 'Magelang, Jawa Tengah',
          },
        },
      ),
    ).toBe('Magelang, Jawa Tengah');
  });

  it('prefers buyer or service location from nested listing values', () => {
    expect(
      resolveListingLocation(
        { location: 'Bandung' },
        {
          listing_values: {
            target_location: 'Semarang, Jawa Tengah',
          },
          city: 'Bandung',
        },
      ),
    ).toBe('Semarang, Jawa Tengah');
  });

  it('uses explicit top-level listing location before backend fallback', () => {
    expect(
      resolveListingLocation(
        { location: 'Bandung' },
        {
          location_city: 'Solo, Jawa Tengah',
        },
      ),
    ).toBe('Solo, Jawa Tengah');
  });

  it('never falls back to owner profile city', () => {
    expect(
      resolveListingLocation(
        {
          location: '',
          owner_profile: { city: 'Bandung' },
        },
        {},
      ),
    ).toBe('Indonesia');
  });
});
