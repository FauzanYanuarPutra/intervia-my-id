'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { CompactSeeAllLink } from '@/components/common/CompactSectionAction';
import { MarketplaceDiscoveryCard } from '@/components/discovery/MarketplaceDiscoveryCard';
import { HorizontalRail } from '@/components/home/minimal/HorizontalRail';
import { type User, useAuth } from '@/context/AuthContext';
import { CONTENT_TYPES, getContentTypeShort } from '@/data/contentTypes';
import {
  asString,
  type ContentItem,
  extractContentItems,
  formatIDRFromCents,
  parseImages,
} from '@/lib/content/catalog';
import {
  formatPriceWithUnit,
  resolveContentPriceUnitLabel,
} from '@/lib/content/priceUnit';
import { resolveSupplierListingBadges } from '@/lib/content/supplierInfo';
import {
  getListingSideContextLabel,
  getListingSideLabel,
  getListingValueFallback,
  resolveListingSide,
  type ListingSide,
} from '@/lib/content/listingSide';
import {
  buildPublicProfileHrefFromContent,
  resolveOwnerUserIdFromContent,
} from '@/lib/profile/publicProfileLink';
import { cn } from '@/lib/utils';
import {
  RefreshCcw,
  Sparkles,
  UserRound,
  Store,
  Handshake,
} from 'lucide-react';

type DiscoverySort = 'newest' | 'top';
type DiscoveryFilter =
  | 'all'
  | 'product'
  | 'property'
  | 'tool_rental'
  | 'business_transfer'
  | 'service'
  | 'freelancer'
  | 'umkm';

type DiscoveryCardType =
  | 'job'
  | 'freelancer'
  | 'product'
  | 'property'
  | 'service'
  | 'tool_rental'
  | 'business_transfer'
  | 'umkm'
  | 'other';

type GroupKey =
  | 'supply'
  | 'demand'
  | 'talent'
  | 'property'
  | 'rental'
  | 'umkm'
  | 'other';

type DiscoveryCard = {
  id: string;
  title: string;
  summary: string;
  location: string;
  ratingLabel?: string | null;
  priceLabel: string;
  typeLabel: string;
  typeKey: DiscoveryCardType;
  side: ListingSide;
  sideLabel: string;
  sideContextLabel: string;
  supplierBadges: string[];
  group: GroupKey;
  image?: string;
  images: string[];
  href: string;
  profileHref?: string | null;
  chatUserId?: string | null;
  updatedAt: number;
  score: number;
  verified: boolean;
};

type HomeDiscoveryFeedProps = {
  locale: string;
  compact?: boolean;
};

type RailSectionProps = {
  title: string;
  description: string;
  href: string;
  items: DiscoveryCard[];
  locale: 'id' | 'en';
  loading: boolean;
  emptyLabel: string;
  icon?: React.ReactNode;
};

const FILTER_STORAGE_KEY = 'lajukan.home.discovery.filter';

const FILTER_OPTIONS: Array<{
  value: DiscoveryFilter;
  labelId: string;
  labelEn: string;
}> = [
  { value: 'all', labelId: 'Semua', labelEn: 'All' },
  { value: 'product', labelId: 'Supplier', labelEn: 'Suppliers' },
  { value: 'property', labelId: 'Lokasi', labelEn: 'Locations' },
  { value: 'service', labelId: 'Jasa', labelEn: 'Services' },
  { value: 'tool_rental', labelId: 'Sewa', labelEn: 'Rentals' },
  {
    value: 'business_transfer',
    labelId: 'Oper Usaha',
    labelEn: 'Business Transfer',
  },
  { value: 'freelancer', labelId: 'Talent', labelEn: 'Talent' },
  { value: 'umkm', labelId: 'Usaha', labelEn: 'Business' },
];

