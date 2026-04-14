// src/app/[locale]/freelancer/layout.tsx
import { ReactNode } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

// Metadata per locale
const METADATA_BY_LOCALE: Record<string, Metadata> = {
  id: {
    title: 'Lajukan Talent Usaha | Admin, Konten, Ads & Operasional',
    description:
      'Temukan talent terdaftar untuk admin marketplace, konten, CS, ads, desain, dan kebutuhan operasional usaha.',
    keywords: [
      'talent umkm',
      'admin marketplace',
      'talent ecommerce',
      'content creator umkm',
      'customer service umkm',
      'jasa operasional',
    ],
    alternates: { canonical: 'https://www.lajukan.com/id/freelancers' },
    robots: { index: true, follow: true },
  },
  en: {
    title: 'Lajukan Business Talent Profiles | Ops, Content, Ads, and Support',
    description:
      'Find registered talent profiles for marketplace admin, content, CS, ads, design, and business operations.',
    keywords: [
      'msme talent',
      'marketplace admin',
      'ecommerce talent',
      'ops support',
      'content creator',
      'business support',
    ],
    alternates: { canonical: 'https://www.lajukan.com/en/freelancers' },
    robots: { index: true, follow: true },
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
export default async function FreelancerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!METADATA_BY_LOCALE[locale]) notFound();

  // Wrapper khusus halaman freelancer
  return <div className="w-full">{children}</div>;
}
