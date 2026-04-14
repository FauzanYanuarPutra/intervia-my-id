'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { Modal } from '@/components/common/Modal';
import {
  DISCOVERY_COMPACT_CARD_BASELINE_CLASS,
  MarketplaceDiscoveryCard,
} from '@/components/discovery/MarketplaceDiscoveryCard';
import { AuthCtaLink } from '@/components/home/AuthCtaLink';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Briefcase,
  ChevronRight,
  ImageIcon,
  Layers3,
  MapPin,
  Package,
  RefreshCcw,
  Search,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Store,
  Users,
  UserRound,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { UMKM_DISCOVERY_PATH } from '@/lib/umkmSurface';
import {
  asString,
  ContentItem,
  extractContentItems,
  formatIDRFromCents,
  parseImages,
} from '@/lib/content/catalog';
import {
  buildPublicProfileHrefFromContent,
  resolveOwnerUserIdFromContent,
} from '@/lib/profile/publicProfileLink';
import {
  getListingSideContextLabel,
  getListingSideLabel,
  resolveListingSide,
  type ListingSide,
} from '@/lib/content/listingSide';
import {
  resolveUmkmCreateHrefForType,
} from '@/lib/umkmBusinessFlow';
import { CONTENT_TYPES, getContentTypeShort } from '@/data/contentTypes';
import { SearchUmkmPreview, type UmkmPreviewStore } from './SearchUmkmPreview';
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
type GroupKey = 'supply' | 'demand' | 'talent' | 'property' | 'rental' | 'umkm' | 'other';
type SideFilter = 'all' | 'demand' | 'supply';
type LayoutMode = 'comfortable' | 'compact';
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
  group: GroupKey;
  image?: string;
  images: string[];
  href: string;
  profileHref?: string | null;
  chatUserId?: string | null;
  updatedAt: number;
  priceCents: number | null;
  entityKind: 'person' | 'listing';
  verified: boolean;
  hasMedia: boolean;
};

type QuickSearch = {
  id: string;
  query: string;
  type?: TypeKey;
  side: Exclude<SideFilter, 'all'>;
  labelId: string;
  labelEn: string;
};

type SearchStarter = {
  id: string;
  query: string;
  type: TypeKey;
  side: Exclude<SideFilter, 'all'>;
  labelId: string;
  labelEn: string;
  bodyId: string;
  bodyEn: string;
  icon: LucideIcon;
  accentClass: string;
  iconClass: string;
};

type SearchIntentLane = {
  value: Exclude<SideFilter, 'all'>;
  labelId: string;
  labelEn: string;
  bodyId: string;
  bodyEn: string;
  hintId: string;
  hintEn: string;
  icon: LucideIcon;
  accentClass: string;
  iconClass: string;
  activeClass: string;
};

type SearchModeGuide = {
  value: TypeKey;
  labelId: string;
  labelEn: string;
  bodyId: string;
  bodyEn: string;
  icon: LucideIcon;
  accentClass: string;
  iconClass: string;
};

type MvpFocusLane = {
  id: string;
  titleId: string;
  titleEn: string;
  bodyId: string;
  bodyEn: string;
  insightId: string;
  insightEn: string;
  query: string;
  type: TypeKey;
  icon: LucideIcon;
  accentClass: string;
};

const TYPE_OPTIONS: Array<{
  value: TypeKey;
  labelId: string;
  labelEn: string;
  group: GroupKey;
}> = [
  { value: 'all', labelId: 'Semua', labelEn: 'All', group: 'other' },
  { value: 'job', labelId: 'Loker', labelEn: 'Jobs', group: 'demand' },
  { value: 'freelancer', labelId: 'Talent', labelEn: 'Talent', group: 'talent' },
  { value: 'product', labelId: 'Supplier', labelEn: 'Suppliers', group: 'supply' },
  { value: 'service', labelId: 'Jasa', labelEn: 'Services', group: 'supply' },
  {
    value: 'tool_rental',
    labelId: 'Sewa',
    labelEn: 'Rentals',
    group: 'rental',
  },
  { value: 'property', labelId: 'Lokasi', labelEn: 'Locations', group: 'property' },
  { value: 'umkm', labelId: 'Usaha', labelEn: 'Business', group: 'umkm' },
];

const SEARCH_INTENT_LANES: SearchIntentLane[] = [
  {
    value: 'supply',
    labelId: 'Cari penawaran',
    labelEn: 'Find offers',
    bodyId: 'Supplier, jasa, lokasi, dan usaha siap dihubungi.',
    bodyEn: 'Suppliers, services, spaces, and businesses ready to contact.',
    hintId: 'Cocok kalau mau beli, sewa, booking, atau chat sekarang.',
    hintEn: 'Best when you want to buy, rent, book, or chat now.',
    icon: Store,
    accentClass:
      'from-sky-400/18 via-cyan-300/10 to-transparent dark:from-sky-400/18 dark:via-cyan-400/12 dark:to-transparent',
    iconClass:
      'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900',
    activeClass:
      'border-sky-300 bg-sky-50 shadow-[0_20px_40px_-30px_rgba(14,165,233,0.34)] dark:border-sky-700 dark:bg-sky-950/40',
  },
  {
    value: 'demand',
    labelId: 'Cari kebutuhan',
    labelEn: 'Find needs',
    bodyId: 'Brief dan permintaan dari yang lagi cari supplier, jasa, atau lokasi.',
    bodyEn: 'Briefs and requests from people looking for suppliers, services, or spaces.',
    hintId: 'Cocok kalau mau jual, nawarin jasa, atau cari buyer.',
    hintEn: 'Best when you want to sell, offer services, or find buyers.',
    icon: UserRound,
    accentClass:
      'from-indigo-400/18 via-blue-300/10 to-transparent dark:from-indigo-400/18 dark:via-blue-400/12 dark:to-transparent',
    iconClass:
      'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-900',
    activeClass:
      'border-indigo-300 bg-indigo-50 shadow-[0_20px_40px_-30px_rgba(79,70,229,0.34)] dark:border-indigo-700 dark:bg-indigo-950/40',
  },
];

const PRIMARY_TYPE_OPTIONS = TYPE_OPTIONS;
const DISCOVERY_TYPE_OPTIONS = TYPE_OPTIONS.filter((option) =>
  ['all', 'product', 'service', 'freelancer', 'job', 'umkm'].includes(option.value),
);

type SearchFilterVisual = {
  icon: LucideIcon;
  active: string;
  idle: string;
  iconWrap: string;
  count: string;
};

const FILTER_IDLE_SURFACE =
  'border-[color:color-mix(in_srgb,var(--app-border)_92%,white_8%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_95%,transparent))] text-slate-600 dark:border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_97%,rgba(15,23,42,0.98)),color-mix(in_srgb,var(--app-surface)_94%,rgba(2,6,23,0.98)))] dark:text-slate-300';
const FILTER_NEUTRAL_ACTIVE =
  'border-[color:color-mix(in_srgb,var(--app-border-strong)_76%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface-muted)_90%,transparent))] text-slate-800 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.18)] dark:border-[color:color-mix(in_srgb,var(--app-border-strong)_84%,transparent)] dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_97%,rgba(15,23,42,0.98)),color-mix(in_srgb,var(--app-surface)_96%,rgba(2,6,23,0.98)))] dark:text-slate-100';
const FILTER_NEUTRAL_ICON_WRAP =
  'bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,white_6%)] text-slate-700 ring-1 ring-[color:color-mix(in_srgb,var(--app-border)_92%,white_8%)] dark:bg-[color:color-mix(in_srgb,var(--app-surface-strong)_90%,rgba(15,23,42,0.98))] dark:text-slate-100 dark:ring-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)]';
const FILTER_NEUTRAL_COUNT =
  'bg-[color:color-mix(in_srgb,var(--app-surface-muted)_94%,white_6%)] text-slate-700 dark:bg-[color:color-mix(in_srgb,var(--app-surface)_92%,rgba(2,6,23,0.98))] dark:text-slate-200';

function getSideFilterVisual(value: SideFilter): SearchFilterVisual {
  if (value === 'supply') {
    return {
      icon: Store,
      active:
        'border-sky-300 bg-sky-50 text-sky-700 shadow-[0_18px_34px_-28px_rgba(14,165,233,0.34)] dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
      idle:
        `${FILTER_IDLE_SURFACE} hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:hover:border-sky-800 dark:hover:bg-sky-950/30 dark:hover:text-sky-200`,
      iconWrap:
        'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900',
      count: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200',
    };
  }

  if (value === 'demand') {
    return {
      icon: UserRound,
      active:
        'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-[0_18px_34px_-28px_rgba(99,102,241,0.34)] dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200',
      idle:
        `${FILTER_IDLE_SURFACE} hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-200`,
      iconWrap:
        'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-900',
      count: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200',
    };
  }

  return {
    icon: Layers3,
    active: FILTER_NEUTRAL_ACTIVE,
    idle: `${FILTER_IDLE_SURFACE} hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-100`,
    iconWrap: FILTER_NEUTRAL_ICON_WRAP,
    count: FILTER_NEUTRAL_COUNT,
  };
}

