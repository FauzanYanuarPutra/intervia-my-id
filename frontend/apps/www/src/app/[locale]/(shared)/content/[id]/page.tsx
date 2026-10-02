import { notFound, permanentRedirect, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getPublicContent,
  getViewerUserId,
  getPublicEditorialLanguage,
  getPublicEditorialSlug,
  isPublicContentActive,
  isPublicEditorialContent,
} from '@/lib/server/publicContent';
import { buildNewsPath } from '@/lib/news';
import { getUmkmStoreById, getUmkmStoreBySlug } from '@/lib/super-app/umkm-commerce';
import { isPublicUmkmReferenceVisible } from '@/lib/super-app/umkm-public-discovery';
import ContentDetailClient, { type ContentItem } from './ContentDetailClient';
import {
  normalizeContentMediaUrl,
  resolvePrimaryImage,
  type ContentItem as CatalogContentItem,
} from '@/lib/content/catalog';
import { DEFAULT_OG_IMAGE, SITE_URL } from '@/config/siteMetadata';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

function readMetaText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stripMarkup(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\\s+/g, ' ')
    .trim();
}

function buildShareDescription(content: Record<string, unknown>, locale: string): string {
  const metadata =
    content.metadata && typeof content.metadata === 'object' && !Array.isArray(content.metadata)
      ? (content.metadata as Record<string, unknown>)
      : {};
  const summary = readMetaText(content.summary) || stripMarkup(readMetaText(content.body));
  const location =
    readMetaText(content.location) ||
    readMetaText(content.city) ||
    readMetaText(metadata.location) ||
    readMetaText(metadata.city);
  const category =
    readMetaText(content.category) ||
    readMetaText(content.content_type) ||
    readMetaText(metadata.category) ||
    readMetaText(metadata.marketplace_category_name);
  const side =
    readMetaText(content.listing_side) ||
    readMetaText(content.market_side) ||
    readMetaText(metadata.listing_side) ||
    readMetaText(metadata.market_side);
  const parts = [summary, category, side, location].filter(Boolean);
  const fallback = locale === 'en' ? 'See the complete listing on Lajukan.' : 'Lihat detail lengkapnya di Lajukan.';
  return (parts.join(' · ') || fallback).slice(0, 300);
}

function toPublicImageUrl(raw: string): string {
  const normalized = normalizeContentMediaUrl(raw);
  if (
    !normalized ||
    normalized.startsWith('blob:') ||
    normalized.startsWith('data:')
  ) {
    return '';
  }
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith('//')) return `https:${normalized}`;
  return `${SITE_URL}${normalized.startsWith('/') ? '' : '/'}${normalized}`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const result = await getPublicContent(id);
  if (result.status !== 'found' || !isPublicContentActive(result.content)) {
    return {};
  }

  const content = result.content;
  const title = readMetaText(content.title) || 'Listing di Lajukan';
  const description = buildShareDescription(content, locale);
  const canonicalPath = buildContentHref(
    String(content.id || id),
    title,
    readMetaText(content.slug),
  );
  const canonicalUrl = `${SITE_URL}/${locale}${canonicalPath}`;
  const primaryImage = toPublicImageUrl(
    resolvePrimaryImage(content as CatalogContentItem),
  );
  const imageUrls = primaryImage
    ? [primaryImage, DEFAULT_OG_IMAGE]
    : [DEFAULT_OG_IMAGE];

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Lajukan',
      type: 'website',
      locale: locale === 'en' ? 'en_US' : 'id_ID',
      images: imageUrls.map((url, index) => ({
        url,
        alt: title,
        ...(index === imageUrls.length - 1 && url === DEFAULT_OG_IMAGE
          ? { width: 1200, height: 630 }
          : {}),
      })),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrls,
    },
  };
}

export default async function ContentDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  const result = await getPublicContent(id);

  if (result.status === 'not_found') {
    notFound();
  }
  if (result.status === 'unavailable') {
    notFound();
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

  const referenceMetadata =
    result.content.metadata &&
    typeof result.content.metadata === 'object' &&
    !Array.isArray(result.content.metadata)
      ? (result.content.metadata as Record<string, unknown>)
      : {};
  const isPublicReferenceContent =
    referenceMetadata.is_public_reference === true ||
    String(referenceMetadata.market_side || '').trim().toLowerCase() === 'reference' ||
    String(referenceMetadata.record_kind || '').trim().toLowerCase().includes('reference');

  if (isPublicReferenceContent) {
    const metadataStoreId =
      typeof referenceMetadata.store_id === 'string'
        ? referenceMetadata.store_id.trim()
        : typeof referenceMetadata.umkm_store_id === 'string'
          ? referenceMetadata.umkm_store_id.trim()
          : '';
    const trailingUuidMatch =
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(id);
    const referenceStore =
      (metadataStoreId
        ? await getUmkmStoreById(metadataStoreId).catch(() => null)
        : null) ||
      (trailingUuidMatch
        ? await getUmkmStoreById(trailingUuidMatch[1]).catch(() => null)
        : null) ||
      (await getUmkmStoreBySlug(id).catch(() => null));
    if (referenceStore && isPublicUmkmReferenceVisible(referenceStore)) {
      permanentRedirect('/' + locale + '/toko/' + encodeURIComponent(referenceStore.slug));
    }

    const referenceSlug =
      typeof (result.content as { slug?: unknown }).slug === 'string' &&
      String((result.content as { slug?: unknown }).slug).trim()
        ? String((result.content as { slug?: unknown }).slug).trim()
        : id;

    permanentRedirect(
      '/' +
        locale +
        '/umkm?view=map&store=' +
        encodeURIComponent(referenceSlug),
    );
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
