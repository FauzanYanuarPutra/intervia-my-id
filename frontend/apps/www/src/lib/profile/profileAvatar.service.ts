import {
  createLajukanAvatarDataUrl,
  readLajukanAvatarSpec,
  type LajukanAvatarSpec,
  type LajukanAvatarStyle,
} from '@/lib/profile/avatar2d';
import { isDefaultProfileAvatar } from '@/lib/profile/avatar';

export type ProfileAvatarSource = 'photo' | 'avatar' | 'fallback';

export type ProfileAvatarPayload = {
  avatarUrl: string;
  avatarStyle: LajukanAvatarSpec;
  hasUploadedPhoto: boolean;
  source: ProfileAvatarSource;
  src: string;
  userId?: string;
};

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

export function isGeneratedProfileAvatarUrl(value?: string | null): boolean {
  return /^data:image\/svg\+xml/i.test(String(value || '').trim());
}

export function isUploadedProfileAvatarUrl(value?: string | null): boolean {
  const clean = String(value || '').trim();
  return Boolean(
    clean &&
    !isDefaultProfileAvatar(clean) &&
    !isGeneratedProfileAvatarUrl(clean),
  );
}

export function shouldUseGeneratedAvatarUrl(value?: string | null): boolean {
  return !isUploadedProfileAvatarUrl(value);
}

export function buildGeneratedProfileAvatarUrl(
  style: Partial<LajukanAvatarStyle> | null | undefined,
  label?: string,
): string {
  return createLajukanAvatarDataUrl(
    readLajukanAvatarSpec(style),
    label || 'Lajukan avatar',
  );
}

export async function saveProfileAvatar(args: {
  authFetch: AuthFetch;
  currentAvatarUrl?: string | null;
  label?: string;
  style: Partial<LajukanAvatarStyle>;
}): Promise<ProfileAvatarPayload> {
  const avatarStyle = readLajukanAvatarSpec(args.style);
  const res = await args.authFetch('/api/profile/avatar', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      avatar_style: avatarStyle,
      currentAvatarUrl: args.currentAvatarUrl || '',
      label: args.label || 'Lajukan avatar',
      useAsProfileAvatar: shouldUseGeneratedAvatarUrl(args.currentAvatarUrl),
    }),
  });
  return parseAvatarResponse(res, 'Gagal menyimpan avatar');
}

export async function fetchProfileAvatar(args?: {
  authFetch?: AuthFetch;
  userId?: string;
}): Promise<ProfileAvatarPayload> {
  const query = args?.userId
    ? `?userId=${encodeURIComponent(args.userId)}`
    : '';
  const runFetch = args?.authFetch || fetch;
  const res = await runFetch(`/api/profile/avatar${query}`, {
    cache: 'no-store',
  });
  return parseAvatarResponse(res, 'Gagal memuat avatar');
}

async function parseAvatarResponse(
  res: Response,
  fallbackError: string,
): Promise<ProfileAvatarPayload> {
  const data = (await res.json().catch(() => ({}))) as
    | ProfileAvatarPayload
    | { error?: string };
  if (!res.ok) {
    throw new Error('error' in data && data.error ? data.error : fallbackError);
  }
  return data as ProfileAvatarPayload;
}
