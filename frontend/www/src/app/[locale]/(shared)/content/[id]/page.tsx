import { notFound } from 'next/navigation';
import {
  getPublicContent,
  isPublicContentActive,
} from '@/lib/server/publicContent';
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

  return (
    <ContentDetailClient
      contentId={id}
      initialItem={result.content as ContentItem}
    />
  );
}