function getTypeFilterVisual(value: TypeKey): SearchFilterVisual {
  if (value === 'job') {
    return {
      icon: Briefcase,
      active:
        'border-rose-300 bg-rose-50 text-rose-700 shadow-[0_18px_34px_-28px_rgba(244,63,94,0.34)] dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
      idle:
        `${FILTER_IDLE_SURFACE} hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:border-rose-800 dark:hover:bg-rose-950/30 dark:hover:text-rose-200`,
      iconWrap:
        'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900',
      count: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200',
    };
  }

  if (value === 'freelancer') {
    return {
      icon: Sparkles,
      active:
        'border-violet-300 bg-violet-50 text-violet-700 shadow-[0_18px_34px_-28px_rgba(139,92,246,0.34)] dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200',
      idle:
        `${FILTER_IDLE_SURFACE} hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 dark:hover:border-violet-800 dark:hover:bg-violet-950/30 dark:hover:text-violet-200`,
      iconWrap:
        'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900',
      count: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200',
    };
  }

  if (value === 'product') {
    return {
      icon: Package,
      active:
        'border-sky-300 bg-sky-50 text-sky-700 shadow-[0_18px_34px_-28px_rgba(14,165,233,0.34)] dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
      idle:
        `${FILTER_IDLE_SURFACE} hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:hover:border-sky-800 dark:hover:bg-sky-950/30 dark:hover:text-sky-200`,
      iconWrap:
        'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900',
      count: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200',
    };
  }

  if (value === 'service') {
    return {
      icon: Wrench,
      active:
        'border-cyan-300 bg-cyan-50 text-cyan-700 shadow-[0_18px_34px_-28px_rgba(6,182,212,0.34)] dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200',
      idle:
        `${FILTER_IDLE_SURFACE} hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 dark:hover:border-cyan-800 dark:hover:bg-cyan-950/30 dark:hover:text-cyan-200`,
      iconWrap:
        'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-900',
      count: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-200',
    };
  }

  if (value === 'tool_rental') {
    return {
      icon: Snowflake,
      active:
        'border-amber-300 bg-amber-50 text-amber-700 shadow-[0_18px_34px_-28px_rgba(245,158,11,0.34)] dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
      idle:
        `${FILTER_IDLE_SURFACE} hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:hover:border-amber-800 dark:hover:bg-amber-950/30 dark:hover:text-amber-200`,
      iconWrap:
        'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900',
      count: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200',
    };
  }

  if (value === 'property') {
    return {
      icon: MapPin,
      active:
        'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 shadow-[0_18px_34px_-28px_rgba(217,70,239,0.34)] dark:border-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-200',
      idle:
        `${FILTER_IDLE_SURFACE} hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:hover:border-fuchsia-800 dark:hover:bg-fuchsia-950/30 dark:hover:text-fuchsia-200`,
      iconWrap:
        'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:ring-fuchsia-900',
      count: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/50 dark:text-fuchsia-200',
    };
  }

  if (value === 'umkm') {
    return {
      icon: Store,
      active:
        'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-[0_18px_34px_-28px_rgba(16,185,129,0.34)] dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
      idle:
        `${FILTER_IDLE_SURFACE} hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-200`,
      iconWrap:
        'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900',
      count: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200',
    };
  }

  return {
    icon: Layers3,
    active: FILTER_NEUTRAL_ACTIVE,
    idle: `${FILTER_IDLE_SURFACE} hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-100`,
    iconWrap: FILTER_NEUTRAL_ICON_WRAP,
    count: FILTER_NEUTRAL_COUNT,
  };
}

const SORT_OPTIONS: Array<{ value: SortKey; labelId: string; labelEn: string }> = [
  { value: 'relevance', labelId: 'Relevansi', labelEn: 'Relevance' },
  { value: 'newest', labelId: 'Terbaru', labelEn: 'Newest' },
  { value: 'price_low', labelId: 'Harga rendah', labelEn: 'Lower price first' },
  { value: 'price_high', labelId: 'Harga tinggi', labelEn: 'Higher price first' },
];

// Legacy group tone map kept commented for now. Search UI no longer uses this
// local style lookup directly after the sourcing-first cleanup.
// const GROUP_STYLES: Record<GroupKey, { text: string; bg: string; border: string }> = {
//   supply: { text: 'ui-supply-text', bg: 'ui-supply-bg', border: 'ui-supply-border' },
//   demand: { text: 'ui-demand-text', bg: 'ui-demand-bg', border: 'ui-demand-border' },
//   talent: { text: 'ui-talent-text', bg: 'ui-talent-bg', border: 'ui-talent-border' },
//   property: { text: 'ui-info-text', bg: 'ui-info-bg', border: 'ui-info-border' },
//   rental: { text: 'ui-warning-text', bg: 'ui-warning-bg', border: 'ui-warning-border' },
//   umkm: {
//     text: 'text-sky-700 dark:text-sky-200',
//     bg: 'bg-sky-50 dark:bg-sky-950/40',
//     border: 'border-sky-200 dark:border-sky-800',
//   },
//   other: { text: 'ui-text-soft', bg: 'ui-surface-muted', border: 'ui-border' },
// };

const QUICK_SEARCHES: QuickSearch[] = [
  {
    id: 'supplier',
    query: 'supplier sembako',
    type: 'product',
    side: 'supply',
    labelId: 'Supplier sembako',
    labelEn: 'Staple goods supplier',
  },
  {
    id: 'distributor',
    query: 'distributor skincare',
    type: 'product',
    side: 'supply',
    labelId: 'Distributor skincare',
    labelEn: 'Skincare distributor',
  },
  {
    id: 'bahan-baku',
    query: 'bahan baku frozen food',
    type: 'product',
    side: 'supply',
    labelId: 'Bahan baku frozen food',
    labelEn: 'Frozen food raw materials',
  },
  {
    id: 'lokasi-jual',
    query: 'lokasi jualan',
    type: 'property',
    side: 'supply',
    labelId: 'Lokasi jualan',
    labelEn: 'Selling locations',
  },
  {
    id: 'ruko',
    query: 'ruko food court',
    type: 'property',
    side: 'supply',
    labelId: 'Ruko food court',
    labelEn: 'Food court shophouse',
  },
  {
    id: 'freezer',
    query: 'freezer',
    type: 'tool_rental',
    side: 'supply',
    labelId: 'Sewa freezer',
    labelEn: 'Freezer rental',
  },
  {
    id: 'kemasan',
    query: 'jasa kemasan produk',
    type: 'service',
    side: 'supply',
    labelId: 'Jasa kemasan produk',
    labelEn: 'Product packaging service',
  },
  {
    id: 'admin-marketplace',
    query: 'admin marketplace',
    type: 'freelancer',
    side: 'supply',
    labelId: 'Admin marketplace',
    labelEn: 'Marketplace admin',
  },
  {
    id: 'channel',
    query: 'optimasi marketplace',
    type: 'service',
    side: 'supply',
    labelId: 'Optimasi marketplace',
    labelEn: 'Marketplace optimization',
  },
  // Legacy quick searches are intentionally hidden while sourcing-first search
  // is active:
  // { id: 'barista', query: 'barista', type: 'job', labelId: 'Lowongan barista', labelEn: 'Barista jobs' },
  // { id: 'kos', query: 'kos dekat kampus', type: 'property', labelId: 'Kos dekat kampus', labelEn: 'Student housing' },
];

const SEARCH_STARTERS: SearchStarter[] = [
  {
    id: 'starter-sembako',
    query: 'supplier sembako',
    type: 'product',
    side: 'supply',
    labelId: 'Supplier sembako',
    labelEn: 'Staple supplier',
    bodyId: 'Buka stok cepat',
    bodyEn: 'Restock fast',
    icon: Package,
    accentClass:
      'from-amber-400/18 via-orange-300/10 to-transparent dark:from-amber-400/20 dark:via-orange-400/12 dark:to-transparent',
    iconClass:
      'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900',
  },
  {
    id: 'starter-skincare',
    query: 'distributor skincare',
    type: 'product',
    side: 'supply',
    labelId: 'Distributor skincare',
    labelEn: 'Skincare distributor',
    bodyId: 'Cari channel jual',
    bodyEn: 'Find sales channels',
    icon: Sparkles,
    accentClass:
      'from-pink-400/18 via-rose-300/10 to-transparent dark:from-pink-400/20 dark:via-rose-400/12 dark:to-transparent',
    iconClass:
      'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900',
  },
  {
    id: 'starter-frozen-food',
    query: 'bahan baku frozen food',
    type: 'product',
    side: 'supply',
    labelId: 'Bahan baku frozen food',
    labelEn: 'Frozen food ingredients',
    bodyId: 'Stok dingin',
    bodyEn: 'Cold stock',
    icon: Snowflake,
    accentClass:
      'from-sky-400/18 via-cyan-300/10 to-transparent dark:from-sky-400/20 dark:via-cyan-400/12 dark:to-transparent',
    iconClass:
      'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900',
  },
  {
    id: 'starter-demand-buyer',
    query: 'cari reseller skincare',
    type: 'product',
    side: 'demand',
    labelId: 'Cari reseller skincare',
    labelEn: 'Need skincare resellers',
    bodyId: 'Cari reseller',
    bodyEn: 'Find resellers',
    icon: Sparkles,
    accentClass:
      'from-fuchsia-400/18 via-pink-300/10 to-transparent dark:from-fuchsia-400/20 dark:via-pink-400/12 dark:to-transparent',
    iconClass:
      'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:ring-fuchsia-900',
  },
  {
    id: 'starter-demand-booth',
    query: 'cari booth bazaar',
    type: 'property',
    side: 'demand',
    labelId: 'Cari booth bazaar',
    labelEn: 'Need a bazaar booth',
    bodyId: 'Cari tempat jual',
    bodyEn: 'Find a selling spot',
    icon: MapPin,
    accentClass:
      'from-emerald-400/18 via-teal-300/10 to-transparent dark:from-emerald-400/20 dark:via-teal-400/12 dark:to-transparent',
    iconClass:
      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900',
  },
  {
    id: 'starter-demand-service',
    query: 'butuh jasa kemasan',
    type: 'service',
    side: 'demand',
    labelId: 'Butuh jasa kemasan',
    labelEn: 'Need packaging service',
    bodyId: 'Rapikan operasional',
    bodyEn: 'Fix operations',
    icon: Wrench,
    accentClass:
      'from-violet-400/18 via-indigo-300/10 to-transparent dark:from-violet-400/20 dark:via-indigo-400/12 dark:to-transparent',
    iconClass:
      'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900',
  },
];

const SEARCH_MODE_GUIDES: SearchModeGuide[] = [
  {
    value: 'all',
    labelId: 'Semua',
    labelEn: 'All',
    bodyId: 'Campur semua',
    bodyEn: 'Mixed results',
    icon: Layers3,
    accentClass:
      'from-slate-200/70 via-slate-100/20 to-transparent dark:from-slate-700/40 dark:via-slate-800/10 dark:to-transparent',
    iconClass:
      'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700',
  },
  {
    value: 'product',
    labelId: 'Supplier',
    labelEn: 'Supplier',
    bodyId: 'Supplier & stok',
    bodyEn: 'Suppliers & stock',
    icon: Package,
    accentClass:
      'from-amber-400/18 via-orange-300/10 to-transparent dark:from-amber-400/20 dark:via-orange-400/12 dark:to-transparent',
    iconClass:
      'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900',
  },
  {
    value: 'property',
    labelId: 'Lokasi jualan',
    labelEn: 'Selling spots',
    bodyId: 'Booth & kios',
    bodyEn: 'Booths & kiosks',
    icon: MapPin,
    accentClass:
      'from-emerald-400/18 via-teal-300/10 to-transparent dark:from-emerald-400/20 dark:via-teal-400/12 dark:to-transparent',
    iconClass:
      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900',
  },
  {
    value: 'service',
    labelId: 'Jasa',
    labelEn: 'Services',
    bodyId: 'Jasa pendukung',
    bodyEn: 'Support services',
    icon: Wrench,
    accentClass:
      'from-violet-400/18 via-indigo-300/10 to-transparent dark:from-violet-400/20 dark:via-indigo-400/12 dark:to-transparent',
    iconClass:
      'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900',
  },
];

