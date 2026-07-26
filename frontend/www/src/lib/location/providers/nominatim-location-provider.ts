import type {
  LocationAutocompleteInput,
  LocationProvider,
  ReverseGeocodeInput,
} from './location-provider.interface';
import type {
  LocationResultType,
  LocationSuggestion,
  SelectedLocation,
} from '../location.types';
import { normalizeLocationText } from '../location.utils';

type NominatimPlace = {
  place_id?: number | string;
  osm_type?: string;
  osm_id?: number | string;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  class?: string;
  type?: string;
  addresstype?: string;
  address?: Record<string, string | undefined>;
  namedetails?: Record<string, string | undefined>;
};

const DEFAULT_NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const CACHE_TTL_MS = 1000 * 60 * 10;
const cache = new Map<string, { expiresAt: number; value: unknown }>();

function getBaseUrl(): string {
  return (
    process.env.NOMINATIM_BASE_URL ||
    process.env.LOCATION_NOMINATIM_BASE_URL ||
    DEFAULT_NOMINATIM_BASE_URL
  ).replace(/\/+$/, '');
}

function getUserAgent(): string {
  return (
    process.env.LOCATION_HTTP_USER_AGENT ||
    process.env.NOMINATIM_USER_AGENT ||
    'Lajukan/1.0 location-search contact=hello@lajukan.com'
  );
}

function getCached<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item || item.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return item.value as T;
}

