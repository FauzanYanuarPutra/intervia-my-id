import { redirect } from 'next/navigation';
import { UsahaOwnerRouteView } from './_components/UsahaOwnerRouteView';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UsahaPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;

  const view = resolvedSearchParams.view;
  const normalizedView = Array.isArray(view) ? view[0] : view;

  if (normalizedView !== 'list') {
    redirect(`/${locale}/usaha?view=list`);
  }

  return (
    <main className="min-h-0 w-full min-w-0">
      <div className="page-shell w-full min-w-0 py-4 sm:py-5 lg:py-6">
        <UsahaOwnerRouteView locale={locale} />
      </div>
    </main>
  );
}