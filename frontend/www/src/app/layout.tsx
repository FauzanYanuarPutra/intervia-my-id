// src/app/layout.tsx
import '@/styles/globals.css';
import '@/styles/ux-overhaul-foundation.css';
import 'leaflet/dist/leaflet.css';
import React from 'react';
import { Providers } from '@/components/Providers';
import AutoHideScrollbars from '@/components/common/AutoHideScrollbars';
import ScrollToTop from '@/components/common/ScrollToTop';
import Script from 'next/script';
import { Metadata, Viewport } from 'next';

const SITE_URL = 'https://www.lajukan.com';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image-home.png`;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7FAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export const metadata: Metadata = {
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
  alternates: {
    canonical: SITE_URL,
  },
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
    url: SITE_URL,
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

// Anti flicker dark mode
const DarkModeScript = `
  (function() {
    try {
      const raw = localStorage.getItem('lajukan_theme');
      const legacy = localStorage.getItem('theme');
      const parsed = raw ? JSON.parse(raw) : {};
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const scheme = parsed.colorScheme || (legacy === 'dark' || legacy === 'light' ? legacy : 'system');
      const resolvedDark = scheme === 'dark' || (scheme === 'system' && prefersDark);
      const themePreset = parsed.themePreset || 'default';
      const legacyColor = parsed.colorblindMode && parsed.colorblindMode !== 'none' ? 'colorblind' : null;
      const colorVision = parsed.colorVision || legacyColor || 'none';

      const root = document.documentElement;
      root.classList.toggle('dark', resolvedDark);
      root.setAttribute('data-theme', themePreset);
      root.setAttribute('data-color-vision', colorVision);
    } catch(e) {}
  })();
`;

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Lajukan',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.svg`,
  sameAs: [SITE_URL],
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Lajukan',
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/id/search?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className="scroll-smooth overflow-x-hidden"
      suppressHydrationWarning
    >
      <head>
        {/* Preload semua WOFF2 Fonts Inter */}
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-Thin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-ThinItalic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-ExtraLight.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-ExtraLightItalic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-Light.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-LightItalic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-Italic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-Medium.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-MediumItalic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-SemiBold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-SemiBoldItalic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-Bold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-BoldItalic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-ExtraBold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-ExtraBoldItalic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-Black.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/Inter-BlackItalic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/InterVariable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/InterVariable-Italic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />

        {/* Anti-flicker dark mode */}
        <Script id="dark-mode" strategy="beforeInteractive">
          {DarkModeScript}
        </Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>

      <body className="app-cohesive-theme m-0 min-h-screen w-full overflow-x-hidden bg-[color:var(--app-surface-muted)] p-0 font-sans text-[color:var(--app-text)] antialiased dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]">
        <ScrollToTop />
        <AutoHideScrollbars />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
