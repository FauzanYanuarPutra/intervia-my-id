import type { Metadata } from 'next';
import CreateMarketplaceShell from './CreateMarketplaceShell';

type LayoutProps = {
  children: React.ReactNode;
};

export default function CreateLayout({ children }: LayoutProps) {
  return <CreateMarketplaceShell>{children}</CreateMarketplaceShell>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === 'id';
  const canonical = `https://www.lajukan.com/${locale}/create`;

  return {
    title: isId
      ? 'Buat Listing atau Brief | Lajukan'
      : 'Create a Listing or Brief | Lajukan',
    description: isId
      ? 'Pilih dulu: mau cari supplier, talent, lokasi, jasa, atau alat sewa; atau mau pasang produk, jasa, lokasi, dan rental.'
      : 'Choose whether you need suppliers, talent, spaces, services, or rental tools, or want to publish products, services, spaces, and rentals on Lajukan.',
    alternates: {
      canonical,
      languages: {
        'id-ID': 'https://www.lajukan.com/id/create',
        'en-US': 'https://www.lajukan.com/en/create',
        'x-default': 'https://www.lajukan.com/id/create',
      },
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: isId
        ? 'Buat Listing atau Brief | Lajukan'
        : 'Create a Listing or Brief | Lajukan',
      description: isId
        ? 'Masuk ke jalur cari atau jual, lalu lanjut ke form supplier, talent, rental, lokasi, atau jasa yang paling cocok.'
        : 'Start from the need or sell flow, then continue to the supplier, talent, rental, property, or service form that fits best.',
      url: canonical,
      type: 'website',
      siteName: 'Lajukan',
      locale: isId ? 'id_ID' : 'en_US',
      images: ['https://www.lajukan.com/og-image-home.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: isId
        ? 'Buat Listing atau Brief | Lajukan'
        : 'Create a Listing or Brief | Lajukan',
      description: isId
        ? 'Pilih jalur cari atau jual, lalu lanjut ke form supplier, talent, rental, lokasi, atau jasa.'
        : 'Choose the need or sell path, then continue to the best-fit supplier, talent, rental, location, or service form.',
      images: ['https://www.lajukan.com/og-image-home.png'],
    },
  };
}
