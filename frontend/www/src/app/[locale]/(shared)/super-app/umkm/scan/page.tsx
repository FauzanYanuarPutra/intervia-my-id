import { redirect } from 'next/navigation';
import { buildUmkmScanPath } from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function UmkmScanPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const { token } = await searchParams;
  redirect(`/${locale}${buildUmkmScanPath(token)}`);
}
