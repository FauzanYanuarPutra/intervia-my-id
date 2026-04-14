const CONTENT_UUID_PATTERN =
  /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;

export function slugifyContentTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function normalizeStoredSlug(value: string): string {
  return value
    .trim()
    .replace(CONTENT_UUID_PATTERN, '')
    .replace(/-+$/, '')
    .replace(/[^a-z0-9\s-]/gi, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 80);
}

export function extractContentId(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  const match = raw.match(CONTENT_UUID_PATTERN);
  return match ? match[1] : raw;
}

export function buildContentHref(
  contentId: unknown,
  title?: string | null,
  slug?: string | null,
): string {
  const normalizedId = extractContentId(contentId);
  const normalizedSlug =
    typeof slug === 'string' ? normalizeStoredSlug(slug) : '';

  if (normalizedSlug && normalizedId) {
    return `/content/${normalizedSlug}-${normalizedId}`;
  }
  if (normalizedId) {
    return `/content/${slugifyContentTitle(title || 'listing')}-${normalizedId}`;
  }
  return '/search';
}
