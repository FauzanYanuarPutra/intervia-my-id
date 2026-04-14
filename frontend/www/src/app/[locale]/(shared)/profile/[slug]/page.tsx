import PublicProfileClient from './PublicProfileClient';

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  return <PublicProfileClient locale={locale} slug={slug} />;
}
