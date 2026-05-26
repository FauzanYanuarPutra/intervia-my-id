// src/app/[locale]/jobs/layout.tsx
import { ReactNode } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

// Metadata per locale
const METADATA_BY_LOCALE: Record<string, Metadata> = {
  id: {
    title: 'Lajukan Brief Usaha | Kebutuhan Operasional & Tim Cepat',
    description:
      'Buka brief operasional, pekerjaan, dan tim cepat.',
    keywords: [
      'brief umkm',
      'kebutuhan operasional',
      'tim umkm',
      'admin marketplace',
      'brief jasa',
      'kebutuhan bisnis',
    ],
    alternates: {
      canonical: 'https://www.lajukan.com/id/jobs',
      languages: {
        'id-ID': 'https://www.lajukan.com/id/jobs',
        'en-US': 'https://www.lajukan.com/en/jobs',
        'x-default': 'https://www.lajukan.com/id/jobs',
      },
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: 'Lajukan Brief Usaha | Kebutuhan Operasional & Tim Cepat',
      description:
        'Cari brief operasional, tim cepat, dan bantuan eksekusi.',
      url: 'https://www.lajukan.com/id/jobs',
      type: 'website',
      siteName: 'Lajukan',
      locale: 'id_ID',
      images: ['https://www.lajukan.com/og-image-jobs.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Lajukan Brief Usaha | Kebutuhan Operasional & Tim Cepat',
      description:
        'Cari brief operasional, tim cepat, dan bantuan eksekusi.',
      images: ['https://www.lajukan.com/og-image-jobs.png'],
    },
  },
  en: {
    title: 'Lajukan Business Briefs | Fast Operational Needs',
    description:
      'Open business briefs, operational requests, and fast team needs on Lajukan.',
    keywords: [
      'msme briefs',
      'operational support',
      'marketplace admin',
      'business requests',
      'fast hiring',
    ],
    alternates: {
      canonical: 'https://www.lajukan.com/en/jobs',
      languages: {
        'id-ID': 'https://www.lajukan.com/id/jobs',
        'en-US': 'https://www.lajukan.com/en/jobs',
        'x-default': 'https://www.lajukan.com/en/jobs',
      },
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: 'Lajukan Business Briefs | Fast Operational Needs',
      description:
        'Search business briefs, operational requests, and fast execution needs on Lajukan.',
      url: 'https://www.lajukan.com/en/jobs',
      type: 'website',
      siteName: 'Lajukan',
      locale: 'en_US',
      images: ['https://www.lajukan.com/og-image-jobs.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Lajukan Business Briefs | Fast Operational Needs',
      description:
        'Search business briefs, operational requests, and fast execution needs on Lajukan.',
      images: ['https://www.lajukan.com/og-image-jobs.png'],
    },
  },
};

// Generate metadata
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return METADATA_BY_LOCALE[locale] || METADATA_BY_LOCALE['id'];
}

// Layout component
export default async function JobsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!METADATA_BY_LOCALE[locale]) notFound();

  // Bisa tambahkan div wrapper khusus halaman jobs jika mau styling atau container
  return <div className="w-full">{children}</div>;
}
