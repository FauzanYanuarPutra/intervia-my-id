import { redirect } from 'next/navigation';
import { UMKM_DISCOVERY_PATH } from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{ locale: string; service: string }>;
};

function targetForService(service: string): string {
  switch (service) {
    case 'mart':
      return '/search?type=product&q=bahan%20baku%20kemasan';
    case 'send':
      return '/search?type=service&q=jasa%20pengiriman%20usaha';
    case 'ride':
      return '/search?type=service&q=kurir%20pickup%20usaha';
    case 'car':
      return '/search?type=product&q=grosir%20usaha';
    case 'food':
      return `${UMKM_DISCOVERY_PATH}?q=kuliner`;
    case 'services':
      return '/search?type=service&q=jasa%20operasional%20umkm';
    default:
      return '/home';
  }
}

export default async function LegacySuperAppServicePage({ params }: PageProps) {
  const { locale, service } = await params;
  redirect(`/${locale}${targetForService(service)}`);
}
