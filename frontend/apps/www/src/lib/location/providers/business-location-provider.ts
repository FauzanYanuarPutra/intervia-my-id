import type {
  LocationAutocompleteInput,
  LocationProvider,
} from './location-provider.interface';
import type { LocationSuggestion, SelectedLocation } from '../location.types';
import { normalizeLocationText } from '../location.utils';

const DEFAULT_MARKETPLACE_URL = 'http://localhost:8081';

function marketplaceUrl(): string {
  return (
    process.env.INTERNAL_MARKETPLACE_URL ||
    process.env.MARKETPLACE_URL ||
    process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
    DEFAULT_MARKETPLACE_URL
  ).replace(/\/+$/, '');
}

function text(value: unknown): string {
  return normalizeLocationText(typeof value === 'string' ? value : '');
}

function num(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toSelectedLocation(item: Record<string, unknown>): SelectedLocation | null {
  const lat = num(item.lat);
  const lng = num(item.lng);
  const name = text(item.name);
  if (lat === null || lng === null || !name) return null;

  const metadata =
    item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : {};
  const address = text(item.address);
  const city = text(item.city);
  const province = text(metadata.province);
  const district = text(metadata.district);
  const postalCode = text(metadata.postal_code || metadata.postalCode);

  return {
    placeId: `business:${text(item.id)}`,
    name,
    formattedAddress: [address, city].filter(Boolean).join(', ') || city || name,
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    country: 'Indonesia',
    countryCode: 'ID',
    province: province || undefined,
    city: city || undefined,
    district: district || undefined,
    postalCode: postalCode || undefined,
    locationType: text(item.category) || 'business',
    provider: 'business',
    types: ['business'],
  };
}

export const businessLocationProvider: LocationProvider = {
  async autocomplete(input: LocationAutocompleteInput): Promise<LocationSuggestion[]> {
    const query = text(input.query).slice(0, 120);
    if (query.length < 2) return [];

    const params = new URLSearchParams({
      q: query,
      limit: String(Math.max(1, Math.min(input.limit || 10, 20))),
    });

    if (input.bias && Number.isFinite(input.bias.lat) && Number.isFinite(input.bias.lng)) {
      params.set('viewer_lat', String(input.bias.lat));
      params.set('viewer_lng', String(input.bias.lng));
    }

    const response = await fetch(
      `${marketplaceUrl()}/v1/map/places?${params.toString()}`,
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(1800),
      },
    );
    if (!response.ok) return [];

    const payload = (await response.json().catch(() => ({}))) as {
      items?: Array<Record<string, unknown>>;
    };

    return (Array.isArray(payload.items) ? payload.items : [])
      .filter(item => {
        const sourceKind = text(item.source_kind).toLowerCase();
        return sourceKind !== 'reference_store' && !text(item.id).startsWith('reference:');
      })
      .map(item => {
        const selectedLocation = toSelectedLocation(item);
        if (!selectedLocation) return null;
        const city = text(item.city);
        const address = text(item.address);
        return {
          placeId: selectedLocation.placeId,
          primaryText: selectedLocation.name,
          secondaryText: [city, address].filter(Boolean).join(', '),
          description: selectedLocation.formattedAddress,
          types: ['business'],
          locationType: selectedLocation.locationType,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          countryCode: 'ID',
          province: selectedLocation.province,
          city: selectedLocation.city,
          source: 'business',
          resultType: 'business',
          selectedLocation,
        } satisfies LocationSuggestion;
      })
      .filter((item): item is LocationSuggestion => Boolean(item));
  },

  async place(placeId: string): Promise<SelectedLocation | null> {
    if (!placeId.startsWith('business:')) return null;
    return null;
  },

  async reverseGeocode(): Promise<SelectedLocation | null> {
    return null;
  },
};
