// app/[locale]/contact/layout.tsx
import { ReactNode } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

const METADATA_BY_LOCALE: Record<string, Metadata> = {
  id: {
    title: 'Hubungi Kami | Lajukan',
    description:
      'Hubungi tim Lajukan untuk pertanyaan, dukungan, atau informasi lebih lanjut mengenai platform freelance, jobs, dan properti.',
    keywords: [
      'hubungi laju',
      'kontak',
      'customer service',
      'freelance support',
      'laju contact',
    ],
    alternates: { canonical: 'https://www.lajukan.com/id/contact' },
    robots: { index: true, follow: true },
  },
  en: {
    title: 'Contact Us | Lajukan',
    description:
      'Reach out to the Lajukan team for inquiries, support, or more information about our freelance, jobs, and property platform.',
    keywords: [
      'contact laju',
      'support',
      'customer service',
      'freelance help',
      'laju contact',
    ],
    alternates: { canonical: 'https://www.lajukan.com/en/contact' },
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

export default async function ContactLayout({
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