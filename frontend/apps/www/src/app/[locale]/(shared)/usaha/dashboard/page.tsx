import { redirect } from 'next/navigation';
import { buildUsahaPath } from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function UsahaDashboardPage({ params }: PageProps) {
  const { locale } = await params;
  redirect(`/${locale}${buildUsahaPath('home')}`);
}
