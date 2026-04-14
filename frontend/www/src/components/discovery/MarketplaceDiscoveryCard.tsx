'use client';

import { useState, type CSSProperties } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import {
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  CircleDollarSign,
  Clock3,
  House,
  MapPin,
  Package2,
  Star,
  Store,
  UserRound,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type DiscoveryCardType =
  | 'job'
  | 'freelancer'
  | 'product'
  | 'property'
  | 'service'
  | 'tool_rental'
  | 'umkm'
  | 'other';

type DiscoveryCardTone =
  | 'supply'
  | 'demand'
  | 'talent'
  | 'property'
  | 'rental'
  | 'umkm'
  | 'other';

type DiscoveryCardSide = 'demand' | 'supply';

export type MarketplaceDiscoveryCardItem = {
  id: string;
  href: string;
  profileHref?: string | null;
  chatUserId?: string | null;
  title: string;
  summary: string;
  location: string;
  ratingLabel?: string | null;
  priceLabel: string;
  typeLabel: string;
  typeKey: DiscoveryCardType;
  side: DiscoveryCardSide;
  sideLabel: string;
  sideContextLabel: string;
  image?: string;
  images?: string[];
  updatedLabel?: string | null;
  tone: DiscoveryCardTone;
  verified?: boolean;
};

type MarketplaceDiscoveryCardProps = {
  item: MarketplaceDiscoveryCardItem;
  locale: 'id' | 'en';
  compact?: boolean;
  layoutContext?: 'grid' | 'rail';
  presentation?: 'default' | 'simple';
  className?: string;
};

type CardAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone: 'primary' | 'secondary';
};

const TYPE_ACCENTS: Record<
  DiscoveryCardType,
  { accent: string; softText: string; softBg: string }
> = {
  job: {
    accent: '#dc2626',
    softText: 'text-red-700 dark:text-red-300',
    softBg: 'bg-red-50 dark:bg-red-500/10',
  },
  freelancer: {
    accent: '#7c3aed',
    softText: 'text-violet-700 dark:text-violet-300',
    softBg: 'bg-violet-50 dark:bg-violet-500/10',
  },
  product: {
    accent: '#0284c7',
    softText: 'text-sky-700 dark:text-sky-300',
    softBg: 'bg-sky-50 dark:bg-sky-500/10',
  },
  property: {
    accent: '#d97706',
    softText: 'text-amber-700 dark:text-amber-300',
    softBg: 'bg-amber-50 dark:bg-amber-500/10',
  },
  service: {
    accent: '#16a34a',
    softText: 'text-green-700 dark:text-green-300',
    softBg: 'bg-green-50 dark:bg-green-500/10',
  },
  tool_rental: {
    accent: '#ea580c',
    softText: 'text-orange-700 dark:text-orange-300',
    softBg: 'bg-orange-50 dark:bg-orange-500/10',
  },
  umkm: {
    accent: '#0d9488',
    softText: 'text-teal-700 dark:text-teal-300',
    softBg: 'bg-teal-50 dark:bg-teal-500/10',
  },
  other: {
    accent: '#475569',
    softText: 'text-slate-700 dark:text-slate-300',
    softBg: 'bg-slate-100 dark:bg-slate-800',
  },
};

const TYPE_ICONS: Record<DiscoveryCardType, LucideIcon> = {
  job: BriefcaseBusiness,
  freelancer: UserRound,
  product: Package2,
  property: House,
  service: Wrench,
  tool_rental: Wrench,
  umkm: Store,
  other: Package2,
};

const CATEGORY_LABELS: Record<
  DiscoveryCardType,
  { id: string; en: string }
> = {
  job: { id: 'Lowongan', en: 'Jobs' },
  freelancer: { id: 'Freelancer', en: 'Talent' },
  product: { id: 'Produk', en: 'Product' },
  property: { id: 'Properti', en: 'Property' },
  service: { id: 'Jasa', en: 'Service' },
  tool_rental: { id: 'Sewa', en: 'Rental' },
  umkm: { id: 'UMKM', en: 'Business' },
  other: { id: 'Info', en: 'Info' },
};

function getCardAccentStyle(typeKey: DiscoveryCardType): CSSProperties {
  const palette = TYPE_ACCENTS[typeKey] || TYPE_ACCENTS.other;
  return {
    '--card-accent': palette.accent,
  } as CSSProperties;
}

function getCategoryLabel(
  typeKey: DiscoveryCardType,
  locale: 'id' | 'en',
): string {
  const label = CATEGORY_LABELS[typeKey] || CATEGORY_LABELS.other;
  return locale === 'id' ? label.id : label.en;
}

export const DISCOVERY_COMPACT_CARD_BASELINE_CLASS =
  'min-h-[244px] sm:min-h-[252px]';

