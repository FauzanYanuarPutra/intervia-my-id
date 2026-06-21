'use client';

import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { MediaPreviewCarousel } from '@/components/common/MediaPreviewCarousel';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll';
import { Link, useRouter } from '@/i18n/navigation';
import { Modal } from '@/components/common/Modal';
import { AuthCtaLink } from '@/components/home/AuthCtaLink';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import { useAppBack } from '@/lib/navigation/useAppBack';
import { SearchUmkmPreview, type UmkmPreviewStore } from './SearchUmkmPreview';
import {
  ArrowRight,
  BadgeCheck,
  BookmarkCheck,
  BookmarkPlus,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  Handshake,
  Layers3,
  MapPin,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  UserRound,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  buildUmkmStorefrontPath,
  UMKM_DISCOVERY_PATH,
} from '@/lib/umkmSurface';
import {
  EMPTY_SEARCH_CART_SESSION,
  clearSearchCartSession,
  readSearchCartSession,
  removeSearchCartItem,
  subscribeSearchCartSession,
  upsertSearchCartItem,
  type SearchCartItemInput,
  type SearchCartItemKind,
  type SearchCartSession,
} from '@/lib/searchCartSession';
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
import {
  buildPublicProfileHref,
  buildPublicProfileHrefFromContent,
} from '@/lib/profile/publicProfileLink';
import {
  getListingSideContextLabel,
  getListingSideLabel,
  resolveListingSide,
  type ListingSide,
} from '@/lib/content/listingSide';
import {
  resolveMarketplaceCreateHref,
  resolveUmkmCreateHrefForType,
} from '@/lib/umkmBusinessFlow';
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
  | 'business_transfer'
  | 'umkm';
type CardType = Exclude<TypeKey, 'all' | 'umkm'> | 'other';
type SideFilter = 'all' | 'demand' | 'supply';
type SearchResultsView = 'results' | 'umkm';
type SearchVisualKey = TypeKey | 'other';
type SearchFilterTabKey = TypeKey | 'used_goods';

type SearchCard = {
  id: string;
  title: string;
  summary: string;
  location: string;
  priceLabel: string;
  priceUnitLabel: string;
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
  ownerId?: string | null;
  ownerName?: string | null;
  storeId?: string | null;
  storeSlug?: string | null;
  storeName?: string | null;
  productId?: string | null;
};

type DiscoverUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  avatar_style?: unknown;
  metadata?: unknown;
  location?: string | null;
  bio?: string | null;
  headline?: string | null;
  roles?: string[] | null;
  metadata_roles?: unknown;
  level?: string | null;
  rating?: number | null;
  completed_jobs?: number | null;
  hourly_rate?: number | null;
  freelancer_profile?: unknown;
  provider_profile?: unknown;
  buyer_profile?: unknown;
  created_at?: string | null;
};

type SearchProfileCard = {
  id: string;
  href: string;
  name: string;
  handle: string;
  headline: string;
  location: string;
  avatarUrl: string;
  verified: boolean;
  roleLabel: string;
  ratingLabel: string | null;
  roles: string[];
  createdAt: number;
};

const PAGE_SIZE = 12;
const FALLBACK_CITIES = [
  'Jakarta',
  'Bandung',
  'Surabaya',
  'Medan',
  'Yogyakarta',
  'Makassar',
];

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
    {
      value: 'freelancer',
      labelId: 'Talent',
      labelEn: 'Talent',
      icon: UserRound,
    },
    { value: 'job', labelId: 'Loker', labelEn: 'Jobs', icon: Briefcase },
    {
      value: 'tool_rental',
      labelId: 'Sewa',
      labelEn: 'Rentals',
      icon: ShieldCheck,
    },
    {
      value: 'business_transfer',
      labelId: 'Oper Usaha',
      labelEn: 'Business Transfer',
      icon: Handshake,
    },
    { value: 'umkm', labelId: 'Usaha', labelEn: 'Business', icon: Store },
  ];

const SEARCH_FILTER_TABS: Array<{
  value: SearchFilterTabKey;
  labelId: string;
  labelEn: string;
  icon: LucideIcon;
}> = [
    { value: 'all', labelId: 'Semua', labelEn: 'All', icon: Layers3 },
    { value: 'product', labelId: 'Supplier', labelEn: 'Supplier', icon: Store },
    {
      value: 'used_goods',
      labelId: 'Barang Bekas',
      labelEn: 'Used Goods',
      icon: Package,
    },
    { value: 'service', labelId: 'Jasa', labelEn: 'Services', icon: Wrench },
    { value: 'property', labelId: 'Lokasi', labelEn: 'Locations', icon: MapPin },
    {
      value: 'business_transfer',
      labelId: 'Oper Usaha',
      labelEn: 'Business Transfer',
      icon: Handshake,
    },
    {
      value: 'freelancer',
      labelId: 'Talent',
      labelEn: 'Talent',
      icon: UserRound,
    },
    { value: 'umkm', labelId: 'Usaha', labelEn: 'Business', icon: Store },
  ];

const SORT_OPTIONS: Array<{
  value: SortKey;
  labelId: string;
  labelEn: string;
}> = [
    { value: 'relevance', labelId: 'Paling relevan', labelEn: 'Most relevant' },
    { value: 'newest', labelId: 'Terbaru', labelEn: 'Newest' },
    { value: 'price_low', labelId: 'Kisaran rendah', labelEn: 'Lower range' },
    { value: 'price_high', labelId: 'Kisaran tinggi', labelEn: 'Higher range' },
  ];

type CategoryVisual = {
  icon: LucideIcon;
  hintId: string;
  hintEn: string;
  cardClass: string;
  imageClass: string;
  iconBubbleClass: string;
  activeFilterClass: string;
  inactiveFilterClass: string;
  chipClass: string;
  ribbonClass: string;
  priceClass: string;
  outlineButtonClass: string;
  solidButtonClass: string;
  sidePanelClass: string;
};

const CATEGORY_VISUALS: Record<SearchVisualKey, CategoryVisual> = {
  all: {
    icon: Layers3,
    hintId: 'Semua jalur usaha',
    hintEn: 'All business lanes',
    cardClass: 'border-slate-200 bg-white',
    imageClass: 'bg-[linear-gradient(145deg,#f8fafc,#eef2ff)]',
    iconBubbleClass: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
    activeFilterClass: 'border-slate-300 bg-slate-100 text-slate-800',
    inactiveFilterClass:
      'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
    chipClass: 'bg-slate-100 text-slate-700 border-slate-200',
    ribbonClass: 'bg-slate-900/80 text-white',
    priceClass: 'text-slate-700',
    outlineButtonClass:
      'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    solidButtonClass:
      'bg-slate-900 text-white shadow-[0_14px_26px_-20px_rgba(15,23,42,0.48)]',
    sidePanelClass: 'bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]',
  },
  product: {
    icon: Store,
    hintId: 'Supplier & produk',
    hintEn: 'Suppliers & products',
    cardClass:
      'border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f4fff8_100%)]',
    imageClass: 'bg-[linear-gradient(145deg,#ecfdf5,#ffffff)]',
    iconBubbleClass: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
    activeFilterClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    inactiveFilterClass:
      'border-emerald-100 bg-white text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50',
    chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    ribbonClass: 'bg-emerald-700/90 text-white',
    priceClass: 'text-emerald-600',
    outlineButtonClass:
      'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50',
    solidButtonClass:
      'bg-[linear-gradient(135deg,#10b981,#047857)] text-white shadow-[0_14px_26px_-20px_rgba(16,185,129,0.55)]',
    sidePanelClass: 'bg-[linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)]',
  },
  service: {
    icon: Wrench,
    hintId: 'Jasa operasional',
    hintEn: 'Business services',
    cardClass:
      'border-teal-100 bg-[linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)]',
    imageClass: 'bg-[linear-gradient(145deg,#ccfbf1,#ffffff)]',
    iconBubbleClass: 'bg-teal-100 text-teal-700 ring-1 ring-teal-200',
    activeFilterClass: 'border-teal-200 bg-teal-50 text-teal-700',
    inactiveFilterClass:
      'border-teal-100 bg-white text-teal-700 hover:border-teal-200 hover:bg-teal-50',
    chipClass: 'bg-teal-50 text-teal-700 border-teal-100',
    ribbonClass: 'bg-teal-700/90 text-white',
    priceClass: 'text-teal-700',
    outlineButtonClass:
      'border-teal-200 bg-white text-teal-700 hover:bg-teal-50',
    solidButtonClass:
      'bg-[linear-gradient(135deg,#14b8a6,#0f766e)] text-white shadow-[0_14px_26px_-20px_rgba(20,184,166,0.55)]',
    sidePanelClass: 'bg-[linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)]',
  },
  property: {
    icon: MapPin,
    hintId: 'Lokasi & tempat',
    hintEn: 'Places & locations',
    cardClass:
      'border-rose-100 bg-[linear-gradient(180deg,#ffffff_0%,#fff1f2_100%)]',
    imageClass: 'bg-[linear-gradient(145deg,#ffe4e6,#ffffff)]',
    iconBubbleClass: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200',
    activeFilterClass: 'border-rose-200 bg-rose-50 text-rose-700',
    inactiveFilterClass:
      'border-rose-100 bg-white text-rose-700 hover:border-rose-200 hover:bg-rose-50',
    chipClass: 'bg-rose-50 text-rose-700 border-rose-100',
    ribbonClass: 'bg-rose-700/90 text-white',
    priceClass: 'text-rose-700',
    outlineButtonClass:
      'border-rose-200 bg-white text-rose-700 hover:bg-rose-50',
    solidButtonClass:
      'bg-[linear-gradient(135deg,#f43f5e,#be123c)] text-white shadow-[0_14px_26px_-20px_rgba(244,63,94,0.5)]',
    sidePanelClass: 'bg-[linear-gradient(180deg,#ffffff_0%,#fff1f2_100%)]',
  },
  freelancer: {
    icon: UserRound,
    hintId: 'Talent & profil',
    hintEn: 'Talent & profiles',
    cardClass:
      'border-lime-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fee7_100%)]',
    imageClass: 'bg-[linear-gradient(145deg,#ecfccb,#ffffff)]',
    iconBubbleClass: 'bg-lime-100 text-lime-800 ring-1 ring-lime-200',
    activeFilterClass: 'border-lime-200 bg-lime-50 text-lime-800',
    inactiveFilterClass:
      'border-lime-100 bg-white text-lime-800 hover:border-lime-200 hover:bg-lime-50',
    chipClass: 'bg-lime-50 text-lime-800 border-lime-100',
    ribbonClass: 'bg-lime-700/90 text-white',
    priceClass: 'text-lime-700',
    outlineButtonClass:
      'border-lime-200 bg-white text-lime-800 hover:bg-lime-50',
    solidButtonClass:
      'bg-[linear-gradient(135deg,#84cc16,#4d7c0f)] text-white shadow-[0_14px_26px_-20px_rgba(132,204,22,0.5)]',
    sidePanelClass: 'bg-[linear-gradient(180deg,#ffffff_0%,#f7fee7_100%)]',
  },
  job: {
    icon: Briefcase,
    hintId: 'Lowongan & kerja',
    hintEn: 'Jobs & hiring',
    cardClass:
      'border-amber-100 bg-[linear-gradient(180deg,#ffffff_0%,#fffbeb_100%)]',
    imageClass: 'bg-[linear-gradient(145deg,#fef3c7,#ffffff)]',
    iconBubbleClass: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
    activeFilterClass: 'border-amber-200 bg-amber-50 text-amber-800',
    inactiveFilterClass:
      'border-amber-100 bg-white text-amber-800 hover:border-amber-200 hover:bg-amber-50',
    chipClass: 'bg-amber-50 text-amber-800 border-amber-100',
    ribbonClass: 'bg-amber-700/90 text-white',
    priceClass: 'text-amber-700',
    outlineButtonClass:
      'border-amber-200 bg-white text-amber-800 hover:bg-amber-50',
    solidButtonClass:
      'bg-[linear-gradient(135deg,#f59e0b,#b45309)] text-white shadow-[0_14px_26px_-20px_rgba(245,158,11,0.5)]',
    sidePanelClass: 'bg-[linear-gradient(180deg,#ffffff_0%,#fffbeb_100%)]',
  },
  tool_rental: {
    icon: ShieldCheck,
    hintId: 'Sewa alat',
    hintEn: 'Tool rental',
    cardClass:
      'border-green-100 bg-[linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)]',
    imageClass: 'bg-[linear-gradient(145deg,#dcfce7,#ffffff)]',
    iconBubbleClass: 'bg-green-100 text-green-700 ring-1 ring-green-200',
    activeFilterClass: 'border-green-200 bg-green-50 text-green-700',
    inactiveFilterClass:
      'border-green-100 bg-white text-green-700 hover:border-green-200 hover:bg-green-50',
    chipClass: 'bg-green-50 text-green-700 border-green-100',
    ribbonClass: 'bg-green-700/90 text-white',
    priceClass: 'text-green-700',
    outlineButtonClass:
      'border-green-200 bg-white text-green-700 hover:bg-green-50',
    solidButtonClass:
      'bg-[linear-gradient(135deg,#22c55e,#15803d)] text-white shadow-[0_14px_26px_-20px_rgba(34,197,94,0.5)]',
    sidePanelClass: 'bg-[linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)]',
  },
  business_transfer: {
    icon: Handshake,
    hintId: 'Usaha berjalan',
    hintEn: 'Running businesses',
    cardClass:
      'border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)]',
    imageClass: 'bg-[linear-gradient(145deg,#bbf7d0,#ffffff)]',
    iconBubbleClass: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
    activeFilterClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    inactiveFilterClass:
      'border-emerald-100 bg-white text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50',
    chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    ribbonClass: 'bg-emerald-700/90 text-white',
    priceClass: 'text-emerald-700',
    outlineButtonClass:
      'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50',
    solidButtonClass:
      'bg-[linear-gradient(135deg,#16a34a,#047857)] text-white shadow-[0_14px_26px_-20px_rgba(22,163,74,0.5)]',
    sidePanelClass: 'bg-[linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)]',
  },
  umkm: {
    icon: Store,
    hintId: 'Toko & usaha',
    hintEn: 'Stores & businesses',
    cardClass:
      'border-teal-100 bg-[linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)]',
    imageClass: 'bg-[linear-gradient(145deg,#ccfbf1,#ffffff)]',
    iconBubbleClass: 'bg-teal-100 text-teal-700 ring-1 ring-teal-200',
    activeFilterClass: 'border-teal-200 bg-teal-50 text-teal-700',
    inactiveFilterClass:
      'border-teal-100 bg-white text-teal-700 hover:border-teal-200 hover:bg-teal-50',
    chipClass: 'bg-teal-50 text-teal-700 border-teal-100',
    ribbonClass: 'bg-teal-700/90 text-white',
    priceClass: 'text-teal-700',
    outlineButtonClass:
      'border-teal-200 bg-white text-teal-700 hover:bg-teal-50',
    solidButtonClass:
      'bg-[linear-gradient(135deg,#14b8a6,#0f766e)] text-white shadow-[0_14px_26px_-20px_rgba(20,184,166,0.5)]',
    sidePanelClass: 'bg-[linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)]',
  },
  other: {
    icon: Package,
    hintId: 'Listing lain',
    hintEn: 'Other listings',
    cardClass: 'border-slate-200 bg-white',
    imageClass: 'bg-[linear-gradient(145deg,#f8fafc,#ffffff)]',
    iconBubbleClass: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
    activeFilterClass: 'border-slate-300 bg-slate-100 text-slate-800',
    inactiveFilterClass:
      'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
    chipClass: 'bg-slate-100 text-slate-700 border-slate-200',
    ribbonClass: 'bg-slate-900/80 text-white',
    priceClass: 'text-slate-700',
    outlineButtonClass:
      'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    solidButtonClass:
      'bg-slate-900 text-white shadow-[0_14px_26px_-20px_rgba(15,23,42,0.48)]',
    sidePanelClass: 'bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]',
  },
};

