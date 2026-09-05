import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { ReactNode } from 'react';

async function getMessages(locale: string) {
  try {
    const [homeMessages, industryMessages] = await Promise.all([
      import(`@/messages/home/${locale}.json`).then(m => m.default),
      import(`@/messages/industries/${locale}.json`).then(m => m.default),
    ]);
    return { ...homeMessages, ...industryMessages };
  } catch (error) {
    console.error('Error loading messages:', error);
    notFound();
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isId = locale === 'id';
  const canonical = `https://www.lajukan.com/${locale}/home`;
  const title = isId
    ? 'Lajukan — Cari Supplier, Jasa & Kebutuhan Usaha'
    : 'Lajukan — Find Suppliers, Services & Business Needs';
  const description = isId
    ? 'Cari supplier, bahan, jasa, mesin, tempat usaha, peluang, dan kebutuhan pembeli. Jika belum ketemu, pasang kebutuhan agar penyedia yang tepat menemukanmu.'
    : 'Find suppliers, materials, services, equipment, business locations, opportunities, and buyer needs. Post a need when you cannot find the right match.';

  return {
    title,
    description,
    keywords: isId
      ? ['lajukan', 'supplier usaha', 'bahan usaha', 'jasa usaha', 'mesin usaha', 'tempat usaha', 'kebutuhan pembeli']
      : ['lajukan', 'business suppliers', 'business services', 'business equipment', 'business needs'],
    robots: { index: true, follow: true },
    alternates: {
      canonical,
      languages: {
        'id-ID': 'https://www.lajukan.com/id/home',
        'en-US': 'https://www.lajukan.com/en/home',
        'x-default': 'https://www.lajukan.com/id/home',
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Lajukan',
      type: 'website',
      locale: isId ? 'id_ID' : 'en_US',
      images: [{ url: 'https://www.lajukan.com/og-image-home.png', width: 1200, height: 630, alt: isId ? 'Lajukan — jelas kebutuhannya, tepat mitranya' : 'Lajukan — clear needs, the right business match' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['https://www.lajukan.com/og-image-home.png'] },
  };
}

export default async function HomeLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  return <NextIntlClientProvider locale={locale} messages={messages}>{children}</NextIntlClientProvider>;
}
