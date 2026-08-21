import '@/styles/globals.css';
import '@/styles/ux-overhaul-foundation.css';
import 'leaflet/dist/leaflet.css';

import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import Script from 'next/script';
import type { ReactNode } from 'react';

import { Providers } from '@/components/Providers';
import ScrollToTop from '@/components/common/ScrollToTop';
import {
  organizationSchema,
  rootMetadata,
  rootViewport,
  websiteSchema,
} from '@/config/siteMetadata';
import { isSupportedLanguage } from '@/lib/languagePreference';
import { serializeJsonLd } from '@/lib/seo/jsonLd';
import { EARLY_THEME_SCRIPT } from '@/lib/theme/earlyThemeScript';
import { EARLY_VIEWPORT_SCRIPT } from '@/lib/viewport/earlyViewportScript';

export const metadata: Metadata = rootMetadata;
export const viewport: Viewport = rootViewport;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const requestLocale = requestHeaders.get('x-lajukan-locale');
  const localeCookie =
    cookieStore.get('NEXT_LOCALE')?.value ?? cookieStore.get('locale')?.value;
  const htmlLang = isSupportedLanguage(requestLocale)
    ? requestLocale
    : isSupportedLanguage(localeCookie)
      ? localeCookie
      : 'id';

  return (
    <html lang={htmlLang} className="overflow-x-hidden" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/Inter-4.1/web/InterVariable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <Script id="viewport-height" strategy="beforeInteractive">
          {EARLY_VIEWPORT_SCRIPT}
        </Script>
        <Script id="theme-preference" strategy="beforeInteractive">
          {EARLY_THEME_SCRIPT}
        </Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteSchema) }}
        />
      </head>
      <body className="app-cohesive-theme m-0 min-h-screen min-h-[var(--app-document-viewport-height)] w-full overflow-x-hidden bg-[color:var(--app-surface-muted)] p-0 font-sans text-[color:var(--app-text)] antialiased">
        <ScrollToTop />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