const RAIL_COMPACT_CARD_FRAME_CLASS =
  'h-full min-h-[244px] self-stretch sm:min-h-[252px]';
const GRID_COMPACT_CARD_FRAME_CLASS = cn(
  'h-full self-stretch',
  DISCOVERY_COMPACT_CARD_BASELINE_CLASS,
);
const RAIL_COMFORTABLE_CARD_FRAME_CLASS =
  'h-full min-h-[288px] self-stretch sm:min-h-[300px]';
const GRID_COMFORTABLE_CARD_FRAME_CLASS =
  'h-full min-h-[292px] self-stretch sm:min-h-[304px]';

function getFrameClass(
  compact: boolean,
  layoutContext: 'grid' | 'rail',
): string {
  if (compact) {
    return layoutContext === 'rail'
      ? RAIL_COMPACT_CARD_FRAME_CLASS
      : GRID_COMPACT_CARD_FRAME_CLASS;
  }

  return layoutContext === 'rail'
    ? RAIL_COMFORTABLE_CARD_FRAME_CLASS
    : GRID_COMFORTABLE_CARD_FRAME_CLASS;
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeActionHref(value?: string | null): string | null {
  const href = String(value || '').trim();
  return href.length > 0 ? href : null;
}

function isLikelyPlaceholderImage(src?: string): boolean {
  const value = String(src || '')
    .trim()
    .toLowerCase();

  if (!value) return true;

  return (
    value.startsWith('data:image/svg+xml') ||
    value.includes('loremflickr.com') ||
    value.includes('i.pravatar.cc') ||
    value.includes('api.dicebear.com') ||
    value.includes('placeholder') ||
    value.includes('default-avatar') ||
    value.includes('default_image')
  );
}

function getInitials(value: string): string {
  const parts = value
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  return parts.map(part => part[0]?.toUpperCase() || '').join('') || 'MK';
}

function uniqueMediaCandidates(item: MarketplaceDiscoveryCardItem): string[] {
  const seen = new Set<string>();

  return [item.image, ...(item.images || [])]
    .map(entry => String(entry || '').trim())
    .filter(entry => entry.length > 0 && !isLikelyPlaceholderImage(entry))
    .filter(entry => {
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function useCardActions(
  item: MarketplaceDiscoveryCardItem,
  locale: 'id' | 'en',
) {
  const router = useRouter();
  const { authFetch, loading: authLoading, user } = useAuth();
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const profileHref = normalizeActionHref(item.profileHref);
  const chatUserId = String(item.chatUserId || '').trim();
  const profileIsPrimary = Boolean(profileHref) && profileHref === item.href;
  const currentUserId = user?.id?.trim().toLowerCase() || '';
  const isSelfPeer =
    Boolean(currentUserId) &&
    Boolean(chatUserId) &&
    currentUserId === chatUserId.toLowerCase();
  const canStartChat = Boolean(chatUserId) && !isSelfPeer;

  const openChat = async () => {
    if (!canStartChat) {
      setChatError(
        locale === 'id'
          ? 'Belum bisa chat sekarang.'
          : 'Chat is unavailable right now.',
      );
      return;
    }

    if (!user) {
      if (authLoading) return;

      const callbackUrl =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : `/${locale}/home`;

      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    setChatLoading(true);
    setChatError(null);

    try {
      const leadPayload: Record<string, unknown> = {
        source: 'discovery_card',
        name: item.title,
        metadata: {
          content_type: item.typeKey,
          content_url: item.href,
        },
      };

      if (isUuidLike(item.id)) {
        leadPayload.content_id = item.id;
      }

      const response = await authFetch('/api/chat/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peer_user_id: chatUserId,
          lead: leadPayload,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        room_id?: string;
        data?: { room_id?: string };
        error?: string;
      };

      const roomId = payload.room_id || payload.data?.room_id || '';

      if (!response.ok || !roomId) {
        throw new Error(payload.error || 'Failed to open chat');
      }

      router.push(`/chat/${encodeURIComponent(roomId)}`);
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : locale === 'id'
            ? 'Gagal buka chat.'
            : 'Failed to open chat.',
      );
    } finally {
      setChatLoading(false);
    }
  };

  const primaryLabel =
    item.typeKey === 'job'
      ? locale === 'id'
        ? 'Lamar'
        : 'Apply'
      : profileIsPrimary
        ? locale === 'id'
          ? 'Lihat profil'
          : 'Profile'
        : locale === 'id'
          ? 'Buka'
          : 'Open';

  const primary: CardAction = {
    label: primaryLabel,
    href: item.href,
    tone: 'primary',
  };

  const profileAction: CardAction | null =
    profileHref && profileHref !== item.href
      ? {
          label: locale === 'id' ? 'Profil' : 'Profile',
          href: profileHref,
          tone: 'secondary',
        }
      : null;

  const chatAction: CardAction | null = canStartChat
    ? {
        label: chatLoading
          ? locale === 'id'
            ? 'Membuka...'
            : 'Opening...'
          : 'Chat',
        onClick: () => {
          void openChat();
        },
        loading: chatLoading,
        disabled: chatLoading,
        tone: 'secondary',
      }
    : null;

  return {
    chatError,
    contentHref: item.href,
    primary,
    secondary:
      item.typeKey === 'freelancer'
        ? profileAction || chatAction
        : chatAction || profileAction,
  };
}

function MediaThumb({
  item,
  variant = 'tile',
  className,
}: {
  item: MarketplaceDiscoveryCardItem;
  compact: boolean;
  variant?: 'tile' | 'avatar' | 'map';
  className?: string;
}) {
  const image = uniqueMediaCandidates(item)[0] || '';
  const initials = getInitials(item.title);
  const Icon =
    variant === 'map' ? MapPin : TYPE_ICONS[item.typeKey] || Package2;
  const palette = TYPE_ACCENTS[item.typeKey] || TYPE_ACCENTS.other;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[18px] bg-slate-100 dark:bg-slate-900',
        className,
      )}
    >
      {image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={item.title}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.02]"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.08)_46%,rgba(15,23,42,0.3))]" />
        </>
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fafc,#eef2f7)] dark:bg-[linear-gradient(180deg,#0f172a,#111827)]">
          <div className="absolute inset-0 opacity-50">
            <div className="absolute -left-4 top-2 h-16 w-16 rounded-full bg-white blur-2xl dark:bg-white/5" />
            <div className="absolute bottom-0 right-0 h-16 w-16 rounded-full bg-slate-200 blur-2xl dark:bg-slate-700/40" />
          </div>
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center">
        {image ? null : variant === 'avatar' ? (
          <span className="text-sm font-bold tracking-[0.06em] text-slate-700 dark:text-slate-100">
            {initials}
          </span>
        ) : (
          <span
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 shadow-sm dark:border-white/10',
              palette.softBg,
            )}
          >
            <Icon className={cn('h-5 w-5', palette.softText)} />
          </span>
        )}
      </div>
    </div>
  );
}

