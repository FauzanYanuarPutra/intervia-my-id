import type { Metadata } from 'next';

const SITE_URL = 'https://www.lajukan.com';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image-home.png`;

type BuildPublicPageMetadataOptions = {
  locale: string;
  path: `/${string}`;
  titleId: string;
  titleEn: string;
  descriptionId: string;
  descriptionEn: string;
  imageUrl?: string;
};

export function buildPublicPageMetadata({
  locale,
  path,
  titleId,
  titleEn,
  descriptionId,
  descriptionEn,
  imageUrl = DEFAULT_OG_IMAGE,
}: BuildPublicPageMetadataOptions): Metadata {
  const isId = locale === 'id';
  const lang = isId ? 'id' : 'en';
  const title = isId ? titleId : titleEn;
  const description = isId ? descriptionId : descriptionEn;
  const canonical = `${SITE_URL}/${lang}${path}`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: {
      canonical,
      languages: {
        id: `${SITE_URL}/id${path}`,
        en: `${SITE_URL}/en${path}`,
        'x-default': `${SITE_URL}/id${path}`,
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Lajukan',
      type: 'website',
      locale: isId ? 'id_ID' : 'en_US',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}
