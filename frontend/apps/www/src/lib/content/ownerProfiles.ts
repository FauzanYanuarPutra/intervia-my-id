import { NextRequest } from 'next/server';
import { readProfileAvatarStyle } from '@/lib/profile/avatar';

type ContentRecord = Record<string, unknown>;

export type PublicOwnerProfile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  avatar_style?: unknown;
  avatarStyle?: unknown;
  metadata?: Record<string, unknown> | null;
  location?: string | null;
  headline?: string | null;
  roles?: string[] | null;
  level?: string | null;
  rating?: number | null;
  completed_jobs?: number | null;
  hourly_rate?: number | null;
  email_verified?: boolean | null;
  phone_verified?: boolean | null;
  identity_verified?: boolean | null;
  transaction_eligible?: boolean | null;
};

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const values = value
    .map(entry => asString(entry))
    .filter(Boolean)
    .slice(0, 12);
  return values.length > 0 ? values : [];
}

function asObject(value: unknown): ContentRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as ContentRecord)
    : null;
}

function getOwnerId(item: ContentRecord): string {
  return asString(item.owner_id);
}

export function shouldIncludeOwnerProfiles(
  searchParams: URLSearchParams,
): boolean {
  const raw = asString(searchParams.get('include_owner'));
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export function readForwardAuthToken(req: NextRequest): string | null {
  const token =
    req.headers.get('authorization')?.replace('Bearer ', '') ||
    req.cookies.get('access_token')?.value ||
    '';
  return token.trim() || null;
}

function normalizeOwnerProfile(payload: unknown): PublicOwnerProfile | null {
  const body = asObject(payload);
  if (!body) return null;

  const id = asString(body.id);
  if (!id) return null;
  const metadata = asObject(body.metadata);
  const avatarStyle = readProfileAvatarStyle(body);

  return {
    id,
    username: asString(body.username) || null,
    full_name: asString(body.full_name) || null,
    avatar_url: asString(body.avatar_url) || null,
    avatar_style: avatarStyle ?? null,
    avatarStyle: avatarStyle ?? null,
    metadata,
    location: asString(body.location) || null,
    headline: asString(body.headline) || null,
    roles: asStringArray(body.roles),
    level: asString(body.level) || null,
    rating: asNumber(body.rating),
    completed_jobs: asNumber(body.completed_jobs),
    hourly_rate: asNumber(body.hourly_rate),
    email_verified: asBoolean(body.email_verified),
    phone_verified: asBoolean(body.phone_verified),
    identity_verified: asBoolean(body.identity_verified),
    transaction_eligible: asBoolean(body.transaction_eligible),
  };
}

export async function fetchOwnerPublicProfiles(args: {
  req: NextRequest;
  identityBase: string;
  items: ContentRecord[];
}): Promise<Map<string, PublicOwnerProfile>> {
  const { req, identityBase, items } = args;
  const ownerIds = Array.from(
    new Set(items.map(item => getOwnerId(item)).filter(Boolean)),
  ).slice(0, 24);

  if (ownerIds.length === 0) {
    return new Map();
  }

  const token = readForwardAuthToken(req);
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const results = await Promise.allSettled(
    ownerIds.map(async ownerId => {
      const response = await fetch(
        `${identityBase}/users/public/${encodeURIComponent(ownerId)}`,
        {
          method: 'GET',
          headers,
          cache: 'no-store',
          signal: AbortSignal.timeout(9000),
        },
      );
      if (!response.ok) return null;
      const payload = await response.json().catch(() => null);
      return normalizeOwnerProfile(payload);
    }),
  );

  const profileMap = new Map<string, PublicOwnerProfile>();
  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    profileMap.set(result.value.id, result.value);
  }
  return profileMap;
}

export function attachOwnerProfilesToContent(
  items: ContentRecord[],
  profiles: Map<string, PublicOwnerProfile>,
): ContentRecord[] {
  if (items.length === 0 || profiles.size === 0) return items;

  return items.map(item => {
    const ownerId = getOwnerId(item);
    const ownerProfile = ownerId ? profiles.get(ownerId) : null;
    if (!ownerProfile) return item;

    const metadata = asObject(item.metadata) || {};
    return {
      ...item,
      owner_profile: ownerProfile,
      metadata: {
        ...metadata,
        owner_profile: ownerProfile,
      },
    };
  });
}
