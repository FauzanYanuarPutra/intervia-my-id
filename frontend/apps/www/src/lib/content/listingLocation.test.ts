import { describe, expect, it } from 'vitest';
import { getListingLocation, getListingLocationPoint } from './listingLocation';

describe('getListingLocation', () => {
  it('prefers the structured location selected in the listing form', () => {
    expect(
      getListingLocation({
        location: 'Bandung',
        city: 'Bandung',
        location_structured: {
          formattedAddress: 'Kawasan Industri, Jawa Tengah, Indonesia',
          latitude: -7.1,
          longitude: 110.4,
        },
      }),
    ).toBe('Kawasan Industri, Jawa Tengah, Indonesia');
  });

  it('does not fall back to account/owner metadata when the listing has no location', () => {
    expect(
      getListingLocation({
        owner_location: 'Bandung',
        owner_city: 'Bandung',
      }),
    ).toBe('');
  });

  it('uses address before broad city/region fallbacks', () => {
    expect(
      getListingLocation({
        address: 'Jl. Diponegoro 10, Semarang',
        city: 'Semarang',
        region: 'Jawa Tengah',
      }),
    ).toBe('Jl. Diponegoro 10, Semarang');
  });
});

describe('getListingLocationPoint', () => {
  it('reads coordinates from structured form location first', () => {
    expect(
      getListingLocationPoint({
        latitude: -6.2,
        longitude: 106.8,
        location_structured: {
          latitude: -7.25,
          longitude: 110.4,
        },
      }),
    ).toEqual({ lat: -7.25, lng: 110.4 });
  });
});
