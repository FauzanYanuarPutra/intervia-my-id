'use client';

import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import LajuloLogo from '@/components/logo/LajuloLogo';
import { Modal } from '@/components/common/Modal';
import { AuthCtaLink } from '@/components/home/AuthCtaLink';
import {
  buildPrimaryNavItems,
  resolveActivePrimaryNavKey,
} from '@/components/system/navigation/PrimaryNav';
import { useAuth } from '@/context/AuthContext';
import { useChatInbox } from '@/context/ChatInboxContext';
import { useNotificationInbox } from '@/context/NotificationInboxContext';
import { SearchUmkmPreview, type UmkmPreviewStore } from './SearchUmkmPreview';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Briefcase,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Filter,
  Heart,
  ImageIcon,
  Layers3,
  MapPin,
  MessageCircle,
  Package,
  RefreshCcw,
  Search,
  ShieldCheck,
  Store,
  UserRound,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { UMKM_DISCOVERY_PATH } from '@/lib/umkmSurface';
import {
  asString,
  type ContentItem,
  extractContentItems,
  formatIDRFromCents,
  parseImages,
} from '@/lib/content/catalog';
import { buildPublicProfileHrefFromContent } from '@/lib/profile/publicProfileLink';
import {
  getListingSideContextLabel,
  getListingSideLabel,
  resolveListingSide,
  type ListingSide,
} from '@/lib/content/listingSide';
import { resolveUmkmCreateHrefForType } from '@/lib/umkmBusinessFlow';
import { CONTENT_TYPES, getContentTypeShort } from '@/data/contentTypes';
import { cn } from '@/lib/utils';

type SortKey = 'relevance' | 'newest' | 'price_low' | 'price_high';
type TypeKey =
  | 'all'
  | 'job'
  | 'freelancer'
  | 'product'
  | 'property'
  | 'service'
  | 'tool_rental'
  | 'umkm';
type CardType = Exclude<TypeKey, 'all' | 'umkm'> | 'other';
type SideFilter = 'all' | 'demand' | 'supply';
type SearchResultsView = 'results' | 'umkm';

type SearchCard = {
  id: string;
  title: string;
  summary: string;
  location: string;
  priceLabel: string;
  typeLabel: string;
  typeKey: CardType;
  side: ListingSide;
  sideLabel: string;
  sideContextLabel: string;
  image?: string;
  images: string[];
  href: string;
  profileHref?: string | null;
  updatedAt: number;
  priceCents: number | null;
  entityKind: 'person' | 'listing';
  verified: boolean;
  hasMedia: boolean;
};

const PAGE_SIZE = 12;
const FALLBACK_CITIES = ['Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Yogyakarta', 'Makassar'];

const TYPE_OPTIONS: Array<{
  value: TypeKey;
  labelId: string;
  labelEn: string;
  icon: LucideIcon;
}> = [
  { value: 'all', labelId: 'Semua', labelEn: 'All', icon: Layers3 },
  { value: 'product', labelId: 'Supplier', labelEn: 'Supplier', icon: Store },
  { value: 'service', labelId: 'Jasa', labelEn: 'Services', icon: Wrench },
  { value: 'property', labelId: 'Lokasi', labelEn: 'Locations', icon: MapPin },
  { value: 'freelancer', labelId: 'Talent', labelEn: 'Talent', icon: UserRound },
  { value: 'job', labelId: 'Loker', labelEn: 'Jobs', icon: Briefcase },
  { value: 'tool_rental', labelId: 'Sewa', labelEn: 'Rentals', icon: ShieldCheck },
  { value: 'umkm', labelId: 'Usaha', labelEn: 'Business', icon: Store },
];

const SORT_OPTIONS: Array<{ value: SortKey; labelId: string; labelEn: string }> = [
  { value: 'relevance', labelId: 'Paling relevan', labelEn: 'Most relevant' },
  { value: 'newest', labelId: 'Terbaru', labelEn: 'Newest' },
  { value: 'price_low', labelId: 'Harga terendah', labelEn: 'Lowest price' },
  { value: 'price_high', labelId: 'Harga tertinggi', labelEn: 'Highest price' },
];

const HEALTHY_LINKS: Array<{
  href: string;
  labelId: string;
  labelEn: string;
  icon: LucideIcon;
}> = [
  { href: '/search?type=product', labelId: 'Supplier', labelEn: 'Suppliers', icon: Store },
  { href: '/search?type=service', labelId: 'Jasa', labelEn: 'Services', icon: Wrench },
  { href: '/search?type=property', labelId: 'Lokasi', labelEn: 'Locations', icon: MapPin },
  { href: '/search?type=freelancer', labelId: 'Talent', labelEn: 'Talent', icon: UserRound },
  { href: '/search?type=job&side=demand', labelId: 'Loker', labelEn: 'Jobs', icon: Briefcase },
  { href: '/search?type=umkm', labelId: 'Usaha', labelEn: 'Business', icon: Store },
];

function detectLocale(pathname: string): 'id' | 'en' {
  return pathname.startsWith('/id') ? 'id' : 'en';
}

function normalizeType(value: string | null): TypeKey {
  if (value === 'job') return 'job';
  if (
    value === 'freelancer' ||
    value === 'talent' ||
    value === 'user' ||
    value === 'users' ||
    value === 'profile'
  ) {
    return 'freelancer';
  }
  if (value === 'product') return 'product';
  if (value === 'property') return 'property';
  if (value === 'service') return 'service';
  if (value === 'tool_rental') return 'tool_rental';
  if (value === 'umkm') return 'umkm';
  return 'all';
}

function normalizeSort(value: string | null): SortKey {
  if (value === 'newest') return 'newest';
  if (value === 'price_low') return 'price_low';
  if (value === 'price_high') return 'price_high';
  return 'relevance';
}

