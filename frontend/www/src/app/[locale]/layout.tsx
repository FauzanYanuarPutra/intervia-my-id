import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { ReactNode } from 'react';
import ClientLayoutWrapper from '@/components/layout/ClientLayoutWrapper';
import type { Metadata } from 'next';
import { readStackStartupState } from '@/lib/system/startupState';
import {
  LANGUAGE_CONFIRM_COOKIE,
  hasConfirmedLanguageSelection,
} from '@/lib/languagePreference';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://www.lajukan.com';
const OG_IMAGE = `${SITE_URL}/og-image-home.png`;

const METADATA_BY_LOCALE: Record<string, Metadata> = {
  id: {
    title: 'Lajukan UMKM | Pasokan Lokal, Substitusi Impor, dan Ekspor',
    description:
      'Lajukan bantu UMKM cari supplier lokal, bahan baku Indonesia, jasa operasional, sertifikasi, dan jalur ekspor yang lebih rapi.',
    keywords: [
      'lajukan indonesia',
      'supplier indonesia',
      'distributor indonesia',
      'produk lokal indonesia',
      'substitusi impor',
      'produk siap ekspor',
      'sertifikasi halal bpom tkdn',
      'barang reseller',
      'bahan baku usaha',
      'sourcing umkm',
      'sewa alat usaha',
      'jasa operasional umkm',
      'freelancer umkm',
    ],
    openGraph: {
      title: 'Lajukan UMKM | Pasokan Lokal, Substitusi Impor, dan Ekspor',
      description:
        'Cari supplier lokal, bahan baku Indonesia, jasa operasional, sertifikasi, dan jalur ekspor di Lajukan.',
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
      title: 'Lajukan UMKM | Pasokan Lokal, Substitusi Impor, dan Ekspor',
      description:
        'Cari supplier lokal, bahan baku Indonesia, jasa operasional, sertifikasi, dan jalur ekspor di Lajukan.',
      images: [OG_IMAGE],
    },
  },
  en: {
    title: 'Lajukan Global | Local Supply, Import Replacement, and Export',
    description:
      'Lajukan helps businesses find Indonesian suppliers, local inputs, import-replacement options, operational services, certification support, and export paths.',
    keywords: [
      'lajukan',
      'supplier marketplace',
      'indonesia local supply',
      'import replacement',
      'export ready products',
      'halal bpom tkdn certification',
      'business sourcing',
      'distributor marketplace',
      'resale goods',
      'raw materials',
      'tool rental',
      'operational services',
      'umkm freelancer',
    ],
    openGraph: {
      title: 'Lajukan Global | Local Supply, Import Replacement, and Export',
      description:
        'Find Indonesian suppliers, local inputs, import-replacement options, operational services, and export paths on Lajukan.',
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
      title: 'Lajukan Global | Local Supply, Import Replacement, and Export',
      description:
        'Search Indonesian suppliers, local inputs, certification support, export services, and business talent on Lajukan.',
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
  const cookieStore = await cookies();
  const localeCookie =
    cookieStore.get('NEXT_LOCALE')?.value ?? cookieStore.get('locale')?.value;
  const languageConfirmCookie =
    cookieStore.get(LANGUAGE_CONFIRM_COOKIE)?.value ?? null;
  const initialLanguageSelectionRequired =
    !hasConfirmedLanguageSelection(localeCookie, languageConfirmCookie);
  const messages = await getCommonMessages(locale);
  const startupState = readStackStartupState();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ClientLayoutWrapper
        initialMaintenanceState={startupState}
        initialLanguageSelectionRequired={initialLanguageSelectionRequired}
        locale={locale}
      >
        {children}
      </ClientLayoutWrapper>
    </NextIntlClientProvider>
  );
}
