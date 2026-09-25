import type { Metadata } from 'next';
import CommunityGroupDirectoryClient from '@/components/community/CommunityGroupDirectoryClient';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === 'id';

  return {
    title: isId ? 'Grup Komunitas | Lajukan' : 'Community Groups | Lajukan',
    description: isId
      ? 'Temukan, gabung, dan buat grup komunitas usaha di Lajukan.'
      : 'Discover, join, and create business communities on Lajukan.',
    alternates: {
      canonical: `https://www.lajukan.com/${locale}/community/groups`,
      languages: {
        id: 'https://www.lajukan.com/id/community/groups',
        en: 'https://www.lajukan.com/en/community/groups',
        'x-default': 'https://www.lajukan.com/id/community/groups',
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function CommunityGroupsPage({ params }: PageProps) {
  const { locale } = await params;
  return <CommunityGroupDirectoryClient isId={locale === 'id'} />;
}
