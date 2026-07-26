export type LocationProviderSource = 'osm' | 'google' | 'business';

export type LocationResultType =
  | 'business'
  | 'address'
  | 'road'
  | 'place'
  | 'city'
  | 'area';

export type LocationBias = {
  lat: number;
  lng: number;
};

export type SelectedLocation = {
  placeId: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  country: string;
  countryCode: string;
  province?: string;
  city?: string;
  regency?: string;
  district?: string;
  subdistrict?: string;
  postalCode?: string;
  locationType?: string;
  provider?: LocationProviderSource;
  types?: string[];
};

export type LocationSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  description: string;
  types: string[];
  locationType?: string;
  latitude?: number;
  longitude?: number;
  countryCode?: string;
  province?: string;
  city?: string;
  source?: LocationProviderSource;
  resultType?: LocationResultType;
  selectedLocation?: SelectedLocation;
};

export type LocationAutocompleteResponse = {
  data: LocationSuggestion[];
  provider: LocationProviderSource;
};

export type LocationPlaceResponse = {
  data: SelectedLocation | null;
  provider: LocationProviderSource;
};
