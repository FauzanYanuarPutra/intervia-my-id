import {
  CalendarClock,
  Clock3,
  MapPin,
  Package,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import {
  getListingSideActorLabel,
  getListingSideVerbLabel,
  getListingValueFallback,
} from '@/lib/content/listingSide';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';
import { SearchCardEyebrow, searchCardBorderClass } from './SearchCardParts';
import { cn } from '@/lib/utils';

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
    readMetadataText(item, locale, 'unit', 'quantity_unit'),
  ]
    .filter(Boolean)
    .join(' ');
  const factItems = [
    {
      key: 'budget',
      icon: WalletCards,
      label: budgetLabel || getListingValueFallback('demand', locale),
    },
    item.location
      ? {
          key: 'location',
          icon: MapPin,
          label: item.location,
        }
      : null,
    deadlineLabel
      ? {
          key: 'deadline',
          icon: CalendarClock,
          label: deadlineLabel,
        }
      : null,
    quantityLabel
      ? {
          key: 'quantity',
          icon: Package,
          label: quantityLabel,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    icon: LucideIcon;
    label: string;
  }>;
  const visibleFactItems = factItems.slice(0, 3);
  const statusLabel = requestStatusLabel(item, locale);
  const sideStatusLabel = `${getListingSideVerbLabel('demand', locale)} - ${statusLabel}`;
  const actorLabel = getListingSideActorLabel('demand', locale).toLowerCase();

  const title = (
    <h3
      className={cn(
        'mt-1.5 line-clamp-2 text-sm font-bold leading-5 text-[color:var(--app-text)]',
        interactive && 'group-hover:text-[#1d4ed8]',
      )}
    >
      {item.title}
    </h3>
  );

  const card = (
    <article
      className={cn(
        'flex h-full min-h-[152px] flex-col rounded-xl border bg-[color:var(--app-surface-strong)] p-3 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.4)]',
        interactive &&
          'cursor-pointer transition motion-reduce:transform-none hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.3)]',
        searchCardBorderClass('blue'),
      )}
    >
      <SearchCardEyebrow
        icon={Clock3}
        label={
          item.label ||
          (locale === 'id' ? `Kebutuhan ${actorLabel}` : 'Buyer need')
        }
        tone="blue"
        sideLabel={sideStatusLabel}
      />
      {title}
      <p className="mt-1 line-clamp-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
        {item.summary ||
          (locale === 'id'
            ? 'Pembeli belum menulis detail panjang. Buka brief untuk cek konteks dan tawarkan bantuan yang relevan.'
            : 'The buyer has not added a long description. Open the brief to review context and offer relevant help.')}
      </p>
      <div
        className="mt-2 flex flex-wrap gap-1.5 border-t border-[color:var(--app-border)] pt-2 text-[11px]"
        aria-label={locale === 'id' ? 'Info kebutuhan' : 'Need info'}
      >
        {visibleFactItems.map(fact => {
          const FactIcon = fact.icon;
          return (
            <span
              key={fact.key}
              className="inline-flex min-w-0 max-w-full items-center gap-1 truncate rounded-full bg-[#eff6ff] px-2 py-1 font-semibold text-[#1d4ed8]"
            >
              <FactIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{fact.label}</span>
            </span>
          );
        })}
      </div>
    </article>
  );

  if (!interactive) return card;

  return (
    <Link
      href={item.href}
      className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
    >
      {card}
    </Link>
  );
}
