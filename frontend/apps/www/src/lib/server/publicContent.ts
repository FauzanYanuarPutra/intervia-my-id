import 'server-only';

import { cache } from 'react';
import { extractContentId } from '@/lib/content/routes';

type ContentRecord = Record<string, unknown>;

export type PublicContentResolution =
  | { status: 'found'; content: ContentRecord }
  | { status: 'not_found' }
  | { status: 'unavailable' };

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

const IDENTITY_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8080';

function asRecord(value: unknown): ContentRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as ContentRecord;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isPublicContentActive(content: ContentRecord): boolean {
  const status = readString(content.content_status || content.status)
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return status === 'active' || status === 'published' || status === 'live';
}

async function fetchOwnerProfile(
  ownerId: string,
): Promise<ContentRecord | null> {
  try {
    const response = await fetch(
      new URL(`/users/public/${encodeURIComponent(ownerId)}`, IDENTITY_URL),
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(2_500),
      },
    );
    if (!response.ok) return null;
    const payload = asRecord(await response.json().catch(() => null));
    return (
      asRecord(payload?.data) ||
      asRecord(payload?.user) ||
      asRecord(payload?.profile) ||
      payload
    );
  } catch {
    return null;
  }
}

export const getPublicContent = cache(
  async (routeId: string): Promise<PublicContentResolution> => {
    const contentId = extractContentId(routeId) || routeId.trim();
    if (!contentId) return { status: 'not_found' };

    try {
      const response = await fetch(
        new URL(
          `/v1/content/${encodeURIComponent(contentId)}`,
          MARKETPLACE_URL,
        ),
        {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: AbortSignal.timeout(3_500),
        },
      );

      if ([400, 404, 410, 422].includes(response.status)) {
        return { status: 'not_found' };
      }
      if (!response.ok) return { status: 'unavailable' };

      const content = asRecord(await response.json().catch(() => null));
      if (!content?.id) return { status: 'unavailable' };

      const ownerId = readString(content.owner_id);
      if (ownerId && !asRecord(content.owner_profile)) {
        const ownerProfile = await fetchOwnerProfile(ownerId);
        if (ownerProfile) content.owner_profile = ownerProfile;
      }

      return { status: 'found', content };
    } catch {
      return { status: 'unavailable' };
    }
  },
);
