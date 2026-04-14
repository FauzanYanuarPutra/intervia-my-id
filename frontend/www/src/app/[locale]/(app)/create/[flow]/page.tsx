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
        ? 'Pilih jalur brief untuk supplier, lokasi jualan, jasa operasional, alat sewa, atau hiring talent agar kebutuhan usaha Anda lebih cepat nyambung.'
        : 'Choose a brief path for suppliers, selling locations, operations services, rental tools, or hiring talent so your business needs can align faster.',
      alternates: { canonical },
      robots: { index: true, follow: true },
      openGraph: {
        title: isId
          ? 'Buat Brief Kebutuhan Usaha | Lajukan'
          : 'Create a Business Need Brief | Lajukan',
        description: isId
          ? 'Masuk ke jalur kebutuhan usaha dan pilih form supplier, talent, lokasi, jasa, atau alat sewa yang paling tepat.'
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
      ? 'Buat Listing Jualan Usaha | Lajukan'
      : 'Create a Business Listing | Lajukan',
    description: isId
      ? 'Pilih tipe listing untuk produk, jasa, properti, atau alat sewa yang ingin Anda tawarkan di Lajukan. Untuk hiring, gunakan brief talent.'
      : 'Choose the listing type for products, services, property, or rentals you want to offer on Lajukan. For hiring, use the talent brief.',
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: isId
        ? 'Buat Listing Jualan Usaha | Lajukan'
        : 'Create a Business Listing | Lajukan',
      description: isId
        ? 'Masuk ke jalur jual dan pilih form listing produk, jasa, properti, atau rental yang paling sesuai.'
        : 'Enter the sell flow and choose the most relevant product, service, property, or rental listing form.',
      url: canonical,
      type: 'website',
      siteName: 'Lajukan',
      locale: isId ? 'id_ID' : 'en_US',
      images: ['https://www.lajukan.com/og-image-home.png'],
    },
  };
}
