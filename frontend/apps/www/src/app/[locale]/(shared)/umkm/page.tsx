import type { Metadata } from 'next';

import { UmkmDiscoveryClient } from '@/components/super-app/UmkmDiscoveryClient';
import { serializeJsonLd } from '@/lib/seo/jsonLd';
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

async function getDeepLinkedStore(storeSlug: string, storeId: string): Promise<UmkmStore | null> {
  if (storeSlug) {
    const store = await getUmkmStoreBySlug(storeSlug).catch(() => null);
    if (store) return store;
  }
  if (storeId) return getUmkmStoreById(storeId).catch(() => null);
  return null;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const query = await searchParams;
  const isId = locale === 'id';
  const lang = isId ? 'id' : 'en';
  const hasDiscoveryParams = Boolean(
    query.q?.trim() ||
      query.city?.trim() ||
      query.store?.trim() ||
      query.storeId?.trim() ||
      query.business?.trim() ||
      query.category?.trim() ||
      query.view === 'map',
  );
  const title = isId
    ? 'Peta & Daftar Usaha Lokal Indonesia | Lajukan'
    : 'Local Business Map & Directory | Lajukan';
  const description = isId
    ? 'Cari usaha lokal di peta atau daftar Lajukan. Temukan UMKM, toko, kuliner, jasa, tempat usaha, dan bisnis sekitar berdasarkan lokasi.'
    : 'Find local businesses on the Lajukan map and directory. Discover shops, food, services, places, and nearby businesses.';
  const canonical = `https://www.lajukan.com/${lang}/umkm`;

  return {
    title,
    description,
    robots: hasDiscoveryParams
      ? { index: false, follow: true }
      : { index: true, follow: true },
    alternates: {
      canonical,
      languages: {
        id: 'https://www.lajukan.com/id/umkm',
        en: 'https://www.lajukan.com/en/umkm',
        'x-default': 'https://www.lajukan.com/id/umkm',
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
  const deepLinkedSlug = resolvedSearchParams.store?.trim() || resolvedSearchParams.business?.trim() || '';
  const deepLinkedStoreId = resolvedSearchParams.storeId?.trim() || '';
  const [listedStoresResult, deepLinkedStoreResult] = await Promise.allSettled([
    listUmkmStores({ query: resolvedSearchParams.q?.trim() || undefined, city: resolvedSearchParams.city?.trim() || undefined, activeOnly: true, limit: 10 }),
    getDeepLinkedStore(deepLinkedSlug, deepLinkedStoreId),
  ]);
  const listedStores = listedStoresResult.status === 'fulfilled' ? listedStoresResult.value.filter(isPublicUmkmStoreVisible).map(toDiscoveryStore) : undefined;
  const deepLinkedStore = deepLinkedStoreResult.status === 'fulfilled' && deepLinkedStoreResult.value && isPublicUmkmStoreVisible(deepLinkedStoreResult.value) ? toDiscoveryStore(deepLinkedStoreResult.value) : null;
  const initialStores = listedStores === undefined && !deepLinkedStore
    ? undefined
    : mergeDeepLinkedUmkmStore(listedStores || [], deepLinkedStore);
  const seoStores = (listedStores || []).slice(0, 10);
  const baseUrl = 'https://www.lajukan.com';
  const seoJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name:
      locale === 'id'
        ? 'Peta & Daftar Usaha Lokal Indonesia | Lajukan'
        : 'Local Business Map & Directory | Lajukan',
    url: `${baseUrl}/${locale}/umkm`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Lajukan',
      url: baseUrl,
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: seoStores.length,
      itemListElement: seoStores.map((store, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${baseUrl}/${locale}/toko/${encodeURIComponent(store.slug)}`,
        name: store.name,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(seoJsonLd) }}
      />
      <UmkmDiscoveryClient
      locale={locale}
      isId={locale === 'id'}
      initialQuery={resolvedSearchParams.q || ''}
      initialCity={resolvedSearchParams.city || ''}
      initialCategory={resolvedSearchParams.category || ''}
      initialStoreSlug={resolvedSearchParams.store || resolvedSearchParams.business || ''}
      initialStoreId={resolvedSearchParams.storeId || ''}
      initialMapOnly={resolvedSearchParams.view === 'map'}
      initialStores={initialStores}
      initialCount={initialStores?.length}
      />
    </>
  );
}
