import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CreateListingWizard from '../../CreateListingWizard';
import { normalizeCreateFlowSegment } from '../../createPageUtils';
import {
  buildCreateBusinessCategoryHref,
  normalizeCreateBusinessCategorySegment,
} from '../../createBusinessData';

type PageProps = {
  params: Promise<{ locale: string; flow: string; listing: string }>;
};

const TYPE_LABELS: Record<
  string,
  { id: string; en: string; needId: string; needEn: string }
> = {
  product: {
    id: 'produk',
    en: 'products',
    needId: 'supplier dan bahan baku',
    needEn: 'suppliers and raw materials',
  },
  service: {
    id: 'jasa',
    en: 'services',
    needId: 'jasa operasional',
    needEn: 'operations services',
  },
  job: {
    id: 'lowongan',
    en: 'jobs',
    needId: 'talent operasional',
    needEn: 'operations talent',
  },
  property: {
    id: 'properti',
    en: 'property',
    needId: 'lokasi jualan',
    needEn: 'selling locations',
  },
  tool_rental: {
    id: 'sewa alat',
    en: 'tool rental',
    needId: 'alat usaha',
    needEn: 'business tools',
  },
  business_transfer: {
    id: 'oper usaha',
    en: 'business transfer',
    needId: 'usaha berjalan',
    needEn: 'running business',
  },
  company: {
    id: 'profil usaha',
    en: 'business profile',
    needId: 'profil usaha',
    needEn: 'business profile',
  },
};

export default async function CreateFlowListingPage({ params }: PageProps) {
  const { flow, listing } = await params;
  const intent = normalizeCreateFlowSegment(flow);
  const category = normalizeCreateBusinessCategorySegment(listing);
  if (!intent || !category) notFound();

  return <CreateListingWizard entryMode={intent} categoryId={category.id} />;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, flow, listing } = await params;
  const intent = normalizeCreateFlowSegment(flow);
  const category = normalizeCreateBusinessCategorySegment(listing);
  if (!intent || !category) notFound();
  const isId = locale === 'id';
  const sideId = intent === 'demand' ? 'demand' : 'supply';
  const labels = TYPE_LABELS[category.contentType] || {
    id: category.titleId.toLowerCase(),
    en: category.titleEn.toLowerCase(),
    needId: category.titleId.toLowerCase(),
    needEn: category.titleEn.toLowerCase(),
  };
  const canonical = `https://www.lajukan.com/${locale}${buildCreateBusinessCategoryHref(
    {
      locale,
      side: sideId,
      category,
    },
  )}`;

  const title =
    intent === 'demand'
      ? isId
        ? `Cari ${labels.needId} | Lajukan`
        : `Create a ${labels.needEn} brief | Lajukan`
      : isId
        ? `Tawarkan ${labels.id} | Lajukan`
        : `Create a ${labels.en} listing | Lajukan`;
  const description =
    intent === 'demand'
      ? isId
        ? `Tulis kebutuhan ${labels.needId}: detail, area, budget, dan target waktu.`
        : `Create a ${labels.needEn} brief with requirements, area, budget, and business goals on Lajukan.`
      : isId
        ? `Tawarkan ${labels.id}. Isi info penting dulu supaya calon pembeli cepat paham.`
        : `Create a ${labels.en} listing with structured details so buyers, tenants, or partners can understand the offer faster on Lajukan.`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      siteName: 'Lajukan',
      locale: isId ? 'id_ID' : 'en_US',
      images: ['https://www.lajukan.com/og-image-home.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://www.lajukan.com/og-image-home.png'],
    },
  };
}
