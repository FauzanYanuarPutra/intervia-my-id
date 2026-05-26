'use client';

import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { Modal } from '@/components/common/Modal';
import { AuthCtaLink } from '@/components/home/AuthCtaLink';
import { Header } from '@/components/layout/Header';
import { useAppBack } from '@/lib/navigation/useAppBack';
import { SearchUmkmPreview, type UmkmPreviewStore } from './SearchUmkmPreview';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  ChevronLeft,
  Clock3,
  Filter,
  Handshake,
  Layers3,
  MapPin,
  Minus,
  Package,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
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
  type SearchCartItem,
  type SearchCartItemInput,
  type SearchCartItemKind,
  type SearchCartSession,
} from '@/lib/searchCartSession';
import {
  readUmkmCartSession,
  writeUmkmCartSession,
} from '@/lib/super-app/umkmCartSession';
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
  { value: 'price_low', labelId: 'Harga terendah', labelEn: 'Lowest price' },
  { value: 'price_high', labelId: 'Harga tertinggi', labelEn: 'Highest price' },
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
  const priceLabel =
    price !== '-' ? price : locale === 'id' ? 'Negosiasi' : 'Negotiable';

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
    if (kind === 'product') return 'Checkout / chat';
    if (kind === 'service') return 'Discuss service';
    if (kind === 'property') return 'Schedule visit';
    if (kind === 'job') return 'Apply';
    if (kind === 'freelancer') return 'Chat talent';
    if (kind === 'tool_rental') return 'Arrange rental';
    if (kind === 'business_transfer') return 'Check handover';
    if (kind === 'umkm') return 'Open business';
    return 'Open detail';
  }

  if (kind === 'product') return 'Checkout / chat';
  if (kind === 'service') return 'Bahas jasa';
  if (kind === 'property') return 'Atur survey';
  if (kind === 'job') return 'Lamar';
  if (kind === 'freelancer') return 'Chat talent';
  if (kind === 'tool_rental') return 'Atur sewa';
  if (kind === 'business_transfer') return 'Cek oper usaha';
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

