import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { ReactNode } from 'react';
import ClientLayoutWrapper from '@/components/layout/ClientLayoutWrapper';
import type { Metadata } from 'next';

const SITE_URL = 'https://www.lajukan.com';
const OG_IMAGE = `${SITE_URL}/og-image-home.png`;

const METADATA_BY_LOCALE: Record<string, Metadata> = {
  id: {
    title: 'Lajukan UMKM | Cari Supplier, Jasa, dan Peluang Usaha',
    description:
      'Lajukan bantu UMKM cari supplier, jasa, lokasi jualan, dan peluang usaha dengan cepat.',
    keywords: [
      'lajukan indonesia',
      'supplier indonesia',
      'distributor indonesia',
      'barang reseller',
      'bahan baku usaha',
      'sourcing umkm',
      'sewa alat usaha',
      'jasa operasional umkm',
      'freelancer umkm',
    ],
    openGraph: {
      title: 'Lajukan UMKM | Cari Supplier, Jasa, dan Peluang Usaha',
      description:
        'Lajukan bantu UMKM cari supplier, jasa, lokasi jualan, dan peluang usaha dengan cepat.',
      url: `${SITE_URL}/id/home`,
      siteName: 'Lajukan',
      type: 'website',
      locale: 'id_ID',
      images: [
        {
          url: OG_IMAGE,
          width: 1200,
          height: 630,
          alt: 'Lajukan Indonesia',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Lajukan UMKM | Cari Supplier, Jasa, dan Peluang Usaha',
      description:
        'Cari supplier, jasa, lokasi jualan, dan peluang usaha dengan cepat di Lajukan.',
      images: [OG_IMAGE],
    },
  },
  en: {
    title: 'Lajukan Global | Supply, Sourcing, and Business Operations',
    description:
      'Lajukan helps businesses find suppliers, distributors, resale goods, raw materials, business tool rentals, operational services, and business-ready freelancers.',
    keywords: [
      'lajukan',
      'supplier marketplace',
      'business sourcing',
      'distributor marketplace',
      'resale goods',
      'raw materials',
      'tool rental',
      'operational services',
      'umkm freelancer',
    ],
    openGraph: {
      title: 'Lajukan Global | Supply, Sourcing, and Business Operations',
      description:
        'Find suppliers, distributors, resale goods, business tool rentals, operational services, and business freelancers on Lajukan.',
      url: `${SITE_URL}/en/home`,
      siteName: 'Lajukan',
      type: 'website',
      locale: 'en_US',
      images: [
        {
          url: OG_IMAGE,
          width: 1200,
          height: 630,
          alt: 'Lajukan Global',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Lajukan Global | Supply, Sourcing, and Business Operations',
      description:
        'Search suppliers, distributors, rentals, operational services, and business talent on Lajukan.',
      images: [OG_IMAGE],
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

async function getCommonMessages(locale: string) {
  try {
    return (await import(`@/messages/common/${locale}.json`)).default;
  } catch {
    notFound();
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getCommonMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ClientLayoutWrapper locale={locale}>{children}</ClientLayoutWrapper>
    </NextIntlClientProvider>
  );
}
