import type { Metadata, Viewport } from 'next';

export const SITE_URL = 'https://www.lajukan.com';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph-image.png`;
export const BRAND_LOGO = `${SITE_URL}/favicon.png`;

export const rootViewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#F7FAF7',
};

export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'Lajukan',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
    shortcut: [{ url: '/favicon.png', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/favicon.png', sizes: '512x512', type: 'image/png' }],
  },
  title: {
    default: 'Lajukan | Supply, Sourcing, dan Operasional Usaha',
    template: '%s | Lajukan',
  },
  description:
    'Cari supplier, jasa, lokasi jualan, dan bantuan operasional usaha dalam satu tempat.',
  keywords: [
    'lajukan',
    'supplier umkm',
    'distributor indonesia',
    'sourcing umkm',
    'barang jual ulang',
    'bahan baku usaha',
    'reseller indonesia',
    'dropship supplier',
    'sewa alat usaha',
    'jasa operasional umkm',
    'freelancer umkm',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    siteName: 'Lajukan',
    title: 'Lajukan | Supply, Sourcing, dan Operasional Usaha',
    description:
      'Cari supplier, jasa, lokasi jualan, dan bantuan usaha dalam satu tempat.',
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Lajukan - Supply dan Operasional Usaha',
      },
    ],
    locale: 'id_ID',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lajukan | Supply, Sourcing, dan Operasional Usaha',
    description:
      'Cari supplier, jasa, lokasi jualan, dan bantuan usaha di Lajukan.',
    images: [DEFAULT_OG_IMAGE],
  },
};

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'Lajukan',
  alternateName: 'Lajukan',
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: BRAND_LOGO,
    contentUrl: BRAND_LOGO,
    width: 512,
    height: 512,
  },
  image: BRAND_LOGO,
  sameAs: [SITE_URL],
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: 'Lajukan',
  url: SITE_URL,
  image: BRAND_LOGO,
  publisher: { '@id': `${SITE_URL}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/id/explore?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};
