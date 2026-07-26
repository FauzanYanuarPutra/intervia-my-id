import { describe, expect, it } from 'vitest';
import {
  buildBusinessLocationSuggestion,
  isSelectedLocation,
  selectedLocationToSuggestion,
} from './location.utils';
import type { SelectedLocation } from './location.types';

describe('location utils', () => {
  it('builds a structured business location suggestion', () => {
    const suggestion = buildBusinessLocationSuggestion({
      id: 'store-1',
      name: 'Kopi Bandung Timur',
      address: 'Jl. Sindanglaya No. 12',
      city: 'Bandung',
      lat: -6.9021,
      lng: 107.6543,
    });

    expect(suggestion.source).toBe('business');
    expect(suggestion.selectedLocation?.placeId).toBe('business:store-1');
    expect(suggestion.selectedLocation?.formattedAddress).toContain('Sindanglaya');
    expect(suggestion.latitude).toBe(-6.9021);
    expect(suggestion.longitude).toBe(107.6543);
  });

  it('recognizes valid selected location payloads', () => {
    const location: SelectedLocation = {
      placeId: 'osm:N:123',
      name: 'Lippo Mall Puri',
      formattedAddress: 'Lippo Mall Puri, Jakarta Barat',
      latitude: -6.188,
      longitude: 106.738,
      country: 'Indonesia',
      countryCode: 'ID',
    };

    expect(isSelectedLocation(location)).toBe(true);
    expect(isSelectedLocation({ ...location, latitude: 'bad' })).toBe(false);
  });

  it('keeps selected location data attached to suggestions', () => {
    const location: SelectedLocation = {
      placeId: 'osm:W:456',
      name: 'Pasar Baru',
      formattedAddress: 'Pasar Baru, Bandung',
      latitude: -6.917,
      longitude: 107.604,
      country: 'Indonesia',
      countryCode: 'ID',
      city: 'Bandung',
      provider: 'osm',
    };

    const suggestion = selectedLocationToSuggestion(location);

    expect(suggestion.primaryText).toBe('Pasar Baru');
    expect(suggestion.selectedLocation).toEqual(location);
    expect(suggestion.city).toBe('Bandung');
  });
});