const SIMPLE_SEARCH_VISUAL: Omit<CategoryVisual, 'icon' | 'hintId' | 'hintEn'> =
{
  cardClass:
    'border-[color:var(--app-border)] bg-white dark:bg-[color:var(--app-surface-strong)]',
  imageClass:
    'bg-[linear-gradient(145deg,#f8fafc,#ffffff)] dark:bg-[color:var(--app-surface)]',
  iconBubbleClass:
    'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]',
  activeFilterClass:
    'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]',
  inactiveFilterClass:
    'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-strong)]',
  chipClass:
    'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] border-[color:var(--app-border)]',
  ribbonClass: 'bg-slate-950/76 text-white',
  priceClass: 'text-[color:var(--app-accent)]',
  outlineButtonClass:
    'border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]',
  solidButtonClass:
    'bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] text-[color:var(--app-text-inverse)] shadow-[0_14px_26px_-20px_rgba(22,163,74,0.48)]',
  sidePanelClass:
    'bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] dark:bg-[color:var(--app-surface)]',
};

function getCategoryVisual(typeKey: SearchVisualKey): CategoryVisual {
  const current = CATEGORY_VISUALS[typeKey] || CATEGORY_VISUALS.other;
  return {
    ...SIMPLE_SEARCH_VISUAL,
    icon: current.icon,
    hintId: current.hintId,
    hintEn: current.hintEn,
  };
}

function getCategoryHint(
  typeKey: SearchVisualKey,
  locale: 'id' | 'en',
): string {
  const visual = getCategoryVisual(typeKey);
  return locale === 'id' ? visual.hintId : visual.hintEn;
}

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
  if (
    value === 'business_transfer' ||
    value === 'business-transfer' ||
    value === 'oper-usaha' ||
    value === 'oper_usaha' ||
    value === 'jual-usaha' ||
    value === 'usaha-berjalan' ||
    value === 'handover' ||
    value === 'takeover'
  ) {
    return 'business_transfer';
  }
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

function isUsedGoodsQuery(value: string): boolean {
  return /\b(barang\s*bekas|bekas|second|seken|preloved|used\s*goods|used)\b/i.test(
    value,
  );
}

function normalizeUsedGoodsFilter(
  condition: string | null,
  query: string,
): boolean {
  return (
    condition === 'used' || condition === 'second' || isUsedGoodsQuery(query)
  );
}

