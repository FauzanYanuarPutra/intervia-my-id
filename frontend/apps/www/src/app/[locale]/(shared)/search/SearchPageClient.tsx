'use client';

import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { MediaPreviewCarousel } from '@/components/common/MediaPreviewCarousel';
import { EmblaDesktopControls } from '@/components/common/EmblaDesktopControls';
import { useEmblaWheelGestures } from '@/components/common/useEmblaWheelGestures';
import {
  type CardType,
  type CategoryVisual,
  type SearchCard,
  type SearchFilterTabKey,
  type SearchResultsView,
  type SearchVisualKey,
  type SideFilter,
  type SortKey,
  type TypeKey,
} from './search.types';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll';
import { Link, useRouter } from '@/i18n/navigation';
import useEmblaCarousel from 'embla-carousel-react';
import { useInView } from 'react-intersection-observer';
import { Modal } from '@/components/common/Modal';
import { Skeleton, SkeletonStack } from '@/components/ui/Skeleton';
import { AuthCtaLink } from '@/components/home/AuthCtaLink';
import { useAuth } from '@/context/AuthContext';
import { useAppBack } from '@/lib/navigation/useAppBack';
import { SearchUmkmPreview, type UmkmPreviewStore } from './SearchUmkmPreview';
import {
  ArrowRight,
  BadgeCheck,
  BookmarkCheck,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Filter,
  Handshake,
  Layers3,
  MapPin,
  Package,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Store,
  UserRound,
  Wrench,
  X,
  Bookmark,
  Heart,
  type LucideIcon,
  Compass,
  Target,
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
import { readPublicReference } from '@/lib/content/publicReference';

function SearchResultSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="space-y-3"
      aria-busy="true"
      aria-label="Memuat hasil pencarian"
    >
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={index}
          className="overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 sm:p-4"
        >
          <div className="flex gap-3 sm:gap-4">
            <Skeleton
              variant="media"
              className="aspect-square h-24 w-24 shrink-0 rounded-[16px] sm:h-32 sm:w-32"
            />
            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Skeleton variant="line" className="h-3 w-20" />
                  <Skeleton variant="line" className="mt-2 h-5 w-4/5" />
                </div>
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              </div>
              <SkeletonStack lines={2} className="mt-3 hidden sm:block" />
              <div className="mt-3 flex gap-2">
                <Skeleton variant="chip" className="h-7 w-20" />
                <Skeleton variant="chip" className="h-7 w-16" />
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
import { resolveSupplierListingBadges } from '@/lib/content/supplierInfo';
import { buildPublicProfileHrefFromContent } from '@/lib/profile/publicProfileLink';
import {
  buildBusinessDiscoveryCreateHref,
  RESULT_BUSINESS_DISCOVERY_CATEGORY_IDS,
  getBusinessDiscoveryCategoryByCreateSlug,
  getBusinessDiscoveryCategoryById,
  isResultBusinessDiscoveryCategoryId,
  type BusinessDiscoveryCategoryId,
} from '@/lib/businessDiscoveryCategories';
import {
  FALLBACK_CREATE_SUBCATEGORIES,
  mergeCreateTaxonomyItems,
  type CreateTaxonomyItem,
} from '@/lib/create/createTaxonomyFallbacks';
import { compareBusinessServiceability } from '@/lib/businessDiscoveryRanking';
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
import { useViewerLocation } from '@/components/super-app/useViewerLocation';
import {
  haversineKm,
  isCoordinateValid,
  type LatLng,
} from '@/lib/super-app/location-guard';
import { formatDistanceKm } from '@/lib/geo/distance';

const PAGE_SIZE = 12;
const MARKETPLACE_CARD_FIXED_HEIGHT_CLASS =
  'h-[300px] min-h-[300px] max-h-[300px] sm:h-[312px] sm:min-h-[312px] sm:max-h-[312px]';
type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

function getListingSideVisual(side: ListingSide) {
  if (side === 'demand') {
    return {
      badgeClass:
        'bg-[#2563eb] text-white shadow-[0_10px_24px_-16px_rgba(37,99,235,0.75)]',
      chipClass: 'bg-[#eff6ff] text-[#1d4ed8] ring-1 ring-[#bfdbfe]',
      priceClass: 'text-[#2563eb]',
      Icon: Target,
    };
  }

  return {
    badgeClass:
      'bg-[#059669] text-white shadow-[0_10px_24px_-16px_rgba(5,150,105,0.75)]',
    chipClass: 'bg-[#ecfdf5] text-[#047857] ring-1 ring-[#a7f3d0]',
    priceClass: 'text-[#059669]',
    Icon: Store,
  };
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readBoundedCoord(
  source: Record<string, unknown> | null | undefined,
  keys: string[],
  limit: number,
): number | null {
  if (!source) return null;
  for (const key of keys) {
    const parsed = readFiniteNumber(source[key]);
    if (parsed !== null && Math.abs(parsed) <= limit) return parsed;
  }
  return null;
}

function asSearchRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readLatLngFromRecord(value: unknown): LatLng | null {
  const record = asSearchRecord(value);
  if (!record) return null;
  const lat = readBoundedCoord(
    record,
    [
      'lat',
      'latitude',
      'location_lat',
      'location_latitude',
      'geo_lat',
      'address_lat',
      'pickup_lat',
      'store_lat',
      'outlet_lat',
    ],
    90,
  );
  const lng = readBoundedCoord(
    record,
    [
      'lng',
      'lon',
      'long',
      'longitude',
      'location_lng',
      'location_lon',
      'location_longitude',
      'geo_lng',
      'address_lng',
      'pickup_lng',
      'store_lng',
      'outlet_lng',
    ],
    180,
  );
  if (lat === null || lng === null) return null;
  const point = { lat, lng };
  return isCoordinateValid(point) ? point : null;
}

function collectSearchLocationPoints(item: ContentItem): LatLng[] {
  const points: LatLng[] = [];
  const metadata = asSearchRecord(item.metadata);
  const addPoint = (point: LatLng | null) => {
    if (!point) return;
    if (
      points.some(
        existing =>
          Math.abs(existing.lat - point.lat) < 0.000001 &&
          Math.abs(existing.lng - point.lng) < 0.000001,
      )
    ) {
      return;
    }
    points.push(point);
  };

  addPoint(readLatLngFromRecord(item));
  addPoint(readLatLngFromRecord(metadata));
  for (const nested of [
    metadata?.primary_umkm_store,
    metadata?.store,
    metadata?.outlet,
    metadata?.pickup_location,
    metadata?.return_location,
  ]) {
    addPoint(readLatLngFromRecord(nested));
  }
  for (const key of [
    'linked_umkm_stores',
    'umkm_store_inventory',
    'branches',
    'outlets',
  ]) {
    const value = metadata?.[key];
    if (!Array.isArray(value)) continue;
    for (const entry of value.slice(0, 20)) {
      addPoint(readLatLngFromRecord(entry));
    }
  }

  return points;
}

function readDistanceKmFromContent(
  item: ContentItem,
  metadata: Record<string, unknown>,
): number | null {
  const root = item as ContentItem & {
    distance_km?: unknown;
    distanceKm?: unknown;
  };
  const distance =
    readFiniteNumber(root.distance_km) ??
    readFiniteNumber(root.distanceKm) ??
    readFiniteNumber(metadata.distance_km) ??
    readFiniteNumber(metadata.viewer_distance_km) ??
    readFiniteNumber(metadata.distanceKm);
  return distance !== null && distance >= 0 ? distance : null;
}

function formatSearchDistance(
  distanceKm: number | null | undefined,
): string | null {
  return formatDistanceKm(distanceKm);
}

function withViewerDistance(
  item: SearchCard,
  viewerLocation: LatLng | null,
): SearchCard {
  if (
    item.distanceKm !== null &&
    item.distanceKm !== undefined &&
    item.distanceLabel
  ) {
    return item;
  }
  if (
    !viewerLocation ||
    typeof item.lat !== 'number' ||
    typeof item.lng !== 'number'
  ) {
    return item;
  }
  const distanceKm = haversineKm(viewerLocation, {
    lat: item.lat,
    lng: item.lng,
  });
  if (!Number.isFinite(distanceKm)) return item;
  return {
    ...item,
    distanceKm,
    distanceLabel: formatSearchDistance(distanceKm),
  };
}

const FALLBACK_CITIES = [
  'Bandung',
  'Jakarta',
  'Surabaya',
  'Medan',
  'Yogyakarta',
  'Makassar',
];

const SEARCH_FILTER_TABS: Array<{
  value: SearchFilterTabKey;
  labelId: string;
  labelEn: string;
  badgeId?: string;
  badgeEn?: string;
  icon: LucideIcon;
}> = [
  { value: 'all', labelId: 'Semua', labelEn: 'All', icon: Layers3 },
  {
    value: 'supplies',
    labelId: 'Bahan & Supplier',
    labelEn: 'Business Supplies',
    badgeId: 'Utama',
    badgeEn: 'Wholesale',
    icon: Package,
  },
  {
    value: 'service',
    labelId: 'Jasa Usaha',
    labelEn: 'Find Services',
    badgeId: 'Expert',
    badgeEn: 'Expert',
    icon: Wrench,
  },
  {
    value: 'equipment',
    labelId: 'Mesin & Alat',
    labelEn: 'Equipment & Tools',
    badgeId: 'Teknis',
    badgeEn: 'Technical',
    icon: Briefcase,
  },
  {
    value: 'property',
    labelId: 'Tempat Usaha',
    labelEn: 'Business Places',
    badgeId: 'Prime',
    badgeEn: 'Prime',
    icon: MapPin,
  },
  {
    value: 'opportunity',
    labelId: 'Peluang Usaha',
    labelEn: 'Business Opportunities',
    badgeId: 'Cuan',
    badgeEn: 'Grow',
    icon: Handshake,
  },
  {
    value: 'nearby',
    labelId: 'Usaha Sekitar',
    labelEn: 'Nearby Businesses',
    badgeId: 'Dekat',
    badgeEn: 'Nearby',
    icon: Store,
  },
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
  if (value === 'reference') return 'reference';
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

function getSearchTabConfig(value: SearchFilterTabKey) {
  return SEARCH_FILTER_TABS.find(tab => tab.value === value) || null;
}

function getSearchTabLabel(value: SearchFilterTabKey, locale: 'id' | 'en') {
  const tab = getSearchTabConfig(value);
  if (tab) return locale === 'id' ? tab.labelId : tab.labelEn;
  const category = getBusinessDiscoveryCategoryById(value);
  if (category) return locale === 'id' ? category.labelId : category.labelEn;
  return locale === 'id' ? 'Semua' : 'All';
}

function getSearchTabHint(value: SearchFilterTabKey, locale: 'id' | 'en') {
  const category = getBusinessDiscoveryCategoryById(value);
  if (category) return locale === 'id' ? category.hintId : category.hintEn;
  return getCategoryHint(searchTabVisualKey(value), locale);
}

function searchTabVisualKey(value: SearchFilterTabKey): SearchVisualKey {
  if (value === 'equipment' || value === 'supplies') return 'product';
  if (value === 'opportunity') return 'business_transfer';
  if (value === 'nearby') return 'umkm';
  if (value === 'used_goods') return 'product';
  return value;
}

function normalizedQueryIncludes(query: string, needle: string): boolean {
  const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim();
  return normalized.includes(needle);
}

function resolveActiveBusinessSearchTab({
  query,
  type,
  usedOnly,
}: {
  query: string;
  type: TypeKey;
  usedOnly: boolean;
}): SearchFilterTabKey {
  if (usedOnly) return 'used_goods';
  if (type === 'umkm') return 'nearby';
  if (type === 'product' && normalizedQueryIncludes(query, 'mesin usaha')) {
    return 'equipment';
  }
  if (type === 'product' && normalizedQueryIncludes(query, 'bahan usaha')) {
    return 'supplies';
  }
  if (type === 'tool_rental') return 'equipment';
  if (
    type === 'business_transfer' ||
    normalizedQueryIncludes(query, 'peluang usaha') ||
    normalizedQueryIncludes(query, 'franchise') ||
    normalizedQueryIncludes(query, 'kemitraan') ||
    normalizedQueryIncludes(query, 'reseller')
  ) {
    return 'opportunity';
  }
  if (type === 'product') return 'supplies';
  if (type === 'service') return 'service';
  if (type === 'freelancer' || type === 'job') return 'service';
  if (type === 'property') return 'property';
  return type;
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

function isResultCategoryId(
  value: string | null | undefined,
): value is BusinessDiscoveryCategoryId {
  return isResultBusinessDiscoveryCategoryId(value);
}

function resolveBusinessCategory(
  meta: Record<string, unknown>,
): BusinessDiscoveryCategoryId | null {
  const explicit =
    asString(meta.create_category) ||
    asString(meta.discovery_category) ||
    asString(meta.business_discovery_category) ||
    asString(meta.marketplace_category_slug) ||
    asString(meta.marketplace_category_legacy_key);
  const category =
    getBusinessDiscoveryCategoryById(explicit) ||
    getBusinessDiscoveryCategoryByCreateSlug(explicit);
  return category && isResultCategoryId(category.id) ? category.id : null;
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
  const publicReference = readPublicReference(item);
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
  const priceLabel = publicReference
    ? locale === 'id'
      ? 'Referensi publik'
      : 'Public reference'
    : price !== '-'
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
  const sideLabel = publicReference
    ? locale === 'id'
      ? 'Referensi'
      : 'Reference'
    : getListingSideLabel(side, locale);
  const sideContextLabel = publicReference
    ? publicReference.sourceTitle
    : resolveSearchSideContextLabel(side, typeKey, locale);
  const businessCategory = resolveBusinessCategory(meta);
  const supplierBadges = resolveSupplierListingBadges(item, locale);
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
  const likeCount =
    readPositiveInteger((item as { likeCount?: unknown }).likeCount) ||
    readPositiveInteger((item as { like_count?: unknown }).like_count) ||
    readPositiveInteger((item as { likes_count?: unknown }).likes_count) ||
    readPositiveInteger(meta.like_count) ||
    readPositiveInteger(meta.likes_count);
  const liked = Boolean(
    (item as { liked?: unknown }).liked ||
    (item as { is_liked?: unknown }).is_liked ||
    (item as { viewer_liked?: unknown }).viewer_liked ||
    meta.liked ||
    meta.is_liked ||
    meta.viewer_liked,
  );
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
  const locationPoints = collectSearchLocationPoints(item);
  const primaryPoint = locationPoints[0] || null;
  const distanceKm = readDistanceKmFromContent(item, meta);
  const distanceLabel = formatSearchDistance(distanceKm);

  return {
    id,
    content_type: item.content_type || item.category || typeKey,
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
    businessCategory,
    supplierBadges,
    image,
    images: gallery,
    href: detailHref,
    profileHref,
    updatedAt,
    priceCents,
    lat: primaryPoint?.lat ?? null,
    lng: primaryPoint?.lng ?? null,
    distanceKm,
    distanceLabel,
    liked,
    likeCount,
    entityKind,
    verified,
    hasMedia: gallery.length > 0,
    ownerId: item.owner_id || item.owner_profile?.id || null,
    ownerName,
    storeId,
    storeSlug,
    storeName,
    productId,
    isPublicReference: Boolean(publicReference),
    sourceTitle: publicReference?.sourceTitle || null,
    sourceUrl: publicReference?.sourceUrl || null,
    sourceLicense: publicReference?.sourceLicense || null,
  };
}

function readPositiveInteger(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed));
  }
  return 0;
}

/*
    user.headline || user.bio || roles.slice(0, 2).join(' · ') ||
      ? `${user.rating.toFixed(1)}★`

*/
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
        'flex min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none cursor-grab active:cursor-grabbing',
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
              'inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-full border px-3.5 text-[12px] font-bold transition hover:-translate-y-0.5',
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

function getSubcategoryLabel(
  item: CreateTaxonomyItem,
  locale: 'id' | 'en',
): string {
  return (
    (locale === 'id'
      ? item.name_id || item.label_id
      : item.name_en || item.label_en) || item.slug
  );
}

function SearchSubcategoryFilter({
  items,
  locale,
  selected,
  onSelect,
  layout = 'wrap',
  className,
}: {
  items: CreateTaxonomyItem[];
  locale: 'id' | 'en';
  selected: string;
  onSelect: (slug: string) => void;
  layout?: 'rail' | 'stack' | 'wrap';
  className?: string;
}) {
  const isId = locale === 'id';
  if (items.length === 0) return null;

  const options: Array<{ slug: string; label: string }> = [
    {
      slug: '',
      label: isId ? 'Semua subkategori' : 'All subcategories',
    },
    ...items.map(item => ({
      slug: item.slug,
      label: getSubcategoryLabel(item, locale),
    })),
  ];

  return (
    <div className={className}>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
        {isId ? 'Subkategori' : 'Subcategory'}
      </p>
      <div
        className={cn(
          'mt-2',
          layout === 'rail' &&
            'flex min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          layout === 'stack' && 'grid gap-2',
          layout === 'wrap' && 'flex flex-wrap gap-2',
        )}
      >
        {options.map(option => {
          const active = selected === option.slug;
          return (
            <button
              key={option.slug || 'all-subcategories'}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(option.slug)}
              className={cn(
                'inline-flex min-h-[40px] items-center justify-between gap-2 border px-3 text-left text-[12px] font-semibold transition',
                layout === 'rail' ? 'shrink-0 rounded-full' : 'rounded-[14px]',
                layout === 'stack' && 'w-full',
                active
                  ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] shadow-[0_12px_24px_-20px_color-mix(in_srgb,var(--app-accent)_70%,transparent)]'
                  : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)] hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)]',
              )}
            >
              <span>{option.label}</span>
              {active ? <BadgeCheck className="h-4 w-4 shrink-0" /> : null}
            </button>
          );
        })}
      </div>
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
    all: Compass,
    supply: Store,
    demand: Target,
    reference: Layers3,
  };

  const Icon = iconMap[value];

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        'group flex items-center gap-2.5 rounded-[14px] border p-2.5 text-left transition-all',
        active
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-zinc-200 bg-white hover:border-emerald-100 hover:bg-zinc-50',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition',
          active ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-600',
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-zinc-900">{label}</span>

          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              active
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-100 text-zinc-500',
            )}
          >
            {count}
          </span>
        </div>

        <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p>
      </div>

      {active && <BadgeCheck className="h-4 w-4 text-emerald-600" />}
    </button>
  );
}

