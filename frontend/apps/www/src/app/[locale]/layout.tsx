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
    title: 'Lajukan — Temukan Kebutuhan & Peluang Usaha',
    description:
      'Temukan supplier, jasa, mesin, tempat usaha, peluang, orang dengan keahlian, usaha sekitar, dan kebutuhan pembeli di Lajukan.',
    keywords: [
      'lajukan',
      'supplier usaha',
      'jasa usaha',
      'mesin usaha',
      'alat usaha',
      'tempat usaha',
      'peluang usaha',
      'kebutuhan pembeli',
      'usaha sekitar',
      'keahlian usaha',
    ],
    openGraph: {
      title: 'Lajukan — Temukan Kebutuhan & Peluang Usaha',
      description:
        'Cari yang dibutuhkan usahamu atau pasang kebutuhan agar penyedia yang tepat bisa menemukanmu.',
      siteName: 'Lajukan',
      type: 'website',
      locale: 'id_ID',
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Lajukan' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Lajukan — Temukan Kebutuhan & Peluang Usaha',
      description:
        'Cari supplier, jasa, mesin, tempat usaha, peluang, dan kebutuhan pembeli dalam satu jaringan.',
      images: [OG_IMAGE],
    },
  },
  en: {
    title: 'Lajukan — Find Business Needs & Opportunities',
    description:
      'Find suppliers, services, machinery, business spaces, opportunities, skilled people, nearby businesses, and buyer needs on Lajukan.',
    keywords: [
      'lajukan',
      'business suppliers',
      'business services',
      'machinery marketplace',
      'business spaces',
      'business opportunities',
      'buyer needs',
      'nearby businesses',
      'business talent',
    ],
    openGraph: {
      title: 'Lajukan — Find Business Needs & Opportunities',
      description:
        'Find what your business needs or post a need so the right provider can find you.',
      siteName: 'Lajukan',
      type: 'website',
      locale: 'en_US',
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Lajukan' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Lajukan — Find Business Needs & Opportunities',
      description:
        'Find suppliers, services, machinery, spaces, opportunities, and buyer needs in one network.',
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
  const routeLocaleAlreadyChoosesLanguage = locale === 'id' || locale === 'en';
  const initialLanguageSelectionRequired =
    !routeLocaleAlreadyChoosesLanguage &&
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
