import type { Metadata } from 'next';

const SITE_URL = 'https://www.lajukan.com';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

const AVAILABILITY: Record<string, string> = {
  in_stock: 'https://schema.org/InStock',
  instock: 'https://schema.org/InStock',
  available: 'https://schema.org/InStock',
  out_of_stock: 'https://schema.org/OutOfStock',
  outofstock: 'https://schema.org/OutOfStock',
  sold_out: 'https://schema.org/SoldOut',
  soldout: 'https://schema.org/SoldOut',
  preorder: 'https://schema.org/PreOrder',
  pre_order: 'https://schema.org/PreOrder',
  backorder: 'https://schema.org/BackOrder',
  back_order: 'https://schema.org/BackOrder',
};

function normalizeAvailability(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[\s-]+/g, '_')
    : '';
}

export function schemaAvailabilityFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!metadata) return undefined;
  const candidates = [
    metadata.availability,
    metadata.stock_status,
    metadata.stockStatus,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeAvailability(candidate);
    if (normalized && AVAILABILITY[normalized]) return AVAILABILITY[normalized];
  }
  return undefined;
}

export function buildPublicProfileMetadata({
  locale,
  canonicalSlug,
  name,
  description,
  imageUrl,
}: {
  locale: string;
  canonicalSlug: string;
  name: string;
  description: string;
  imageUrl?: string;
}): Metadata {
  const safeLocale = locale === 'en' ? 'en' : 'id';
  const canonical = `${SITE_URL}/${safeLocale}/profile/${canonicalSlug}`;
  const idUrl = `${SITE_URL}/id/profile/${canonicalSlug}`;
  const enUrl = `${SITE_URL}/en/profile/${canonicalSlug}`;
  const title = `${name} | Lajukan`;
  const image = imageUrl || DEFAULT_IMAGE;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: {
      canonical,
      languages: { id: idUrl, en: enUrl, 'x-default': idUrl },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Lajukan',
      type: 'profile',
      locale: safeLocale === 'id' ? 'id_ID' : 'en_US',
      alternateLocale: safeLocale === 'id' ? ['en_US'] : ['id_ID'],
      images: [{ url: image, alt: name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: { index: true, follow: true },
  };
}
