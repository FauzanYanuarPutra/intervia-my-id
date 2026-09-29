import type { UmkmStore } from './umkm-commerce.types';

type PublicVisibilityStore = Pick<UmkmStore, 'is_active' | 'metadata'>;

type StoreIdentity = {
  id: string;
  slug: string;
};

/**
 * Mirrors the public collection visibility rule while also enforcing the
 * active-store constraint normally supplied to listUmkmStores.
 */
export function isPublicUmkmStoreVisible(
  store: PublicVisibilityStore,
): boolean {
  if (store.is_active !== true) return false;

  const recordKind =
    typeof store.metadata?.record_kind === 'string'
      ? store.metadata.record_kind.trim().toLowerCase()
      : '';
  const marketSide =
    typeof store.metadata?.market_side === 'string'
      ? store.metadata.market_side.trim().toLowerCase()
      : '';

  if (
    store.metadata?.is_transactional === false ||
    marketSide === 'reference' ||
    recordKind.includes('reference')
  ) {
    return false;
  }

  if (store.metadata?.source === 'usaha_portal') {
    return true;
  }

  return store.metadata?.outlet_active !== false;
}

const PUBLIC_REFERENCE_RECORD_KINDS = new Set([
  'government_reference',
  'open_data_reference',
  'licensed_reference',
  'external_content_reference',
  'real_openstreetmap_reference',
  'osm_provider_reference',
  'wikidata_reference',
]);

export function isPublicUmkmReferenceVisible(
  store: Pick<UmkmStore, 'is_active' | 'metadata'>,
): boolean {
  if (store.is_active !== true) return false;

  const metadata = store.metadata || {};
  const recordKind =
    typeof metadata.record_kind === 'string'
      ? metadata.record_kind.trim().toLowerCase()
      : '';
  const marketSide =
    typeof metadata.market_side === 'string'
      ? metadata.market_side.trim().toLowerCase()
      : '';
  const publicationStatus =
    typeof metadata.reference_publication_status === 'string'
      ? metadata.reference_publication_status.trim().toLowerCase()
      : '';

  return (
    publicationStatus === 'published' &&
    PUBLIC_REFERENCE_RECORD_KINDS.has(recordKind) &&
    marketSide === 'reference' &&
    metadata.is_transactional === false &&
    metadata.claimable === true &&
    typeof metadata.source_dataset === 'string' &&
    metadata.source_dataset.trim().length > 0 &&
    typeof metadata.source_url === 'string' &&
    metadata.source_url.trim().length > 0 &&
    typeof metadata.source_license === 'string' &&
    metadata.source_license.trim().length > 0
  );
}

export function isPublicUmkmDiscoveryVisible(
  store: Pick<UmkmStore, 'is_active' | 'metadata'>,
): boolean {
  return (
    isPublicUmkmStoreVisible(store) ||
    isPublicUmkmReferenceVisible(store)
  );
}

/**
 * Keeps a deep-linked store available when it falls outside the bounded
 * discovery batch. Existing list entries keep their original ordering/data.
 */
export function mergeDeepLinkedUmkmStore<T extends StoreIdentity>(
  stores: readonly T[],
  target: T | null | undefined,
): T[] {
  const items = [...stores];
  if (!target) return items;

  const alreadyIncluded = items.some(
    store => store.id === target.id || store.slug === target.slug,
  );

  return alreadyIncluded ? items : [target, ...items];
}