const MVP_FOCUS_LANES: MvpFocusLane[] = [
  {
    id: 'food-processing',
    titleId: 'Pengolahan pangan',
    titleEn: 'Food processing',
    bodyId:
      'Bahan baku, kemasan, freezer, sampai lokasi jual. Cocok buat usaha yang butuh stok cepat.',
    bodyEn:
      'Raw materials, packaging, freezers, and selling spots for businesses that need fast stock flow.',
    insightId: 'Bahan baku -> kemasan -> jualan',
    insightEn: 'Raw materials -> packaging -> sales',
    query: 'bahan baku makanan',
    type: 'product',
    icon: Package,
    accentClass:
      'from-amber-400/18 via-orange-300/12 to-transparent dark:from-amber-400/18 dark:via-orange-400/12 dark:to-transparent',
  },
  {
    id: 'beauty-commerce',
    titleId: 'Beauty & skincare',
    titleEn: 'Beauty and skincare',
    bodyId:
      'Distributor, kemasan, foto, live host, dan admin marketplace buat brand yang mau naik cepat.',
    bodyEn:
      'Distributors, packaging, product shoots, live hosts, and marketplace admins for brands ready to grow fast.',
    insightId: 'Supplier -> konten -> repeat order',
    insightEn: 'Supplier -> content -> repeat orders',
    query: 'skincare',
    type: 'product',
    icon: Store,
    accentClass:
      'from-rose-400/18 via-fuchsia-300/12 to-transparent dark:from-rose-400/18 dark:via-fuchsia-400/12 dark:to-transparent',
  },
  {
    id: 'fashion-reseller',
    titleId: 'Fashion reseller',
    titleEn: 'Fashion reseller',
    bodyId:
      'Supplier, konveksi, kemasan, katalog, dan support toko untuk reseller fashion.',
    bodyEn:
      'Suppliers, production partners, packaging, catalogs, and store support for fashion resellers.',
    insightId: 'Supplier -> katalog -> fulfillment',
    insightEn: 'Supplier -> catalog -> fulfillment',
    query: 'fashion',
    type: 'product',
    icon: Store,
    accentClass:
      'from-indigo-400/18 via-blue-300/12 to-transparent dark:from-indigo-400/18 dark:via-blue-400/12 dark:to-transparent',
  },
  {
    id: 'ops-growth',
    titleId: 'Operasional digital usaha',
    titleEn: 'Digital business operations',
    bodyId:
      'Admin marketplace, konten, CS, ads, dan jasa harian biar usaha makin rapi.',
    bodyEn:
      'Marketplace admins, content, CS, ads, and daily services to keep the business cleaner and faster.',
    insightId: 'Supply siap -> eksekusi jalan',
    insightEn: 'Supply ready -> execution moves',
    query: 'admin marketplace',
    type: 'service',
    icon: Wrench,
    accentClass:
      'from-sky-400/18 via-cyan-300/12 to-transparent dark:from-sky-400/18 dark:via-cyan-400/12 dark:to-transparent',
  },
];

const FALLBACK_CITIES = ['Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Yogyakarta', 'Makassar'];

const PAGE_SIZE = 24;
const SEARCH_LAYOUT_STORAGE_KEY = 'lajukan.search.layout';

function detectLocale(pathname: string): 'id' | 'en' {
  return pathname.startsWith('/id') ? 'id' : 'en';
}

