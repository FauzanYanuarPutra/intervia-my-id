import type { ContentItem } from './catalog';

type LocationRecord = Record<string, unknown>;

function asRecord(value: unknown): LocationRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as LocationRecord)
    : {};
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readFirst(record: LocationRecord, keys: readonly string[]): string {
  for (const key of keys) {
    const value = readText(record[key]);
    if (value) return value;
  }
  return '';
}

function readNestedListingLocation(metadata: LocationRecord): string {
  const nestedKeys = [
    'form_values',
    'formValues',
    'listing_values',
    'listingValues',
    'attributes',
    'values',
  ] as const;

  for (const key of nestedKeys) {
    const nested = asRecord(metadata[key]);
    const value = readFirst(nested, [
      'location',
      'address',
      'city',
      'region',
      'full_address',
      'street_address',
      'formatted_address',
      'pickup_location',
      'return_location',
      'area_served',
    ]);
    if (value) return value;
  }

  return '';
}

function readLinkedStoreLocation(metadata: LocationRecord): string {
  const candidates: unknown[] = [
    metadata.linked_umkm_stores,
    metadata.umkm_store_inventory,
    metadata.branches,
    metadata.outlets,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;

    for (const entry of candidate.slice(0, 12)) {
      const record = asRecord(entry);
      const value = readFirst(record, [
        'address',
        'city',
        'location',
        'region',
      ]);
      if (value) return value;
    }
  }

  return '';
}

/**
 * Resolve a public listing's location only from listing-owned fields.
 *
 * Deliberately ignores owner_profile.location so a user's profile location
 * cannot overwrite the location entered for the listing.
 */
export function resolveListingLocation(
  item: Pick<ContentItem, 'metadata'> & {
    location?: unknown;
    city?: unknown;
    address?: unknown;
  },
): string {
  const metadata = asRecord(item.metadata);

  const formLocation = readNestedListingLocation(metadata);
  if (formLocation) return formLocation;

  const directListingLocation = readFirst(metadata, [
    'location',
    'address',
    'city',
    'region',
    'full_address',
    'street_address',
    'formatted_address',
    'pickup_location',
    'return_location',
    'area_served',
  ]);
  if (directListingLocation) return directListingLocation;

  const topLevelLocation = readFirst(asRecord(item), [
    'location',
    'address',
    'city',
  ]);
  if (topLevelLocation) return topLevelLocation;

  return readLinkedStoreLocation(metadata);
}
