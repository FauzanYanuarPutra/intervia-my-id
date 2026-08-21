// src/app/(login)/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { ReactNode } from 'react';

async function getMessages(locale: string) {
  try {
    return (await import(`@/messages/login/${locale}.json`)).default;
  } catch {
    notFound();
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages(locale);

  const title =
    messages['title'] ||
    (locale === 'id' ? 'Masuk | Lajukan' : 'Login | Lajukan');
  const description =
    messages['description'] ||
    (locale === 'id'
      ? 'Masuk pakai nomor HP dan lanjutkan pencarian, chat, atau transaksi kamu.'
      : 'Sign in to your Lajukan account to access freelance projects, clients, and top opportunities.');

  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: `https://www.lajukan.com/${locale}/login` },
    openGraph: {
      title,
      description,
      url: `https://www.lajukan.com/${locale}/login`,
      siteName: 'Lajukan',
      type: 'website',
      locale: locale === 'id' ? 'id_ID' : 'en_US',
      images: [
        {
          url: 'https://www.lajukan.com/og-image-login.png',
          width: 1200,
          height: 630,
          alt: 'Lajukan Login',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://www.lajukan.com/og-image-login.png'],
    },
  };
}

export default async function LoginLayout({
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
