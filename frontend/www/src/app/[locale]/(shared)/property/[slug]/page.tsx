import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PropertyDetail } from '@/components/ui-kit';
import { MarketPageFrame } from '@/components/marketplace';
import { DetailMobileTopBar } from '@/components/layout/DetailMobileTopBar';
import {
  asNumber,
  asString,
  ContentItem,
  extractContentItems,
  formatIDRFromCents,
  parseImages,
} from '@/lib/content/catalog';

const MARKETPLACE_BASE =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

type PropertyDetailView = {
  id: string;
  slug: string;
  title: string;
  location: string;
  price: string;
  statusType: 'sale' | 'rent' | 'sold';
  type: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  landArea: number;
  certificate: string;
  description: string[];
  features: string[];
  images: string[];
  agent: {
    name: string;
    phone: string;
    photo: string;
    company: string;
  };
};

async function fetchPropertyContent(slug: string): Promise<ContentItem | null> {
  try {
    const byIdRes = await fetch(
      `${MARKETPLACE_BASE}/v1/content/${encodeURIComponent(slug)}`,
      { cache: 'no-store' },
    );
    if (byIdRes.ok) {
      const item = (await byIdRes.json().catch(() => null)) as ContentItem | null;
      if (item?.id) return item;
    }
  } catch {
    // Continue with query fallback.
  }

  try {
    const query = new URLSearchParams({
      type: 'property',
      q: slug,
      limit: '20',
      offset: '0',
    });
    const res = await fetch(`${MARKETPLACE_BASE}/v1/content?${query.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const payload = await res.json().catch(() => []);
    const items = extractContentItems(payload);
    return (
      items.find((item) => item.slug === slug || String(item.id) === slug) || null
    );
  } catch {
    return null;
  }
}

function splitTextBlock(text?: string): string[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function mapToPropertyDetail(item: ContentItem): PropertyDetailView {
  const meta = item.metadata || {};
  const statusRaw = (
    asString(meta.status_type) ||
    asString(meta.listing_type) ||
    asString(meta.transaction_type) ||
    asString(item.category) ||
    ''
  ).toLowerCase();

  let statusType: 'sale' | 'rent' | 'sold' = 'sale';
  if (statusRaw.includes('rent') || statusRaw.includes('sewa')) statusType = 'rent';
  if (statusRaw.includes('sold') || statusRaw.includes('terjual')) statusType = 'sold';

  const images = parseImages(item);
  const features = Array.isArray(meta.features)
    ? (meta.features as Array<unknown>)
        .map((entry) => asString(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];
  const description =
    splitTextBlock(item.body || item.summary || asString(meta.description)) || [];

  return {
    id: String(item.id),
    slug: item.slug || String(item.id),
    title: item.title || item.summary || 'Property Listing',
    location:
      asString(meta.location) || asString(meta.city) || asString(meta.region) || 'Indonesia',
    price:
      formatIDRFromCents(item.price_cents) !== '-'
        ? formatIDRFromCents(item.price_cents)
        : asString(meta.price_label) || 'Negotiable',
    statusType,
    type: asString(meta.property_type) || asString(item.category) || 'Property',
    bedrooms: asNumber(meta.bedrooms) || asNumber(meta.kamar_tidur) || 0,
    bathrooms: asNumber(meta.bathrooms) || asNumber(meta.kamar_mandi) || 0,
    area: asNumber(meta.area) || asNumber(meta.luas) || 0,
    landArea: asNumber(meta.land_area) || asNumber(meta.luas_tanah) || 0,
    certificate: asString(meta.certificate) || '',
    description: description.length ? description : [item.summary || 'No description'],
    features,
    images,
    agent: {
      name: asString(meta.agent_name) || asString(meta.contact_name) || 'Agent',
      phone: asString(meta.agent_phone) || asString(meta.contact_phone) || '',
      photo: asString(meta.agent_photo) || '',
      company: asString(meta.agent_company) || asString(meta.company) || '',
    },
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await fetchPropertyContent(slug);
  if (!item) return { title: 'Property Not Found | Lajukan' };

  const property = mapToPropertyDetail(item);
  return {
    title: `${property.title} | Lajukan Property`,
    description: `${property.location}. ${property.price}.`,
    openGraph: {
      title: property.title,
      description: property.description[0] || '',
      images: property.images.length ? [property.images[0]] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: property.title,
      description: property.description[0] || '',
      images: property.images.length ? [property.images[0]] : [],
    },
  };
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const item = await fetchPropertyContent(slug);
  if (!item) notFound();

  const property = mapToPropertyDetail(item);
  const numericPrice = Math.max(0, Math.floor((item.price_cents || 0) / 100));

  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'RealEstateListing',
    name: property.title,
    description: property.description.join(' '),
    url: `https://lajukan.id/property/${property.slug}`,
    image: property.images,
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.location,
      addressCountry: 'ID',
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'IDR',
      price: numericPrice || undefined,
      availability:
        property.statusType === 'sold'
          ? 'https://schema.org/SoldOut'
          : 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: property.agent.company || property.agent.name,
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketPageFrame
        variant="detail"
        className="lajukan-market-property"
        contentClassName="pb-2"
      >
        <DetailMobileTopBar
          title={property.title}
          eyebrow={locale === 'id' ? 'Detail lokasi' : 'Property detail'}
          backLabel={locale === 'id' ? 'Kembali' : 'Back'}
        />
        <PropertyDetail property={property} />
      </MarketPageFrame>
    </>
  );
}

