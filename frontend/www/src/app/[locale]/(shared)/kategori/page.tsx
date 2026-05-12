import { CategoryLandingClient } from '@/components/category/CategoryLandingClient';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <CategoryLandingClient
      isId={locale === 'id'}
      initialQuery={resolvedSearchParams.q || ''}
    />
  );
}
