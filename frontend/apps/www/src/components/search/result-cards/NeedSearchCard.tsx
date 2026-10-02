import {
  ArrowRight,
  CalendarClock,
  Clock3,
  MapPin,
  Package,
  RefreshCw,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { ExploreCardMedia } from '@/components/explore/cards/ExploreCardMedia';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import {
  isPlaceholderLikeContentImage,
  isPreviewableContentMediaUrl,
  normalizeContentMediaUrl,
} from '@/lib/content/catalog';
import {
  getListingSideObjectLabel,
  getListingValueFallback,
} from '@/lib/content/listingSide';
import { priceUnitLabel } from '@/lib/content/priceUnit';
import { getExploreResultAction } from '@/lib/discovery/exploreResultConversion';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';
import { SearchCardEyebrow, searchCardBorderClass } from './SearchCardParts';
import { cn } from '@/lib/utils';
import { useOptionalAuth } from '@/context/AuthContext';

function readMetadataText(
  item: GlobalSearchItem,
  locale: 'id' | 'en',
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = item.metadata?.[key];
    if (typeof value === 'string' && value.trim())
      return humanizeMetadataValue(value.trim(), locale);
    if (typeof value === 'number' && Number.isFinite(value))
      return String(value);
  }
  return '';
}

function humanizeMetadataValue(value: string, locale: 'id' | 'en'): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const normalized = value.toLowerCase();
  const labels: Record<string, { id: string; en: string }> = {
    one_time: { id: 'Sekali', en: 'One-time' },
    weekly: { id: 'Mingguan', en: 'Weekly' },
    monthly: { id: 'Bulanan', en: 'Monthly' },
    recurring: { id: 'Rutin', en: 'Recurring' },
    on_demand: { id: 'Sesuai kebutuhan', en: 'On demand' },
    buy: { id: 'Beli', en: 'Buy' },
    rent: { id: 'Sewa', en: 'Rent' },
    fixed_budget: { id: 'Budget tetap', en: 'Fixed budget' },
    maximum_budget: { id: 'Budget maksimal', en: 'Maximum budget' },
    budget_range: { id: 'Rentang budget', en: 'Budget range' },
    negotiable: { id: 'Bisa dibicarakan', en: 'Negotiable' },
    undetermined: { id: 'Budget fleksibel', en: 'Flexible budget' },
  };
  const label = labels[normalized];
  if (label) return locale === 'id' ? label.id : label.en;
  return value.replace(/[_-]+/g, ' ').trim();
}

function readMetadataUnit(
  item: GlobalSearchItem,
  locale: 'id' | 'en',
): string {
  const sources = [
    item.metadata,
    item.metadata?.attributes,
    item.metadata?.values,
    item.metadata?.form_values,
  ];

  for (const source of sources) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    const record = source as Record<string, unknown>;
    const value =
      record.quantity_unit ??
      record.required_unit ??
      record.unit ??
      record.unit_label ??
      record.need_unit;
    if (value != null && String(value).trim()) {
      return priceUnitLabel(value, locale);
    }
  }

  return '';
}

function requestStatusLabel(item: GlobalSearchItem, locale: 'id' | 'en') {
  const status = String(item.metadata?.requestStatus || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!status || ['active', 'open', 'published'].includes(status)) {
    return locale === 'id' ? 'Terbuka' : 'Open';
  }
  if (['matched', 'connected'].includes(status)) {
    return locale === 'id' ? 'Sudah terhubung' : 'Connected';
  }
  if (['closed', 'done', 'completed'].includes(status)) {
    return locale === 'id' ? 'Selesai' : 'Closed';
  }
  return humanizeMetadataValue(status, locale);
}

