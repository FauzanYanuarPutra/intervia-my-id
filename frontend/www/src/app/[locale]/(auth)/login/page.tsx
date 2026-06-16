import { Metadata } from 'next';
import LoginClient from './LoginClient';

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
      ? 'Masuk ke akun Lajukan dengan username dan password.'
      : 'Sign in to your Lajukan account with username and password.',
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
    description: 'Username and password login portal for Lajukan users.',
    publisher: {
      '@type': 'Organization',
      name: 'Lajukan',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LoginClient />
    </>
  );
}