function setCached<T>(key: string, value: T): T {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

async function fetchNominatim<T>(
  path: string,
  params: URLSearchParams,
): Promise<T | null> {
  const url = `${getBaseUrl()}${path}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': getUserAgent(),
    },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.json().catch(() => null)) as T | null;
}

function osmTypePrefix(value: string | undefined): 'N' | 'W' | 'R' | null {
  const normalized = normalizeLocationText(value || '').toLowerCase();
  if (normalized === 'node' || normalized === 'n') return 'N';
  if (normalized === 'way' || normalized === 'w') return 'W';
  if (normalized === 'relation' || normalized === 'r') return 'R';
  return null;
}

function buildPlaceId(item: NominatimPlace): string {
  const prefix = osmTypePrefix(item.osm_type);
  const osmId = normalizeLocationText(String(item.osm_id || ''));
  if (prefix && osmId) return `osm:${prefix}:${osmId}`;
  return `nominatim:${normalizeLocationText(String(item.place_id || 'unknown'))}`;
}

function parseOsmPlaceId(
  placeId: string,
): { prefix: 'N' | 'W' | 'R'; id: string } | null {
  const match = /^osm:([NWR]):([^:]+)$/i.exec(placeId.trim());
  if (!match) return null;
  const prefix = match[1]?.toUpperCase();
  const id = match[2]?.trim();
  if ((prefix === 'N' || prefix === 'W' || prefix === 'R') && id) {
    return { prefix, id };
  }
  return null;
}

function addressPart(
  address: Record<string, string | undefined> | undefined,
  keys: string[],
): string {
  for (const key of keys) {
    const value = normalizeLocationText(address?.[key] || '');
    if (value) return value;
  }
  return '';
}

function primaryText(item: NominatimPlace): string {
  const named = normalizeLocationText(
    item.namedetails?.name ||
      item.namedetails?.['name:id'] ||
      item.namedetails?.['name:en'] ||
      '',
  );
  if (named) return named;
  const explicit = normalizeLocationText(item.name || '');
  if (explicit) return explicit;
  const display = normalizeLocationText(item.display_name || '');
  return display.split(',')[0]?.trim() || display;
}

function secondaryText(item: NominatimPlace): string {
  const address = item.address || {};
  const pieces = [
    addressPart(address, ['road', 'pedestrian', 'neighbourhood', 'suburb']),
    addressPart(address, ['city_district', 'district', 'county']),
    addressPart(address, ['city', 'town', 'municipality', 'village']),
    addressPart(address, ['state']),
  ].filter(Boolean);
  return pieces.join(', ') || normalizeLocationText(item.display_name || '');
}

function classifyResult(item: NominatimPlace): LocationResultType {
  const className = normalizeLocationText(item.class || '').toLowerCase();
  const type = normalizeLocationText(
    item.addresstype || item.type || '',
  ).toLowerCase();
  if (
    [
      'amenity',
      'shop',
      'tourism',
      'leisure',
      'office',
      'craft',
      'healthcare',
    ].includes(className)
  ) {
    return 'place';
  }
  if (
    className === 'highway' ||
    ['road', 'street', 'pedestrian'].includes(type)
  ) {
    return 'road';
  }
  if (item.address?.house_number || ['house', 'building'].includes(type))
    return 'address';
  if (['city', 'town', 'village', 'municipality'].includes(type)) return 'city';
  if (className === 'boundary' || className === 'place') return 'area';
  return item.address?.road ? 'address' : 'place';
}

function selectedFromNominatim(item: NominatimPlace): SelectedLocation | null {
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  const address = item.address || {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const countryCode = normalizeLocationText(
    address.country_code || '',
  ).toUpperCase();
  const name = primaryText(item);
  const formattedAddress = normalizeLocationText(item.display_name || name);
  if (!name || !formattedAddress) return null;

  const className = normalizeLocationText(item.class || '');
  const type = normalizeLocationText(item.type || '');

  return {
    placeId: buildPlaceId(item),
    name,
    formattedAddress,
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    country: normalizeLocationText(address.country || 'Indonesia'),
    countryCode: countryCode || 'ID',
    province: addressPart(address, ['state']),
    city: addressPart(address, ['city', 'town', 'municipality', 'village']),
    regency: addressPart(address, ['county', 'city_district']),
    district: addressPart(address, ['district', 'suburb']),
    subdistrict: addressPart(address, ['neighbourhood', 'hamlet']),
    postalCode: addressPart(address, ['postcode']),
    locationType: [className, type].filter(Boolean).join(':') || undefined,
    provider: 'osm',
    types: [className, type].filter(Boolean),
  };
}

function suggestionFromNominatim(
  item: NominatimPlace,
): LocationSuggestion | null {
  const selected = selectedFromNominatim(item);
  if (!selected) return null;
  const secondary = secondaryText(item);
  return {
    placeId: selected.placeId,
    primaryText: selected.name,
    secondaryText: secondary,
    description: selected.formattedAddress,
    types: selected.types || [],
    locationType: selected.locationType,
    latitude: selected.latitude,
    longitude: selected.longitude,
    countryCode: selected.countryCode,
    province: selected.province,
    city: selected.city || selected.regency,
    source: 'osm',
    resultType: classifyResult(item),
    selectedLocation: selected,
  };
}

function applyBias(
  params: URLSearchParams,
  bias?: { lat: number; lng: number } | null,
) {
  if (!bias || !Number.isFinite(bias.lat) || !Number.isFinite(bias.lng)) return;
  const delta = 0.45;
  params.set(
    'viewbox',
    [bias.lng - delta, bias.lat + delta, bias.lng + delta, bias.lat - delta]
      .map(value => value.toFixed(6))
      .join(','),
  );
  params.set('bounded', '0');
}

export const nominatimLocationProvider: LocationProvider = {
  async autocomplete(
    input: LocationAutocompleteInput,
  ): Promise<LocationSuggestion[]> {
    const query = normalizeLocationText(input.query).slice(0, 160);
    if (query.length < 2) return [];

    const cacheKey = `search:${input.locale || 'id'}:${input.countryCode || 'ID'}:${query}:${input.bias?.lat || ''}:${input.bias?.lng || ''}`;
    const cached = getCached<LocationSuggestion[]>(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      namedetails: '1',
      extratags: '1',
      limit: String(Math.max(1, Math.min(input.limit || 7, 8))),
      q: query,
      'accept-language': input.locale || 'id',
      countrycodes: (input.countryCode || 'ID').toLowerCase(),
    });
    applyBias(params, input.bias);

    const payload = await fetchNominatim<NominatimPlace[]>('/explore', params);
    if (!Array.isArray(payload)) return setCached(cacheKey, []);

    const results = payload
      .map(suggestionFromNominatim)
      .filter((item): item is LocationSuggestion => Boolean(item));
    return setCached(cacheKey, results);
  },

  async place(
    placeId: string,
    locale = 'id',
  ): Promise<SelectedLocation | null> {
    const parsed = parseOsmPlaceId(placeId);
    if (!parsed) return null;

    const cacheKey = `place:${locale}:${placeId}`;
    const cached = getCached<SelectedLocation | null>(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      namedetails: '1',
      extratags: '1',
      osm_ids: `${parsed.prefix}${parsed.id}`,
      'accept-language': locale,
    });
    const payload = await fetchNominatim<NominatimPlace[]>('/lookup', params);
    const selected = Array.isArray(payload)
      ? selectedFromNominatim(payload[0] || {})
      : null;
    return setCached(cacheKey, selected);
  },

  async reverseGeocode(
    input: ReverseGeocodeInput,
  ): Promise<SelectedLocation | null> {
    const lat = Number(input.lat);
    const lng = Number(input.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const cacheKey = `reverse:${input.locale || 'id'}:${lat.toFixed(5)}:${lng.toFixed(5)}`;
    const cached = getCached<SelectedLocation | null>(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      namedetails: '1',
      extratags: '1',
      lat: String(lat),
      lon: String(lng),
      zoom: '18',
      'accept-language': input.locale || 'id',
    });
    const payload = await fetchNominatim<NominatimPlace>('/reverse', params);
    const selected = payload ? selectedFromNominatim(payload) : null;
    return setCached(cacheKey, selected);
  },
};
