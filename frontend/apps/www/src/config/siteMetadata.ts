import type { Metadata, Viewport } from 'next';

export const SITE_URL = 'https://www.lajukan.com';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image-home.png`;

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
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
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
  name: 'Lajukan',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.svg`,
  sameAs: [SITE_URL],
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Lajukan',
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/id/explore?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};
