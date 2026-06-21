import { UsahaOwnerRouteView } from './_components/UsahaOwnerRouteView';
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UsahaPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const view = resolvedSearchParams.view;
  const normalizedView = Array.isArray(view) ? view[0] : view;

  if (normalizedView !== 'list') {
    redirect(`/${locale}/usaha?view=list`);
  }

  return <UsahaOwnerRouteView locale={locale} />;
}
