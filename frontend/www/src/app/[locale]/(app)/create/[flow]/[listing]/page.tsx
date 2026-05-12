import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import CreatePostingClient from '../../CreatePostingClient';
import { buildUsahaPath } from '@/lib/umkmSurface';
import {
  buildCreateBasePath,
  normalizeCreateFlowSegment,
  normalizeCreateTypeSegment,
} from '../../createPageUtils';

type PageProps = {
  params: Promise<{ locale: string; flow: string; listing: string }>;
};

const DEMAND_CREATE_TYPE_IDS = new Set([
  'product',
  'service',
  'job',
  'property',
  'tool_rental',
]);
const SUPPLY_CREATE_TYPE_IDS = new Set([
  'product',
  'service',
  'property',
  'tool_rental',
]);

function isTypeAllowedForIntent(intent: 'demand' | 'supply', typeId: string): boolean {
  return intent === 'demand'
    ? DEMAND_CREATE_TYPE_IDS.has(typeId)
    : SUPPLY_CREATE_TYPE_IDS.has(typeId);
}

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
  company: {
    id: 'profil usaha',
    en: 'business profile',
    needId: 'profil usaha',
    needEn: 'business profile',
  },
};

export default async function CreateFlowListingPage({ params }: PageProps) {
  const { locale, flow, listing } = await params;
  const intent = normalizeCreateFlowSegment(flow);
  const typeId = normalizeCreateTypeSegment(listing);
  if (intent === 'supply' && typeId === 'company') {
    redirect(buildUsahaPath('onboarding'));
  }
  if (!intent || !typeId || !isTypeAllowedForIntent(intent, typeId)) notFound();

  return (
    <CreatePostingClient
      entryMode={intent}
      forcedListingSide={intent}
      forcedTypeId={typeId}
    />
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, flow, listing } = await params;
  const intent = normalizeCreateFlowSegment(flow);
  const typeId = normalizeCreateTypeSegment(listing);
  if (intent === 'supply' && typeId === 'company') {
    return {
      alternates: {
        canonical: buildUsahaPath('onboarding'),
      },
      robots: { index: false, follow: true },
    };
  }
  if (!intent || !typeId || !isTypeAllowedForIntent(intent, typeId)) notFound();
  const isId = locale === 'id';
  const sideId = intent === 'demand' ? 'demand' : 'supply';
  const labels = TYPE_LABELS[typeId];
  const canonical = `https://www.lajukan.com/${locale}${buildCreateBasePath({
    locale,
    sideId,
    typeId,
  })}`;

  const title =
    intent === 'demand'
      ? isId
        ? `Buat Brief ${labels.needId} | Lajukan`
        : `Create a ${labels.needEn} brief | Lajukan`
      : isId
        ? `Buat Listing ${labels.id} | Lajukan`
        : `Create a ${labels.en} listing | Lajukan`;
  const description =
    intent === 'demand'
      ? isId
        ? `Buat brief ${labels.needId} dengan detail kebutuhan, area, budget, dan target bisnis di Lajukan.`
        : `Create a ${labels.needEn} brief with requirements, area, budget, and business goals on Lajukan.`
      : isId
        ? `Buat listing ${labels.id} dengan detail yang rapi agar pembeli, tenant, atau partner cepat paham penawaran Anda di Lajukan.`
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
