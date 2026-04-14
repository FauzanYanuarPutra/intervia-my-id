import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function buildQuery(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(searchParams)) {
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        if (typeof value === 'string' && value.trim()) {
          params.append(key, value);
        }
      }
      continue;
    }
    if (typeof rawValue === 'string' && rawValue.trim()) {
      params.set(key, rawValue);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;

  return {
    alternates: {
      canonical: `https://www.lajukan.com/${locale}/toko/${encodeURIComponent(slug)}`,
    },
  };
}

export default async function UmkmSlugAliasPage({
  params,
  searchParams,
}: PageProps) {
  const { locale, slug } = await params;
  const resolvedSearchParams = await searchParams;
  redirect(
    `/${locale}/toko/${encodeURIComponent(slug)}${buildQuery(resolvedSearchParams)}`,
  );
}