function isDiscoveryFilter(value: string | null): value is DiscoveryFilter {
  return [
    'all',
    'product',
    'property',
    'tool_rental',
    'business_transfer',
    'service',
    'freelancer',
    'umkm',
  ].includes(String(value || ''));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function normalizeStatus(value: unknown): string {
  return String(value || 'active')
    .trim()
    .toLowerCase();
}

function formatShortDate(value: number, locale: 'id' | 'en'): string | null {
  if (!value || !Number.isFinite(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-US', {
    day: '2-digit',
    month: 'short',
  });
}

function resolveCardType(value: string): DiscoveryCardType {
  const normalized = value.toLowerCase();
  if (/(job|career|loker|job_listing|job_posting)/.test(normalized))
    return 'job';
  if (/(freelancer|talent|profile)/.test(normalized)) return 'freelancer';
  if (
    /(business_transfer|business-transfer|oper usaha|oper-usaha|jual usaha|usaha berjalan|handover|takeover)/.test(
      normalized,
    )
  ) {
    return 'business_transfer';
  }
  if (/(product|market|shop|store)/.test(normalized)) return 'product';
  if (
    /(tool_rental|tool-rental|rental|rent|sewa|pinjam|meminjam)/.test(
      normalized,
    )
  ) {
    return 'tool_rental';
  }
  if (/(service|jasa)/.test(normalized)) return 'service';
  if (
    /(property|real-estate|real estate|apartment|house|ruko|kios|lapak)/.test(
      normalized,
    )
  ) {
    return 'property';
  }
  if (/(umkm|merchant|warung|kuliner)/.test(normalized)) return 'umkm';
  return 'other';
}

function groupForType(typeKey: DiscoveryCardType): GroupKey {
  if (typeKey === 'job') return 'demand';
  if (typeKey === 'freelancer') return 'talent';
  if (typeKey === 'property') return 'property';
  if (typeKey === 'tool_rental') return 'rental';
  if (
    typeKey === 'product' ||
    typeKey === 'service' ||
    typeKey === 'business_transfer'
  )
    return 'supply';
  if (typeKey === 'umkm') return 'umkm';
  return 'other';
}

function displayTypeLabel(
  typeKey: DiscoveryCardType,
  locale: 'id' | 'en',
): string {
  if (typeKey === 'product') return locale === 'id' ? 'Supplier' : 'Supplier';
  if (typeKey === 'property') {
    return locale === 'id' ? 'Lokasi Jualan' : 'Selling Spot';
  }
  if (typeKey === 'tool_rental') {
    return locale === 'id' ? 'Sewa Alat' : 'Tool Rental';
  }
  if (typeKey === 'business_transfer') {
    return locale === 'id' ? 'Oper Usaha' : 'Business Transfer';
  }
  if (typeKey === 'freelancer') return 'Freelancer';
  if (typeKey === 'service') {
    return locale === 'id' ? 'Paket Jasa' : 'Service Package';
  }
  if (typeKey === 'umkm') return locale === 'id' ? 'Usaha' : 'Business';
  if (typeKey === 'other') return locale === 'id' ? 'Listing' : 'Listing';
  const match = CONTENT_TYPES.find(ct => ct.id === typeKey);
  if (match) return getContentTypeShort(match, locale);
  return locale === 'id' ? 'Listing' : 'Listing';
}

function resolveSideContextLabel(
  side: ListingSide,
  typeKey: DiscoveryCardType,
  locale: 'id' | 'en',
): string {
  if (typeKey === 'product') {
    return locale === 'id'
      ? side === 'demand'
        ? 'Cari supplier'
        : 'Stok usaha & reseller'
      : side === 'demand'
        ? 'Looking for suppliers'
        : 'Business stock and reseller supply';
  }

  if (typeKey === 'tool_rental') {
    return locale === 'id'
      ? side === 'demand'
        ? 'Cari sewa alat usaha'
        : 'Sewa alat usaha'
      : side === 'demand'
        ? 'Looking for tool rental'
        : 'Business tool rental';
  }

  if (typeKey === 'business_transfer') {
    return locale === 'id'
      ? side === 'demand'
        ? 'Cari peluang usaha'
        : 'Usaha berjalan siap dialihkan'
      : side === 'demand'
        ? 'Looking for business opportunities'
        : 'Running business for transfer';
  }

  if (typeKey === 'property') {
    return locale === 'id'
      ? side === 'demand'
        ? 'Cari lokasi usaha'
        : 'Lokasi jualan tersedia'
      : side === 'demand'
        ? 'Looking for a selling location'
        : 'Selling location available';
  }

  if (typeKey === 'freelancer') {
    return locale === 'id'
      ? side === 'demand'
        ? 'Cari Freelancer'
        : 'Bantu operasional bisnis'
      : side === 'demand'
        ? 'Looking for freelancers'
        : 'Support business operations';
  }

  if (typeKey === 'service') {
    return locale === 'id'
      ? side === 'demand'
        ? 'Cari jasa operasional'
        : 'Jasa operasional usaha'
      : side === 'demand'
        ? 'Looking for business services'
        : 'Business operations service';
  }

  if (typeKey === 'umkm') {
    return locale === 'id' ? 'Usaha lokal aktif' : 'Active local business';
  }

  return getListingSideContextLabel(
    side,
    typeKey === 'other' ? 'product' : typeKey,
    locale,
  );
}

function getRatingValue(item: ContentItem): number {
  if (typeof item.rating === 'number') return item.rating;
  if (typeof item.seller_stats?.rating === 'number')
    return item.seller_stats.rating;
  return 0;
}

function getReviewCount(item: ContentItem): number {
  if (typeof item.review_count === 'number') return item.review_count;
  if (typeof item.seller_stats?.review_count === 'number') {
    return item.seller_stats.review_count;
  }
  return 0;
}

function buildScore(input: {
  updatedAt: number;
  ratingValue: number;
  reviewCount: number;
  hasPromo: boolean;
  hasRichImage: boolean;
  hasSummary: boolean;
  verified: boolean;
  typeKey: DiscoveryCardType;
}): number {
  const hoursOld =
    input.updatedAt > 0
      ? Math.max(0, (Date.now() - input.updatedAt) / 3_600_000)
      : 48;

  const freshness = Math.max(0, 36 - hoursOld / 4);

  const typeBoost =
    input.typeKey === 'product'
      ? 6
      : input.typeKey === 'property'
        ? 5
        : input.typeKey === 'tool_rental' || input.typeKey === 'service'
          ? 5
          : input.typeKey === 'freelancer'
            ? 4
            : input.typeKey === 'umkm'
              ? 3
              : 1;

  return (
    freshness +
    input.ratingValue * 6 +
    Math.min(18, input.reviewCount * 0.4) +
    (input.hasPromo ? 7 : 0) +
    (input.hasRichImage ? 4 : 0) +
    (input.hasSummary ? 2 : 0) +
    (input.verified ? 3 : 0) +
    typeBoost
  );
}

function mapContentItem(
  item: ContentItem,
  locale: 'id' | 'en',
): DiscoveryCard | null {
  const id = String(item.id || '').trim();
  if (!id) return null;
  if (normalizeStatus(item.content_status || item.status) !== 'active')
    return null;

  const meta = item.metadata || {};
  const entityKind = asString(meta.entity_kind);
  const title = item.title || item.summary || asString(meta.name) || 'Untitled';
  const summary =
    item.summary || asString(meta.tagline) || asString(meta.description) || '';
  const location =
    asString(meta.location) ||
    asString(meta.city) ||
    asString(meta.region) ||
    'Indonesia';
  const side = resolveListingSide({
    type: item.content_type || item.category,
    metadata: meta,
    title: item.title,
    summary: item.summary,
  });

  const price = formatIDRFromCents(item.price_cents);
  const priceUnitLabel = resolveContentPriceUnitLabel(item, locale);
  const fallbackPriceLabel =
    side === 'demand'
      ? asString(meta.budget_label) ||
        asString(meta.budget_range) ||
        asString(meta.budget) ||
        asString(meta.capital_range)
      : asString(meta.price_label) ||
        asString(meta.salary_range) ||
        asString(meta.rate_label);
  const priceLabel =
    price !== '-'
      ? side === 'demand'
        ? price
        : formatPriceWithUnit(price, priceUnitLabel)
      : fallbackPriceLabel
        ? side === 'demand'
          ? fallbackPriceLabel
          : formatPriceWithUnit(fallbackPriceLabel, priceUnitLabel)
        : getListingValueFallback(
            side,
            locale,
            item.content_type || item.category,
          );

  const typeToken = [
    item.content_type,
    item.category,
    asString(meta.type),
    asString(meta.sector),
  ]
    .filter(Boolean)
    .join(' ');

  const typeKey = resolveCardType(typeToken);
  const typeLabel = displayTypeLabel(typeKey, locale);

  const sideLabel = getListingSideLabel(side, locale);
  const sideContextLabel = resolveSideContextLabel(side, typeKey, locale);
  const supplierBadges = resolveSupplierListingBadges(item, locale);
  const gallery = parseImages(item);
  const image = gallery[0];
  const profileHref = buildPublicProfileHrefFromContent(item);

  const detailHref =
    entityKind === 'person' && profileHref
      ? profileHref
      : `/content/${slugify(title || 'listing')}-${encodeURIComponent(id)}`;

  const chatUserId = resolveOwnerUserIdFromContent(item);
  const updatedAt =
    Date.parse(String(item.updated_at || item.created_at || '')) || 0;
  const group = groupForType(typeKey);

  const ratingValue = getRatingValue(item);
  const reviewCount = getReviewCount(item);

  const verified = Boolean(
    item.owner_profile?.identity_verified ||
    item.owner_profile?.transaction_eligible ||
    item.owner_profile?.email_verified,
  );

  return {
    id,
    title,
    summary,
    location,
    ratingLabel:
      reviewCount > 0
        ? reviewCount.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US')
        : null,
    priceLabel,
    typeLabel,
    typeKey,
    side,
    sideLabel,
    sideContextLabel,
    supplierBadges,
    group,
    image,
    images: gallery,
    href: detailHref,
    profileHref,
    chatUserId,
    updatedAt,
    verified,
    score: buildScore({
      updatedAt,
      ratingValue,
      reviewCount,
      hasPromo:
        Boolean(asString(item.promo_label)) ||
        Boolean((meta as Record<string, unknown>)?.promotion),
      hasRichImage: gallery.length > 0,
      hasSummary: summary.trim().length > 24,
      verified,
      typeKey,
    }),
  };
}

function dedupeCards(items: DiscoveryCard[]): DiscoveryCard[] {
  const map = new Map<string, DiscoveryCard>();
  items.forEach(item => {
    if (!map.has(item.id)) map.set(item.id, item);
  });
  return Array.from(map.values());
}

function sortCards(
  items: DiscoveryCard[],
  mode: DiscoverySort,
): DiscoveryCard[] {
  const next = [...items];
  next.sort((a, b) => {
    if (mode === 'top' && b.score !== a.score) return b.score - a.score;
    return b.updatedAt - a.updatedAt;
  });
  return next;
}

function pickPreferenceTokens(user: User | null): string[] {
  const meta =
    user?.metadata && typeof user.metadata === 'object'
      ? (user.metadata as Record<string, unknown>)
      : null;

  const values: unknown[] = [
    user?.roles,
    meta?.preferred_content_type,
    meta?.preferred_content_types,
    meta?.interests,
    meta?.focus,
    meta?.sector,
    meta?.business_type,
    meta?.home_type,
  ];

  return values.flatMap(entry => {
    if (typeof entry === 'string') return [entry.toLowerCase()];
    if (Array.isArray(entry)) {
      return entry
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.toLowerCase());
    }
    return [];
  });
}

