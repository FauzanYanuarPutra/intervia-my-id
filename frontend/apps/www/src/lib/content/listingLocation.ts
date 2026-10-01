export type ListingLocationRecord = Record<string, unknown>;

function readText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function readNestedLocation(value: unknown, keys: string[]): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as ListingLocationRecord;
  for (const key of keys) {
    const text = readText(record[key]);
    if (text) return text;
  }
  return '';
}

/**
 * The listing form's location is authoritative for marketplace cards.
 * We deliberately never fall back to an owner's account/profile location.
 */
export function getListingLocation(
  metadata: ListingLocationRecord | null | undefined,
  itemLocation?: unknown,
): string {
  const meta = metadata || {};
  const structured = readNestedLocation(meta.location_structured, [
    'formattedAddress',
    'formatted_address',
    'full_address',
    'street_address',
    'place_name',
    'name',
    'label',
  ]);

  return [
    readText(meta.listing_location),
    structured,
    readText(meta.address),
    readText(meta.location),
    readText(meta.service_area),
    readText(meta.city),
    readText(meta.region),
    readText(itemLocation),
  ].find(Boolean) || '';
}

export function getListingLocationPoint(
  metadata: ListingLocationRecord | null | undefined,
): { lat: number; lng: number } | null {
  const meta = metadata || {};
  const structured =
    meta.location_structured &&
    typeof meta.location_structured === 'object' &&
    !Array.isArray(meta.location_structured)
      ? (meta.location_structured as ListingLocationRecord)
      : null;

  const candidates = [
    [structured?.latitude, structured?.longitude],
    [structured?.lat, structured?.lng],
    [meta.location_lat, meta.location_lng],
    [meta.latitude, meta.longitude],
    [meta.lat, meta.lng],
  ];

  for (const [latRaw, lngRaw] of candidates) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      return { lat, lng };
    }
  }

  return null;
}
