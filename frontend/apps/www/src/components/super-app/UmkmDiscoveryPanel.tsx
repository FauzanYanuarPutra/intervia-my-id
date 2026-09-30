'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  ExternalLink,
  FileCheck2,
  Flag,
  List,
  MapPin,
  MapPinned,
  MessageCircle,
  Navigation,
  Phone,
  ShieldCheck,
  ShieldQuestion,
  Store,
  X,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  buildUmkmMapPlacePath,
  getUmkmMapSourceKind,
  getUmkmMapSourceLabel,
  isUmkmMapPublicReference,
} from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';
import {
  MapQuickControls,
  PlaceThumb,
  RatingStars,
} from '@/components/super-app/UmkmPlacesChromePrimitives';
import {
  buildUmkmPlacePresentation,
  formatUmkmPlaceDistance,
} from '@/lib/super-app/umkm-place-ui';
import { matchesUmkmDiscoveryCategory } from '@/lib/super-app/umkm-discovery-category';
import { mergeDeepLinkedUmkmStore } from '@/lib/super-app/umkm-public-discovery';
import { isCoordinateValid } from '@/lib/super-app/location-guard';
import {
  getNextUmkmMapTheme,
  getUmkmMapThemeLabel,
  UmkmStoreMap,
  type UmkmMapBounds,
  type UmkmMapRouteSummary,
  type UmkmMapStore,
  type UmkmMapTheme,
} from './UmkmStoreMap';
import { useViewerLocation } from './useViewerLocation';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { Skeleton, SkeletonStack } from '@/components/ui/Skeleton';
import { EmblaInlineRail } from '@/components/common/EmblaInlineRail';

type UmkmDiscoveryPanelProps = {
  isId: boolean;
  query?: string;
  city?: string;
  category?: string;
  limit?: number;
  title?: string;
  description?: string;
  selectedSlug?: string;
  selectedStoreIdInitial?: string;
  initialMapOnly?: boolean;
  openMapSignal?: number;
  variant?: 'section' | 'immersive';
  initialStores?: DiscoveryStore[];
  initialCount?: number;
};

export type DiscoveryStore = UmkmMapStore & {
  description: string | null;
  phone: string | null;
  offline_order_enabled?: boolean;
  online_order_enabled?: boolean;
  table_count?: number;
  available_table_count?: number;
  max_table_capacity?: number;
  reservation_enabled?: boolean;
  metadata?: Record<string, unknown>;
  products?: Array<{
    id: string;
    name: string;
    description?: string | null;
    category?: string | null;
    price_cents: number;
    image_url?: string | null;
    is_available: boolean;
  }>;
};

type MapPointResponse = {
  data?: {
    items?: Array<{
      id: string;
      slug: string;
      name: string;
      city: string;
      lat: number;
      lng: number;
      category: string;
      source_kind: string;
      metadata?: Record<string, unknown>;
    }>;
  };
  error?: string;
};

type StoresResponse = {
  data?: {
    items: DiscoveryStore[];
    count: number;
    loaded_count?: number;
    has_more?: boolean;
    next_offset?: number | null;
    reference_has_more?: boolean;
    next_cursor?: string | null;
    stores_backend_degraded?: boolean;
  };
  error?: string;
};

const LIST_PAGE_SIZE = 10;
const REPORT_EMAIL = 'support@lajukan.com';

function formatDiscoveryPrice(valueCents: number, isId: boolean): string {
  const value = Math.max(0, Math.round(valueCents / 100));
  return new Intl.NumberFormat(isId ? 'id-ID' : 'en-US', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}
function publicBusinessMetaText(store: DiscoveryStore, ...keys: string[]): string {
  const metadata = store.metadata || {};
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return '';
}

function publicBusinessHours(store: DiscoveryStore): string {
  const direct = publicBusinessMetaText(store, 'open_hours', 'opening_hours', 'hours', 'schedule');
  if (direct) return direct;
  const value = store.metadata?.business_hours;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const labels: Record<string, string> = {
    monday: 'Sen', tuesday: 'Sel', wednesday: 'Rab', thursday: 'Kam',
    friday: 'Jum', saturday: 'Sab', sunday: 'Min',
  };
  return Object.entries(value as Record<string, unknown>)
    .map(([day, raw]) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
      const row = raw as Record<string, unknown>;
      const closed = row.closed === true || row.is_open === false;
      if (closed) return `${labels[day.toLowerCase()] || day}: Tutup`;
      const open = typeof row.open === 'string' ? row.open : typeof row.open_at === 'string' ? row.open_at : '';
      const close = typeof row.close === 'string' ? row.close : typeof row.close_at === 'string' ? row.close_at : '';
      return open && close ? `${labels[day.toLowerCase()] || day}: ${open}–${close}` : '';
    })
    .filter(Boolean)
    .join(' · ');
}

type DiscoveryScope = 'all' | 'registered' | 'references';

function readDiscoveryScope(value: string | null): DiscoveryScope {
  if (value === 'registered' || value === 'references') return value;
  return 'all';
}

type UmkmTrustTier =
  | 'unverified'
  | 'wa_active'
  | 'location_checked'
  | 'document_checked'
  | 'lajukan_verified';

type UmkmTrustProfile = {
  tier: UmkmTrustTier;
  label: string;
  description: string;
  chipClassName: string;
};

type UmkmRiskProfile = {
  highRisk: boolean;
  label: string;
  description: string;
};

export type UmkmPublicReferenceProvenance = {
  sourceTitle: string;
  sourceLicense: string;
  sourceUrl: string | null;
  sourceLicenseUrl: string | null;
};

function getOpenStatusProfile(
  openNow: boolean | null,
  isId: boolean,
  isPublicReference = false,
): {
  label: string;
  dotClassName: string;
  textClassName: string;
} {
  if (isPublicReference) {
    return {
      label: isId ? 'Referensi publik' : 'Public reference',
      dotClassName: 'bg-blue-400',
      textClassName: 'text-blue-700 dark:text-blue-300',
    };
  }
  if (openNow === true) {
    return {
      label: isId ? 'Buka sekarang' : 'Open now',
      dotClassName: 'bg-emerald-500',
      textClassName: 'text-emerald-700 dark:text-emerald-300',
    };
  }
  if (openNow === false) {
    return {
      label: isId ? 'Tutup' : 'Closed',
      dotClassName: 'bg-slate-400',
      textClassName: 'text-slate-600 dark:text-slate-300',
    };
  }
  return {
    label: isId ? 'Jam buka belum diisi' : 'Hours not listed',
    dotClassName: 'bg-amber-400',
    textClassName: 'text-amber-700 dark:text-amber-300',
  };
}

function getPlaceLocationLabel(
  place: {
    store: Pick<DiscoveryStore, 'city'>;
    ui: ReturnType<typeof buildUmkmPlacePresentation>;
  },
  isId: boolean,
) {
  return (
    place.ui.distanceLabel ||
    place.store.city ||
    place.ui.addressLine ||
    (isId ? 'Lokasi belum lengkap' : 'Location unavailable')
  );
}

function readMetaText(
  metadata: Record<string, unknown> | null | undefined,
  ...keys: string[]
) {
  if (!metadata) return '';
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function readMetaBoolean(
  metadata: Record<string, unknown> | null | undefined,
  ...keys: string[]
) {
  if (!metadata) return false;
  return keys.some(key => {
    const value = metadata[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return /^(1|true|yes|checked|verified|approved)$/i.test(value.trim());
    }
    return value === 1;
  });
}

function readSafeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > 2048) return null;
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    return raw;
  } catch {
    return null;
  }
}

export function getUmkmPublicReferenceProvenance(
  store: Pick<DiscoveryStore, 'metadata'>,
): UmkmPublicReferenceProvenance | null {
  if (!isUmkmMapPublicReference(store)) return null;
  const metadata = store.metadata || {};
  return {
    sourceTitle: readMetaText(metadata, 'source_title').slice(0, 160),
    sourceLicense: readMetaText(metadata, 'source_license').slice(0, 120),
    sourceUrl: readSafeExternalUrl(metadata.source_url),
    sourceLicenseUrl: readSafeExternalUrl(metadata.source_license_url),
  };
}

export function normalizeUmkmReferenceCursor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cursor = value.trim();
  if (
    !cursor ||
    cursor.length > 96 ||
    !/^\d{1,19}:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      cursor,
    )
  ) {
    return null;
  }
  return cursor;
}

export function normalizeUmkmReferenceOffset(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= 40
    ? value
    : null;
}

export function mergeUmkmPublicReferencePage(
  current: DiscoveryStore[],
  incoming: DiscoveryStore[],
  append: boolean,
): DiscoveryStore[] {
  const registeredStores = current.filter(
    store => !isUmkmMapPublicReference(store),
  );
  const references = new Map<string, DiscoveryStore>();
  if (append) {
    for (const store of current) {
      if (isUmkmMapPublicReference(store)) references.set(store.id, store);
    }
  }
  for (const store of incoming) {
    if (isUmkmMapPublicReference(store)) references.set(store.id, store);
  }
  return [...registeredStores, ...references.values()];
}

function normalizeTrustTier(value: string): UmkmTrustTier | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!normalized) return null;
  if (
    ['lajukan_verified', 'verified_lajukan', 'terverifikasi_lajukan'].includes(
      normalized,
    )
  ) {
    return 'lajukan_verified';
  }
  if (
    [
      'document_checked',
      'documents_checked',
      'docs_checked',
      'nib_checked',
      'dokumen_dicek',
    ].includes(normalized)
  ) {
    return 'document_checked';
  }
  if (
    [
      'location_checked',
      'address_checked',
      'maps_checked',
      'lokasi_dicek',
    ].includes(normalized)
  ) {
    return 'location_checked';
  }
  if (
    [
      'wa_active',
      'whatsapp_active',
      'phone_checked',
      'contact_checked',
      'wa_aktif',
    ].includes(normalized)
  ) {
    return 'wa_active';
  }
  if (
    [
      'unverified',
      'not_verified',
      'pending',
      'new',
      'belum_diverifikasi',
    ].includes(normalized)
  ) {
    return 'unverified';
  }
  return null;
}

function getUmkmTrustProfile(
  store: Pick<DiscoveryStore, 'metadata'>,
  isId: boolean,
): UmkmTrustProfile {
  const metadata = store.metadata || {};
  const explicitTier = normalizeTrustTier(
    readMetaText(
      metadata,
      'trust_status',
      'verification_status',
      'lajukan_verification_status',
      'seller_verification_status',
    ),
  );
  const tier =
    explicitTier ||
    (readMetaBoolean(metadata, 'lajukan_verified', 'verified_by_lajukan')
      ? 'lajukan_verified'
      : readMetaBoolean(
            metadata,
            'document_checked',
            'documents_checked',
            'nib_checked',
            'business_license_checked',
          )
        ? 'document_checked'
        : readMetaBoolean(
              metadata,
              'location_checked',
              'address_checked',
              'maps_checked',
            )
          ? 'location_checked'
          : readMetaBoolean(
                metadata,
                'wa_active',
                'whatsapp_active',
                'phone_checked',
                'contact_checked',
              )
            ? 'wa_active'
            : 'unverified');

  if (tier === 'lajukan_verified') {
    return {
      tier,
      label: isId ? 'Terverifikasi Lajukan' : 'Lajukan verified',
      description: isId
        ? 'Data utama sudah lolos cek manual Lajukan.'
        : 'Key details passed Lajukan manual checks.',
      chipClassName:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/44 dark:text-emerald-200',
    };
  }
  if (tier === 'document_checked') {
    return {
      tier,
      label: isId ? 'Dokumen dicek' : 'Documents checked',
      description: isId
        ? 'Ada dokumen pendukung yang sudah dicek.'
        : 'Supporting documents have been reviewed.',
      chipClassName:
        'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/44 dark:text-sky-200',
    };
  }
  if (tier === 'location_checked') {
    return {
      tier,
      label: isId ? 'Lokasi dicek' : 'Location checked',
      description: isId
        ? 'Alamat atau titik peta sudah dicek masuk akal.'
        : 'Address or map point has been sanity-checked.',
      chipClassName:
        'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900/70 dark:bg-teal-950/44 dark:text-teal-200',
    };
  }
  if (tier === 'wa_active') {
    return {
      tier,
      label: isId ? 'WA aktif' : 'WhatsApp active',
      description: isId
        ? 'Nomor kontak sudah dicek aktif.'
        : 'The contact number has been checked active.',
      chipClassName:
        'border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-900/70 dark:bg-lime-950/44 dark:text-lime-200',
    };
  }
  return {
    tier: 'unverified',
    label: isId ? 'Belum diverifikasi' : 'Not verified yet',
    description: isId
      ? 'Listing baru atau data belum dicek penuh.'
      : 'New listing or details have not been fully checked.',
    chipClassName:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/44 dark:text-amber-200',
  };
}

