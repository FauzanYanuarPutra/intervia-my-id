export function buildLocalizedHref(locale: string, href: string) {
  const value = href.trim() || '/home';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith(`/${locale}/`) || value === `/${locale}`) return value;
  if (value.startsWith('/')) return `/${locale}${value}`;
  return `/${locale}/${value}`;
}

export function appendHrefQuery(href: string, key: string, value: string) {
  if (/^https?:\/\//i.test(href)) {
    const url = new URL(href);
    url.searchParams.set(key, value);
    return url.toString();
  }

  const [path, hash = ''] = href.split('#');
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${
    hash ? `#${hash}` : ''
  }`;
}

export function formatReelCommentTime(
  value: string,
  locale: string,
  now = Date.now(),
) {
  const isId = locale === 'id';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return isId ? 'Baru saja' : 'Just now';

  const diffMinutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000));
  if (diffMinutes < 1) return isId ? 'Baru saja' : 'Just now';

  const formatter = new Intl.RelativeTimeFormat(isId ? 'id-ID' : 'en-US', {
    numeric: 'always',
    style: 'short',
  });
  if (diffMinutes < 60) return formatter.format(-diffMinutes, 'minute');

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return formatter.format(-diffHours, 'hour');

  return date.toLocaleDateString(isId ? 'id-ID' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function isReelImageUrl(value: string) {
  const lower = value.split(/[?#]/)[0]?.toLowerCase() || '';
  return /\.(avif|gif|jpe?g|png|webp)$/.test(lower);
}

export function isDirectReelVideoUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const path = trimmed.split(/[?#]/)[0]?.toLowerCase() || '';
  if (!/\.(mov|mp4|m4v|ogv|webm)$/.test(path)) return false;

  if (trimmed.startsWith('/')) return true;

  try {
    const url = new URL(trimmed);
    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && url.hostname === 'localhost')
    );
  } catch {
    return false;
  }
}