// function SearchResultListingCard({
//   item,
//   locale,
//   cartQuantity,
//   onAddToCart,
//   onRemoveFromCart,
//   onOpenCart,
// }: {
//   item: SearchCard;
//   locale: 'id' | 'en';
//   cartQuantity: number;
//   onAddToCart: (item: SearchCard) => void;
//   onRemoveFromCart: (itemId: string) => void;
//   onOpenCart: () => void;
// }) {
//   const isId = locale === 'id';
//   const previewImages =
//     item.images.length > 0 ? item.images : item.image ? [item.image] : [];
//   const updatedLabel = formatShortDate(item.updatedAt, locale);
//   const visual = getCategoryVisual(item.typeKey);
//   const CategoryIcon = visual.icon;
//   const isSaved = cartQuantity > 0;
//   const badgeTone =
//     'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] border-[color:var(--app-border)]';
//   const detailLabel = isId ? 'Detail / chat' : 'Details / chat';
//   const savedLabel = isSaved
//     ? isId
//       ? 'Tersimpan'
//       : 'Saved'
//     : isId
//       ? 'Simpan'
//       : 'Save';
//   const saveAriaLabel = isSaved
//     ? isId
//       ? 'Buka referensi tersimpan'
//       : 'Open saved references'
//     : isId
//       ? 'Simpan sebagai referensi'
//       : 'Save as reference';
//   const ownerLabel = item.storeName || item.ownerName || null;
//   const mediaLabel =
//     previewImages.length > 1
//       ? isId
//         ? `${previewImages.length} foto`
//         : `${previewImages.length} photos`
//       : item.hasMedia
//         ? isId
//           ? 'Ada foto'
//           : 'Has media'
//         : null;

//   return (
//     <article
//       data-testid="search-result-card"
//       className={cn(
//         'group/card overflow-hidden rounded-[22px] border shadow-[0_18px_38px_-30px_rgba(15,23,42,0.2)] ring-1 ring-white/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_58px_-40px_rgba(15,23,42,0.28)]',
//         visual.cardClass,
//       )}
//     >
//       <div className="grid min-w-0 grid-cols-[112px_minmax(0,1fr)] items-stretch gap-0 sm:grid-cols-[148px_minmax(0,1fr)] xl:grid-cols-[172px_minmax(0,1fr)_176px] 2xl:grid-cols-[184px_minmax(0,1fr)_190px]">
//         <Link
//           href={item.href}
//           className={cn(
//             'relative h-full min-h-[112px] w-full self-stretch overflow-hidden sm:min-h-[148px] xl:min-h-full',
//             visual.imageClass,
//           )}
//           aria-label={isId ? 'Buka detail' : 'Open details'}
//         >
//           {previewImages.length > 0 ? (
//             <MediaPreviewCarousel
//               items={previewImages}
//               alt={item.title}
//               aspectClassName="h-full w-full"
//               className="absolute inset-0 h-full w-full bg-transparent"
//               mediaClassName="transition duration-500 group-hover/card:scale-[1.035]"
//               sizes="(max-width: 640px) 112px, (max-width: 1280px) 148px, 184px"
//               controls={false}
//               lightbox={false}
//               showCounter={previewImages.length > 1}
//               showDots={previewImages.length > 1}
//             />
//           ) : (
//             <div className="flex h-full items-center justify-center text-[color:var(--app-text-soft)]">
//               <span
//                 className={cn(
//                   'inline-flex h-16 w-16 items-center justify-center rounded-[24px]',
//                   visual.iconBubbleClass,
//                 )}
//               >
//                 <CategoryIcon className="h-8 w-8" />
//               </span>
//             </div>
//           )}
//           <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 to-transparent" />
//           <div className="absolute left-2 top-2 sm:left-3 sm:top-3">
//             <span
//               className={cn(
//                 'inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-bold shadow-sm  sm:text-[10px]',
//                 visual.chipClass,
//               )}
//             >
//               <CategoryIcon className="h-3.5 w-3.5" />
//               <span className="truncate">{item.typeLabel}</span>
//             </span>
//           </div>
//           {mediaLabel ? (
//             <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3">
//               <span className="inline-flex max-w-full items-center rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-bold text-slate-700 shadow-sm ">
//                 {mediaLabel}
//               </span>
//             </div>
//           ) : null}
//         </Link>

