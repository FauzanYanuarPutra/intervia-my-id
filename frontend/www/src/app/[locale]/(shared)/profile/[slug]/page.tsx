import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import {
  getPublicProfileSocial,
  resolvePublicProfile,
} from '@/lib/server/publicProfile';
import PublicProfileClient from './PublicProfileClient';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const result = await resolvePublicProfile(slug);
  if (result.status !== 'found') {
    return {
      title:
        locale === 'id'
          ? 'Profil tidak ditemukan | Lajukan'
          : 'Profile not found | Lajukan',
      robots: { index: false, follow: true },
    };
  }

  const name =
    readString(result.profile.full_name) ||
    readString(result.profile.username) ||
    (locale === 'id' ? 'Profil pengguna' : 'User profile');
  const bio =
    readString(result.profile.bio) ||
    readString(result.profile.headline) ||
    (locale === 'id'
      ? `Lihat profil publik ${name} di Lajukan.`
      : `View ${name}'s public profile on Lajukan.`);
  const canonical = `https://www.lajukan.com/${locale}/profile/${result.canonicalSlug}`;

  return {
    title: `${name} | Lajukan`,
    description: bio.slice(0, 160),
    alternates: {
      canonical,
      languages: {
        id: `https://www.lajukan.com/id/profile/${result.canonicalSlug}`,
        en: `https://www.lajukan.com/en/profile/${result.canonicalSlug}`,
        'x-default': `https://www.lajukan.com/id/profile/${result.canonicalSlug}`,
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { locale, slug } = await params;
  const result = await resolvePublicProfile(slug);

  if (result.status === 'not_found') notFound();
  if (result.status === 'unavailable') {
    return <PublicProfileClient locale={locale} slug={slug} />;
  }
  if (slug !== result.canonicalSlug) {
    permanentRedirect(`/${locale}/profile/${result.canonicalSlug}`);
  }

  const social = await getPublicProfileSocial(readString(result.profile.id));

  return (
    <PublicProfileClient
      locale={locale}
      slug={slug}
      initialProfile={result.profile}
      initialSocial={social}
    />
  );
}
