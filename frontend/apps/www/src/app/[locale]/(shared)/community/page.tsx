import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import CommunityFeedClient from '@/components/community/CommunityFeedClient';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === 'id';

  return {
    title: isId
      ? 'Komunitas Usaha Indonesia | Lajukan'
      : 'Business Community | Lajukan',
    description: isId
      ? 'Diskusi supplier, operasional, jualan, dan UMKM.'
      : 'Practical discussions for suppliers, operations, sales channels, and small business growth.',
    alternates: {
      canonical: `https://www.lajukan.com/${locale}/community`,
      languages: {
        id: 'https://www.lajukan.com/id/community',
        en: 'https://www.lajukan.com/en/community',
        'x-default': 'https://www.lajukan.com/id/community',
      },
    },
    robots: { index: true, follow: true },
  };
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

export default async function CommunityPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const query = searchParams ? await searchParams : {};
  const legacyGroup = firstParam(query.group);
  if (legacyGroup) {
    redirect(
      `/${locale}/community/groups/${encodeURIComponent(legacyGroup.trim())}`,
    );
  }

  return <CommunityFeedClient isId={locale === 'id'} />;
}
