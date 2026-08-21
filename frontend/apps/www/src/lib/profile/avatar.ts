import { normalizeContentMediaUrl } from '@/lib/content/catalog';
import { createLajukanAvatarFallbackDataUrl } from '@/lib/profile/lajukanAvatar';

export const DEFAULT_PROFILE_AVATAR = '/default-avatar.svg';

const AVATAR_STYLE_KEYS = [
  'avatar_style',
  'avatarStyle',
  'avatar_spec',
  'avatarSpec',
  'lajukan_avatar',
  'lajukanAvatar',
];

const AVATAR_STYLE_CONTAINER_KEYS = [
  'metadata',
  'extended',
  'profile',
  'media',
  'author',
  'user',
  'owner',
  'owner_profile',
  'seller',
  'seller_profile',
  'creator',
  'member',
  'account',
];

const AVATAR_URL_KEYS = [
  'avatarUrl',
  'avatar_url',
  'avatar',
  'photoUrl',
  'photo_url',
  'picture',
  'picture_url',
  'profile_image',
  'profile_image_url',
  'image',
  'image_url',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readProfileAvatarStyle(value: unknown, depth = 0): unknown {
  const record = asRecord(value);
  if (!record || depth > 4) return undefined;

  for (const key of AVATAR_STYLE_KEYS) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }

  for (const key of AVATAR_STYLE_CONTAINER_KEYS) {
    const nested = readProfileAvatarStyle(record[key], depth + 1);
    if (nested !== undefined && nested !== null) return nested;
  }

  return undefined;
}

export function readProfileAvatarUrl(value: unknown, depth = 0): string {
  const record = asRecord(value);
  if (!record || depth > 3) return '';

  for (const key of AVATAR_URL_KEYS) {
    const direct = readString(record[key]);
    if (direct) return direct;
  }

  for (const key of AVATAR_STYLE_CONTAINER_KEYS) {
    const nested = readProfileAvatarUrl(record[key], depth + 1);
    if (nested) return nested;
  }

  return '';
}

export function isDefaultProfileAvatar(value?: string | null): boolean {
  const clean = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!clean) return true;
  return (
    clean === DEFAULT_PROFILE_AVATAR ||
    clean.endsWith('/default-avatar.svg') ||
    clean.includes('default-avatar.svg') ||
    clean === 'null' ||
    clean === 'undefined' ||
    clean === 'none' ||
    clean === 'n/a' ||
    clean === '-'
  );
}

function normalizeExternalAvatarUrl(value: string): string {
  if (!/^https:\/\/[^/]*googleusercontent\.com\//i.test(value)) {
    return value;
  }

  return value.replace(/(=s\d+)-c(?=($|[-?&]))/i, '$1');
}

export function profileAvatarSrc(
  value?: string | null,
  avatarStyle?: unknown,
  label?: string,
) {
  const clean = typeof value === 'string' ? value.trim() : '';
  const fallback = () => createLajukanAvatarFallbackDataUrl(avatarStyle, label);
  if (!clean) return fallback();

  if (isDefaultProfileAvatar(clean)) return fallback();

  const mediaUrl = normalizeContentMediaUrl(clean);
  if (isDefaultProfileAvatar(mediaUrl)) return fallback();
  const avatarUrl = normalizeExternalAvatarUrl(mediaUrl);

  if (
    avatarUrl.startsWith('/') ||
    avatarUrl.startsWith('https://') ||
    avatarUrl.startsWith('data:image/')
  ) {
    return avatarUrl;
  }

  return fallback();
}

export function profileAvatarSrcFromRecord(
  value: unknown,
  label?: string,
  fallbackAvatarUrl?: string | null,
) {
  const avatarUrl = readProfileAvatarUrl(value) || fallbackAvatarUrl || '';
  return profileAvatarSrc(avatarUrl, readProfileAvatarStyle(value), label);
}

export function withDefaultProfileAvatar<T extends Record<string, unknown>>(
  value: T,
): T {
  const target = value as Record<string, unknown>;
  target['avatarUrl'] = DEFAULT_PROFILE_AVATAR;
  target['avatar_url'] = DEFAULT_PROFILE_AVATAR;
  const metadata = value.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    (metadata as Record<string, unknown>).avatar_url = DEFAULT_PROFILE_AVATAR;
  }
  return value;
}
