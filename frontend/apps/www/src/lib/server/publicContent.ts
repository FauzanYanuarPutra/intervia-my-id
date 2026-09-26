import 'server-only';

import { headers } from 'next/headers';
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

export async function getViewerUserId(): Promise<string> {
  try {
    const requestHeaders = await headers();
    const forwardedHeaders: Record<string, string> = {
      Accept: 'application/json',
    };
    const cookie = requestHeaders.get('cookie');
    const authorization = requestHeaders.get('authorization');
    if (cookie) forwardedHeaders.Cookie = cookie;
    if (authorization) forwardedHeaders.Authorization = authorization;

    const response = await fetch(new URL('/auth/me', IDENTITY_URL), {
      headers: forwardedHeaders,
      cache: 'no-store',
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) return '';

    const payload = asRecord(await response.json().catch(() => null));
    const user =
      asRecord(payload?.user) ||
      asRecord(payload?.data) ||
      asRecord(payload);
    return readString(user?.id);
  } catch {
    return '';
  }
}

export async function getPublicContent(
  routeId: string,
): Promise<PublicContentResolution> {
    const requestHeadersFromServer = await headers();
  const contentId = extractContentId(routeId) || routeId.trim();
  if (!contentId) return { status: 'not_found' };

  try {
      const response = await fetch(
        new URL(
          `/v1/content/${encodeURIComponent(contentId)}`,
          MARKETPLACE_URL,
        ),
        {
          headers: (() => {
            const requestHeaders = new Headers();
            requestHeaders.set('Accept', 'application/json');
            const cookie = requestHeadersFromServer?.get('cookie');
            const authorization = requestHeadersFromServer?.get('authorization');
            if (cookie) requestHeaders.set('Cookie', cookie);
            if (authorization) requestHeaders.set('Authorization', authorization);
            return requestHeaders;
          })(),
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
}

export function isPublicEditorialContent(content: ContentRecord): boolean {
  const metadata = asRecord(content.metadata);
  const news = asRecord(metadata?.news);
  if (news && Object.keys(news).length > 0) return true;

  const rawType = [content.content_type, content.type]
    .map(readString)
    .join(' ')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return rawType.split(/[^a-z0-9_]+/).some(token =>
    ['news', 'article', 'guide'].includes(token),
  );
}

export function getPublicEditorialSlug(content: ContentRecord): string {
  const metadata = asRecord(content.metadata);
  const news = asRecord(metadata?.news);
  return readString(news?.slug) || readString(content.slug);
}

export function getPublicEditorialLanguage(
  content: ContentRecord,
  fallback: string,
): 'id' | 'en' {
  const metadata = asRecord(content.metadata);
  const news = asRecord(metadata?.news);
  const language = readString(news?.language).toLowerCase();
  if (language === 'en') return 'en';
  if (language === 'id') return 'id';
  return fallback === 'en' ? 'en' : 'id';
}