function getUmkmRiskProfile(
  place: {
    store: DiscoveryStore;
    ui: ReturnType<typeof buildUmkmPlacePresentation>;
  },
  isId: boolean,
): UmkmRiskProfile {
  const metadata = place.store.metadata || {};
  const explicitHighRisk = readMetaBoolean(
    metadata,
    'high_risk_category',
    'manual_review_required',
    'requires_manual_review',
  );
  const hint = [
    place.store.name,
    place.store.description || '',
    place.store.address || '',
    place.store.city || '',
    place.ui.kindLabel,
    place.ui.categoryLabel,
    readMetaText(
      metadata,
      'umkm_category',
      'business_type',
      'store_type',
      'segment',
      'risk_category',
    ),
  ]
    .join(' ')
    .toLowerCase();
  const highRisk =
    explicitHighRisk ||
    /(peluang\s*usaha|franchise|waralaba|kemitraan|investasi|reseller|distributor|supplier|modal\s*besar|sewa|ruko|kios|booth|tempat\s*usaha|mesin\s*bekas|pre[\s-]?order|legalitas|izin\s*usaha|dp\s*besar)/i.test(
      hint,
    );

  return {
    highRisk,
    label: highRisk
      ? isId
        ? 'Perlu cek ekstra'
        : 'Extra checks needed'
      : isId
        ? 'Transaksi langsung'
        : 'Direct transaction',
    description: highRisk
      ? isId
        ? 'Kategori ini rawan salah paham atau penipuan. Cek bukti usaha, lokasi, harga, dan dokumen sebelum bayar.'
        : 'This category needs more care. Check proof of business, location, pricing, and documents before paying.'
      : isId
        ? 'Lajukan menghubungkan kamu dengan penyedia. Pembayaran belum diproses oleh Lajukan.'
        : 'Lajukan connects you with providers. Payment is not processed by Lajukan yet.',
  };
}

function buildReportListingHref(
  store: Pick<DiscoveryStore, 'id' | 'name' | 'slug'>,
  isId: boolean,
) {
  const subject = `${isId ? 'Laporkan listing' : 'Report listing'}: ${store.name}`;
  const body = [
    isId
      ? 'Saya ingin melaporkan listing ini di Lajukan.'
      : 'I want to report this listing on Lajukan.',
    '',
    `Nama: ${store.name}`,
    `ID: ${store.id}`,
    `Slug: ${store.slug}`,
    '',
    isId
      ? 'Alasan laporan: Diduga penipuan / nomor tidak aktif / harga palsu / alamat palsu / produk tidak sesuai / minta transfer mencurigakan / spam.'
      : 'Reason: Suspected fraud / inactive number / fake price / fake address / mismatched product / suspicious transfer request / spam.',
    '',
    isId ? 'Detail kejadian:' : 'Details:',
  ].filter(Boolean);
  return `mailto:${REPORT_EMAIL}?${new URLSearchParams({
    subject,
    body: body.join('\n'),
  }).toString()}`;
}

function getSafetyTips(isId: boolean, highRisk: boolean) {
  const baseTips = isId
    ? [
        'Utamakan COD, survey lokasi, video call, atau ambil langsung.',
        'Jangan transfer penuh sebelum produk, alamat, harga, dan identitas jelas.',
        'Cek nama rekening/nomor kontak dan minta nota atau bukti pemesanan.',
      ]
    : [
        'Prefer COD, location visit, video call, or direct pickup.',
        'Do not pay in full before product, address, price, and identity are clear.',
        'Check account/contact identity and request an invoice or order proof.',
      ];

  if (!highRisk) return baseTips;
  return [
    ...baseTips,
    isId
      ? 'Untuk peluang usaha, franchise, mesin bekas, atau sewa tempat, minta dokumen dan skema tertulis.'
      : 'For opportunities, franchises, used machines, or rentals, ask for documents and written terms.',
  ];
}

function TrustTierIcon({
  tier,
  compact,
}: {
  tier: UmkmTrustTier;
  compact?: boolean;
}) {
  const className = cn('shrink-0', compact ? 'h-3 w-3' : 'h-3.5 w-3.5');
  if (tier === 'lajukan_verified') return <BadgeCheck className={className} />;
  if (tier === 'document_checked') return <FileCheck2 className={className} />;
  if (tier === 'location_checked') return <ShieldCheck className={className} />;
  if (tier === 'wa_active') return <Phone className={className} />;
  return <ShieldQuestion className={className} />;
}

function TrustStatusChip({
  profile,
  compact = false,
}: {
  profile: UmkmTrustProfile;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1 rounded-full border font-bold',
        compact ? 'px-2 py-0.5 text-[9.5px]' : 'px-2.5 py-1 text-[10px]',
        profile.chipClassName,
      )}
      title={profile.description}
    >
      <TrustTierIcon tier={profile.tier} compact={compact} />
      <span className="truncate">{profile.label}</span>
    </span>
  );
}

