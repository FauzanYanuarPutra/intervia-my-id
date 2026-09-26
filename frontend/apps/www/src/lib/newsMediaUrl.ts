import { normalizeSafeExternalHttpUrl } from 'lajukan-ui';

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

export function normalizeNewsMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (!clean) return null;
  if (isSafeRelativeNewsMediaUrl(clean)) return clean;
  return normalizeSafeExternalHttpUrl(clean);
}

export function absoluteNewsMediaUrl(value: unknown): string | null {
  const normalized = normalizeNewsMediaUrl(value);
  if (!normalized) return null;
  if (normalized.startsWith('/')) {
    return `https://www.lajukan.com${normalized}`;
  }
  return normalized;
}
