import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { ReactNode } from 'react';

async function getMessages(locale: string) {
  try {
    const [homeMessages, industryMessages] = await Promise.all([
      import(`@/messages/home/${locale}.json`).then(m => m.default),
      import(`@/messages/industries/${locale}.json`).then(m => m.default),
    ]);

    return {
      ...homeMessages,
      ...industryMessages,
    };
  } catch (error) {
    console.error('Error loading messages:', error);
    notFound();
  }
}

// Generate dynamic metadata
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const isId = locale === 'id';
  const canonical = `https://www.lajukan.com/${locale}/home`;
  const title =
    messages.home?.title ||
    (isId
      ? 'Beranda Lajukan | Supplier, Sourcing, dan Operasional Usaha'
      : 'Lajukan Home | Supplier, Sourcing, and Business Operations');
  const description =
    messages.home?.description ||
    (isId
      ? 'Cari supplier, distributor, bahan baku, stok jualan, sewa alat usaha, jasa operasional, storefront usaha, dan pengiriman order di Lajukan.'
      : 'Find suppliers, distributors, raw materials, resale stock, tool rental, operational services, business storefronts, and order delivery on Lajukan.');

  return {
    title,
    description,
    keywords: isId
      ? [
          'lajukan',
          'lajukan home',
          'supplier umkm',
          'distributor umkm',
          'bahan baku',
          'stok reseller',
          'sewa alat usaha',
          'jasa operasional umkm',
          'storefront umkm',
          'kirim order umkm',
        ]
      : [
          'lajukan home',
          'msme suppliers',
          'msme sourcing',
          'resale stock',
          'tool rental',
          'operational services',
          'msme storefront',
        ],
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical,
      languages: {
        'id-ID': 'https://www.lajukan.com/id/home',
        'en-US': 'https://www.lajukan.com/en/home',
        'x-default': 'https://www.lajukan.com/id/home',
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Lajukan',
      type: 'website',
      locale: isId ? 'id_ID' : 'en_US',
      images: [
        {
          url: 'https://www.lajukan.com/og-image-home.png',
          width: 1200,
          height: 630,
          alt: isId ? 'Lajukan untuk sourcing dan operasional usaha' : 'Lajukan for business sourcing and operations',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://www.lajukan.com/og-image-home.png'],
    },
  };
}

export default async function HomeLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