function resolvePreferredFilter(user: User | null): DiscoveryFilter {
  const tokens = pickPreferenceTokens(user);

  if (
    tokens.some(item =>
      /(supplier|distributor|produk|stok|inventory|reseller|dropship|grosir|wholesale|seller|retail|commerce)/.test(
        item,
      ),
    )
  ) {
    return 'product';
  }
  if (
    tokens.some(item =>
      /(lokasi|ruko|kios|lapak|booth|bazaar|property|properti)/.test(item),
    )
  ) {
    return 'property';
  }
  if (tokens.some(item => /(tool|rental|rent|sewa|pinjam|alat)/.test(item))) {
    return 'service';
  }
  if (tokens.some(item => /(service|jasa|repair|agency|consult)/.test(item))) {
    return 'service';
  }
  if (
    tokens.some(item =>
      /(freelancer|talent|designer|developer|creator)/.test(item),
    )
  ) {
    return 'freelancer';
  }

  return 'all';
}

function resolveBrowseHref(
  filter: DiscoveryFilter,
  mode: DiscoverySort,
): string {
  if (filter === 'all') return '/explore';
  return mode === 'newest'
    ? `/explore?type=${filter}&sort=newest`
    : `/explore?type=${filter}`;
}

function DiscoveryCardRail({
  items,
  locale,
  simple = true,
}: {
  items: DiscoveryCard[];
  locale: 'id' | 'en';
  simple?: boolean;
}) {
  return (
    <HorizontalRail
      hintLabel={locale === 'id' ? 'Geser kartu' : 'Swipe cards'}
      className="items-stretch py-2"
      showMobileControls={false}
      minimal
    >
      {items.map(item => (
        <MarketplaceDiscoveryCard
          key={`${item.typeKey}-${item.id}`}
          locale={locale}
          compact
          layoutContext="rail"
          presentation={simple ? 'simple' : 'default'}
          className="w-[74vw] min-w-[74vw] max-w-[232px] self-stretch snap-start sm:w-[204px] sm:min-w-[204px] sm:max-w-[204px]"
          item={{
            id: item.id,
            href: item.href,
            title: item.title,
            summary: item.summary,
            location: item.location,
            ratingLabel: item.ratingLabel,
            priceLabel: item.priceLabel,
            typeLabel: item.typeLabel,
            typeKey: item.typeKey,
            side: item.side,
            sideLabel: item.sideLabel,
            sideContextLabel: item.sideContextLabel,
            supplierBadges: item.supplierBadges,
            image: item.image,
            images: item.images,
            profileHref: item.profileHref,
            chatUserId: item.chatUserId,
            updatedLabel: formatShortDate(item.updatedAt, locale),
            tone: item.group,
            verified: item.verified,
          }}
        />
      ))}
    </HorizontalRail>
  );
}

