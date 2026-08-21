const LAJUKAN_PUBLIC_HOSTS = new Set(['lajukan.com', 'www.lajukan.com']);

function canonicalContentPath(pathname: string): string | null {
  const match = pathname.match(/^\/(?:(?:id|en)\/)?content\/([^/?#]+)\/?$/i);
  const contentId = match?.[1]?.trim();
  if (!contentId || contentId === '.' || contentId === '..') return null;

  try {
    const decodedId = decodeURIComponent(contentId).trim();
    if (!decodedId || decodedId === '.' || decodedId === '..') return null;
    return `/content/${encodeURIComponent(decodedId)}`;
  } catch {
    return null;
  }
}

/**
 * Reels may only advertise a transaction/listing CTA for Lajukan's canonical
 * content detail route. Arbitrary URLs and generic fallbacks must never look
 * like a verified product checkout.
 */
export function resolveCanonicalReelContentHref(
  value: string | null | undefined,
  locale: string,
): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  let pathname = raw;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      if (!LAJUKAN_PUBLIC_HOSTS.has(url.hostname.toLowerCase())) return null;
      pathname = url.pathname;
    } else if (!raw.startsWith('/')) {
      return null;
    } else {
      pathname = raw.split(/[?#]/, 1)[0] || '';
    }
  } catch {
    return null;
  }

  const contentPath = canonicalContentPath(pathname);
  if (!contentPath) return null;
  const safeLocale = locale === 'en' ? 'en' : 'id';
  return `/${safeLocale}${contentPath}`;
}
