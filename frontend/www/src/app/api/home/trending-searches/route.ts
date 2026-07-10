import { NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';

export const runtime = 'nodejs';

type SearchTrendItem = {
  label: string;
  href: string;
  score: number;
  count: number;
  source: 'search_events' | 'database_fallback' | 'curated_fallback';
  database_matches?: number;
};

type EventTrendRow = {
  query: string;
  count: string | number;
  last_seen_at: Date | string | null;
};

type ListingSignalRow = {
  title: string | null;
  content_type: string | null;
  category: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
};

const FALLBACK_TERMS = [
  'Supplier kemasan',
  'Bahan baku usaha',
  'Mesin usaha',
  'Jasa branding',
  'Lokasi usaha',
  'Peluang usaha',
  'Supplier frozen food',
  'Jasa foto produk',
];

const STOPWORDS = new Set([
  'dan',
  'atau',
  'yang',
  'untuk',
  'dengan',
  'dari',
  'di',
  'ke',
  'the',
  'and',
  'for',
  'near',
  'lajukan',
  'usaha',
]);

const GENERIC_TREND_KEYS = new Set([
  'product',
  'products',
  'service',
  'services',
  'listing',
  'content',
  'item',
  'post',
]);

const BACKEND_TERM_LABELS: Record<string, string> = {
  supply: 'Bahan Usaha',
  supplies: 'Bahan Usaha',
  bahan: 'Bahan Usaha',
  equipment: 'Mesin & Alat',
  tool: 'Mesin & Alat',
  tools: 'Mesin & Alat',
  mesin: 'Mesin & Alat',
  property: 'Lokasi Usaha',
  place: 'Lokasi Usaha',
  nearby: 'Usaha Sekitar',
  opportunity: 'Peluang Usaha',
  business_transfer: 'Peluang Usaha',
};

function cleanQuery(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, 80);
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, ' ').trim();
}

function normalizeTrendKey(value: string): string {
  return normalizeKey(value.replace(/[_-]+/g, ' ')).replace(/\s+/g, '_');
}

function isSafePublicTrend(value: string): boolean {
  const clean = cleanQuery(value);
  if (clean.length < 2 || clean.length > 80) return false;
  if (/@/.test(clean)) return false;
  if (/[a-f0-9]{16,}/i.test(clean)) return false;
  if (/\b(?:\+?62|0)\d[\d\s.-]{7,}\b/.test(clean)) return false;
  if (/\b\d{7,}\b/.test(clean)) return false;
  return true;
}

function buildSearchHref(label: string) {
  return `/search?q=${encodeURIComponent(label)}`;
}

function titleCaseTerm(value: string): string {
  return cleanQuery(value)
    .split(' ')
    .map(part => {
      if (part.length <= 2) return part.toUpperCase();
      return `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`;
    })
    .join(' ');
}

function displayTrendLabel(value: string): string {
  const key = normalizeTrendKey(value);
  return BACKEND_TERM_LABELS[key] || titleCaseTerm(value.replace(/_/g, ' '));
}

