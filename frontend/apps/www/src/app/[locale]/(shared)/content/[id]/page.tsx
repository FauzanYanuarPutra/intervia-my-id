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

  // Public content does not need an auth lookup. Only unpublished content
  // requires an ownership check before we decide whether to expose the editor.
  if (!isActive) {
    const metadata =
      result.content.metadata &&
      typeof result.content.metadata === 'object' &&
      !Array.isArray(result.content.metadata)
        ? (result.content.metadata as Record<string, unknown>)
        : {};
    const ownerId = String(
      result.content.owner_id ||
        (typeof metadata.owner_id === 'string' ? metadata.owner_id : ''),
    )
      .trim()
      .toLowerCase();
    const viewerId = (await getViewerUserId()).trim().toLowerCase();
    const isOwner = Boolean(ownerId && viewerId && ownerId === viewerId);
    if (!isOwner) notFound();

    const contentId = String(result.content.id || id);
    if (isPublicEditorialContent(result.content)) {
      redirect(
        `/${locale}/news/submissions?edit=${encodeURIComponent(contentId)}`,
      );
    }

    redirect(
      `/${locale}/create?draft=${encodeURIComponent(contentId)}`,
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

  const ownerEditHref = isPublicEditorialContent(result.content)
    ? `/news/submissions?edit=${encodeURIComponent(String(result.content.id || id))}`
    : `/create?draft=${encodeURIComponent(String(result.content.id || id))}`;

  return (
    <ContentDetailClient
      contentId={id}
      initialItem={result.content as ContentItem}
      ownerEditHref={ownerEditHref}
    />
  );
}
