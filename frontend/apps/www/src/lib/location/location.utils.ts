import type {
  LocationBias,
  LocationSuggestion,
  SelectedLocation,
} from './location.types';

export function normalizeLocationText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function isValidCoordinatePair(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function formatLocationInputValue(
  location: SelectedLocation | null,
): string {
  if (!location) return '';
  const city =
    location.city ||
    location.regency ||
    location.district ||
    location.province ||
    '';
  return [location.name, city].filter(Boolean).join(', ');
}

export function buildSelectedLocationFromPoint(
  point: LocationBias,
  label = 'Pinned location',
): SelectedLocation {
  return {
    placeId: `manual:${point.lat.toFixed(6)},${point.lng.toFixed(6)}`,
    name: label,
    formattedAddress: `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`,
    latitude: Number(point.lat.toFixed(6)),
    longitude: Number(point.lng.toFixed(6)),
    country: 'Indonesia',
    countryCode: 'ID',
    provider: 'osm',
    types: ['manual'],
    locationType: 'manual',
  };
}

export function selectedLocationToSuggestion(
  location: SelectedLocation,
  source: LocationSuggestion['source'] = location.provider || 'osm',
): LocationSuggestion {
  return {
    placeId: location.placeId,
    primaryText: location.name,
    secondaryText: location.formattedAddress,
    description: location.formattedAddress || location.name,
    types: location.types || [],
    locationType: location.locationType,
    latitude: location.latitude,
    longitude: location.longitude,
    countryCode: location.countryCode,
    province: location.province,
    city: location.city,
    source,
    resultType: source === 'business' ? 'business' : undefined,
    selectedLocation: location,
  };
}

export function buildBusinessLocationSuggestion(input: {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  lat: number;
  lng: number;
  province?: string | null;
}): LocationSuggestion {
  const city = normalizeLocationText(input.city || '');
  const address = normalizeLocationText(input.address || '');
  const name = normalizeLocationText(input.name);
  const location: SelectedLocation = {
    placeId: `business:${input.id}`,
    name,
    formattedAddress: [address, city].filter(Boolean).join(', ') || name,
    latitude: Number(input.lat.toFixed(6)),
    longitude: Number(input.lng.toFixed(6)),
    country: 'Indonesia',
    countryCode: 'ID',
    province: normalizeLocationText(input.province || '') || undefined,
    city: city || undefined,
    provider: 'business',
    types: ['business'],
    locationType: 'business',
  };
  return selectedLocationToSuggestion(location, 'business');
}

export function isSelectedLocation(value: unknown): value is SelectedLocation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<SelectedLocation>;
  return (
    typeof record.placeId === 'string' &&
    typeof record.name === 'string' &&
    typeof record.formattedAddress === 'string' &&
    isValidCoordinatePair(record.latitude, record.longitude)
  );
}
