import { notFound, permanentRedirect, redirect } from 'next/navigation';
import {
  getPublicContent,
  getViewerUserId,
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
  const { locale, id } = await params;
  const result = await getPublicContent(id);

  if (result.status === 'not_found') {
    notFound();
  }
  if (result.status === 'unavailable') {
    throw new Error('Marketplace service unavailable');
  }

  const isActive = isPublicContentActive(result.content);
  const ownerId = String(result.content.owner_id || '').trim().toLowerCase();
  const viewerId = (await getViewerUserId()).trim().toLowerCase();
  const isOwner = Boolean(ownerId && viewerId && ownerId === viewerId);

  // Never expose unpublished listings as a public detail surface.
  // Owners go straight back into the authenticated editor.
  if (!isActive) {
    if (!isOwner) notFound();
    redirect(
      `/${locale}/create?draft=${encodeURIComponent(String(result.content.id || id))}`,
    );
  }

  if (
    result.status === 'found' &&
    isActive &&
    isPublicEditorialContent(result.content)
  ) {
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