//         <div className="min-w-0 border-l border-[color:var(--app-border)] bg-white/58 p-3  sm:p-4">
//           <div className="min-w-0">
//             <div className="mb-1.5 flex flex-wrap items-center gap-1.5 sm:mb-2">
//               <span
//                 className={cn(
//                   'inline-flex min-h-[22px] items-center rounded-full border px-2 py-0.5 text-[9px] font-bold',
//                   badgeTone,
//                 )}
//               >
//                 {item.sideLabel}
//               </span>
//               {item.verified ? (
//                 <span className="inline-flex min-h-[22px] items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
//                   <BadgeCheck className="h-3 w-3" />
//                   Verified
//                 </span>
//               ) : null}
//             </div>
//             <Link href={item.href} className="group block">
//               <h3 className="line-clamp-2 text-[0.92rem] font-bold leading-[1.08] tracking-[-0.035em] text-[color:var(--app-text)] group-hover:text-[color:var(--app-accent)] sm:text-[1.1rem]">
//                 {item.title}
//               </h3>
//             </Link>
//             {ownerLabel ? (
//               <p className="mt-0.5 line-clamp-1 text-[10px] font-bold text-[color:var(--app-text-soft)] sm:mt-1 sm:text-[11px]">
//                 {ownerLabel}
//               </p>
//             ) : null}
//             <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-[color:var(--app-text-soft)] sm:mt-1.5 sm:gap-x-3 sm:text-[11px]">
//               <span className="inline-flex items-center gap-1.5">
//                 <MapPin className="h-3.5 w-3.5" />
//                 {item.location}
//               </span>
//               {updatedLabel ? (
//                 <span className="inline-flex items-center gap-1.5">
//                   <Clock3 className="h-3.5 w-3.5" />
//                   {updatedLabel}
//                 </span>
//               ) : null}
//             </div>
//           </div>

//           <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-[color:var(--app-text-soft)] sm:mt-2 sm:text-[12px]">
//             {item.summary ||
//               (isId
//                 ? 'Siap dibuka. Lanjut chat.'
//                 : 'Listing ready to open and follow up.')}
//           </p>

//           <div className="mt-2 xl:hidden">
//             <div className="rounded-[14px] border border-white/70 bg-white/76 px-2.5 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)] sm:rounded-[16px] sm:px-3">
//               <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
//                 {isId ? 'Info' : 'Info'}
//               </p>
//               <p
//                 className={cn(
//                   'mt-0.5 truncate text-[0.88rem] font-bold leading-tight sm:text-[0.95rem]',
//                   visual.priceClass,
//                 )}
//               >
//                 {item.priceLabel}
//               </p>
//               {item.priceUnitLabel ? (
//                 <p className="mt-0.5 truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
//                   {isId ? 'Per' : 'Per'} {item.priceUnitLabel}
//                 </p>
//               ) : null}
//             </div>

//             <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
//               <Link
//                 href={item.profileHref || item.href}
//                 className={cn(
//                   'inline-flex min-h-[40px] min-w-0 items-center justify-center gap-2 rounded-[14px] border px-3 text-[12px] font-bold',
//                   visual.outlineButtonClass,
//                 )}
//               >
//                 <Eye className="h-3.5 w-3.5 shrink-0" />
//                 <span className="truncate">{detailLabel}</span>
//               </Link>
//               <button
//                 type="button"
//                 onClick={() =>
//                   isSaved ? onOpenCart() : onAddToCart(item)
//                 }
//                 aria-label={saveAriaLabel}
//                 className={cn(
//                   'relative inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[14px] px-3 text-[12px] font-bold',
//                   visual.solidButtonClass,
//                 )}
//               >
//                 {isSaved ? (
//                   <BookmarkCheck className="h-3.5 w-3.5" />
//                 ) : (
//                   <BookmarkPlus className="h-3.5 w-3.5" />
//                 )}
//                 <span className="hidden sm:inline">{savedLabel}</span>
//               </button>
//             </div>
//             {isSaved ? (
//               <button
//                 type="button"
//                 onClick={() => onRemoveFromCart(item.id)}
//                 className="mt-2 inline-flex min-h-[28px] items-center gap-1.5 rounded-full px-1 text-[10px] font-bold text-[color:var(--app-text-soft)] hover:text-[color:var(--app-text)]"
//               >
//                 <X className="h-3 w-3" />
//                 {isId ? 'Hapus dari referensi' : 'Remove reference'}
//               </button>
//             ) : null}
//           </div>
//         </div>

//         <div
//           className={cn(
//             'hidden border-l border-[color:var(--app-border)] p-3 xl:flex xl:flex-col xl:justify-between',
//             visual.sidePanelClass,
//           )}
//         >
//           <div>
//             <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
//               {isId ? 'Info' : 'Info'}
//             </p>
//             <p
//               className={cn(
//                 'mt-1 text-[1.06rem] font-bold leading-tight',
//                 visual.priceClass,
//               )}
//             >
//               {item.priceLabel}
//             </p>
//             {item.priceUnitLabel ? (
//               <p className="mt-1 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
//                 {isId ? 'Harga per' : 'Price per'} {item.priceUnitLabel}
//               </p>
//             ) : null}
//             <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[color:var(--app-text-soft)]">
//               {item.sideContextLabel}
//             </p>
//           </div>

//           <div className="space-y-2">
//             <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
//               <button
//                 type="button"
//                 onClick={() =>
//                   isSaved ? onOpenCart() : onAddToCart(item)
//                 }
//                 aria-label={saveAriaLabel}
//                 className={cn(
//                   'inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[12px] px-3 text-[12px] font-semibold',
//                   visual.solidButtonClass,
//                 )}
//               >
//                 {isSaved ? (
//                   <BookmarkCheck className="h-3.5 w-3.5" />
//                 ) : (
//                   <BookmarkPlus className="h-3.5 w-3.5" />
//                 )}
//                 {savedLabel}
//               </button>
//               {isSaved ? (
//                 <button
//                   type="button"
//                   onClick={() => onRemoveFromCart(item.id)}
//                   aria-label={
//                     isId
//                       ? 'Hapus dari referensi'
//                       : 'Remove from saved references'
//                   }
//                   className={cn(
//                     'inline-flex h-[38px] w-[38px] items-center justify-center rounded-[12px] border text-[12px] font-semibold',
//                     visual.outlineButtonClass,
//                   )}
//                 >
//                   <X className="h-3.5 w-3.5" />
//                 </button>
//               ) : null}
//             </div>
//             <Link
//               href={item.profileHref || item.href}
//               className={cn(
//                 'inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[12px] border px-3 text-[12px] font-semibold',
//                 visual.outlineButtonClass,
//               )}
//             >
//               <Eye className="h-3.5 w-3.5" />
//               {detailLabel}
//               <ArrowRight className="h-3.5 w-3.5" />
//             </Link>
//           </div>
//         </div>
//       </div>
//     </article>
//   );
// }

