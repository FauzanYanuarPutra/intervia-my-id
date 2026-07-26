import { Metadata } from 'next';
import GoogleAuthOnlyClient from '../GoogleAuthOnlyClient';
import { serializeJsonLd } from '@/lib/seo/jsonLd';

type Props = {
  params: Promise<{ locale: string }>;
};

// 1. GENERATE METADATA (Server Side)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === 'id';
  const baseUrl = 'https://www.lajukan.com';

  return {
    title: isId ? 'Masuk - Lajukan' : 'Login - Lajukan',
    description: isId
      ? 'Masuk atau daftar Lajukan dengan Google.'
      : 'Sign in or register for Lajukan with Google.',
    alternates: {
      canonical: `${baseUrl}/${locale}/login`,
      languages: {
        'id-ID': `${baseUrl}/id/login`,
        'en-US': `${baseUrl}/en/login`,
        'x-default': `${baseUrl}/id/login`,
      },
    },
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
        noarchive: true,
      },
    },
  };
}

export default async function LoginPage() {
  // 2. JSON-LD (Structured Data untuk Google)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LoginPage',
    name: 'Lajukan Login',
    description: 'Google login portal for Lajukan users.',
    publisher: {
      '@type': 'Organization',
      name: 'Lajukan',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <GoogleAuthOnlyClient mode="login" />
    </>
  );
}