function isLayoutMode(value: string | null): value is LayoutMode {
  return value === 'comfortable' || value === 'compact';
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

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
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
  if (/(property|real-estate|real estate|apartment|house|ruko|kios|lapak)/.test(normalized))
    return 'property';
  if (/(tool_rental|tool-rental|rental|rent|sewa|pinjam|meminjam)/.test(normalized))
    return 'tool_rental';
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

  if (
    contentType === 'user' &&
    (asString(meta.profession) || asString(meta.professional_title))
  ) {
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

function groupForType(typeKey: CardType): GroupKey {
  if (typeKey === 'job') return 'demand';
  if (typeKey === 'freelancer') return 'talent';
  if (typeKey === 'property') return 'property';
  if (typeKey === 'tool_rental') return 'rental';
  if (typeKey === 'product' || typeKey === 'service') return 'supply';
  return 'other';
}

function displayTypeLabel(typeKey: CardType, locale: 'id' | 'en'): string {
  if (typeKey === 'product') return locale === 'id' ? 'Supplier' : 'Supplier';
  if (typeKey === 'property') {
    return locale === 'id' ? 'Lokasi Jualan' : 'Selling Spot';
  }
  if (typeKey === 'tool_rental') return locale === 'id' ? 'Sewa Alat' : 'Tool Rental';
  if (typeKey === 'freelancer') {
    return locale === 'id' ? 'Profil Talent' : 'Talent Profile';
  }
  if (typeKey === 'other') return locale === 'id' ? 'Listing' : 'Listing';
  const match = CONTENT_TYPES.find((ct) => ct.id === typeKey);
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

  if (typeKey === 'freelancer') {
    return locale === 'id'
      ? side === 'demand'
        ? 'Cari talent terdaftar'
        : 'Profil talent terdaftar'
      : side === 'demand'
        ? 'Looking for registered talent'
        : 'Registered talent profile';
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
  const chatUserId = resolveOwnerUserIdFromContent(item);
  const updatedAt = Date.parse(String(item.updated_at || item.created_at || '')) || 0;
  const priceCents = typeof item.price_cents === 'number' ? item.price_cents : null;
  const group = groupForType(typeKey);
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
    group,
    image,
    images: gallery,
    href: detailHref,
    profileHref,
    chatUserId,
    updatedAt,
    priceCents,
    entityKind,
    verified,
    hasMedia: gallery.length > 0,
  };
}

function MvpFocusCard({
  lane,
  locale,
  onSearch,
}: {
  lane: MvpFocusLane;
  locale: 'id' | 'en';
  onSearch: (lane: MvpFocusLane) => void;
}) {
  const isId = locale === 'id';

  return (
    <button
      type="button"
      onClick={() => onSearch(lane)}
      className="group relative overflow-hidden rounded-[20px] bg-[color:var(--app-surface-strong)] p-3 text-left shadow-[var(--app-shadow-soft)] transition hover:bg-[color:var(--app-surface)] sm:rounded-[24px] sm:border sm:border-[color:var(--app-border)]/70 sm:bg-white/92 sm:p-4 sm:shadow-[0_18px_40px_-34px_rgba(15,23,42,0.24)] sm:hover:border-sky-300/80 sm:hover:shadow-[0_24px_48px_-34px_rgba(14,165,233,0.28)] dark:sm:border-[color:var(--app-border-strong)] dark:sm:bg-slate-950/80"
    >
      <div
        aria-hidden="true"
        className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', lane.accentClass)}
      />
      <div className="relative">
        <div className="flex items-start gap-2.5 sm:gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] bg-white/90 text-slate-900 ring-1 ring-black/5 dark:bg-slate-900/90 dark:text-slate-100 dark:ring-white/10 sm:h-11 sm:w-11 sm:rounded-2xl">
            <lane.icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[color:var(--app-text)] sm:text-sm">
              {isId ? lane.titleId : lane.titleEn}
            </p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 ui-text-soft sm:text-[12px] sm:leading-5">
              {isId ? lane.bodyId : lane.bodyEn}
            </p>
          </div>
        </div>

        <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-sky-700 transition group-hover:translate-x-0.5 dark:text-sky-200 sm:mt-4 sm:text-[11px]">
          {isId ? 'Coba jalur ini' : 'Try this path'}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

function SearchIntentLaneCard({
  lane,
  locale,
  active,
  compact = false,
  onSelect,
}: {
  lane: SearchIntentLane;
  locale: 'id' | 'en';
  active: boolean;
  compact?: boolean;
  onSelect: (lane: SearchIntentLane) => void;
}) {
  const isId = locale === 'id';

  return (
    <button
      type="button"
      onClick={() => onSelect(lane)}
      className={cn(
        'group relative overflow-hidden rounded-[20px] text-left transition sm:rounded-[24px] sm:border',
        compact ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4',
        active
          ? lane.activeClass
          : 'bg-[color:var(--app-surface-strong)] shadow-[var(--app-shadow-soft)] hover:bg-[color:var(--app-surface)] sm:border-[color:var(--app-border)]/70 sm:bg-white/92 sm:shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] sm:hover:border-slate-300 sm:hover:shadow-[0_22px_40px_-30px_rgba(15,23,42,0.24)] dark:sm:border-[color:var(--app-border-strong)] dark:sm:bg-slate-950/78 dark:sm:hover:border-slate-600',
      )}
    >
      <div
        aria-hidden="true"
        className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', lane.accentClass)}
      />
      <div className="relative">
        <div className={cn('flex items-start', compact ? 'gap-2.5' : 'gap-3')}>
          <span
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-2xl',
              compact ? 'h-10 w-10' : 'h-11 w-11',
              active
                ? 'bg-white/88 text-slate-900 ring-1 ring-black/5 dark:bg-slate-900 dark:text-slate-100 dark:ring-white/10'
                : lane.iconClass,
            )}
          >
            <lane.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className={cn('font-bold text-[color:var(--app-text)]', compact ? 'text-[13px]' : 'text-sm')}>
              {isId ? lane.labelId : lane.labelEn}
            </p>
            <p
              className={cn(
                'mt-1 text-[color:var(--app-text-soft)]',
                compact ? 'line-clamp-2 text-[11px] leading-4' : 'text-[12px] leading-5',
              )}
            >
              {isId ? lane.bodyId : lane.bodyEn}
            </p>
          </div>
        </div>

        {!compact ? (
          <p className="mt-3 text-[11px] font-medium text-[color:var(--app-text-soft)]">
            {isId ? lane.hintId : lane.hintEn}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function SearchStarterCard({
  starter,
  locale,
  active,
  onSelect,
}: {
  starter: SearchStarter;
  locale: 'id' | 'en';
  active: boolean;
  onSelect: (starter: SearchStarter) => void;
}) {
  const isId = locale === 'id';

  return (
    <button
      type="button"
      onClick={() => onSelect(starter)}
      className={cn(
        'group relative overflow-hidden rounded-[20px] p-3 text-left transition sm:rounded-[22px] sm:border sm:p-4',
        active
          ? 'border-sky-300 bg-sky-50 shadow-[0_18px_34px_-28px_rgba(14,165,233,0.34)] dark:border-sky-700 dark:bg-sky-950/40'
          : 'bg-[color:var(--app-surface-strong)] shadow-[var(--app-shadow-soft)] hover:bg-[color:var(--app-surface)] sm:border-[color:var(--app-border)]/70 sm:bg-white/92 sm:shadow-[0_18px_34px_-30px_rgba(15,23,42,0.2)] sm:hover:border-sky-200 sm:hover:shadow-[0_22px_38px_-30px_rgba(14,165,233,0.22)] dark:sm:border-[color:var(--app-border-strong)] dark:sm:bg-slate-950/78 dark:sm:hover:border-sky-800',
      )}
    >
      <div
        aria-hidden="true"
        className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', starter.accentClass)}
      />
      <div className="relative">
        <div className="flex items-start gap-2.5 sm:gap-3">
          <span
            className={cn(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] sm:h-11 sm:w-11 sm:rounded-2xl',
              starter.iconClass,
            )}
          >
            <starter.icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[color:var(--app-text)] sm:text-sm">
              {isId ? starter.labelId : starter.labelEn}
            </p>
            <p className="mt-1 text-[11px] font-medium text-[color:var(--app-text-soft)]">
              {isId ? starter.bodyId : starter.bodyEn}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

function SearchStarterRailCard({
  starter,
  locale,
  active,
  onSelect,
}: {
  starter: SearchStarter;
  locale: 'id' | 'en';
  active: boolean;
  onSelect: (starter: SearchStarter) => void;
}) {
  const isId = locale === 'id';
  const sideBadge =
    starter.side === 'demand'
      ? {
          label: isId ? 'Kebutuhan' : 'Needs',
          className:
            'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200',
        }
      : {
          label: isId ? 'Penawaran' : 'Offers',
          className:
            'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
        };

  return (
    <button
      type="button"
      onClick={() => onSelect(starter)}
      className={cn(
        'group relative min-w-[220px] overflow-hidden rounded-[20px] border p-3 text-left transition sm:min-w-[240px]',
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_18px_34px_-28px_rgba(15,23,42,0.38)] dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
          : 'border-[color:var(--app-border)]/70 bg-white/94 hover:border-slate-300 hover:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.16)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/82 dark:hover:border-slate-600',
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br',
          active
            ? 'from-white/10 via-white/5 to-transparent dark:from-black/10 dark:via-black/5 dark:to-transparent'
            : starter.accentClass,
        )}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
              active ? 'bg-white/12 text-white dark:bg-slate-900 dark:text-slate-100' : starter.iconClass,
            )}
          >
            <starter.icon className="h-4 w-4" />
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em]',
              active
                ? 'border-white/20 bg-white/10 text-white/84 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-700'
                : sideBadge.className,
            )}
          >
            {sideBadge.label}
          </span>
        </div>

        <p className="mt-3 text-[12px] font-bold leading-tight">
          {isId ? starter.labelId : starter.labelEn}
        </p>
        <p className={cn('mt-1 text-[11px] leading-4', active ? 'text-white/80 dark:text-slate-700' : 'ui-text-soft')}>
          {isId ? starter.bodyId : starter.bodyEn}
        </p>
      </div>
    </button>
  );
}

function SearchModeGuideCard({
  guide,
  locale,
  active,
  onSelect,
}: {
  guide: SearchModeGuide;
  locale: 'id' | 'en';
  active: boolean;
  onSelect: (guide: SearchModeGuide) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(guide)}
      className={cn(
        'group relative overflow-hidden rounded-[18px] bg-[color:var(--app-surface-strong)] p-2.5 text-left transition hover:bg-[color:var(--app-surface)] sm:rounded-[20px] sm:border sm:bg-transparent sm:p-3',
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_18px_30px_-26px_rgba(15,23,42,0.4)] dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
          : 'sm:border-[color:var(--app-border)]/70 sm:bg-white/94 sm:hover:border-slate-300 dark:sm:border-[color:var(--app-border-strong)] dark:sm:bg-slate-950/78 dark:sm:hover:border-slate-600',
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-100',
          active ? 'from-white/10 via-white/5 to-transparent dark:from-black/10 dark:via-black/5 dark:to-transparent' : guide.accentClass,
        )}
      />
      <div className="relative">
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl',
              active ? 'bg-white/12 text-white dark:bg-slate-900 dark:text-slate-100' : guide.iconClass,
            )}
          >
            <guide.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-bold leading-tight">
              {locale === 'id' ? guide.labelId : guide.labelEn}
            </p>
            <p
              className={cn(
                'mt-1 text-[11px] leading-4',
                active ? 'text-white/82 dark:text-slate-700' : 'ui-text-soft',
              )}
            >
              {locale === 'id' ? guide.bodyId : guide.bodyEn}
            </p>
          </div>
        </div>
      </div>
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

  const toneClass =
    value === 'supply'
      ? active
        ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200'
        : `${FILTER_IDLE_SURFACE} hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:hover:border-sky-800 dark:hover:bg-sky-950/40 dark:hover:text-sky-200`
      : value === 'demand'
        ? active
          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200'
          : `${FILTER_IDLE_SURFACE} hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-200`
        : active
          ? FILTER_NEUTRAL_ACTIVE
          : `${FILTER_IDLE_SURFACE} hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-100`;
  const Icon = iconMap[value];

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        'flex min-h-[54px] items-center justify-between gap-3 rounded-[16px] border px-3 py-2 text-left transition sm:min-h-[62px] sm:rounded-[18px]',
        toneClass,
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[18px] sm:h-9 sm:w-9 sm:rounded-2xl',
            active
              ? value === 'all'
                ? 'bg-[color:var(--app-surface-strong)] text-current ring-1 ring-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] dark:bg-[color:var(--app-surface-strong)]'
                : 'bg-white/70 text-current ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/10'
              : 'bg-black/5 text-current dark:bg-white/10',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-bold leading-tight sm:text-[12px]">{label}</span>
          <span className={cn('block text-[10px] leading-4 sm:text-[11px]', active && value === 'all' ? 'text-slate-500 dark:text-slate-300' : 'opacity-80')}>
            {hint}
          </span>
        </span>
      </span>
      <span
        className={cn(
          'inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-[9px] font-bold sm:h-6 sm:min-w-[24px] sm:text-[10px]',
          active
            ? value === 'all'
              ? 'bg-[color:var(--app-surface-strong)] text-current dark:bg-[color:var(--app-surface-strong)]'
              : 'bg-white/70 text-current dark:bg-slate-900'
            : 'bg-black/5 text-current dark:bg-white/10',
        )}
      >
        {count}
      </span>
    </button>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = detectLocale(pathname);

  const initialQuery = (searchParams.get('q') || '').trim();
  const initialLocation = (searchParams.get('location') || '').trim();
  const initialType = normalizeType(searchParams.get('type'));
  const initialSort = normalizeSort(searchParams.get('sort'));
  const initialSideFilter = normalizeSideFilter(searchParams.get('side'));

  const [queryInput, setQueryInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [locationInput, setLocationInput] = useState(initialLocation);
  const [location, setLocation] = useState(initialLocation);
  const [type, setType] = useState<TypeKey>(initialType);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [sideFilter, setSideFilter] = useState<SideFilter>(initialSideFilter);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [profileOnly, setProfileOnly] = useState(false);
  const [mediaOnly, setMediaOnly] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('compact');
  const [resultsView, setResultsView] = useState<SearchResultsView>(
    initialType === 'umkm' ? 'umkm' : 'results',
  );
  const [showAll, setShowAll] = useState(
    !initialQuery &&
      !initialLocation &&
      initialType === 'all' &&
      initialSort === 'relevance' &&
      initialSideFilter === 'all',
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [items, setItems] = useState<SearchCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const lastUrlRef = useRef<string>('');
  const resultsAbortRef = useRef<AbortController | null>(null);
  const resultsRequestRef = useRef(0);
  const loadMoreLockRef = useRef(false);

  const [umkmStores, setUmkmStores] = useState<UmkmPreviewStore[]>([]);
  const [umkmLoading, setUmkmLoading] = useState(false);
  const [umkmError, setUmkmError] = useState<string | null>(null);

  const debouncedQueryInput = useDebouncedValue(queryInput, 320);
  const debouncedLocationInput = useDebouncedValue(locationInput, 320);
  const debouncedQuery = useDebouncedValue(query, 280);
  const debouncedLocation = useDebouncedValue(location, 280);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(SEARCH_LAYOUT_STORAGE_KEY);
    if (isLayoutMode(saved)) {
      setLayoutMode(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SEARCH_LAYOUT_STORAGE_KEY, layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    if (type === 'umkm') {
      setResultsView('umkm');
      return;
    }
    if (type !== 'all') {
      setResultsView('results');
    }
  }, [type]);

  useEffect(() => {
    setQueryInput(initialQuery);
    setQuery(initialQuery);
    setLocationInput(initialLocation);
    setLocation(initialLocation);
    setType(initialType);
    setSort(initialSort);
    setSideFilter(initialSideFilter);
    setShowAll(
      !initialQuery &&
        !initialLocation &&
        initialType === 'all' &&
        initialSort === 'relevance' &&
        initialSideFilter === 'all',
    );
  }, [initialLocation, initialQuery, initialSideFilter, initialSort, initialType]);

  useEffect(() => {
    const nextQuery = debouncedQueryInput.trim();
    if (nextQuery !== query) setQuery(nextQuery);
  }, [debouncedQueryInput, query]);

  useEffect(() => {
    const nextLocation = debouncedLocationInput.trim();
    if (nextLocation !== location) setLocation(nextLocation);
  }, [debouncedLocationInput, location]);

  const applyFilters = useCallback(() => {
    const nextQuery = queryInput.trim();
    const nextLocation = locationInput.trim();
    setQuery(nextQuery);
    setLocation(nextLocation);

    if (
      !nextQuery &&
      !nextLocation &&
      type === 'all' &&
      sort === 'relevance' &&
      sideFilter === 'all' &&
      !verifiedOnly &&
      !profileOnly &&
      !mediaOnly
    ) {
      setShowAll(true);
    }
  }, [
    locationInput,
    mediaOnly,
    profileOnly,
    queryInput,
    sideFilter,
    sort,
    type,
    verifiedOnly,
  ]);

  const resetAllFilters = useCallback(() => {
    setQueryInput('');
    setQuery('');
    setLocationInput('');
    setLocation('');
    setType('all');
    setSort('relevance');
    setSideFilter('all');
    setVerifiedOnly(false);
    setProfileOnly(false);
    setMediaOnly(false);
    setResultsView('results');
    setShowAll(true);
    setFiltersOpen(false);
  }, []);

  const applyFiltersAndClose = useCallback(() => {
    applyFilters();
    setFiltersOpen(false);
  }, [applyFilters]);

  const applyMvpFocusLane = useCallback((lane: MvpFocusLane) => {
    setQueryInput(lane.query);
    setQuery(lane.query);
    setType(lane.type);
    setSort('relevance');
    setSideFilter('all');
    setShowAll(false);
    setFiltersOpen(false);
  }, []);

  const applyStarterSelection = useCallback((starter: SearchStarter) => {
    setQueryInput(starter.query);
    setQuery(starter.query);
    setType(starter.type);
    setSideFilter(starter.side);
    setResultsView('results');
    setShowAll(false);
    setFiltersOpen(false);
  }, []);

  const applyTypeSelection = useCallback(
    (nextType: TypeKey) => {
      setType(nextType);
      setResultsView(nextType === 'umkm' ? 'umkm' : 'results');
      setShowAll(
        nextType === 'all' &&
          !query &&
          !location &&
          sort === 'relevance' &&
          sideFilter === 'all' &&
          !verifiedOnly &&
          !profileOnly &&
          !mediaOnly,
      );
    },
    [location, mediaOnly, profileOnly, query, sideFilter, sort, verifiedOnly],
  );

  const applySideScope = useCallback((nextSide: SideFilter) => {
    setSideFilter(nextSide);
    if (nextSide !== 'all') setResultsView('results');
    setShowAll(false);
  }, []);

  const hasActiveFilters = Boolean(
    query ||
      location ||
      type !== 'all' ||
      sort !== 'relevance' ||
      sideFilter !== 'all' ||
      verifiedOnly ||
      profileOnly ||
      mediaOnly,
  );

  const shouldShowResults = hasActiveFilters || showAll;
  const canReset = hasActiveFilters || showAll;
  const isDiscoverMode = !shouldShowResults;

  const activeFilterCount =
    Number(Boolean(query)) +
    Number(Boolean(location)) +
    Number(type !== 'all') +
    Number(sort !== 'relevance') +
    Number(sideFilter !== 'all') +
    Number(verifiedOnly) +
    Number(profileOnly) +
    Number(mediaOnly);
  const secondaryActiveFilterCount =
    Number(sort !== 'relevance') +
    Number(verifiedOnly) +
    Number(profileOnly) +
    Number(mediaOnly);

  const popularCities = useMemo(() => {
    const citySet = new Set(
      umkmStores
        .map((store) => store.city)
        .filter((city) => typeof city === 'string' && city.trim().length > 0),
    );
    const fromStore = Array.from(citySet).slice(0, 6);
    return fromStore.length > 0 ? fromStore : FALLBACK_CITIES;
  }, [umkmStores]);

  const discoverIntent = sideFilter === 'demand' ? 'demand' : 'supply';
  const discoverStarters = SEARCH_STARTERS.filter((starter) => starter.side === discoverIntent);
  const resultsStarters =
    sideFilter === 'all'
      ? SEARCH_STARTERS
      : SEARCH_STARTERS.filter((starter) => starter.side === sideFilter);
  const primaryModeGuides = PRIMARY_TYPE_OPTIONS.map((option) =>
    SEARCH_MODE_GUIDES.find((guide) => guide.value === option.value),
  ).filter((guide): guide is SearchModeGuide => Boolean(guide));

  useEffect(() => {
    if (
      query ||
      location ||
      type !== 'all' ||
      sort !== 'relevance' ||
      sideFilter !== 'all' ||
      verifiedOnly ||
      profileOnly ||
      mediaOnly
    ) {
      setShowAll(false);
    }
  }, [location, mediaOnly, profileOnly, query, sideFilter, sort, type, verifiedOnly]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (location) params.set('location', location);
    if (type !== 'all') params.set('type', type);
    if (sort !== 'relevance') params.set('sort', sort);
    if (sideFilter !== 'all') params.set('side', sideFilter);

    const search = params.toString();
    const target = search ? `${pathname}?${search}` : pathname;

    if (lastUrlRef.current !== target) {
      lastUrlRef.current = target;
      router.replace(target, { scroll: false });
    }
  }, [location, pathname, query, router, sideFilter, sort, type]);

  const fetchResults = useCallback(
    async ({ mode, nextOffset }: { mode: 'replace' | 'append'; nextOffset: number }) => {
      const requestId = ++resultsRequestRef.current;
      if (resultsAbortRef.current) resultsAbortRef.current.abort();

      const controller = new AbortController();
      resultsAbortRef.current = controller;

      if (mode === 'append') {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setLoadingMore(false);
        setError(null);
      }

      try {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (location) params.set('location', location);
        if (type !== 'all') params.set('type', type);
        params.set('include_owner', '1');
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(nextOffset));

        const response = await fetch(`/api/content?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            (payload as { error?: string }).error ||
              (locale === 'id' ? 'Gagal memuat hasil' : 'Failed to load results'),
          );
        }

        const results = extractContentItems(payload)
          .map((item) => mapContentItem(item, locale))
          .filter((item): item is SearchCard => Boolean(item));

        if (requestId !== resultsRequestRef.current) return;

        setItems((prev) => (mode === 'append' ? [...prev, ...results] : results));
        setOffset(nextOffset + results.length);
        setHasMore(results.length === PAGE_SIZE);
      } catch (err) {
        if (controller.signal.aborted) return;
        if ((err as { name?: string }).name === 'AbortError') return;
        if (requestId !== resultsRequestRef.current) return;

        setError(err instanceof Error ? err.message : 'Failed to load results');
        if (mode === 'replace') setItems([]);
      } finally {
        if (requestId !== resultsRequestRef.current) return;

        if (mode === 'append') {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [locale, location, query, type],
  );

  const handleLoadMore = useCallback(
    (nextOffset: number) => {
      if (loadMoreLockRef.current) return;
      loadMoreLockRef.current = true;
      void fetchResults({ mode: 'append', nextOffset }).finally(() => {
        loadMoreLockRef.current = false;
      });
    },
    [fetchResults],
  );

  useEffect(() => {
    if (type === 'umkm' || !shouldShowResults) {
      loadMoreLockRef.current = false;
      setItems([]);
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      setOffset(0);
      setHasMore(false);
      return;
    }

    setOffset(0);
    setHasMore(true);
    loadMoreLockRef.current = false;
    void fetchResults({ mode: 'replace', nextOffset: 0 });
  }, [fetchResults, refreshKey, shouldShowResults, type]);

  useEffect(() => {
    if (type !== 'all' && type !== 'umkm') {
      setUmkmStores([]);
      setUmkmLoading(false);
      setUmkmError(null);
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      setUmkmLoading(true);
      setUmkmError(null);

      try {
        const params = new URLSearchParams();
        if (debouncedQuery) params.set('q', debouncedQuery);
        if (debouncedLocation) params.set('city', debouncedLocation);
        params.set('limit', '10');

        const response = await fetch(`/api/super-app/umkm/stores?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            (payload as { error?: string }).error ||
              (locale === 'id' ? 'Gagal memuat usaha' : 'Failed to load businesses'),
          );
        }

        const results = ((payload as { data?: { items?: UmkmPreviewStore[] } }).data?.items ||
          []) as UmkmPreviewStore[];
        setUmkmStores(results);
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        setUmkmError(err instanceof Error ? err.message : 'Failed to load businesses');
        setUmkmStores([]);
      } finally {
        setUmkmLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [debouncedLocation, debouncedQuery, locale, type]);

  const sortedItems = useMemo(() => {
    const next = [...items];
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
  }, [items, sort]);

  const availableMix = useMemo(() => {
    return sortedItems.reduce(
      (acc, item) => {
        if (item.side === 'demand') acc.demand += 1;
        else acc.supply += 1;
        return acc;
      },
      { demand: 0, supply: 0 },
    );
  }, [sortedItems]);

  const visibleItems = useMemo(() => {
    return sortedItems.filter((item) => {
      if (sideFilter !== 'all' && item.side !== sideFilter) return false;
      if (verifiedOnly && !item.verified) return false;
      if (profileOnly && item.entityKind !== 'person') return false;
      if (mediaOnly && !item.hasMedia) return false;
      return true;
    });
  }, [mediaOnly, profileOnly, sideFilter, sortedItems, verifiedOnly]);

  const resultMix = useMemo(() => {
    return visibleItems.reduce(
      (acc, item) => {
        if (item.side === 'demand') acc.demand += 1;
        else acc.supply += 1;
        return acc;
      },
      { demand: 0, supply: 0 },
    );
  }, [visibleItems]);

  const verifiedCount = useMemo(
    () => visibleItems.filter((item) => item.verified).length,
    [visibleItems],
  );
  const profileCount = useMemo(
    () => visibleItems.filter((item) => item.entityKind === 'person').length,
    [visibleItems],
  );
  const mediaCount = useMemo(
    () => visibleItems.filter((item) => item.hasMedia).length,
    [visibleItems],
  );

  const canLoadMore =
    type !== 'umkm' && shouldShowResults && hasMore && !loading && !loadingMore;

  useEffect(() => {
    if (!canLoadMore) return;
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          handleLoadMore(offset);
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [canLoadMore, handleLoadMore, offset]);

  useEffect(() => {
    return () => {
      resultsAbortRef.current?.abort();
    };
  }, []);

  const text = {
    title: locale === 'id' ? 'Lajukan UMKM' : 'Lajukan',
    subtitle:
      locale === 'id'
        ? 'Supplier, jasa, dan peluang usaha.'
        : 'Suppliers, services, and business opportunities.',
    starterSection: locale === 'id' ? 'Langsung pilih' : 'Quick start',
    starterSectionDesc:
      locale === 'id'
        ? 'Sekali tap, langsung jalan.'
        : 'One tap and go.',
    modeSection: locale === 'id' ? 'Mode' : 'Mode',
    modeSectionDesc:
      locale === 'id'
        ? 'Pilih jalur paling dekat.'
        : 'Pick the closest path first.',
    otherSearches: locale === 'id' ? 'Contoh lain' : 'More examples',
    discoveryTitle:
      locale === 'id'
        ? 'Mulai dari sini'
        : 'Start from needs that strengthen local businesses',
    mvpFocusTitle:
      locale === 'id'
        ? 'Jalur cepat'
        : 'Fastest lanes',
    mvpFocusDesc:
      locale === 'id'
        ? 'Pilih salah satu.'
        : 'Pick one.',
    discoveryExamples: locale === 'id' ? 'Yang sering dicari' : 'Popular searches',
    discoveryCities: locale === 'id' ? 'Kota populer' : 'Popular cities',
    discoveryTip:
      locale === 'id'
        ? 'Kalau hasil kebanyakan, tambahkan kota.'
        : 'If the results feel crowded, add a city.',
    showAll: locale === 'id' ? 'Lihat semua' : 'Show all',
    queryPlaceholder:
      sideFilter === 'demand'
        ? locale === 'id'
          ? 'Contoh: cari buyer kopi di Surabaya'
          : 'Example: coffee buyer in Surabaya'
        : locale === 'id'
          ? 'Contoh: supplier ayam, jasa desain, atau booth bazaar'
          : 'Example: chicken supplier in Bandung',
    locationPlaceholder: locale === 'id' ? 'Kota atau area' : 'City or area',
    type: locale === 'id' ? 'Jenis' : 'Type',
    sort: locale === 'id' ? 'Urutkan' : 'Sort',
    apply: locale === 'id' ? 'Cari' : 'Search',
    results: locale === 'id' ? 'hasil' : 'results',
    empty:
      locale === 'id'
        ? 'Tidak ada hasil.'
        : 'No matching results.',
    retry: locale === 'id' ? 'Coba lagi' : 'Retry',
    umkmOnly: locale === 'id' ? 'Mode usaha aktif.' : 'Business mode active.',
    loadMore: locale === 'id' ? 'Muat lagi' : 'Load more',
    endOfResults:
      locale === 'id' ? 'Sudah semua.' : 'All results shown.',
    filters: locale === 'id' ? 'Filter' : 'Filters',
    updated: locale === 'id' ? 'Update' : 'Updated',
    reset: locale === 'id' ? 'Reset' : 'Reset',
    allCategories: locale === 'id' ? 'Semua kategori' : 'All categories',
    loadingResults: locale === 'id' ? 'Memuat hasil...' : 'Loading results...',
    filtersShort: locale === 'id' ? 'Filter' : 'Filters',
    activeFilters: locale === 'id' ? 'Aktif' : 'Active',
    open: locale === 'id' ? 'Buka' : 'Open',
    quickPickHint:
      locale === 'id'
        ? 'Pilih yang paling dekat.'
        : 'Pick the closest one.',
    intentSection: locale === 'id' ? 'Cari apa?' : 'What are you finding?',
    intentSectionDesc:
      locale === 'id'
        ? 'Cari penawaran atau cari buyer.'
        : 'Find offers or find buyers.',
    suggestionSection: locale === 'id' ? 'Contoh cepat' : 'Quick suggestions',
    suggestionSectionDesc:
      locale === 'id'
        ? 'Tap sekali, lanjut.'
        : 'Tap once and continue.',
    quickToolsLabel: locale === 'id' ? 'Mode' : 'Mode',
    resultScope: locale === 'id' ? 'Sisi' : 'Scope',
    resultScopeDesc:
      locale === 'id'
        ? 'Lihat penyedia atau pencari.'
        : 'See providers or seekers.',
    quickOverview: locale === 'id' ? 'Lajukan cepat' : 'Lajukan fast',
    side: locale === 'id' ? 'Sisi' : 'Side',
    sideAll: locale === 'id' ? 'Semua' : 'All',
    sideDemand: locale === 'id' ? 'Pencari' : 'Seekers',
    sideSupply: locale === 'id' ? 'Penyedia' : 'Providers',
    sideAllHint: locale === 'id' ? 'Lihat semua' : 'See all',
    sideSupplyHint: locale === 'id' ? 'Siap dihubungi' : 'Ready to contact',
    sideDemandHint: locale === 'id' ? 'Sedang cari solusi' : 'Looking for solutions',
    quickFilters: locale === 'id' ? 'Filter cepat' : 'Quick filters',
    verifiedOnly: locale === 'id' ? 'Terverifikasi' : 'Verified',
    profileOnly: locale === 'id' ? 'Profil publik' : 'Public profiles',
    mediaOnly: locale === 'id' ? 'Ada foto' : 'Has media',
    layout: locale === 'id' ? 'Tampilan' : 'Layout',
    layoutComfortable: locale === 'id' ? 'Kartu' : 'Cards',
    layoutCompact: locale === 'id' ? 'Padat' : 'Compact',
    resultsTab: locale === 'id' ? 'Kartu' : 'Cards',
    umkmTab: locale === 'id' ? 'Peta' : 'Map',
    verifiedCount: locale === 'id' ? 'Terverifikasi' : 'Verified',
    profileCount: locale === 'id' ? 'Profil publik' : 'Public profiles',
    mediaCount: locale === 'id' ? 'Ada foto' : 'Has media',
    popularSearches: locale === 'id' ? 'Pencarian populer' : 'Popular searches',
    typeFocus: locale === 'id' ? 'Fokus kebutuhan' : 'Need focus',
    cityCoverage: locale === 'id' ? 'Kota siap cari' : 'Cities ready',
    filterModalTitle: locale === 'id' ? 'Filter pencarian' : 'Search filters',
    filterModalDesc:
      locale === 'id'
        ? 'Pilih seperlunya. Jangan ribet.'
        : 'Pick only what you need.',
    applyFilters: locale === 'id' ? 'Pakai filter' : 'Apply filters',
    filterLocation: locale === 'id' ? 'Lokasi pencarian' : 'Search location',
    filterPopularCities: locale === 'id' ? 'Kota populer' : 'Popular cities',
    filterNeedType: locale === 'id' ? 'Kategori' : 'Category',
    filterSort: locale === 'id' ? 'Urutan hasil' : 'Result sorting',
    filterAdvanced: locale === 'id' ? 'Filter hasil' : 'Result filters',
    healthyBadge: locale === 'id' ? 'Cari di Lajukan' : 'Search on Lajukan',
    healthyEntryHint:
      locale === 'id'
        ? 'Tulis singkat. Lajukan tampilkan yang siap dihubungi.'
        : 'Write it simply. Lajukan shows the results that are ready to contact.',
    healthyResultsHint:
      locale === 'id'
        ? 'Lajukan utamakan hasil yang jelas, relevan, dan siap jalan.'
        : 'Lajukan prioritizes results that are clear, relevant, and ready to move.',
  };

  const healthyLinks = [
    {
      href: '/search?type=product&side=supply',
      label: locale === 'id' ? 'Supplier' : 'Suppliers',
      icon: Package,
    },
    {
      href: '/search?type=property&side=supply',
      label: locale === 'id' ? 'Lokasi' : 'Locations',
      icon: MapPin,
    },
    {
      href: '/search?type=service&side=supply',
      label: locale === 'id' ? 'Jasa' : 'Services',
      icon: Wrench,
    },
    {
      href: '/search?type=tool_rental&side=supply',
      label: locale === 'id' ? 'Sewa' : 'Rentals',
      icon: ShieldCheck,
    },
    {
      href: '/search?type=freelancer&side=supply',
      label: locale === 'id' ? 'Talent' : 'Talent',
      icon: UserRound,
    },
    {
      href: '/search?type=job&side=demand',
      label: locale === 'id' ? 'Loker' : 'Jobs',
      icon: Briefcase,
    },
    {
      href: '/search?type=umkm&side=supply',
      label: locale === 'id' ? 'Usaha' : 'Business',
      icon: Store,
    },
  ] as const;

  const briefCreateHref = resolveUmkmCreateHrefForType(locale, type);
  const briefCreateLabel =
    locale === 'id'
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

  const sideOptions: Array<{ value: SideFilter; label: string; hint: string; count: number }> = [
    { value: 'all', label: text.sideAll, hint: text.sideAllHint, count: sortedItems.length },
    {
      value: 'supply',
      label: text.sideSupply,
      hint: text.sideSupplyHint,
      count: availableMix.supply,
    },
    {
      value: 'demand',
      label: text.sideDemand,
      hint: text.sideDemandHint,
      count: availableMix.demand,
    },
  ];

  const layoutOptions: Array<{ value: LayoutMode; label: string }> = [
    { value: 'comfortable', label: text.layoutComfortable },
    { value: 'compact', label: text.layoutCompact },
  ];

  const activeTypeLabel =
    TYPE_OPTIONS.find((option) => option.value === type)?.[
      locale === 'id' ? 'labelId' : 'labelEn'
    ] ?? text.allCategories;

  const activeSortLabel =
    SORT_OPTIONS.find((option) => option.value === sort)?.[
      locale === 'id' ? 'labelId' : 'labelEn'
    ] ?? text.sort;
  const topResult = visibleItems[0];

  const isCompactLayout = layoutMode === 'compact';
  const compactCardBaselineClass = DISCOVERY_COMPACT_CARD_BASELINE_CLASS;

  const resultsGridClass = isCompactLayout
    ? cn(
        'grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(220px,1fr))] items-stretch gap-2.5 sm:gap-3',
        compactCardBaselineClass,
      )
    : cn(
        'grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(240px,1fr))] items-stretch gap-3 sm:gap-4',
        compactCardBaselineClass,
      );

  const cardModeClass = cn('h-full min-w-0', compactCardBaselineClass);
  const loadingSkeletonClass = isCompactLayout
    ? 'h-[244px] sm:h-[252px] lg:h-[256px]'
    : 'h-[260px] sm:h-[272px] lg:h-[284px]';
  const canToggleUmkmView = (type === 'all' || type === 'umkm') && sideFilter === 'all';
  const shouldShowUmkmPreview = shouldShowResults && canToggleUmkmView && resultsView === 'umkm';
  const shouldShowResultCards = shouldShowResults && type !== 'umkm' && resultsView === 'results';


  return (
    <main className="page-shell overflow-x-hidden py-0 pb-10 sm:pb-0 sm:py-3">
      <div className="ui-text flex w-full flex-col gap-3 sm:mx-auto sm:max-w-[var(--app-max-width)] sm:gap-3.5">
        <div
          className={cn(
            'ui-page-section ui-home-section-shell px-2 sm:px-3',
            shouldShowResults && 'sticky top-0 z-20 sm:top-2',
          )}
        >
          <div className="ui-home-section-content">
            <section className="overflow-hidden rounded-[20px] border border-[color:color-mix(in_srgb,var(--app-border)_92%,white_8%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_92%,var(--app-surface-muted)))] p-2 shadow-[0_20px_40px_-36px_rgba(15,23,42,0.14)] ring-1 ring-white/60 dark:border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] dark:ring-white/5 sm:rounded-[24px] sm:p-2.5">
              <div className="rounded-[18px] bg-transparent p-0 shadow-none sm:rounded-[20px]">
              <div className="flex flex-col gap-2">
                <h1 className="text-[1.1rem] font-black text-[color:var(--app-text)] sm:text-[1.3rem]">
                  {locale === 'id'
                    ? 'Cari kebutuhan usaha kamu'
                    : 'Find your business needs'}
                </h1>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    applyFilters();
                  }}
                  className="flex flex-col gap-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_96%,white_4%),color-mix(in_srgb,var(--app-surface)_90%,transparent))] px-3 py-1.5 transition focus-within:border-[color:var(--app-accent-border)] focus-within:bg-[color:var(--app-surface-strong)] dark:border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] dark:focus-within:bg-[color:var(--app-surface-strong)]">
                      <Search className="h-4 w-4 text-[color:var(--app-accent)]" />
                      <input
                        value={queryInput}
                        onChange={(event) => setQueryInput(event.target.value)}
                        placeholder={text.queryPlaceholder}
                        className="min-h-[28px] w-full min-w-0 appearance-none border-0 bg-transparent text-[11px] font-medium text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0 sm:min-h-[32px] sm:text-[13px] dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                      {queryInput ? (
                        <button
                          type="button"
                          onClick={() => setQueryInput('')}
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 sm:h-7 sm:w-7 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          aria-label={text.reset}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </label>
                    <button
                      type="submit"
                      className="ui-pressable inline-flex h-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-[11px] font-semibold text-white shadow-[0_16px_28px_-22px_color-mix(in_srgb,var(--app-accent)_52%,transparent)] transition hover:brightness-105"
                    >
                      {text.apply}
                    </button>
                  </div>
                </form>
                <div className="mt-1 flex w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-full border border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_90%,transparent))] p-1 no-scrollbar dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface)_94%,rgba(15,23,42,0.98)),color-mix(in_srgb,var(--app-surface-muted)_86%,rgba(2,6,23,0.98)))]">
                  {DISCOVERY_TYPE_OPTIONS.map((option) => {
                    const active = type === option.value;
                    const Icon = getTypeFilterVisual(option.value).icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => applyTypeSelection(option.value)}
                        className={cn(
                          'ui-pressable inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition sm:min-h-[30px] sm:text-[10px]',
                          active
                            ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent-strong)] shadow-[0_10px_20px_-18px_rgba(15,23,42,0.18)] dark:bg-[color:var(--app-surface-strong)] dark:text-sky-200'
                            : 'bg-transparent text-slate-600 hover:bg-[color:var(--app-surface-strong)] hover:text-[color:var(--app-accent)] dark:text-slate-300 dark:hover:bg-[color:var(--app-surface-strong)] dark:hover:text-sky-200',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>
                          {locale === 'id' ? option.labelId : option.labelEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {sideOptions.map((option) => {
                    const active = sideFilter === option.value;
                    const visual = getSideFilterVisual(option.value);
                    const Icon = visual.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => applySideScope(option.value)}
                        className={cn(
                          'ui-pressable inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition',
                          active ? visual.active : visual.idle,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(true)}
                    className="ui-pressable inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-[color:color-mix(in_srgb,var(--app-border)_92%,white_8%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_95%,transparent))] px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_97%,rgba(15,23,42,0.98)),color-mix(in_srgb,var(--app-surface)_94%,rgba(2,6,23,0.98)))] dark:text-slate-200 dark:hover:border-[color:var(--app-accent-border)] dark:hover:text-sky-200"
                  >
                    <Layers3 className="h-3.5 w-3.5" />
                    {activeFilterCount > 0
                      ? `${text.filtersShort} (${activeFilterCount})`
                      : locale === 'id'
                        ? 'Filter lain'
                        : 'More filters'}
                  </button>
                  {canReset ? (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="ui-pressable inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_96%,white_4%),color-mix(in_srgb,var(--app-surface)_90%,transparent))] px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-[color:var(--app-surface-strong)] hover:text-[color:var(--app-accent)] dark:text-slate-200 dark:hover:bg-[color:var(--app-surface-strong)] dark:hover:text-sky-200"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      {text.reset}
                    </button>
                  ) : null}
                </div>
                {shouldShowResults && activeFilterCount > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {query ? (
                      <button
                        type="button"
                        onClick={() => {
                          setQueryInput('');
                          setQuery('');
                        }}
                        className="ui-pressable inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_96%,white_4%),color-mix(in_srgb,var(--app-surface)_90%,transparent))] px-2.5 py-1 text-[10px] font-semibold text-slate-700 transition hover:bg-[color:var(--app-surface-strong)] dark:text-slate-200 dark:hover:bg-[color:var(--app-surface-strong)]"
                      >
                        {`"${query}"`} <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {location ? (
                      <button
                        type="button"
                        onClick={() => {
                          setLocationInput('');
                          setLocation('');
                        }}
                        className="ui-pressable inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_96%,white_4%),color-mix(in_srgb,var(--app-surface)_90%,transparent))] px-2.5 py-1 text-[10px] font-semibold text-slate-700 transition hover:bg-[color:var(--app-surface-strong)] dark:text-slate-200 dark:hover:bg-[color:var(--app-surface-strong)]"
                      >
                        {location} <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {type !== 'all' ? (
                      <button
                        type="button"
                        onClick={() => setType('all')}
                        className={cn(
                          'ui-pressable inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition',
                          getTypeFilterVisual(type).active,
                        )}
                      >
                        {(() => {
                          const Icon = getTypeFilterVisual(type).icon;
                          return <Icon className="h-3.5 w-3.5" />;
                        })()}
                        {activeTypeLabel}
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {sideFilter !== 'all' ? (
                      <button
                        type="button"
                        onClick={() => setSideFilter('all')}
                        className={cn(
                          'ui-pressable inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition',
                          getSideFilterVisual(sideFilter).active,
                        )}
                      >
                        {(() => {
                          const Icon = getSideFilterVisual(sideFilter).icon;
                          return <Icon className="h-3.5 w-3.5" />;
                        })()}
                        {sideFilter === 'demand' ? text.sideDemand : text.sideSupply}
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {secondaryActiveFilterCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setFiltersOpen(true)}
                        className="ui-pressable inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_96%,white_4%),color-mix(in_srgb,var(--app-surface)_90%,transparent))] px-2.5 py-1 text-[10px] font-semibold text-slate-700 transition hover:bg-[color:var(--app-surface-strong)] dark:text-slate-200 dark:hover:bg-[color:var(--app-surface-strong)]"
                      >
                        {locale === 'id'
                          ? `${secondaryActiveFilterCount} filter lain`
                          : `${secondaryActiveFilterCount} more filters`}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* {shouldShowResults ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-3 sm:gap-2">
                  {type !== 'all' ? (
                    <span
                      className={cn(
                        'inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold sm:min-h-[36px] sm:px-3 sm:text-[11px]',
                        getTypeFilterVisual(type).active,
                      )}
                    >
                      {(() => {
                        const Icon = getTypeFilterVisual(type).icon;
                        return <Icon className="h-3.5 w-3.5" />;
                      })()}
                      {activeTypeLabel}
                    </span>
                  ) : null}
                  {location ? (
                    <span className="inline-flex min-h-[32px] items-center rounded-full bg-slate-100 px-2.5 text-[10px] font-semibold text-slate-600 sm:min-h-[36px] sm:px-3 sm:text-[11px] dark:bg-slate-900 dark:text-slate-300">
                      {location}
                    </span>
                  ) : null}
                  {sideFilter !== 'all' ? (
                    <span
                      className={cn(
                        'inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold sm:min-h-[36px] sm:px-3 sm:text-[11px]',
                        getSideFilterVisual(sideFilter).active,
                      )}
                    >
                      {(() => {
                        const Icon = getSideFilterVisual(sideFilter).icon;
                        return <Icon className="h-3.5 w-3.5" />;
                      })()}
                      {sideFilter === 'demand' ? text.sideDemand : text.sideSupply}
                    </span>
                  ) : null}
                </div>
              ) : null} */}

              </div>
            </section>
          </div>
          </div>

          {shouldShowResults ? (
            <div className="ui-page-section px-2 sm:px-3">
              {canToggleUmkmView ? (
                <div className="mb-2 flex w-full gap-1 rounded-[16px] border border-[color:color-mix(in_srgb,var(--app-border)_86%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_96%,white_4%),color-mix(in_srgb,var(--app-surface)_90%,transparent))] p-1 dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface)_94%,rgba(15,23,42,0.98)),color-mix(in_srgb,var(--app-surface-muted)_86%,rgba(2,6,23,0.98)))] sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setResultsView('results')}
                    className={cn(
                      'ui-pressable inline-flex min-h-[32px] flex-1 items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold transition sm:flex-none',
                      resultsView === 'results'
                        ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent-strong)] shadow-[0_12px_24px_-20px_rgba(15,23,42,0.18)] dark:bg-[color:var(--app-surface-strong)] dark:text-sky-200'
                        : 'bg-transparent text-slate-600 hover:bg-[color:var(--app-surface-strong)] hover:text-[color:var(--app-accent)] dark:text-slate-300 dark:hover:bg-[color:var(--app-surface-strong)] dark:hover:text-sky-200',
                    )}
                  >
                    {text.resultsTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultsView('umkm')}
                    className={cn(
                      'ui-pressable inline-flex min-h-[32px] flex-1 items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold transition sm:flex-none',
                      resultsView === 'umkm'
                        ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent-strong)] shadow-[0_12px_24px_-20px_rgba(15,23,42,0.18)] dark:bg-[color:var(--app-surface-strong)] dark:text-sky-200'
                        : 'bg-transparent text-slate-600 hover:bg-[color:var(--app-surface-strong)] hover:text-[color:var(--app-accent)] dark:text-slate-300 dark:hover:bg-[color:var(--app-surface-strong)] dark:hover:text-sky-200',
                    )}
                  >
                    {text.umkmTab}
                  </button>
                </div>
              ) : null}

              {shouldShowUmkmPreview ? (
                <div className="mb-2">
                  <SearchUmkmPreview
                    isId={locale === 'id'}
                    stores={umkmStores}
                    loading={umkmLoading}
                    error={umkmError}
                    onOpenUmkmView={() => router.push(UMKM_DISCOVERY_PATH)}
                    onApplyCity={(city) => {
                      setLocationInput(city);
                      setLocation(city);
                      if (type === 'umkm') setType('all');
                      setResultsView('results');
                    }}
                  />
                </div>
              ) : null}

              {shouldShowResultCards ? (
                <>
                  {error ? (
                    <div
                      className={cn(
                        'ui-panel-muted border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-3 py-2.5 text-sm ui-warning-text sm:px-4 sm:py-3',
                        compactCardBaselineClass,
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{error}</span>
                        <button
                          type="button"
                          onClick={() => setRefreshKey((value) => value + 1)}
                          className="inline-flex items-center gap-1 text-xs font-semibold ui-warning-text"
                        >
                          <RefreshCcw className="h-3.5 w-3.5" />
                          {text.retry}
                        </button>
                      </div>
                    </div>
                  ) : loading ? (
                    <div className={resultsGridClass}>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div
                          key={`skeleton-${index}`}
                          className={cn(
                            'ui-feed-tile animate-pulse rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_90%,white_10%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_94%,transparent))] shadow-[0_16px_32px_-28px_rgba(15,23,42,0.12)] ring-1 ring-white/55 dark:border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] dark:ring-white/5',
                            loadingSkeletonClass,
                          )}
                        />
                      ))}
                    </div>
                  ) : visibleItems.length === 0 ? (
                    <div
                      className={cn(
                        'flex flex-col justify-center rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_90%,white_10%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_94%,transparent))] px-4 py-8 text-center shadow-[0_18px_34px_-28px_rgba(15,23,42,0.12)] ring-1 ring-white/55 dark:border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] dark:ring-white/5 sm:px-6 sm:py-10',
                        compactCardBaselineClass,
                      )}
                    >
                      <p className="text-sm ui-text-soft">{text.empty}</p>
                      <p className="mt-2 text-[12px] ui-text-soft">
                        {type === 'freelancer'
                          ? locale === 'id'
                            ? 'Belum ketemu talent. Buat brief agar user bisa lihat kebutuhan Anda.'
                            : 'Talent not found yet. Create a brief so users can see your need.'
                          : locale === 'id'
                            ? 'Belum ada yang cocok. Coba jalur terdekat atau posting kebutuhan agar vendor bisa respon.'
                            : 'No fit yet. Try the closest lane or post a need so vendors can respond.'}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <AuthCtaLink
                          hrefWhenAuth={briefCreateHref}
                          hrefWhenGuest="/register"
                          className="ui-pressable inline-flex items-center rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 py-2 text-[11px] font-semibold text-white transition hover:brightness-105"
                          ariaLabel={briefCreateLabel}
                        >
                          {briefCreateLabel}
                        </AuthCtaLink>
                        {canReset ? (
                          <button
                            type="button"
                            onClick={resetAllFilters}
                            className="ui-pressable inline-flex items-center rounded-full border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_96%,white_4%),color-mix(in_srgb,var(--app-surface)_90%,transparent))] px-4 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-[color:var(--app-surface-strong)] hover:text-[color:var(--app-accent)] dark:text-slate-200 dark:hover:bg-[color:var(--app-surface-strong)] dark:hover:text-sky-200"
                          >
                            {text.reset}
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        {resultsStarters.slice(0, 3).map(starter => (
                          <button
                            key={starter.id}
                            type="button"
                            onClick={() => {
                              setQueryInput(starter.query);
                              setQuery(starter.query);
                              setType(starter.type);
                              setSideFilter(starter.side);
                              setResultsView('results');
                              setShowAll(false);
                            }}
                            className="ui-pressable inline-flex items-center rounded-full border border-[color:color-mix(in_srgb,var(--app-border)_92%,white_8%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_95%,transparent))] px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_97%,rgba(15,23,42,0.98)),color-mix(in_srgb,var(--app-surface)_94%,rgba(2,6,23,0.98)))] dark:text-slate-200 dark:hover:border-[color:var(--app-accent-border)] dark:hover:text-sky-200"
                          >
                            {locale === 'id' ? starter.labelId : starter.labelEn}
                          </button>
                        ))}
                        {popularCities.slice(0, 3).map(city => (
                          <button
                            key={city}
                            type="button"
                            onClick={() => {
                              setLocationInput(city);
                              setLocation(city);
                            }}
                            className="ui-pressable inline-flex items-center rounded-full border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_96%,white_4%),color-mix(in_srgb,var(--app-surface)_90%,transparent))] px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-[color:var(--app-surface-strong)] hover:text-[color:var(--app-accent)] dark:text-slate-200 dark:hover:bg-[color:var(--app-surface-strong)] dark:hover:text-sky-200"
                          >
                            {city}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className={resultsGridClass}>
                      {visibleItems.map((item) => {
                        const updatedLabel = formatShortDate(item.updatedAt, locale);
                        return (
                          <MarketplaceDiscoveryCard
                            key={item.id}
                            locale={locale}
                            compact
                            layoutContext="grid"
                            presentation="simple"
                            className={cardModeClass}
                            item={{
                              id: item.id,
                              href: item.href,
                              title: item.title,
                              summary: item.summary,
                              location: item.location,
                              priceLabel: item.priceLabel,
                              typeLabel: item.typeLabel,
                              typeKey: item.typeKey,
                              side: item.side,
                              sideLabel: item.sideLabel,
                              sideContextLabel: item.sideContextLabel,
                              image: item.image,
                              images: item.images,
                              profileHref: item.profileHref,
                              chatUserId: item.chatUserId,
                              updatedLabel,
                              tone: item.group,
                              verified: item.verified,
                            }}
                          />
                        );
                      })}
                    </div>
                  )}

                  {visibleItems.length > 0 && !loading ? (
                    <div className="mt-3 flex items-center justify-center">
                      {canLoadMore ? (
                        <button
                          type="button"
                          onClick={() => handleLoadMore(offset)}
                          className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
                          disabled={loadingMore || !canLoadMore}
                        >
                          {loadingMore ? <RefreshCcw className="h-4 w-4 animate-spin" /> : null}
                          {text.loadMore}
                        </button>
                      ) : (
                        <p className="text-[11px] ui-text-soft">{text.endOfResults}</p>
                      )}
                    </div>
                  ) : null}
                </>
              ) : null}

              <div ref={loadMoreRef} className="h-1" />
            </div>
          ) : null}
        </div>

        <Modal
          open={filtersOpen}
          title={text.filterModalTitle}
          onClose={() => setFiltersOpen(false)}
          className="max-w-none rounded-[24px] rounded-b-none p-3 sm:max-w-3xl sm:rounded-[28px] sm:p-5"
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={resetAllFilters}
                className="ui-pressable inline-flex min-h-[42px] items-center justify-center rounded-full bg-slate-100 px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-rose-50 hover:text-rose-600 sm:min-h-[48px] sm:text-sm dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-rose-950/30 dark:hover:text-rose-200"
              >
                {text.reset}
              </button>
              <button
                type="button"
                onClick={applyFiltersAndClose}
                className="ui-pressable inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-5 text-[13px] font-bold text-white shadow-[0_18px_34px_-22px_color-mix(in_srgb,var(--app-accent)_52%,transparent)] transition hover:brightness-105 sm:min-h-[48px] sm:text-sm"
              >
                {text.applyFilters}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          }
        >
          <div className="space-y-4 sm:space-y-5">
            <div className="rounded-[20px] bg-slate-50/80 p-3 sm:rounded-[22px] sm:p-4 dark:bg-slate-900/60">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)] dark:text-sky-300">
                {text.activeFilters}
              </p>
              <p className="mt-1.5 text-[13px] font-semibold text-[color:var(--app-text)] sm:mt-2 sm:text-sm">
                {text.filterModalDesc}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-[color:color-mix(in_srgb,var(--app-accent-soft)_22%,white)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-accent)] sm:px-3 sm:py-1.5 sm:text-[11px] dark:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_18%,rgba(15,23,42,0.98))] dark:text-sky-200">
                  {activeFilterCount} {text.activeFilters.toLowerCase()}
                </span>
                {location ? (
                  <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 sm:px-3 sm:py-1.5 sm:text-[11px] dark:bg-slate-950 dark:text-slate-200">
                    <MapPin className="mr-1.5 h-3.5 w-3.5" />
                    {location}
                  </span>
                ) : null}
                <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 sm:px-3 sm:py-1.5 sm:text-[11px] dark:bg-slate-950 dark:text-slate-200">
                  {activeTypeLabel}
                </span>
                <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 sm:px-3 sm:py-1.5 sm:text-[11px] dark:bg-slate-950 dark:text-slate-200">
                  {activeSortLabel}
                </span>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {text.filterLocation}
              </p>
              <label className="mt-2 flex min-w-0 items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-3 py-1.5 sm:rounded-[18px] sm:py-2 dark:border-slate-700 dark:bg-slate-950">
                <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={locationInput}
                  onChange={(event) => setLocationInput(event.target.value)}
                  placeholder={text.locationPlaceholder}
                  className="min-h-[34px] w-full min-w-0 appearance-none border-0 bg-transparent text-[13px] font-medium text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0 sm:min-h-[40px] sm:text-sm dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </label>

              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {text.filterPopularCities}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {popularCities.slice(0, 6).map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => {
                        setLocationInput(city);
                        setLocation(city);
                      }}
                      className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold transition sm:px-3 sm:py-1.5 sm:text-[11px]',
                        location === city || locationInput === city
                          ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-sky-800 dark:hover:bg-sky-950/40 dark:hover:text-sky-200',
                      )}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {text.side}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {sideOptions.map((option) => {
                  const active = sideFilter === option.value;
                  const visual = getSideFilterVisual(option.value);
                  const Icon = visual.icon;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => applySideScope(option.value)}
                      className={cn(
                        'ui-pressable flex min-h-[52px] items-center gap-2 rounded-[16px] border px-3 py-2 text-left text-[11px] font-semibold transition sm:min-h-[58px] sm:rounded-[18px] sm:text-[12px]',
                        active ? visual.active : visual.idle,
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px]',
                          visual.iconWrap,
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block leading-tight">{option.label}</span>
                        {option.hint ? (
                          <span className="mt-0.5 block text-[10px] font-medium opacity-80">
                            {option.hint}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          'inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 text-[10px] font-black',
                          visual.count,
                        )}
                      >
                        {option.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {text.filterNeedType}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {PRIMARY_TYPE_OPTIONS.map((option) => {
                  const active = type === option.value;
                  const visual = getTypeFilterVisual(option.value);
                  const Icon = visual.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => applyTypeSelection(option.value)}
                      className={cn(
                        'flex min-h-[48px] items-center justify-between gap-2 rounded-[16px] border px-3 py-2 text-left text-[11px] font-semibold transition sm:min-h-[56px] sm:rounded-[18px] sm:text-[12px]',
                        active ? visual.active : visual.idle,
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={cn(
                            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px]',
                            visual.iconWrap,
                          )}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <span className="min-w-0 leading-tight">
                          {locale === 'id' ? option.labelId : option.labelEn}
                        </span>
                      </span>
                      {active ? <BadgeCheck className="h-4 w-4" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {text.filterSort}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {SORT_OPTIONS.map((option) => {
                  const active = sort === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSort(option.value)}
                      className={cn(
                        'flex min-h-[44px] items-center justify-between rounded-[16px] border px-3 py-2 text-left text-[11px] font-semibold transition sm:min-h-[50px] sm:rounded-[18px] sm:text-[12px]',
                        active
                          ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-sky-800 dark:hover:bg-sky-950/40 dark:hover:text-sky-200',
                      )}
                    >
                      <span>{locale === 'id' ? option.labelId : option.labelEn}</span>
                      {active ? <BadgeCheck className="h-4 w-4" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
    </main>
  );
}


