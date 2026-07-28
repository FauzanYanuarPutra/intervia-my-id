import type { Metadata } from 'next';

import { UmkmDiscoveryClient } from '@/components/super-app/UmkmDiscoveryClient';
import type { DiscoveryStore } from '@/components/super-app/UmkmDiscoveryPanel';
import {
  getUmkmStoreById,
  getUmkmStoreBySlug,
  listUmkmStores,
  type UmkmStore,
} from '@/lib/super-app/umkm-commerce';
import {
  isPublicUmkmStoreVisible,
  mergeDeepLinkedUmkmStore,
} from '@/lib/super-app/umkm-public-discovery';
import { projectPublicUmkmStore } from '@/lib/super-app/umkm-public-store';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    city?: string;
    store?: string;
    storeId?: string;
    business?: string;
    category?: string;
    view?: string;
  }>;
};

function toDiscoveryStore(store: UmkmStore): DiscoveryStore {
  const publicStore = projectPublicUmkmStore(store);

  return {
    id: publicStore.id,
    slug: publicStore.slug,
    name: publicStore.name,
    city: publicStore.city,
    address: publicStore.address,
    lat: publicStore.lat,
    lng: publicStore.lng,
    description: publicStore.description,
    phone: publicStore.phone,
    metadata: publicStore.metadata,
    online_order_enabled: publicStore.online_order_enabled,
    offline_order_enabled: publicStore.offline_order_enabled,
  };
}

async function getDeepLinkedStore(
  storeSlug: string,
  storeId: string,
): Promise<UmkmStore | null> {
  if (storeSlug) {
    const store = await getUmkmStoreBySlug(storeSlug).catch(() => null);
    if (store) return store;
  }

  if (storeId) {
    return getUmkmStoreById(storeId).catch(() => null);
  }

  return null;
}

export async function generateMetadata({
  params,
}: Pick<PageProps, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === 'id';
  const title = isId
    ? 'Temukan Usaha di Lajukan'
    : 'Discover Businesses on Lajukan';
  const description = isId
    ? 'Cari dan bandingkan profil usaha, lokasi, kategori, serta jalur kontak yang tersedia di Lajukan.'
    : 'Find and compare business profiles, locations, categories, and available contact options on Lajukan.';
  const canonical = `https://www.lajukan.com/${isId ? 'id' : 'en'}/umkm`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        'id-ID': 'https://www.lajukan.com/id/umkm',
        'en-US': 'https://www.lajukan.com/en/umkm',
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      siteName: 'Lajukan',
      locale: isId ? 'id_ID' : 'en_US',
    },
  };
}

export default async function UmkmPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const deepLinkedSlug =
    resolvedSearchParams.store?.trim() ||
    resolvedSearchParams.business?.trim() ||
    '';
  const deepLinkedStoreId = resolvedSearchParams.storeId?.trim() || '';
  const [listedStoresResult, deepLinkedStoreResult] = await Promise.allSettled([
    listUmkmStores({
      query: resolvedSearchParams.q?.trim() || undefined,
      city: resolvedSearchParams.city?.trim() || undefined,
      activeOnly: true,
      limit: 120,
    }),
    getDeepLinkedStore(deepLinkedSlug, deepLinkedStoreId),
  ]);

  const listedStores =
    listedStoresResult.status === 'fulfilled'
      ? listedStoresResult.value
          .filter(isPublicUmkmStoreVisible)
          .map(toDiscoveryStore)
      : undefined;
  const deepLinkedStore =
    deepLinkedStoreResult.status === 'fulfilled' &&
    deepLinkedStoreResult.value &&
    isPublicUmkmStoreVisible(deepLinkedStoreResult.value)
      ? toDiscoveryStore(deepLinkedStoreResult.value)
      : null;
  const initialStores =
    listedStores === undefined && !deepLinkedStore
      ? undefined
      : mergeDeepLinkedUmkmStore(listedStores || [], deepLinkedStore);

  return (
    <UmkmDiscoveryClient
      locale={locale}
      isId={locale === 'id'}
      initialQuery={resolvedSearchParams.q || ''}
      initialCity={resolvedSearchParams.city || ''}
      initialCategory={resolvedSearchParams.category || ''}
      initialStoreSlug={
        resolvedSearchParams.store || resolvedSearchParams.business || ''
      }
      initialStoreId={resolvedSearchParams.storeId || ''}
      initialMapOnly={resolvedSearchParams.view === 'map'}
      initialStores={initialStores}
      initialCount={initialStores?.length}
    />
  );
}
