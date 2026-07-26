import { ReactNode } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

const METADATA_BY_LOCALE: Record<string, Metadata> = {
  id: {
    title: 'Jelajahi Lajukan UMKM | Supplier, Jasa, dan Peluang Usaha',
    description:
      'Cari supplier, jasa, talent, alat, dan lokasi usaha di Lajukan UMKM tanpa ribet.',
    keywords: [
      'jelajahi lajukan',
      'supplier umkm',
      'distributor',
      'bahan baku',
      'stok reseller',
      'jasa operasional',
      'freelancer umkm',
      'sewa alat usaha',
      'lokasi usaha',
      'sewa ruko',
      'sewa alat',
      'sewa kios',
    ],
    alternates: {
      canonical: 'https://www.lajukan.com/id/explore',
      languages: {
        'id-ID': 'https://www.lajukan.com/id/explore',
        'en-US': 'https://www.lajukan.com/en/explore',
        'x-default': 'https://www.lajukan.com/id/explore',
      },
    },
    robots: { index: false, follow: true },
    openGraph: {
      title: 'Jelajahi Lajukan UMKM | Supplier, Jasa, dan Peluang Usaha',
      description:
        'Cari supplier, jasa, talent, alat, dan lokasi usaha di Lajukan UMKM.',
      url: 'https://www.lajukan.com/id/explore',
      type: 'website',
      siteName: 'Lajukan',
      locale: 'id_ID',
      images: ['https://www.lajukan.com/og-image-search.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Jelajahi Lajukan UMKM | Supplier, Jasa, dan Peluang Usaha',
      description:
        'Cari supplier, jasa, talent, alat, dan lokasi usaha di Lajukan UMKM.',
      images: ['https://www.lajukan.com/og-image-search.png'],
    },
  },
  en: {
    title: 'Explore Lajukan | Suppliers, Services, and Business Places',
    description:
      'Search suppliers, distributors, raw materials, resale stock, operational services, freelancers, tool rental, and business locations on Lajukan.',
    keywords: [
      'explore lajukan',
      'msme suppliers',
      'distributors',
      'raw materials',
      'resale stock',
      'operational services',
      'freelancers',
      'shophouse rental',
      'kiosk for rent',
      'tool rental',
      'business location',
    ],
    alternates: {
      canonical: 'https://www.lajukan.com/en/explore',
      languages: {
        'id-ID': 'https://www.lajukan.com/id/explore',
        'en-US': 'https://www.lajukan.com/en/explore',
        'x-default': 'https://www.lajukan.com/en/explore',
      },
    },
    robots: { index: false, follow: true },
    openGraph: {
      title: 'Explore Lajukan | Suppliers, Services, and Business Places',
      description:
        'Search across business needs on Lajukan for supply, operations, rental tools, and business locations.',
      url: 'https://www.lajukan.com/en/explore',
      type: 'website',
      siteName: 'Lajukan',
      locale: 'en_US',
      images: ['https://www.lajukan.com/og-image-search.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Explore Lajukan | Suppliers, Services, and Business Places',
      description:
        'Search across business needs on Lajukan for supply, operations, rental tools, and business locations.',
      images: ['https://www.lajukan.com/og-image-search.png'],
    },
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return METADATA_BY_LOCALE[locale] || METADATA_BY_LOCALE.id;
}

export default async function SearchLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!METADATA_BY_LOCALE[locale]) notFound();
  return <>{children}</>;
}
