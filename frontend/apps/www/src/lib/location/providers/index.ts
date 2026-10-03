import { businessLocationProvider } from './business-location-provider';
import { nominatimLocationProvider } from './nominatim-location-provider';
import { photonLocationProvider } from './photon-location-provider';
import type { LocationProvider } from './location-provider.interface';

const openStreetMapLocationProvider: LocationProvider = {
  async autocomplete(input) {
    try {
      const businessResults = await businessLocationProvider.autocomplete(input);
      if (businessResults.length > 0) {
        const osmResults = await photonLocationProvider.autocomplete(input);
        const seen = new Set(businessResults.map(item => item.placeId));
        return [
          ...businessResults,
          ...osmResults.filter(item => !seen.has(item.placeId)),
        ].slice(0, Math.max(1, Math.min(input.limit || 10, 12)));
      }
    } catch (error) {
      console.warn('[BUSINESS_LOCATION_AUTOCOMPLETE_FALLBACK]', error);
    }

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
