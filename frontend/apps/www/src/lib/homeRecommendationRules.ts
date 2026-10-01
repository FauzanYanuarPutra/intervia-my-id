import type { ContentItem } from '@/lib/content/catalog';
import { isExplicitlyNonTransactional, readPublicReference } from '@/lib/content/publicReference';

const NON_RECOMMENDATION_TOKENS = [
  'news',
  'article',
  'analysis',
  'press_release',
  'press release',
  'editorial',
  'community',
  'forum',
  'post',
  'reel',
  'video',
  'event',
  'company',
  'organization',
  'profile',
  'freelancer',
  'talent',
  'job',
  'career',
  'reference',
];

function normalizeToken(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
    : '';
}

export function isHomeRecommendationEligible(item: ContentItem): boolean {
  if (!item.id || !item.title?.trim()) return false;

  const status = normalizeToken(item.content_status || item.status);
  if (status && !['active', 'published', 'live'].includes(status)) return false;

  // Public/reference records must never compete with first-party Lajukan
  // listings on the Home marketplace surfaces.
  if (readPublicReference(item)) return false;

  const metadata = item.metadata || {};

  // A profile/business-directory record can carry a business taxonomy such as
  // "service" while still not being a marketplace listing. Never surface
  // those records in Home's offer/need carousels.
  const publicPath = [
    metadata.public_path,
    metadata.publicPath,
    metadata.profile_path,
    metadata.profilePath,
    metadata.href,
  ]
    .map(value => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) || '';
  if (/^\/(?:[a-z]{2}\/)?profile(?:\/|$)/i.test(publicPath)) return false;

  const recordKind = [
    metadata.record_kind,
    metadata.recordKind,
    metadata.entity_type,
    metadata.entityType,
  ]
    .map(normalizeToken)
    .find(Boolean) || '';
  if (['profile', 'user profile', 'user', 'public profile'].includes(recordKind)) {
    return false;
  }

  // A native Lajukan listing can legitimately be marked non-transactional
  // while it is a buyer request (for example, a user asking for 3 kg of
  // mangoes per week). Home must not hide such a real, owner-backed request.
  // Non-transactional records without an owner remain excluded unless they
  // have already been classified as a public reference above.
  const hasNativeOwner = Boolean(
    item.owner_id &&
      String(item.owner_id).trim() !== '' &&
      String(item.owner_id).trim() !== '00000000-0000-0000-0000-000000000000',
  );
  if (isExplicitlyNonTransactional(item) && !hasNativeOwner) return false;
  if (metadata.news && typeof metadata.news === 'object') return false;

  const signals = [
    item.content_type,
    item.category,
    metadata.type,
    metadata.content_type,
    metadata.record_kind,
    metadata.article_kind,
  ]
    .map(normalizeToken)
    .filter(Boolean);

  return !signals.some(signal =>
    NON_RECOMMENDATION_TOKENS.some(token => signal === token || signal.includes(token)),
  );
}
