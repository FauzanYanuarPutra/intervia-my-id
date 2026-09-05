import 'server-only';

import { cache } from 'react';
import {
  buildPublicProfileSlug,
  decodePublicProfileSlug,
  extractPublicProfileIdFromSlug,
  matchesPublicProfileSlug,
} from '@/lib/profile/publicProfileLink';
import {
  isSystemPublicProfileIdentity,
  isSystemPublicProfileRecord,
} from '@/lib/server/publicProfilePolicy';

type ProfileRecord = Record<string, unknown>;

export type PublicProfileResolution =
  | { status: 'found'; profile: ProfileRecord; canonicalSlug: string }
  | { status: 'not_found' }
  | { status: 'unavailable' };

const IDENTITY_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const COMMUNITY_URL = process.env.COMMUNITY_SERVICE_URL || process.env.INTERNAL_COMMUNITY_URL || process.env.NEXT_PUBLIC_COMMUNITY_URL || '';

function asRecord(value: unknown): ProfileRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as ProfileRecord;
}

function profileBody(value: unknown): ProfileRecord | null {
  const root = asRecord(value);
  return asRecord(root?.data) || asRecord(root?.user) || asRecord(root?.profile) || root;
}

function profileId(value: ProfileRecord | null): string {
  return typeof value?.id === 'string' ? value.id.trim() : '';
}

async function fetchJson(url: URL): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(3_500),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function fetchProfileById(id: string): Promise<
  | { status: 'found'; profile: ProfileRecord }
  | { status: 'not_found' }
  | { status: 'unavailable' }
> {
  if (isSystemPublicProfileIdentity(id)) return { status: 'not_found' };
  try {
    const url = new URL(`/users/public/${encodeURIComponent(id)}`, IDENTITY_URL);
    const result = await fetchJson(url);
    if (result.status === 404) return { status: 'not_found' };
    if (result.status < 200 || result.status >= 300) return { status: 'unavailable' };
    const profile = profileBody(result.body);
    if (isSystemPublicProfileRecord(profile)) return { status: 'not_found' };
    return profileId(profile) ? { status: 'found', profile: profile as ProfileRecord } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

async function discoverProfiles(query?: string, limit = 32): Promise<{ profiles: ProfileRecord[]; unavailable: boolean }> {
  try {
    const url = new URL('/users/discover', IDENTITY_URL);
    url.searchParams.set('limit', String(limit));
    if (query?.trim()) url.searchParams.set('q', query.trim());
    const result = await fetchJson(url);
    if (result.status < 200 || result.status >= 300) return { profiles: [], unavailable: true };
    const root = asRecord(result.body);
    const items = (Array.isArray(root?.data) && root.data) || (Array.isArray(root?.results) && root.results) || (Array.isArray(root?.items) && root.items) || [];
    return {
      profiles: items
        .map(item => profileBody(item))
        .filter((item): item is ProfileRecord => Boolean(item && profileId(item) && !isSystemPublicProfileRecord(item))),
      unavailable: false,
    };
  } catch {
    return { profiles: [], unavailable: true };
  }
}

export const resolvePublicProfile = cache(async (slug: string): Promise<PublicProfileResolution> => {
  const decodedSlug = decodePublicProfileSlug(slug).trim();
  if (!decodedSlug || isSystemPublicProfileIdentity(decodedSlug)) return { status: 'not_found' };

  let unavailable = false;
  const directId = extractPublicProfileIdFromSlug(decodedSlug);
  if (directId) {
    if (isSystemPublicProfileIdentity(directId)) return { status: 'not_found' };
    const direct = await fetchProfileById(directId);
    if (direct.status === 'found') return { status: 'found', profile: direct.profile, canonicalSlug: buildPublicProfileSlug(direct.profile) };
    unavailable ||= direct.status === 'unavailable';
  }

  const slugHandle = decodedSlug.replace(/--.+$/, '').trim();
  const searchTerm = slugHandle.replace(/-/g, ' ').trim();
  if (isSystemPublicProfileIdentity(slugHandle)) return { status: 'not_found' };
  if (!slugHandle && !searchTerm) return unavailable ? { status: 'unavailable' } : { status: 'not_found' };

  if (slugHandle) {
    const direct = await fetchProfileById(slugHandle);
    if (direct.status === 'found' && matchesPublicProfileSlug(decodedSlug, direct.profile)) {
      return { status: 'found', profile: direct.profile, canonicalSlug: buildPublicProfileSlug(direct.profile) };
    }
    unavailable ||= direct.status === 'unavailable';
  }

  const variants = Array.from(new Set([searchTerm, slugHandle, slugHandle.replace(/-/g, '_')].map(item => item.trim()).filter(Boolean)));
  for (const variant of variants) {
    const result = await discoverProfiles(variant, 32);
    unavailable ||= result.unavailable;
    const candidate = result.profiles.find(item => matchesPublicProfileSlug(decodedSlug, item)) || null;
    if (candidate) {
      const detailed = await fetchProfileById(profileId(candidate));
      const profile = detailed.status === 'found' ? detailed.profile : candidate;
      if (isSystemPublicProfileRecord(profile)) return { status: 'not_found' };
      return { status: 'found', profile, canonicalSlug: buildPublicProfileSlug(profile) };
    }
  }

  const fallback = await discoverProfiles(undefined, 100);
  unavailable ||= fallback.unavailable;
  const candidate = fallback.profiles.find(item => matchesPublicProfileSlug(decodedSlug, item)) || null;
  if (candidate) {
    const detailed = await fetchProfileById(profileId(candidate));
    const profile = detailed.status === 'found' ? detailed.profile : candidate;
    if (isSystemPublicProfileRecord(profile)) return { status: 'not_found' };
    return { status: 'found', profile, canonicalSlug: buildPublicProfileSlug(profile) };
  }

  return unavailable ? { status: 'unavailable' } : { status: 'not_found' };
});

export const getPublicProfileSocial = cache(async (userId: string): Promise<unknown | null> => {
  if (isSystemPublicProfileIdentity(userId)) return null;
  const base = COMMUNITY_URL.trim();
  if (!base) return null;
  try {
    const url = new URL(`/v1/community/users/${encodeURIComponent(userId)}/social`, base.endsWith('/') ? base : `${base}/`);
    url.searchParams.set('limit', '48');
    const result = await fetchJson(url);
    return result.status >= 200 && result.status < 300 ? result.body : null;
  } catch {
    return null;
  }
});
