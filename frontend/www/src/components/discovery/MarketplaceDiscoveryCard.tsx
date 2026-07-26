'use client';

import { useState, type CSSProperties } from 'react';
import { MediaPreviewCarousel } from '@/components/common/MediaPreviewCarousel';
import { useAuth } from '@/context/AuthContext';
import { Link, useRouter } from '@/i18n/navigation';
import { normalizeContentMediaUrl } from '@/lib/content/catalog';
import { cn } from '@/lib/utils';
import {
  BadgeCheck,
  BriefcaseBusiness,
  CircleDollarSign,
  Clock3,
  Heart,
  Handshake,
  House,
  MapPin,
  Package2,
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
  | 'business_transfer'
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
  supplierBadges?: string[];
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
    accent: '#65a30d',
    softText: 'text-lime-800 dark:text-lime-300',
    softBg: 'bg-lime-50 dark:bg-lime-500/10',
  },
  product: {
    accent: '#128a45',
    softText: 'text-emerald-700 dark:text-emerald-300',
    softBg: 'bg-emerald-50 dark:bg-emerald-500/10',
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
  business_transfer: {
    accent: '#047857',
    softText: 'text-emerald-700 dark:text-emerald-300',
    softBg: 'bg-emerald-50 dark:bg-emerald-500/10',
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
  business_transfer: Handshake,
  umkm: Store,
  other: Package2,
};

const CATEGORY_LABELS: Record<DiscoveryCardType, { id: string; en: string }> = {
  job: { id: 'Lowongan', en: 'Jobs' },
  freelancer: { id: 'Freelancer', en: 'Talent' },
  product: { id: 'Produk', en: 'Product' },
  property: { id: 'Properti', en: 'Property' },
  service: { id: 'Jasa', en: 'Service' },
  tool_rental: { id: 'Sewa', en: 'Rental' },
  business_transfer: { id: 'Oper Usaha', en: 'Transfer' },
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

function getSideVisual(side: DiscoveryCardSide): {
  badgeClass: string;
  chipClass: string;
} {
  if (side === 'demand') {
    return {
      badgeClass:
        'bg-[#2563eb] text-white shadow-[0_10px_24px_-16px_rgba(37,99,235,0.75)]',
      chipClass:
        'bg-[#eff6ff] text-[#1d4ed8] ring-1 ring-[#bfdbfe] dark:bg-[rgba(37,99,235,0.16)] dark:text-[#bfdbfe] dark:ring-[rgba(96,165,250,0.28)]',
    };
  }

  return {
    badgeClass:
      'bg-[#059669] text-white shadow-[0_10px_24px_-16px_rgba(5,150,105,0.75)]',
    chipClass:
      'bg-[#ecfdf5] text-[#047857] ring-1 ring-[#a7f3d0] dark:bg-[rgba(5,150,105,0.16)] dark:text-[#a7f3d0] dark:ring-[rgba(52,211,153,0.28)]',
  };
}

export const DISCOVERY_COMPACT_CARD_BASELINE_CLASS =
  'h-[300px] min-h-[300px] max-h-[300px] sm:h-[312px] sm:min-h-[312px] sm:max-h-[312px]';

const RAIL_COMPACT_CARD_FRAME_CLASS =
  'h-[300px] min-h-[300px] max-h-[300px] self-stretch sm:h-[312px] sm:min-h-[312px] sm:max-h-[312px]';
const GRID_COMPACT_CARD_FRAME_CLASS = cn(
  'self-stretch',
  DISCOVERY_COMPACT_CARD_BASELINE_CLASS,
);
const RAIL_COMFORTABLE_CARD_FRAME_CLASS =
  'h-[340px] min-h-[340px] max-h-[340px] self-stretch sm:h-[360px] sm:min-h-[360px] sm:max-h-[360px]';
const GRID_COMFORTABLE_CARD_FRAME_CLASS =
  'h-[340px] min-h-[340px] max-h-[340px] self-stretch sm:h-[360px] sm:min-h-[360px] sm:max-h-[360px]';

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
    value.includes('picsum.photos') ||
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

type MediaCandidateSource = Pick<MarketplaceDiscoveryCardItem, 'images'> & {
  image_urls?: unknown;
  metadata?: { images?: unknown } | null;
  cover_image?: unknown;
};

function uniqueMediaCandidates(item: MediaCandidateSource): string[] {
  const raw =
    item.images ||
    item.image_urls ||
    item.metadata?.images ||
    (item.cover_image ? [item.cover_image] : []);
  const entries = Array.isArray(raw) ? raw : [raw];

  const seen = new Set<string>();

  return entries
    .map(entry => String(entry || '').trim())
    .filter(Boolean)
    .map(entry => normalizeContentMediaUrl(entry))
    .filter(Boolean)
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
          market_side: item.side,
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
      : item.side === 'demand'
        ? locale === 'id'
          ? 'Tanggapi'
          : 'Respond'
        : profileIsPrimary
          ? locale === 'id'
            ? 'Profil'
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
  const images = uniqueMediaCandidates(item);
  const image = images[0] || '';
  const palette = TYPE_ACCENTS[item.typeKey] || TYPE_ACCENTS.other;
  const Icon =
    variant === 'map' ? MapPin : TYPE_ICONS[item.typeKey] || Package2;

  return (
    <div
      className={cn(
        'relative w-full h-full overflow-hidden rounded-[18px] bg-slate-100 dark:bg-slate-900',
        className,
      )}
    >
      {/* IMAGE LAYER */}
      {image ? (
        <MediaPreviewCarousel
          items={images}
          alt={item.title}
          className="absolute inset-0 w-full h-full"
          aspectClassName="w-full h-full"
          mediaClassName="w-full h-full object-cover transition duration-500 group-hover:scale-[1.03]"
          controls={false}
          lightbox={false}
          showCounter={images.length > 1}
          showDots={images.length > 1}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/10 to-transparent">
          <span
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-full',
              palette.softBg,
            )}
          >
            <Icon className={cn('h-5 w-5', palette.softText)} />
          </span>
        </div>
      )}

      {/* OPTIONAL DARK OVERLAY (SAFE, TIDAK NUTUP FULL) */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
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
  const supplierBadges = (item.supplierBadges || []).filter(Boolean);
  const sideVisual = getSideVisual(item.side);
  const sideLabel = String(item.sideLabel || '').trim();
  const detailBadges = [
    String(item.sideContextLabel || '').trim(),
    ...supplierBadges,
  ].filter(Boolean);

  const valueLabel = showPrice
    ? item.priceLabel
    : item.ratingLabel
      ? `${item.ratingLabel} likes`
      : item.verified
        ? locale === 'id'
          ? 'Terverifikasi'
          : 'Verified'
        : primaryLabel;

  const ValueIcon = showPrice
    ? CircleDollarSign
    : item.ratingLabel
      ? Heart
      : item.verified
        ? BadgeCheck
        : null;

  const dense = compact || minimal;
  const heroHeightClass = minimal
    ? 'h-[104px] sm:h-[112px]'
    : compact
      ? 'h-[108px] sm:h-[116px]'
      : simple
        ? 'h-[160px]'
        : 'h-[176px]';

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col',
        dense ? 'gap-1.5' : 'gap-2.5',
      )}
    >
      {/* HERO IMAGE */}
      <div className="relative w-full overflow-hidden rounded-[18px]">
        <div className={cn('relative w-full', heroHeightClass)}>
          <MediaThumb
            item={item}
            compact={compact}
            variant={heroVariant}
            className="w-full h-full"
          />
        </div>

        {/* CATEGORY BADGE */}
        <div className="absolute top-0 left-0 right-0 flex items-start justify-between gap-2 p-2.5">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase',
                TYPE_ACCENTS[item.typeKey].softBg,
                TYPE_ACCENTS[item.typeKey].softText,
              )}
            >
              {categoryLabel}
            </span>
            {sideLabel ? (
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em]',
                  sideVisual.badgeClass,
                )}
              >
                {sideLabel}
              </span>
            ) : null}
          </div>

          {item.verified && (
            <span className="shrink-0 rounded-full bg-white/90 p-1">
              <BadgeCheck className="h-4 w-4" />
            </span>
          )}
        </div>

        {/* SUMMARY OVERLAY */}
        {summaryLabel && !minimal && (
          <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/60">
            <p className="text-white text-[11px] line-clamp-1">
              {summaryLabel}
            </p>
          </div>
        )}
      </div>

      {/* TITLE */}
      <h3
        className={cn(
          'line-clamp-2 font-semibold text-slate-900 dark:text-white',
          dense
            ? 'h-[36px] text-[13px] leading-[18px]'
            : 'h-[40px] text-[15px] leading-5',
        )}
      >
        {item.title}
      </h3>

      {detailBadges.length > 0 && !dense ? (
        <div className="flex h-[24px] max-h-[24px] flex-wrap gap-1.5 overflow-hidden">
          {detailBadges.slice(0, 3).map((badge, index) => (
            <span
              key={badge}
              className={cn(
                'inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold',
                index === 0
                  ? sideVisual.chipClass
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
              )}
            >
              {badge}
            </span>
          ))}
        </div>
      ) : !dense ? (
        <div className="h-[24px] max-h-[24px]" />
      ) : null}

      {/* META */}
      <div
        className={cn(
          'flex flex-wrap gap-1.5 overflow-hidden',
          dense ? 'h-[22px] max-h-[22px]' : 'h-[24px] max-h-[24px]',
        )}
      >
        {locationLabel && (
          <span className="flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
            <MapPin className="h-3 w-3" />
            {locationLabel}
          </span>
        )}

        {updatedLabel && (
          <span className="flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
            <Clock3 className="h-3 w-3" />
            {updatedLabel}
          </span>
        )}
      </div>

      {/* VALUE */}
      <div className="mt-auto">
        <div
          className={cn(
            'flex items-center justify-between rounded-[14px] bg-slate-50 px-3 dark:bg-slate-900',
            dense ? 'py-1.5' : 'py-2',
          )}
        >
          <span
            className={cn(
              'flex min-w-0 items-center gap-1 font-semibold',
              dense ? 'text-xs' : 'text-sm',
            )}
          >
            {ValueIcon && <ValueIcon className="h-4 w-4" />}
            <span className="truncate">{valueLabel}</span>
          </span>
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
          <div className="mt-2.5">{renderAction(primary)}</div>
        ) : shouldCollapseActionsInRail ? (
          <div className="mt-2.5">{renderAction(primary)}</div>
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