function getUsedGoodsQuery(query: string, locale: 'id' | 'en'): string {
  const cleaned = query.trim();
  if (isUsedGoodsQuery(cleaned)) return cleaned;
  const suffix = locale === 'id' ? 'barang bekas' : 'used goods';
  return cleaned ? `${cleaned} ${suffix}` : suffix;
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
  if (/(job|career|loker|job_listing|job_posting)/.test(normalized))
    return 'job';
  if (
    /(freelancer|talent|profile|profession|professional_title|consultant|designer|developer|writer|photographer|videographer|marketer|engineer|architect|accountant|chef|doctor|creator)/.test(
      normalized,
    )
  ) {
    return 'freelancer';
  }
  if (/(product|market|shop|store)/.test(normalized)) return 'product';
  if (/(service|jasa)/.test(normalized)) return 'service';
  if (
    /(property|real-estate|real estate|apartment|house|ruko|kios|lapak)/.test(
      normalized,
    )
  ) {
    return 'property';
  }
  if (
    /(tool_rental|tool-rental|rental|rent|sewa|pinjam|meminjam)/.test(
      normalized,
    )
  ) {
    return 'tool_rental';
  }
  if (
    /(business_transfer|business-transfer|oper usaha|oper-usaha|jual usaha|usaha berjalan|handover|takeover)/.test(
      normalized,
    )
  ) {
    return 'business_transfer';
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
  if (typeKey === 'property')
    return locale === 'id' ? 'Lokasi Jualan' : 'Selling Spot';
  if (typeKey === 'tool_rental')
    return locale === 'id' ? 'Sewa Alat' : 'Tool Rental';
  if (typeKey === 'business_transfer')
    return locale === 'id' ? 'Oper Usaha' : 'Business Transfer';
  if (typeKey === 'freelancer')
    return locale === 'id' ? 'Profil Talent' : 'Talent Profile';
  if (typeKey === 'other') return locale === 'id' ? 'Listing' : 'Listing';
  const match = CONTENT_TYPES.find(contentType => contentType.id === typeKey);
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

  if (typeKey === 'business_transfer') {
    return locale === 'id'
      ? side === 'demand'
        ? 'Cari usaha berjalan'
        : 'Usaha berjalan siap dialihkan'
      : side === 'demand'
        ? 'Looking for a running business'
        : 'Running business for transfer';
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

function mapContentItem(
  item: ContentItem,
  locale: 'id' | 'en',
): SearchCard | null {
  const id = String(item.id || '').trim();
  if (!id) return null;

  const meta = item.metadata || {};
  const title = item.title || item.summary || asString(meta.name) || 'Untitled';
  if (isLegacySearchNoise(item, meta, title)) return null;

  const entityKind = inferSearchEntityKind(item, meta);
  const summary =
    item.summary || asString(meta.tagline) || asString(meta.description) || '';
  const location =
    asString(meta.location) ||
    asString(meta.city) ||
    asString(meta.region) ||
    'Indonesia';
  const price = formatIDRFromCents(item.price_cents);
  const priceUnitLabel = resolveContentPriceUnitLabel(item, locale);
  const fallbackPriceLabel =
    asString(meta.price_label) ||
    asString(meta.salary_range) ||
    asString(meta.budget_range) ||
    asString(meta.rate_label);
  const priceLabel =
    price !== '-'
      ? formatPriceWithUnit(price, priceUnitLabel)
      : fallbackPriceLabel
        ? formatPriceWithUnit(fallbackPriceLabel, priceUnitLabel)
        : locale === 'id'
          ? 'Negosiasi'
          : 'Negotiable';

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
  const updatedAt =
    Date.parse(String(item.updated_at || item.created_at || '')) || 0;
  const priceCents =
    typeof item.price_cents === 'number' ? item.price_cents : null;
  const verified = Boolean(
    item.owner_profile?.identity_verified ||
    item.owner_profile?.transaction_eligible ||
    item.owner_profile?.email_verified,
  );
  const ownerName =
    asString(item.owner_profile?.full_name) ||
    asString(item.owner_profile?.username) ||
    asString(meta.owner_name) ||
    asString(meta.seller_name) ||
    null;
  const storeId =
    asString(meta.umkm_store_id) ||
    asString(meta.store_id) ||
    asString(meta.storeId) ||
    null;
  const storeSlug =
    asString(meta.umkm_store_slug) ||
    asString(meta.store_slug) ||
    asString(meta.storeSlug) ||
    null;
  const storeName =
    asString(meta.umkm_store_name) ||
    asString(meta.store_name) ||
    asString(meta.storeName) ||
    ownerName ||
    null;
  const productId =
    asString(meta.umkm_product_id) ||
    asString(meta.product_id) ||
    asString(meta.productId) ||
    null;

  return {
    id,
    title,
    summary,
    location,
    priceLabel,
    priceUnitLabel,
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
    ownerId: item.owner_id || item.owner_profile?.id || null,
    ownerName,
    storeId,
    storeSlug,
    storeName,
    productId,
  };
}

function toTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(entry => asString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  const raw = asString(value);
  if (!raw) return [];

  return raw
    .split(/[\n,;|]/g)
    .map(entry => entry.trim())
    .filter(Boolean);
}

function formatRoleLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, token => token.toUpperCase());
}

function normalizeDiscoverUser(
  user: DiscoverUser,
  locale: 'id' | 'en',
): SearchProfileCard | null {
  const id = String(user.id || '').trim();
  if (!id) return null;

  const name =
    user.full_name ||
    user.username ||
    user.email ||
    (locale === 'id' ? 'Akun aktif' : 'Active account');
  const handle = user.username ? `@${user.username}` : '';
  const roles = [
    ...toTextList(user.roles),
    ...toTextList(user.metadata_roles),
  ];
  const headline =
    user.headline || user.bio || roles.slice(0, 2).join(' · ') ||
    (locale === 'id'
      ? 'Sudah register di Lajukan dan bisa dibuka profilnya.'
      : 'Registered on Lajukan and ready to open as a profile.');
  const location = user.location || (locale === 'id' ? 'Indonesia' : 'Indonesia');
  const profileHref = buildPublicProfileHref({
    id,
    username: user.username || undefined,
    full_name: user.full_name || name,
    title: name,
  });
  const avatarUrl = profileAvatarSrc(
    user.avatar_url,
    readProfileAvatarStyle(user),
    name,
  );
  const roleLabel =
    roles[0] || (locale === 'id' ? 'Profil aktif' : 'Active profile');
  const ratingLabel =
    typeof user.rating === 'number' && Number.isFinite(user.rating)
      ? `${user.rating.toFixed(1)}★`
      : null;

  return {
    id,
    href: profileHref,
    name,
    handle,
    headline,
    location,
    avatarUrl,
    verified: false,
    roleLabel: formatRoleLabel(roleLabel),
    ratingLabel,
    roles,
    createdAt: Date.parse(String(user.created_at || '')) || 0,
  };
}

function searchCartKindFromCard(item: SearchCard): SearchCartItemKind {
  if (item.typeKey === 'product') return 'product';
  if (item.typeKey === 'service') return 'service';
  if (item.typeKey === 'property') return 'property';
  if (item.typeKey === 'job') return 'job';
  if (item.typeKey === 'freelancer') return 'freelancer';
  if (item.typeKey === 'tool_rental') return 'tool_rental';
  if (item.typeKey === 'business_transfer') return 'business_transfer';
  return 'other';
}

function getSearchCartActionLabel(
  kind: SearchCartItemKind,
  locale: 'id' | 'en',
): string {
  if (locale !== 'id') {
    if (kind === 'product') return 'Ask seller';
    if (kind === 'service') return 'Discuss service';
    if (kind === 'property') return 'Open location';
    if (kind === 'job') return 'View job';
    if (kind === 'freelancer') return 'Chat talent';
    if (kind === 'tool_rental') return 'Ask availability';
    if (kind === 'business_transfer') return 'Ask handover';
    if (kind === 'umkm') return 'Open business';
    return 'Open detail';
  }

  if (kind === 'product') return 'Tanya penjual';
  if (kind === 'service') return 'Bahas jasa';
  if (kind === 'property') return 'Cek lokasi';
  if (kind === 'job') return 'Lihat lowongan';
  if (kind === 'freelancer') return 'Chat talent';
  if (kind === 'tool_rental') return 'Tanya stok sewa';
  if (kind === 'business_transfer') return 'Tanya oper usaha';
  if (kind === 'umkm') return 'Buka usaha';
  return 'Buka detail';
}

function buildSearchCartInput(
  item: SearchCard,
  locale: 'id' | 'en',
): SearchCartItemInput {
  const kind = searchCartKindFromCard(item);

  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    href: item.href,
    image: item.image || item.images[0] || null,
    kind,
    typeLabel: item.typeLabel,
    actionLabel: getSearchCartActionLabel(kind, locale),
    location: item.location,
    priceLabel: item.priceLabel,
    priceCents: item.priceCents,
    storeId: item.storeId || null,
    storeSlug: item.storeSlug || null,
    storeName: item.storeName || item.ownerName || null,
    productId: item.productId || null,
  };
}

function buildStoreCartInput(
  store: UmkmPreviewStore,
  locale: 'id' | 'en',
): SearchCartItemInput {
  return {
    id: `umkm:${store.id}`,
    title: store.name,
    summary: store.description || store.address,
    href: buildUmkmStorefrontPath(store.slug),
    image: null,
    kind: 'umkm',
    typeLabel: locale === 'id' ? 'Usaha' : 'Business',
    actionLabel: getSearchCartActionLabel('umkm', locale),
    location: store.city || 'Indonesia',
    priceLabel: store.recommended_qr === 'offline' ? 'Onsite' : 'Online',
    priceCents: null,
    storeId: store.id,
    storeSlug: store.slug,
    storeName: store.name,
    productId: null,
  };
}

function typeFilterClass(active: boolean, typeKey: SearchVisualKey) {
  const visual = getCategoryVisual(typeKey);
  return active
    ? `${visual.activeFilterClass} shadow-[0_16px_28px_-24px_rgba(15,23,42,0.24)]`
    : visual.inactiveFilterClass;
}

function sideFilterClass(active: boolean) {
  if (!active) {
    return 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]';
  }

  return 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]';
}

function SearchActiveChip({
  icon,
  label,
  typeKey = 'all',
  onRemove,
}: {
  icon?: LucideIcon;
  label: string;
  typeKey?: SearchVisualKey;
  onRemove?: () => void;
}) {
  const Icon = icon;
  const visual = getCategoryVisual(typeKey);
  return (
    <button
      type="button"
      onClick={onRemove}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition hover:brightness-[0.98]',
        visual.chipClass,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
      {onRemove ? <X className="h-3.5 w-3.5" /> : null}
    </button>
  );
}

