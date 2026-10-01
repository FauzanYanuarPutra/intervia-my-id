export type JsonRecord = Record<string, unknown>;

const NESTED_LOCATION_KEYS = [
  'form_values',
  'listing_values',
  'attributes',
  'values',
] as const;

const EXPLICIT_LISTING_LOCATION_KEYS = [
  'full_address',
  'street_address',
  'listing_address',
  'location_address',
  'pickup_address',
  'return_address',
  'service_address',
  'formatted_address',
  'place_name',
  'location_name',
  'target_location',
  'buyer_location',
  'need_location',
  'service_area',
  'delivery_area',
  'coverage_area',
  'location_city',
  'city',
  'region',
  'location',
] as const;

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readFirstFromRecord(
  record: JsonRecord | null,
  keys: readonly string[],
): string {
  if (!record) return '';
  for (const key of keys) {
    const value = readText(record[key]);
    if (value) return value;
  }
  return '';
}

/**
 * Resolve the location intentionally published for the listing/request.
 *
 * Priority:
 * 1. Explicit form/listing payloads.
 * 2. Explicit top-level listing location fields.
 * 3. A backend item location only as a compatibility fallback.
 *
 * We intentionally do not inspect owner profiles. An account's city is not
 * the same thing as the location attached to a listing or buyer need.
 */
export function resolveListingLocation(
  item: JsonRecord,
  metadata: JsonRecord | null,
): string {
  const nestedSources = NESTED_LOCATION_KEYS
    .map(key => asRecord(metadata?.[key]))
    .filter((value): value is JsonRecord => Boolean(value));

  for (const source of nestedSources) {
    const value = readFirstFromRecord(
      source,
      EXPLICIT_LISTING_LOCATION_KEYS,
    );
    if (value) return value;
  }

  const explicitTopLevel = readFirstFromRecord(
    metadata,
    EXPLICIT_LISTING_LOCATION_KEYS,
  );
  if (explicitTopLevel) return explicitTopLevel;

  const itemLocation = readFirstFromRecord(item, [
    'listing_address',
    'location_address',
    'pickup_address',
    'service_address',
    'location_city',
    'city',
    'location',
  ]);
  if (itemLocation) return itemLocation;

  return 'Indonesia';
}
