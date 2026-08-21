import { notFound, permanentRedirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

function retainSearchParams(input: SearchParams): string {
  const output = new URLSearchParams();

  Object.entries(input).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(item => output.append(key, item));
      return;
    }
    if (typeof value === 'string') output.append(key, value);
  });

  const query = output.toString();
  return query ? `?${query}` : '';
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  if (locale !== 'id' && locale !== 'en') notFound();
  permanentRedirect(
    `/${locale}/explore${retainSearchParams(await searchParams)}`,
  );
}