function SearchFilterTabs({
  locale,
  activeTab,
  onSelect,
  className,
}: {
  locale: 'id' | 'en';
  activeTab: SearchFilterTabKey;
  onSelect: (value: SearchFilterTabKey) => void;
  className?: string;
}) {
  const isId = locale === 'id';
  const {
    ref: railRef,
    onClickCapture,
    onPointerCancel,
    onPointerDown,
    onPointerLeave,
    onPointerMove,
    onPointerUp,
    onWheel,
  } = useHorizontalDragScroll<HTMLDivElement>();

  return (
    <div
      ref={railRef}
      onClickCapture={onClickCapture}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerLeave={onPointerLeave}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      className={cn(
        'flex max-w-full gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none cursor-grab active:cursor-grabbing',
        className,
      )}
      role="tablist"
      aria-label={isId ? 'Filter cepat pencarian' : 'Quick search filters'}
    >
      {SEARCH_FILTER_TABS.map(tab => {
        const Icon = tab.icon;
        const active = activeTab === tab.value;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(tab.value)}
            className={cn(
              'inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border px-3.5 text-[12px] font-bold transition hover:-translate-y-0.5',
              active
                ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] shadow-[0_18px_30px_-22px_rgba(22,163,74,0.46)]'
                : 'border-[color:var(--app-border)] bg-white/92 text-[color:var(--app-text-soft)] shadow-[0_10px_24px_-24px_rgba(15,23,42,0.18)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-strong)]',
            )}
          >
            <Icon className="h-4 w-4" />
            {isId ? tab.labelId : tab.labelEn}
          </button>
        );
      })}
    </div>
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
      aria-label={hint ? `${label}. ${hint}` : label}
      className={cn(
        'flex min-h-[54px] items-center justify-between gap-3 rounded-[16px] border px-3 py-2 text-left transition',
        sideFilterClass(active),
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] bg-white/70 text-current ring-1 ring-black/5">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-bold leading-tight">
            {label}
          </span>
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
  cartQuantity,
  onAddToCart,
  onRemoveFromCart,
  onOpenCart,
}: {
  item: SearchCard;
  locale: 'id' | 'en';
  cartQuantity: number;
  onAddToCart: (item: SearchCard) => void;
  onRemoveFromCart: (itemId: string) => void;
  onOpenCart: () => void;
}) {
  const isId = locale === 'id';
  const previewImages =
    item.images.length > 0 ? item.images : item.image ? [item.image] : [];
  const updatedLabel = formatShortDate(item.updatedAt, locale);
  const visual = getCategoryVisual(item.typeKey);
  const CategoryIcon = visual.icon;
  const isSaved = cartQuantity > 0;
  const badgeTone =
    'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] border-[color:var(--app-border)]';
  const detailLabel = isId ? 'Detail / chat' : 'Details / chat';
  const savedLabel = isSaved
    ? isId
      ? 'Tersimpan'
      : 'Saved'
    : isId
      ? 'Simpan'
      : 'Save';
  const saveAriaLabel = isSaved
    ? isId
      ? 'Buka referensi tersimpan'
      : 'Open saved references'
    : isId
      ? 'Simpan sebagai referensi'
      : 'Save as reference';
  const ownerLabel = item.storeName || item.ownerName || null;
  const mediaLabel =
    previewImages.length > 1
      ? isId
        ? `${previewImages.length} foto`
        : `${previewImages.length} photos`
      : item.hasMedia
        ? isId
          ? 'Ada foto'
          : 'Has media'
        : null;

  return (
    <article
      data-testid="search-result-card"
      className={cn(
        'group/card overflow-hidden rounded-[22px] border shadow-[0_18px_38px_-30px_rgba(15,23,42,0.2)] ring-1 ring-white/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_58px_-40px_rgba(15,23,42,0.28)]',
        visual.cardClass,
      )}
    >
      <div className="grid min-w-0 grid-cols-[112px_minmax(0,1fr)] items-stretch gap-0 sm:grid-cols-[148px_minmax(0,1fr)] xl:grid-cols-[172px_minmax(0,1fr)_176px] 2xl:grid-cols-[184px_minmax(0,1fr)_190px]">
        <Link
          href={item.href}
          className={cn(
            'relative h-full min-h-[112px] w-full self-stretch overflow-hidden sm:min-h-[148px] xl:min-h-full',
            visual.imageClass,
          )}
          aria-label={isId ? 'Buka detail' : 'Open details'}
        >
          {previewImages.length > 0 ? (
            <MediaPreviewCarousel
              items={previewImages}
              alt={item.title}
              aspectClassName="h-full w-full"
              className="absolute inset-0 h-full w-full bg-transparent"
              mediaClassName="transition duration-500 group-hover/card:scale-[1.035]"
              sizes="(max-width: 640px) 112px, (max-width: 1280px) 148px, 184px"
              controls={false}
              lightbox={false}
              showCounter={previewImages.length > 1}
              showDots={previewImages.length > 1}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[color:var(--app-text-soft)]">
              <span
                className={cn(
                  'inline-flex h-16 w-16 items-center justify-center rounded-[24px]',
                  visual.iconBubbleClass,
                )}
              >
                <CategoryIcon className="h-8 w-8" />
              </span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 to-transparent" />
          <div className="absolute left-2 top-2 sm:left-3 sm:top-3">
            <span
              className={cn(
                'inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black shadow-sm backdrop-blur sm:text-[10px]',
                visual.chipClass,
              )}
            >
              <CategoryIcon className="h-3.5 w-3.5" />
              <span className="truncate">{item.typeLabel}</span>
            </span>
          </div>
          {mediaLabel ? (
            <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3">
              <span className="inline-flex max-w-full items-center rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-black text-slate-700 shadow-sm backdrop-blur">
                {mediaLabel}
              </span>
            </div>
          ) : null}
        </Link>

        <div className="min-w-0 border-l border-[color:var(--app-border)] bg-white/58 p-3 backdrop-blur-sm sm:p-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5 sm:mb-2">
              <span
                className={cn(
                  'inline-flex min-h-[22px] items-center rounded-full border px-2 py-0.5 text-[9px] font-bold',
                  badgeTone,
                )}
              >
                {item.sideLabel}
              </span>
              {item.verified ? (
                <span className="inline-flex min-h-[22px] items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                  <BadgeCheck className="h-3 w-3" />
                  Verified
                </span>
              ) : null}
            </div>
            <Link href={item.href} className="group block">
              <h3 className="line-clamp-2 text-[0.92rem] font-black leading-[1.08] tracking-[-0.035em] text-[color:var(--app-text)] group-hover:text-[color:var(--app-accent)] sm:text-[1.1rem]">
                {item.title}
              </h3>
            </Link>
            {ownerLabel ? (
              <p className="mt-0.5 line-clamp-1 text-[10px] font-bold text-[color:var(--app-text-soft)] sm:mt-1 sm:text-[11px]">
                {ownerLabel}
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-[color:var(--app-text-soft)] sm:mt-1.5 sm:gap-x-3 sm:text-[11px]">
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

          <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-[color:var(--app-text-soft)] sm:mt-2 sm:text-[12px]">
            {item.summary ||
              (isId
                ? 'Siap dibuka. Lanjut chat.'
                : 'Listing ready to open and follow up.')}
          </p>

          <div className="mt-2 xl:hidden">
            <div className="rounded-[14px] border border-white/70 bg-white/76 px-2.5 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)] sm:rounded-[16px] sm:px-3">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {isId ? 'Info' : 'Info'}
              </p>
              <p
                className={cn(
                  'mt-0.5 truncate text-[0.88rem] font-black leading-tight sm:text-[0.95rem]',
                  visual.priceClass,
                )}
              >
                {item.priceLabel}
              </p>
              {item.priceUnitLabel ? (
                <p className="mt-0.5 truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                  {isId ? 'Per' : 'Per'} {item.priceUnitLabel}
                </p>
              ) : null}
            </div>

            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Link
                href={item.profileHref || item.href}
                className={cn(
                  'inline-flex min-h-[40px] min-w-0 items-center justify-center gap-2 rounded-[14px] border px-3 text-[12px] font-black',
                  visual.outlineButtonClass,
                )}
              >
                <Eye className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{detailLabel}</span>
              </Link>
              <button
                type="button"
                onClick={() =>
                  isSaved ? onOpenCart() : onAddToCart(item)
                }
                aria-label={saveAriaLabel}
                className={cn(
                  'relative inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[14px] px-3 text-[12px] font-black',
                  visual.solidButtonClass,
                )}
              >
                {isSaved ? (
                  <BookmarkCheck className="h-3.5 w-3.5" />
                ) : (
                  <BookmarkPlus className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{savedLabel}</span>
              </button>
            </div>
            {isSaved ? (
              <button
                type="button"
                onClick={() => onRemoveFromCart(item.id)}
                className="mt-2 inline-flex min-h-[28px] items-center gap-1.5 rounded-full px-1 text-[10px] font-bold text-[color:var(--app-text-soft)] hover:text-[color:var(--app-text)]"
              >
                <X className="h-3 w-3" />
                {isId ? 'Hapus dari referensi' : 'Remove reference'}
              </button>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            'hidden border-l border-[color:var(--app-border)] p-3 xl:flex xl:flex-col xl:justify-between',
            visual.sidePanelClass,
          )}
        >
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
              {isId ? 'Info' : 'Info'}
            </p>
            <p
              className={cn(
                'mt-1 text-[1.06rem] font-black leading-tight',
                visual.priceClass,
              )}
            >
              {item.priceLabel}
            </p>
            {item.priceUnitLabel ? (
              <p className="mt-1 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                {isId ? 'Harga per' : 'Price per'} {item.priceUnitLabel}
              </p>
            ) : null}
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[color:var(--app-text-soft)]">
              {item.sideContextLabel}
            </p>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <button
                type="button"
                onClick={() =>
                  isSaved ? onOpenCart() : onAddToCart(item)
                }
                aria-label={saveAriaLabel}
                className={cn(
                  'inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[12px] px-3 text-[12px] font-semibold',
                  visual.solidButtonClass,
                )}
              >
                {isSaved ? (
                  <BookmarkCheck className="h-3.5 w-3.5" />
                ) : (
                  <BookmarkPlus className="h-3.5 w-3.5" />
                )}
                {savedLabel}
              </button>
              {isSaved ? (
                <button
                  type="button"
                  onClick={() => onRemoveFromCart(item.id)}
                  aria-label={
                    isId
                      ? 'Hapus dari referensi'
                      : 'Remove from saved references'
                  }
                  className={cn(
                    'inline-flex h-[38px] w-[38px] items-center justify-center rounded-[12px] border text-[12px] font-semibold',
                    visual.outlineButtonClass,
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <Link
              href={item.profileHref || item.href}
              className={cn(
                'inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[12px] border px-3 text-[12px] font-semibold',
                visual.outlineButtonClass,
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              {detailLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function SearchResultProfileCard({
  item,
  locale,
}: {
  item: SearchProfileCard;
  locale: 'id' | 'en';
}) {
  const isId = locale === 'id';
  const activeLabel = isId ? 'Profil aktif' : 'Active profile';

  return (
    <article
      data-testid="search-profile-card"
      className="group/card overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] shadow-[0_18px_38px_-30px_rgba(15,23,42,0.2)] ring-1 ring-white/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_58px_-40px_rgba(15,23,42,0.28)] dark:border-[color:var(--app-border-strong)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(2,6,23,0.96)_100%)]"
    >
      <div className="flex min-w-0 gap-3 p-3 sm:p-4">
        <Link
          href={item.href}
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[20px] ring-1 ring-black/5 transition group-hover/card:scale-[1.01] sm:h-18 sm:w-18"
          aria-label={isId ? 'Buka profil' : 'Open profile'}
        >
          {item.avatarUrl ? (
            <Image
              src={item.avatarUrl}
              alt={item.name}
              fill
              sizes="72px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
              <UserRound className="h-7 w-7" />
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--app-accent)]">
              <UserRound className="h-3 w-3" />
              {activeLabel}
            </span>
            {item.ratingLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                <BadgeCheck className="h-3 w-3" />
                {item.ratingLabel}
              </span>
            ) : null}
          </div>

          <Link href={item.href} className="group mt-1 block">
            <h3 className="line-clamp-1 text-[0.96rem] font-black leading-tight tracking-[-0.03em] text-[color:var(--app-text)] group-hover:text-[color:var(--app-accent)] sm:text-[1.05rem]">
              {item.name}
            </h3>
          </Link>

          {item.handle ? (
            <p className="mt-0.5 truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
              {item.handle}
            </p>
          ) : null}

          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[color:var(--app-text-soft)] sm:text-[12px]">
            {item.headline}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-[color:var(--app-text-soft)] sm:text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {item.location}
            </span>
            {item.roles.length > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5" />
                {item.roles.slice(0, 2).join(' · ')}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[color:var(--app-border)] px-3 py-2.5 sm:px-4">
        <p className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
          {isId
            ? 'Sudah register dan bisa dibuka profilnya'
            : 'Registered and searchable'}
        </p>
        <Link
          href={item.href}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 text-[11px] font-bold text-[color:var(--app-accent)] transition hover:-translate-y-0.5"
        >
          {isId ? 'Buka profil' : 'Open profile'}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

function SearchProfileResultsSection({
  locale,
  activeTab,
  profiles,
  loading,
  error,
}: {
  locale: 'id' | 'en';
  activeTab: SearchFilterTabKey;
  profiles: SearchProfileCard[];
  loading: boolean;
  error: string | null;
}) {
  const isId = locale === 'id';
  const shouldRender = profiles.length > 0 || loading || error;
  if (!shouldRender) return null;
  if (!loading && !error && profiles.length === 0) return null;

  const title =
    activeTab === 'freelancer'
      ? isId
        ? 'Profil talent aktif'
        : 'Active talent profiles'
      : isId
        ? 'Profil akun aktif'
        : 'Active registered profiles';
  const subtitle = isId
    ? 'Orang yang sudah register di Lajukan tampil di sini.'
    : 'Registered users appear here as active profiles.';

  return (
    <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_18px_38px_-32px_rgba(15,23,42,0.18)] sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
            {title}
          </p>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[color:var(--app-text-soft)]">
            {subtitle}
          </p>
        </div>
        <span className="inline-flex min-h-[32px] shrink-0 items-center rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 text-[11px] font-bold text-[color:var(--app-accent)]">
          {profiles.length.toLocaleString(isId ? 'id-ID' : 'en-US')}{' '}
          {isId ? 'profil' : 'profiles'}
        </span>
      </div>

      {loading ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`profile-skeleton-${index}`}
              className="ui-skeleton ui-skeleton-pulse h-[172px] rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]"
            />
          ))}
        </div>
      ) : error ? (
        <div className="mt-3 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          {error}
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {profiles.map(profile => (
            <SearchResultProfileCard
              key={profile.id}
              item={profile}
              locale={locale}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SearchCartDock({
  cart,
  isId,
  open,
  onOpenChange,
  onRemove,
  onClear,
}: {
  cart: SearchCartSession;
  isId: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: (itemId: string) => void;
  onClear: () => void;
}) {
  if (cart.items.length <= 0) return null;

  const visibleItems = cart.items;
  const previewItems = cart.items.slice(0, 3);
  const firstItem = cart.items[0];
  const savedCount = cart.items.length;
  const countLabel = `${savedCount} ${isId ? 'referensi tersimpan' : 'saved references'
    }`;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-[70] lg:bottom-5 lg:left-auto lg:right-5 lg:w-[390px]">
      {!open ? (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="ui-pressable pointer-events-auto mx-auto flex min-h-[60px] w-full max-w-[440px] items-center justify-between gap-3 rounded-[22px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-surface-strong)] px-3 text-left shadow-[0_24px_54px_-28px_rgba(15,23,42,0.36)] backdrop-blur-xl"
        >
          <span className="inline-flex min-w-0 items-center gap-3">
            <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[color:var(--app-accent)] text-white shadow-[0_14px_26px_-18px_rgba(22,163,74,0.58)]">
              <BookmarkCheck className="h-4.5 w-4.5" />
              <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[color:var(--app-text)] px-1 text-[10px] font-black text-white">
                {savedCount}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-black text-[color:var(--app-text)]">
                {isId ? 'Referensi tersimpan' : 'Saved references'}
              </span>
              <span className="block truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                {firstItem?.title || countLabel}
              </span>
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2">
            {previewItems.length > 0 ? (
              <span className="hidden -space-x-2 sm:flex">
                {previewItems.map(item => (
                  <span
                    key={item.id}
                    className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-[color:var(--app-surface-muted)]"
                  >
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes="32px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[color:var(--app-accent)]">
                        <Package className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </span>
                ))}
              </span>
            ) : null}
            <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-black text-[color:var(--app-accent)]">
              {isId ? 'Buka' : 'Open'}
            </span>
          </span>
        </button>
      ) : (
        <section className="pointer-events-auto mx-auto max-h-[min(74svh,560px)] w-full max-w-[440px] overflow-hidden rounded-[26px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_28px_64px_-28px_rgba(15,23,42,0.38)] backdrop-blur-xl lg:max-w-none">
          <div className="flex items-start justify-between gap-3 border-b border-[color:var(--app-border)] px-3.5 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                <BookmarkCheck className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-black text-[color:var(--app-text)]">
                  {isId ? 'Referensi tersimpan' : 'Saved references'}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  {countLabel}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]"
              aria-label={isId ? 'Tutup referensi' : 'Close references'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 px-3.5 py-3">
            <div className="rounded-[16px] bg-[color:var(--app-surface-muted)] px-3 py-2">
              <p className="text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                {isId ? 'Siap ditanya' : 'Ready to ask'}
              </p>
              <p className="mt-0.5 truncate text-[13px] font-black text-[color:var(--app-text)]">
                {countLabel}
              </p>
            </div>
            <div className="rounded-[16px] bg-[color:var(--app-surface-muted)] px-3 py-2">
              <p className="text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                {isId ? 'Mulai dari' : 'Start from'}
              </p>
              <p className="mt-0.5 truncate text-[13px] font-black text-[color:var(--app-text)]">
                {firstItem?.typeLabel || (isId ? 'Item pertama' : 'First item')}
              </p>
            </div>
          </div>

          <div
            className="max-h-[min(46svh,360px)] overflow-y-auto px-2.5 pb-2.5"
            data-auto-scrollbar
          >
            <div className="space-y-2">
              {visibleItems.map(item => (
                <div
                  key={item.id}
                  className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2.5"
                >
                  <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2.5">
                    <Link
                      href={item.href}
                      className="relative h-[52px] w-[52px] overflow-hidden rounded-[16px] bg-white"
                    >
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          sizes="52px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[color:var(--app-accent)]">
                          <Package className="h-5 w-5" />
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0">
                      <Link
                        href={item.href}
                        className="line-clamp-2 text-[12px] font-black leading-snug text-[color:var(--app-text)]"
                      >
                        {item.title}
                      </Link>
                      <p className="mt-1 truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                        {item.typeLabel} - {item.location}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] font-black text-[color:var(--app-accent)]">
                        {item.priceLabel}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Link
                      href={item.href}
                      className="inline-flex min-h-[32px] items-center justify-center rounded-full bg-white px-3 text-[11px] font-bold text-[color:var(--app-text)]"
                    >
                      {isId ? 'Detail / chat' : 'Details / chat'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className="inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-full bg-white px-3 text-[11px] font-bold text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-text)]"
                      aria-label={
                        isId
                          ? 'Hapus dari referensi'
                          : 'Remove from saved references'
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                      {isId ? 'Hapus' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 border-t border-[color:var(--app-border)] p-3">
            <button
              type="button"
              onClick={onClear}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[15px] border border-[color:var(--app-border)] px-3 text-[12px] font-bold text-[color:var(--app-text-soft)]"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">
                {isId ? 'Kosongkan' : 'Clear'}
              </span>
            </button>
            <Link
              href={firstItem?.href || '/search'}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[15px] bg-[color:var(--app-accent)] px-4 text-[12px] font-black text-white shadow-[0_18px_30px_-20px_rgba(22,163,74,0.5)]"
            >
              {firstItem?.actionLabel || (isId ? 'Lanjut' : 'Continue')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function SearchRightRail({
  isId,
  resultCountLabel,
  hasMore,
  topResult,
  umkmStores,
  popularCities,
  briefCreateHref,
  briefCreateLabel,
  canToggleUmkmView,
  showingUmkmView,
  onToggleUmkmView,
}: {
  isId: boolean;
  resultCountLabel: string;
  hasMore: boolean;
  topResult: SearchCard | null | undefined;
  umkmStores: UmkmPreviewStore[];
  popularCities: string[];
  briefCreateHref: string;
  briefCreateLabel: string;
  canToggleUmkmView: boolean;
  showingUmkmView: boolean;
  onToggleUmkmView: () => void;
}) {
  const leadingStores = umkmStores.slice(0, 3);

  return (
    <aside className="hidden min-h-0 xl:block xl:pt-2">
      <div
        className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pl-1 overscroll-contain"
        data-auto-scrollbar
      >
        <section className="rounded-[22px] border border-[color:var(--app-border)] bg-white p-3 shadow-[0_18px_36px_-32px_rgba(15,23,42,0.14)]">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[16px] bg-[color:var(--app-surface-muted)] px-3 py-2">
              <p className="text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                {isId ? 'Hasil' : 'Results'}
              </p>
              <p className="mt-0.5 text-lg font-black text-[color:var(--app-text)]">
                {hasMore ? `${resultCountLabel}+` : resultCountLabel}
              </p>
            </div>
            <div className="rounded-[16px] bg-[color:var(--app-surface-muted)] px-3 py-2">
              <p className="text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                {isId ? 'Kota' : 'City'}
              </p>
              <p className="mt-0.5 truncate text-sm font-black text-[color:var(--app-text)]">
                {popularCities[0] || 'Indonesia'}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-emerald-100 bg-[linear-gradient(180deg,#f4fff8_0%,#ffffff_100%)] p-3 shadow-[0_18px_36px_-32px_rgba(22,163,74,0.22)]">
          <p className="text-[0.95rem] font-black text-[color:var(--app-text)]">
            {isId ? 'Aksi' : 'Actions'}
          </p>
          <div className="mt-2 grid gap-2">
            {topResult ? (
              <Link
                href={topResult.href}
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[14px] border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700"
              >
                {isId ? 'Buka hasil teratas' : 'Open top result'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
            <AuthCtaLink
              hrefWhenAuth={briefCreateHref}
              hrefWhenGuest="/register"
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-3 text-xs font-semibold text-[color:var(--app-text-inverse)]"
              ariaLabel={briefCreateLabel}
            >
              {briefCreateLabel}
            </AuthCtaLink>
            {canToggleUmkmView ? (
              <button
                type="button"
                onClick={onToggleUmkmView}
                className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-white px-3 text-xs font-semibold text-[color:var(--app-text)]"
              >
                <Layers3 className="h-3.5 w-3.5" />
                {showingUmkmView
                  ? isId
                    ? 'Lihat daftar listing'
                    : 'View listings'
                  : isId
                    ? 'Lihat usaha'
                    : 'View businesses'}
              </button>
            ) : null}
          </div>
        </section>

        {leadingStores.length > 0 ? (
          <section className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_18px_36px_-32px_rgba(15,23,42,0.14)]">
            <h2 className="text-[0.95rem] font-black tracking-[-0.035em] text-[color:var(--app-text)]">
              {isId ? 'Usaha terkait' : 'Related businesses'}
            </h2>
            <div className="mt-3 space-y-2">
              {leadingStores.map(store => (
                <Link
                  key={store.id}
                  href={buildUmkmStorefrontPath(store.slug)}
                  className="block rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2.5 transition hover:border-[color:var(--app-accent-border)]"
                >
                  <span className="flex items-center gap-2 text-[12px] font-bold text-[color:var(--app-text)]">
                    <Store className="h-4 w-4 text-[color:var(--app-accent)]" />
                    <span className="min-w-0 truncate">{store.name}</span>
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[color:var(--app-text-soft)]">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="min-w-0 truncate">
                      {store.city || store.address}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

export default function SearchPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = detectLocale(pathname);
  const isId = locale === 'id';
  const handleBack = useAppBack(router, '/home');

  const initialQuery = (searchParams.get('q') || '').trim();
  const initialLocation = (searchParams.get('location') || '').trim();
  const normalizedInitialType = normalizeType(searchParams.get('type'));
  const initialSort = normalizeSort(searchParams.get('sort'));
  const initialSideFilter = normalizeSideFilter(searchParams.get('side'));
  const initialUsedOnly = normalizeUsedGoodsFilter(
    searchParams.get('condition'),
    initialQuery,
  );
  const initialType = initialUsedOnly ? 'product' : normalizedInitialType;

  const [queryInput, setQueryInput] = useState(initialQuery);
  const [locationInput, setLocationInput] = useState(initialLocation);
  const [query, setQuery] = useState(initialQuery);
  const [location, setLocation] = useState(initialLocation);
  const [type, setType] = useState<TypeKey>(initialType);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [sideFilter, setSideFilter] = useState<SideFilter>(initialSideFilter);
  const [usedOnly, setUsedOnly] = useState(initialUsedOnly);
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
  const [discoverProfiles, setDiscoverProfiles] = useState<SearchProfileCard[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [searchCart, setSearchCart] = useState<SearchCartSession>(
    EMPTY_SEARCH_CART_SESSION,
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [searchSuggestionsLoading, setSearchSuggestionsLoading] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const searchSuggestionsId = useId();
  const searchSuggestionsTimeoutRef = useRef<number | undefined>(undefined);
  const {
    ref: mobileActionsRailRef,
    onClickCapture: onMobileActionsClickCapture,
    onPointerCancel: onMobileActionsPointerCancel,
    onPointerDown: onMobileActionsPointerDown,
    onPointerLeave: onMobileActionsPointerLeave,
    onPointerMove: onMobileActionsPointerMove,
    onPointerUp: onMobileActionsPointerUp,
    onWheel: onMobileActionsWheel,
  } = useHorizontalDragScroll<HTMLDivElement>();

  const canToggleUmkmView = type === 'all' || type === 'umkm';
  const shouldShowUmkmPreview = resultsView === 'umkm' || type === 'umkm';
  const shouldShowResultCards = !shouldShowUmkmPreview;
  const shouldShowDiscoverProfiles = true;

  useEffect(() => {
    const syncCart = () => setSearchCart(readSearchCartSession());
    syncCart();
    return subscribeSearchCartSession(syncCart);
  }, []);

  const cartQuantities = useMemo(() => {
    return Object.fromEntries(
      searchCart.items.map(item => [item.id, item.quantity]),
    ) as Record<string, number>;
  }, [searchCart.items]);

  const addSearchCardToCart = useCallback(
    (item: SearchCard) => {
      const currentCart = readSearchCartSession();
      if (currentCart.items.some(existing => existing.id === item.id)) {
        setSearchCart(currentCart);
        setCartOpen(true);
        return;
      }

      const input = buildSearchCartInput(item, locale);
      const nextCart = upsertSearchCartItem(input, 1);
      setSearchCart(nextCart);
      setCartOpen(true);
    },
    [locale],
  );

  const addUmkmStoreToCart = useCallback(
    (store: UmkmPreviewStore) => {
      const input = buildStoreCartInput(store, locale);
      const currentCart = readSearchCartSession();
      if (currentCart.items.some(existing => existing.id === input.id)) {
        setSearchCart(currentCart);
        setCartOpen(true);
        return;
      }

      const nextCart = upsertSearchCartItem(input, 1);
      setSearchCart(nextCart);
      setCartOpen(true);
    },
    [locale],
  );

  const removeSearchItemFromCart = useCallback((itemId: string) => {
    const nextCart = removeSearchCartItem(itemId);
    setSearchCart(nextCart);
    if (nextCart.itemCount === 0) setCartOpen(false);
  }, []);

  const clearSearchCart = useCallback(() => {
    const nextCart = clearSearchCartSession();
    setSearchCart(nextCart);
    setCartOpen(false);
  }, []);

  const applyFilters = useCallback(() => {
    const nextQuery = queryInput.trim();
    const nextLocation = locationInput.trim();
    setMobileActionsOpen(false);
    setQuery(nextQuery);
    setLocation(nextLocation);
    if (type === 'umkm') setResultsView('umkm');
    if (resultsView !== 'umkm') setResultsView('results');
  }, [locationInput, queryInput, resultsView, type]);

  const fetchSearchSuggestions = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) {
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
      return;
    }

    setSearchSuggestionsLoading(true);
    try {
      const res = await fetch('/api/ai/search-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });
      const payload = (await res.json().catch(() => ({}))) as { suggestions?: unknown };
      const suggestions = Array.isArray(payload.suggestions)
        ? payload.suggestions
          .filter((item): item is string => typeof item === 'string')
          .map(item => item.trim())
          .filter(Boolean)
          .slice(0, 5)
        : [];
      setSearchSuggestions(suggestions);
      setShowSearchSuggestions(suggestions.length > 0);
    } catch {
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
    } finally {
      setSearchSuggestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchSuggestionsTimeoutRef.current) {
      window.clearTimeout(searchSuggestionsTimeoutRef.current);
    }

    if (queryInput.trim().length >= 3) {
      searchSuggestionsTimeoutRef.current = window.setTimeout(() => {
        void fetchSearchSuggestions(queryInput);
      }, 420);
    } else {
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
    }

    return () => {
      if (searchSuggestionsTimeoutRef.current) {
        window.clearTimeout(searchSuggestionsTimeoutRef.current);
      }
    };
  }, [fetchSearchSuggestions, queryInput]);

  const resetAllFilters = useCallback(() => {
    setQueryInput('');
    setLocationInput('');
    setQuery('');
    setLocation('');
    setType('all');
    setSort('relevance');
    setSideFilter('all');
    setUsedOnly(false);
    setResultsView('results');
    setFiltersOpen(false);
    setMobileActionsOpen(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (location) params.set('location', location);
    if (type !== 'all') params.set('type', type);
    if (usedOnly) params.set('condition', 'used');
    if (sort !== 'relevance') params.set('sort', sort);
    if (sideFilter !== 'all') params.set('side', sideFilter);
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }, [location, pathname, query, router, sideFilter, sort, type, usedOnly]);

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
        const effectiveQuery = usedOnly
          ? getUsedGoodsQuery(query, locale)
          : query;
        if (effectiveQuery) params.set('q', effectiveQuery);
        if (location) params.set('location', location);
        if (type !== 'all') params.set('type', type);
        params.set('status', 'active');
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
            (isId
              ? 'Gagal memuat hasil pencarian'
              : 'Failed to load search results'),
          );
        }

        const nextItems = extractContentItems(payload)
          .map(item => mapContentItem(item, locale))
          .filter((item): item is SearchCard => Boolean(item));

        setItems(prev =>
          mode === 'append' ? [...prev, ...nextItems] : nextItems,
        );
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
    [isId, locale, location, offset, query, type, usedOnly],
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
        params.set('backend_only', '1');
        params.set('limit', '10');

        const response = await fetch(
          `/api/super-app/umkm/stores?${params.toString()}`,
          {
            cache: 'no-store',
          },
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            (payload as { error?: string }).error ||
            (isId ? 'Gagal memuat usaha' : 'Failed to load businesses'),
          );
        }

        const nextStores = ((
          payload as { data?: { items?: UmkmPreviewStore[] } }
        ).data?.items || []) as UmkmPreviewStore[];
        setUmkmStores(nextStores);
      } catch (err) {
        setUmkmStores([]);
        setUmkmError(
          err instanceof Error ? err.message : 'Failed to load businesses',
        );
      } finally {
        setUmkmLoading(false);
      }
    };

    void load();
  }, [isId, location, query, type]);

  useEffect(() => {
    if (!shouldShowDiscoverProfiles) {
      setDiscoverProfiles([]);
      setDiscoverLoading(false);
      setDiscoverError(null);
      return;
    }

    const controller = new AbortController();

    const loadProfiles = async () => {
      setDiscoverLoading(true);
      setDiscoverError(null);

      try {
        const params = new URLSearchParams();
        params.set('limit', String(PAGE_SIZE));
        if (query.trim()) params.set('q', query.trim());

        const response = await fetch(
          `/api/users/discover?${params.toString()}`,
          {
            cache: 'no-store',
            credentials: 'include',
            signal: controller.signal,
          },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          data?: unknown[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            payload.error || (isId ? 'Gagal memuat profil' : 'Failed to load profiles'),
          );
        }

        const nextProfiles = Array.isArray(payload.data)
          ? payload.data
            .map(item => normalizeDiscoverUser(item as DiscoverUser, locale))
            .filter((item): item is SearchProfileCard => Boolean(item))
            .filter(profile =>
              location.trim()
                ? profile.location
                  .toLowerCase()
                  .includes(location.trim().toLowerCase())
                : true,
            )
          : [];

        setDiscoverProfiles(nextProfiles);
      } catch (err) {
        if (controller.signal.aborted) return;
        setDiscoverProfiles([]);
        setDiscoverError(
          err instanceof Error
            ? err.message
            : isId
              ? 'Gagal memuat profil'
              : 'Failed to load profiles',
        );
      } finally {
        if (!controller.signal.aborted) {
          setDiscoverLoading(false);
        }
      }
    };

    void loadProfiles();

    return () => controller.abort();
  }, [isId, locale, location, query, shouldShowDiscoverProfiles]);

  const visibleItems = useMemo(() => {
    const next = [...items].filter(item => {
      if (sideFilter !== 'all' && item.side !== sideFilter) return false;
      return true;
    });

    if (sort === 'newest') {
      next.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    if (sort === 'price_low') {
      next.sort(
        (a, b) =>
          (a.priceCents ?? Number.MAX_SAFE_INTEGER) -
          (b.priceCents ?? Number.MAX_SAFE_INTEGER),
      );
    }
    if (sort === 'price_high') {
      next.sort((a, b) => (b.priceCents ?? 0) - (a.priceCents ?? 0));
    }

    return next;
  }, [items, sideFilter, sort]);

  const visibleProfiles = useMemo(
    () =>
      discoverProfiles.filter(profile => {
        if (!location.trim()) return true;
        return profile.location.toLowerCase().includes(location.trim().toLowerCase());
      }),
    [discoverProfiles, location],
  );

  const resultCountLabel = new Intl.NumberFormat(
    isId ? 'id-ID' : 'en-US',
  ).format(visibleItems.length);
  const popularCities = useMemo(() => {
    const citySet = new Set<string>();
    [
      ...visibleItems.map(item => item.location),
      ...umkmStores.map(store => store.city),
    ]
      .map(city => String(city || '').trim())
      .filter(Boolean)
      .forEach(city => citySet.add(city));
    return citySet.size > 0 ? Array.from(citySet).slice(0, 6) : FALLBACK_CITIES;
  }, [umkmStores, visibleItems]);
  const sideCounts = useMemo(
    () => ({
      all: items.length,
      supply: items.filter(item => item.side === 'supply').length,
      demand: items.filter(item => item.side === 'demand').length,
    }),
    [items],
  );
  const activeFilterCount =
    Number(Boolean(query)) +
    Number(Boolean(location)) +
    Number(type !== 'all') +
    Number(usedOnly) +
    Number(sort !== 'relevance') +
    Number(sideFilter !== 'all');
  const canReset = activeFilterCount > 0;
  const resultsHeading = query
    ? isId
      ? `Hasil pencarian "${query}"`
      : `Search results for "${query}"`
    : isId
      ? 'Cari supplier, jasa, peluang'
      : 'Find suppliers, services, and business opportunities';
  const resultsSubheading =
    loading && visibleItems.length === 0
      ? isId
        ? 'Memuat hasil...'
        : 'Loading results...'
      : isId
        ? `${hasMore ? `${resultCountLabel}+` : resultCountLabel} hasil ditemukan`
        : `${hasMore ? `${resultCountLabel}+` : resultCountLabel} results found`;
  const activeTypeLabel =
    TYPE_OPTIONS.find(option => option.value === type)?.[
    isId ? 'labelId' : 'labelEn'
    ] || (isId ? 'Semua' : 'All');
  const activeSortLabel =
    SORT_OPTIONS.find(option => option.value === sort)?.[
    isId ? 'labelId' : 'labelEn'
    ] || (isId ? 'Paling relevan' : 'Most relevant');
  const topResult = visibleItems[0];
  const activeSearchTab: SearchFilterTabKey = usedOnly ? 'used_goods' : type;
  const mobileMapLabel =
    canToggleUmkmView && resultsView === 'umkm'
      ? isId
        ? 'Daftar'
        : 'List'
      : isId
        ? 'Peta'
        : 'Map';
  const usedGoodsSellHref = `${resolveMarketplaceCreateHref(locale, 'product', 'supply')}?condition=used&q=${encodeURIComponent(isId ? 'barang bekas' : 'used goods')}`;
  const briefCreateHref = usedOnly
    ? usedGoodsSellHref
    : resolveUmkmCreateHrefForType(locale, type);
  const briefCreateLabel = usedOnly
    ? isId
      ? 'Tawarkan barang bekas'
      : 'Sell used goods'
    : isId
      ? type === 'service'
        ? 'Cari jasa'
        : type === 'business_transfer'
          ? 'Tawarkan usaha'
          : type === 'freelancer' || type === 'job'
            ? 'Cari talent'
            : 'Cari supplier'
      : type === 'service'
        ? 'Post a service need'
        : type === 'business_transfer'
          ? 'List a business transfer'
          : type === 'freelancer' || type === 'job'
            ? 'Post a talent need'
            : 'Post a supplier need';

  const openUmkmPreview = () => router.push(UMKM_DISCOVERY_PATH);
  const applyCity = (city: string) => {
    setLocationInput(city);
    setLocation(city);
  };

  const selectSearchTab = useCallback(
    (nextTab: SearchFilterTabKey) => {
      if (nextTab === 'used_goods') {
        const nextQuery = getUsedGoodsQuery(queryInput, locale);
        setUsedOnly(true);
        setType('product');
        setSideFilter('all');
        setQueryInput(nextQuery);
        setQuery(nextQuery);
        setResultsView('results');
        return;
      }

      setUsedOnly(false);
      setType(nextTab);
      if (nextTab === 'umkm') {
        setResultsView('umkm');
      } else {
        setResultsView('results');
      }
    },
    [locale, queryInput],
  );

  return (
    <div className="lajukan-home-compact lajukan-market-page lajukan-market-search lajukan-search-compact min-h-screen px-1 pb-6 pt-0 sm:px-4 lg:h-[calc(100svh-(60px+env(safe-area-inset-top)))] lg:min-h-0 lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0">
      <div className="lajukan-home-shell lajukan-search-shell mx-auto h-full lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
        <div className="space-y-4 lg:hidden">
          <div className="ui-layer-local-topbar fixed inset-x-0 top-0 z-[80] flex items-center gap-2 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)] px-2 pb-1.5 pt-[calc(env(safe-area-inset-top)+0.35rem)] shadow-[0_12px_26px_-24px_rgba(15,23,42,0.26)] backdrop-blur-xl sm:px-3">
            <button
              type="button"
              onClick={handleBack}
              className="ui-pressable inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] shadow-[0_12px_24px_-22px_rgba(15,23,42,0.18)]"
              aria-label={isId ? 'Kembali' : 'Back'}
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </button>
            <form
              onSubmit={event => {
                event.preventDefault();
                applyFilters();
              }}
              className="relative min-w-0 flex-1"
              data-testid="search-mobile-form"
            >
              <label className="ui-navbar-search-field">
                <Search className="ui-navbar-search-icon" />
                <input
                  data-testid="search-mobile-input"
                  type="search"
                  name="q"
                  enterKeyHint="search"
                  value={queryInput}
                  onChange={event => {
                    setQueryInput(event.target.value);
                    setShowSearchSuggestions(true);
                  }}
                  onFocus={() => {
                    if (searchSuggestions.length > 0) setShowSearchSuggestions(true);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setShowSearchSuggestions(false), 160);
                  }}
                  placeholder={
                    isId
                      ? 'Cari supplier, jasa, lokasi...'
                      : 'Search suppliers, places, services...'
                  }
                  className="ui-navbar-search-input"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showSearchSuggestions && searchSuggestions.length > 0}
                  aria-controls={searchSuggestionsId}
                  aria-busy={searchSuggestionsLoading}
                />
              </label>
              {showSearchSuggestions && searchSuggestions.length > 0 ? (
                <div
                  id={searchSuggestionsId}
                  role="listbox"
                  className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[82] overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_20px_48px_-30px_rgba(15,23,42,0.3)] dark:border-[color:var(--app-border-strong)]"
                >
                  <div className="flex items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
                    <span>{isId ? 'Saran pencarian' : 'Search suggestions'}</span>
                    {searchSuggestionsLoading ? (
                      <span>{isId ? 'Memuat...' : 'Loading...'}</span>
                    ) : null}
                  </div>
                  <div className="p-1.5 pt-0">
                    {searchSuggestions.map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        role="option"
                        aria-selected="false"
                        className="flex w-full items-start gap-2 rounded-[16px] px-3 py-2 text-left text-[13px] font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => {
                          setQueryInput(suggestion);
                          setShowSearchSuggestions(false);
                          applyFilters();
                        }}
                      >
                        <Search className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
                        <span className="line-clamp-2">{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </form>
            <AuthCtaLink
              hrefWhenAuth={briefCreateHref}
              hrefWhenGuest="/register"
              className="ui-pressable inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-white shadow-[0_14px_28px_-20px_rgba(22,163,74,0.55)]"
              ariaLabel={briefCreateLabel}
            >
              <Plus className="h-4.5 w-4.5" />
            </AuthCtaLink>
            <div className="relative shrink-0">
              {mobileActionsOpen ? (
                <button
                  type="button"
                  className="fixed inset-0 z-[71] cursor-default bg-transparent"
                  aria-label={isId ? 'Tutup menu' : 'Close menu'}
                  onClick={() => setMobileActionsOpen(false)}
                />
              ) : null}
              <button
                type="button"
                onClick={() => setMobileActionsOpen(value => !value)}
                className={cn(
                  'ui-pressable relative z-[72] inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full border text-[color:var(--app-text)] shadow-[0_12px_24px_-22px_rgba(15,23,42,0.18)]',
                  mobileActionsOpen
                    ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)]'
                    : 'border-[color:var(--app-border)] bg-white',
                )}
                data-testid="search-mobile-actions-button"
                aria-label={isId ? 'Menu pencarian' : 'Search actions'}
                aria-expanded={mobileActionsOpen}
              >
                <MoreHorizontal className="h-5 w-5" />
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-1 text-[9px] font-black text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
              {mobileActionsOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.55rem)] z-[72] w-[min(17rem,calc(100vw-1rem))] overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-1.5 text-left shadow-[0_24px_54px_-26px_rgba(15,23,42,0.34)]"
                >
                  <div className="px-3 py-2">
                    <p className="text-[13px] font-black text-[color:var(--app-text)]">
                      {isId ? 'Aksi pencarian' : 'Search actions'}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                      {hasMore ? `${resultCountLabel}+` : resultCountLabel}{' '}
                      {isId ? 'hasil' : 'results'}
                    </p>
                  </div>

                  <div className="grid gap-1">
                    {searchCart.items.length > 0 ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setCartOpen(true);
                          setMobileActionsOpen(false);
                        }}
                        className="flex min-h-[46px] items-center justify-between gap-3 rounded-[16px] px-3 text-left text-[13px] font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]"
                      >
                        <span className="inline-flex min-w-0 items-center gap-3">
                          <BookmarkCheck className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                          <span className="truncate">
                            {isId ? 'Buka referensi' : 'Open references'}
                          </span>
                        </span>
                        <span className="rounded-full bg-[color:var(--app-accent-soft)] px-2 py-0.5 text-[10px] font-black text-[color:var(--app-accent)]">
                          {searchCart.items.length}
                        </span>
                      </button>
                    ) : null}
                    {canToggleUmkmView ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setResultsView(
                            resultsView === 'umkm' ? 'results' : 'umkm',
                          );
                          setMobileActionsOpen(false);
                        }}
                        className="flex min-h-[46px] items-center gap-3 rounded-[16px] px-3 text-left text-[13px] font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]"
                        data-testid="search-mobile-view-toggle"
                      >
                        <Layers3 className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                        <span>{mobileMapLabel}</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setFiltersOpen(true);
                        setMobileActionsOpen(false);
                      }}
                      className="flex min-h-[46px] items-center justify-between gap-3 rounded-[16px] px-3 text-left text-[13px] font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]"
                    >
                      <span className="inline-flex min-w-0 items-center gap-3">
                        <Filter className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                        <span className="truncate">
                          {isId ? 'Filter & urutkan' : 'Filter & sort'}
                        </span>
                      </span>
                      <span className="truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                        {activeSortLabel}
                      </span>
                    </button>
                    {canReset ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={resetAllFilters}
                        className="flex min-h-[46px] items-center gap-3 rounded-[16px] px-3 text-left text-[13px] font-bold text-[color:var(--app-accent)] hover:bg-[color:var(--app-accent-soft)]"
                      >
                        <RefreshCcw className="h-4 w-4 shrink-0" />
                        <span>{isId ? 'Reset pencarian' : 'Reset search'}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div
            aria-hidden="true"
            className="h-[calc(3.55rem+env(safe-area-inset-top))]"
          />

          <section className="rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_90%,white_10%)] bg-white/96 p-3.5 shadow-[0_20px_44px_-36px_rgba(15,23,42,0.14)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-[1.35rem] font-black text-[color:var(--app-text)]">
                  {query
                    ? isId
                      ? 'Hasil pencarian'
                      : 'Search results'
                    : resultsHeading}
                </h1>
                <p className="mt-1 text-[13px] text-[color:var(--app-text-soft)]">
                  <span className="font-semibold text-emerald-600">
                    {hasMore ? `${resultCountLabel}+` : resultCountLabel}
                  </span>{' '}
                  {isId ? 'hasil ditemukan' : 'results found'}
                </p>
              </div>
              <div className="inline-flex min-h-[36px] shrink-0 items-center gap-2 rounded-full bg-[color:var(--app-surface-muted)] px-3 text-[12px] font-bold text-[color:var(--app-text-soft)]">
                <Filter className="h-4.5 w-4.5" />
                <span>
                  {activeFilterCount > 0
                    ? `${activeFilterCount} ${isId ? 'filter' : 'filters'}`
                    : activeSortLabel}
                </span>
              </div>
            </div>

            <SearchFilterTabs
              locale={locale}
              activeTab={activeSearchTab}
              onSelect={selectSearchTab}
              className="mt-3"
            />

            <div
              ref={mobileActionsRailRef}
              onClickCapture={onMobileActionsClickCapture}
              onPointerCancel={onMobileActionsPointerCancel}
              onPointerDown={onMobileActionsPointerDown}
              onPointerLeave={onMobileActionsPointerLeave}
              onPointerMove={onMobileActionsPointerMove}
              onPointerUp={onMobileActionsPointerUp}
              onWheel={onMobileActionsWheel}
              className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar select-none cursor-grab active:cursor-grabbing"
            >
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-[13px] border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-semibold text-emerald-700"
                data-testid="search-mobile-filter-button"
              >
                <Filter className="h-4 w-4" />
                {activeFilterCount > 0
                  ? `${isId ? 'Filter' : 'Filters'} (${activeFilterCount})`
                  : isId
                    ? 'Filter'
                    : 'Filters'}
              </button>
              {canReset ? (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-[13px] px-3 text-[12px] font-semibold text-emerald-600"
                >
                  <RefreshCcw className="h-4 w-4" />
                  {isId ? 'Reset' : 'Reset'}
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
              cartQuantities={cartQuantities}
              onOpenUmkmView={openUmkmPreview}
              onAddStoreToCart={addUmkmStoreToCart}
              onOpenCart={() => setCartOpen(true)}
            />
          ) : null}

          <SearchProfileResultsSection
            locale={locale}
            activeTab={activeSearchTab}
            profiles={visibleProfiles}
            loading={discoverLoading}
            error={discoverError}
          />

          {shouldShowResultCards ? (
            loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`mobile-loading-${index}`}
                    className="ui-skeleton ui-skeleton-pulse h-[190px] rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] sm:h-[210px]"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setRefreshKey(value => value + 1)}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-rose-700"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  {isId ? 'Coba lagi' : 'Retry'}
                </button>
              </div>
            ) : visibleItems.length === 0 && visibleProfiles.length === 0 ? (
              <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[radial-gradient(circle_at_top,#ecfdf5_0%,#ffffff_46%,#f8fafc_100%)] px-5 py-8 text-center shadow-[0_20px_42px_-30px_rgba(15,23,42,0.18)]">
                <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-[20px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <Search className="h-5 w-5" />
                </span>
                <p className="mt-3 text-[17px] font-black tracking-[-0.035em] text-[color:var(--app-text)]">
                  {isId ? 'Belum ketemu yang pas' : 'No good match yet'}
                </p>
                <p className="mx-auto mt-1 max-w-[26rem] text-[13px] leading-5 text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Coba longgarkan filter, pakai kata kunci lain, atau buka tab Talent untuk lihat profil yang sudah register.'
                    : 'Try broader filters, another keyword, or open the Talent tab to see registered profiles.'}
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
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleItems.map(item => (
                  <SearchResultListingCard
                    key={item.id}
                    item={item}
                    locale={locale}
                    cartQuantity={cartQuantities[item.id] || 0}
                    onAddToCart={addSearchCardToCart}
                    onRemoveFromCart={removeSearchItemFromCart}
                    onOpenCart={() => setCartOpen(true)}
                  />
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
                  {loadingMore
                    ? isId
                      ? 'Memuat...'
                      : 'Loading...'
                    : isId
                      ? 'Tampilkan lebih banyak'
                      : 'Load more'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="lajukan-home-desktop-shell lajukan-search-desktop-shell hidden min-h-0 overflow-hidden lg:flex lg:flex-1 lg:flex-col">
          <div className="lajukan-home-desktop-grid lajukan-search-desktop-grid relative z-0 mx-auto grid min-h-0 w-full max-w-[1700px] flex-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_260px] 2xl:grid-cols-[280px_minmax(0,1fr)_280px]">
            <aside className="hidden lg:block lg:h-full lg:min-h-0 lg:overflow-hidden">
              <div
                className="flex h-full max-h-full min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pb-6 pr-1"
                data-auto-scrollbar
              >
                <section className="rounded-[24px] p-3">
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

                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                        {isId ? 'Lokasi' : 'Location'}
                      </p>
                      <label className="mt-2 flex min-w-0 items-center gap-2 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2">
                        <MapPin className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
                        <input
                          value={locationInput}
                          onChange={event =>
                            setLocationInput(event.target.value)
                          }
                          placeholder={isId ? 'Cari lokasi' : 'Search location'}
                          className="min-h-[32px] w-full min-w-0 bg-transparent text-[13px] text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {popularCities.map(city => (
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
                        {TYPE_OPTIONS.map(option => {
                          const visual = getCategoryVisual(option.value);
                          const active = type === option.value;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setUsedOnly(false);
                                setType(option.value);
                                if (option.value === 'umkm')
                                  setResultsView('umkm');
                              }}
                              className={cn(
                                'flex min-h-[54px] items-center gap-2.5 rounded-[16px] border px-3 py-2 text-left transition',
                                typeFilterClass(active, option.value),
                              )}
                            >
                              <span
                                className={cn(
                                  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px]',
                                  visual.iconBubbleClass,
                                )}
                              >
                                <option.icon className="h-4.5 w-4.5" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12px] font-black">
                                  {isId ? option.labelId : option.labelEn}
                                </span>
                                <span className="mt-0.5 block truncate text-[10px] font-semibold opacity-80">
                                  {getCategoryHint(option.value, locale)}
                                </span>
                              </span>
                              {active ? (
                                <BadgeCheck className="h-4 w-4 shrink-0" />
                              ) : null}
                            </button>
                          );
                        })}
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
                          hint={
                            isId ? 'Lihat semua listing' : 'See every listing'
                          }
                          count={sideCounts.all}
                          active={sideFilter === 'all'}
                          onSelect={setSideFilter}
                        />
                        <SearchResultScopeCard
                          value="supply"
                          label={isId ? 'Penyedia' : 'Providers'}
                          hint={
                            isId
                              ? 'Supplier siap dihubungi'
                              : 'Suppliers ready to contact'
                          }
                          count={sideCounts.supply}
                          active={sideFilter === 'supply'}
                          onSelect={setSideFilter}
                        />
                        <SearchResultScopeCard
                          value="demand"
                          label={isId ? 'Pencari' : 'Seekers'}
                          hint={
                            isId
                              ? 'Buyer dan kebutuhan aktif'
                              : 'Buyers and active needs'
                          }
                          count={sideCounts.demand}
                          active={sideFilter === 'demand'}
                          onSelect={setSideFilter}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                        {isId ? 'Urutkan' : 'Sort'}
                      </p>
                      <div className="mt-2 grid gap-2">
                        {SORT_OPTIONS.map(option => (
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
                            <span>
                              {isId ? option.labelId : option.labelEn}
                            </span>
                            {sort === option.value ? (
                              <BadgeCheck className="h-4 w-4" />
                            ) : null}
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

            <section
              className="min-h-0 min-w-0 overflow-y-auto pr-1 pt-2 overscroll-contain"
              data-auto-scrollbar
            >
              <div className="w-full space-y-3 pb-5">
                <section className="rounded-[24px] border border-[color:var(--app-border)] bg-white/96 p-4 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.13)] backdrop-blur-xl">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h1 className="text-[1.38rem] font-black text-[color:var(--app-text)]">
                        {resultsHeading}
                      </h1>
                      <p className="mt-1 text-[13px] text-[color:var(--app-text-soft)]">
                        {resultsSubheading}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canToggleUmkmView ? (
                        <button
                          type="button"
                          onClick={() =>
                            setResultsView(
                              resultsView === 'umkm' ? 'results' : 'umkm',
                            )
                          }
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
                        onClick={() => setFiltersOpen(true)}
                        className="inline-flex min-h-[42px] items-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-white px-4 text-[13px] font-semibold text-[color:var(--app-text)]"
                      >
                        <Filter className="h-4 w-4" />
                        {activeSortLabel}
                      </button>
                    </div>
                  </div>

                  <SearchFilterTabs
                    locale={locale}
                    activeTab={activeSearchTab}
                    onSelect={selectSearchTab}
                    className="mt-3"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    {location ? (
                      <SearchActiveChip
                        icon={MapPin}
                        label={`Lokasi: ${location}`}
                        onRemove={() => {
                          setLocationInput('');
                          setLocation('');
                        }}
                      />
                    ) : null}
                    {usedOnly ? (
                      <SearchActiveChip
                        icon={Package}
                        label={isId ? 'Barang Bekas' : 'Used Goods'}
                        onRemove={() => setUsedOnly(false)}
                      />
                    ) : null}
                    {type !== 'all' && !usedOnly ? (
                      <SearchActiveChip
                        icon={
                          TYPE_OPTIONS.find(option => option.value === type)
                            ?.icon
                        }
                        label={activeTypeLabel}
                        typeKey={type}
                        onRemove={() => setType('all')}
                      />
                    ) : null}
                    {sideFilter !== 'all' ? (
                      <SearchActiveChip
                        label={
                          sideFilter === 'demand'
                            ? isId
                              ? 'Pencari'
                              : 'Seekers'
                            : isId
                              ? 'Penyedia'
                              : 'Providers'
                        }
                        onRemove={() => setSideFilter('all')}
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
                    cartQuantities={cartQuantities}
                    onOpenUmkmView={openUmkmPreview}
                    onAddStoreToCart={addUmkmStoreToCart}
                    onOpenCart={() => setCartOpen(true)}
                  />
                ) : null}

                <SearchProfileResultsSection
                  locale={locale}
                  activeTab={activeSearchTab}
                  profiles={visibleProfiles}
                  loading={discoverLoading}
                  error={discoverError}
                />

                {shouldShowResultCards ? (
                  loading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div
                          key={`desktop-loading-${index}`}
                          className="ui-skeleton ui-skeleton-pulse h-[196px] rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)]"
                        />
                      ))}
                    </div>
                  ) : error ? (
                    <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
                      <p>{error}</p>
                      <button
                        type="button"
                        onClick={() => setRefreshKey(value => value + 1)}
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-rose-700"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        {isId ? 'Coba lagi' : 'Retry'}
                      </button>
                    </div>
                  ) : visibleItems.length === 0 && visibleProfiles.length === 0 ? (
                    <div className="rounded-[30px] border border-[color:var(--app-border)] bg-[radial-gradient(circle_at_top,#ecfdf5_0%,#ffffff_44%,#f8fafc_100%)] px-6 py-11 text-center shadow-[0_22px_48px_-32px_rgba(15,23,42,0.18)]">
                      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-[22px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                        <Search className="h-6 w-6" />
                      </span>
                      <p className="mt-3 text-[20px] font-black tracking-[-0.045em] text-[color:var(--app-text)]">
                        {isId ? 'Belum ketemu yang pas' : 'No good match yet'}
                      </p>
                      <p className="mx-auto mt-1 max-w-[34rem] text-[14px] leading-6 text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Coba longgarkan filter, pakai kata kunci lain, atau jadilah listing pertama untuk kebutuhan ini.'
                          : 'Try broader filters, another keyword, or become the first listing for this need.'}
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
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleItems.map(item => (
                        <SearchResultListingCard
                          key={item.id}
                          item={item}
                          locale={locale}
                          cartQuantity={cartQuantities[item.id] || 0}
                          onAddToCart={addSearchCardToCart}
                          onRemoveFromCart={removeSearchItemFromCart}
                          onOpenCart={() => setCartOpen(true)}
                        />
                      ))}
                    </div>
                  )
                ) : null}

                {visibleItems.length > 0 &&
                  shouldShowResultCards &&
                  !loading ? (
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
                        {loadingMore ? (
                          <RefreshCcw className="h-4 w-4 animate-spin" />
                        ) : null}
                        {isId ? 'Tampilkan lebih banyak' : 'Load more'}
                      </button>
                    ) : (
                      <p className="text-[12px] text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Semua hasil sudah tampil.'
                          : 'All results are shown.'}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </section>
            <SearchRightRail
              isId={isId}
              resultCountLabel={resultCountLabel}
              hasMore={hasMore}
              topResult={topResult}
              umkmStores={umkmStores}
              popularCities={popularCities}
              briefCreateHref={briefCreateHref}
              briefCreateLabel={briefCreateLabel}
              canToggleUmkmView={canToggleUmkmView}
              showingUmkmView={shouldShowUmkmPreview}
              onToggleUmkmView={() =>
                setResultsView(resultsView === 'umkm' ? 'results' : 'umkm')
              }
            />
          </div>
        </div>
      </div>

      <SearchCartDock
        cart={searchCart}
        isId={isId}
        open={cartOpen}
        onOpenChange={setCartOpen}
        onRemove={removeSearchItemFromCart}
        onClear={clearSearchCart}
      />

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
              {isId ? 'Mau cari apa?' : 'What are you looking for?'}
            </p>
            <SearchFilterTabs
              locale={locale}
              activeTab={activeSearchTab}
              onSelect={selectSearchTab}
              className="mt-2"
            />
          </div>

          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
              {isId ? 'Lokasi' : 'Location'}
            </p>
            <label className="mt-2 flex min-w-0 items-center gap-2 rounded-[16px] border border-[color:var(--app-border)] bg-white px-3 py-2">
              <MapPin className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
              <input
                value={locationInput}
                onChange={event => setLocationInput(event.target.value)}
                placeholder={isId ? 'Cari lokasi' : 'Search location'}
                className="min-h-[34px] w-full min-w-0 bg-transparent text-[13px] text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {popularCities.map(city => (
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
              {TYPE_OPTIONS.map(option => {
                const visual = getCategoryVisual(option.value);
                const active = type === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setUsedOnly(false);
                      setType(option.value);
                      if (option.value === 'umkm') setResultsView('umkm');
                    }}
                    className={cn(
                      'flex min-h-[62px] items-center justify-between gap-2 rounded-[18px] border px-3 py-2 text-left transition',
                      typeFilterClass(active, option.value),
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px]',
                          visual.iconBubbleClass,
                        )}
                      >
                        <option.icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-black">
                          {isId ? option.labelId : option.labelEn}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] font-semibold opacity-80">
                          {getCategoryHint(option.value, locale)}
                        </span>
                      </span>
                    </span>
                    {active ? (
                      <BadgeCheck className="h-4 w-4 shrink-0" />
                    ) : null}
                  </button>
                );
              })}
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
                hint={
                  isId
                    ? 'Supplier siap dihubungi'
                    : 'Suppliers ready to contact'
                }
                count={sideCounts.supply}
                active={sideFilter === 'supply'}
                onSelect={setSideFilter}
              />
              <SearchResultScopeCard
                value="demand"
                label={isId ? 'Pencari' : 'Seekers'}
                hint={
                  isId ? 'Buyer dan kebutuhan aktif' : 'Buyers and active needs'
                }
                count={sideCounts.demand}
                active={sideFilter === 'demand'}
                onSelect={setSideFilter}
              />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
              {isId ? 'Urutkan' : 'Sort'}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {SORT_OPTIONS.map(option => (
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
                  {sort === option.value ? (
                    <BadgeCheck className="h-4 w-4" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