function normalizeSideFilter(value: string | null): SideFilter {
  if (value === 'demand') return 'demand';
  if (value === 'supply') return 'supply';
  return 'all';
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

function formatShortDate(value: number, locale: 'id' | 'en'): string | null {
  if (!value || !Number.isFinite(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

function resolveCardType(value: string): CardType {
  const normalized = value.toLowerCase();
  if (/(job|career|loker|job_listing|job_posting)/.test(normalized)) return 'job';
  if (
    /(freelancer|talent|profile|profession|professional_title|consultant|designer|developer|writer|photographer|videographer|marketer|engineer|architect|accountant|chef|doctor|creator)/.test(
      normalized,
    )
  ) {
    return 'freelancer';
  }
  if (/(product|market|shop|store)/.test(normalized)) return 'product';
  if (/(service|jasa)/.test(normalized)) return 'service';
  if (/(property|real-estate|real estate|apartment|house|ruko|kios|lapak)/.test(normalized)) {
    return 'property';
  }
  if (/(tool_rental|tool-rental|rental|rent|sewa|pinjam|meminjam)/.test(normalized)) {
    return 'tool_rental';
  }
  return 'other';
}

function inferSearchEntityKind(
  item: ContentItem,
  meta: Record<string, unknown>,
): 'person' | 'listing' {
  const explicitEntityKind = asString(meta.entity_kind)?.toLowerCase();
  const contentType = asString(item.content_type)?.toLowerCase() || '';

  if (explicitEntityKind === 'person' || explicitEntityKind === 'profile') {
    return 'person';
  }

  if (asString(meta.public_path)) {
    return 'person';
  }

  if (/(freelancer|talent|profile)/.test(contentType)) {
    return 'person';
  }

  return 'listing';
}

function isLegacySearchNoise(
  item: ContentItem,
  meta: Record<string, unknown>,
  title: string,
): boolean {
  const contentType = asString(item.content_type)?.toLowerCase() || '';
  const explicitEntityKind = asString(meta.entity_kind)?.toLowerCase();

  if (contentType === 'image') return true;
  if (/^foto\b/i.test(title)) return true;

  if (
    contentType === 'user' &&
    !asString(meta.public_path) &&
    explicitEntityKind !== 'person'
  ) {
    return true;
  }

  return false;
}

function displayTypeLabel(typeKey: CardType, locale: 'id' | 'en'): string {
  if (typeKey === 'product') return locale === 'id' ? 'Supplier' : 'Supplier';
  if (typeKey === 'property') return locale === 'id' ? 'Lokasi Jualan' : 'Selling Spot';
  if (typeKey === 'tool_rental') return locale === 'id' ? 'Sewa Alat' : 'Tool Rental';
  if (typeKey === 'freelancer') return locale === 'id' ? 'Profil Talent' : 'Talent Profile';
  if (typeKey === 'other') return locale === 'id' ? 'Listing' : 'Listing';
  const match = CONTENT_TYPES.find((contentType) => contentType.id === typeKey);
  if (match) return getContentTypeShort(match, locale);
  return locale === 'id' ? 'Listing' : 'Listing';
}

function resolveSearchSideContextLabel(
  side: ListingSide,
  typeKey: CardType,
  locale: 'id' | 'en',
): string {
  if (typeKey === 'product') {
    return locale === 'id'
      ? side === 'demand'
        ? 'Cari distributor'
        : 'Supplier siap jual'
      : side === 'demand'
        ? 'Looking for distributors'
        : 'Suppliers ready to sell';
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

  if (typeKey === 'tool_rental') {
    return locale === 'id'
      ? side === 'demand'
        ? 'Cari alat sewa'
        : 'Alat siap disewa'
      : side === 'demand'
        ? 'Looking for rental tools'
        : 'Tools ready for rent';
  }

  if (typeKey === 'service') {
    return locale === 'id'
      ? side === 'demand'
        ? 'Cari jasa operasional'
        : 'Jasa operasional tersedia'
      : side === 'demand'
        ? 'Looking for operations services'
        : 'Operations services available';
  }

  return getListingSideContextLabel(side, typeKey, locale);
}

function mapContentItem(item: ContentItem, locale: 'id' | 'en'): SearchCard | null {
  const id = String(item.id || '').trim();
  if (!id) return null;

  const meta = item.metadata || {};
  const title = item.title || item.summary || asString(meta.name) || 'Untitled';
  if (isLegacySearchNoise(item, meta, title)) return null;

  const entityKind = inferSearchEntityKind(item, meta);
  const summary = item.summary || asString(meta.tagline) || asString(meta.description) || '';
  const location =
    asString(meta.location) || asString(meta.city) || asString(meta.region) || 'Indonesia';
  const price = formatIDRFromCents(item.price_cents);
  const priceLabel = price !== '-' ? price : locale === 'id' ? 'Negosiasi' : 'Negotiable';

  const typeToken = [
    item.content_type,
    item.category,
    asString(meta.type),
    asString(meta.sector),
    asString(meta.profession),
    asString(meta.professional_title),
    asString(meta.entity_kind),
  ]
    .filter(Boolean)
    .join(' ');

  const typeKey = resolveCardType(typeToken);
  const typeLabel = displayTypeLabel(typeKey, locale);
  const side = resolveListingSide({
    type: item.content_type || item.category,
    metadata: meta,
    title: item.title,
    summary: item.summary,
  });
  const sideLabel = getListingSideLabel(side, locale);
  const sideContextLabel = resolveSearchSideContextLabel(side, typeKey, locale);
  const gallery = parseImages(item);
  const image = gallery[0];
  const profileHref = buildPublicProfileHrefFromContent(item);
  const detailHref =
    entityKind === 'person' && profileHref
      ? profileHref
      : `/content/${slugify(title || 'listing')}-${encodeURIComponent(id)}`;
  const updatedAt = Date.parse(String(item.updated_at || item.created_at || '')) || 0;
  const priceCents = typeof item.price_cents === 'number' ? item.price_cents : null;
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
    priceLabel,
    typeLabel,
    typeKey,
    side,
    sideLabel,
    sideContextLabel,
    image,
    images: gallery,
    href: detailHref,
    profileHref,
    updatedAt,
    priceCents,
    entityKind,
    verified,
    hasMedia: gallery.length > 0,
  };
}

function typeFilterClass(active: boolean) {
  return active
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]';
}

function sideFilterClass(active: boolean, side: SideFilter) {
  if (!active) {
    return 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]';
  }

  if (side === 'demand') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (side === 'supply') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

function SearchMobileBottomNav({
  locale,
  pathname,
  isAuthenticated,
}: {
  locale: 'id' | 'en';
  pathname: string;
  isAuthenticated: boolean;
}) {
  const items = buildPrimaryNavItems(isAuthenticated, locale);
  const activeKey = resolveActivePrimaryNavKey(items, pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-3 lg:hidden"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      aria-label="Mobile primary navigation"
    >
      <div className="mx-auto max-w-md rounded-[30px] border border-[color:color-mix(in_srgb,var(--app-border)_78%,white_12%)] bg-white/96 px-2 pb-2 pt-1.5 shadow-[0_30px_50px_-28px_rgba(15,23,42,0.32)] backdrop-blur-xl">
        <ul className="grid grid-cols-5 items-end gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = activeKey === item.key;
            const isCreate = item.key === 'create';

            return (
              <li key={item.key} className={cn('min-w-0', isCreate && 'relative -mt-3')}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-[22px] px-1 text-[10px] font-semibold transition',
                    active ? 'text-[color:var(--app-accent)]' : 'text-[color:var(--app-text-soft)]',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center justify-center transition',
                      isCreate
                        ? 'h-14 w-14 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] text-white shadow-[0_18px_30px_-18px_rgba(22,163,74,0.6)]'
                        : active
                          ? 'h-10 w-10 rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                          : 'h-10 w-10 rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                    )}
                  >
                    <Icon className={cn(isCreate ? 'h-5 w-5' : 'h-4 w-4')} />
                  </span>
                  <span className={cn(isCreate && 'sr-only')}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

function SearchDesktopTopBar({
  isId,
  query,
  onQueryChange,
  onSubmit,
  onOpenFilters,
  chatHref,
  notificationHref,
  accountHref,
  displayName,
  roleLabel,
  avatarSrc,
  chatUnread,
  notificationUnread,
  isAuthenticated,
  loginLabel,
}: {
  isId: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onOpenFilters: () => void;
  chatHref: string;
  notificationHref: string;
  accountHref: string;
  displayName: string;
  roleLabel: string;
  avatarSrc: string;
  chatUnread: number;
  notificationUnread: number;
  isAuthenticated: boolean;
  loginLabel: string;
}) {
  return (
    <header className="hidden shrink-0 lg:block">
      <div className="flex items-center gap-3 rounded-[30px] border border-[color:var(--app-border)] bg-white/96 px-4 py-3.5 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.2)] backdrop-blur-xl xl:gap-4 xl:px-5 xl:py-4">
        <Link href="/home" className="inline-flex shrink-0 items-center">
          <span className="inline-flex max-w-[154px]">
            <LajuloLogo />
          </span>
        </Link>

        <button
          type="button"
          onClick={onOpenFilters}
          className="hidden min-h-[42px] shrink-0 items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-sm font-semibold text-[color:var(--app-text)] xl:inline-flex"
        >
          <Filter className="h-4 w-4" />
          {isId ? 'Kategori' : 'Category'}
          <ChevronDown className="h-4 w-4" />
        </button>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="min-w-0 flex-1"
        >
          <label className="flex min-h-[54px] items-center gap-3 rounded-[22px] border border-[color:var(--app-border)] bg-white px-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)]">
            <Search className="h-4.5 w-4.5 text-[color:var(--app-accent)]" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={
                isId
                  ? 'Cari supplier, lokasi, jasa, atau talent'
                  : 'Search suppliers, places, services, or talent'
              }
              className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => onQueryChange('')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)]"
                aria-label={isId ? 'Hapus kata kunci' : 'Clear query'}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="submit"
              className="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)] shadow-[0_16px_30px_-20px_rgba(22,163,74,0.55)]"
            >
              {isId ? 'Cari' : 'Search'}
            </button>
          </label>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            href={chatHref}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] xl:w-auto xl:gap-2 xl:px-4"
          >
            <MessageCircle className="h-4.5 w-4.5" />
            <span className="hidden text-sm font-semibold xl:inline">Chat</span>
            {chatUnread > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                {chatUnread > 99 ? '99+' : chatUnread}
              </span>
            ) : null}
          </Link>

          <Link
            href={notificationHref}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] xl:w-auto xl:gap-2 xl:px-4"
          >
            <Bell className="h-4.5 w-4.5" />
            <span className="hidden text-sm font-semibold xl:inline">
              {isId ? 'Notifikasi' : 'Notifications'}
            </span>
            {notificationUnread > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                {notificationUnread > 99 ? '99+' : notificationUnread}
              </span>
            ) : null}
          </Link>

          {isAuthenticated ? (
            <Link
              href={accountHref}
              className="inline-flex min-h-[48px] items-center gap-3 rounded-full border border-[color:var(--app-border)] bg-white px-2.5 pr-2.5 xl:px-3 xl:pr-4"
            >
              <Image
                src={avatarSrc}
                alt={displayName}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover"
              />
              <div className="hidden text-left 2xl:block">
                <p className="max-w-[120px] truncate text-sm font-bold text-[color:var(--app-text)]">
                  {displayName}
                </p>
                <p className="text-[12px] text-[color:var(--app-text-soft)]">{roleLabel}</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-[color:var(--app-text-soft)] 2xl:block" />
            </Link>
          ) : (
            <Link
              href={accountHref}
              className="inline-flex min-h-[44px] items-center rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)] xl:px-5"
            >
              {loginLabel}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function SearchActiveChip({
  icon,
  label,
  onRemove,
}: {
  icon?: LucideIcon;
  label: string;
  onRemove?: () => void;
}) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
      {onRemove ? <X className="h-3.5 w-3.5" /> : null}
    </button>
  );
}