function CategoryPreview({
  item,
  locale,
  compact,
  minimal,
  simple,
  showPrice,
  primaryLabel,
}: {
  item: MarketplaceDiscoveryCardItem;
  locale: 'id' | 'en';
  compact: boolean;
  minimal: boolean;
  simple: boolean;
  showPrice: boolean;
  primaryLabel: string;
}) {
  const hasMedia = uniqueMediaCandidates(item).length > 0;
  const heroVariant =
    item.typeKey === 'property' || (item.typeKey === 'umkm' && !hasMedia)
      ? 'map'
      : 'tile';

  const categoryLabel = String(
    item.typeLabel || getCategoryLabel(item.typeKey, locale),
  ).trim();
  const locationLabel = String(item.location || '').trim();
  const updatedLabel = String(item.updatedLabel || '').trim();
  const summaryLabel = String(
    item.sideContextLabel || item.summary || '',
  ).trim();

  const valueLabel = showPrice
    ? item.priceLabel
    : item.ratingLabel
      ? item.ratingLabel
      : item.verified
        ? locale === 'id'
          ? 'Terverifikasi'
          : 'Verified'
        : primaryLabel;

  const ValueIcon = showPrice
    ? CircleDollarSign
    : item.ratingLabel
      ? Star
      : item.verified
        ? BadgeCheck
        : null;

  const palette = TYPE_ACCENTS[item.typeKey] || TYPE_ACCENTS.other;

  const heroHeightClass = minimal
    ? 'h-[108px] sm:h-[112px]'
    : compact
      ? 'h-[120px] sm:h-[128px]'
      : simple
        ? 'h-[136px] sm:h-[144px]'
        : 'h-[148px] sm:h-[160px]';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="relative overflow-hidden rounded-[18px]">
        <MediaThumb
          item={item}
          compact={compact}
          variant={heroVariant}
          className={cn('w-full', heroHeightClass)}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-2.5">
          <span
            className={cn(
              'inline-flex max-w-[70%] min-h-[24px] items-center rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.06em]',
              palette.softBg,
              palette.softText,
            )}
          >
            <span className="truncate">{categoryLabel}</span>
          </span>

          {item.verified ? (
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/92 text-slate-700 shadow-sm backdrop-blur dark:bg-slate-950/84 dark:text-slate-100">
              <BadgeCheck className="h-4 w-4" />
            </span>
          ) : null}
        </div>

        {summaryLabel && !minimal ? (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.6))]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-2.5">
              <p className="line-clamp-1 text-[11px] font-medium text-white/95">
                {summaryLabel}
              </p>
            </div>
          </>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <h3
          className={cn(
            'min-h-[calc(2*1lh)] min-w-0 break-words font-semibold tracking-[-0.02em] text-slate-900 dark:text-white',
            compact
              ? 'line-clamp-2 text-[14px] leading-[1.35]'
              : 'line-clamp-2 text-[15px] leading-[1.35] sm:text-[16px]',
          )}
        >
          {item.title}
        </h3>

        {item.summary && !minimal && !simple ? (
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            {item.summary}
          </p>
        ) : null}

        <div className="mt-2 flex min-h-[26px] flex-wrap items-center gap-1.5">
          {locationLabel ? (
            <span className="inline-flex min-h-[26px] max-w-full min-w-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{locationLabel}</span>
            </span>
          ) : null}

          {updatedLabel ? (
            <span className="inline-flex min-h-[26px] max-w-full min-w-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Clock3 className="h-3 w-3 shrink-0" />
              <span className="truncate">{updatedLabel}</span>
            </span>
          ) : null}
        </div>

        <div className="mt-auto pt-2.5">
          <div className="rounded-[16px] border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span
                  className={cn(
                    'inline-flex min-w-0 items-center gap-1.5 font-semibold text-slate-900 dark:text-white',
                    compact ? 'text-[12px]' : 'text-[13px] sm:text-[14px]',
                  )}
                >
                  {ValueIcon ? (
                    <ValueIcon
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        item.ratingLabel ? 'fill-current' : '',
                      )}
                    />
                  ) : null}
                  <span className="truncate">{valueLabel}</span>
                </span>
              </div>

              {/* <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                {locale === 'id' ? 'Detail' : 'Detail'}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarketplaceDiscoveryCard({
  item,
  locale,
  compact = false,
  layoutContext = 'grid',
  presentation = 'default',
  className,
}: MarketplaceDiscoveryCardProps) {
  const simple = presentation === 'simple';
  const isRailPreview = compact && layoutContext === 'rail';
  const { contentHref, primary, secondary, chatError } = useCardActions(
    item,
    locale,
  );
  const cardAccentStyle = getCardAccentStyle(item.typeKey);
  const showPrice = item.typeKey !== 'freelancer' && item.priceLabel !== '-';

  const shouldCollapseActionsInRail = isRailPreview;
  const secondaryAction = shouldCollapseActionsInRail ? null : secondary;

  const renderAction = (action: CardAction) => {
    const actionClass = cn(
      'ui-pressable inline-flex min-h-[40px] w-full min-w-0 items-center justify-center rounded-full px-3.5 text-[12px] font-medium transition',
      action.tone === 'primary'
        ? 'bg-slate-900 text-white hover:translate-y-[-1px] hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'
        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900',
    );

    if (action.href) {
      return (
        <Link href={action.href} className={actionClass}>
          <span className="truncate">{action.label}</span>
        </Link>
      );
    }

    return (
      <button
        type="button"
        onClick={action.onClick}
        disabled={action.disabled}
        className={cn(
          actionClass,
          action.disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className="truncate">{action.label}</span>
      </button>
    );
  };

  return (
    <article
      className={cn(
        'group relative flex w-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950',
        getFrameClass(compact, layoutContext),
        className,
      )}
      style={{ ...cardAccentStyle, contentVisibility: 'auto' }}
    >
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          isRailPreview ? 'p-2.5' : compact ? 'p-2.5' : 'p-3',
        )}
      >
        <Link
          href={contentHref}
          className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[18px] focus-visible:outline-none"
          aria-label={item.title}
        >
          <CategoryPreview
            item={item}
            locale={locale}
            compact={compact}
            minimal={isRailPreview}
            simple={simple}
            showPrice={showPrice}
            primaryLabel={primary.label}
          />
        </Link>

        {simple ? (
          <div className="mt-2.5">
            {renderAction(primary)}
          </div>
        ) : shouldCollapseActionsInRail ? (
          <div className="mt-2.5">
            {renderAction(primary)}
          </div>
        ) : (
          <div
            className={cn(
              'mt-2.5 grid gap-2',
              !secondaryAction ? 'grid-cols-1' : 'grid-cols-2',
            )}
          >
            {renderAction(primary)}
            {secondaryAction ? renderAction(secondaryAction) : null}
          </div>
        )}

        {!simple && chatError ? (
          <p className="mt-2 text-[10px] font-medium text-rose-600 dark:text-rose-300">
            {chatError}
          </p>
        ) : null}
      </div>
    </article>
  );
}
