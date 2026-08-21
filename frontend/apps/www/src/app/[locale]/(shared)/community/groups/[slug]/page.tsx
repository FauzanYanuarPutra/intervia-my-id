import type { Metadata } from 'next';
import CommunityGroupDetailClient from '@/components/community/CommunityGroupDetailClient';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const isId = locale === 'id';
  const cleanSlug = decodeURIComponent(slug);

  return {
    title: isId
      ? `Grup ${cleanSlug} | Komunitas Lajukan`
      : `${cleanSlug} Group | Lajukan Community`,
    description: isId
      ? 'Detail grup komunitas, diskusi, anggota, dan aturan.'
      : 'Community group details, discussions, members, and rules.',
    alternates: {
      canonical: `https://www.lajukan.com/${locale}/community/groups/${encodeURIComponent(cleanSlug)}`,
      languages: {
        id: `https://www.lajukan.com/id/community/groups/${encodeURIComponent(cleanSlug)}`,
        en: `https://www.lajukan.com/en/community/groups/${encodeURIComponent(cleanSlug)}`,
        'x-default': `https://www.lajukan.com/id/community/groups/${encodeURIComponent(cleanSlug)}`,
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function CommunityGroupPage({ params }: PageProps) {
  const { locale, slug } = await params;

  return (
    <CommunityGroupDetailClient
      isId={locale === 'id'}
      slug={decodeURIComponent(slug)}
    />
  );
}
