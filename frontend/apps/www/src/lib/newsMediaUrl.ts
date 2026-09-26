import { normalizeSafeExternalHttpUrl } from 'lajukan-ui';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.lajukan.com').replace(/\/+$/, '');

const SAFE_RELATIVE_PREFIXES = [
  '/api/content/media/',
  '/uploads/content/',
] as const;

function isSafeRelativeNewsMediaUrl(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  try {
    const parsed = new URL(value, 'https://www.lajukan.com');
    if (parsed.origin !== 'https://www.lajukan.com') return false;
    if (!SAFE_RELATIVE_PREFIXES.some(prefix => parsed.pathname.startsWith(prefix))) {
      return false;
    }
    const decodedPath = decodeURIComponent(parsed.pathname);
    return !decodedPath.split('/').some(segment => segment === '..');
  } catch {
    return false;
  }
}

function normalizeLegacyContentMediaUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map(segment => decodeURIComponent(segment));
    const bucketIndex = segments.findIndex(segment => segment === 'laju-chat');
    if (bucketIndex < 0) return null;

    const key = segments.slice(bucketIndex + 1);
    if (
      key.length < 2 ||
      key[0] !== 'content' ||
      key.some(segment => !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/.test(segment))
    ) {
      return null;
    }

    return `/api/content/media/laju-chat/${key.map(encodeURIComponent).join('/')}`;
  } catch {
    return null;
  }
}

export function normalizeNewsMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (!clean) return null;
  if (isSafeRelativeNewsMediaUrl(clean)) return clean;

  const legacyCanonical = normalizeLegacyContentMediaUrl(clean);
  if (legacyCanonical) return legacyCanonical;

  return normalizeSafeExternalHttpUrl(clean);
}

export function absoluteNewsMediaUrl(value: unknown): string | null {
  const normalized = normalizeNewsMediaUrl(value);
  if (!normalized) return null;
  if (normalized.startsWith('/')) {
    return `${SITE_URL}${normalized}`;
  }
  return normalized;
}
