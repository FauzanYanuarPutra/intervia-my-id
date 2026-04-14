import { ReactNode } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

const METADATA_BY_LOCALE: Record<string, Metadata> = {
  id: {
    title: 'Kebijakan Privasi | Lajukan',
    description:
      'Baca Kebijakan Privasi Lajukan terkait data pengguna, keamanan, dan penggunaan informasi.',
    keywords: ['privacy', 'kebijakan privasi', 'data pribadi', 'laju'],
    alternates: { canonical: 'https://www.lajukan.com/id/privacy' },
    robots: { index: true, follow: true },
  },
  en: {
    title: 'Privacy Policy | Lajukan',
    description:
      'Read Lajukan Privacy Policy regarding user data, security, and information usage.',
    keywords: ['privacy', 'privacy policy', 'user data', 'laju'],
    alternates: { canonical: 'https://www.lajukan.com/en/privacy' },
    robots: { index: true, follow: true },
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return METADATA_BY_LOCALE[locale] || METADATA_BY_LOCALE['id'];
}

export default async function PrivacyLayout({
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