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

  if (isExplicitlyNonTransactional(item)) return false;
  if (readPublicReference(item)) return false;

  const metadata = item.metadata || {};
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