function RailSkeleton({ locale }: { locale: 'id' | 'en' }) {
  return (
    <HorizontalRail
      hintLabel={locale === 'id' ? 'Geser kartu' : 'Swipe cards'}
      className="items-stretch"
      showMobileControls={false}
      minimal
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="ui-skeleton ui-skeleton-pulse h-[300px] min-h-[300px] max-h-[300px] w-[82vw] min-w-[82vw] max-w-[256px] self-stretch rounded-[22px] border border-[color:color-mix(in_srgb,var(--app-border)_90%,white_10%)] shadow-[0_18px_32px_-30px_rgba(15,23,42,0.12)] sm:h-[312px] sm:min-h-[312px] sm:max-h-[312px] sm:w-[228px] sm:min-w-[228px] sm:max-w-[228px] sm:rounded-[24px] lg:rounded-[26px] dark:border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] dark:shadow-[0_20px_34px_-28px_rgba(2,6,23,0.44)]"
        />
      ))}
    </HorizontalRail>
  );
}

function FeedStateCard({
  icon,
  children,
  action,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[112px] flex-col items-start gap-2.5 rounded-[20px] border border-[color:color-mix(in_srgb,var(--app-border)_90%,white_10%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_94%,transparent))] px-3 py-3 shadow-[0_14px_28px_-26px_rgba(15,23,42,0.14)] dark:border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] dark:shadow-[0_16px_28px_-22px_rgba(2,6,23,0.42)] sm:flex-row sm:items-center sm:justify-between sm:px-3.5">
      <div className="flex items-start gap-2.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_srgb,var(--app-accent)_18%,transparent)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_40%,var(--app-surface-strong))] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_28%,rgba(15,23,42,0.98))]">
          {icon}
        </span>
        <div className="max-w-lg text-[13px] leading-5 text-[color:var(--app-text-soft)]">
          {children}
        </div>
      </div>
      {action ? (
        <div className="w-full shrink-0 sm:w-auto">{action}</div>
      ) : null}
    </div>
  );
}

