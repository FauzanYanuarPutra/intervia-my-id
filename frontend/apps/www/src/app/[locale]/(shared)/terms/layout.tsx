// app/[locale]/terms/layout.tsx
import { ReactNode } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

const METADATA_BY_LOCALE: Record<string, Metadata> = {
  id: {
    title: 'Syarat & Ketentuan | Lajukan',
    description:
      'Baca Syarat & Ketentuan penggunaan platform Lajukan, hak dan kewajiban pengguna, serta aturan layanan.',
    keywords: [
      'syarat ketentuan',
      'terms of service',
      'laju',
      'aturan penggunaan',
    ],
    alternates: { canonical: 'https://www.lajukan.com/id/terms' },
    robots: { index: true, follow: true },
  },
  en: {
    title: 'Terms of Service | Lajukan',
    description:
      'Read the Terms of Service for using Lajukan platform, user rights, obligations, and rules.',
    keywords: ['terms of service', 'laju', 'rules', 'user agreement'],
    alternates: { canonical: 'https://www.lajukan.com/en/terms' },
    robots: { index: true, follow: true },
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return METADATA_BY_LOCALE[locale] || METADATA_BY_LOCALE['id'];
}

export default async function TermsLayout({
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