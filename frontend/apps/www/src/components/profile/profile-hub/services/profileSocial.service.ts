import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import { normalizePublicProfileHandleInput } from '@/lib/profile/publicProfileLink';
import type { DiscoverUser, SocialUser } from '../types/profileSocial';

function readSocialText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
}

function readSocialNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value))
    return Math.max(0, Math.floor(value));
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }
  return 0;
}

function asSocialRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function buildSocialUserProfileHref(input: {
  id: string;
  username: string;
  name: string;
}): string {
  const slugBase =
    normalizePublicProfileHandleInput(input.username) ||
    normalizePublicProfileHandleInput(input.name) ||
    'member';
  return `/profile/${slugBase}--${encodeURIComponent(input.id)}`;
}

export function mapDiscoverUserToSocialUser(
  item: DiscoverUser,
  isId: boolean,
): SocialUser | null {
  const id = readSocialText(item.id);
  if (!id) return null;
  const username = readSocialText(item.username);
  const name =
    readSocialText(item.full_name) ||
    readSocialText(item.fullName) ||
    username ||
    (isId ? 'Pengguna Lajukan' : 'Lajukan user');
  const subtitle =
    readSocialText(item.headline) ||
    readSocialText(item.bio) ||
    readSocialText(item.location) ||
    (isId ? 'Profil Lajukan' : 'Lajukan profile');
  const meta = [
    readSocialText(item.location),
    item.rating ? `${item.rating.toFixed(1)} rating` : '',
    item.completed_jobs ? `${item.completed_jobs} deal` : '',
    readSocialText(item.level),
  ]
    .filter(Boolean)
    .slice(0, 2)
    .join(' - ');
  return {
    id,
    name,
    handle: username,
    href: buildSocialUserProfileHref({ id, username, name }),
    avatarUrl: profileAvatarSrc(
      readSocialText(item.avatar_url) || readSocialText(item.avatarUrl),
      readProfileAvatarStyle(item),
      name,
    ),
    subtitle,
    meta,
  };
}

export function mapRecordToSocialUser(
  value: unknown,
  isId: boolean,
): SocialUser | null {
  const record = asSocialRecord(value);
  if (!record) return null;
  return mapDiscoverUserToSocialUser(
    {
      id: readSocialText(record.id) || readSocialText(record.user_id),
      username:
        readSocialText(record.username) || readSocialText(record.handle),
      full_name:
        readSocialText(record.full_name) ||
        readSocialText(record.fullName) ||
        readSocialText(record.name),
      avatar_url:
        readSocialText(record.avatar_url) ||
        readSocialText(record.avatarUrl) ||
        readSocialText(record.avatar),
      avatar_style: record.avatar_style,
      avatarStyle: record.avatarStyle,
      metadata: record.metadata,
      location: readSocialText(record.location),
      headline:
        readSocialText(record.headline) || readSocialText(record.subtitle),
      bio: readSocialText(record.bio),
      level: readSocialText(record.level),
      rating: readSocialNumber(record.rating) || null,
      completed_jobs: readSocialNumber(record.completed_jobs) || null,
    },
    isId,
  );
}

export function readSocialList(value: unknown, isId: boolean): SocialUser[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => mapRecordToSocialUser(item, isId))
    .filter((item): item is SocialUser => Boolean(item));
}

export function mergeSocialUsers(...groups: SocialUser[][]): SocialUser[] {
  const seen = new Set<string>();
  const result: SocialUser[] = [];
  for (const group of groups)
    for (const item of group)
      if (!seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
      }
  return result;
}
