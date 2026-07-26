import { nominatimLocationProvider } from './nominatim-location-provider';
import { photonLocationProvider } from './photon-location-provider';
import type { LocationProvider } from './location-provider.interface';

const openStreetMapLocationProvider: LocationProvider = {
  async autocomplete(input) {
    try {
      const results = await photonLocationProvider.autocomplete(input);
      if (results.length > 0) return results;
    } catch (error) {
      console.warn('[PHOTON_AUTOCOMPLETE_FALLBACK]', error);
    }
    return nominatimLocationProvider.autocomplete(input);
  },
  place(placeId, locale) {
    return nominatimLocationProvider.place(placeId, locale);
  },
  reverseGeocode(input) {
    return nominatimLocationProvider.reverseGeocode(input);
  },
};

export function getLocationProvider(): LocationProvider {
  return openStreetMapLocationProvider;
}
