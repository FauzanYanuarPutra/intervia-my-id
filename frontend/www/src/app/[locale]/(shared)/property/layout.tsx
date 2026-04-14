import { ReactNode } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

// Metadata per locale
const METADATA_BY_LOCALE: Record<string, Metadata> = {
  id: {
    title: 'Lajukan Lokasi Usaha | Kios, Ruko, Booth, dan Tempat Jualan',
    description:
      'Temukan kios, ruko, booth, lapak, dan lokasi jualan yang cocok untuk operasional usaha di Lajukan.',
    keywords: [
      'lokasi usaha',
      'sewa kios',
      'sewa ruko',
      'booth usaha',
      'tempat jualan',
      'lapak umkm',
      'lokasi food court',
    ],
    alternates: {
      canonical: 'https://www.lajukan.com/id/property',
      languages: {
        'id-ID': 'https://www.lajukan.com/id/property',
        'en-US': 'https://www.lajukan.com/en/property',
        'x-default': 'https://www.lajukan.com/id/property',
      },
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: 'Lajukan Lokasi Usaha | Kios, Ruko, Booth, dan Tempat Jualan',
      description:
        'Cari kios, ruko, booth, dan lokasi jualan untuk usaha dalam satu halaman.',
      url: 'https://www.lajukan.com/id/property',
      type: 'website',
      siteName: 'Lajukan',
      locale: 'id_ID',
      images: ['https://www.lajukan.com/og-image-property.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Lajukan Lokasi Usaha | Kios, Ruko, Booth, dan Tempat Jualan',
      description:
        'Cari kios, ruko, booth, dan lokasi jualan untuk usaha dalam satu halaman.',
      images: ['https://www.lajukan.com/og-image-property.png'],
    },
  },
  en: {
    title: 'Lajukan Business Locations | Kiosks, Booths, and Shophouses',
    description:
      'Discover kiosks, booths, shophouses, and business locations that fit daily operations on Lajukan.',
    keywords: [
      'business location',
      'kiosk for rent',
      'shophouse rental',
      'booth rental',
      'food court kiosk',
      'msme location',
      'selling location',
    ],
    alternates: {
      canonical: 'https://www.lajukan.com/en/property',
      languages: {
        'id-ID': 'https://www.lajukan.com/id/property',
        'en-US': 'https://www.lajukan.com/en/property',
        'x-default': 'https://www.lajukan.com/en/property',
      },
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: 'Lajukan Business Locations | Kiosks, Booths, and Shophouses',
      description:
        'Find kiosks, booths, shophouses, and business locations for daily operations.',
      url: 'https://www.lajukan.com/en/property',
      type: 'website',
      siteName: 'Lajukan',
      locale: 'en_US',
      images: ['https://www.lajukan.com/og-image-property.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Lajukan Business Locations | Kiosks, Booths, and Shophouses',
      description:
        'Find kiosks, booths, shophouses, and business locations for daily operations.',
      images: ['https://www.lajukan.com/og-image-property.png'],
    },
  },
};

// Generate metadata per locale
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return METADATA_BY_LOCALE[locale] || METADATA_BY_LOCALE['id'];
}

// Layout component
export default async function PropertyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!METADATA_BY_LOCALE[locale]) notFound();

  return <div className="w-full">{children}</div>;
}
