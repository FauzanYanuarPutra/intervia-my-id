import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CreatePostingClient from '../CreatePostingClient';
import {
  buildCreateBasePath,
  normalizeCreateFlowSegment,
} from '../createPageUtils';

type PageProps = {
  params: Promise<{ locale: string; flow: string }>;
};

export default async function CreateFlowPage({ params }: PageProps) {
  const { flow } = await params;
  const intent = normalizeCreateFlowSegment(flow);
  if (!intent) notFound();

  return <CreatePostingClient entryMode={intent} forcedListingSide={intent} />;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, flow } = await params;
  const intent = normalizeCreateFlowSegment(flow);
  if (!intent) notFound();
  const isId = locale === 'id';
  const sideId = intent === 'demand' ? 'demand' : 'supply';
  const canonical = `https://www.lajukan.com/${locale}${buildCreateBasePath({
    locale,
    sideId,
  })}`;

  if (intent === 'demand') {
    return {
      title: isId
        ? 'Buat Brief Kebutuhan Usaha | Lajukan'
        : 'Create a Business Need Brief | Lajukan',
      description: isId
        ? 'Pilih kebutuhan: supplier, lokasi, jasa, sewa, atau talent.'
        : 'Choose a brief path for suppliers, selling locations, operations services, rental tools, or hiring talent so your business needs can align faster.',
      alternates: { canonical },
      robots: { index: true, follow: true },
      openGraph: {
        title: isId
          ? 'Buat Brief Kebutuhan Usaha | Lajukan'
          : 'Create a Business Need Brief | Lajukan',
        description: isId
          ? 'Pilih form yang paling pas.'
          : 'Enter the business-needs flow and choose the most relevant supplier, talent, property, service, or rental brief form.',
        url: canonical,
        type: 'website',
        siteName: 'Lajukan',
        locale: isId ? 'id_ID' : 'en_US',
        images: ['https://www.lajukan.com/og-image-home.png'],
      },
    };
  }

  return {
    title: isId
      ? 'Tawarkan Produk, Jasa, atau Lokasi | Lajukan'
      : 'Create a Business Listing | Lajukan',
    description: isId
      ? 'Pilih jenis tawaran: produk, jasa, lokasi, alat sewa, atau oper usaha.'
      : 'Choose the listing type for products, services, property, or rentals you want to offer on Lajukan. For hiring, use the talent brief.',
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: isId
        ? 'Tawarkan Produk, Jasa, atau Lokasi | Lajukan'
        : 'Create a Business Listing | Lajukan',
      description: isId
        ? 'Pilih form tawaran yang paling pas.'
        : 'Enter the sell flow and choose the most relevant product, service, property, or rental listing form.',
      url: canonical,
      type: 'website',
      siteName: 'Lajukan',
      locale: isId ? 'id_ID' : 'en_US',
      images: ['https://www.lajukan.com/og-image-home.png'],
    },
  };
}
