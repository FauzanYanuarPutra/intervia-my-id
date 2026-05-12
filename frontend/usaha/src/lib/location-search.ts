import { type LatLng, normalizeLatLng, parseLatLngFromMapsInput } from '@/lib/maps';

export type LocationSuggestion = {
  label: string;
  title: string;
  subtitle?: string | null;
  point: LatLng;
  rawLabel: string;
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

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(options.limit ?? 5));
  url.searchParams.set('q', normalizedQuery);
  url.searchParams.set('accept-language', options.language ?? 'id');
  url.searchParams.set('countrycodes', 'id');

  const response = await fetch(url.toString(), {
    signal: options.signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json().catch(() => [])) as Array<{
    display_name?: string;
    name?: string;
    lat?: string;
    lon?: string;
    address?: Record<string, string | undefined>;
  }>;

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map(item => {
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      const rawLabel = String(item.display_name || item.name || '').trim();
      if (!rawLabel) {
        return null;
      }

      const copy = buildSuggestionCopy({
        displayName: item.display_name,
        name: item.name,
        address: item.address,
      });

      return {
        label: copy.label,
        title: copy.title,
        subtitle: copy.subtitle,
        point: normalizeLatLng({ lat, lng }),
        rawLabel,
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