function extractMetadataText(metadata: Record<string, unknown> | null, keys: string[]) {
  if (!metadata) return '';
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function listingText(row: ListingSignalRow) {
  return [
    row.title,
    row.content_type,
    row.category,
    ...(Array.isArray(row.tags) ? row.tags : []),
    extractMetadataText(row.metadata, [
      'create_category',
      'umkm_category',
      'business_type',
      'store_type',
      'segment',
      'location',
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function countDatabaseMatches(query: string, listingTexts: string[]) {
  const tokens = normalizeKey(query)
    .split(' ')
    .filter(token => token.length >= 3 && !STOPWORDS.has(token));
  if (tokens.length === 0) return 0;

  return listingTexts.reduce((total, text) => {
    const matches = tokens.filter(token => text.includes(token)).length;
    return total + (matches > 0 ? Math.min(matches, 3) : 0);
  }, 0);
}

function buildListingFallbacks(rows: ListingSignalRow[], limit: number) {
  const buckets = new Map<string, { label: string; score: number; count: number }>();

  for (const row of rows) {
    const candidates = [
      row.category,
      extractMetadataText(row.metadata, ['create_category', 'umkm_category', 'business_type']),
      ...(Array.isArray(row.tags) ? row.tags.slice(0, 3) : []),
    ];

    for (const candidate of candidates) {
      const raw = cleanQuery(candidate);
      const key = normalizeTrendKey(raw);
      if (GENERIC_TREND_KEYS.has(key)) continue;
      const label = displayTrendLabel(raw);
      if (!isSafePublicTrend(label)) continue;
      const bucketKey = normalizeKey(label);
      if (!bucketKey || STOPWORDS.has(bucketKey) || GENERIC_TREND_KEYS.has(bucketKey)) continue;
      const current = buckets.get(bucketKey) || { label, score: 0, count: 0 };
      current.score += 2;
      current.count += 1;
      buckets.set(bucketKey, current);
    }
  }

  return Array.from(buckets.values())
    .sort((left, right) => right.score - left.score || right.count - left.count)
    .slice(0, limit)
    .map(item => ({
      label: item.label,
      href: buildSearchHref(item.label),
      score: item.score,
      count: item.count,
      source: 'database_fallback' as const,
      database_matches: item.count,
    }));
}

function curatedFallback(limit: number): SearchTrendItem[] {
  return FALLBACK_TERMS.slice(0, limit).map((label, index) => ({
    label,
    href: buildSearchHref(label),
    score: Math.max(1, FALLBACK_TERMS.length - index),
    count: 0,
    source: 'curated_fallback',
  }));
}

export async function GET() {
  const limit = 10;
  const pool = getPostgresPool();

  if (!pool) {
    return NextResponse.json({
      data: {
        items: curatedFallback(limit),
        source: 'curated_fallback',
      },
    });
  }

  try {
    const [eventResult, listingResult] = await Promise.all([
      pool.query<EventTrendRow>(
        `
          SELECT
            lower(trim(properties->>'query')) AS query,
            COUNT(*) AS count,
            MAX(occurred_at) AS last_seen_at
          FROM events.event_log
          WHERE event_name = 'search.submitted'
            AND occurred_at >= NOW() - interval '21 days'
            AND length(trim(properties->>'query')) BETWEEN 2 AND 80
          GROUP BY lower(trim(properties->>'query'))
          HAVING COUNT(*) >= 2
          ORDER BY COUNT(*) DESC, MAX(occurred_at) DESC
          LIMIT 36
        `,
      ),
      pool.query<ListingSignalRow>(
        `
          SELECT title, content_type, category, tags, metadata
          FROM content_items
          WHERE content_status = 'active'
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 180
        `,
      ),
    ]);

    const listingTexts = listingResult.rows.map(listingText);
    const eventItems = eventResult.rows
      .map((row): SearchTrendItem | null => {
        const label = titleCaseTerm(row.query);
        if (!isSafePublicTrend(label)) return null;
        const count = Number(row.count) || 0;
        const dbMatches = countDatabaseMatches(label, listingTexts);
        const recencyScore = row.last_seen_at
          ? Math.max(0, 7 - Math.floor((Date.now() - new Date(row.last_seen_at).getTime()) / 86_400_000))
          : 0;
        const score = count * 8 + dbMatches * 2 + recencyScore;
        return {
          label,
          href: buildSearchHref(label),
          score,
          count,
          source: 'search_events' as const,
          database_matches: dbMatches,
        };
      })
      .filter((item): item is SearchTrendItem => Boolean(item));

    const seen = new Set<string>();
    const items = [...eventItems, ...buildListingFallbacks(listingResult.rows, limit)]
      .filter(item => {
        const key = normalizeKey(item.label);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);

    const finalItems = items.length > 0 ? items : curatedFallback(limit);

    return NextResponse.json(
      {
        data: {
          items: finalItems,
          source: eventItems.length > 0 ? 'search_events' : finalItems[0]?.source,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    console.warn('[HOME_TRENDING_SEARCHES_ERROR]', error);
    return NextResponse.json({
      data: {
        items: curatedFallback(limit),
        source: 'curated_fallback',
      },
    });
  }
}