function RailSection({
  title,
  description,
  href,
  items,
  locale,
  loading,
  emptyLabel,
  icon,
}: RailSectionProps) {
  return (
    <section className="flex h-full w-full min-w-0 max-w-full flex-col rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_92%,white_8%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_92%,var(--app-surface-muted)))] p-3.5 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.18)] ring-1 ring-white/55 dark:border-[color:color-mix(in_srgb,var(--app-border)_90%,transparent)] dark:ring-white/5 sm:p-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            {icon ? (
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[color:color-mix(in_srgb,var(--app-accent)_18%,transparent)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_34%,var(--app-surface-strong))] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_22%,rgba(15,23,42,0.98))]">
                {icon}
              </span>
            ) : null}
            <p className="text-[13px] font-semibold text-[color:var(--app-text)]">
              {title}
            </p>
          </div>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-[11px] leading-5 text-[color:var(--app-text-soft)]">
              {description}
            </p>
          ) : null}
        </div>

        <CompactSeeAllLink
          href={href}
          isId={locale === 'id'}
          ariaLabel={
            locale === 'id' ? `Lihat semua ${title}` : `View all ${title}`
          }
        />
      </div>

      <div className="mt-3 flex-1">
        {loading ? (
          <RailSkeleton locale={locale} />
        ) : items.length === 0 ? (
          <FeedStateCard icon={<Sparkles className="h-5 w-5" />}>
            {emptyLabel}
          </FeedStateCard>
        ) : (
          <DiscoveryCardRail items={items} locale={locale} />
        )}
      </div>
    </section>
  );
}

