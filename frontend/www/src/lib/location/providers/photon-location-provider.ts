import type {
  LocationAutocompleteInput,
  LocationProvider,
} from './location-provider.interface';
import type {
  LocationResultType,
  LocationSuggestion,
  SelectedLocation,
} from '../location.types';
import { normalizeLocationText } from '../location.utils';

type PhotonProperties = {
  osm_type?: string;
  osm_id?: number | string;
  osm_key?: string;
  osm_value?: string;
  type?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  locality?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countrycode?: string;
};

type PhotonFeature = {
  geometry?: {
    coordinates?: unknown[];
  };
  properties?: PhotonProperties;
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

const DEFAULT_PHOTON_BASE_URL = 'https://photon.komoot.io';
const CACHE_TTL_MS = 1000 * 60 * 10;
const cache = new Map<
  string,
  { expiresAt: number; value: LocationSuggestion[] }
>();

function getBaseUrl(): string {
  return (
    process.env.PHOTON_BASE_URL ||
    process.env.LOCATION_PHOTON_BASE_URL ||
    DEFAULT_PHOTON_BASE_URL
  ).replace(/\/+$/, '');
}

function getUserAgent(): string {
  return (
    process.env.LOCATION_HTTP_USER_AGENT ||
    process.env.PHOTON_USER_AGENT ||
    'Lajukan/1.0 location-search contact=hello@lajukan.com'
  );
}

function getCached(key: string): LocationSuggestion[] | null {
  const item = cache.get(key);
  if (!item || item.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(
  key: string,
  value: LocationSuggestion[],
): LocationSuggestion[] {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

function text(value: unknown): string {
  return normalizeLocationText(typeof value === 'string' ? value : '');
}

function uniqueParts(parts: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  return parts.filter(part => {
    const normalized = text(part).toLocaleLowerCase('id-ID');
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }) as string[];
}

function osmTypePrefix(value: string | undefined): 'N' | 'W' | 'R' | null {
  const normalized = text(value).toUpperCase();
  if (normalized === 'N' || normalized === 'NODE') return 'N';
  if (normalized === 'W' || normalized === 'WAY') return 'W';
  if (normalized === 'R' || normalized === 'RELATION') return 'R';
  return null;
}

function buildPlaceId(properties: PhotonProperties): string {
  const prefix = osmTypePrefix(properties.osm_type);
  const osmId = text(String(properties.osm_id || ''));
  if (prefix && osmId) return `osm:${prefix}:${osmId}`;
  return `photon:${encodeURIComponent(
    [properties.name, properties.street, properties.city, properties.state]
      .map(text)
      .filter(Boolean)
      .join('|'),
  )}`;
}

function classifyResult(properties: PhotonProperties): LocationResultType {
  const type = text(properties.type || properties.osm_value).toLowerCase();
  const osmKey = text(properties.osm_key).toLowerCase();

  if (
    [
      'amenity',
      'shop',
      'tourism',
      'leisure',
      'office',
      'craft',
      'healthcare',
    ].includes(osmKey)
  ) {
    return 'place';
  }
  if (type === 'street' || type === 'road' || osmKey === 'highway')
    return 'road';
  if (type === 'house' || properties.housenumber) return 'address';
  if (['city', 'town', 'village', 'municipality'].includes(type)) return 'city';
  if (
    ['district', 'suburb', 'locality', 'county', 'state', 'country'].includes(
      type,
    ) ||
    osmKey === 'place'
  ) {
    return 'area';
  }
  if (properties.street) return 'address';
  return 'place';
}

function streetLine(properties: PhotonProperties): string {
  const street = text(properties.street);
  const houseNumber = text(properties.housenumber);
  if (street && houseNumber) return `${street} No. ${houseNumber}`;
  return street || houseNumber;
}

export function suggestionFromPhoton(
  feature: PhotonFeature,
): LocationSuggestion | null {
  const properties = feature.properties || {};
  const coordinates = feature.geometry?.coordinates || [];
  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const resultType = classifyResult(properties);
  const roadAddress = streetLine(properties);
  const explicitName = text(properties.name);
  const name =
    explicitName ||
    roadAddress ||
    text(properties.city) ||
    text(properties.district);
  if (!name) return null;

  const city = text(properties.city) || (resultType === 'city' ? name : '');
  const addressParts = uniqueParts([
    roadAddress,
    text(properties.locality),
    text(properties.district),
    text(properties.county),
    city,
    text(properties.state),
    text(properties.postcode),
    text(properties.country) || 'Indonesia',
  ]);
  const formattedParts = uniqueParts([name, ...addressParts]);
  const secondaryParts = addressParts.filter(
    part => part.toLocaleLowerCase('id-ID') !== name.toLocaleLowerCase('id-ID'),
  );
  const formattedAddress = formattedParts.join(', ');
  const secondaryText = secondaryParts.join(', ') || formattedAddress;
  const placeId = buildPlaceId(properties);
  const rawTypes = uniqueParts([
    text(properties.osm_key),
    text(properties.osm_value),
    text(properties.type),
  ]);
  const selectedLocation: SelectedLocation = {
    placeId,
    name,
    formattedAddress,
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    country: text(properties.country) || 'Indonesia',
    countryCode: text(properties.countrycode).toUpperCase() || 'ID',
    province: text(properties.state) || undefined,
    city: city || undefined,
    regency: text(properties.county) || undefined,
    district: text(properties.district) || undefined,
    subdistrict: text(properties.locality) || undefined,
    postalCode: text(properties.postcode) || undefined,
    locationType: rawTypes.join(':') || resultType,
    provider: 'osm',
    types: rawTypes,
  };

  return {
    placeId,
    primaryText: name,
    secondaryText,
    description: formattedAddress,
    types: rawTypes,
    locationType: selectedLocation.locationType,
    latitude: selectedLocation.latitude,
    longitude: selectedLocation.longitude,
    countryCode: selectedLocation.countryCode,
    province: selectedLocation.province,
    city: selectedLocation.city || selectedLocation.regency,
    source: 'osm',
    resultType,
    selectedLocation,
  };
}

export function normalizePhotonFeatures(
  features: PhotonFeature[],
  limit: number,
  query = '',
): LocationSuggestion[] {
  const seenPlaceIds = new Set<string>();
  const seenDescriptions = new Set<string>();

  const suggestions = features
    .map(suggestionFromPhoton)
    .filter((item): item is LocationSuggestion => Boolean(item))
    .filter(item => {
      const descriptionKey = [item.primaryText, item.secondaryText]
        .join('|')
        .toLocaleLowerCase('id-ID');
      if (
        seenPlaceIds.has(item.placeId) ||
        seenDescriptions.has(descriptionKey)
      )
        return false;
      seenPlaceIds.add(item.placeId);
      seenDescriptions.add(descriptionKey);
      return true;
    });

  return rankAroundExactCity(suggestions, query).slice(0, Math.max(1, limit));
}

function distanceInKilometers(
  a: LocationSuggestion,
  b: LocationSuggestion,
): number | null {
  if (
    !Number.isFinite(a.latitude) ||
    !Number.isFinite(a.longitude) ||
    !Number.isFinite(b.latitude) ||
    !Number.isFinite(b.longitude)
  ) {
    return null;
  }
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRadians(a.latitude as number);
  const lat2 = toRadians(b.latitude as number);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians((b.longitude as number) - (a.longitude as number));
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function rankAroundExactCity(
  suggestions: LocationSuggestion[],
  query: string,
): LocationSuggestion[] {
  const normalizedQuery =
    normalizeLocationText(query).toLocaleLowerCase('id-ID');
  if (!normalizedQuery || normalizedQuery.split(' ').length > 2)
    return suggestions;

  const anchor = suggestions.find(
    item =>
      item.resultType === 'city' &&
      item.primaryText.toLocaleLowerCase('id-ID') === normalizedQuery,
  );
  if (!anchor) return suggestions;

  const anchorCity = anchor.primaryText.toLocaleLowerCase('id-ID');
  const anchorProvince = text(anchor.province).toLocaleLowerCase('id-ID');

  return suggestions
    .map((item, index) => {
      if (item.placeId === anchor.placeId) return { item, score: 10000 };

      let score = 1000 - index;
      const itemCity = text(item.city).toLocaleLowerCase('id-ID');
      const itemProvince = text(item.province).toLocaleLowerCase('id-ID');
      if (itemCity === anchorCity) score += 900;
      if (anchorProvince && itemProvince === anchorProvince) score += 260;
      if (['address', 'road', 'place'].includes(item.resultType || ''))
        score += 120;

      const distance = distanceInKilometers(anchor, item);
      if (distance !== null) {
        if (distance <= 10) score += 900;
        else if (distance <= 40) score += 700;
        else if (distance <= 120) score += 420;
        else if (distance <= 250) score += 180;
      }
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.item);
}

function findExactCityAnchor(
  suggestions: LocationSuggestion[],
  query: string,
): LocationSuggestion | null {
  const normalizedQuery =
    normalizeLocationText(query).toLocaleLowerCase('id-ID');
  if (!normalizedQuery || normalizedQuery.split(' ').length > 2) return null;
  return (
    suggestions.find(
      item =>
        item.resultType === 'city' &&
        item.primaryText.toLocaleLowerCase('id-ID') === normalizedQuery,
    ) || null
  );
}

async function fetchPhoton(
  input: LocationAutocompleteInput,
): Promise<PhotonResponse | null> {
  const params = new URLSearchParams({
    q: normalizeLocationText(input.query).slice(0, 160),
    limit: String(Math.max(8, Math.min((input.limit || 10) * 2, 20))),
    countrycode: (input.countryCode || 'ID').toLowerCase(),
  });
  if (input.locale === 'en') params.set('lang', 'en');
  if (
    input.bias &&
    Number.isFinite(input.bias.lat) &&
    Number.isFinite(input.bias.lng)
  ) {
    params.set('lat', String(input.bias.lat));
    params.set('lon', String(input.bias.lng));
    params.set('zoom', '12');
    params.set('location_bias_scale', '0.25');
  }

  const response = await fetch(`${getBaseUrl()}/api/?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': input.locale || 'id',
      'User-Agent': getUserAgent(),
    },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.json().catch(() => null)) as PhotonResponse | null;
}

export const photonLocationProvider: LocationProvider = {
  async autocomplete(
    input: LocationAutocompleteInput,
  ): Promise<LocationSuggestion[]> {
    const query = normalizeLocationText(input.query).slice(0, 160);
    if (query.length < 2) return [];

    const limit = Math.max(1, Math.min(input.limit || 10, 12));
    const cacheKey = `photon:v3:${input.locale || 'id'}:${input.countryCode || 'ID'}:${query}:${input.bias?.lat || ''}:${input.bias?.lng || ''}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const payload = await fetchPhoton({ ...input, query, limit });
    let features = Array.isArray(payload?.features) ? payload.features : [];
    const preliminary = normalizePhotonFeatures(features, 20, query);
    const cityAnchor = findExactCityAnchor(preliminary, query);
    const nearbyDetailCount = cityAnchor
      ? preliminary.filter(
          item =>
            ['address', 'road', 'place'].includes(item.resultType || '') &&
            (distanceInKilometers(cityAnchor, item) ??
              Number.POSITIVE_INFINITY) <= 120,
        ).length
      : 0;

    if (
      cityAnchor &&
      nearbyDetailCount < 3 &&
      Number.isFinite(cityAnchor.latitude) &&
      Number.isFinite(cityAnchor.longitude)
    ) {
      const enrichedPayload = await fetchPhoton({
        ...input,
        query,
        limit: 12,
        bias: {
          lat: cityAnchor.latitude as number,
          lng: cityAnchor.longitude as number,
        },
      });
      if (Array.isArray(enrichedPayload?.features)) {
        features = [...features, ...enrichedPayload.features];
      }
    }

    return setCached(cacheKey, normalizePhotonFeatures(features, limit, query));
  },

  async place(): Promise<SelectedLocation | null> {
    return null;
  },

  async reverseGeocode(): Promise<SelectedLocation | null> {
    return null;
  },
};
