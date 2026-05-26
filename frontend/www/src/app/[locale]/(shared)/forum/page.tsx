import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;

  return {
    alternates: {
      canonical: `https://www.lajukan.com/${locale}/community`,
      languages: {
        id: 'https://www.lajukan.com/id/community',
        en: 'https://www.lajukan.com/en/community',
        'x-default': 'https://www.lajukan.com/id/community',
      },
    },
    robots: { index: false, follow: true },
  };
}

function encodeSearchParams(input: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item) params.append(key, item);
      });
      continue;
    }
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export default async function ForumPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const query = searchParams ? encodeSearchParams(await searchParams) : '';
  permanentRedirect(`/${locale}/community${query}`);
}
