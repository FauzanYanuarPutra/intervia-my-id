import {
  CalendarClock,
  Clock3,
  FileText,
  ListChecks,
  MapPin,
  Package,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import {
  getListingCardCtaLabel,
  getListingSideActorLabel,
  getListingSideVerbLabel,
  getListingValueFallback,
} from '@/lib/content/listingSide';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';
import {
  SearchCardCta,
  SearchCardEyebrow,
  searchCardBorderClass,
} from './SearchCardParts';
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

function readMetadataList(
  item: GlobalSearchItem,
  locale: 'id' | 'en',
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = item.metadata?.[key];
    if (Array.isArray(value)) {
      const label = value
        .map(entry => humanizeMetadataValue(String(entry || '').trim(), locale))
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');
      if (label) return label;
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
  const criteriaLabel =
    readMetadataList(
      item,
      locale,
      'required_certifications',
      'required_facilities',
      'output_needed',
      'support_needed',
    ) ||
    readMetadataText(
      item,
      locale,
      'required_certifications',
      'required_facilities',
      'output_needed',
      'support_needed',
      'provider_criteria',
      'minimum_capacity',
      'traffic_note',
      'experience',
    );
  const frequencyLabel = readMetadataText(
    item,
    locale,
    'need_frequency',
    'preferred_period',
    'buy_or_rent',
    'rent_or_buy',
    'partnership_type',
  );
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
    quantityLabel
      ? {
          key: 'quantity',
          icon: Package,
          label: quantityLabel,
        }
      : null,
    deadlineLabel
      ? {
          key: 'deadline',
          icon: CalendarClock,
          label: deadlineLabel,
        }
      : null,
    frequencyLabel
      ? {
          key: 'frequency',
          icon: Clock3,
          label: frequencyLabel,
        }
      : null,
    criteriaLabel
      ? {
          key: 'criteria',
          icon: ListChecks,
          label: criteriaLabel,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    icon: LucideIcon;
    label: string;
  }>;
  const visibleFactItems = factItems.slice(0, 5);
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
        'flex h-full min-h-[168px] flex-col rounded-lg border bg-[color:var(--app-surface-strong)] p-3 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.4)]',
        interactive &&
          'cursor-pointer transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.3)]',
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
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
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
      {!item.image ? (
        <div className="mt-2 inline-flex min-w-0 items-start gap-1.5 rounded-md bg-[color:var(--app-surface-muted)] px-2 py-1.5 text-[11px] font-semibold leading-4 text-[color:var(--app-text-soft)]">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1d4ed8]" />
          <span className="line-clamp-2">
            {locale === 'id'
              ? 'Brief teks cukup; foto atau dokumen bisa menyusul saat ngobrol.'
              : 'A text brief is enough; photos or documents can follow in chat.'}
          </span>
        </div>
      ) : (
        <div className="mt-2 inline-flex min-w-0 items-start gap-1.5 rounded-md bg-[#eff6ff] px-2 py-1.5 text-[11px] font-semibold leading-4 text-[#1d4ed8]">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">
            {locale === 'id'
              ? 'Ada gambar referensi untuk membantu memahami kebutuhan.'
              : 'Includes a reference image to clarify the need.'}
          </span>
        </div>
      )}
      {interactive ? (
        <SearchCardCta
          href={item.href}
          locale={locale}
          tone="blue"
          label={getListingCardCtaLabel(
            'demand',
            item.metadata.contentType || item.kind,
            locale,
          )}
          as="span"
        />
      ) : null}
    </article>
  );

  if (!interactive) return card;

  return (
    <Link
      href={item.href}
      className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
    >
      {card}
    </Link>
  );
}
