import { redirect } from 'next/navigation';
import { buildUmkmStorefrontPath } from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function UmkmStorefrontPage({ params }: PageProps) {
  const { locale, slug } = await params;
  redirect(`/${locale}${buildUmkmStorefrontPath(slug)}`);
}