export function HomeDiscoveryFeed({
  locale,
  compact = false,
}: HomeDiscoveryFeedProps) {
  const localeCode: 'id' | 'en' = locale === 'id' ? 'id' : 'en';
  const isId = localeCode === 'id';
  const { user } = useAuth();

  const preferredFilter = useMemo(() => resolvePreferredFilter(user), [user]);

  const [filter, setFilter] = useState<DiscoveryFilter>(() => {
    if (typeof window !== 'undefined') {
      const savedFilter = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (savedFilter === 'tool_rental') return 'service';
      if (isDiscoveryFilter(savedFilter)) return savedFilter;
    }
    return preferredFilter;
  });
  const [cardsByFilter, setCardsByFilter] = useState<
    Partial<Record<DiscoveryFilter, DiscoveryCard[]>>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(FILTER_STORAGE_KEY, filter);
  }, [filter]);

  useEffect(() => {
    let cancelled = false;

    async function readJson(response: Response) {
      return response.json().catch(() => ({}));
    }

    async function fetchContentCards(path: string): Promise<DiscoveryCard[]> {
      const response = await fetch(path, { cache: 'no-store' });
      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(
          (payload as { error?: string }).error ||
            (isId
              ? 'Konten belum bisa dimuat.'
              : 'Content is unavailable right now.'),
        );
      }

      return extractContentItems(payload)
        .map(item => mapContentItem(item, localeCode))
        .filter((item): item is DiscoveryCard => Boolean(item));
    }

    async function load() {
      setLoading(true);
      setError(null);

      const [
        productResult,
        propertyResult,
        rentalResult,
        businessTransferResult,
        serviceResult,
        freelancerResult,
      ] = await Promise.allSettled([
        fetchContentCards(
          '/api/content?type=product&include_owner=1&limit=18&offset=0',
        ),
        fetchContentCards(
          '/api/content?type=property&include_owner=1&limit=14&offset=0',
        ),
        fetchContentCards(
          '/api/content?type=tool_rental&include_owner=1&limit=16&offset=0',
        ),
        fetchContentCards(
          '/api/content?type=business_transfer&include_owner=1&limit=16&offset=0',
        ),
        fetchContentCards(
          '/api/content?type=service&include_owner=1&limit=16&offset=0',
        ),
        fetchContentCards(
          '/api/content?type=freelancer&include_owner=1&limit=12&offset=0',
        ),
      ]);

      if (cancelled) return;

      const productCards =
        productResult.status === 'fulfilled' ? productResult.value : [];
      const propertyCards =
        propertyResult.status === 'fulfilled' ? propertyResult.value : [];
      const rentalCards =
        rentalResult.status === 'fulfilled' ? rentalResult.value : [];
      const businessTransferCards =
        businessTransferResult.status === 'fulfilled'
          ? businessTransferResult.value
          : [];
      const serviceCards =
        serviceResult.status === 'fulfilled' ? serviceResult.value : [];
      const freelancerCards =
        freelancerResult.status === 'fulfilled' ? freelancerResult.value : [];

      const mixedCards = dedupeCards([
        ...productCards,
        ...propertyCards,
        ...rentalCards,
        ...businessTransferCards,
        ...serviceCards,
        ...freelancerCards,
      ]);

      setCardsByFilter({
        all: mixedCards,
        product: dedupeCards(productCards),
        property: dedupeCards(propertyCards),
        tool_rental: dedupeCards(rentalCards),
        business_transfer: dedupeCards(businessTransferCards),
        freelancer: dedupeCards(freelancerCards),
        service: dedupeCards(serviceCards),
      });

      if (
        !mixedCards.length &&
        !productCards.length &&
        !propertyCards.length &&
        !rentalCards.length &&
        !businessTransferCards.length &&
        !freelancerCards.length &&
        !serviceCards.length
      ) {
        setError(
          isId
            ? 'Rekomendasi belum bisa dimuat.'
            : 'Recommendations are unavailable right now.',
        );
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isId, localeCode, refreshKey]);

  const allCards = useMemo(
    () => dedupeCards(cardsByFilter.all || []),
    [cardsByFilter.all],
  );

  const topProducts = useMemo(
    () =>
      sortCards(dedupeCards(cardsByFilter.product || []), 'top').slice(0, 8),
    [cardsByFilter.product],
  );

  const topProperties = useMemo(
    () =>
      sortCards(dedupeCards(cardsByFilter.property || []), 'top').slice(0, 8),
    [cardsByFilter.property],
  );

  const topOperations = useMemo(
    () =>
      sortCards(
        dedupeCards([
          ...(cardsByFilter.tool_rental || []),
          ...(cardsByFilter.service || []),
        ]),
        'top',
      ).slice(0, 8),
    [cardsByFilter.service, cardsByFilter.tool_rental],
  );

  const topBusinessTransfers = useMemo(
    () =>
      sortCards(
        dedupeCards(cardsByFilter.business_transfer || []),
        'top',
      ).slice(0, 8),
    [cardsByFilter.business_transfer],
  );

  const topFreelancers = useMemo(
    () =>
      sortCards(dedupeCards(cardsByFilter.freelancer || []), 'top').slice(0, 8),
    [cardsByFilter.freelancer],
  );

  const activeCards = useMemo(() => {
    const fallback = allCards.filter(item => {
      if (filter === 'all') return true;
      if (filter === 'service') {
        return item.typeKey === 'service' || item.typeKey === 'tool_rental';
      }
      return item.typeKey === filter;
    });

    const source =
      filter === 'all'
        ? allCards
        : filter === 'service'
          ? dedupeCards([
              ...(cardsByFilter.service || []),
              ...(cardsByFilter.tool_rental || []),
            ])
          : dedupeCards(cardsByFilter[filter] || fallback);

    return sortCards(source, 'top').slice(0, 12);
  }, [allCards, cardsByFilter, filter]);

  const text = {
    title: compact
      ? isId
        ? 'Pilih jalur cepat.'
        : 'Pick a fast lane.'
      : isId
        ? 'Mulai dari jalur yang paling dekat.'
        : 'Start from the closest lane.',
    subtitle: compact
      ? isId
        ? 'Stok, operasional, lokasi, atau talent.'
        : 'Stock, operations, locations, or talent.'
      : isId
        ? 'Pilih jalur. Hubungi yang siap.'
        : 'Users do not need to see everything first. Pick a lane, then continue to listings that are ready to contact.',
    refresh: isId ? 'Coba lagi' : 'Retry',
    empty: isId ? 'Belum ada yang pas.' : 'Nothing fits yet.',
    products: isId ? 'Supplier' : 'Suppliers',
    productsDescription: isId
      ? 'Stok, grosir, dan distributor siap respon.'
      : 'Stock, wholesale, and distributors ready to respond.',
    properties: isId ? 'Lokasi jualan' : 'Selling locations',
    propertiesDescription: isId
      ? 'Booth, kios, ruko, dan titik jual.'
      : 'Booths, kiosks, shophouses, and selling spots.',
    operations: isId ? 'Jasa' : 'Services',
    operationsDescription: isId
      ? 'Jasa harian, operasional, dan alat.'
      : 'Daily services, operations support, and tools.',
    businessTransfers: isId ? 'Oper usaha' : 'Business transfers',
    businessTransfersDescription: isId
      ? 'Usaha berjalan yang bisa dicek aset, like, dan risikonya.'
      : 'Running businesses with assets, likes, and risks to review.',
    freelancers: isId ? 'Talent' : 'Talent',
    freelancersDescription: isId
      ? 'Eksekutor cepat untuk admin, konten, dan support.'
      : 'Fast executors for admin, content, and support.',
    productsEmpty: isId ? 'Supplier belum tampil.' : 'No suppliers yet.',
    propertiesEmpty: isId ? 'Lokasi belum tampil.' : 'No locations yet.',
    operationsEmpty: isId ? 'Jasa belum tampil.' : 'No services yet.',
    businessTransfersEmpty: isId
      ? 'Oper usaha belum tampil.'
      : 'No business transfers yet.',
    freelancersEmpty: isId ? 'Talent belum tampil.' : 'No talent yet.',
    discoverLabel: isId ? 'Pilihan cepat' : 'Quick picks',
    growthBadge: isId ? 'Pilih yang siap jalan' : 'Pick what is ready',
    growthHint: isId
      ? 'Utamakan yang jelas, terverifikasi, dan gampang dihubungi.'
      : 'Prioritize what is clear, verified, and easy to contact.',
  };

  const growthLinks = isId
    ? [
        { href: '/community', label: 'Komunitas' },
        { href: '/learn', label: 'Harga sehat' },
        { href: '/explore?type=product&q=distributor', label: 'Distributor' },
      ]
    : [
        { href: '/community', label: 'Community' },
        { href: '/learn', label: 'Healthy pricing' },
        { href: '/explore?type=product&q=distributor', label: 'Distributors' },
      ];

  const browseHref = resolveBrowseHref(filter, 'newest');
  const activeLoading = loading;
  return (
    <section className="ui-page-section ui-home-section-shell">
      <div className="ui-home-section-content grid w-full min-w-0 max-w-full gap-2 sm:gap-2.5">
        <section
          className={cn(
            'w-full min-w-0 max-w-full',
            compact
              ? 'bg-transparent p-0 shadow-none'
              : 'overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.94))] p-3.5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.2)] ring-1 ring-black/5 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.97),rgba(8,17,34,0.9))] dark:ring-white/10 sm:p-4',
          )}
        >
          {compact ? null : (
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_26%,white)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_20%,rgba(15,23,42,0.98))] dark:text-[color:var(--app-accent)]">
                  <Sparkles className="h-3 w-3" />
                  {text.discoverLabel}
                </div>
                <p className="mt-1.5 text-[1rem] font-bold leading-tight text-[color:var(--app-text)] sm:text-[1.1rem]">
                  {text.title}
                </p>
                <p className="mt-1.5 max-w-3xl text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                  {text.subtitle}
                </p>
              </div>

              <CompactSeeAllLink
                href={browseHref}
                isId={isId}
                ariaLabel={
                  isId
                    ? 'Lihat semua pilihan marketplace'
                    : 'View all marketplace picks'
                }
              />
            </div>
          )}
          <div
            className={cn(
              'flex gap-1.5',
              compact
                ? 'mt-0 overflow-x-auto rounded-[18px] bg-slate-100/90 p-0.5 pb-0.5 no-scrollbar dark:bg-slate-900/80'
                : 'mt-2 flex-wrap',
            )}
          >
            {FILTER_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                aria-pressed={filter === option.value}
                className={cn(
                  'ui-pressable inline-flex min-h-[32px] shrink-0 items-center rounded-full px-3 py-1 text-[10px] font-semibold transition',
                  compact
                    ? filter === option.value
                      ? 'border border-[color:var(--app-accent-border)] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] text-white shadow-[0_14px_28px_-22px_color-mix(in_srgb,var(--app-accent)_44%,transparent)]'
                      : 'border border-transparent bg-white text-slate-600 hover:border-[color:var(--app-accent-border)] hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_24%,white)] hover:text-[color:var(--app-accent)] dark:bg-slate-950/86 dark:text-slate-300 dark:hover:border-[color:var(--app-accent-border)] dark:hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_18%,rgba(15,23,42,0.98))] dark:hover:text-[color:var(--app-accent)]'
                    : filter === option.value
                      ? 'border border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_26%,white)] text-[color:var(--app-accent-strong)] shadow-[0_12px_28px_-24px_color-mix(in_srgb,var(--app-accent)_28%,transparent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_20%,rgba(15,23,42,0.98))] dark:text-[color:var(--app-accent)]'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-[color:var(--app-accent-border)] hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_24%,white)] hover:text-[color:var(--app-accent)] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-[color:var(--app-accent-border)] dark:hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_18%,rgba(15,23,42,0.98))] dark:hover:text-[color:var(--app-accent)]',
                )}
              >
                {isId ? option.labelId : option.labelEn}
              </button>
            ))}
          </div>

          {compact ? null : (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="inline-flex min-h-[30px] items-center rounded-full border border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_22%,white)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_18%,rgba(15,23,42,0.98))] dark:text-[color:var(--app-accent)]">
                {text.growthBadge}
              </span>
              <span className="text-[11px] font-medium text-[color:var(--app-text-soft)]">
                {text.growthHint}
              </span>
              {growthLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="ui-action-cue ui-pressable inline-flex min-h-[30px] items-center rounded-full px-3 py-1 text-[10px] font-semibold"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-2.5 sm:mt-3">
            {error && !activeCards.length ? (
              <FeedStateCard
                icon={<Sparkles className="h-5 w-5" />}
                action={
                  <button
                    type="button"
                    onClick={() => setRefreshKey(value => value + 1)}
                    className="ui-button-secondary ui-button-compact ui-pressable inline-flex items-center gap-2 rounded-full px-3 text-xs font-semibold"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {text.refresh}
                  </button>
                }
              >
                {error}
              </FeedStateCard>
            ) : activeLoading ? (
              <RailSkeleton locale={localeCode} />
            ) : activeCards.length === 0 ? (
              <FeedStateCard icon={<Sparkles className="h-5 w-5" />}>
                {text.empty}
              </FeedStateCard>
            ) : (
              <DiscoveryCardRail items={activeCards} locale={localeCode} />
            )}
          </div>
        </section>

        {compact ? null : (
          <div className="grid min-w-0 max-w-full gap-2.5 sm:gap-3 xl:grid-cols-2">
            <RailSection
              title={text.products}
              description={text.productsDescription}
              href="/explore?type=product"
              items={topProducts}
              locale={localeCode}
              loading={loading}
              emptyLabel={text.productsEmpty}
              icon={<Store className="h-4 w-4" />}
            />

            <RailSection
              title={text.properties}
              description={text.propertiesDescription}
              href="/explore?type=property&q=lokasi%20jualan"
              items={topProperties}
              locale={localeCode}
              loading={loading}
              emptyLabel={text.propertiesEmpty}
              icon={<Store className="h-4 w-4" />}
            />

            <RailSection
              title={text.operations}
              description={text.operationsDescription}
              href="/explore?type=service"
              items={topOperations}
              locale={localeCode}
              loading={loading}
              emptyLabel={text.operationsEmpty}
              icon={<Sparkles className="h-4 w-4" />}
            />

            <RailSection
              title={text.businessTransfers}
              description={text.businessTransfersDescription}
              href="/explore?type=business_transfer"
              items={topBusinessTransfers}
              locale={localeCode}
              loading={loading}
              emptyLabel={text.businessTransfersEmpty}
              icon={<Handshake className="h-4 w-4" />}
            />

            <RailSection
              title={text.freelancers}
              description={text.freelancersDescription}
              href="/explore?type=freelancer"
              items={topFreelancers}
              locale={localeCode}
              loading={loading}
              emptyLabel={text.freelancersEmpty}
              icon={<UserRound className="h-4 w-4" />}
            />
          </div>
        )}
      </div>
    </section>
  );
}
