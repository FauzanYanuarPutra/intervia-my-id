import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function ListingAliasPage({ params }: PageProps) {
  const { locale, id } = await params;
  redirect(`/${locale}/content/${encodeURIComponent(id)}`);
}
