import type { Metadata } from 'next';
import CommunityGroupCreatePageClient from './CommunityGroupCreatePageClient';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === 'id';
  return {
    title: isId ? 'Buat Grup Komunitas | Lajukan' : 'Create Community Group | Lajukan',
    description: isId
      ? 'Buat dan atur grup komunitas usaha di Lajukan.'
      : 'Create and configure a business community group on Lajukan.',
    robots: { index: false, follow: false },
  };
}

export default async function CommunityGroupCreatePage({
  params,
}: PageProps) {
  const { locale } = await params;
  return <CommunityGroupCreatePageClient isId={locale === 'id'} />;
}