function SafetyNotice({
  isId,
  trustProfile,
  riskProfile,
  reportHref,
  compact = false,
}: {
  isId: boolean;
  trustProfile: UmkmTrustProfile;
  riskProfile: UmkmRiskProfile;
  reportHref: string;
  compact?: boolean;
}) {
  const tips = getSafetyTips(isId, riskProfile.highRisk).slice(
    0,
    compact ? 2 : 4,
  );
  return (
    <div
      className={cn(
        'rounded-[18px] border border-amber-200/82 bg-amber-50/88 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100',
        compact ? 'p-2.5' : 'p-3',
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <TrustStatusChip profile={trustProfile} compact />
            <span className="inline-flex min-h-[22px] items-center rounded-full bg-white/78 px-2 text-[9.5px] font-bold text-amber-800 dark:bg-slate-950/34 dark:text-amber-100">
              {riskProfile.label}
            </span>
          </div>
          <p
            className={cn(
              'mt-1 font-semibold leading-5',
              compact ? 'text-[11px]' : 'text-[12px]',
            )}
          >
            {riskProfile.description}
          </p>
          {!compact ? (
            <ul className="mt-2 grid gap-1 text-[11px] font-semibold leading-4 text-amber-900/86 dark:text-amber-100/86">
              {tips.map(tip => (
                <li key={tip} className="flex gap-1.5">
                  <span className="mt-[0.42rem] h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={reportHref}
              className="inline-flex min-h-[30px] items-center gap-1.5 rounded-full bg-white px-2.5 text-[10px] font-bold text-rose-700 shadow-[0_10px_20px_-18px_rgba(244,63,94,0.55)] transition hover:bg-rose-50 dark:bg-slate-950/56 dark:text-rose-200"
            >
              <Flag className="h-3 w-3" />
              {isId ? 'Laporkan listing' : 'Report listing'}
            </a>
            <span className="text-[10px] font-semibold text-amber-900/72 dark:text-amber-100/72">
              {isId
                ? 'Transaksi langsung dengan penyedia.'
                : 'Transactions happen directly with the provider.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PublicReferenceBadge({ isId }: { isId: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9.5px] font-bold text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/44 dark:text-sky-200">
      <MapPinned className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {isId ? 'Data publik · belum diklaim' : 'Public data · unclaimed'}
      </span>
    </span>
  );
}

export function PublicReferenceNotice({
  store,
  isId,
  compact = false,
}: {
  store: Pick<DiscoveryStore, 'metadata'>;
  isId: boolean;
  compact?: boolean;
}) {
  const provenance = getUmkmPublicReferenceProvenance(store);
  if (!provenance) return null;

  return (
    <div
      className={cn(
        'rounded-[18px] border border-sky-200/82 bg-sky-50/88 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100',
        compact ? 'p-2.5' : 'p-3',
      )}
      data-testid="umkm-public-reference-notice"
    >
      <PublicReferenceBadge isId={isId} />
      <p
        className={cn(
          'mt-1.5 font-semibold leading-5',
          compact ? 'text-[11px]' : 'text-[12px]',
        )}
      >
        {isId
          ? 'Referensi lokasi non-transaksi. Belum diklaim pemilik dan belum diverifikasi Lajukan; periksa pembaruan di sumber asli.'
          : 'A non-transactional location reference. It is unclaimed and not verified by Lajukan; check the original source for updates.'}
      </p>
      {provenance.sourceTitle || provenance.sourceLicense ? (
        <p className="mt-1 text-[10px] font-semibold leading-4 text-sky-900/76 dark:text-sky-100/76">
          {provenance.sourceTitle ? (
            <span>
              {isId ? 'Sumber' : 'Source'}: {provenance.sourceTitle}
            </span>
          ) : null}
          {provenance.sourceTitle && provenance.sourceLicense ? ' · ' : null}
          {provenance.sourceLicense ? (
            provenance.sourceLicenseUrl ? (
              <a
                href={provenance.sourceLicenseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-sky-400/70 underline-offset-2 hover:text-sky-700 dark:hover:text-sky-200"
              >
                {isId ? 'Lisensi' : 'License'}: {provenance.sourceLicense}
              </a>
            ) : (
              <span>
                {isId ? 'Lisensi' : 'License'}: {provenance.sourceLicense}
              </span>
            )
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

export function PublicReferenceResultCard({
  place,
  isId,
  compact = false,
  onSelect,
}: {
  place: {
    store: DiscoveryStore;
    ui: ReturnType<typeof buildUmkmPlacePresentation>;
  };
  isId: boolean;
  compact?: boolean;
  onSelect: () => void;
}) {
  const provenance = getUmkmPublicReferenceProvenance(place.store);
  const routeHref =
    place.ui.locationMode === 'fixed' &&
    isCoordinateValid({ lat: place.store.lat, lng: place.store.lng })
      ? place.ui.googleMapsDirectionsUrl
      : null;
  const provenanceText = [provenance?.sourceTitle, provenance?.sourceLicense]
    .filter(Boolean)
    .join(' · ');

  return (
    <article
      className={cn(
        'min-w-0 overflow-hidden border border-sky-200/80 bg-white shadow-[0_12px_26px_-24px_rgba(14,116,144,0.24)] dark:border-sky-900/70 dark:bg-slate-900/82',
        compact ? 'rounded-[18px]' : 'rounded-[16px] sm:rounded-[18px]',
      )}
      data-testid="umkm-public-reference-card"
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`${isId ? 'Detail referensi' : 'Reference details'} ${place.store.name}`}
        className={cn(
          'group grid w-full min-w-0 items-center gap-2 text-left transition hover:bg-sky-50/54 dark:hover:bg-sky-950/18',
          compact
            ? 'grid-cols-[80px_minmax(0,1fr)_auto] p-2.5'
            : 'grid-cols-[72px_minmax(0,1fr)_auto] p-2 sm:grid-cols-[82px_minmax(0,1fr)_auto] xl:grid-cols-[88px_minmax(0,1fr)_auto]',
        )}
      >
        <PlaceThumb
          src={place.ui.gallery[0] || place.ui.coverImage}
          alt={place.store.name}
          className={cn(
            'rounded-[14px]',
            compact ? 'h-[56px] w-[56px] sm:h-[60px] sm:w-[60px]' : 'h-[72px] sm:h-[82px] xl:h-[88px]',
          )}
        />
        <span className="min-w-0">
          <PublicReferenceBadge isId={isId} />
          <span className="mt-0.5 line-clamp-1 text-[12px] font-bold leading-tight text-[color:var(--app-text)] sm:text-[13px]">
            {place.store.name}
          </span>
          {provenanceText ? (
            <span className="mt-1 block truncate text-[10px] font-semibold text-sky-800/78 dark:text-sky-200/78">
              {provenanceText}
            </span>
          ) : null}
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] text-[color:var(--app-text-soft)]">
            <MapPin className="h-3 w-3 shrink-0 text-[color:var(--app-accent)]" />
            <span className="truncate">
              {getPlaceLocationLabel(place, isId)}
            </span>
          </span>
        </span>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition group-hover:bg-sky-600 group-hover:text-white dark:bg-slate-800 dark:text-slate-200">
          <ChevronRight className="h-4 w-4" />
        </span>
      </button>
      {provenance?.sourceUrl || routeHref ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-sky-100 px-2.5 py-2 dark:border-sky-900/50">
          {provenance?.sourceUrl ? (
            <a
              href={provenance.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[26px] items-center gap-1 rounded-full bg-sky-50 px-2 text-[9.5px] font-bold text-sky-700 transition hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-200"
            >
              <ExternalLink className="h-3 w-3" />
              {isId ? 'Sumber asli' : 'Original source'}
            </a>
          ) : null}
          {routeHref ? (
            <a
              href={routeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[26px] items-center gap-1 rounded-full bg-slate-100 px-2 text-[9.5px] font-bold text-slate-700 transition hover:text-[color:var(--app-accent)] dark:bg-slate-800 dark:text-slate-100"
            >
              <Navigation className="h-3 w-3" />
              {isId ? 'Rute' : 'Route'}
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function DiscoveryScopeControl({
  scope,
  isId,
  compact = false,
  onChange,
}: {
  scope: DiscoveryScope;
  isId: boolean;
  compact?: boolean;
  onChange: (scope: DiscoveryScope) => void;
}) {
  const options: Array<{
    value: DiscoveryScope;
    label: string;
    activeClass: string;
  }> = [
    {
      value: 'all',
      label: isId ? 'Semua' : 'All',
      activeClass:
        'bg-[color:var(--app-accent)] text-white shadow-sm shadow-black/10',
    },
    {
      value: 'registered',
      label: isId ? 'Usaha Lajukan' : 'Lajukan businesses',
      activeClass:
        'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20',
    },
    {
      value: 'references',
      label: isId ? 'Referensi publik' : 'Public references',
      activeClass:
        'bg-sky-600 text-white shadow-sm shadow-sky-600/20',
    },
  ];

  return (
    <div
      role="group"
      aria-label={isId ? 'Filter jenis lokasi' : 'Filter location type'}
      data-testid="umkm-scope-filter"
      className="min-w-0 rounded-[14px] border border-slate-200 bg-white p-1 shadow-[0_8px_20px_-16px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-slate-900/75 dark:shadow-black/20"
    >
      <EmblaInlineRail contentClassName="items-center gap-1">
        {options.map(option => {
          const active = scope === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={cn(
                'relative shrink-0 rounded-full',
                'font-semibold leading-none',
                'transition-all duration-200 ease-out',
                'outline-none',
                compact
                  ? 'min-h-7 px-2.5 text-[9.5px]'
                  : 'min-h-8 px-3 text-[10.5px]',
                active
                  ? option.activeClass
                  : [
                      'border border-transparent bg-white text-slate-600',
                      'hover:border-slate-200 hover:text-slate-900',
                      'hover:shadow-sm',
                      'dark:text-slate-400',
                      'dark:hover:bg-white/[0.07]',
                      'dark:hover:text-slate-100',
                    ],
                'focus-visible:ring-2',
                'focus-visible:ring-[color:var(--app-accent)]/40',
                'focus-visible:ring-offset-1',
                'focus-visible:ring-offset-white',
                'dark:focus-visible:ring-offset-slate-950',
                'active:scale-[0.97]',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </EmblaInlineRail>
    </div>
  );
}

export function UmkmDiscoveryPanel({
  isId,
  query,
  city,
  category,
  limit = 10,
  title,
  description,
  selectedSlug,
  selectedStoreIdInitial,
  initialMapOnly = false,
  openMapSignal = 0,
  variant = 'section',
  initialStores,
  initialCount,
}: UmkmDiscoveryPanelProps) {
  const hasInitialStores = initialStores !== undefined;
  const [stores, setStores] = useState<DiscoveryStore[]>(
    () => initialStores || [],
  );
  const [loading, setLoading] = useState(!hasInitialStores);
  const [error, setError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedProductsLoading, setSelectedProductsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(
    initialCount ?? (hasInitialStores ? initialStores.length : null),
  );
  const [listPage, setListPage] = useState(1);
  const [discoveryScope, setDiscoveryScope] = useState<DiscoveryScope>('all');
  const [hasMore, setHasMore] = useState(
    () => (initialStores?.length || 0) >= Math.max(1, Math.min(limit, 50)),
  );
  const [nextOffset, setNextOffset] = useState(initialStores?.length || 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [referenceHasMore, setReferenceHasMore] = useState(false);
  const [referenceNextCursor, setReferenceNextCursor] = useState<string | null>(
    null,
  );
  const [referenceNextOffset, setReferenceNextOffset] = useState<number | null>(
    null,
  );
  const [loadingMoreReferences, setLoadingMoreReferences] = useState(false);
  const activeStoresRequestRef = useRef<AbortController | null>(null);
  const activeReferencesRequestRef = useRef<AbortController | null>(null);
  const selectedPreviewRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const immersiveLoadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollStoreIdRef = useRef<string | null>(null);
  const mobileMapRef = useRef<HTMLDivElement | null>(null);
  const desktopMapRef = useRef<HTMLDivElement | null>(null);
  const {
    viewerLocation,
    viewerAccuracyMeters,
    locating,
    locationError,
    locationState,
    requestViewerLocation,
  } = useViewerLocation({
    isId,
    autoRequest: false,
    watch: false,
  });
  const viewerQueryLat = viewerLocation
    ? Number(viewerLocation.lat.toFixed(3))
    : null;
  const viewerQueryLng = viewerLocation
    ? Number(viewerLocation.lng.toFixed(3))
    : null;
  const queryViewerLocation = useMemo(
    () =>
      viewerQueryLat !== null && viewerQueryLng !== null
        ? { lat: viewerQueryLat, lng: viewerQueryLng }
        : null,
    [viewerQueryLat, viewerQueryLng],
  );
  const [mapInteractive, setMapInteractive] = useState(
    () => variant === 'immersive',
  );
  const [mapTheme, setMapTheme] = useState<UmkmMapTheme>(() => variant === 'immersive' ? 'light' : 'default');
  const [showRoute, setShowRoute] = useState(false);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [routeSummary, setRouteSummary] = useState<UmkmMapRouteSummary | null>(
    null,
  );
  const [mapFocusMode, setMapFocusMode] = useState<
    'stores' | 'viewer' | 'route' | 'selected' | 'indonesia'
  >('indonesia');
  const [mapRangeKm, setMapRangeKm] = useState<number | null>(null);
  const [mapFocusNonce, setMapFocusNonce] = useState(0);
  const [sheetExpanded, setSheetExpanded] = useState(
    () => variant === 'immersive',
  );
  const [mapOnly, setMapOnly] = useState(
    () => variant === 'immersive' && initialMapOnly,
  );
  const [canUseDesktopMapPanel, setCanUseDesktopMapPanel] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [storesBackendDegraded, setStoresBackendDegraded] = useState(false);
  const [mapPoints, setMapPoints] = useState<UmkmMapStore[]>([]);
  const activeMapPointsRequestRef = useRef<AbortController | null>(null);
  const mapBoundsDebounceRef = useRef<number | null>(null);
  const mapBoundsRequestKeyRef = useRef('');
  const requestLimit = Math.max(24, Math.min(60, Math.max(limit * 3, 24)));
  const referencePageLimit = 60;
  const MAP_POINT_FETCH_MAX = 1600;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncPublicScopeParam = () => {
      const url = new URL(window.location.href);
      const requestedScope = readDiscoveryScope(url.searchParams.get('scope'));
      setDiscoveryScope(requestedScope);
      if (url.searchParams.has('scope')) {
        url.searchParams.delete('scope');
        window.history.replaceState(
          window.history.state,
          '',
          url.pathname + url.search,
        );
      }
    };

    syncPublicScopeParam();
    window.addEventListener('popstate', syncPublicScopeParam);
    return () => window.removeEventListener('popstate', syncPublicScopeParam);
  }, []);
  const deepLinkedInitialStore = useMemo(() => {
    const targetSlug = selectedSlug?.trim();
    const targetStoreId = selectedStoreIdInitial?.trim();
    if (!targetSlug && !targetStoreId) return null;

    return (
      initialStores?.find(
        store =>
          (targetSlug && store.slug === targetSlug) ||
          (targetStoreId && store.id === targetStoreId),
      ) || null
    );
  }, [initialStores, selectedSlug, selectedStoreIdInitial]);

  const handleDiscoveryScopeChange = useCallback((scope: DiscoveryScope) => {
    setDiscoveryScope(scope);
    setListPage(1);
    setSelectedStoreId(null);
  }, []);

  const loadStoresPage = useCallback(
    async ({
      offset,
      append,
      silent = false,
    }: {
      offset: number;
      append: boolean;
      silent?: boolean;
    }) => {
      activeStoresRequestRef.current?.abort();
      const controller = new AbortController();
      activeStoresRequestRef.current = controller;
      if (append) {
        setLoading(false);
        setLoadingMore(true);
      } else {
        setLoadingMore(false);
        setLoading(!silent);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        if (query?.trim()) params.set('q', query.trim());
        if (city?.trim()) params.set('city', city.trim());
        if (mapRangeKm !== null && queryViewerLocation) {
          // Viewer coordinates are sent only for an explicit radius search.
          // The default "All Indonesia" mode must not collapse into a
          // nearest-first query around the browser location.
          params.set('viewer_lat', queryViewerLocation.lat.toFixed(3));
          params.set('viewer_lng', queryViewerLocation.lng.toFixed(3));
        }
        if (mapRangeKm !== null && queryViewerLocation) {
          params.set('radius_km', String(mapRangeKm));
        }
        params.set('limit', String(requestLimit));
        params.set('offset', String(offset));
        params.set('map', '1');

        const res = await fetch(
          `/api/super-app/umkm/stores?${params.toString()}`,
          {
            cache: 'no-store',
            credentials: 'include',
            signal: controller.signal,
          },
        );
        const payload = (await res.json().catch(() => ({}))) as StoresResponse;
        if (!res.ok || !payload.data) {
          throw new Error(payload.error || 'Failed to load business discovery');
        }
        if (controller.signal.aborted) return;
        const pageItems = payload.data.items || [];
        setStoresBackendDegraded(payload.data.stores_backend_degraded === true);
        const items = mergeDeepLinkedUmkmStore(
          pageItems,
          deepLinkedInitialStore,
        );
        setStores(current => {
          if (!append) {
            const merged = new Map(items.map(store => [store.id, store]));
            for (const store of current) {
              if (isUmkmMapPublicReference(store)) merged.set(store.id, store);
            }
            return Array.from(merged.values());
          }
          const merged = new Map(current.map(store => [store.id, store]));
          for (const store of items) merged.set(store.id, store);
          return Array.from(merged.values());
        });
        const loadedCount =
          payload.data.loaded_count ?? offset + pageItems.length;
        setTotalCount(loadedCount);
        setHasMore(payload.data.has_more === true);
        setNextOffset(payload.data.next_offset ?? loadedCount);
        setError(null);
        setSelectedStoreId(current => {
          if (append) return current;

          const currentUrl =
            typeof window !== 'undefined'
              ? new URL(window.location.href)
              : null;
          const targetSlug =
            currentUrl?.searchParams.get('store')?.trim() ||
            currentUrl?.searchParams.get('business')?.trim() ||
            '';
          const targetStoreId =
            currentUrl?.searchParams.get('storeId')?.trim() || '';

          if (current && items.some(item => item.id === current)) {
            return current;
          }

          const matchedBySlug = targetSlug
            ? items.find(item => item.slug === targetSlug)
            : null;
          if (matchedBySlug) return matchedBySlug.id;

          const matchedById = targetStoreId
            ? items.find(item => item.id === targetStoreId)
            : null;
          if (matchedById) return matchedById.id;

          return null;
        });
      } catch {
        if (controller.signal.aborted) return;
        setError(
          isId
            ? 'Daftar usaha belum bisa dimuat. Periksa koneksi lalu coba lagi.'
            : 'Businesses could not be loaded. Check your connection and try again.',
        );
      } finally {
        if (
          controller.signal.aborted ||
          activeStoresRequestRef.current !== controller
        )
          return;
        activeStoresRequestRef.current = null;
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [
      city,
      category,
      deepLinkedInitialStore,
      isId,
      query,
      requestLimit,
      selectedSlug,
      selectedStoreIdInitial,
      queryViewerLocation,
      mapRangeKm,
    ],
  );

  useEffect(() => {
    setListPage(1);
    if (
      hasInitialStores &&
      !queryViewerLocation &&
      reloadNonce === 0
    ) {
      setHasMore((initialStores?.length || 0) >= requestLimit);
      setNextOffset(initialStores?.length || 0);
      return;
    }

    const timeoutId = window.setTimeout(
      () => {
        void loadStoresPage({
          offset: 0,
          append: false,
          silent: hasInitialStores,
        });
      },
      query || city ? 80 : 0,
    );

    return () => {
      window.clearTimeout(timeoutId);
      activeStoresRequestRef.current?.abort();
    };
  }, [
    hasInitialStores,
    initialStores,
    loadStoresPage,
    reloadNonce,
    requestLimit,
    queryViewerLocation,
    query,
    city,
  ]);

  const loadReferencesPage = useCallback(
    async ({
      cursor,
      offset,
      append,
    }: {
      cursor?: string | null;
      offset?: number | null;
      append: boolean;
    }): Promise<boolean> => {
      const safeCursor = normalizeUmkmReferenceCursor(cursor);
      const safeOffset = normalizeUmkmReferenceOffset(offset);
      if (append && !safeCursor && safeOffset === null) return false;

      activeReferencesRequestRef.current?.abort();
      const controller = new AbortController();
      activeReferencesRequestRef.current = controller;
      if (append) {
        setLoadingMoreReferences(true);
      } else {
        setLoadingMoreReferences(false);
        setReferenceHasMore(false);
        setReferenceNextCursor(null);
        setReferenceNextOffset(null);
        setStores(current => mergeUmkmPublicReferencePage(current, [], false));
      }

      const params = new URLSearchParams({
        references_only: '1',
        limit: String(referencePageLimit),
        offset: String(safeCursor ? 0 : safeOffset || 0),
      });
      if (safeCursor) params.set('cursor', safeCursor);
      if (query?.trim()) params.set('q', query.trim());
      if (city?.trim()) params.set('city', city.trim());
      if (mapRangeKm !== null && queryViewerLocation) {
        params.set('viewer_lat', queryViewerLocation.lat.toFixed(3));
        params.set('viewer_lng', queryViewerLocation.lng.toFixed(3));
      }
      if (mapRangeKm !== null && queryViewerLocation) {
        params.set('radius_km', String(mapRangeKm));
      }
      try {
        const response = await fetch(
          `/api/super-app/umkm/stores?${params.toString()}`,
          {
            cache: 'default',
            credentials: 'include',
            signal: controller.signal,
          },
        );
        const payload = (await response
          .json()
          .catch(() => ({}))) as StoresResponse;
        if (!response.ok || !payload.data || controller.signal.aborted) {
          return false;
        }

        const nextCursor = normalizeUmkmReferenceCursor(
          payload.data.next_cursor,
        );
        const nextOffset = normalizeUmkmReferenceOffset(
          payload.data.next_offset,
        );
        const sourceHasMore =
          payload.data.has_more ?? payload.data.reference_has_more;
        const canContinue =
          sourceHasMore === true &&
          (nextCursor !== null || nextOffset !== null);
        const pageItems = payload.data.items || [];
        setStoresBackendDegraded(payload.data.stores_backend_degraded === true);
        setStores(current =>
          mergeUmkmPublicReferencePage(current, pageItems, append),
        );
        setReferenceHasMore(canContinue);
        setReferenceNextCursor(canContinue ? nextCursor : null);
        setReferenceNextOffset(canContinue ? nextOffset : null);
        return pageItems.some(isUmkmMapPublicReference);
      } catch {
        return false;
      } finally {
        if (activeReferencesRequestRef.current === controller) {
          activeReferencesRequestRef.current = null;
          if (append) setLoadingMoreReferences(false);
        }
      }
    },
    [city, mapRangeKm, query, queryViewerLocation, referencePageLimit],
  );

  useEffect(() => {
    setLoadingMoreReferences(false);
    setReferenceHasMore(false);
    setReferenceNextCursor(null);
    setReferenceNextOffset(null);
    setStores(current => mergeUmkmPublicReferencePage(current, [], false));
    const timeoutId = window.setTimeout(() => {
      void loadReferencesPage({ append: false });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
      activeReferencesRequestRef.current?.abort();
    };
  }, [loadReferencesPage, query, city, discoveryScope]);
  const handleMapBoundsChange = useCallback(
    (bounds: UmkmMapBounds) => {
      if (
        ![
          bounds.minLat,
          bounds.maxLat,
          bounds.minLng,
          bounds.maxLng,
        ].every(Number.isFinite) ||
        bounds.minLat > bounds.maxLat ||
        bounds.minLng > bounds.maxLng
      ) {
        return;
      }

      const latSpan = bounds.maxLat - bounds.minLat;
      const lngSpan = bounds.maxLng - bounds.minLng;
      const viewportSpan = Math.max(latSpan, lngSpan);
      const fetchLimit = Math.min(
        MAP_POINT_FETCH_MAX,
        viewportSpan >= 30 ? 500 : viewportSpan >= 12 ? 750 : viewportSpan >= 4 ? 1000 : 1400,
      );
      const requestKey = [
        query?.trim().toLowerCase() || '',
        city?.trim().toLowerCase() || '',
        category?.trim().toLowerCase() || '',
        discoveryScope,
        bounds.minLat.toFixed(3),
        bounds.maxLat.toFixed(3),
        bounds.minLng.toFixed(3),
        bounds.maxLng.toFixed(3),
        queryViewerLocation?.lat.toFixed(3) || '',
        queryViewerLocation?.lng.toFixed(3) || '',
        fetchLimit,
      ].join('|');

      if (mapBoundsRequestKeyRef.current === requestKey) return;
      mapBoundsRequestKeyRef.current = requestKey;
      if (mapBoundsDebounceRef.current !== null) {
        window.clearTimeout(mapBoundsDebounceRef.current);
      }

      mapBoundsDebounceRef.current = window.setTimeout(() => {
        mapBoundsDebounceRef.current = null;
        activeMapPointsRequestRef.current?.abort();
        const controller = new AbortController();
        activeMapPointsRequestRef.current = controller;

        const params = new URLSearchParams({
          limit: String(fetchLimit),
          min_lat: bounds.minLat.toFixed(5),
          max_lat: bounds.maxLat.toFixed(5),
          min_lng: bounds.minLng.toFixed(5),
          max_lng: bounds.maxLng.toFixed(5),
        });
        if (query?.trim()) params.set('q', query.trim());
        if (city?.trim()) params.set('city', city.trim());
        if (category?.trim() && category !== 'all') params.set('category', category.trim());
        if (queryViewerLocation) {
          params.set('viewer_lat', queryViewerLocation.lat.toFixed(5));
          params.set('viewer_lng', queryViewerLocation.lng.toFixed(5));
        }

        void fetch(`/api/super-app/umkm/map-points?${params.toString()}`, {
          cache: 'default',
          signal: controller.signal,
        })
          .then(async response => {
            const payload = (await response.json().catch(() => ({}))) as MapPointResponse;
            if (!response.ok || controller.signal.aborted) return;

            const incoming = (payload.data?.items || [])
              .filter(point => isCoordinateValid({ lat: point.lat, lng: point.lng }))
              .map(
                point =>
                  ({
                    id: point.id,
                    slug: point.slug,
                    name: point.name,
                    city: point.city || 'Indonesia',
                    address: point.city || 'Indonesia',
                    lat: point.lat,
                    lng: point.lng,
                    description: null,
                    phone: null,
                    metadata: {
                      ...(point.metadata || {}),
                      marketplace_category_slug:
                        point.metadata?.marketplace_category_slug || point.category,
                      umkm_category: point.metadata?.umkm_category,
                      source_kind: point.source_kind,
                      record_kind: point.source_kind.includes('reference')
                        ? point.metadata?.record_kind || 'open_data_reference'
                        : point.metadata?.record_kind || 'registered_store',
                      market_side: point.source_kind.includes('reference')
                        ? 'reference'
                        : point.metadata?.market_side || 'supply',
                      is_transactional: !point.source_kind.includes('reference'),
                      reference_publication_status: point.source_kind.includes('reference')
                        ? 'published'
                        : point.metadata?.reference_publication_status,
                      claimable: point.source_kind.includes('reference'),
                      source_dataset:
                        point.metadata?.source_dataset || point.source_kind,
                      is_public_reference: point.source_kind.includes('reference'),
                    },
                    online_order_enabled: false,
                    offline_order_enabled: false,
                    reservation_enabled: false,
                    table_count: 0,
                    available_table_count: 0,
                    max_table_capacity: 0,
                  } satisfies UmkmMapStore),
              );

            setMapPoints(current => {
              const merged = new Map(current.map(point => [point.id, point]));
              for (const point of incoming) merged.set(point.id, point);
              const entries = Array.from(merged.values());
              if (entries.length <= MAP_POINT_FETCH_MAX * 5) return entries;
              const retainedIds = new Set(stores.map(store => store.id));
              return entries.filter(
                (point, index) =>
                  retainedIds.has(point.id) ||
                  index >= entries.length - MAP_POINT_FETCH_MAX * 5,
              );
            });
          })
          .catch(error => {
            if (!controller.signal.aborted) {
              console.warn('[UMKM_MAP_POINTS_CLIENT_ERROR]', error);
            }
          })
          .finally(() => {
            if (activeMapPointsRequestRef.current === controller) {
              activeMapPointsRequestRef.current = null;
            }
          });
      }, 180);
    },
    [
      MAP_POINT_FETCH_MAX,
      category,
      city,
      discoveryScope,
      query,
      queryViewerLocation,
      stores,
    ],
  );

  useEffect(() => {
    mapBoundsRequestKeyRef.current = '';
    setMapPoints([]);
    activeMapPointsRequestRef.current?.abort();
    return () => {
      if (mapBoundsDebounceRef.current !== null) {
        window.clearTimeout(mapBoundsDebounceRef.current);
        mapBoundsDebounceRef.current = null;
      }
    };
  }, [category, city, discoveryScope, query, queryViewerLocation]);

  const preparedStores = useMemo(
    () =>
      stores.map(store => ({
        store,
        ui: buildUmkmPlacePresentation(store, isId, viewerLocation),
      })),
    [isId, stores, viewerLocation],
  );

  const visibleStores = useMemo(() => {
    const filtered = preparedStores.filter(place => {
      const isReference = isUmkmMapPublicReference(place.store);
      if (discoveryScope === 'registered' && isReference) return false;
      if (discoveryScope === 'references' && !isReference) return false;
      return matchesUmkmDiscoveryCategory(
        {
          kind: place.ui.kind,
          name: place.store.name,
          description: place.store.description,
          address: place.store.address,
          metadata: place.store.metadata,
        },
        category,
      );
    });

    // Never derive distance from map center/bounds. Only use a real distance
    // returned by the API/browser location, then keep the order deterministic.
    return [...filtered].sort((left, right) => {
      const leftDistance =
        typeof left.store.distance_km === 'number' &&
        Number.isFinite(left.store.distance_km)
          ? left.store.distance_km
          : null;
      const rightDistance =
        typeof right.store.distance_km === 'number' &&
        Number.isFinite(right.store.distance_km)
          ? right.store.distance_km
          : null;

      const sourcePriority = (store: DiscoveryStore) => {
        const kind = getUmkmMapSourceKind(store);
        return kind === 'lajukan' ? 0 : kind === 'registered' ? 1 : kind === 'reference' ? 2 : 3;
      };
      const sourceDelta = sourcePriority(left.store) - sourcePriority(right.store);
      if (sourceDelta !== 0) return sourceDelta;

      if (leftDistance !== null && rightDistance !== null) {
        const delta = leftDistance - rightDistance;
        if (Math.abs(delta) > 0.001) return delta;
      } else if (leftDistance !== null) {
        return -1;
      } else if (rightDistance !== null) {
        return 1;
      }

      return left.store.name.localeCompare(right.store.name, 'id');
    });
  }, [category, discoveryScope, preparedStores]);

  useEffect(() => {
    if (!visibleStores.length || !selectedStoreId) {
      setSelectedStoreId(null);
      return;
    }
    if (visibleStores.some(item => item.store.id === selectedStoreId)) return;
    setSelectedStoreId(null);
  }, [selectedStoreId, visibleStores]);

  const mapStores = useMemo(() => {
    const merged = new Map(visibleStores.map(item => [item.store.id, item.store]));
    for (const point of mapPoints) {
      const pointIsReference = point.metadata?.is_public_reference === true;
      if (discoveryScope === 'registered' && pointIsReference) continue;
      if (discoveryScope === 'references' && !pointIsReference) continue;
      if (category && category !== 'all') {
        const pointUi = buildUmkmPlacePresentation(
          {
            ...point,
            address: point.city || 'Indonesia',
            description: point.description ?? null,
            phone: point.phone ?? null,
            metadata: point.metadata ?? {},
          },
          isId,
          viewerLocation,
        );
        if (!matchesUmkmDiscoveryCategory(
          {
            kind: pointUi.kind,
            name: point.name,
            description: point.description,
            address: point.city,
            metadata: point.metadata,
          },
          category,
        )) {
          continue;
        }
      }
      if (!merged.has(point.id)) {
        merged.set(point.id, {
          ...point,
          description: point.description ?? null,
          phone: point.phone ?? null,
          metadata: point.metadata ?? {},
          online_order_enabled: false,
          offline_order_enabled: false,
          reservation_enabled: false,
          table_count: 0,
          available_table_count: 0,
          max_table_capacity: 0,
        });
      }
    }
    return Array.from(merged.values());
  }, [category, discoveryScope, mapPoints, visibleStores]);
  const selectedPlace = useMemo(
    () => visibleStores.find(item => item.store.id === selectedStoreId) || null,
    [selectedStoreId, visibleStores],
  );

  useEffect(() => {
    if (!selectedPlace?.store.id || selectedPlace.store.products) {
      setSelectedProductsLoading(false);
      return;
    }

    let active = true;
    setSelectedProductsLoading(true);

    const loadSelectedProducts = async () => {
      try {
        const response = await fetch(
          `/api/super-app/umkm/stores/${encodeURIComponent(selectedPlace.store.id)}/products?limit=8`,
          {
            cache: 'no-store',
            credentials: 'include',
          },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          data?: { items?: Array<{
            id: string;
            name: string;
            description?: string | null;
            category?: string | null;
            price_cents: number;
            image_url?: string | null;
            is_available: boolean;
          }> };
        };
        if (!active || !response.ok || !payload.data?.items) return;

        const productItems = payload.data.items;
        setStores(current =>
          current.map(store =>
            store.id === selectedPlace.store.id
              ? { ...store, products: productItems }
              : store,
          ),
        );
      } catch {
        // Product preview is supplemental; keep the business detail usable.
      } finally {
        if (active) setSelectedProductsLoading(false);
      }
    };

    void loadSelectedProducts();
    return () => {
      active = false;
    };
  }, [selectedPlace?.store.id, selectedPlace?.store.products]);
  const selectedIsPublicReference = selectedPlace
    ? isUmkmMapPublicReference(selectedPlace.store)
    : false;
  const selectedReferenceProvenance = selectedPlace
    ? getUmkmPublicReferenceProvenance(selectedPlace.store)
    : null;
  const selectedOpenStatus = selectedPlace
    ? getOpenStatusProfile(
        selectedPlace.ui.openNow,
        isId,
        selectedIsPublicReference,
      )
    : null;
  const selectedPlaceId = selectedPlace?.store.id || null;
  const selectedContactHref = selectedIsPublicReference
    ? null
    : selectedPlace?.ui.whatsappHref || selectedPlace?.ui.telHref || null;
  const selectedContactLabel = selectedPlace?.ui.whatsappHref
    ? isId
      ? 'WhatsApp'
      : 'Chat'
    : selectedPlace?.ui.telHref
      ? isId
        ? 'Telepon'
        : 'Call'
      : 'Chat';
  const selectedContactIsExternal =
    selectedContactHref?.startsWith('http') || false;
  const selectedRouteHref =
    selectedPlace &&
    selectedPlace.ui.locationMode === 'fixed' &&
    isCoordinateValid({
      lat: selectedPlace.store.lat,
      lng: selectedPlace.store.lng,
    })
      ? selectedPlace.ui.googleMapsDirectionsUrl
      : null;
  const selectedSecondaryActionHref = selectedIsPublicReference
    ? selectedReferenceProvenance?.sourceUrl || null
    : selectedContactHref;
  const selectedCompactActionGrid =
    selectedSecondaryActionHref && selectedRouteHref
      ? 'grid-cols-[1fr_1fr_40px]'
      : selectedSecondaryActionHref
        ? 'grid-cols-2'
        : selectedRouteHref
          ? 'grid-cols-[minmax(0,1fr)_40px]'
          : 'grid-cols-1';
  const selectedActionGrid =
    selectedSecondaryActionHref && selectedRouteHref
      ? 'grid-cols-3'
      : selectedSecondaryActionHref || selectedRouteHref
        ? 'grid-cols-2'
        : 'grid-cols-1';
  const selectedLocationLabel = selectedPlace
    ? getPlaceLocationLabel(selectedPlace, isId)
    : '';
  const selectedAddressLabel =
    selectedPlace?.ui.addressLine ||
    selectedPlace?.store.address ||
    selectedLocationLabel;
  const selectedTrustProfile =
    selectedPlace && !selectedIsPublicReference
      ? getUmkmTrustProfile(selectedPlace.store, isId)
      : null;
  const selectedRiskProfile =
    selectedPlace && !selectedIsPublicReference
      ? getUmkmRiskProfile(selectedPlace, isId)
      : null;
  const selectedReportHref =
    selectedPlace && !selectedIsPublicReference
      ? buildReportListingHref(selectedPlace.store, isId)
      : '';

  const listedPlaces = useMemo(
    () =>
      visibleStores.filter(item => item.store.id !== selectedPlace?.store.id),
    [selectedPlace?.store.id, visibleStores],
  );
  const paginatedListedPlaces = useMemo(
    () => listedPlaces.slice(0, listPage * LIST_PAGE_SIZE),
    [listPage, listedPlaces],
  );
  const hasLocallyHiddenPlaces =
    paginatedListedPlaces.length < listedPlaces.length;
  const canLoadMoreReferences =
    referenceHasMore &&
    (referenceNextCursor !== null || referenceNextOffset !== null);
  const canLoadMoreList =
    hasLocallyHiddenPlaces ||
    (discoveryScope !== 'registered'
      ? canLoadMoreReferences || hasMore
      : hasMore);
  const loadingMoreForScope =
    discoveryScope === 'references' ? loadingMoreReferences : loadingMore;
  const handleLoadMore = useCallback(() => {
    if (hasLocallyHiddenPlaces) {
      setListPage(current => current + 1);
      return;
    }
    if (
      discoveryScope !== 'registered' &&
      canLoadMoreReferences &&
      (referenceNextCursor !== null || referenceNextOffset !== null) &&
      !loadingMoreReferences
    ) {
      void loadReferencesPage({
        cursor: referenceNextCursor,
        offset: referenceNextCursor ? 0 : referenceNextOffset,
        append: true,
      }).then(loaded => {
        if (loaded) setListPage(current => current + 1);
      });
      return;
    }
    if (!hasMore || loadingMore || loading) return;
    setListPage(current => current + 1);
    void loadStoresPage({
      offset: nextOffset,
      append: true,
      silent: true,
    });
  }, [
    canLoadMoreReferences,
    discoveryScope,
    hasLocallyHiddenPlaces,
    hasMore,
    loadReferencesPage,
    loadStoresPage,
    loading,
    loadingMore,
    loadingMoreReferences,
    nextOffset,
    referenceNextCursor,
    referenceNextOffset,
  ]);

  useEffect(() => {
    const sentinels = [
      loadMoreSentinelRef.current,
      immersiveLoadMoreSentinelRef.current,
    ].filter((node): node is HTMLDivElement => Boolean(node));
    if (!sentinels.length || !canLoadMoreList) return;

    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        handleLoadMore();
      },
      {
        root: null,
        rootMargin: '0px 0px 560px 0px',
        threshold: 0,
      },
    );

    sentinels.forEach(sentinel => observer.observe(sentinel));
    return () => observer.disconnect();
  }, [canLoadMoreList, handleLoadMore]);

  useEffect(() => {
    const syncSelectionFromUrl = () => {
      if (typeof window === 'undefined') return;

      const params = new URL(window.location.href).searchParams;
      const targetSlug =
        params.get('store')?.trim() ||
        params.get('business')?.trim() ||
        '';
      const targetStoreId = params.get('storeId')?.trim() || '';

      const matchedStore = visibleStores.find(
        item =>
          (targetSlug && item.store.slug === targetSlug) ||
          (targetStoreId && item.store.id === targetStoreId),
      );

      if (!matchedStore) {
        if (!targetSlug && !targetStoreId) {
          setSelectedStoreId(current => {
            if (current === null) return current;
            setShowRoute(false);
            setRouteSummary(null);
            setMapFocusMode('stores');
            setMapFocusNonce(value => value + 1);
            return null;
          });
        }
        return;
      }

      setSelectedStoreId(current =>
        current === matchedStore.store.id ? current : matchedStore.store.id,
      );
      setShowRoute(false);
      setRouteSummary(null);
      setMapFocusMode('selected');
      setMapFocusNonce(current => current + 1);
      setSheetExpanded(true);
      setMapOnly(false);
    };

    syncSelectionFromUrl();
    window.addEventListener('popstate', syncSelectionFromUrl);
    return () => window.removeEventListener('popstate', syncSelectionFromUrl);
  }, [selectedSlug, selectedStoreIdInitial, visibleStores]);

  useEffect(() => {
    setListPage(1);
    setShowRoute(false);
    setRouteSummary(null);
    setMapFocusMode('stores');
    setMapFocusNonce(current => current + 1);
    setSheetExpanded(variant === 'immersive');

    if (typeof window === 'undefined') {
      setSelectedStoreId(null);
      return;
    }

    const params = new URL(window.location.href).searchParams;
    const hasSelection =
      Boolean(params.get('store')?.trim()) ||
      Boolean(params.get('storeId')?.trim()) ||
      Boolean(params.get('business')?.trim());

    if (!hasSelection) {
      setSelectedStoreId(null);
    }
  }, [category, city, query, variant]);

  useEffect(() => {
    if (variant !== 'immersive') return;
    setMapOnly(initialMapOnly);
    setSheetExpanded(!initialMapOnly);
  }, [initialMapOnly, variant]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const desktopPanelQuery = window.matchMedia('(min-width: 1024px)');
    const syncMapPanelMode = () => {
      const isDesktop = desktopPanelQuery.matches;
      setCanUseDesktopMapPanel(isDesktop);
      if (isDesktop) setMobileMapOpen(false);
      if (variant === 'immersive') setSheetExpanded(true);
    };

    syncMapPanelMode();
    desktopPanelQuery.addEventListener('change', syncMapPanelMode);
    return () =>
      desktopPanelQuery.removeEventListener('change', syncMapPanelMode);
  }, [variant]);

  const handleSelectStore = useCallback(
    (storeId: string, options?: { scrollToPreview?: boolean }) => {
      const store =
        visibleStores.find(item => item.store.id === storeId)?.store ||
        mapPoints.find(item => item.id === storeId) ||
        null;
      if (!store) return;

      if (!visibleStores.some(item => item.store.id === storeId)) {
        setStores(current => {
          if (current.some(item => item.id === storeId)) return current;
          return [...current, store as DiscoveryStore];
        });
      }

      pendingScrollStoreIdRef.current = options?.scrollToPreview
        ? storeId
        : null;

      if (variant === 'immersive') {
        setSheetExpanded(true);
        setMapOnly(false);
      }

      setShowRoute(false);
      setRouteSummary(null);
      setMapFocusMode('selected');
      setMapFocusNonce(current => current + 1);
      setSelectedStoreId(storeId);

      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const selectionKey = store.slug?.trim() || store.id;
        const currentSelection =
          url.searchParams.get('store')?.trim() ||
          url.searchParams.get('storeId')?.trim() ||
          url.searchParams.get('business')?.trim() ||
          '';

        url.searchParams.set('view', 'map');
        url.searchParams.set('store', selectionKey);
        url.searchParams.delete('storeId');
        url.searchParams.delete('business');

        if (currentSelection !== selectionKey) {
          window.history.pushState(
            { ...window.history.state, umkmStore: selectionKey },
            '',
            url.pathname + url.search,
          );
        }
      }
    },
    [mapPoints, variant, visibleStores],
  );

  const handleClearSelectedStore = useCallback(() => {
    setSelectedStoreId(null);
    setShowRoute(false);
    setRouteSummary(null);
    setMapFocusMode('stores');
    setMapFocusNonce(current => current + 1);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('store');
      url.searchParams.delete('storeId');
      url.searchParams.delete('business');
      url.searchParams.set('view', 'map');
      window.history.replaceState(
        { ...window.history.state, umkmStore: null },
        '',
        url.pathname + url.search,
      );
    }
  }, []);
  const handleMapSelectStore = useCallback(
    (storeId: string) => {
      const point = mapPoints.find(item => item.id === storeId);
      if (point && !visibleStores.some(item => item.store.id === storeId)) {
        setStores(current => {
          if (current.some(item => item.id === storeId)) return current;
          return [...current, point as DiscoveryStore];
        });
      }
      handleSelectStore(storeId, { scrollToPreview: true });
    },
    [handleSelectStore, mapPoints, visibleStores],
  );
  const handleEdgeMapSelectStore = useCallback(
    (storeId: string) => {
      const point = mapPoints.find(item => item.id === storeId);
      if (point && !visibleStores.some(item => item.store.id === storeId)) {
        setStores(current => {
          if (current.some(item => item.id === storeId)) return current;
          return [...current, point as DiscoveryStore];
        });
      }
      handleSelectStore(storeId, { scrollToPreview: false });
    },
    [handleSelectStore, mapPoints, visibleStores],
  );

  useEffect(() => {
    if (!selectedPlace) return;
    if (pendingScrollStoreIdRef.current !== selectedPlace.store.id) return;

    pendingScrollStoreIdRef.current = null;

    const scrollToPreview = () => {
      const target = selectedPreviewRef.current;
      if (!target || typeof window === 'undefined') return;
      const top = target.getBoundingClientRect().top + window.scrollY - 84;
      window.scrollTo({
        top: Math.max(0, top),
        behavior: 'smooth',
      });
    };

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToPreview);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedPlace]);

  const handleOpenMapPreview = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (selectedStoreId) {
      setMapFocusMode('selected');
      setMapFocusNonce(current => current + 1);
    }
    if (window.innerWidth < 1024) {
      setMobileMapOpen(true);
    }
    const target =
      window.innerWidth >= 1024 ? desktopMapRef.current : mobileMapRef.current;
    window.requestAnimationFrame(() => {
      target?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, [selectedStoreId]);

  useEffect(() => {
    if (variant === 'immersive') return;
    if (!openMapSignal) return;
    handleOpenMapPreview();
  }, [handleOpenMapPreview, openMapSignal, variant]);

  useBodyScrollLock(mobileMapOpen && variant !== 'immersive');

  const visibleTotal =
    (category && category !== 'all') || discoveryScope !== 'registered'
      ? visibleStores.length
      : (totalCount ?? stores.length);
  const totalUnit =
    discoveryScope === 'references'
      ? isId
        ? 'referensi'
        : 'references'
      : discoveryScope === 'registered'
        ? isId
          ? 'usaha'
          : 'businesses'
        : isId
          ? 'lokasi'
          : 'locations';
  const resultHasMore =
    discoveryScope === 'references' ? canLoadMoreReferences : hasMore;
  const totalLabel =
    loading && totalCount === null
      ? isId
        ? 'Memuat'
        : 'Loading'
      : `${visibleTotal}${resultHasMore ? '+' : ''} ${totalUnit}`;
  const mapResultLabel = `${visibleStores.length} ${totalUnit}`;
  const routeDistanceLabel = useMemo(() => {
    if (!routeSummary?.distance_m || routeSummary.used_fallback) return null;
    return formatUmkmPlaceDistance(routeSummary.distance_m / 1000, isId);
  }, [isId, routeSummary]);
  const bumpMapFocus = useCallback(
    (mode: 'stores' | 'viewer' | 'route' | 'selected' | 'indonesia') => {
      setMapFocusMode(mode);
      setMapFocusNonce(current => current + 1);
    },
    [],
  );

  // Browser location may be used for distance/range filtering, but the map
  // stays on the Indonesia-wide view until the user explicitly focuses location.
  const handleMapRangeChange = useCallback(
    async (value: string) => {
      if (value === 'all') {
        setMapRangeKm(null);
        bumpMapFocus('indonesia');
        return;
      }

      const nextRangeKm = Number(value);
      if (!Number.isFinite(nextRangeKm) || nextRangeKm <= 0) return;
      const nextLocation = viewerLocation || (await requestViewerLocation());
      if (!nextLocation) return;

      setMapRangeKm(nextRangeKm);
      bumpMapFocus('viewer');
    },
    [bumpMapFocus, requestViewerLocation, viewerLocation],
  );

  const cycleMapTheme = useCallback(() => {
    setMapTheme(current => getNextUmkmMapTheme(current));
  }, []);

  useEffect(() => {
    if (!selectedPlaceId) return;
    setRouteSummary(null);
  }, [selectedPlaceId]);

  useEffect(() => {
    if (showRoute && selectedPlace) {
      bumpMapFocus('route');
    }
  }, [bumpMapFocus, selectedPlace, showRoute]);

  const renderDiscoveryMap = useCallback(
    (className: string, edgeToEdge = false) => {
      const activeSelectedStoreId = selectedPlace?.store.id || null;
      const viewerFocusOffset = edgeToEdge
        ? {
            x: canUseDesktopMapPanel && !mapOnly ? 195 : 0,
            y:
              !canUseDesktopMapPanel && !mapOnly
                ? sheetExpanded
                  ? -140
                  : -48
                : 0,
          }
        : undefined;

      return (
        <div
          className={`relative isolate overflow-hidden ${
            edgeToEdge ? 'h-full rounded-none' : 'rounded-[20px]'
          }`}
        >
          <UmkmStoreMap
            stores={mapStores}
            selectedStoreId={activeSelectedStoreId}
            viewerLocation={viewerLocation}
            viewerAccuracyMeters={viewerAccuracyMeters}
            isId={isId}
            interactive={mapInteractive}
            theme={mapTheme}
            routeToStoreId={activeSelectedStoreId}
            showRoute={showRoute}
            onRouteResolved={setRouteSummary}
            focusMode={mapFocusMode}
            focusNonce={mapFocusNonce}
            focusOffset={viewerFocusOffset}
            onBoundsChange={handleMapBoundsChange}
            onSelectStore={
              edgeToEdge ? handleEdgeMapSelectStore : handleMapSelectStore
            }
            showPopups={false}
            className={className}
          />
          <div
            className={cn(
              'pointer-events-none absolute z-[1100]',
              edgeToEdge
                ? 'right-3 top-[calc(env(safe-area-inset-top)+10.25rem)] sm:top-[calc(env(safe-area-inset-top)+9.65rem)] lg:right-4 lg:top-[calc(env(safe-area-inset-top)+7.25rem)]'
                : 'bottom-3 left-3 sm:bottom-4',
            )}
          >
            <div className="pointer-events-auto mb-2 flex justify-end">
              <label className="flex items-center gap-1 rounded-full border border-white/80 bg-white/94 px-2 py-1 text-[9px] font-bold text-slate-700 shadow-sm backdrop-blur dark:border-slate-700/80 dark:bg-slate-950/90 dark:text-slate-200">
                <span>{isId ? 'Radius' : 'Radius'}</span>
                <select
                  value={mapRangeKm === null ? 'all' : String(mapRangeKm)}
                  onChange={event => {
                    void handleMapRangeChange(event.target.value);
                  }}
                  className="max-w-[82px] bg-transparent text-[9px] font-black outline-none"
                  aria-label={isId ? 'Jangkauan peta' : 'Map range'}
                >
                  <option value="all">{isId ? 'Seluruh Indonesia' : 'All Indonesia'}</option>
                  {[3, 5, 10, 25, 50, 100].map(value => (
                    <option key={value} value={value}>
                      {value} km
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <MapQuickControls
              isId={isId}
              interactive={mapInteractive}
              locating={locating}
              locationError={locationError}
              locationReady={Boolean(viewerLocation)}
              locationAccuracyMeters={viewerAccuracyMeters}
              locationState={locationState}
              routeEnabled={showRoute}
              distanceLabel={routeDistanceLabel}
              themeLabel={getUmkmMapThemeLabel(mapTheme, isId)}
              onCycleTheme={cycleMapTheme}
              compact={edgeToEdge}
              onToggleInteractive={() => setMapInteractive(current => !current)}
              onFocusViewer={async () => {
                const previousLocation = viewerLocation;
                if (previousLocation) bumpMapFocus('viewer');
                const nextLocation = await requestViewerLocation();
                if (!nextLocation) return;
                if (
                  !previousLocation ||
                  Math.abs(previousLocation.lat - nextLocation.lat) > 0.0005 ||
                  Math.abs(previousLocation.lng - nextLocation.lng) > 0.0005
                ) {
                  bumpMapFocus('viewer');
                }
              }}
              onToggleRoute={async () => {
                if (showRoute) {
                  setShowRoute(false);
                  bumpMapFocus('selected');
                  return;
                }

                const nextLocation = await requestViewerLocation();
                if (!nextLocation && !viewerLocation) return;
                setShowRoute(true);
                bumpMapFocus('route');
              }}
            />
          </div>
        </div>
      );
    },
    [
      bumpMapFocus,
      cycleMapTheme,
      handleEdgeMapSelectStore,
      handleMapBoundsChange,
      handleMapSelectStore,
      isId,
      locating,
      locationError,
      locationState,
      mapFocusMode,
      mapFocusNonce,
      mapInteractive,
      mapOnly,
      mapTheme,
      requestViewerLocation,
      routeDistanceLabel,
      canUseDesktopMapPanel,
      selectedPlace,
      sheetExpanded,
      showRoute,
      viewerAccuracyMeters,
      viewerLocation,
      mapStores,
      handleMapRangeChange,
      mapRangeKm,
    ],
  );

  if (variant === 'immersive') {
    const sheetTitle =
      title || (isId ? 'Cari usaha sekitar' : 'Businesses around you');
    const sheetSubtitle =
      description ||
      (city?.trim()
        ? isId
          ? `Area ${city.trim()}`
          : `${city.trim()} area`
        : isId
          ? 'Pilih usaha, cek singkat, lalu chat atau buka rute.'
          : 'Move the map, pick a pin, then chat or open route.');

    return (
      <section
        className="absolute inset-0
    h-full w-full
    overflow-hidden overscroll-none
    bg-slate-100 text-[color:var(--app-text)]
    dark:bg-slate-950"
      >
        <div className="absolute inset-0">
          {renderDiscoveryMap('h-full w-full', true)}
        </div>

        {!error && storesBackendDegraded ? (
          <div
            className="pointer-events-auto absolute left-3 right-3 top-[calc(env(safe-area-inset-top)+11.75rem)] z-[1150] mx-auto max-w-md rounded-full border border-amber-200 bg-amber-50/95 px-3 py-2 text-center text-[10px] font-semibold text-amber-800 shadow-[0_14px_28px_-24px_rgba(245,158,11,0.35)] backdrop-blur dark:border-amber-900/70 dark:bg-amber-950/90 dark:text-amber-200"
            role="status"
            data-testid="umkm-degraded-map-state"
          >
            {isId
              ? 'Sebagian data usaha sedang tidak tersedia. Titik referensi publik tetap ditampilkan.'
              : 'Some business data is temporarily unavailable. Public reference points remain visible.'}
          </div>
        ) : null}

        {error ? (
          <div
            className="absolute left-3 right-3 top-[calc(env(safe-area-inset-top)+13.25rem)] z-[1160] mx-auto max-w-md rounded-[22px] border border-rose-200 bg-white/96 p-4 text-center shadow-[0_18px_44px_-28px_rgba(244,63,94,0.36)] dark:border-rose-900/60 dark:bg-slate-950/94"
            role="alert"
            data-testid="umkm-error-state"
          >
            <AlertTriangle className="mx-auto h-5 w-5 text-rose-600" />
            <p className="mt-2 text-[12px] font-semibold leading-5 text-rose-700 dark:text-rose-200">
              {error}
            </p>
            <button
              type="button"
              onClick={() => setReloadNonce(current => current + 1)}
              className="mt-3 inline-flex min-h-9 items-center justify-center rounded-full bg-rose-600 px-4 text-[11px] font-bold text-white transition hover:bg-rose-700"
            >
              {isId ? 'Coba lagi' : 'Try again'}
            </button>
          </div>
        ) : null}

        {loading && mapOnly && !selectedPlace && !error ? (
          <div
            className="absolute left-3 right-3 top-[calc(env(safe-area-inset-top)+13rem)] z-[1160] mx-auto max-w-xs rounded-full border border-white/80 bg-white/94 px-4 py-2 text-center text-[11px] font-bold text-slate-700 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.32)] dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-100"
            role="status"
          >
            {isId ? 'Mencari usaha sekitar...' : 'Finding nearby businesses...'}
          </div>
        ) : null}

        {!error && !mapOnly ? (
          <div
            className={cn(
              'absolute inset-x-2 bottom-2 z-[1250] mx-auto flex w-[calc(100%-1rem)] max-w-[760px] flex-col overflow-hidden rounded-[20px] border border-slate-200/90 bg-white/98 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] shadow-[0_-18px_48px_-30px_rgba(15,23,42,0.42)] backdrop-blur-xl transition-all duration-300 sm:inset-x-3 sm:w-[calc(100%-1.5rem)] sm:rounded-[22px] dark:border-slate-800 dark:bg-slate-950/96',
              'lg:inset-x-auto lg:bottom-3 lg:left-3 lg:top-[calc(env(safe-area-inset-top)+6.85rem)] lg:mx-0 lg:w-[400px] lg:max-w-none lg:rounded-[16px] lg:shadow-[0_18px_42px_-24px_rgba(15,23,42,0.42)]',
              sheetExpanded
                ? 'max-h-[min(78svh,calc(var(--app-viewport-height)-5.5rem))] lg:max-h-[calc(var(--app-viewport-height)-7.15rem)]'
                : 'max-h-[106px] min-h-[106px] lg:max-h-[calc(var(--app-viewport-height)-7.15rem)] lg:min-h-0',
            )}
            data-testid="umkm-results-sheet"
          >
            <button
              type="button"
              onClick={() => setSheetExpanded(current => !current)}
              className="mx-auto mb-0.5 flex h-6 w-12 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100 lg:hidden"
              aria-expanded={sheetExpanded}
              aria-label={
                sheetExpanded
                  ? isId
                    ? 'Kecilkan daftar'
                    : 'Collapse list'
                  : isId
                    ? 'Perbesar daftar'
                    : 'Expand list'
              }
            >
              {sheetExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>

            {!selectedPlace && ( <div className="flex min-w-0 shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-1 sm:px-4">
              <div className="min-w-0">
                <h1 className="line-clamp-1 text-sm font-bold leading-tight tracking-[-0.035em] text-[color:var(--app-text)] sm:text-lg">
                  {sheetTitle}
                </h1>
                <p className="mt-0.5 hidden line-clamp-1 text-[10px] font-medium leading-4 text-[color:var(--app-text-soft)] lg:block">
                  {sheetSubtitle}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="inline-flex max-w-[86px] items-center justify-center truncate rounded-full border border-slate-200 bg-white px-2 py-1 text-[9.5px] font-bold leading-none text-slate-600 sm:max-w-none">
                  {totalLabel}
                </span>
              </div>
            </div> 
  )}

            {selectedPlace ? (
              <div
                className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pb-3 pt-1 [scrollbar-gutter:stable] [scrollbar-width:thin]"
                role="region"
                tabIndex={0}
                aria-label={
                  selectedIsPublicReference
                    ? `${isId ? 'Detail referensi' : 'Reference details'} ${selectedPlace.store.name}`
                    : isId
                      ? `Detail usaha ${selectedPlace.store.name}`
                      : `${selectedPlace.store.name} business details`
                }
              >
                <button
                  type="button"
                  onClick={handleClearSelectedStore}
                  className="mb-2 inline-flex min-h-7 items-center gap-1 rounded-full bg-slate-100 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label={isId ? 'Kembali ke hasil peta' : 'Back to map results'}
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  {isId ? 'Kembali' : 'Back'}
                </button>
                <article
                  className="space-y-3 bg-transparent p-0 shadow-none ring-0"
                  data-testid={
                    selectedIsPublicReference
                      ? 'umkm-selected-public-reference'
                      : 'umkm-selected-business'
                  }
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-bold text-[color:var(--app-text-soft)]">
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
                        {selectedPlace.ui.kindLabel}
                      </span>
                      {selectedIsPublicReference ? (
                        <PublicReferenceBadge isId={isId} />
                      ) : selectedTrustProfile ? (
                        <TrustStatusChip profile={selectedTrustProfile} compact />
                      ) : null}
                      {selectedOpenStatus ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1',
                            selectedPlace.ui.openNow === true
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : selectedPlace.ui.openNow === false
                                ? 'text-slate-600 dark:text-slate-300'
                                : 'text-amber-700 dark:text-amber-300',
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              selectedPlace.ui.openNow === true
                                ? 'bg-emerald-500'
                                : selectedPlace.ui.openNow === false
                                  ? 'bg-slate-400'
                                  : 'bg-amber-400',
                            )}
                          />
                          {selectedOpenStatus.label}
                        </span>
                      ) : null}
                      {selectedLocationLabel ? (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0 text-[color:var(--app-accent)]" />
                          <span className="truncate">{selectedLocationLabel}</span>
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-1.5 line-clamp-2 text-[1.08rem] font-bold leading-tight tracking-[-0.035em] text-[color:var(--app-text)]">
                      {selectedPlace.store.name}
                    </h3>

                    <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-[color:var(--app-text-soft)]">
                      {selectedAddressLabel}
                    </p>
                  </div>

                  <div
                    className={cn(
                      'mt-2 grid gap-1.5',
                      selectedCompactActionGrid,
                    )}
                  >
                    <Link
                      href={buildUmkmMapPlacePath(selectedPlace.store)}
                      aria-label={
                        selectedIsPublicReference
                          ? `${isId ? 'Detail referensi' : 'Reference details'} ${selectedPlace.store.name}`
                          : undefined
                      }
                      className="inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-accent)] px-3 text-[11px] font-bold text-white"
                    >
                      <Store className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {selectedIsPublicReference
                          ? isId
                            ? 'Lihat sumber'
                            : 'View source'
                          : isId
                            ? 'Buka usaha'
                            : 'Open business'}
                      </span>
                    </Link>
                    {selectedIsPublicReference &&
                    selectedReferenceProvenance?.sourceUrl ? (
                      <a
                        href={selectedReferenceProvenance.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[38px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-sky-50 px-3 text-[11px] font-bold text-sky-700 dark:bg-sky-950/50 dark:text-sky-200"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {isId ? 'Sumber asli' : 'Original source'}
                        </span>
                      </a>
                    ) : selectedContactHref ? (
                      <a
                        href={selectedContactHref}
                        target={
                          selectedContactIsExternal ? '_blank' : undefined
                        }
                        rel={
                          selectedContactIsExternal ? 'noreferrer' : undefined
                        }
                        className="inline-flex min-h-[38px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-3 text-[11px] font-bold text-[color:var(--app-accent)]"
                      >
                        <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{selectedContactLabel}</span>
                      </a>
                    ) : null}
                    {selectedRouteHref ? (
                      <a
                        href={selectedRouteHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[38px] min-w-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] dark:bg-slate-800 dark:text-slate-100"
                        aria-label={isId ? 'Buka rute' : 'Open route'}
                      >
                        <Navigation className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    ) : null}
                  </div>

                </article>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-2">
                {loading ? (
                  <div
                    className="grid gap-2"
                    aria-busy="true"
                    aria-label={
                      isId ? 'Memuat daftar usaha' : 'Loading businesses'
                    }
                  >
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="flex gap-3 border-b border-slate-200/80 py-3 dark:border-slate-800"
                      >
                        <Skeleton className="h-14 w-14 shrink-0 rounded-[14px] sm:h-16 sm:w-16" />
                        <div className="min-w-0 flex-1 py-0.5">
                          <Skeleton variant="line" className="h-4 w-2/3" />
                          <Skeleton variant="line" className="mt-2 h-3 w-1/2" />
                          <Skeleton variant="line" className="mt-3 h-3 w-4/5" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : paginatedListedPlaces.length > 0 ? (
                  <div className="grid min-h-0 min-w-0 flex-1 auto-rows-min gap-2 overflow-y-auto overscroll-contain px-0.5 pb-1 [scrollbar-gutter:stable] [scrollbar-width:thin]">
                    {paginatedListedPlaces.map(item => {
                      if (isUmkmMapPublicReference(item.store)) {
                        return (
                          <PublicReferenceResultCard
                            key={item.store.id}
                            place={item}
                            isId={isId}
                            compact
                            onSelect={() => handleSelectStore(item.store.id)}
                          />
                        );
                      }
                      const openStatus = getOpenStatusProfile(
                        item.ui.openNow,
                        isId,
                      );
                      const trustProfile = getUmkmTrustProfile(
                        item.store,
                        isId,
                      );
                      return (
                        <button
                          key={item.store.id}
                          type="button"
                          onClick={() => handleSelectStore(item.store.id)}
                          className="group relative flex min-w-0 w-full items-center gap-3.5 rounded-[16px] border border-slate-200/80 bg-white px-3 py-3 text-left shadow-[0_8px_24px_-22px_rgba(15,23,42,0.3)] transition hover:border-slate-300 hover:shadow-[0_14px_30px_-22px_rgba(15,23,42,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] dark:border-slate-800 dark:bg-slate-950/78 dark:hover:border-slate-700"
                          data-testid="umkm-business-card"
                        >
                          <PlaceThumb
                            src={item.ui.gallery[0] || item.ui.coverImage}
                            alt={item.store.name}
                            className="h-14 w-14 shrink-0 rounded-[14px] sm:h-16 sm:w-16"
                          />
                          <span className="min-w-0">
                            <span className="line-clamp-1 text-[13px] font-bold leading-tight tracking-[-0.015em] text-[color:var(--app-text)]">
                              {item.store.name}
                            </span>
                            <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9.5px] font-semibold text-[color:var(--app-text-soft)]">
                              {item.ui.ratingNumber > 0 ? (
                                <RatingStars
                                  rating={item.ui.ratingNumber}
                                  countLabel={item.ui.reviewCountLabel}
                                  isId={isId}
                                  compact
                                />
                              ) : (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9.5px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                                  {isId ? 'Baru' : 'New'}
                                </span>
                              )}
                              <span>{item.ui.kindLabel}</span>
                              {trustProfile.tier !== 'unverified' ? (
                                <TrustStatusChip
                                  profile={trustProfile}
                                  compact
                                />
                              ) : null}
                            </span>
                            <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[10px]">
                              <span
                                className={cn(
                                  'inline-flex shrink-0 items-center gap-1.5 font-semibold',
                                  openStatus.textClassName,
                                )}
                              >
                                <span
                                  className={cn(
                                    'h-1.5 w-1.5 rounded-full',
                                    openStatus.dotClassName,
                                  )}
                                />
                                {openStatus.label}
                              </span>
                              <span className="flex min-w-0 items-center gap-1 text-[color:var(--app-text-soft)]">
                                <MapPin className="h-3 w-3 shrink-0 text-[color:var(--app-accent)]" />
                                <span className="truncate">
                                  {getPlaceLocationLabel(item, isId)}
                                </span>
                              </span>
                            </span>
                          </span>
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition group-hover:bg-[color:var(--app-accent)] group-hover:text-white dark:bg-slate-800 dark:text-slate-300">
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        </button>
                      );
                    })}

                    <div
                      ref={immersiveLoadMoreSentinelRef}
                      data-testid="umkm-load-more-sentinel-immersive"
                      aria-hidden="true"
                      className="h-1 w-full"
                    />
                  </div>
                ) : (
                  <div
                    className="rounded-[18px] border border-dashed border-slate-300 bg-white px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-900/84"
                    data-testid="umkm-empty-state"
                  >
                    <Store className="mx-auto h-6 w-6 text-slate-400" />
                    <p className="mt-2 text-[12px] font-bold text-[color:var(--app-text)]">
                      {isId
                        ? 'Belum ada usaha yang cocok'
                        : 'No matching businesses'}
                    </p>
                    <p className="mx-auto mt-1 max-w-xs text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                      {isId
                        ? 'Coba kata kunci lain atau hapus filter untuk melihat semua usaha.'
                        : 'Try another keyword or clear filters to see all businesses.'}
                    </p>
                    {query?.trim() || city?.trim() ? (
                      <Link
                        href="/umkm"
                        className="mt-3 inline-flex min-h-9 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-4 text-[11px] font-bold text-white"
                      >
                        {isId ? 'Hapus filter' : 'Clear filters'}
                      </Link>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {!error && mapOnly ? (
          <button
            type="button"
            onClick={() => {
              setMapOnly(false);
              setSheetExpanded(true);
            }}
            className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[1250] inline-flex min-h-[44px] -translate-x-1/2 items-center gap-2 rounded-full border border-white/80 bg-white/95 px-4 text-[12px] font-bold text-slate-800 shadow-[0_22px_52px_-32px_rgba(15,23,42,0.42)]  transition hover:-translate-y-0.5 hover:text-[color:var(--app-accent)] dark:border-white/10 dark:bg-slate-950/90 dark:text-slate-100"
          >
            <List className="h-4 w-4 text-[color:var(--app-accent)]" />
            {isId ? 'Lihat daftar usaha' : 'Show business list'}
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="min-w-0 overflow-hidden bg-transparent pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-3">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[1.08rem] font-bold tracking-[-0.035em] text-[color:var(--app-text)] sm:text-[1.35rem]">
              {title || (isId ? 'Usaha di sekitarmu' : 'Businesses near you')}
            </h2>
            <p className="mt-0.5 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
              {description ||
                (isId
                  ? 'Cari usaha, cek info singkat, lalu hubungi.'
                  : 'Pick fast, open fast.')}
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <DiscoveryScopeControl
              scope={discoveryScope}
              isId={isId}
              compact
              onChange={handleDiscoveryScopeChange}
            />
            <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] shadow-[0_12px_26px_-22px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950">
              {totalLabel}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">          <button
            type="button"
            onClick={handleOpenMapPreview}
            className="inline-flex min-h-[36px] w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-[color:var(--app-accent)] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_10%,white)] sm:w-fit dark:border-slate-800 dark:bg-slate-950"
          >
            <MapPinned className="h-4 w-4" />
            {isId ? 'Buka peta' : 'Open map'}
          </button>
        </div>

        {error ? (
          <div
            className="rounded-[24px] border border-rose-200 bg-white px-4 py-8 text-center shadow-[0_18px_34px_-28px_rgba(15,23,42,0.14)]"
            role="alert"
          >
            <AlertTriangle className="mx-auto h-6 w-6 text-rose-600" />
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-rose-700">
              {error}
            </p>
            <button
              type="button"
              onClick={() => setReloadNonce(current => current + 1)}
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-rose-600 px-5 text-xs font-bold text-white transition hover:bg-rose-700"
            >
              {isId ? 'Coba lagi' : 'Try again'}
            </button>
          </div>
        ) : loading && !selectedPlace ? (
          <div
            className="grid gap-3 rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.14)]"
            aria-busy="true"
            aria-label={isId ? 'Memuat daftar usaha' : 'Loading businesses'}
          >
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <Skeleton className="h-20 w-24 shrink-0 rounded-[16px]" />
                <div className="min-w-0 flex-1">
                  <Skeleton variant="line" className="h-4 w-20" />
                  <Skeleton variant="line" className="mt-2 h-5 w-3/4" />
                  <SkeletonStack lines={2} className="mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : selectedPlace ? (
          <>
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-[18px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-2.5 dark:border-[color:var(--app-accent-border)]">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[color:var(--app-accent)]">
                  {isId ? 'Detail usaha' : 'Business detail'}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  {selectedPlace.store.name}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearSelectedStore}
                className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-[10px] font-bold text-[color:var(--app-accent)] shadow-sm dark:bg-slate-950"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {isId ? 'Kembali ke peta' : 'Back to map'}
              </button>
            </div>

            <div className="grid min-w-0 gap-3 lg:grid-cols-1 lg:gap-4">
              <div className="min-w-0 space-y-3">
                <article
                  ref={selectedPreviewRef}
                  aria-label={
                    selectedIsPublicReference
                      ? `${isId ? 'Detail referensi' : 'Reference details'} ${selectedPlace.store.name}`
                      : undefined
                  }
                  className="min-w-0 overflow-hidden rounded-[18px] border border-slate-200/80 bg-white p-2.5 shadow-[0_18px_38px_-28px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950/82 sm:rounded-[22px] sm:p-3"
                >
                  <div className="grid min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-2.5 min-[420px]:grid-cols-[128px_minmax(0,1fr)] sm:grid-cols-[minmax(0,170px)_minmax(0,1fr)] sm:gap-3 lg:grid-cols-[minmax(0,190px)_minmax(0,1fr)]">
                    <PlaceThumb
                      src={
                        selectedPlace.ui.gallery[0] ||
                        selectedPlace.ui.coverImage
                      }
                      alt={selectedPlace.store.name}
                      className="h-[112px] rounded-[15px] min-[420px]:h-[124px] sm:h-[150px] sm:rounded-[18px]"
                    />

                    <div className="min-w-0 self-center">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold sm:text-[11px]">
                        {selectedIsPublicReference ? (
                          <PublicReferenceBadge isId={isId} />
                        ) : (
                          <RatingStars
                            rating={selectedPlace.ui.ratingNumber}
                            countLabel={selectedPlace.ui.reviewCountLabel}
                            isId={isId}
                            compact
                          />
                        )}
                        <span className="text-[color:var(--app-text-soft)]">
                          {selectedPlace.ui.kindLabel}
                        </span>
                        {selectedTrustProfile ? (
                          <TrustStatusChip
                            profile={selectedTrustProfile}
                            compact
                          />
                        ) : null}
                      </div>

                      <h3 className="mt-1.5 line-clamp-2 text-[1.02rem] font-bold leading-tight text-[color:var(--app-text)] sm:text-[1.35rem]">
                        <Link
                          href={buildUmkmMapPlacePath(selectedPlace.store)}
                          aria-label={
                            selectedIsPublicReference
                              ? `${isId ? 'Detail referensi' : 'Reference details'} ${selectedPlace.store.name}`
                              : undefined
                          }
                        >
                          {selectedPlace.store.name}
                        </Link>
                      </h3>

                      <p
                        className={cn(
                          'mt-1.5 inline-flex items-center gap-2 text-[12px] font-semibold sm:text-[13px]',
                          selectedOpenStatus?.textClassName,
                        )}
                      >
                        <span
                          className={cn(
                            'h-2.5 w-2.5 rounded-full',
                            selectedOpenStatus?.dotClassName,
                          )}
                        />
                        {selectedOpenStatus?.label}
                      </p>

                      <p className="mt-0.5 truncate text-[12px] text-[color:var(--app-text-soft)] sm:text-[13px]">
                        {selectedLocationLabel}
                      </p>

                      <p className="mt-2 hidden text-[12px] leading-5 text-[color:var(--app-text-soft)] min-[420px]:line-clamp-2 min-[420px]:block">
                        {selectedPlace.store.description ||
                          selectedPlace.ui.addressLine}
                      </p>

                      <div
                        className={cn(
                          'mt-2.5 grid gap-1.5 sm:flex sm:flex-wrap sm:gap-2',
                          selectedActionGrid,
                        )}
                      >
                        <Link
                          href={buildUmkmMapPlacePath(selectedPlace.store)}
                          aria-label={
                            selectedIsPublicReference
                              ? `${isId ? 'Detail referensi' : 'Reference details'} ${selectedPlace.store.name}`
                              : undefined
                          }
                          className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-2.5 text-[12px] font-semibold text-white shadow-[0_16px_28px_-24px_color-mix(in_srgb,var(--app-accent)_40%,transparent)] transition hover:brightness-105 sm:px-3"
                        >
                          <Store className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {selectedIsPublicReference
                              ? isId
                                ? 'Lihat referensi'
                                : 'View reference'
                              : isId
                                ? 'Buka detail usaha'
                                : 'Open business detail'}
                          </span>
                        </Link>
                        {selectedIsPublicReference &&
                        selectedReferenceProvenance?.sourceUrl ? (
                          <a
                            href={selectedReferenceProvenance.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 text-[12px] font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-200 sm:px-3"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {isId ? 'Sumber asli' : 'Original source'}
                            </span>
                          </a>
                        ) : selectedContactHref ? (
                          <a
                            href={selectedContactHref}
                            target={
                              selectedContactIsExternal ? '_blank' : undefined
                            }
                            rel={
                              selectedContactIsExternal
                                ? 'noreferrer'
                                : undefined
                            }
                            className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-2.5 text-[12px] font-semibold text-[color:var(--app-accent)] transition hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_72%,white)] sm:px-3"
                          >
                            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {selectedContactLabel}
                            </span>
                          </a>
                        ) : null}
                        {selectedRouteHref ? (
                          <a
                            href={selectedRouteHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 sm:px-3"
                          >
                            <Navigation className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {isId ? 'Rute' : 'Route'}
                            </span>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>

                <div className="grid gap-3 sm:grid-cols-2">
                  <section className="min-w-0 overflow-hidden rounded-[20px] border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/82">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">Media</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-text)]">
                          {selectedPlace.ui.gallery.length
                            ? selectedPlace.ui.gallery.length + ' ' + (isId ? 'media' : 'items')
                            : isId
                              ? 'Belum ada media'
                              : 'No media yet'}
                        </p>
                      </div>
                      <Link
                        href={buildUmkmMapPlacePath(selectedPlace.store)}
                        className="text-[10px] font-bold text-[color:var(--app-accent)]"
                      >
                        {isId ? 'Buka detail' : 'Open detail'}
                      </Link>
                    </div>
                    {selectedPlace.ui.gallery.length ? (
                      <div className="mt-2 grid grid-cols-4 gap-1.5">
                        {selectedPlace.ui.gallery.slice(0, 4).map((src, index) => (
                          <Link
                            key={src + index}
                            href={buildUmkmMapPlacePath(selectedPlace.store)}
                            className="relative block aspect-square overflow-hidden rounded-[12px] bg-slate-100 dark:bg-slate-800"
                            aria-label={(isId ? 'Buka media ' : 'Open media ') + String(index + 1)}
                          >
                            <PlaceThumb
                              src={src}
                              alt={selectedPlace.store.name + ' ' + String(index + 1)}
                              className="h-full w-full rounded-[12px]"
                            />
                            {index === 3 && selectedPlace.ui.gallery.length > 4 ? (
                              <span className="absolute inset-0 grid place-items-center bg-black/50 text-[11px] font-extrabold text-white">
                                +{selectedPlace.ui.gallery.length - 4}
                              </span>
                            ) : null}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </section>

                  <section className="min-w-0 overflow-hidden rounded-[20px] border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/82">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
                          {isId ? 'Produk' : 'Products'}
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-text)]">
                          {selectedProductsLoading
                            ? isId
                              ? 'Memuat produk...'
                              : 'Loading products...'
                            : selectedPlace.store.products?.length
                              ? isId
                                ? 'Produk yang tersedia'
                                : 'Available products'
                              : isId
                                ? 'Produk belum tersedia'
                                : 'No products yet'}
                        </p>
                      </div>
                      <Link
                        href={buildUmkmMapPlacePath(selectedPlace.store)}
                        className="text-[10px] font-bold text-[color:var(--app-accent)]"
                      >
                        {isId ? 'Lihat semua' : 'View all'}
                      </Link>
                    </div>
                    {selectedPlace.store.products?.length ? (
                      <div className="mt-2 space-y-2">
                        {selectedPlace.store.products.slice(0, 3).map(product => (
                          <div key={product.id} className="flex min-w-0 items-center gap-2">
                            <PlaceThumb
                              src={product.image_url || selectedPlace.ui.gallery[0] || selectedPlace.ui.coverImage}
                              alt={product.name}
                              className="h-12 w-12 shrink-0 rounded-[12px]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-bold text-[color:var(--app-text)]">
                                {product.name}
                              </p>
                              <p className="mt-0.5 text-[10px] font-semibold text-[color:var(--app-accent)]">
                                {formatDiscoveryPrice(product.price_cents, isId)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </section>
                </div>

                {selectedIsPublicReference ? (
                  <PublicReferenceNotice
                    store={selectedPlace.store}
                    isId={isId}
                  />
                ) : selectedRiskProfile?.highRisk && selectedTrustProfile ? (
                  <SafetyNotice
                    isId={isId}
                    trustProfile={selectedTrustProfile}
                    riskProfile={selectedRiskProfile}
                    reportHref={selectedReportHref}
                  />
                ) : null}

                {!canUseDesktopMapPanel ? (
                  <div ref={mobileMapRef} className="lg:hidden">
                    {mobileMapOpen ? (
                      <div className="fixed inset-0 z-[9999] flex h-[var(--app-viewport-height)] min-h-0 flex-col overflow-hidden bg-[color:var(--app-surface-strong)] dark:bg-slate-950">
                        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)] dark:border-slate-800">
                          <div>
                            <p className="text-[15px] font-bold tracking-[-0.03em] text-[color:var(--app-text)]">
                              Lajukan Maps
                            </p>
                            <p className="text-[11px] text-[color:var(--app-text-soft)]">
                              {mapResultLabel}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setMobileMapOpen(false)}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]"
                            aria-label={isId ? 'Tutup peta' : 'Close map'}
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>

                        <div className="min-h-0 flex-1">
                          {renderDiscoveryMap('h-full w-full', true)}
                        </div>

                        <div className="shrink-0 space-y-2 border-t border-slate-200 bg-[color:var(--app-surface-strong)] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 dark:border-slate-800 dark:bg-slate-950">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <PlaceThumb
                              src={
                                selectedPlace.ui.gallery[0] ||
                                selectedPlace.ui.coverImage
                              }
                              alt={selectedPlace.store.name}
                              className="h-12 w-12 rounded-[14px]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-1 text-sm font-bold text-[color:var(--app-text)]">
                                {selectedPlace.store.name}
                              </p>
                              <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                                {selectedLocationLabel}
                              </p>
                              {selectedIsPublicReference ? (
                                <div className="mt-1">
                                  <PublicReferenceBadge isId={isId} />
                                  {selectedReferenceProvenance?.sourceTitle ||
                                  selectedReferenceProvenance?.sourceLicense ? (
                                    <p className="mt-0.5 truncate text-[9.5px] font-semibold text-sky-800/76 dark:text-sky-200/76">
                                      {[
                                        selectedReferenceProvenance.sourceTitle,
                                        selectedReferenceProvenance.sourceLicense,
                                      ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </p>
                                  ) : null}
                                </div>
                              ) : selectedTrustProfile ? (
                                <div className="mt-1">
                                  <TrustStatusChip
                                    profile={selectedTrustProfile}
                                    compact
                                  />
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div
                            className={cn('grid gap-1.5', selectedActionGrid)}
                          >
                            <Link
                              href={buildUmkmMapPlacePath(selectedPlace.store)}
                              aria-label={
                                selectedIsPublicReference
                                  ? `${isId ? 'Detail referensi' : 'Reference details'} ${selectedPlace.store.name}`
                                  : undefined
                              }
                              className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-accent)] px-2 text-[11px] font-bold text-white"
                            >
                              <Store className="h-3.5 w-3.5" />
                              <span className="truncate">
                                {selectedIsPublicReference
                                  ? isId
                                    ? 'Lihat referensi'
                                    : 'View reference'
                                  : isId
                                    ? 'Buka detail usaha'
                                    : 'Open business detail'}
                              </span>
                            </Link>
                            {selectedIsPublicReference &&
                            selectedReferenceProvenance?.sourceUrl ? (
                              <a
                                href={selectedReferenceProvenance.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-sky-50 px-2 text-[11px] font-bold text-sky-700 dark:bg-sky-950/50 dark:text-sky-200"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                <span className="truncate">
                                  {isId ? 'Sumber asli' : 'Original source'}
                                </span>
                              </a>
                            ) : selectedContactHref ? (
                              <a
                                href={selectedContactHref}
                                target={
                                  selectedContactIsExternal
                                    ? '_blank'
                                    : undefined
                                }
                                rel={
                                  selectedContactIsExternal
                                    ? 'noreferrer'
                                    : undefined
                                }
                                className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-2 text-[11px] font-bold text-[color:var(--app-accent)]"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                <span className="truncate">
                                  {selectedContactLabel}
                                </span>
                              </a>
                            ) : null}
                            {selectedRouteHref ? (
                              <a
                                href={selectedRouteHref}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-surface-muted)] px-2 text-[11px] font-bold text-[color:var(--app-text)]"
                              >
                                <Navigation className="h-3.5 w-3.5" />
                                <span className="truncate">
                                  {isId ? 'Rute' : 'Route'}
                                </span>
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-[20px] border border-slate-200/80 bg-white p-2 shadow-[0_18px_38px_-28px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950/82">
                        <div className="flex min-w-0 items-center justify-between gap-3 px-2 pb-2 pt-1">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-bold text-[color:var(--app-text)]">
                              Lajukan Maps
                            </p>
                            <p className="truncate text-[11px] text-[color:var(--app-text-soft)]">
                              {mapResultLabel}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setMobileMapOpen(true)}
                            className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--app-accent)] px-3 text-[11px] font-bold text-white"
                          >
                            <MapPinned className="h-3.5 w-3.5" />
                            {isId ? 'Penuh' : 'Full'}
                          </button>
                        </div>
                        {renderDiscoveryMap('h-[320px] w-full sm:h-[360px]')}
                      </div>
                    )}
                  </div>
                ) : null}

                {paginatedListedPlaces.length > 0 ? (
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {paginatedListedPlaces.map(item => {
                      if (isUmkmMapPublicReference(item.store)) {
                        return (
                          <PublicReferenceResultCard
                            key={item.store.id}
                            place={item}
                            isId={isId}
                            onSelect={() =>
                              handleSelectStore(item.store.id, {
                                scrollToPreview: true,
                              })
                            }
                          />
                        );
                      }
                      const openStatus = getOpenStatusProfile(
                        item.ui.openNow,
                        isId,
                      );
                      const trustProfile = getUmkmTrustProfile(
                        item.store,
                        isId,
                      );
                      return (
                        <button
                          key={item.store.id}
                          type="button"
                          onClick={() =>
                            handleSelectStore(item.store.id, {
                              scrollToPreview: true,
                            })
                          }
                          className="w-full min-w-0 rounded-[16px] border border-slate-200/80 bg-white p-2 text-left shadow-[0_12px_26px_-24px_rgba(15,23,42,0.1)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_4%,white)] sm:rounded-[18px]"
                        >
                          <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2 sm:grid-cols-[82px_minmax(0,1fr)] xl:grid-cols-[88px_minmax(0,1fr)]">
                            <PlaceThumb
                              src={item.ui.gallery[0] || item.ui.coverImage}
                              alt={item.store.name}
                              className="h-[72px] rounded-[14px] sm:h-[82px] xl:h-[88px]"
                            />

                            <div className="min-w-0 self-center">
                              <h4 className="line-clamp-2 text-[13px] font-bold leading-tight text-[color:var(--app-text)] sm:text-[14px]">
                                {item.store.name}
                              </h4>

                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] font-semibold">
                                <span className={cn(
                                  'rounded-full border px-2 py-0.5 text-[9px] font-black',
                                  getUmkmMapSourceKind(item.store) === 'lajukan'
                                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 bg-slate-50 text-slate-600',
                                )}>
                                  {getUmkmMapSourceLabel(getUmkmMapSourceKind(item.store), isId)}
                                </span>
                                {item.ui.ratingNumber > 0 ? (
                                  <RatingStars
                                    rating={item.ui.ratingNumber}
                                    countLabel={item.ui.reviewCountLabel}
                                    isId={isId}
                                    compact
                                  />
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9.5px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                                    {isId ? 'Belum ada ulasan' : 'No reviews'}
                                  </span>
                                )}
                                <span className="text-[color:var(--app-text-soft)]">
                                  {item.ui.kindLabel}
                                </span>
                                {trustProfile.tier !== 'unverified' ? (
                                  <TrustStatusChip
                                    profile={trustProfile}
                                    compact
                                  />
                                ) : null}
                              </div>

                              <p
                                className={cn(
                                  'mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold',
                                  openStatus.textClassName,
                                )}
                              >
                                <span
                                  className={cn(
                                    'h-2 w-2 rounded-full',
                                    openStatus.dotClassName,
                                  )}
                                />
                                {openStatus.label}
                              </p>

                              <p className="mt-0.5 truncate text-[11px] text-[color:var(--app-text-soft)]">
                                {getPlaceLocationLabel(item, isId)}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-6 text-center text-[12px] text-[color:var(--app-text-soft)] shadow-[0_14px_30px_-24px_rgba(15,23,42,0.1)]">
                    {isId
                      ? 'Semua hasil yang ada sudah dipakai di kartu utama.'
                      : 'All available results are already used in the featured card.'}
                  </div>
                )}

                <div
                  ref={loadMoreSentinelRef}
                  data-testid="umkm-load-more-sentinel"
                  aria-hidden="true"
                  className="h-1 w-full"
                />
                {loadingMoreForScope ? (
                  <div
                    className="h-0 overflow-hidden"
                    aria-live="polite"
                    aria-label={
                      isId ? 'Memuat hasil berikutnya' : 'Loading more results'
                    }
                  />
                ) : null}
              </div>

              <aside
                ref={desktopMapRef}
                className="hidden lg:order-first lg:block"
              >
                <div className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-2 shadow-[0_20px_40px_-30px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950/82">
                  <div className="flex items-center justify-between px-3 pb-2 pt-1">
                    <div>
                      <p className="text-[13px] font-bold text-[color:var(--app-text)]">
                        {isId ? 'Peta usaha' : 'Business map'}
                      </p>
                      <p className="text-[11px] text-[color:var(--app-text-soft)]">
                        {mapResultLabel}
                      </p>
                    </div>
                  </div>

                  {canUseDesktopMapPanel
                    ? renderDiscoveryMap(
                        'h-[min(560px,calc(var(--app-viewport-height)-180px))] min-h-[430px] w-full',
                      )
                    : null}
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
