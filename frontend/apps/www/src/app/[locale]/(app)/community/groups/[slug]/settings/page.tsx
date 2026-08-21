import type { Metadata } from 'next';
import CommunityGroupSettingsPageClient from './CommunityGroupSettingsPageClient';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'id' ? 'Pengaturan Grup | Lajukan' : 'Group Settings | Lajukan',
    robots: { index: false, follow: false },
  };
}

export default async function CommunityGroupSettingsPage({ params }: PageProps) {
  const { locale, slug } = await params;
  return (
    <CommunityGroupSettingsPageClient
      isId={locale === 'id'}
      slug={decodeURIComponent(slug)}
    />
  );
}
