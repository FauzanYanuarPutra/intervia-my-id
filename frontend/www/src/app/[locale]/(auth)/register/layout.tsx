import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { ReactNode } from 'react';

async function getMessages(locale: string) {
  try {
    return (await import(`@/messages/register/${locale}.json`)).default;
  } catch {
    notFound();
  }
}

// Generate dynamic metadata for register page per locale
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages(locale);

  const title =
    messages.register?.title ||
    (locale === 'id' ? 'Daftar | Lajukan' : 'Register | Lajukan');

  const description =
    messages.register?.description ||
    (locale === 'id'
      ? 'Daftar pakai nomor HP. Mulai cari, jual, kelola usaha.'
      : 'Create a new account on Lajukan and start accessing freelance projects, jobs, properties, and top opportunities across Indonesia.');

  const canonicalUrl = `https://www.lajukan.com/${locale}/register`;

  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Lajukan',
      type: 'website',
      locale: locale === 'id' ? 'id_ID' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function RegisterLayout({
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
