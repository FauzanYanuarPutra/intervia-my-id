const PUBLIC_MEDIA_PREFIXES = new Set(['content', 'forum']);

/**
 * Only content and forum objects are intentionally public. Chat and personal
 * AI objects share the bucket, but must stay behind their authenticated
 * proxies even when an object key becomes known.
 */
export function isPublicContentMediaKey(key: string): boolean {
  const segments = key.split('/').filter(Boolean);
  return segments.length >= 2 && PUBLIC_MEDIA_PREFIXES.has(segments[0] ?? '');
}