function SearchResultScopeCard({
  value,
  label,
  hint,
  count,
  active,
  onSelect,
}: {
  value: SideFilter;
  label: string;
  hint: string;
  count: number;
  active: boolean;
  onSelect: (value: SideFilter) => void;
}) {
  const iconMap: Record<SideFilter, LucideIcon> = {
    all: Layers3,
    supply: Store,
    demand: UserRound,
  };
  const Icon = iconMap[value];

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        'flex min-h-[54px] items-center justify-between gap-3 rounded-[16px] border px-3 py-2 text-left transition',
        sideFilterClass(active, value),
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] bg-white/70 text-current ring-1 ring-black/5">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-bold leading-tight">{label}</span>
          <span className="block text-[10px] leading-4 opacity-80">{hint}</span>
        </span>
      </span>
      <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-white/80 px-1.5 text-[9px] font-bold text-current">
        {count}
      </span>
    </button>
  );
}

function SearchResultListingCard({
  item,
  locale,
}: {
  item: SearchCard;
  locale: 'id' | 'en';
}) {
  const isId = locale === 'id';
  const previewImage = item.image || item.images[0];
  const updatedLabel = formatShortDate(item.updatedAt, locale);
  const badgeTone =
    item.side === 'supply'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : 'bg-sky-50 text-sky-700 border-sky-100';
  const detailLabel = isId ? 'Lihat detail' : 'View details';
  const profileLabel =
    item.profileHref || item.entityKind === 'person'
      ? isId
        ? 'Lihat profil'
        : 'View profile'
      : isId
        ? 'Buka listing'
        : 'Open listing';
  const secondaryHref = item.profileHref || item.href;
  const featureChips = [
    item.verified ? 'Verified' : null,
    item.typeLabel,
    item.sideContextLabel,
    item.hasMedia ? (isId ? 'Ada foto' : 'Has media') : null,
  ].filter(Boolean) as string[];

  return (
    <article className="overflow-hidden rounded-[26px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_10%)] bg-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.16)]">
      <div className="grid min-w-0 gap-0 lg:grid-cols-[220px_minmax(0,1fr)_220px]">
        <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(145deg,#f7faf7,#eef7ff)] lg:aspect-auto lg:h-full">
          {previewImage ? (
            <Image src={previewImage} alt={item.title} fill className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[color:var(--app-text-soft)]">
              <Package className="h-10 w-10" />
            </div>
          )}
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold', badgeTone)}>
              <BadgeCheck className="h-3.5 w-3.5" />
              {item.verified ? 'Verified' : item.sideLabel}
            </span>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-600 shadow-[0_12px_20px_-16px_rgba(15,23,42,0.24)]"
              aria-label={isId ? 'Simpan' : 'Save'}
            >
              <Heart className="h-4.5 w-4.5" />
            </button>
          </div>
          {item.images.length > 0 ? (
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/58 px-2.5 py-1 text-[11px] font-semibold text-white">
              <ImageIcon className="h-3.5 w-3.5" />
              {item.images.length}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 border-t border-[color:var(--app-border)] p-4 lg:border-l lg:border-t-0 lg:p-5">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-[1.12rem] font-black tracking-[-0.04em] text-[color:var(--app-text)]">
              {item.title}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[color:var(--app-text-soft)]">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {item.location}
              </span>
              {updatedLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" />
                  {updatedLabel}
                </span>
              ) : null}
            </div>
          </div>

          <p className="mt-3 line-clamp-3 text-[13px] leading-6 text-[color:var(--app-text-soft)]">
            {item.summary || (isId ? 'Listing siap dibuka dan ditindaklanjuti langsung.' : 'Listing ready to open and follow up.')}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {featureChips.slice(0, 4).map((chip) => (
              <span
                key={`${item.id}-${chip}`}
                className="inline-flex items-center rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--app-text-soft)]"
              >
                {chip}
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-end justify-between gap-3 lg:hidden">
            <div>
              <p className="text-[11px] font-medium text-[color:var(--app-text-soft)]">
                {isId ? 'Mulai dari' : 'Starting at'}
              </p>
              <p className="mt-1 text-[1.35rem] font-black tracking-[-0.04em] text-emerald-600">
                {item.priceLabel}
              </p>
            </div>
            <Link
              href={item.href}
              className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] border border-emerald-200 px-4 text-[12px] font-semibold text-emerald-700"
            >
              {detailLabel}
            </Link>
          </div>
        </div>

        <div className="hidden border-l border-[color:var(--app-border)] p-5 lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
                {isId ? 'Kategori' : 'Category'}
              </p>
              <p className="mt-1 text-[13px] leading-6 text-[color:var(--app-text)]">{item.typeLabel}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
                {isId ? 'Mulai dari' : 'Starting at'}
              </p>
              <p className="mt-1 text-[1.45rem] font-black tracking-[-0.05em] text-emerald-600">
                {item.priceLabel}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
                {isId ? 'Arah listing' : 'Listing side'}
              </p>
              <p className="mt-1 text-[13px] leading-6 text-[color:var(--app-text)]">{item.sideContextLabel}</p>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              href={item.href}
              className="inline-flex min-h-[42px] w-full items-center justify-center rounded-[14px] border border-emerald-200 px-4 text-[13px] font-semibold text-emerald-700"
            >
              {detailLabel}
            </Link>
            <Link
              href={secondaryHref}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-[13px] font-semibold text-[color:var(--app-text-inverse)] shadow-[0_16px_30px_-20px_rgba(22,163,74,0.5)]"
            >
              {profileLabel}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function SearchPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = detectLocale(pathname);
  const isId = locale === 'id';
  const { isAuthenticated, user } = useAuth();
  const { totalUnread } = useChatInbox();
  const { unreadCount } = useNotificationInbox();

  const initialQuery = (searchParams.get('q') || '').trim();
  const initialLocation = (searchParams.get('location') || '').trim();
  const initialType = normalizeType(searchParams.get('type'));
  const initialSort = normalizeSort(searchParams.get('sort'));
  const initialSideFilter = normalizeSideFilter(searchParams.get('side'));

  const [queryInput, setQueryInput] = useState(initialQuery);
  const [locationInput, setLocationInput] = useState(initialLocation);
  const [query, setQuery] = useState(initialQuery);
  const [location, setLocation] = useState(initialLocation);
  const [type, setType] = useState<TypeKey>(initialType);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [sideFilter, setSideFilter] = useState<SideFilter>(initialSideFilter);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [profileOnly, setProfileOnly] = useState(false);
  const [mediaOnly, setMediaOnly] = useState(false);
  const [resultsView, setResultsView] = useState<SearchResultsView>(
    initialType === 'umkm' ? 'umkm' : 'results',
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [items, setItems] = useState<SearchCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [umkmStores, setUmkmStores] = useState<UmkmPreviewStore[]>([]);
  const [umkmLoading, setUmkmLoading] = useState(false);
  const [umkmError, setUmkmError] = useState<string | null>(null);

  const canToggleUmkmView = type === 'all' || type === 'umkm';
  const shouldShowUmkmPreview = resultsView === 'umkm' || type === 'umkm';
  const shouldShowResultCards = !shouldShowUmkmPreview;

  const displayName =
    user?.fullName || user?.full_name || user?.username || 'Andi Pratama';
  const avatarSrc = user?.avatarUrl || user?.avatar_url || '/default-avatar.svg';
  const chatHref = isAuthenticated ? '/chat' : '/login';
  const notificationsHref = isAuthenticated ? '/notifications' : '/login';
  const accountHref = isAuthenticated ? '/profile' : '/login';
  const roleLabel = isId ? (isAuthenticated ? 'Pengusaha' : 'Tamu') : isAuthenticated ? 'Business Owner' : 'Guest';

  const applyFilters = useCallback(() => {
    const nextQuery = queryInput.trim();
    const nextLocation = locationInput.trim();
    setQuery(nextQuery);
    setLocation(nextLocation);
    if (type === 'umkm') setResultsView('umkm');
    if (resultsView !== 'umkm') setResultsView('results');
  }, [locationInput, queryInput, resultsView, type]);

  const resetAllFilters = useCallback(() => {
    setQueryInput('');
    setLocationInput('');
    setQuery('');
    setLocation('');
    setType('all');
    setSort('relevance');
    setSideFilter('all');
    setVerifiedOnly(false);
    setProfileOnly(false);
    setMediaOnly(false);
    setResultsView('results');
    setFiltersOpen(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (location) params.set('location', location);
    if (type !== 'all') params.set('type', type);
    if (sort !== 'relevance') params.set('sort', sort);
    if (sideFilter !== 'all') params.set('side', sideFilter);
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }, [location, pathname, query, router, sideFilter, sort, type]);

  const loadResults = useCallback(
    async (mode: 'replace' | 'append') => {
      if (type === 'umkm') {
        setItems([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      if (mode === 'replace') {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (location) params.set('location', location);
        if (type !== 'all') params.set('type', type);
        params.set('include_owner', '1');
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(mode === 'append' ? offset : 0));

        const response = await fetch(`/api/content?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            (payload as { error?: string }).error ||
              (isId ? 'Gagal memuat hasil pencarian' : 'Failed to load search results'),
          );
        }

        const nextItems = extractContentItems(payload)
          .map((item) => mapContentItem(item, locale))
          .filter((item): item is SearchCard => Boolean(item));

        setItems((prev) => (mode === 'append' ? [...prev, ...nextItems] : nextItems));
        setOffset((mode === 'append' ? offset : 0) + nextItems.length);
        setHasMore(nextItems.length === PAGE_SIZE);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load results');
        if (mode === 'replace') setItems([]);
      } finally {
        if (mode === 'replace') setLoading(false);
        else setLoadingMore(false);
      }
    },
    [isId, locale, location, offset, query, type],
  );

  useEffect(() => {
    void loadResults('replace');
  }, [loadResults, refreshKey]);

  useEffect(() => {
    if (type !== 'all' && type !== 'umkm') {
      setUmkmStores([]);
      setUmkmLoading(false);
      setUmkmError(null);
      return;
    }

    const load = async () => {
      setUmkmLoading(true);
      setUmkmError(null);

      try {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (location) params.set('city', location);
        params.set('limit', '10');

        const response = await fetch(`/api/super-app/umkm/stores?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            (payload as { error?: string }).error ||
              (isId ? 'Gagal memuat usaha' : 'Failed to load businesses'),
          );
        }

        const nextStores = ((payload as { data?: { items?: UmkmPreviewStore[] } }).data?.items ||
          []) as UmkmPreviewStore[];
        setUmkmStores(nextStores);
      } catch (err) {
        setUmkmStores([]);
        setUmkmError(err instanceof Error ? err.message : 'Failed to load businesses');
      } finally {
        setUmkmLoading(false);
      }
    };

    void load();
  }, [isId, location, query, type]);

  const visibleItems = useMemo(() => {
    const next = [...items].filter((item) => {
      if (sideFilter !== 'all' && item.side !== sideFilter) return false;
      if (verifiedOnly && !item.verified) return false;
      if (profileOnly && item.entityKind !== 'person') return false;
      if (mediaOnly && !item.hasMedia) return false;
      return true;
    });

    if (sort === 'newest') {
      next.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    if (sort === 'price_low') {
      next.sort(
        (a, b) =>
          (a.priceCents ?? Number.MAX_SAFE_INTEGER) - (b.priceCents ?? Number.MAX_SAFE_INTEGER),
      );
    }
    if (sort === 'price_high') {
      next.sort((a, b) => (b.priceCents ?? 0) - (a.priceCents ?? 0));
    }

    return next;
  }, [items, mediaOnly, profileOnly, sideFilter, sort, verifiedOnly]);

  const resultCountLabel = new Intl.NumberFormat(isId ? 'id-ID' : 'en-US').format(
    visibleItems.length,
  );
  const popularCities = useMemo(() => {
    const citySet = new Set<string>();
    [...visibleItems.map((item) => item.location), ...umkmStores.map((store) => store.city)]
      .map((city) => String(city || '').trim())
      .filter(Boolean)
      .forEach((city) => citySet.add(city));
    return citySet.size > 0 ? Array.from(citySet).slice(0, 6) : FALLBACK_CITIES;
  }, [umkmStores, visibleItems]);
  const sideCounts = useMemo(
    () => ({
      all: items.length,
      supply: items.filter((item) => item.side === 'supply').length,
      demand: items.filter((item) => item.side === 'demand').length,
    }),
    [items],
  );
  const activeFilterCount =
    Number(Boolean(query)) +
    Number(Boolean(location)) +
    Number(type !== 'all') +
    Number(sort !== 'relevance') +
    Number(sideFilter !== 'all') +
    Number(verifiedOnly) +
    Number(profileOnly) +
    Number(mediaOnly);
  const canReset = activeFilterCount > 0;
  const resultsHeading = query
    ? isId
      ? `Hasil pencarian "${query}"`
      : `Search results for "${query}"`
    : isId
      ? 'Temukan supplier, jasa, dan peluang usaha'
      : 'Find suppliers, services, and business opportunities';
  const resultsSubheading = loading && visibleItems.length === 0
    ? isId
      ? 'Memuat hasil...'
      : 'Loading results...'
    : isId
      ? `${hasMore ? `${resultCountLabel}+` : resultCountLabel} hasil ditemukan`
      : `${hasMore ? `${resultCountLabel}+` : resultCountLabel} results found`;
  const activeTypeLabel =
    TYPE_OPTIONS.find((option) => option.value === type)?.[isId ? 'labelId' : 'labelEn'] ||
    (isId ? 'Semua' : 'All');
  const activeSortLabel =
    SORT_OPTIONS.find((option) => option.value === sort)?.[isId ? 'labelId' : 'labelEn'] ||
    (isId ? 'Paling relevan' : 'Most relevant');
  const topResult = visibleItems[0];
  const desktopShellStyle = {
    height: 'calc(100svh - max(env(safe-area-inset-top), 0.75rem) - 1rem)',
  };
  const mobileMapLabel =
    canToggleUmkmView && resultsView === 'umkm'
      ? isId
        ? 'Daftar'
        : 'List'
      : isId
        ? 'Peta'
        : 'Map';
  const briefCreateHref = resolveUmkmCreateHrefForType(locale, type);
  const briefCreateLabel =
    isId
      ? type === 'service'
        ? 'Posting kebutuhan jasa'
        : type === 'freelancer' || type === 'job'
          ? 'Posting kebutuhan talent'
          : 'Posting kebutuhan supplier'
      : type === 'service'
        ? 'Post a service need'
        : type === 'freelancer' || type === 'job'
          ? 'Post a talent need'
          : 'Post a supplier need';

  const openUmkmPreview = () => router.push(UMKM_DISCOVERY_PATH);
  const applyCity = (city: string) => {
    setLocationInput(city);
    setLocation(city);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#edf8f0_0%,#f8fbff_34%,#f8fafc_100%)]">
      <div
        className="mx-auto max-w-[1640px] px-3 pb-28 lg:px-5 lg:pb-4 2xl:px-6"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
      >
        <div className="space-y-4 lg:hidden">
          <div className="flex items-center gap-3 px-1">
            <Link
              href="/home"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] shadow-[0_16px_30px_-24px_rgba(15,23,42,0.18)]"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                applyFilters();
              }}
              className="min-w-0 flex-1"
            >
              <label className="flex min-h-[58px] items-center gap-3 rounded-full border border-[color:var(--app-border)] bg-white px-4 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.16)]">
                <Search className="h-4.5 w-4.5 text-[color:var(--app-accent)]" />
                <input
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder={
                    isId
                      ? 'Cari supplier, lokasi, jasa, atau talent'
                      : 'Search suppliers, places, services, or talent'
                  }
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
                />
              </label>
            </form>
            {canToggleUmkmView ? (
              <button
                type="button"
                onClick={() => setResultsView(resultsView === 'umkm' ? 'results' : 'umkm')}
                className="inline-flex min-h-[58px] items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-white px-4 text-[14px] font-semibold text-[color:var(--app-text)] shadow-[0_16px_30px_-24px_rgba(15,23,42,0.16)]"
              >
                <Layers3 className="h-4.5 w-4.5" />
                {mobileMapLabel}
              </button>
            ) : null}
          </div>

          <section className="rounded-[30px] border border-[color:color-mix(in_srgb,var(--app-border)_90%,white_10%)] bg-white/96 p-4 shadow-[0_22px_48px_-36px_rgba(15,23,42,0.14)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-[1.7rem] font-black tracking-[-0.05em] text-[color:var(--app-text)]">
                  {query ? (isId ? 'Hasil pencarian' : 'Search results') : resultsHeading}
                </h1>
                <p className="mt-1 text-[15px] text-[color:var(--app-text-soft)]">
                  <span className="font-semibold text-emerald-600">
                    {hasMore ? `${resultCountLabel}+` : resultCountLabel}
                  </span>{' '}
                  {isId ? 'hasil ditemukan' : 'results found'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-[16px] border border-[color:var(--app-border)] px-4 text-[14px] font-semibold text-[color:var(--app-text)]"
              >
                <Filter className="h-4.5 w-4.5" />
                {isId ? 'Urutkan' : 'Sort'}
              </button>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 text-[13px] font-semibold text-emerald-700"
              >
                <Filter className="h-4 w-4" />
                {activeFilterCount > 0
                  ? `${isId ? 'Filter' : 'Filters'} (${activeFilterCount})`
                  : isId
                    ? 'Filter'
                    : 'Filters'}
              </button>
              {location ? (
                <SearchActiveChip
                  icon={MapPin}
                  label={location}
                  onRemove={() => {
                    setLocationInput('');
                    setLocation('');
                  }}
                />
              ) : null}
              {type !== 'all' ? (
                <SearchActiveChip
                  icon={TYPE_OPTIONS.find((option) => option.value === type)?.icon}
                  label={activeTypeLabel}
                  onRemove={() => setType('all')}
                />
              ) : null}
              {verifiedOnly ? (
                <SearchActiveChip
                  icon={BadgeCheck}
                  label={isId ? 'Verified' : 'Verified'}
                  onRemove={() => setVerifiedOnly(false)}
                />
              ) : null}
              {sort !== 'relevance' ? (
                <SearchActiveChip label={activeSortLabel} onRemove={() => setSort('relevance')} />
              ) : null}
            </div>

            {canReset ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="inline-flex items-center gap-2 text-[13px] font-semibold text-emerald-600"
                >
                  <RefreshCcw className="h-4 w-4" />
                  {isId ? 'Reset filter' : 'Reset filters'}
                </button>
              </div>
            ) : null}
          </section>

          {shouldShowUmkmPreview ? (
            <SearchUmkmPreview
              isId={isId}
              stores={umkmStores}
              loading={umkmLoading}
              error={umkmError}
              onOpenUmkmView={openUmkmPreview}
              onApplyCity={applyCity}
            />
          ) : null}

          {shouldShowResultCards ? (
            loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`mobile-loading-${index}`}
                    className="h-[210px] animate-pulse rounded-[26px] border border-[color:var(--app-border)] bg-white"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setRefreshKey((value) => value + 1)}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-rose-700"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  {isId ? 'Coba lagi' : 'Retry'}
                </button>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="rounded-[26px] border border-[color:var(--app-border)] bg-white px-5 py-8 text-center shadow-[0_18px_36px_-28px_rgba(15,23,42,0.12)]">
                <p className="text-[15px] text-[color:var(--app-text-soft)]">
                  {isId ? 'Belum ada hasil yang cocok.' : 'No matching results yet.'}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <AuthCtaLink
                    hrefWhenAuth={briefCreateHref}
                    hrefWhenGuest="/register"
                    className="inline-flex items-center rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 py-2 text-[12px] font-semibold text-white"
                    ariaLabel={briefCreateLabel}
                  >
                    {briefCreateLabel}
                  </AuthCtaLink>
                  {HEALTHY_LINKS.slice(0, 3).map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] px-3 py-2 text-[12px] font-semibold text-[color:var(--app-text)]"
                    >
                      <link.icon className="h-4 w-4" />
                      {isId ? link.labelId : link.labelEn}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleItems.map((item) => (
                  <SearchResultListingCard key={item.id} item={item} locale={locale} />
                ))}
              </div>
            )
          ) : null}

          {visibleItems.length > 0 && shouldShowResultCards && !loading ? (
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="text-[13px] text-[color:var(--app-text-soft)]">
                {isId
                  ? `Menampilkan 1 - ${visibleItems.length} dari ${hasMore ? `${resultCountLabel}+` : resultCountLabel} hasil`
                  : `Showing 1 - ${visibleItems.length} of ${hasMore ? `${resultCountLabel}+` : resultCountLabel} results`}
              </p>
              {hasMore ? (
                <button
                  type="button"
                  onClick={() => void loadResults('append')}
                  className="inline-flex min-h-[46px] items-center rounded-[14px] border border-emerald-200 px-4 text-[13px] font-semibold text-emerald-700"
                >
                  {loadingMore ? (isId ? 'Memuat...' : 'Loading...') : isId ? 'Tampilkan lebih banyak' : 'Load more'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="hidden overflow-hidden lg:flex lg:flex-col lg:gap-4" style={desktopShellStyle}>
          <SearchDesktopTopBar
            isId={isId}
            query={queryInput}
            onQueryChange={setQueryInput}
            onSubmit={applyFilters}
            onOpenFilters={() => setFiltersOpen(true)}
            chatHref={chatHref}
            notificationHref={notificationsHref}
            accountHref={accountHref}
            displayName={displayName}
            roleLabel={roleLabel}
            avatarSrc={avatarSrc}
            chatUnread={totalUnread}
            notificationUnread={unreadCount}
            isAuthenticated={isAuthenticated}
            loginLabel={isId ? 'Masuk' : 'Login'}
          />

          <div className="min-h-0 flex flex-1 gap-4 xl:gap-5">
            <aside className="hidden lg:block lg:min-h-0 lg:w-[286px]">
              <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
                <section className="rounded-[28px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.14)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[1rem] font-black tracking-[-0.03em] text-[color:var(--app-text)]">
                        {isId ? 'Filter' : 'Filters'}
                      </p>
                      <p className="text-[12px] text-[color:var(--app-text-soft)]">
                        {activeFilterCount > 0
                          ? `${activeFilterCount} ${isId ? 'filter aktif' : 'active filters'}`
                          : isId
                            ? 'Atur hasil biar lebih rapi'
                            : 'Tune results quickly'}
                      </p>
                    </div>
                    {canReset ? (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="text-[12px] font-semibold text-emerald-600"
                      >
                        {isId ? 'Reset' : 'Reset'}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                        {isId ? 'Lokasi' : 'Location'}
                      </p>
                      <label className="mt-2 flex min-w-0 items-center gap-2 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2">
                        <MapPin className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
                        <input
                          value={locationInput}
                          onChange={(event) => setLocationInput(event.target.value)}
                          placeholder={isId ? 'Cari lokasi' : 'Search location'}
                          className="min-h-[32px] w-full min-w-0 bg-transparent text-[13px] text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {popularCities.map((city) => (
                          <button
                            key={city}
                            type="button"
                            onClick={() => applyCity(city)}
                            className={cn(
                              'inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold transition',
                              location === city || locationInput === city
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]',
                            )}
                          >
                            {city}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                        {isId ? 'Kategori' : 'Category'}
                      </p>
                      <div className="mt-2 grid gap-2">
                        {TYPE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setType(option.value);
                              if (option.value === 'umkm') setResultsView('umkm');
                            }}
                            className={cn(
                              'flex min-h-[44px] items-center gap-3 rounded-[16px] border px-3 py-2 text-left text-[12px] font-semibold transition',
                              typeFilterClass(type === option.value),
                            )}
                          >
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--app-surface-muted)]">
                              <option.icon className="h-4.5 w-4.5" />
                            </span>
                            <span>{isId ? option.labelId : option.labelEn}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                        {isId ? 'Sisi listing' : 'Listing side'}
                      </p>
                      <div className="mt-2 grid gap-2">
                        <SearchResultScopeCard
                          value="all"
                          label={isId ? 'Semua' : 'All'}
                          hint={isId ? 'Lihat semua listing' : 'See every listing'}
                          count={sideCounts.all}
                          active={sideFilter === 'all'}
                          onSelect={setSideFilter}
                        />
                        <SearchResultScopeCard
                          value="supply"
                          label={isId ? 'Penyedia' : 'Providers'}
                          hint={isId ? 'Supplier siap dihubungi' : 'Suppliers ready to contact'}
                          count={sideCounts.supply}
                          active={sideFilter === 'supply'}
                          onSelect={setSideFilter}
                        />
                        <SearchResultScopeCard
                          value="demand"
                          label={isId ? 'Pencari' : 'Seekers'}
                          hint={isId ? 'Buyer dan kebutuhan aktif' : 'Buyers and active needs'}
                          count={sideCounts.demand}
                          active={sideFilter === 'demand'}
                          onSelect={setSideFilter}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                        {isId ? 'Filter cepat' : 'Quick filters'}
                      </p>
                      <div className="mt-2 grid gap-2">
                        {[
                          { active: verifiedOnly, label: 'Verified', icon: BadgeCheck, setter: setVerifiedOnly },
                          { active: profileOnly, label: isId ? 'Profil publik' : 'Public profiles', icon: UserRound, setter: setProfileOnly },
                          { active: mediaOnly, label: isId ? 'Ada foto' : 'Has media', icon: ImageIcon, setter: setMediaOnly },
                        ].map((option) => (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => option.setter(!option.active)}
                            className={cn(
                              'flex min-h-[42px] items-center justify-between rounded-[14px] border px-3 text-[12px] font-semibold transition',
                              option.active
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)]',
                            )}
                          >
                            <span className="inline-flex items-center gap-2">
                              <option.icon className="h-4 w-4" />
                              {option.label}
                            </span>
                            {option.active ? <BadgeCheck className="h-4 w-4" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                        {isId ? 'Urutkan' : 'Sort'}
                      </p>
                      <div className="mt-2 grid gap-2">
                        {SORT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSort(option.value)}
                            className={cn(
                              'flex min-h-[42px] items-center justify-between rounded-[14px] border px-3 text-left text-[12px] font-semibold transition',
                              sort === option.value
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)]',
                            )}
                          >
                            <span>{isId ? option.labelId : option.labelEn}</span>
                            {sort === option.value ? <BadgeCheck className="h-4 w-4" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-2 pt-1">
                      <button
                        type="button"
                        onClick={applyFilters}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-[13px] font-semibold text-[color:var(--app-text-inverse)] shadow-[0_18px_30px_-20px_rgba(22,163,74,0.46)]"
                      >
                        {isId ? 'Terapkan filter' : 'Apply filters'}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </aside>

            <section className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1">
              <div className="mx-auto max-w-[1020px] space-y-4 pb-10">
                <section className="rounded-[30px] border border-[color:var(--app-border)] bg-white/96 p-5 shadow-[0_22px_50px_-36px_rgba(15,23,42,0.14)] backdrop-blur-xl">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h1 className="text-[2rem] font-black tracking-[-0.05em] text-[color:var(--app-text)]">
                        {resultsHeading}
                      </h1>
                      <p className="mt-2 text-[15px] text-[color:var(--app-text-soft)]">
                        {resultsSubheading}
                      </p>
                      {topResult ? (
                        <p className="mt-2 text-[12px] text-[color:var(--app-text-soft)]">
                          {isId ? 'Hasil teratas:' : 'Top result:'}{' '}
                          <span className="font-semibold text-[color:var(--app-text)]">
                            {topResult.title}
                          </span>
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canToggleUmkmView ? (
                        <button
                          type="button"
                          onClick={() => setResultsView(resultsView === 'umkm' ? 'results' : 'umkm')}
                          className="inline-flex min-h-[42px] items-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-white px-4 text-[13px] font-semibold text-[color:var(--app-text)]"
                        >
                          <Layers3 className="h-4 w-4" />
                          {resultsView === 'umkm'
                            ? isId
                              ? 'Kembali ke daftar'
                              : 'Back to list'
                            : isId
                              ? 'Buka peta usaha'
                              : 'Open business map'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex min-h-[42px] items-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-white px-4 text-[13px] font-semibold text-[color:var(--app-text)]"
                      >
                        <Heart className="h-4 w-4" />
                        {isId ? 'Simpan pencarian' : 'Save search'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltersOpen(true)}
                        className="inline-flex min-h-[42px] items-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-white px-4 text-[13px] font-semibold text-[color:var(--app-text)]"
                      >
                        <Filter className="h-4 w-4" />
                        {activeSortLabel}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {location ? (
                      <SearchActiveChip icon={MapPin} label={`Lokasi: ${location}`} onRemove={() => {
                        setLocationInput('');
                        setLocation('');
                      }} />
                    ) : null}
                    {type !== 'all' ? (
                      <SearchActiveChip
                        icon={TYPE_OPTIONS.find((option) => option.value === type)?.icon}
                        label={activeTypeLabel}
                        onRemove={() => setType('all')}
                      />
                    ) : null}
                    {sideFilter !== 'all' ? (
                      <SearchActiveChip
                        label={sideFilter === 'demand' ? (isId ? 'Pencari' : 'Seekers') : isId ? 'Penyedia' : 'Providers'}
                        onRemove={() => setSideFilter('all')}
                      />
                    ) : null}
                    {verifiedOnly ? (
                      <SearchActiveChip icon={BadgeCheck} label="Verified" onRemove={() => setVerifiedOnly(false)} />
                    ) : null}
                    {profileOnly ? (
                      <SearchActiveChip
                        icon={UserRound}
                        label={isId ? 'Profil publik' : 'Public profiles'}
                        onRemove={() => setProfileOnly(false)}
                      />
                    ) : null}
                    {mediaOnly ? (
                      <SearchActiveChip
                        icon={ImageIcon}
                        label={isId ? 'Ada foto' : 'Has media'}
                        onRemove={() => setMediaOnly(false)}
                      />
                    ) : null}
                    {canReset ? (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="inline-flex items-center gap-2 px-2 py-1.5 text-[12px] font-semibold text-emerald-600"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        {isId ? 'Reset semua' : 'Reset all'}
                      </button>
                    ) : null}
                  </div>
                </section>

                {shouldShowUmkmPreview ? (
                  <SearchUmkmPreview
                    isId={isId}
                    stores={umkmStores}
                    loading={umkmLoading}
                    error={umkmError}
                    onOpenUmkmView={openUmkmPreview}
                    onApplyCity={applyCity}
                  />
                ) : null}

                {shouldShowResultCards ? (
                  loading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div
                          key={`desktop-loading-${index}`}
                          className="h-[220px] animate-pulse rounded-[26px] border border-[color:var(--app-border)] bg-white"
                        />
                      ))}
                    </div>
                  ) : error ? (
                    <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
                      <p>{error}</p>
                      <button
                        type="button"
                        onClick={() => setRefreshKey((value) => value + 1)}
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-rose-700"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        {isId ? 'Coba lagi' : 'Retry'}
                      </button>
                    </div>
                  ) : visibleItems.length === 0 ? (
                    <div className="rounded-[28px] border border-[color:var(--app-border)] bg-white px-6 py-10 text-center shadow-[0_18px_36px_-28px_rgba(15,23,42,0.12)]">
                      <p className="text-[16px] text-[color:var(--app-text-soft)]">
                        {isId ? 'Belum ada hasil yang pas.' : 'No perfect match yet.'}
                      </p>
                      <p className="mt-2 text-[13px] text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Coba kategori atau kota lain, atau posting kebutuhan sendiri supaya vendor bisa merespons.'
                          : 'Try another category or city, or post your own need so vendors can respond.'}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <AuthCtaLink
                          hrefWhenAuth={briefCreateHref}
                          hrefWhenGuest="/register"
                          className="inline-flex items-center rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 py-2 text-[12px] font-semibold text-white"
                          ariaLabel={briefCreateLabel}
                        >
                          {briefCreateLabel}
                        </AuthCtaLink>
                        {HEALTHY_LINKS.slice(0, 4).map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] px-3 py-2 text-[12px] font-semibold text-[color:var(--app-text)]"
                          >
                            <link.icon className="h-4 w-4" />
                            {isId ? link.labelId : link.labelEn}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleItems.map((item) => (
                        <SearchResultListingCard key={item.id} item={item} locale={locale} />
                      ))}
                    </div>
                  )
                ) : null}

                {visibleItems.length > 0 && shouldShowResultCards && !loading ? (
                  <div className="flex items-center justify-between gap-3 px-1">
                    <p className="text-[13px] text-[color:var(--app-text-soft)]">
                      {isId
                        ? `Menampilkan 1 - ${visibleItems.length} dari ${hasMore ? `${resultCountLabel}+` : resultCountLabel} hasil`
                        : `Showing 1 - ${visibleItems.length} of ${hasMore ? `${resultCountLabel}+` : resultCountLabel} results`}
                    </p>
                    {hasMore ? (
                      <button
                        type="button"
                        onClick={() => void loadResults('append')}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-[14px] border border-emerald-200 px-4 text-[13px] font-semibold text-emerald-700"
                      >
                        {loadingMore ? <RefreshCcw className="h-4 w-4 animate-spin" /> : null}
                        {isId ? 'Tampilkan lebih banyak' : 'Load more'}
                      </button>
                    ) : (
                      <p className="text-[12px] text-[color:var(--app-text-soft)]">
                        {isId ? 'Semua hasil sudah tampil.' : 'All results are shown.'}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>

      <Modal
        open={filtersOpen}
        title={isId ? 'Filter pencarian' : 'Search filters'}
        onClose={() => setFiltersOpen(false)}
        className="max-w-none rounded-[24px] rounded-b-none p-3 sm:max-w-3xl sm:rounded-[28px] sm:p-5"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white px-4 text-[13px] font-semibold text-[color:var(--app-text)]"
            >
              {isId ? 'Reset' : 'Reset'}
            </button>
            <button
              type="button"
              onClick={() => {
                applyFilters();
                setFiltersOpen(false);
              }}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-5 text-[13px] font-bold text-white shadow-[0_18px_34px_-22px_color-mix(in_srgb,var(--app-accent)_52%,transparent)]"
            >
              {isId ? 'Terapkan filter' : 'Apply filters'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
              {isId ? 'Lokasi' : 'Location'}
            </p>
            <label className="mt-2 flex min-w-0 items-center gap-2 rounded-[16px] border border-[color:var(--app-border)] bg-white px-3 py-2">
              <MapPin className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
              <input
                value={locationInput}
                onChange={(event) => setLocationInput(event.target.value)}
                placeholder={isId ? 'Cari lokasi' : 'Search location'}
                className="min-h-[34px] w-full min-w-0 bg-transparent text-[13px] text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {popularCities.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => applyCity(city)}
                  className={cn(
                    'inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold transition',
                    location === city || locationInput === city
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)]',
                  )}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
              {isId ? 'Kategori' : 'Category'}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setType(option.value);
                    if (option.value === 'umkm') setResultsView('umkm');
                  }}
                  className={cn(
                    'flex min-h-[46px] items-center justify-between gap-2 rounded-[16px] border px-3 py-2 text-left text-[11px] font-semibold transition sm:text-[12px]',
                    typeFilterClass(type === option.value),
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--app-surface-muted)]">
                      <option.icon className="h-4.5 w-4.5" />
                    </span>
                    <span>{isId ? option.labelId : option.labelEn}</span>
                  </span>
                  {type === option.value ? <BadgeCheck className="h-4 w-4" /> : null}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
              {isId ? 'Sisi listing' : 'Listing side'}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <SearchResultScopeCard
                value="all"
                label={isId ? 'Semua' : 'All'}
                hint={isId ? 'Lihat semua listing' : 'See every listing'}
                count={sideCounts.all}
                active={sideFilter === 'all'}
                onSelect={setSideFilter}
              />
              <SearchResultScopeCard
                value="supply"
                label={isId ? 'Penyedia' : 'Providers'}
                hint={isId ? 'Supplier siap dihubungi' : 'Suppliers ready to contact'}
                count={sideCounts.supply}
                active={sideFilter === 'supply'}
                onSelect={setSideFilter}
              />
              <SearchResultScopeCard
                value="demand"
                label={isId ? 'Pencari' : 'Seekers'}
                hint={isId ? 'Buyer dan kebutuhan aktif' : 'Buyers and active needs'}
                count={sideCounts.demand}
                active={sideFilter === 'demand'}
                onSelect={setSideFilter}
              />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
              {isId ? 'Filter cepat' : 'Quick filters'}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {[
                { active: verifiedOnly, label: 'Verified', icon: BadgeCheck, setter: setVerifiedOnly },
                { active: profileOnly, label: isId ? 'Profil publik' : 'Public profiles', icon: UserRound, setter: setProfileOnly },
                { active: mediaOnly, label: isId ? 'Ada foto' : 'Has media', icon: ImageIcon, setter: setMediaOnly },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => option.setter(!option.active)}
                  className={cn(
                    'flex min-h-[44px] items-center justify-between rounded-[14px] border px-3 text-[12px] font-semibold transition',
                    option.active
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)]',
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <option.icon className="h-4 w-4" />
                    {option.label}
                  </span>
                  {option.active ? <BadgeCheck className="h-4 w-4" /> : null}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
              {isId ? 'Urutkan' : 'Sort'}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSort(option.value)}
                  className={cn(
                    'flex min-h-[44px] items-center justify-between rounded-[14px] border px-3 text-left text-[12px] font-semibold transition',
                    sort === option.value
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)]',
                  )}
                >
                  <span>{isId ? option.labelId : option.labelEn}</span>
                  {sort === option.value ? <BadgeCheck className="h-4 w-4" /> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <SearchMobileBottomNav locale={locale} pathname={pathname} isAuthenticated={isAuthenticated} />
    </div>
  );
}
