import { notFound, permanentRedirect } from 'next/navigation';
import {
  getPublicContent,
  getPublicEditorialLanguage,
  getPublicEditorialSlug,
  isPublicContentActive,
  isPublicEditorialContent,
} from '@/lib/server/publicContent';
import { buildNewsPath } from '@/lib/news';
import ContentDetailClient, { type ContentItem } from './ContentDetailClient';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function ContentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getPublicContent(id);

  if (
    result.status === 'not_found' ||
    (result.status === 'found' && !isPublicContentActive(result.content))
  ) {
    notFound();
  }
  if (result.status === 'unavailable') {
    throw new Error('Marketplace service unavailable');
  }

  if (result.status === 'found' && isPublicEditorialContent(result.content)) {
    const slug = getPublicEditorialSlug(result.content);
    if (slug) {
      const language = getPublicEditorialLanguage(result.content, locale);
      permanentRedirect(`/${language}${buildNewsPath(slug)}`);
    }
    notFound();
  }

  return (
    <ContentDetailClient
      contentId={id}
      initialItem={result.content as ContentItem}
    />
  );
}
