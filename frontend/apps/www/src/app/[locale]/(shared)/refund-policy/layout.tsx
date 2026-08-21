import { ReactNode } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

const METADATA_BY_LOCALE: Record<string, Metadata> = {
  id: {
    title: 'Kebijakan Refund & Retur | Lajukan',
    description:
      'Kebijakan pengembalian dana, pembatalan, retur produk, komplain layanan, dan kontak bisnis Lajukan.',
    keywords: [
      'refund lajukan',
      'retur produk',
      'kebijakan pengembalian dana',
      'kontak lajukan',
      'midtrans lajukan',
    ],
    alternates: { canonical: 'https://www.lajukan.com/id/refund-policy' },
    robots: { index: true, follow: true },
  },
  en: {
    title: 'Refund & Return Policy | Lajukan',
    description:
      'Lajukan refund, cancellation, product return, service complaint, and business contact policy.',
    keywords: [
      'lajukan refund',
      'return policy',
      'payment policy',
      'business contact',
      'midtrans lajukan',
    ],
    alternates: { canonical: 'https://www.lajukan.com/en/refund-policy' },
    robots: { index: true, follow: true },
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

export default async function RefundPolicyLayout({
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
