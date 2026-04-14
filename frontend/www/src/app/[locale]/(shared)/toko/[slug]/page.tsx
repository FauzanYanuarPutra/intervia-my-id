import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UmkmStorefrontClient } from '@/components/super-app/UmkmStorefrontClient';
import { getBaseUrl } from '@/lib/server/getBaseUrl';
import { getUmkmStoreBySlug } from '@/lib/super-app/umkm-commerce';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

function readMetaText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const store = await getUmkmStoreBySlug(slug);

  if (!store) {
    return {
      title: locale === 'id' ? 'Toko Tidak Ketemu | Lajukan' : 'Business Not Found | Lajukan',
    };
  }

  const baseUrl = await getBaseUrl();
  const publicUrl = `${baseUrl}/${locale}/toko/${store.slug}`;
  const openHours = readMetaText(store.metadata.open_hours);

  return {
    title: locale === 'id' ? `${store.name} | Toko Lajukan` : `${store.name} | Lajukan Store`,
    description:
      store.description ||
      `${store.name} di ${store.city}. Lihat info toko, rating, komentar, dan tombol pesan langsung di Lajukan.`,
    alternates: {
      canonical: publicUrl,
    },
    openGraph: {
      title: store.name,
      description:
        store.description ||
        `${store.name} di ${store.city}${openHours ? `, buka ${openHours}` : ''}.`,
      url: publicUrl,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: store.name,
      description:
        store.description ||
        `${store.name} di ${store.city}${openHours ? `, buka ${openHours}` : ''}.`,
    },
  };
}

export default async function TokoPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const store = await getUmkmStoreBySlug(slug);

  if (!store) {
    notFound();
  }

  const baseUrl = await getBaseUrl();
  const publicUrl = `${baseUrl}/${locale}/toko/${store.slug}`;
  const metadata = store.metadata && typeof store.metadata === 'object' ? store.metadata : {};
  const ratingValue = typeof metadata.rating_avg === 'number' ? metadata.rating_avg : null;
  const ratingCount = typeof metadata.rating_count === 'number' ? metadata.rating_count : null;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: store.name,
    description: store.description || undefined,
    telephone: store.phone || undefined,
    url: publicUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: store.address,
      addressLocality: store.city,
      addressCountry: 'ID',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: store.lat,
      longitude: store.lng,
    },
    openingHours: readMetaText(metadata.open_hours) || undefined,
  };

  if (ratingValue !== null && ratingCount !== null && ratingCount > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue,
      reviewCount: ratingCount,
    };
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <UmkmStorefrontClient isId={locale === 'id'} slug={slug} initialStore={store} />
    </>
  );
}