function SearchDesktopTopBar() {
  return (
    <div className="hidden lg:block">
      <Header />
    </div>
  );
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

  return (
    <div
      className={cn(
        'flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
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
              'inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-full border px-3 text-[12px] font-bold transition',
              active
                ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] shadow-[0_14px_26px_-22px_rgba(22,163,74,0.42)]'
                : 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-strong)]',
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
  const previewImage = item.image || item.images[0];
  const updatedLabel = formatShortDate(item.updatedAt, locale);
  const visual = getCategoryVisual(item.typeKey);
  const CategoryIcon = visual.icon;
  const badgeTone =
    'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] border-[color:var(--app-border)]';
  const openLabel = isId ? 'Buka' : 'Open';
  const cartAriaLabel =
    cartQuantity > 0
      ? isId
        ? 'Buka keranjang'
        : 'Open cart'
      : isId
        ? 'Tambah ke keranjang'
        : 'Add to cart';

  return (
    <article
      data-testid="search-result-card"
      className={cn(
        'overflow-hidden rounded-[18px] border shadow-[0_14px_32px_-28px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_48px_-40px_rgba(15,23,42,0.22)] sm:rounded-[20px]',
        visual.cardClass,
      )}
    >
      <div className="grid min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-0 sm:grid-cols-[132px_minmax(0,1fr)] xl:grid-cols-[148px_minmax(0,1fr)_158px] 2xl:grid-cols-[156px_minmax(0,1fr)_170px]">
        <Link
          href={item.href}
          className={cn(
            'relative min-h-full overflow-hidden',
            visual.imageClass,
          )}
          aria-label={isId ? 'Buka detail' : 'Open details'}
        >
          {previewImage ? (
            <Image
              src={previewImage}
              alt={item.title}
              fill
              className="object-cover transition duration-500 hover:scale-[1.035]"
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
          <div className="absolute left-1.5 top-1.5 sm:left-2.5 sm:top-2.5">
            <span
              className={cn(
                'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold sm:px-2.5 sm:py-1 sm:text-[10px]',
                visual.chipClass,
              )}
            >
              <CategoryIcon className="h-3.5 w-3.5" />
              <span className="truncate">{item.typeLabel}</span>
            </span>
          </div>
        </Link>

        <div className="min-w-0 border-l border-[color:var(--app-border)] p-2.5 sm:p-3 xl:p-3.5">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
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
              <h3 className="line-clamp-2 text-[0.9rem] font-black leading-snug tracking-[-0.025em] text-[color:var(--app-text)] group-hover:text-[color:var(--app-accent)] sm:text-[1rem]">
                {item.title}
              </h3>
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[color:var(--app-text-soft)] sm:mt-1.5 sm:gap-x-3 sm:text-[11px]">
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

          <p className="mt-1.5 line-clamp-1 text-[11px] leading-4 text-[color:var(--app-text-soft)] sm:text-[12px]">
            {item.summary ||
              (isId
                ? 'Siap dibuka. Lanjut chat.'
                : 'Listing ready to open and follow up.')}
          </p>

          <div className="mt-2 flex items-end justify-between gap-2 xl:hidden">
            <div className="min-w-0">
              <p
                className={cn(
                  'truncate text-[0.98rem] font-black sm:text-[1.12rem]',
                  visual.priceClass,
                )}
              >
                {item.priceLabel}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  cartQuantity > 0 ? onOpenCart() : onAddToCart(item)
                }
                aria-label={cartAriaLabel}
                className={cn(
                  'relative inline-flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[12px] text-[11px] font-semibold sm:h-[38px] sm:w-[38px]',
                  visual.solidButtonClass,
                )}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                {cartQuantity > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-white bg-[color:var(--app-text)] px-1 text-[10px] font-black text-white">
                    {cartQuantity}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'hidden border-l border-[color:var(--app-border)] p-3 xl:flex xl:flex-col xl:justify-between',
            visual.sidePanelClass,
          )}
        >
          <div>
            <p
              className={cn(
                'text-[1.04rem] font-black leading-tight',
                visual.priceClass,
              )}
            >
              {item.priceLabel}
            </p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[color:var(--app-text-soft)]">
              {item.sideContextLabel}
            </p>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <button
                type="button"
                onClick={() =>
                  cartQuantity > 0 ? onOpenCart() : onAddToCart(item)
                }
                className={cn(
                  'inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[12px] px-3 text-[12px] font-semibold',
                  visual.solidButtonClass,
                )}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                {cartQuantity > 0
                  ? `${cartQuantity} ${isId ? 'item' : 'items'}`
                  : isId
                    ? 'Simpan'
                    : 'Save'}
              </button>
              {cartQuantity > 0 ? (
                <button
                  type="button"
                  onClick={() => onRemoveFromCart(item.id)}
                  aria-label={
                    isId ? 'Kurangi dari keranjang' : 'Remove from cart'
                  }
                  className={cn(
                    'inline-flex h-[38px] w-[38px] items-center justify-center rounded-[12px] border text-[12px] font-semibold',
                    visual.outlineButtonClass,
                  )}
                >
                  <Minus className="h-3.5 w-3.5" />
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
              {openLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function SearchCartDock({
  cart,
  isId,
  open,
  onOpenChange,
  onIncrement,
  onDecrement,
  onClear,
}: {
  cart: SearchCartSession;
  isId: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIncrement: (item: SearchCartItem) => void;
  onDecrement: (itemId: string) => void;
  onClear: () => void;
}) {
  if (cart.itemCount <= 0) return null;

  const visibleItems = cart.items.slice(0, 4);
  const firstItem = cart.items[0];
  const countLabel = `${cart.itemCount} ${isId ? 'item' : 'items'}`;

  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-[70] lg:bottom-5 lg:left-auto lg:right-5 lg:w-[360px]">
      {!open ? (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="ui-pressable flex min-h-[54px] w-full items-center justify-between gap-3 rounded-[20px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-surface-strong)] px-3 text-left shadow-[0_22px_46px_-28px_rgba(15,23,42,0.34)] backdrop-blur-xl"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] bg-[color:var(--app-accent)] text-white">
              <ShoppingCart className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-black text-[color:var(--app-text)]">
                {isId ? 'Keranjang' : 'Cart'}
              </span>
              <span className="block truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                {countLabel}
              </span>
            </span>
          </span>
          <span className="rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[11px] font-black text-[color:var(--app-accent)]">
            {isId ? 'Buka' : 'Open'}
          </span>
        </button>
      ) : (
        <section className="overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_24px_54px_-26px_rgba(15,23,42,0.34)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] px-3 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-black text-[color:var(--app-text)]">
                {isId ? 'Keranjang' : 'Cart'}
              </p>
              <p className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                {countLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]"
              aria-label={isId ? 'Tutup keranjang' : 'Close cart'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            className="max-h-[min(52vh,360px)] overflow-y-auto p-2.5"
            data-auto-scrollbar
          >
            <div className="space-y-2">
              {visibleItems.map(item => (
                <div
                  key={item.id}
                  className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 rounded-[18px] bg-[color:var(--app-surface-muted)] p-2"
                >
                  <Link
                    href={item.href}
                    className="relative h-11 w-11 overflow-hidden rounded-[14px] bg-white"
                  >
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes="44px"
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
                      className="block truncate text-[12px] font-black text-[color:var(--app-text)]"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-0.5 truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                      {item.typeLabel} - {item.priceLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDecrement(item.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[color:var(--app-text)]"
                      aria-label={isId ? 'Kurangi item' : 'Decrease item'}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[20px] text-center text-[11px] font-black text-[color:var(--app-text)]">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onIncrement(item)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[color:var(--app-accent)]"
                      aria-label={isId ? 'Tambah item' : 'Increase item'}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {cart.items.length > visibleItems.length ? (
              <p className="px-2 pt-2 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                +{cart.items.length - visibleItems.length}{' '}
                {isId ? 'item lain tersimpan' : 'more saved items'}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 border-t border-[color:var(--app-border)] p-3">
            <button
              type="button"
              onClick={onClear}
              className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] border border-[color:var(--app-border)] px-3 text-[12px] font-semibold text-[color:var(--app-text-soft)]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <Link
              href={firstItem?.href || '/search'}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[14px] bg-[color:var(--app-accent)] px-4 text-[12px] font-black text-white"
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
  const [searchCart, setSearchCart] = useState<SearchCartSession>(
    EMPTY_SEARCH_CART_SESSION,
  );
  const [cartOpen, setCartOpen] = useState(false);

  const canToggleUmkmView = type === 'all' || type === 'umkm';
  const shouldShowUmkmPreview = resultsView === 'umkm' || type === 'umkm';
  const shouldShowResultCards = !shouldShowUmkmPreview;

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

  const mirrorSearchItemToUmkmCart = useCallback(
    (input: SearchCartItemInput) => {
      if (!input.storeId || !input.storeSlug || !input.productId) return;

      const existing = readUmkmCartSession();
      const sameStore = existing?.storeId === input.storeId;
      const existingItems = sameStore ? existing.items : {};
      const nextQuantity = Math.min(
        99,
        Math.max(1, (existingItems[input.productId] || 0) + 1),
      );

      writeUmkmCartSession({
        storeId: input.storeId,
        storeSlug: input.storeSlug,
        storeName: input.storeName || input.title,
        mode: 'online',
        items: {
          ...existingItems,
          [input.productId]: nextQuantity,
        },
      });
    },
    [],
  );

  const addSearchCardToCart = useCallback(
    (item: SearchCard) => {
      const input = buildSearchCartInput(item, locale);
      const nextCart = upsertSearchCartItem(input, 1);
      setSearchCart(nextCart);
      mirrorSearchItemToUmkmCart(input);
      setCartOpen(true);
    },
    [locale, mirrorSearchItemToUmkmCart],
  );

  const addUmkmStoreToCart = useCallback(
    (store: UmkmPreviewStore) => {
      const nextCart = upsertSearchCartItem(
        buildStoreCartInput(store, locale),
        1,
      );
      setSearchCart(nextCart);
      setCartOpen(true);
    },
    [locale],
  );

  const removeSearchItemFromCart = useCallback((itemId: string) => {
    const currentCart = readSearchCartSession();
    const existing = currentCart.items.find(item => item.id === itemId);

    const nextCart =
      existing && existing.quantity > 1
        ? upsertSearchCartItem(existing, -1)
        : removeSearchCartItem(itemId);

    setSearchCart(nextCart);
    if (nextCart.itemCount === 0) setCartOpen(false);
  }, []);

  const incrementSearchCartItem = useCallback(
    (item: SearchCartItem) => {
      const nextCart = upsertSearchCartItem(item, 1);
      setSearchCart(nextCart);
      mirrorSearchItemToUmkmCart(item);
    },
    [mirrorSearchItemToUmkmCart],
  );

  const clearSearchCart = useCallback(() => {
    const nextCart = clearSearchCartSession();
    setSearchCart(nextCart);
    setCartOpen(false);
  }, []);

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
    setUsedOnly(false);
    setResultsView('results');
    setFiltersOpen(false);
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
      ? 'Jual barang bekas'
      : 'Sell used goods'
    : isId
      ? type === 'service'
        ? 'Butuh jasa'
        : type === 'business_transfer'
          ? 'Jual usaha'
          : type === 'freelancer' || type === 'job'
            ? 'Butuh talent'
            : 'Butuh supplier'
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
    <div className="lajukan-home-compact lajukan-market-page lajukan-market-search lajukan-search-compact min-h-screen px-3 pb-6 pt-0 sm:px-4 lg:h-[100svh] lg:min-h-0 lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0">
      <div className="lajukan-home-shell lajukan-search-shell mx-auto h-full lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
        <div className="space-y-4 lg:hidden">
          <div className="ui-layer-local-topbar fixed inset-x-0 top-0 flex items-center gap-2 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)] px-2 pb-1.5 pt-[calc(env(safe-area-inset-top)+0.35rem)] shadow-[0_12px_26px_-24px_rgba(15,23,42,0.26)] backdrop-blur-xl sm:px-3">
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
              className="min-w-0 flex-1"
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
                  onChange={event => setQueryInput(event.target.value)}
                  placeholder={
                    isId
                      ? 'Cari supplier, jasa, lokasi...'
                      : 'Search suppliers, places, services...'
                  }
                  className="ui-navbar-search-input"
                />
              </label>
            </form>
            {canToggleUmkmView ? (
              <button
                type="button"
                onClick={() =>
                  setResultsView(resultsView === 'umkm' ? 'results' : 'umkm')
                }
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-[12px] font-semibold text-[color:var(--app-text)] shadow-[0_12px_24px_-22px_rgba(15,23,42,0.16)]"
                data-testid="search-mobile-view-toggle"
              >
                <Layers3 className="h-4 w-4" />
                {mobileMapLabel}
              </button>
            ) : null}
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
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-[13px] border border-[color:var(--app-border)] px-3 text-[13px] font-semibold text-[color:var(--app-text)]"
                data-testid="search-mobile-filter-button"
              >
                <Filter className="h-4.5 w-4.5" />
                {isId ? 'Urutkan' : 'Sort'}
              </button>
            </div>

            <SearchFilterTabs
              locale={locale}
              activeTab={activeSearchTab}
              onSelect={selectSearchTab}
              className="mt-3"
            />

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-[13px] border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-semibold text-emerald-700"
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

          {shouldShowResultCards ? (
            loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`mobile-loading-${index}`}
                    className="ui-skeleton ui-skeleton-pulse h-[136px] rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] sm:h-[156px] sm:rounded-[20px]"
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
            ) : visibleItems.length === 0 ? (
              <div className="rounded-[26px] border border-[color:var(--app-border)] bg-white px-5 py-8 text-center shadow-[0_18px_36px_-28px_rgba(15,23,42,0.12)]">
                <p className="text-[15px] text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Belum ada hasil yang cocok.'
                    : 'No matching results yet.'}
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
              <div className="space-y-2.5">
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
          <SearchDesktopTopBar />
          <div
            aria-hidden="true"
            className="hidden h-[4.625rem] shrink-0 lg:block"
          />

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

                {shouldShowResultCards ? (
                  loading ? (
                    <div className="space-y-2.5">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div
                          key={`desktop-loading-${index}`}
                          className="ui-skeleton ui-skeleton-pulse h-[132px] rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)]"
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
                  ) : visibleItems.length === 0 ? (
                    <div className="rounded-[28px] border border-[color:var(--app-border)] bg-white px-6 py-10 text-center shadow-[0_18px_36px_-28px_rgba(15,23,42,0.12)]">
                      <p className="text-[16px] text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Belum ada hasil yang pas.'
                          : 'No perfect match yet.'}
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
                    <div className="space-y-2.5">
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
        onIncrement={incrementSearchCartItem}
        onDecrement={removeSearchItemFromCart}
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
