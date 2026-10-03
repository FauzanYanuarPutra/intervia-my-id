import { type LatLng, normalizeLatLng, parseLatLngFromMapsInput } from '@/lib/maps';

export type LocationSuggestion = {
  label: string;
  title: string;
  subtitle?: string | null;
  point: LatLng;
  rawLabel: string;
  source?: 'business' | 'osm';
  address?: string;
  city?: string;
  province?: string;
  district?: string;
  businessId?: string;
};

function pickAddressPart(
  address: Record<string, string | undefined> | undefined,
  keys: string[],
) {
  if (!address) {
    return null;
  }

  for (const key of keys) {
    const value = address[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function buildSuggestionCopy(input: {
  displayName?: string;
  name?: string;
  address?: Record<string, string | undefined>;
}) {
  const raw = String(input.displayName || input.name || '').trim();
  const parts = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  const title =
    pickAddressPart(input.address, [
      'road',
      'pedestrian',
      'footway',
      'neighbourhood',
      'suburb',
      'city_district',
      'village',
      'town',
      'city',
      'county',
      'state_district',
      'state',
    ]) ||
    String(input.name || '').trim() ||
    parts[0] ||
    raw;
  const locality = pickAddressPart(input.address, [
    'city',
    'town',
    'municipality',
    'village',
    'county',
  ]);
  const region = pickAddressPart(input.address, [
    'state_district',
    'state',
    'region',
    'province',
  ]);
  const subtitleParts = [locality, region].filter(
    (part, index, all): part is string =>
      Boolean(part) && part !== title && all.indexOf(part) === index,
  );
  const subtitle = subtitleParts.join(', ') || parts.slice(1, 3).join(', ') || null;
  const label = subtitle ? `${title}, ${subtitle}` : title || raw;

  return {
    label: label || raw,
    title: title || raw,
    subtitle,
  };
}

type SearchLocationOptions = {
  signal?: AbortSignal;
  limit?: number;
  language?: string;
};

export async function searchLocationSuggestions(
  query: string,
  options: SearchLocationOptions = {},
) {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 3) {
    return [];
  }

  const explicitPoint = parseLatLngFromMapsInput(normalizedQuery);
  if (explicitPoint) {
    return [
      {
        label: `${explicitPoint.lat}, ${explicitPoint.lng}`,
        title: 'Koordinat',
        subtitle: 'Titik lokasi langsung',
        point: explicitPoint,
        rawLabel: `${explicitPoint.lat},${explicitPoint.lng}`,
      },
    ] satisfies LocationSuggestion[];
  }

  const url = new URL('/api/locations/autocomplete', window.location.origin);
  url.searchParams.set('q', normalizedQuery);
  url.searchParams.set('locale', options.language === 'en' ? 'en' : 'id');

  const response = await fetch(url.toString(), {
    signal: options.signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) return [];

  const payload = (await response.json().catch(() => ({}))) as {
    data?: Array<{
      placeId?: string;
      primaryText?: string;
      secondaryText?: string;
      description?: string;
      source?: 'business' | 'osm';
      latitude?: number;
      longitude?: number;
      province?: string;
      city?: string;
      district?: string;
      selectedLocation?: {
        latitude?: number;
        longitude?: number;
        formattedAddress?: string;
        province?: string;
        city?: string;
        district?: string;
      } | null;
    }>;
  };

  return (Array.isArray(payload.data) ? payload.data : [])
    .map(item => {
      const lat = Number(item.selectedLocation?.latitude ?? item.latitude);
      const lng = Number(item.selectedLocation?.longitude ?? item.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const title = String(item.primaryText || '').trim();
      const address = String(
        item.selectedLocation?.formattedAddress || item.description || '',
      ).trim();
      if (!title && !address) return null;

      const point = normalizeLatLng({ lat, lng });
      const businessId =
        item.source === 'business' && String(item.placeId || '').startsWith('business:')
          ? String(item.placeId).slice('business:'.length)
          : undefined;
      const subtitle =
        String(item.secondaryText || '').trim() ||
        [item.selectedLocation?.city || item.city, item.selectedLocation?.province || item.province]
          .filter(Boolean)
          .join(', ') ||
        null;

      return {
        label: subtitle ? `${title || address}, ${subtitle}` : title || address,
        title: title || address,
        subtitle,
        point,
        rawLabel: address || title,
        source: item.source === 'business' ? 'business' : 'osm',
        address,
        city: item.selectedLocation?.city || item.city,
        province: item.selectedLocation?.province || item.province,
        district: item.selectedLocation?.district || item.district,
        businessId,
      } satisfies LocationSuggestion;
    })
    .filter(Boolean) as LocationSuggestion[];
}


export async function geocodeLocation(
  query: string,
  options: Omit<SearchLocationOptions, 'limit'> = {},
) {
  const items = await searchLocationSuggestions(query, {
    ...options,
    limit: 1,
  });

  return items[0] ?? null;
}
