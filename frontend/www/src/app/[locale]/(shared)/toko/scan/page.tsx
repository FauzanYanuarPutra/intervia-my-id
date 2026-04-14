import { UmkmScanClient } from '@/components/super-app/UmkmScanClient';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TokoScanPage({ params }: PageProps) {
  const { locale } = await params;
  return <UmkmScanClient locale={locale} isId={locale === 'id'} />;
}