export function NeedSearchCard({
  item,
  locale,
  interactive = true,
}: {
  item: GlobalSearchItem;
  locale: 'id' | 'en';
  interactive?: boolean;
}) {
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;

  const normalizedStatus = String(
    item.metadata?.contentStatus ||
      item.metadata?.content_status ||
      item.metadata?.status ||
      'active',
  )
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  const isPublic =
    normalizedStatus === 'active' ||
    normalizedStatus === 'published' ||
    normalizedStatus === 'live';

  const ownerId = String(
    item.metadata?.ownerId ||
      item.metadata?.owner_id ||
      '',
  )
    .trim()
    .toLowerCase();

  const viewerId = String(user?.id || '').trim().toLowerCase();
  const isOwner = Boolean(viewerId && ownerId && viewerId === ownerId);
  const action = getExploreResultAction('needs', locale);

  const destinationHref = isPublic
    ? item.href
    : isOwner
      ? '/create?draft=' + encodeURIComponent(item.id)
      : '';

  const destinationActionLabel =
    isOwner && !isPublic
      ? locale === 'id'
        ? 'Edit & ajukan'
        : 'Edit & submit'
      : action.label;

  const budgetLabel =
    item.priceLabel ||
    readMetadataText(item, locale, 'budget_label', 'budget', 'capital_range');
  const deadlineLabel =
    item.durationLabel ||
    readMetadataText(
      item,
      locale,
      'needed_by',
      'target_done',
      'target_move',
      'target_date',
      'deadline',
    );
  const quantityLabel = [
    readMetadataText(item, locale, 'quantity', 'required_quantity'),
    readMetadataUnit(item, locale),
  ]
    .filter(Boolean)
    .join(' ');

  const frequencyLabel = readMetadataText(
    item,
    locale,
    'need_frequency',
    'preferred_period',
    'frequency',
    'buy_frequency',
  );

  const factItems = [
    {
      key: 'budget',
      icon: WalletCards,
      label: budgetLabel || getListingValueFallback('demand', locale),
    },
    quantityLabel
      ? { key: 'quantity', icon: Package, label: quantityLabel }
      : null,
    frequencyLabel
      ? { key: 'frequency', icon: RefreshCw, label: frequencyLabel }
      : null,
    item.location
      ? { key: 'location', icon: MapPin, label: item.location }
      : null,
    deadlineLabel
      ? { key: 'deadline', icon: CalendarClock, label: deadlineLabel }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    icon: LucideIcon;
    label: string;
  }>;

  const visibleFactItems = factItems.slice(0, 4);
  const statusLabel = requestStatusLabel(item, locale);
  const sideStatusLabel = `${getListingSideObjectLabel('demand', locale)} · ${statusLabel}`;

  const imageCandidates = [
    item.image,
    ...[
      'image_url',
      'imageUrl',
      'cover_image',
      'coverImage',
      'thumbnail',
      'thumbnail_url',
      'thumbnailUrl',
      'photo',
      'photo_url',
      'photoUrl',
      'media',
      'media_url',
      'mediaUrl',
    ].map(key => {
      const value = item.metadata?.[key];
      return typeof value === 'string' ? value : null;
    }),
  ];

  const imageSrc =
    imageCandidates
      .map(value => normalizeContentMediaUrl(value || undefined))
      .find(
        value =>
          Boolean(value) &&
          isPreviewableContentMediaUrl(value) &&
          !isPlaceholderLikeContentImage(value),
      ) || null;


  const card = (
    <article
      data-testid="need-search-card"
      className={cn(
        'flex h-full min-h-[276px] min-w-0 flex-col overflow-hidden rounded-2xl border bg-[color:var(--app-surface-strong)] shadow-[0_16px_34px_-30px_rgba(15,23,42,0.4)] sm:min-h-[292px]',
        interactive &&
          'cursor-pointer transition duration-200 motion-reduce:transform-none hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_20px_40px_-30px_rgba(15,23,42,0.32)]',
        searchCardBorderClass('blue'),
      )}
    >
      <ExploreCardMedia
        src={imageSrc}
        alt={item.title}
        fallbackLabel={locale === 'id' ? 'Belum ada foto' : 'No photo yet'}
        className="aspect-[16/9] w-full sm:aspect-[16/8]"
      />

      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-3.5">
        <div className="min-w-0 w-full">
          <SearchCardEyebrow
            icon={Clock3}
            label={getListingSideObjectLabel('demand', locale)}
            tone="blue"
            sideLabel={sideStatusLabel}
          />
        </div>

        <h3
          className={cn(
            'mt-1.5 min-h-10 break-words line-clamp-2 text-sm font-bold leading-5 text-[color:var(--app-text)] sm:text-[15px]',
            interactive && 'group-hover:text-[#1d4ed8]',
          )}
        >
          {item.title}
        </h3>

        <p className="mt-1 min-h-5 line-clamp-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
          {item.summary ||
            (locale === 'id'
              ? 'Buka untuk melihat detail kebutuhan.'
              : 'Open to view the full need details.')}
        </p>

        {visibleFactItems.length ? (
          <div
            className="mt-2 flex min-w-0 items-center gap-1.5 overflow-hidden text-[10px] sm:text-[11px]"
            aria-label={locale === 'id' ? 'Info utama kebutuhan' : 'Key need info'}
          >
            {visibleFactItems.slice(0, 2).map(fact => {
              const FactIcon = fact.icon;
              return (
                <span
                  key={fact.key}
                  className="inline-flex min-w-0 max-w-[50%] items-center gap-1 rounded-full bg-[#eff6ff] px-2 py-1 font-semibold text-[#1d4ed8]"
                >
                  <FactIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">{fact.label}</span>
                </span>
              );
            })}
          </div>
        ) : null}

        <div className="mt-auto pt-2">
          <span className="inline-flex min-h-8 max-w-full items-center gap-1 text-[10px] font-black text-[#1d4ed8] sm:text-[11px]">
            <span className={cn(isOwner && !isPublic ? 'text-amber-700 dark:text-amber-300' : '')}>
              {destinationActionLabel}
            </span>
            <ArrowRight
              className="h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </div>
      </div>
    </article>
  );

  if (!interactive || !destinationHref) return card;

  return (
    <Link
      href={destinationHref}
      className="group block h-full min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
      aria-label={
        isOwner && !isPublic
          ? (locale === 'id' ? 'Edit ' : 'Edit ') + item.title
          : undefined
      }
    >
      {card}
    </Link>
  );
}
