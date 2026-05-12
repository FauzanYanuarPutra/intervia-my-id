import { buildGoogleMapsPlaceUrl, buildGoogleMapsSearchUrl, parseLatLngFromMapsInput, toLatLng } from '@/lib/maps';

const DEFAULT_WWW_BASE_URL = 'http://localhost:3000';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function cleanText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getPublicWwwBaseUrl() {
  const configuredUrl = cleanText(process.env.NEXT_PUBLIC_WWW_URL);
  return trimTrailingSlash(configuredUrl || DEFAULT_WWW_BASE_URL);
}

export function buildPublicStorefrontUrl(slug: string) {
  return `${getPublicWwwBaseUrl()}/toko/${encodeURIComponent(slug)}`;
}

export function buildBusinessLocationQuery(input: {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  locationQuery?: string | null;
}) {
  const explicitQuery = cleanText(input.locationQuery);
  if (explicitQuery) {
    return explicitQuery;
  }

  return [input.name, input.address, input.city]
    .map(cleanText)
    .filter(Boolean)
    .join(', ');
}

export function buildBusinessGoogleMapsUrl(input: {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  locationQuery?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const directPoint =
    toLatLng(input.latitude, input.longitude) ?? parseLatLngFromMapsInput(input.locationQuery);
  const locationQuery = buildBusinessLocationQuery(input);

  if (directPoint) {
    return buildGoogleMapsPlaceUrl(
      directPoint,
      [input.name, input.address, input.city]
        .map(cleanText)
        .filter(Boolean)
        .join(', ') || locationQuery,
    );
  }

  if (!locationQuery) {
    return '';
  }

  if (/^https?:\/\//i.test(locationQuery)) {
    return locationQuery;
  }

  return buildGoogleMapsSearchUrl(locationQuery);
}

export function inferBusinessCoordinates(input: {
  latitude?: number | null;
  longitude?: number | null;
  locationQuery?: string | null;
  googleMapsUrl?: string | null;
}) {
  return (
    toLatLng(input.latitude, input.longitude) ??
    parseLatLngFromMapsInput(input.locationQuery) ??
    parseLatLngFromMapsInput(input.googleMapsUrl)
  );
}