function SearchResultListingCard({
  item,
  locale,
  cartQuantity,
  onAddToCart,
  onRemoveFromCart,
  onOpenCart,
  authFetch,
  userSignedIn,
}: {
  item: SearchCard;
  locale: 'id' | 'en';
  cartQuantity: number;
  onAddToCart: (item: SearchCard) => void;
  onRemoveFromCart: (itemId: string) => void;
  onOpenCart?: () => void;
  authFetch: AuthFetch;
  userSignedIn: boolean;
}) {
  const isSaved = cartQuantity > 0;
  const router = useRouter();
  const [liked, setLiked] = useState(item.liked);
  const [likeCount, setLikeCount] = useState(item.likeCount || 0);
  const [likeBusy, setLikeBusy] = useState(false);

  const images =
    item.images?.length > 0 ? item.images : item.image ? [item.image] : [];
  const sideVisual = item.isPublicReference
    ? {
        badgeClass:
          'bg-amber-600 text-white shadow-[0_10px_24px_-16px_rgba(217,119,6,0.75)]',
        chipClass: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
        priceClass: 'text-amber-700',
        Icon: Layers3,
      }
    : getListingSideVisual(item.side);
  const SideIcon = sideVisual.Icon;
  const detailBadges = [item.sideContextLabel, ...item.supplierBadges].filter(
    Boolean,
  );

  useEffect(() => {
    setLiked(item.liked);
    setLikeCount(item.likeCount || 0);
    setLikeBusy(false);
  }, [item.id, item.liked, item.likeCount]);

  const toggleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSaved) onRemoveFromCart(item.id);
    else {
      onAddToCart(item);
      onOpenCart?.();
    }
  };

  const toggleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!userSignedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(item.href)}`);
      return;
    }
    if (likeBusy) return;

    const previousLiked = liked;
    const previousCount = likeCount;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount(Math.max(previousCount + (nextLiked ? 1 : -1), 0));
    setLikeBusy(true);

    try {
      const response = await authFetch(
        `/api/content/${encodeURIComponent(item.id)}/like`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ liked: nextLiked }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        liked?: unknown;
        likeCount?: unknown;
        like_count?: unknown;
      };
      if (!response.ok) throw new Error('like failed');
      setLiked(Boolean(payload.liked));
      setLikeCount(
        readPositiveInteger(payload.likeCount ?? payload.like_count),
      );
    } catch {
      setLiked(previousLiked);
      setLikeCount(previousCount);
    } finally {
      setLikeBusy(false);
    }
  };

  // const getTypeLabel = () => {
  //   if (item.storeName) return 'Supplier';
  //   if (item.ownerName) return 'Individual';
  //   return 'Listing';
  // };

  return (
    <Link href={item.href} className="block h-full">
      <article
        className={cn(
          'flex w-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md',
          MARKETPLACE_CARD_FIXED_HEIGHT_CLASS,
        )}
      >
        {/* IMAGE */}
        <div className="relative h-[132px] w-full shrink-0 bg-gray-100 sm:h-[144px]">
          {images.length > 0 ? (
            <MediaPreviewCarousel
              items={images}
              alt={item.title}
              aspectClassName="h-full w-full"
              className="h-full w-full"
              controls={false}
              lightbox={false}
              showDots={images.length > 1}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">
              No Image
            </div>
          )}

          <span
            className={cn(
              'absolute left-2 top-2 inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] ',
              sideVisual.badgeClass,
            )}
          >
            <SideIcon className="h-3.5 w-3.5" />
            {item.sideLabel}
          </span>

          {!item.isPublicReference ? (
            <>
              <button
                onClick={toggleSave}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white"
              >
                <Bookmark
                  size={16}
                  className={
                    isSaved ? 'fill-black text-black' : 'text-gray-500'
                  }
                />
              </button>

              <button
                type="button"
                onClick={toggleLike}
                disabled={likeBusy}
                className="absolute bottom-2 left-2 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white/92 px-2.5 text-[11px] font-bold text-slate-700 shadow-sm transition hover:bg-white disabled:opacity-70"
                aria-label={
                  liked
                    ? locale === 'id'
                      ? 'Batal suka'
                      : 'Unlike'
                    : locale === 'id'
                      ? 'Suka'
                      : 'Like'
                }
              >
                <Heart
                  className={cn(
                    'h-3.5 w-3.5 text-rose-500',
                    liked ? 'fill-rose-500' : '',
                  )}
                />
                <span>
                  {likeCount.toLocaleString(
                    locale === 'id' ? 'id-ID' : 'en-US',
                  )}
                </span>
              </button>
            </>
          ) : null}
        </div>

        {/* CONTENT */}
        <div className="flex min-h-0 flex-1 flex-col p-3">
          {/* TITLE (FIXED 2 LINES HEIGHT) */}
          <h3 className="line-clamp-2 h-[2.25rem] text-sm font-semibold leading-snug text-gray-900">
            {item.title}
          </h3>

          {detailBadges.length > 0 ? (
            <div className="mt-1 flex h-[22px] max-h-[22px] flex-wrap gap-1 overflow-hidden">
              {detailBadges.slice(0, 3).map((badge, index) => (
                <span
                  key={badge}
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    index === 0
                      ? sideVisual.chipClass
                      : 'bg-gray-100 text-gray-600',
                  )}
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-1 h-[22px] max-h-[22px]" />
          )}

          {/* META */}
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
            {item.distanceLabel ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <MapPin className="h-3 w-3" />
                {item.distanceLabel}
              </span>
            ) : null}
            <span className="min-w-0 truncate">{item.location}</span>
          </div>

          {/* PRICE */}
          <div className="mt-auto pt-2">
            <p
              className={cn(
                'truncate text-base font-extrabold',
                sideVisual.priceClass,
              )}
            >
              {item.priceLabel.split('/')[0]}
            </p>

            {item.priceUnitLabel && (
              <p className="truncate text-[11px] text-gray-500">
                Per {item.priceUnitLabel}
              </p>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

type SearchResultRail = {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  items: SearchCard[];
  typeKey: SearchFilterTabKey;
};

function itemTextIndex(item: SearchCard): string {
  return [
    item.businessCategory,
    item.title,
    item.summary,
    item.typeLabel,
    item.sideContextLabel,
    item.supplierBadges.join(' '),
    item.storeName,
    item.ownerName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isBusinessCategoryItem(
  item: SearchCard,
  categoryId: BusinessDiscoveryCategoryId,
): boolean {
  if (item.businessCategory) return item.businessCategory === categoryId;

  const text = itemTextIndex(item);
  if (categoryId === 'equipment') {
    return (
      item.typeKey === 'tool_rental' ||
      (item.typeKey === 'product' &&
        /(mesin|alat|equipment|tool|sewa|rental|freezer|oven|printer|kopi|espresso|sealer|produksi|workshop)/i.test(
          text,
        ))
    );
  }
  if (categoryId === 'supplies') {
    return (
      item.typeKey === 'product' && !isBusinessCategoryItem(item, 'equipment')
    );
  }
  if (categoryId === 'service') {
    return (
      item.typeKey === 'service' ||
      item.typeKey === 'freelancer' ||
      item.typeKey === 'job'
    );
  }
  if (categoryId === 'property') return item.typeKey === 'property';
  if (categoryId === 'opportunity') {
    return (
      item.typeKey === 'business_transfer' ||
      /(peluang|franchise|waralaba|kemitraan|reseller|distributor|dropship|agen|partnership|business opportunity)/i.test(
        text,
      )
    );
  }
  return false;
}

function SearchResultRailSection({
  section,
  locale,
  cartQuantities,
  onAddToCart,
  onRemoveFromCart,
  onOpenCart,
  onViewAll,
  authFetch,
  userSignedIn,
}: {
  section: SearchResultRail;
  locale: 'id' | 'en';
  cartQuantities: Record<string, number>;
  onAddToCart: (item: SearchCard) => void;
  onRemoveFromCart: (itemId: string) => void;
  onOpenCart: () => void;
  onViewAll: (typeKey: SearchFilterTabKey) => void;
  authFetch: AuthFetch;
  userSignedIn: boolean;
}) {
  const isId = locale === 'id';
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'keepSnaps',
    dragFree: true,
  });
  useEmblaWheelGestures(emblaApi);

  if (section.items.length === 0) return null;

  return (
    <section className="min-w-0 max-w-full space-y-3 overflow-x-hidden">
      <div className="flex min-w-0 items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold tracking-[-0.04em] text-[color:var(--app-text)]">
            {section.badge ? (
              <span className="mr-2 inline-flex align-middle rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                {section.badge}
              </span>
            ) : null}
            {section.title}
            <span className="ml-2 align-middle text-[11px] font-semibold tracking-normal text-[color:var(--app-text-soft)]">
              {section.items.length.toLocaleString(isId ? 'id-ID' : 'en-US')}
            </span>
          </h2>
          <p className="mt-0.5 line-clamp-1 text-[12px] font-medium text-[color:var(--app-text-soft)]">
            {section.subtitle}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onViewAll(section.typeKey)}
            className="inline-flex min-h-[34px] items-center gap-1 text-[12px] font-bold text-emerald-600"
          >
            {isId ? 'Lihat semua' : 'See all'}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <EmblaDesktopControls api={emblaApi} isId={isId} />
        </div>
      </div>

      <div
        className="min-w-0 max-w-full cursor-grab overflow-hidden active:cursor-grabbing"
        ref={emblaRef}
      >
        <div className="flex min-w-0 touch-pan-y gap-2 py-1 md:gap-3">
          {section.items.map(item => (
            <div
              key={`${section.id}-${item.id}`}
              className="w-[48vw] min-w-[168px] max-w-[210px] shrink-0 select-none sm:w-[210px] md:w-[220px] lg:w-[230px]"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <SearchResultListingCard
                item={item}
                locale={locale}
                cartQuantity={cartQuantities[item.id] || 0}
                onAddToCart={onAddToCart}
                onRemoveFromCart={onRemoveFromCart}
                onOpenCart={onOpenCart}
                authFetch={authFetch}
                userSignedIn={userSignedIn}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SearchResultRails({
  sections,
  locale,
  cartQuantities,
  onAddToCart,
  onRemoveFromCart,
  onOpenCart,
  onViewAll,
  authFetch,
  userSignedIn,
}: {
  sections: SearchResultRail[];
  locale: 'id' | 'en';
  cartQuantities: Record<string, number>;
  onAddToCart: (item: SearchCard) => void;
  onRemoveFromCart: (itemId: string) => void;
  onOpenCart: () => void;
  onViewAll: (typeKey: SearchFilterTabKey) => void;
  authFetch: AuthFetch;
  userSignedIn: boolean;
}) {
  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      {sections.map(section => (
        <SearchResultRailSection
          key={section.id}
          section={section}
          locale={locale}
          cartQuantities={cartQuantities}
          onAddToCart={onAddToCart}
          onRemoveFromCart={onRemoveFromCart}
          onOpenCart={onOpenCart}
          onViewAll={onViewAll}
          authFetch={authFetch}
          userSignedIn={userSignedIn}
        />
      ))}
    </div>
  );
}

function SearchResultVerticalList({
  section,
  locale,
  cartQuantities,
  onAddToCart,
  onRemoveFromCart,
  onOpenCart,
  authFetch,
  userSignedIn,
  hasMore,
}: {
  section: SearchResultRail;
  locale: 'id' | 'en';
  cartQuantities: Record<string, number>;
  onAddToCart: (item: SearchCard) => void;
  onRemoveFromCart: (itemId: string) => void;
  onOpenCart: () => void;
  authFetch: AuthFetch;
  userSignedIn: boolean;
  hasMore: boolean;
}) {
  const isId = locale === 'id';
  if (section.items.length === 0) return null;

  return (
    <section
      className="min-w-0 max-w-full space-y-3 overflow-x-hidden"
      data-testid="search-category-vertical-results"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold tracking-[-0.04em] text-[color:var(--app-text)]">
            {section.badge ? (
              <span className="mr-2 inline-flex align-middle rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                {section.badge}
              </span>
            ) : null}
            {section.title}
            <span className="ml-2 align-middle text-[11px] font-semibold tracking-normal text-[color:var(--app-text-soft)]">
              {section.items.length.toLocaleString(isId ? 'id-ID' : 'en-US')}
              {hasMore ? '+' : ''}
            </span>
          </h2>
          <p className="mt-0.5 line-clamp-2 text-[12px] font-medium text-[color:var(--app-text-soft)]">
            {isId
              ? `${section.subtitle} Hasil kategori ini ditampilkan vertikal.`
              : `${section.subtitle} This category is shown as a vertical feed.`}
          </p>
        </div>
      </div>

      <div className="grid min-w-0 max-w-full grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3 xl:grid-cols-4 2xl:grid-cols-5">
        {section.items.map(item => (
          <SearchResultListingCard
            key={`${section.id}-${item.id}`}
            item={item}
            locale={locale}
            cartQuantity={cartQuantities[item.id] || 0}
            onAddToCart={onAddToCart}
            onRemoveFromCart={onRemoveFromCart}
            onOpenCart={onOpenCart}
            authFetch={authFetch}
            userSignedIn={userSignedIn}
          />
        ))}
      </div>
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

  const items = cart.items;
  const firstItem = items[0];

  const countLabel = `${items.length} ${isId ? 'tersimpan' : 'saved'}`;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-[70] lg:bottom-5 lg:right-5 lg:left-auto lg:w-[360px]">
      {/* COLLAPSED */}
      {!open ? (
        <button
          onClick={() => onOpenChange(true)}
          className="pointer-events-auto flex w-full items-center justify-between rounded-[18px] border bg-white/90 px-3 py-2.5 shadow-lg "
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-[12px] bg-black text-white">
              <BookmarkCheck className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-black text-[9px] text-white">
                {items.length}
              </span>
            </div>

            <div className="min-w-0">
              <p className="truncate text-[12px] font-bold">
                {isId ? 'Tersimpan' : 'Saved'}
              </p>
              <p className="truncate text-[10px] text-gray-500">
                {firstItem?.title || countLabel}
              </p>
            </div>
          </div>

          <span className="rounded-full bg-black px-3 py-1 text-[10px] font-bold text-white">
            {isId ? 'Buka' : 'Open'}
          </span>
        </button>
      ) : (
        /* EXPANDED */
        <section className="pointer-events-auto flex max-h-[min(calc(var(--app-viewport-height)-10rem),520px)] flex-col overflow-hidden rounded-[20px] border bg-white shadow-xl">
          {/* HEADER */}
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold">
                {isId ? 'Referensi' : 'Saved'}
              </p>
              <p className="truncate text-[10px] text-gray-500">{countLabel}</p>
            </div>

            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full bg-gray-100 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* LIST */}
          <div className="flex-1 overflow-auto px-2 py-2 space-y-2">
            {items.map(item => (
              <div
                key={item.id}
                className="flex gap-2 rounded-[14px] bg-gray-50 p-2"
              >
                {/* IMAGE */}
                <Link
                  href={item.href}
                  className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-white"
                >
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                      <Package className="h-4 w-4" />
                    </div>
                  )}
                </Link>

                {/* TEXT */}
                <div className="min-w-0 flex-1">
                  <Link
                    href={item.href}
                    className="line-clamp-1 text-[12px] font-bold"
                  >
                    {item.title}
                  </Link>

                  <p className="truncate text-[10px] text-gray-500">
                    {item.typeLabel} • {item.location}
                  </p>

                  <p className="text-[11px] font-bold text-black">
                    {item.priceLabel}
                  </p>
                </div>

                {/* REMOVE */}
                <button
                  onClick={() => onRemove(item.id)}
                  className="text-gray-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* FOOTER */}
          <div className="flex gap-2 border-t p-2">
            <button
              onClick={onClear}
              className="flex-1 rounded-[12px] border py-2 text-[11px] font-bold text-gray-500"
            >
              {isId ? 'Hapus' : 'Clear'}
            </button>

            <Link
              href={firstItem?.href || '/explore'}
              className="flex-1 rounded-[12px] bg-black py-2 text-center text-[11px] font-bold text-white"
            >
              {isId ? 'Lanjut' : 'Continue'}
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
              <p className="mt-0.5 text-lg font-bold text-[color:var(--app-text)]">
                {hasMore && resultCountLabel !== '0'
                  ? `${resultCountLabel}+`
                  : resultCountLabel}
              </p>
            </div>
            <div className="rounded-[16px] bg-[color:var(--app-surface-muted)] px-3 py-2">
              <p className="text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                {isId ? 'Kota' : 'City'}
              </p>
              <p className="mt-0.5 truncate text-sm font-bold text-[color:var(--app-text)]">
                {popularCities[0] || 'Indonesia'}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-emerald-100 bg-[linear-gradient(180deg,#f4fff8_0%,#ffffff_100%)] p-3 shadow-[0_18px_36px_-32px_rgba(22,163,74,0.22)]">
          <p className="text-[0.95rem] font-bold text-[color:var(--app-text)]">
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
            <h2 className="text-[0.95rem] font-bold tracking-[-0.035em] text-[color:var(--app-text)]">
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

export default function SearchPageClient({
  initialCategorySlug,
}: {
  initialCategorySlug?: string;
} = {}) {
  const router = useRouter();
  const { user, authFetch } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = detectLocale(pathname);
  const isId = locale === 'id';
  const handleBack = useAppBack(router, '/home');

  const initialQuery = (searchParams.get('q') || '').trim();
  const initialLocation = (searchParams.get('location') || '').trim();
  const initialBusinessCategory = getBusinessDiscoveryCategoryByCreateSlug(
    searchParams.get('category') || initialCategorySlug,
  );
  const normalizedInitialType = initialBusinessCategory
    ? initialBusinessCategory.searchType
    : normalizeType(searchParams.get('type'));
  const initialSort = normalizeSort(searchParams.get('sort'));
  const initialSideFilter = normalizeSideFilter(searchParams.get('side'));
  const initialNearbyEnabled = searchParams.get('nearby') !== '0';
  const initialFiltersOpen = searchParams.get('filters') === '1';
  const initialUsedOnly = normalizeUsedGoodsFilter(
    searchParams.get('condition'),
    initialQuery,
  );
  const initialType = initialUsedOnly ? 'product' : normalizedInitialType;
  const initialSubcategory = initialBusinessCategory
    ? (searchParams.get('subcategory') || '').trim()
    : '';

  const [queryInput, setQueryInput] = useState(initialQuery);
  const [locationInput, setLocationInput] = useState(initialLocation);
  const [query, setQuery] = useState(initialQuery);
  const [location, setLocation] = useState(initialLocation);
  const [type, setType] = useState<TypeKey>(initialType);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [sideFilter, setSideFilter] = useState<SideFilter>(initialSideFilter);
  const [nearbyEnabled, setNearbyEnabled] = useState(initialNearbyEnabled);
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);
  const [usedOnly, setUsedOnly] = useState(initialUsedOnly);
  const [selectedSearchTab, setSelectedSearchTab] =
    useState<SearchFilterTabKey>(
      () =>
        initialBusinessCategory?.id ||
        resolveActiveBusinessSearchTab({
          query: initialQuery,
          type: initialType,
          usedOnly: initialUsedOnly,
        }),
    );
  const [selectedSubcategory, setSelectedSubcategory] =
    useState(initialSubcategory);
  const [subcategories, setSubcategories] = useState<CreateTaxonomyItem[]>(
    () =>
      initialBusinessCategory
        ? FALLBACK_CREATE_SUBCATEGORIES[initialBusinessCategory.createSlugId] ||
          []
        : [],
  );
  const [resultsView, setResultsView] = useState<SearchResultsView>(
    initialType === 'umkm' ? 'umkm' : 'results',
  );
  const [filtersOpen, setFiltersOpen] = useState(initialFiltersOpen);

  const [items, setItems] = useState<SearchCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const offsetRef = useRef(0);
  const requestSeqRef = useRef(0);
  const appendBusyRef = useRef(false);

  const [umkmStores, setUmkmStores] = useState<UmkmPreviewStore[]>([]);
  const [umkmLoading, setUmkmLoading] = useState(false);
  const [umkmError, setUmkmError] = useState<string | null>(null);
  const [searchCart, setSearchCart] = useState<SearchCartSession>(
    EMPTY_SEARCH_CART_SESSION,
  );
  const [cartOpen, setCartOpen] = useState(false);
  const activeSearchTab = selectedSearchTab;
  const activeTypeLabel = getSearchTabLabel(activeSearchTab, locale);
  const activeBusinessCategory =
    getBusinessDiscoveryCategoryById(activeSearchTab);
  const activeResultCategory =
    activeBusinessCategory && isResultCategoryId(activeBusinessCategory.id)
      ? activeBusinessCategory
      : null;
  const activeCategorySlug = activeResultCategory?.createSlugId || '';
  const {
    viewerLocation,
    locating,
    locationError,
    locationEnabled,
    requestViewerLocation,
    dismissLocationPrompt,
  } = useViewerLocation({
    isId,
    autoRequest: false,
  });
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

  const canToggleUmkmView =
    !activeResultCategory && (type === 'all' || type === 'umkm');
  const shouldShowUmkmPreview = resultsView === 'umkm' || type === 'umkm';
  const shouldShowResultCards = !shouldShowUmkmPreview;
  const nearbyActive = nearbyEnabled && Boolean(viewerLocation);
  const nearbyStatusLabel = nearbyActive
    ? isId
      ? 'Terdekat dari lokasi saya'
      : 'Nearest to me'
    : nearbyEnabled
      ? isId
        ? 'Lokasi belum aktif'
        : 'Location not active yet'
      : isId
        ? 'Urutan biasa'
        : 'Regular order';
  const autoLoadEnabled =
    shouldShowResultCards && !loading && !loadingMore && hasMore && !error;
  const { ref: mobileLoadMoreRef, inView: mobileLoadMoreInView } = useInView({
    rootMargin: '720px 0px',
    threshold: 0,
    skip: !autoLoadEnabled,
  });
  const { ref: desktopLoadMoreRef, inView: desktopLoadMoreInView } = useInView({
    rootMargin: '720px 0px',
    threshold: 0,
    skip: !autoLoadEnabled,
  });

  useEffect(() => {
    const syncCart = () => setSearchCart(readSearchCartSession());
    syncCart();
    return subscribeSearchCartSession(syncCart);
  }, []);

  useEffect(() => {
    if (!activeCategorySlug) {
      setSubcategories([]);
      setSelectedSubcategory('');
      return;
    }

    let cancelled = false;
    const fallback = FALLBACK_CREATE_SUBCATEGORIES[activeCategorySlug] || [];
    setSubcategories(fallback);

    async function loadSubcategories() {
      try {
        const response = await fetch(
          `/api/categories/${encodeURIComponent(activeCategorySlug)}/subcategories`,
          { cache: 'no-store' },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          items?: CreateTaxonomyItem[];
        };
        if (!response.ok || cancelled) return;
        const remoteItems = Array.isArray(payload.items) ? payload.items : [];
        setSubcategories(mergeCreateTaxonomyItems(remoteItems, fallback));
      } catch {
        // The shared fallback keeps category filters usable while taxonomy is unavailable.
      }
    }

    void loadSubcategories();
    return () => {
      cancelled = true;
    };
  }, [activeCategorySlug]);

  const cartQuantities = useMemo(() => {
    return Object.fromEntries(
      searchCart.items.map(item => [item.id, item.quantity]),
    ) as Record<string, number>;
  }, [searchCart.items]);

  const addSearchCardToCart = useCallback(
    (item: SearchCard) => {
      if (item.isPublicReference) return;
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

  const closeLocationPrompt = useCallback(() => {
    dismissLocationPrompt();
    setLocationPromptOpen(false);
  }, [dismissLocationPrompt]);

  const openLocationPrompt = useCallback(() => {
    setLocationPromptOpen(true);
  }, []);

  const enableNearbyLocation = useCallback(async () => {
    const nextLocation = viewerLocation || (await requestViewerLocation());
    if (!nextLocation) return;
    setNearbyEnabled(true);
    setLocationInput('');
    setLocation('');
    setLocationPromptOpen(false);
    setRefreshKey(value => value + 1);
  }, [requestViewerLocation, viewerLocation]);

  const disableNearbyLocation = useCallback(() => {
    setNearbyEnabled(false);
  }, []);

  const skipNearbyLocation = useCallback(() => {
    setNearbyEnabled(false);
    closeLocationPrompt();
  }, [closeLocationPrompt]);

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
    setSelectedSearchTab('all');
    setSelectedSubcategory('');
    setSort('relevance');
    setSideFilter('all');
    setNearbyEnabled(true);
    setUsedOnly(false);
    setResultsView('results');
    setFiltersOpen(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (location) params.set('location', location);
    if (type !== 'all') params.set('type', type);
    if (activeCategorySlug) params.set('category', activeCategorySlug);
    if (activeCategorySlug && selectedSubcategory) {
      params.set('subcategory', selectedSubcategory);
    }
    if (usedOnly) params.set('condition', 'used');
    if (sort !== 'relevance') params.set('sort', sort);
    if (sideFilter !== 'all') params.set('side', sideFilter);
    if (!nearbyEnabled) params.set('nearby', '0');
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }, [
    activeCategorySlug,
    location,
    nearbyEnabled,
    pathname,
    query,
    router,
    sideFilter,
    sort,
    selectedSubcategory,
    type,
    usedOnly,
  ]);

  const loadResults = useCallback(
    async (mode: 'replace' | 'append') => {
      if (type === 'umkm') {
        setItems([]);
        offsetRef.current = 0;
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      if (mode === 'append' && appendBusyRef.current) return;

      const requestSeq =
        mode === 'replace' ? requestSeqRef.current + 1 : requestSeqRef.current;
      if (mode === 'replace') requestSeqRef.current = requestSeq;
      if (mode === 'append') appendBusyRef.current = true;

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
        const requestOffset = mode === 'append' ? offsetRef.current : 0;
        if (effectiveQuery) params.set('q', effectiveQuery);
        if (location) params.set('location', location);
        if (activeCategorySlug) {
          params.set('category', activeCategorySlug);
          params.set('database_only', '1');
          if (selectedSubcategory) {
            params.set('subcategory', selectedSubcategory);
          }
        } else if (type !== 'all') {
          params.set('type', type);
        }
        if (nearbyEnabled && viewerLocation) {
          params.set('nearby', '1');
          params.set('viewer_lat', String(viewerLocation.lat));
          params.set('viewer_lng', String(viewerLocation.lng));
        }
        if (sideFilter !== 'all') params.set('side', sideFilter);
        params.set('status', 'active');
        params.set('include_owner', '1');
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(requestOffset));

        const response = await authFetch(`/api/content?${params.toString()}`, {
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

        const rawItems = extractContentItems(payload);
        const nextItems = rawItems
          .map(item => mapContentItem(item, locale))
          .filter((item): item is SearchCard => Boolean(item));
        const payloadHasMore =
          typeof (payload as { has_more?: unknown }).has_more === 'boolean'
            ? Boolean((payload as { has_more?: unknown }).has_more)
            : typeof (payload as { hasMore?: unknown }).hasMore === 'boolean'
              ? Boolean((payload as { hasMore?: unknown }).hasMore)
              : rawItems.length === PAGE_SIZE;

        if (requestSeq !== requestSeqRef.current) return;

        setItems(prev => {
          if (mode !== 'append') return nextItems;
          const existingIds = new Set(prev.map(item => item.id));
          return [
            ...prev,
            ...nextItems.filter(item => !existingIds.has(item.id)),
          ];
        });
        offsetRef.current = requestOffset + rawItems.length;
        setHasMore(rawItems.length > 0 && payloadHasMore);
      } catch (err) {
        if (requestSeq !== requestSeqRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load results');
        if (mode === 'replace') setItems([]);
      } finally {
        if (mode === 'append') {
          appendBusyRef.current = false;
          setLoadingMore(false);
        } else if (requestSeq === requestSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [
      activeCategorySlug,
      authFetch,
      isId,
      locale,
      location,
      nearbyEnabled,
      query,
      selectedSubcategory,
      sideFilter,
      type,
      usedOnly,
      viewerLocation,
    ],
  );

  useEffect(() => {
    void loadResults('replace');
  }, [loadResults, refreshKey]);

  useEffect(() => {
    if (!autoLoadEnabled) return;
    if (!mobileLoadMoreInView && !desktopLoadMoreInView) return;
    void loadResults('append');
  }, [
    autoLoadEnabled,
    desktopLoadMoreInView,
    loadResults,
    mobileLoadMoreInView,
  ]);

  useEffect(() => {
    if (activeResultCategory || (type !== 'all' && type !== 'umkm')) {
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
        if (nearbyEnabled && viewerLocation) {
          params.set('viewer_lat', String(viewerLocation.lat));
          params.set('viewer_lng', String(viewerLocation.lng));
        }
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
  }, [
    activeResultCategory,
    isId,
    location,
    nearbyEnabled,
    query,
    type,
    viewerLocation,
  ]);

  const categoryFilteredItems = useMemo(() => {
    if (!activeResultCategory) return items;
    return items.filter(item =>
      isBusinessCategoryItem(item, activeResultCategory.id),
    );
  }, [activeResultCategory, items]);

  const visibleItems = useMemo(() => {
    const next = [...categoryFilteredItems]
      .map(item =>
        nearbyEnabled ? withViewerDistance(item, viewerLocation) : item,
      )
      .filter(item => {
        if (sideFilter === 'reference') return item.isPublicReference;
        if (sideFilter === 'supply')
          return !item.isPublicReference && item.side === 'supply';
        if (sideFilter === 'demand')
          return !item.isPublicReference && item.side === 'demand';
        return true;
      });

    if (nearbyActive) {
      next.sort(compareBusinessServiceability);
    } else if (sort === 'newest') {
      next.sort((a, b) => b.updatedAt - a.updatedAt);
    } else if (sort === 'price_low') {
      next.sort(
        (a, b) =>
          (a.priceCents ?? Number.MAX_SAFE_INTEGER) -
          (b.priceCents ?? Number.MAX_SAFE_INTEGER),
      );
    } else if (sort === 'price_high') {
      next.sort((a, b) => (b.priceCents ?? 0) - (a.priceCents ?? 0));
    }

    return next;
  }, [
    categoryFilteredItems,
    nearbyActive,
    nearbyEnabled,
    sideFilter,
    sort,
    viewerLocation,
  ]);

  const searchResultSections = useMemo<SearchResultRail[]>(() => {
    if (sideFilter === 'all') {
      const sideSectionCandidates: SearchResultRail[] = [
        {
          id: 'offers',
          title: isId ? 'Penawaran' : 'Offers',
          subtitle: isId
            ? 'Produk, jasa, alat, tempat, dan peluang.'
            : 'Products, services, tools, places, and opportunities.',
          badge: isId ? 'Tersedia' : 'Available',
          items: visibleItems.filter(
            item => !item.isPublicReference && item.side === 'supply',
          ),
          typeKey: 'all',
        },
        {
          id: 'needs',
          title: isId ? 'Kebutuhan' : 'Needs',
          subtitle: isId
            ? 'Permintaan dari orang atau usaha.'
            : 'Requests from people or businesses.',
          badge: isId ? 'Dicari' : 'Wanted',
          items: visibleItems.filter(
            item => !item.isPublicReference && item.side === 'demand',
          ),
          typeKey: 'all',
        },
        {
          id: 'references',
          title: isId ? 'Referensi publik' : 'Public references',
          subtitle: isId
            ? 'Data sumber terbuka untuk riset awal; bukan penawaran atau verifikasi Lajukan.'
            : 'Open-source data for initial research; not offers or Lajukan verification.',
          badge: isId ? 'Bersumber' : 'Sourced',
          items: visibleItems.filter(item => item.isPublicReference),
          typeKey: 'all',
        },
      ];
      const sideSections = sideSectionCandidates.filter(
        section => section.items.length > 0,
      );

      if (sideSections.length > 0) return sideSections;
    }

    const unfilteredSections: SearchResultRail[] =
      RESULT_BUSINESS_DISCOVERY_CATEGORY_IDS.flatMap(id => {
        const category = getBusinessDiscoveryCategoryById(id);
        if (!category) return [];
        return [
          {
            id,
            title: isId ? category.labelId : category.labelEn,
            subtitle: isId ? category.hintId : category.hintEn,
            badge: isId ? category.badgeId : category.badgeEn,
            items: visibleItems.filter(item =>
              isBusinessCategoryItem(item, id),
            ),
            typeKey: id,
          },
        ];
      });
    const sections = unfilteredSections.filter(
      section => section.items.length > 0,
    );

    if (sections.length > 0 || visibleItems.length === 0) return sections;

    const fallbackSections: SearchResultRail[] = [
      {
        id: 'other',
        title: isId ? 'Hasil Lainnya' : 'Other Results',
        subtitle: isId
          ? 'Hasil lain yang masih cocok.'
          : 'Other matching results.',
        items: visibleItems,
        typeKey: 'all',
      },
    ];
    return fallbackSections;
  }, [isId, sideFilter, visibleItems]);

  const categoryResultSection = useMemo<SearchResultRail | null>(() => {
    if (!activeResultCategory) return null;
    return {
      id: activeResultCategory.id,
      title: isId ? activeResultCategory.labelId : activeResultCategory.labelEn,
      subtitle: isId
        ? activeResultCategory.hintId
        : activeResultCategory.hintEn,
      badge: isId ? activeResultCategory.badgeId : activeResultCategory.badgeEn,
      items: visibleItems,
      typeKey: activeResultCategory.id,
    };
  }, [activeResultCategory, isId, visibleItems]);
  const selectedSubcategoryLabel = selectedSubcategory
    ? getSubcategoryLabel(
        subcategories.find(item => item.slug === selectedSubcategory) || {
          id: selectedSubcategory,
          slug: selectedSubcategory,
        },
        locale,
      )
    : '';

  const resultCountLabel = new Intl.NumberFormat(
    isId ? 'id-ID' : 'en-US',
  ).format(visibleItems.length);
  const canShowApproximateCount = hasMore && visibleItems.length > 0;
  const resultCountDisplayLabel = canShowApproximateCount
    ? `${resultCountLabel}+`
    : resultCountLabel;
  const selectedLocationLabel =
    location || locationInput || (isId ? 'Semua lokasi' : 'All locations');
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
      all: categoryFilteredItems.length,
      supply: categoryFilteredItems.filter(
        item => !item.isPublicReference && item.side === 'supply',
      ).length,
      demand: categoryFilteredItems.filter(
        item => !item.isPublicReference && item.side === 'demand',
      ).length,
      reference: categoryFilteredItems.filter(item => item.isPublicReference)
        .length,
    }),
    [categoryFilteredItems],
  );
  const sideFilterOptions: Array<{
    value: SideFilter;
    label: string;
    count: number;
  }> = [
    {
      value: 'all',
      label: isId ? 'Semua' : 'All',
      count: sideCounts.all,
    },
    {
      value: 'supply',
      label: isId ? 'Penawaran' : 'Offers',
      count: sideCounts.supply,
    },
    {
      value: 'demand',
      label: isId ? 'Kebutuhan' : 'Needs',
      count: sideCounts.demand,
    },
    {
      value: 'reference',
      label: isId ? 'Referensi' : 'References',
      count: sideCounts.reference,
    },
  ];
  const activeFilterCount =
    Number(Boolean(query)) +
    Number(Boolean(location)) +
    Number(nearbyActive) +
    Number(Boolean(activeResultCategory) || type !== 'all') +
    Number(Boolean(selectedSubcategory)) +
    Number(usedOnly) +
    Number(sort !== 'relevance') +
    Number(sideFilter !== 'all');
  const canReset = activeFilterCount > 0;
  const resultsHeading = query
    ? isId
      ? `Hasil pencarian "${query}"`
      : `Search results for "${query}"`
    : activeResultCategory
      ? isId
        ? activeResultCategory.labelId
        : activeResultCategory.labelEn
      : isId
        ? 'Cari penawaran, kebutuhan, atau referensi'
        : 'Find offers, needs, or references';
  const resultsSubheading =
    loading && visibleItems.length === 0
      ? isId
        ? 'Memuat hasil...'
        : 'Loading results...'
      : isId
        ? `${sideCounts.supply} penawaran · ${sideCounts.demand} kebutuhan · ${sideCounts.reference} referensi`
        : `${sideCounts.supply} offers · ${sideCounts.demand} needs · ${sideCounts.reference} references`;
  const activeSortLabel =
    SORT_OPTIONS.find(option => option.value === sort)?.[
      isId ? 'labelId' : 'labelEn'
    ] || (isId ? 'Paling relevan' : 'Most relevant');
  const displaySortLabel = nearbyActive ? nearbyStatusLabel : activeSortLabel;
  const topResult = visibleItems[0];
  const usedGoodsSellHref = `${resolveMarketplaceCreateHref(locale, 'product', 'supply')}?condition=used&q=${encodeURIComponent(isId ? 'barang bekas' : 'used goods')}`;
  const activeCreateSide: ListingSide =
    sideFilter === 'supply' ? 'supply' : 'demand';
  const createType = type === 'all' || type === 'umkm' ? 'product' : type;
  const briefCreateHref = usedOnly
    ? usedGoodsSellHref
    : activeBusinessCategory
      ? buildBusinessDiscoveryCreateHref({
          locale,
          side: activeCreateSide,
          category: activeBusinessCategory,
        })
      : sideFilter === 'supply'
        ? resolveMarketplaceCreateHref(locale, createType, 'supply')
        : resolveUmkmCreateHrefForType(locale, type);
  const briefCreateLabel = usedOnly
    ? isId
      ? 'Tawarkan barang bekas'
      : 'Sell used goods'
    : sideFilter === 'supply'
      ? isId
        ? 'Tawarkan sesuatu'
        : 'Create an offer'
      : activeBusinessCategory
        ? isId
          ? `${activeCreateSide === 'supply' ? 'Tawarkan' : 'Buat kebutuhan'} ${activeBusinessCategory.labelId}`
          : activeCreateSide === 'supply'
            ? `Create ${activeBusinessCategory.labelEn.toLowerCase()} offer`
            : `Post ${activeBusinessCategory.labelEn.toLowerCase()} need`
        : isId
          ? type === 'service'
            ? 'Buat kebutuhan jasa'
            : type === 'business_transfer'
              ? 'Tawarkan usaha'
              : type === 'freelancer' || type === 'job'
                ? 'Cari talent'
                : 'Buat kebutuhan'
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
    setNearbyEnabled(false);
  };

  const selectSubcategory = useCallback((slug: string) => {
    setSelectedSubcategory(slug);
    setResultsView('results');
  }, []);

  const selectSearchTab = useCallback(
    (nextTab: SearchFilterTabKey) => {
      setSelectedSearchTab(nextTab);
      setSelectedSubcategory('');

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

      const category = getBusinessDiscoveryCategoryById(nextTab);
      if (category) {
        const nextType =
          category.searchType === 'umkm' ? 'umkm' : category.searchType;
        setUsedOnly(false);
        setType(nextType);
        setSideFilter('all');
        setResultsView(category.searchType === 'umkm' ? 'umkm' : 'results');
        return;
      }

      setUsedOnly(false);
      setType(nextTab as TypeKey);
      if (nextTab === 'umkm') {
        setResultsView('umkm');
      } else {
        setResultsView('results');
      }
    },
    [locale, queryInput],
  );

  return (
    <div className="lajukan-home-compact lajukan-market-page lajukan-market-search lajukan-search-compact min-h-screen min-h-[100svh] w-full max-w-full overflow-x-hidden px-1 pb-6 pt-0 sm:px-2 lg:h-[calc(var(--app-viewport-height)-(60px+env(safe-area-inset-top)))] lg:min-h-0 lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0">
      <div className="lajukan-home-shell lajukan-search-shell mx-auto h-full w-full max-w-full overflow-x-hidden lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
        <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden lg:hidden">
          <div className="ui-layer-local-topbar fixed inset-x-0 top-0 z-[80] flex items-center gap-2 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)] px-2 pb-1.5 pt-[calc(env(safe-area-inset-top)+0.35rem)] shadow-[0_12px_26px_-24px_rgba(15,23,42,0.26)]  sm:px-3">
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
                  onChange={event => setQueryInput(event.target.value)}
                  placeholder={
                    isId
                      ? 'Cari penawaran atau kebutuhan...'
                      : 'Search offers or needs...'
                  }
                  className="ui-navbar-search-input"
                />
              </label>
            </form>
            <AuthCtaLink
              hrefWhenAuth={briefCreateHref}
              hrefWhenGuest="/register"
              className="ui-pressable inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-white shadow-[0_14px_28px_-20px_rgba(22,163,74,0.55)]"
              ariaLabel={briefCreateLabel}
            >
              <Plus className="h-4.5 w-4.5" />
            </AuthCtaLink>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className={cn(
                'ui-pressable relative inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full border text-[color:var(--app-text)] shadow-[0_12px_24px_-22px_rgba(15,23,42,0.18)]',
                activeFilterCount > 0
                  ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                  : 'border-[color:var(--app-border)] bg-white',
              )}
              data-testid="search-mobile-filter-button"
              aria-label={isId ? 'Filter pencarian' : 'Search filters'}
            >
              <Filter className="h-4.5 w-4.5" />
              {activeFilterCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-1 text-[9px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>
          <div
            aria-hidden="true"
            className="h-[calc(3.55rem+env(safe-area-inset-top))]"
          />

          <section className="min-w-0 max-w-full overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-white p-3 shadow-[0_18px_42px_-36px_rgba(15,23,42,0.12)]">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-[1.12rem] font-bold tracking-[-0.025em] text-[color:var(--app-text)]">
                    {query || resultsHeading}
                  </h1>
                  <p className="mt-0.5 text-[12px] font-semibold text-[color:var(--app-text-soft)]">
                    {resultsSubheading} / {displaySortLabel}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-[16px] bg-[color:var(--app-surface-muted)] px-3 py-2.5">
                <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-[color:var(--app-text)]">
                    {nearbyActive ? nearbyStatusLabel : selectedLocationLabel}
                  </p>
                  {nearbyActive ? (
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                      <BadgeCheck className="h-3 w-3" />
                      {isId ? 'Filter jarak aktif' : 'Distance filter active'}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={
                    viewerLocation || locationEnabled
                      ? enableNearbyLocation
                      : openLocationPrompt
                  }
                  className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 text-[11px] font-semibold text-emerald-700"
                >
                  <Target className="h-4 w-4" />
                  {locating
                    ? isId
                      ? 'Mencari...'
                      : 'Locating...'
                    : isId
                      ? 'Lokasi saya'
                      : 'My location'}
                </button>
              </div>

              <div
                ref={mobileActionsRailRef}
                onClickCapture={onMobileActionsClickCapture}
                onPointerCancel={onMobileActionsPointerCancel}
                onPointerDown={onMobileActionsPointerDown}
                onPointerLeave={onMobileActionsPointerLeave}
                onPointerMove={onMobileActionsPointerMove}
                onPointerUp={onMobileActionsPointerUp}
                onWheel={onMobileActionsWheel}
                className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 no-scrollbar select-none cursor-grab active:cursor-grabbing"
              >
                {SEARCH_FILTER_TABS.map(option => {
                  const active = activeSearchTab === option.value;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => selectSearchTab(option.value)}
                      className={cn(
                        'inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-[14px] border px-3 text-[12px] font-semibold transition',
                        active
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{isId ? option.labelId : option.labelEn}</span>
                    </button>
                  );
                })}
              </div>

              <div
                className="grid grid-cols-4 gap-1 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-1"
                aria-label={isId ? 'Mode hasil' : 'Result mode'}
              >
                {sideFilterOptions.map(option => {
                  const active = sideFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSideFilter(option.value)}
                      className={cn(
                        'inline-flex min-h-[38px] min-w-0 flex-col items-center justify-center rounded-[12px] px-1.5 text-[11px] font-bold transition',
                        active
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-[color:var(--app-text-soft)]',
                      )}
                    >
                      <span className="max-w-full truncate">
                        {option.label}
                      </span>
                      <span
                        className={cn(
                          'mt-0.5 text-[10px]',
                          active ? 'text-emerald-700' : 'text-slate-400',
                        )}
                      >
                        {option.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeResultCategory ? (
                <SearchSubcategoryFilter
                  items={subcategories}
                  locale={locale}
                  selected={selectedSubcategory}
                  onSelect={selectSubcategory}
                  layout="rail"
                />
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
              <SearchResultSkeleton count={4} />
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
              <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[radial-gradient(circle_at_top,#ecfdf5_0%,#ffffff_46%,#f8fafc_100%)] px-5 py-8 text-center shadow-[0_20px_42px_-30px_rgba(15,23,42,0.18)]">
                <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-[20px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <Search className="h-5 w-5" />
                </span>
                <p className="mt-3 text-[17px] font-bold tracking-[-0.035em] text-[color:var(--app-text)]">
                  {isId ? 'Belum ketemu yang pas' : 'No good match yet'}
                </p>
                <p className="mx-auto mt-1 max-w-[26rem] text-[13px] leading-5 text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Ganti kata kunci, pilih kategori lain, atau buat kebutuhan.'
                    : 'Try another keyword, pick a category, or post a need.'}
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
            ) : categoryResultSection ? (
              <SearchResultVerticalList
                section={categoryResultSection}
                locale={locale}
                cartQuantities={cartQuantities}
                onAddToCart={addSearchCardToCart}
                onRemoveFromCart={removeSearchItemFromCart}
                onOpenCart={() => setCartOpen(true)}
                authFetch={authFetch}
                userSignedIn={Boolean(user)}
                hasMore={hasMore}
              />
            ) : (
              <SearchResultRails
                sections={searchResultSections}
                locale={locale}
                cartQuantities={cartQuantities}
                onAddToCart={addSearchCardToCart}
                onRemoveFromCart={removeSearchItemFromCart}
                onOpenCart={() => setCartOpen(true)}
                onViewAll={selectSearchTab}
                authFetch={authFetch}
                userSignedIn={Boolean(user)}
              />
            )
          ) : null}

          {visibleItems.length > 0 && shouldShowResultCards && !loading ? (
            <div
              ref={mobileLoadMoreRef}
              className="h-2 w-full"
              aria-hidden="true"
            />
          ) : null}

          {visibleItems.length > 0 && shouldShowResultCards && !loading ? (
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="text-[13px] text-[color:var(--app-text-soft)]">
                {isId
                  ? `Menampilkan 1 - ${visibleItems.length} dari ${resultCountDisplayLabel} hasil`
                  : `Showing 1 - ${visibleItems.length} of ${resultCountDisplayLabel} results`}
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

        <div className="lajukan-home-desktop-shell lajukan-search-desktop-shell hidden min-h-0 w-full max-w-full overflow-hidden lg:flex lg:flex-1 lg:flex-col">
          <div className="lajukan-home-desktop-grid lajukan-search-desktop-grid relative z-0 mx-auto grid min-h-0 w-full max-w-[2000px] flex-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_260px] 2xl:grid-cols-[280px_minmax(0,1fr)_280px]">
            <aside className="hidden lg:block lg:h-full lg:min-h-0 lg:overflow-hidden">
              <div
                className="flex h-full max-h-full min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pb-6 pr-1"
                data-auto-scrollbar
              >
                <section className="rounded-[24px] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[1rem] font-bold tracking-[-0.03em] text-[color:var(--app-text)]">
                        {isId ? 'Filter' : 'Filters'}
                      </p>
                      <p className="text-[12px] text-[color:var(--app-text-soft)]">
                        {activeFilterCount > 0
                          ? `${activeFilterCount} ${isId ? 'filter aktif' : 'active filters'}`
                          : isId
                            ? 'Kategori, mode, lokasi'
                            : 'Category, mode, location'}
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
                    <div className="rounded-[20px] border border-[color:var(--app-border)] bg-white p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                          <MapPin className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="text-[14px] font-bold text-[color:var(--app-text)]">
                            {isId ? 'Di Sekitarmu' : 'Nearby'}
                          </h3>

                          <p className="mt-1 text-[12px] text-[color:var(--app-text-soft)]">
                            {isId
                              ? 'Hasil dekat lokasimu.'
                              : 'Results near you.'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={
                          viewerLocation || locationEnabled
                            ? enableNearbyLocation
                            : openLocationPrompt
                        }
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <Target className="h-4 w-4" />
                        {locating
                          ? isId
                            ? 'Mencari lokasi...'
                            : 'Finding location...'
                          : nearbyActive
                            ? nearbyStatusLabel
                            : isId
                              ? 'Gunakan Lokasi Saya'
                              : 'Use My Location'}
                      </button>

                      <label className="mt-3 flex min-w-0 items-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2">
                        <Search className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />

                        <input
                          value={locationInput}
                          onChange={event => {
                            setLocationInput(event.target.value);
                            if (nearbyEnabled) setNearbyEnabled(false);
                          }}
                          placeholder={isId ? 'Cari kota...' : 'Search city...'}
                          className="min-h-[34px] w-full bg-transparent text-[13px] outline-none placeholder:text-[color:var(--app-text-soft)]"
                        />
                      </label>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {popularCities.map(city => (
                          <button
                            key={city}
                            type="button"
                            onClick={() => applyCity(city)}
                            className={cn(
                              'rounded-full px-3 py-1.5 text-[11px] font-semibold transition',
                              location === city || locationInput === city
                                ? 'bg-emerald-600 text-white'
                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
                            )}
                          >
                            {city}
                          </button>
                        ))}
                      </div>
                    </div>

                    {activeResultCategory ? (
                      <SearchSubcategoryFilter
                        items={subcategories}
                        locale={locale}
                        selected={selectedSubcategory}
                        onSelect={selectSubcategory}
                        layout="stack"
                      />
                    ) : null}

                    <div>
                      <div className="mb-3">
                        <h3 className="text-[14px] font-bold text-[color:var(--app-text)]">
                          {isId ? 'Kategori' : 'Categories'}
                        </h3>
                      </div>

                      <div className="grid gap-2">
                        {SEARCH_FILTER_TABS.map(option => {
                          const visual = getCategoryVisual(
                            searchTabVisualKey(option.value),
                          );
                          const active = activeSearchTab === option.value;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => selectSearchTab(option.value)}
                              className={cn(
                                'group flex min-h-[58px] items-center gap-3 rounded-[16px] border px-3 py-2.5 text-left transition-all',
                                active
                                  ? 'border-emerald-200 bg-emerald-50 shadow-sm'
                                  : 'border-[color:var(--app-border)] bg-white hover:border-emerald-100 hover:bg-emerald-50/40',
                              )}
                            >
                              <div
                                className={cn(
                                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]',
                                  active
                                    ? 'bg-emerald-600 text-white'
                                    : visual.iconBubbleClass,
                                )}
                              >
                                <option.icon className="h-5 w-5" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-bold">
                                  {isId ? option.labelId : option.labelEn}
                                </div>

                                <div className="mt-0.5 line-clamp-1 text-[11px] text-[color:var(--app-text-soft)]">
                                  {getSearchTabHint(option.value, locale)}
                                </div>
                              </div>

                              <div>
                                {active ? (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
                                    <BadgeCheck className="h-4 w-4" />
                                  </div>
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="mb-3">
                        <h3 className="text-[14px] font-bold text-[color:var(--app-text)]">
                          {isId ? 'Mode hasil' : 'Result mode'}
                        </h3>
                      </div>

                      <div className="grid gap-2">
                        <SearchResultScopeCard
                          value="all"
                          label={isId ? 'Semua' : 'All'}
                          hint={isId ? 'Semua hasil' : 'All results'}
                          count={sideCounts.all}
                          active={sideFilter === 'all'}
                          onSelect={setSideFilter}
                        />

                        <SearchResultScopeCard
                          value="supply"
                          label={isId ? 'Penawaran' : 'Offers'}
                          hint={isId ? 'Yang tersedia' : 'Available'}
                          count={sideCounts.supply}
                          active={sideFilter === 'supply'}
                          onSelect={setSideFilter}
                        />

                        <SearchResultScopeCard
                          value="demand"
                          label={isId ? 'Kebutuhan' : 'Needs'}
                          hint={isId ? 'Yang sedang dicari' : 'Wanted'}
                          count={sideCounts.demand}
                          active={sideFilter === 'demand'}
                          onSelect={setSideFilter}
                        />

                        <SearchResultScopeCard
                          value="reference"
                          label={isId ? 'Referensi' : 'References'}
                          hint={
                            isId ? 'Data sumber terbuka' : 'Open-source data'
                          }
                          count={sideCounts.reference}
                          active={sideFilter === 'reference'}
                          onSelect={setSideFilter}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
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
              className="min-h-0 min-w-0 max-w-full overflow-x-hidden overflow-y-auto pr-1 pt-2 overscroll-contain"
              data-auto-scrollbar
            >
              <div className="min-w-0 max-w-full space-y-3 overflow-x-hidden pb-5">
                <section className="rounded-[22px] border border-[color:var(--app-border)] bg-white/96 p-3 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.13)] ">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h1 className="text-[1.2rem] font-bold text-[color:var(--app-text)]">
                        {resultsHeading}
                      </h1>
                      <p className="mt-0.5 text-[13px] text-[color:var(--app-text-soft)]">
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
                        {displaySortLabel}
                      </button>
                    </div>
                  </div>

                  <SearchFilterTabs
                    locale={locale}
                    activeTab={activeSearchTab}
                    onSelect={selectSearchTab}
                    className="mt-2"
                  />

                  <div
                    className="mt-2 grid max-w-[680px] grid-cols-4 gap-1 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-1"
                    aria-label={isId ? 'Mode hasil' : 'Result mode'}
                  >
                    {sideFilterOptions.map(option => {
                      const active = sideFilter === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSideFilter(option.value)}
                          className={cn(
                            'inline-flex min-h-[40px] min-w-0 items-center justify-center gap-2 rounded-[12px] px-2 text-[12px] font-bold transition',
                            active
                              ? 'bg-white text-emerald-700 shadow-sm'
                              : 'text-[color:var(--app-text-soft)] hover:bg-white/70',
                          )}
                        >
                          <span className="truncate">{option.label}</span>
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.5 text-[10px]',
                              active
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-white text-slate-500',
                            )}
                          >
                            {option.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
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
                    {nearbyActive ? (
                      <SearchActiveChip
                        icon={Target}
                        label={nearbyStatusLabel}
                        onRemove={disableNearbyLocation}
                      />
                    ) : null}
                    {usedOnly ? (
                      <SearchActiveChip
                        icon={Package}
                        label={isId ? 'Barang Bekas' : 'Used Goods'}
                        onRemove={() => {
                          setUsedOnly(false);
                          setSelectedSearchTab('all');
                        }}
                      />
                    ) : null}
                    {type !== 'all' && !usedOnly ? (
                      <SearchActiveChip
                        icon={getSearchTabConfig(activeSearchTab)?.icon}
                        label={activeTypeLabel}
                        typeKey={searchTabVisualKey(activeSearchTab)}
                        onRemove={() => {
                          setType('all');
                          setSelectedSearchTab('all');
                          setSelectedSubcategory('');
                        }}
                      />
                    ) : null}
                    {selectedSubcategory ? (
                      <SearchActiveChip
                        label={selectedSubcategoryLabel}
                        typeKey={searchTabVisualKey(activeSearchTab)}
                        onRemove={() => setSelectedSubcategory('')}
                      />
                    ) : null}
                    {sideFilter !== 'all' ? (
                      <SearchActiveChip
                        label={
                          sideFilter === 'demand'
                            ? isId
                              ? 'Kebutuhan'
                              : 'Needs'
                            : sideFilter === 'reference'
                              ? isId
                                ? 'Referensi'
                                : 'References'
                              : isId
                                ? 'Penawaran'
                                : 'Offers'
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
                    <SearchResultSkeleton count={5} />
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
                    <div className="rounded-[30px] border border-[color:var(--app-border)] bg-[radial-gradient(circle_at_top,#ecfdf5_0%,#ffffff_44%,#f8fafc_100%)] px-6 py-11 text-center shadow-[0_22px_48px_-32px_rgba(15,23,42,0.18)]">
                      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-[22px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                        <Search className="h-6 w-6" />
                      </span>
                      <p className="mt-3 text-[20px] font-bold tracking-[-0.045em] text-[color:var(--app-text)]">
                        {isId ? 'Belum ketemu yang pas' : 'No good match yet'}
                      </p>
                      <p className="mx-auto mt-1 max-w-[34rem] text-[14px] leading-6 text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Ganti kata kunci, pilih kategori lain, atau buat kebutuhan.'
                          : 'Try another keyword, pick a category, or post a need.'}
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
                  ) : categoryResultSection ? (
                    <SearchResultVerticalList
                      section={categoryResultSection}
                      locale={locale}
                      cartQuantities={cartQuantities}
                      onAddToCart={addSearchCardToCart}
                      onRemoveFromCart={removeSearchItemFromCart}
                      onOpenCart={() => setCartOpen(true)}
                      authFetch={authFetch}
                      userSignedIn={Boolean(user)}
                      hasMore={hasMore}
                    />
                  ) : (
                    <SearchResultRails
                      sections={searchResultSections}
                      locale={locale}
                      cartQuantities={cartQuantities}
                      onAddToCart={addSearchCardToCart}
                      onRemoveFromCart={removeSearchItemFromCart}
                      onOpenCart={() => setCartOpen(true)}
                      onViewAll={selectSearchTab}
                      authFetch={authFetch}
                      userSignedIn={Boolean(user)}
                    />
                  )
                ) : null}

                {visibleItems.length > 0 &&
                shouldShowResultCards &&
                !loading ? (
                  <div
                    ref={desktopLoadMoreRef}
                    className="h-2 w-full"
                    aria-hidden="true"
                  />
                ) : null}

                {visibleItems.length > 0 &&
                shouldShowResultCards &&
                !loading ? (
                  <div className="flex items-center justify-between gap-3 px-1">
                    <p className="text-[13px] text-[color:var(--app-text-soft)]">
                      {isId
                        ? `Menampilkan 1 - ${visibleItems.length} dari ${resultCountDisplayLabel} hasil`
                        : `Showing 1 - ${visibleItems.length} of ${resultCountDisplayLabel} results`}
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
              hasMore={canShowApproximateCount}
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
        open={locationPromptOpen}
        title={isId ? 'Gunakan lokasi terdekat?' : 'Use nearby location?'}
        onClose={closeLocationPrompt}
        className="max-w-none rounded-[24px] rounded-b-none p-4 sm:max-w-md sm:rounded-[28px] sm:p-5"
        footer={
          <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={skipNearbyLocation}
              className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white px-4 text-[13px] font-semibold text-[color:var(--app-text)]"
            >
              {isId ? 'Nanti saja' : 'Maybe later'}
            </button>
            <button
              type="button"
              onClick={enableNearbyLocation}
              disabled={locating}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-5 text-[13px] font-bold text-white shadow-[0_18px_34px_-22px_color-mix(in_srgb,var(--app-accent)_52%,transparent)] disabled:opacity-70"
            >
              <Target className="h-4 w-4" />
              {locating
                ? isId
                  ? 'Mencari lokasi...'
                  : 'Finding location...'
                : isId
                  ? 'Aktifkan lokasi'
                  : 'Enable location'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/70 p-4 text-emerald-900">
            <p className="text-sm font-bold">
              {isId
                ? 'Lajukan akan mengurutkan hasil dari yang paling dekat dengan posisimu.'
                : 'Lajukan will sort results from the closest to your position.'}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-emerald-800/80">
              {isId
                ? 'Koordinat hanya dipakai untuk menghitung jarak dan tidak ditaruh di URL pencarian.'
                : 'Coordinates are only used to calculate distance and are not placed in the search URL.'}
            </p>
          </div>
          {locationError ? (
            <p className="rounded-[16px] border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
              {locationError}
            </p>
          ) : null}
        </div>
      </Modal>

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
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
              {isId ? 'Kategori' : 'Categories'}
            </p>
            <SearchFilterTabs
              locale={locale}
              activeTab={activeSearchTab}
              onSelect={selectSearchTab}
              className="mt-2"
            />
          </div>

          {activeResultCategory ? (
            <SearchSubcategoryFilter
              items={subcategories}
              locale={locale}
              selected={selectedSubcategory}
              onSelect={selectSubcategory}
              layout="wrap"
            />
          ) : null}

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
              {isId ? 'Lokasi' : 'Location'}
            </p>
            <label className="mt-2 flex min-w-0 items-center gap-2 rounded-[16px] border border-[color:var(--app-border)] bg-white px-3 py-2">
              <MapPin className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
              <input
                value={locationInput}
                onChange={event => {
                  setLocationInput(event.target.value);
                  if (nearbyEnabled) setNearbyEnabled(false);
                }}
                placeholder={isId ? 'Cari lokasi' : 'Search location'}
                className="min-h-[34px] w-full min-w-0 bg-transparent text-[13px] text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
              />
            </label>
            <div className="mt-3 grid gap-2 rounded-[18px] border border-emerald-100 bg-emerald-50/60 p-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[12px] font-bold text-emerald-800">
                  <Target className="h-4 w-4 shrink-0" />
                  {nearbyStatusLabel}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-emerald-700/80">
                  {isId
                    ? 'Urutkan dari yang terdekat.'
                    : 'Sort by nearest first.'}
                </p>
                {locationError ? (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600">
                    {locationError}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                {nearbyActive ? (
                  <button
                    type="button"
                    onClick={disableNearbyLocation}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-emerald-200 bg-white px-3 text-[12px] font-semibold text-emerald-700"
                  >
                    {isId ? 'Matikan' : 'Disable'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={enableNearbyLocation}
                  disabled={locating}
                  className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 px-3 text-[12px] font-bold text-white disabled:opacity-70 sm:flex-none"
                >
                  {nearbyActive ? (
                    <BadgeCheck className="h-4 w-4" />
                  ) : (
                    <Target className="h-4 w-4" />
                  )}
                  {locating
                    ? isId
                      ? 'Mencari...'
                      : 'Locating...'
                    : nearbyActive
                      ? isId
                        ? 'Aktif'
                        : 'Active'
                      : isId
                        ? 'Pakai lokasi saya'
                        : 'Use my location'}
                </button>
              </div>
            </div>
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
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
              {isId ? 'Mode' : 'Mode'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sideFilterOptions.map(option => {
                const active = sideFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSideFilter(option.value)}
                    className={cn(
                      'inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3 text-[12px] font-bold transition',
                      active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)]',
                    )}
                  >
                    <span>{option.label}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px]',
                        active
                          ? 'bg-white text-emerald-700'
                          : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
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
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
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
