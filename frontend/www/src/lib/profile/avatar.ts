import { normalizeContentMediaUrl } from '@/lib/content/catalog';

export const DEFAULT_PROFILE_AVATAR = '/default-avatar.svg';

export function profileAvatarSrc(value?: string | null) {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (!clean) return DEFAULT_PROFILE_AVATAR;

  const normalized = clean.toLowerCase();
  if (
    normalized === 'null' ||
    normalized === 'undefined' ||
    normalized === 'none' ||
    normalized === 'n/a' ||
    normalized === '-'
  ) {
    return DEFAULT_PROFILE_AVATAR;
  }

  const mediaUrl = normalizeContentMediaUrl(clean);
  if (
    mediaUrl.startsWith('/') ||
    mediaUrl.startsWith('https://') ||
    mediaUrl.startsWith('data:image/')
  ) {
    return mediaUrl;
  }

  return DEFAULT_PROFILE_AVATAR;
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
