import type {
  LocationBias,
  LocationSuggestion,
  SelectedLocation,
} from '../location.types';

export type LocationAutocompleteInput = {
  query: string;
  countryCode?: string;
  locale?: 'id' | 'en';
  limit?: number;
  bias?: LocationBias | null;
};

export type ReverseGeocodeInput = {
  lat: number;
  lng: number;
  locale?: 'id' | 'en';
};

export interface LocationProvider {
  autocomplete(input: LocationAutocompleteInput): Promise<LocationSuggestion[]>;
  place(placeId: string, locale?: 'id' | 'en'): Promise<SelectedLocation | null>;
  reverseGeocode(input: ReverseGeocodeInput): Promise<SelectedLocation | null>;
}
