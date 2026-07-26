import {
  ArrowRight,
  BadgeCheck,
  MapPin,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { getListingSideVerbLabel } from '@/lib/content/listingSide';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';
import { cn } from '@/lib/utils';

type SearchCardTone =
  | 'blue'
  | 'emerald'
  | 'fuchsia'
  | 'lime'
  | 'sky'
  | 'slate'
  | 'teal';

const TONE_CLASSES: Record<
  SearchCardTone,
  {
    border: string;
    icon: string;
    text: string;
    chip: string;
    cta: string;
  }
> = {
  blue: {
    border: 'border-[#bfdbfe]',
    icon: 'bg-[#eff6ff] text-[#2563eb]',
    text: 'text-[#1d4ed8]',
    chip: 'bg-[#eff6ff] text-[#1d4ed8]',
    cta: 'text-[#1d4ed8]',
  },
  emerald: {
    border: 'border-emerald-100',
    icon: 'bg-emerald-50 text-emerald-700',
    text: 'text-emerald-700',
    chip: 'bg-emerald-50 text-emerald-700',
    cta: 'text-emerald-700',
  },
  fuchsia: {
    border: 'border-fuchsia-100',
    icon: 'bg-fuchsia-50 text-fuchsia-700',
    text: 'text-fuchsia-700',
    chip: 'bg-fuchsia-50 text-fuchsia-700',
    cta: 'text-fuchsia-700',
  },
  lime: {
    border: 'border-lime-100',
    icon: 'bg-lime-50 text-lime-700',
    text: 'text-lime-700',
    chip: 'bg-lime-50 text-lime-700',
    cta: 'text-lime-700',
  },
  sky: {
    border: 'border-sky-100',
    icon: 'bg-sky-50 text-sky-700',
    text: 'text-sky-700',
    chip: 'bg-sky-50 text-sky-700',
    cta: 'text-sky-700',
  },
  slate: {
    border: 'border-[color:var(--app-border)]',
    icon: 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]',
    text: 'text-[color:var(--app-text)]',
    chip: 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]',
    cta: 'text-[color:var(--app-accent)]',
  },
  teal: {
    border: 'border-teal-100',
    icon: 'bg-teal-50 text-teal-700',
    text: 'text-teal-700',
    chip: 'bg-teal-50 text-teal-700',
    cta: 'text-teal-700',
  },
};

export function getSideLabel(
  item: Pick<GlobalSearchItem, 'side'>,
  locale: 'id' | 'en',
): string | null {
  if (item.side === 'demand' || item.side === 'supply') {
    return getListingSideVerbLabel(item.side, locale);
  }
  return null;
}

export function SearchCardEyebrow({
  icon: Icon,
  label,
  tone,
  verified,
  sideLabel,
}: {
  icon: LucideIcon;
  label: string;
  tone: SearchCardTone;
  verified?: boolean;
  sideLabel?: string | null;
}) {
  const toneClass = TONE_CLASSES[tone];

  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <p
        className={cn(
          'flex min-w-0 items-center gap-1.5 text-[11px] font-bold',
          toneClass.text,
        )}
      >
        <span
          className={cn(
            'inline-flex h-5 w-5 shrink-0 !p-1 items-center justify-center rounded-full',
            toneClass.icon,
          )}
        >
          <Icon className="h-3 w-3" />
        </span>
        <span className="truncate">{label}</span>
        {verified ? <BadgeCheck className="h-3.5 w-3.5 shrink-0" /> : null}
      </p>
      {sideLabel ? (
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
            toneClass.chip,
          )}
        >
          {sideLabel}
        </span>
      ) : null}
    </div>
  );
}

export function SearchCardFacts({
  item,
  locale,
  priceFallback,
  tone,
}: {
  item: GlobalSearchItem;
  locale: 'id' | 'en';
  priceFallback?: string;
  tone: SearchCardTone;
}) {
  const toneClass = TONE_CLASSES[tone];
  const ownerLabel = item.ownerName || '';
  const priceLabel = item.priceLabel || priceFallback || '';

  if (!priceLabel && !item.location && !ownerLabel) return null;

  return (
    <div
      className="mt-2 flex flex-wrap gap-1.5 border-t border-[color:var(--app-border)] pt-2 text-[11px]"
      aria-label={locale === 'id' ? 'Info utama' : 'Key info'}
    >
      {priceLabel ? (
        <span
          className={cn(
            'min-w-0 max-w-full truncate rounded-full px-2 py-1 font-bold',
            toneClass.chip,
          )}
        >
          {priceLabel}
        </span>
      ) : null}
      {item.location ? (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1 truncate rounded-full bg-[color:var(--app-surface-muted)] px-2 py-1 font-semibold text-[color:var(--app-text)]">
          <MapPin className="h-3 w-3 shrink-0 text-[color:var(--app-text-soft)]" />
          <span className="truncate">{item.location}</span>
        </span>
      ) : null}
      {ownerLabel ? (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1 truncate rounded-full bg-[color:var(--app-surface-muted)] px-2 py-1 font-semibold text-[color:var(--app-text)]">
          <UserRound className="h-3 w-3 shrink-0 text-[color:var(--app-text-soft)]" />
          <span className="truncate">{ownerLabel}</span>
        </span>
      ) : null}
    </div>
  );
}

export function SearchCardCta({
  href,
  locale,
  tone,
  label,
  as = 'link',
}: {
  href: string;
  locale: 'id' | 'en';
  tone: SearchCardTone;
  label?: string;
  as?: 'link' | 'span';
}) {
  const className = cn(
    'mt-auto inline-flex min-h-8 w-fit items-center justify-center gap-1 rounded-md bg-[color:var(--app-surface-muted)] px-3 text-xs font-bold transition',
    as === 'link' && 'hover:bg-[color:var(--app-accent-soft)]',
    TONE_CLASSES[tone].cta,
  );
  const content = (
    <>
      {label || (locale === 'id' ? 'Lihat detail' : 'View details')}
      <ArrowRight className="h-3.5 w-3.5" />
    </>
  );

  if (as === 'span') {
    return (
      <span className={className} aria-hidden="true">
        {content}
      </span>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

export function searchCardBorderClass(tone: SearchCardTone) {
  return TONE_CLASSES[tone].border;
}
