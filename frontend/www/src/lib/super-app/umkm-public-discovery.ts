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

  if (store.metadata?.source === 'usaha_portal') {
    return true;
  }

  return store.metadata?.outlet_active !== false;
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
