const PUBLIC_MEDIA_ORIGIN = (
  process.env.NEXT_PUBLIC_LAJUKAN_WEB_ORIGIN || 'https://www.lajukan.com'
).replace(/\/$/, '');

const INTERNAL_MEDIA_PREFIXES = [
  '/api/content/media/',
  '/api/forum/media/',
  '/uploads/',
  '/media/',
] as const;

export function resolveCrmMediaUrl(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^(?:https?:)?\/\//i.test(raw)) {
    return raw.startsWith('//') ? `https:${raw}` : raw;
  }

  if (INTERNAL_MEDIA_PREFIXES.some(prefix => raw.startsWith(prefix))) {
    return `${PUBLIC_MEDIA_ORIGIN}${raw.startsWith('/') ? raw : `/${raw}`}`;
  }

  return raw;
}
