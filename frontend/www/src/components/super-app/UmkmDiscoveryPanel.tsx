'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileCheck2,
  Flag,
  List,
  MapPin,
  MapPinned,
  Maximize2,
  MessageCircle,
  Navigation,
  Phone,
  Search,
  ShieldCheck,
  ShieldQuestion,
  Store,
  X,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buildUmkmStorefrontPath } from '@/lib/umkmSurface';
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
import {
  getNextUmkmMapTheme,
  getUmkmMapThemeLabel,
  UmkmStoreMap,
  type UmkmMapRouteSummary,
  type UmkmMapStore,
  type UmkmMapTheme,
} from './UmkmStoreMap';
import { useViewerLocation } from './useViewerLocation';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

type UmkmDiscoveryPanelProps = {
  isId: boolean;
  query?: string;
  city?: string;
  limit?: number;
  title?: string;
  description?: string;
  selectedSlug?: string;
  selectedStoreIdInitial?: string;
  openMapSignal?: number;
  variant?: 'section' | 'immersive';
};

type DiscoveryStore = UmkmMapStore & {
  description: string | null;
  phone: string | null;
  offline_order_enabled?: boolean;
  online_order_enabled?: boolean;
  table_count?: number;
  available_table_count?: number;
  max_table_capacity?: number;
  reservation_enabled?: boolean;
  metadata?: Record<string, unknown>;
};

type StoresResponse = {
  data?: {
    items: DiscoveryStore[];
    count: number;
  };
  error?: string;
};

const DISCOVERY_REFRESH_INTERVAL_MS = 25000;
const LIST_PAGE_SIZE = 4;
const REPORT_EMAIL = 'support@lajukan.com';

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

function shouldUseDesktopMapPanel() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(min-width: 1024px)').matches
  );
}

function getOpenLabel(isOpen: boolean, isId: boolean) {
  if (isOpen) return isId ? 'Buka sekarang' : 'Open now';
  return isId ? 'Tutup' : 'Closed';
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

function isVisibleMapServiceBadge(badge: string) {
  return !/online|delivery|dipesan|pesan\s*online/i.test(badge);
}

function getVisibleMapServiceBadges(badges: string[]) {
  return badges.filter(isVisibleMapServiceBadge);
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

function normalizeTrustTier(value: string): UmkmTrustTier | null {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return null;
  if (
    [
      'lajukan_verified',
      'verified_lajukan',
      'manual_verified',
      'verified',
      'terverifikasi_lajukan',
    ].includes(normalized)
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
    (readMetaBoolean(
      metadata,
      'lajukan_verified',
      'verified_by_lajukan',
      'manual_verified',
    )
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
  place: { store: DiscoveryStore; ui: ReturnType<typeof buildUmkmPlacePresentation> },
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
  store: Pick<DiscoveryStore, 'id' | 'name' | 'slug' | 'phone'>,
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
    store.phone ? `Kontak: ${store.phone}` : '',
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

export function UmkmDiscoveryPanel({
  isId,
  query,
  city,
  limit = 240,
  title,
  description,
  selectedSlug,
  selectedStoreIdInitial,
  openMapSignal = 0,
  variant = 'section',
}: UmkmDiscoveryPanelProps) {
  const [stores, setStores] = useState<DiscoveryStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [listPage, setListPage] = useState(1);
  const selectedPreviewRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollStoreIdRef = useRef<string | null>(null);
  const mobileMapRef = useRef<HTMLDivElement | null>(null);
  const desktopMapRef = useRef<HTMLDivElement | null>(null);
  const { viewerLocation, locating, locationError, requestViewerLocation } =
    useViewerLocation({
      isId,
      autoRequest: false,
    });
  const [mapInteractive, setMapInteractive] = useState(
    () => variant === 'immersive',
  );
  const [mapTheme, setMapTheme] = useState<UmkmMapTheme>('default');
  const [showRoute, setShowRoute] = useState(false);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [routeSummary, setRouteSummary] = useState<UmkmMapRouteSummary | null>(
    null,
  );
  const [mapFocusMode, setMapFocusMode] = useState<
    'stores' | 'viewer' | 'route' | 'selected'
  >('stores');
  const [mapFocusNonce, setMapFocusNonce] = useState(0);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [mapOnly, setMapOnly] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (query?.trim()) params.set('q', query.trim());
        if (city?.trim()) params.set('city', city.trim());
        if (viewerLocation) {
          params.set('viewer_lat', String(viewerLocation.lat));
          params.set('viewer_lng', String(viewerLocation.lng));
        }
        params.set('limit', String(limit));

        const res = await fetch(
          `/api/super-app/umkm/stores?${params.toString()}`,
          {
            cache: 'no-store',
            credentials: 'include',
          },
        );
        const payload = (await res.json().catch(() => ({}))) as StoresResponse;
        if (!res.ok || !payload.data) {
          throw new Error(payload.error || 'Failed to load business discovery');
        }
        if (!active) return;
        const items = payload.data.items || [];
        setStores(items);
        setTotalCount(payload.data.count ?? items.length);
        setSelectedStoreId(current => {
          if (current && items.some(item => item.id === current)) {
            return current;
          }
          if (selectedSlug) {
            const matchedBySlug = items.find(
              item => item.slug === selectedSlug,
            );
            if (matchedBySlug) return matchedBySlug.id;
          }
          if (selectedStoreIdInitial) {
            const matchedById = items.find(
              item => item.id === selectedStoreIdInitial,
            );
            if (matchedById) return matchedById.id;
          }
          return null;
        });
      } catch (err: unknown) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : isId
              ? 'Gagal memuat daftar usaha.'
              : 'Failed to load business discovery.',
        );
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, DISCOVERY_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [
    city,
    isId,
    limit,
    query,
    selectedSlug,
    selectedStoreIdInitial,
    viewerLocation,
  ]);

  const preparedStores = useMemo(
    () =>
      stores.map(store => ({
        store,
        ui: buildUmkmPlacePresentation(store, isId, viewerLocation),
      })),
    [isId, stores, viewerLocation],
  );

  const visibleStores = preparedStores;

  useEffect(() => {
    if (!visibleStores.length || !selectedStoreId) {
      setSelectedStoreId(null);
      return;
    }
    if (visibleStores.some(item => item.store.id === selectedStoreId)) return;
    setSelectedStoreId(null);
  }, [selectedStoreId, visibleStores]);

  const selectedPlace =
    visibleStores.find(item => item.store.id === selectedStoreId) || null;
  const selectedPlaceId = selectedPlace?.store.id || null;
  const selectedContactHref =
    selectedPlace?.ui.whatsappHref || selectedPlace?.ui.telHref || null;
  const selectedContactLabel = selectedPlace?.ui.whatsappHref
    ? 'Chat'
    : selectedPlace?.ui.telHref
      ? isId
        ? 'Telepon'
        : 'Call'
      : 'Chat';
  const selectedContactIsExternal =
    selectedContactHref?.startsWith('http') || false;
  const selectedLocationLabel = selectedPlace
    ? getPlaceLocationLabel(selectedPlace, isId)
    : '';
  const selectedAddressLabel =
    selectedPlace?.ui.addressLine ||
    selectedPlace?.store.address ||
    selectedLocationLabel;
  const selectedTrustProfile = selectedPlace
    ? getUmkmTrustProfile(selectedPlace.store, isId)
    : null;
  const selectedRiskProfile = selectedPlace
    ? getUmkmRiskProfile(selectedPlace, isId)
    : null;
  const selectedReportHref = selectedPlace
    ? buildReportListingHref(selectedPlace.store, isId)
    : '';

  const listedPlaces = visibleStores.filter(
    item => item.store.id !== selectedPlace?.store.id,
  );
  const paginatedListedPlaces = listedPlaces.slice(
    0,
    listPage * LIST_PAGE_SIZE,
  );
  const canLoadMoreList = paginatedListedPlaces.length < listedPlaces.length;
  useEffect(() => {
    const targetSlug = selectedSlug?.trim();
    const targetStoreId = selectedStoreIdInitial?.trim();
    if (!targetSlug && !targetStoreId) return;
    const matchedStore = visibleStores.find(
      item =>
        (targetSlug && item.store.slug === targetSlug) ||
        (targetStoreId && item.store.id === targetStoreId),
    );
    if (!matchedStore) return;
    setSelectedStoreId(matchedStore.store.id);
    setMapFocusMode('selected');
    setMapFocusNonce(current => current + 1);
  }, [selectedSlug, selectedStoreIdInitial, visibleStores]);

  useEffect(() => {
    setListPage(1);
    setSheetExpanded(
      variant === 'immersive' ? shouldUseDesktopMapPanel() : false,
    );
  }, [city, query, variant, visibleStores.length]);

  useEffect(() => {
    if (variant !== 'immersive' || typeof window === 'undefined') return;

    const desktopPanelQuery = window.matchMedia('(min-width: 1024px)');
    const syncSheetMode = () => {
      setSheetExpanded(desktopPanelQuery.matches);
    };

    syncSheetMode();
    desktopPanelQuery.addEventListener('change', syncSheetMode);
    return () => desktopPanelQuery.removeEventListener('change', syncSheetMode);
  }, [variant]);

  const handleSelectStore = useCallback(
    (storeId: string, options?: { scrollToPreview?: boolean }) => {
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
      if (selectedStoreId === storeId) return;
      setSelectedStoreId(storeId);
    },
    [selectedStoreId, variant],
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

  const totalLabel =
    loading && totalCount === null
      ? isId
        ? 'Memuat'
        : 'Loading'
      : `${totalCount ?? stores.length} ${isId ? 'usaha' : 'businesses'}`;
  const mapResultLabel = `${visibleStores.length} ${isId ? 'usaha aktif' : 'active businesses'
    }`;
  const routeDistanceLabel = useMemo(() => {
    if (!routeSummary?.distance_m || routeSummary.used_fallback) return null;
    return formatUmkmPlaceDistance(routeSummary.distance_m / 1000, isId);
  }, [isId, routeSummary]);
  const bumpMapFocus = useCallback(
    (mode: 'stores' | 'viewer' | 'route' | 'selected') => {
      setMapFocusMode(mode);
      setMapFocusNonce(current => current + 1);
    },
    [],
  );
  const cycleMapTheme = useCallback(() => {
    setMapTheme(current => getNextUmkmMapTheme(current));
  }, []);

  useEffect(() => {
    if (!selectedPlaceId) return;
    setRouteSummary(null);
  }, [selectedPlaceId]);

  useEffect(() => {
    if (showRoute && viewerLocation && selectedPlace) {
      bumpMapFocus('route');
    }
  }, [bumpMapFocus, selectedPlace, showRoute, viewerLocation]);

  const renderDiscoveryMap = useCallback(
    (className: string, edgeToEdge = false) => {
      const mapStores = visibleStores.map(item => item.store);
      const activeSelectedStoreId = selectedPlace?.store.id || null;

      return (
        <div
          className={`relative isolate overflow-hidden ${edgeToEdge ? 'h-full rounded-none' : 'rounded-[20px]'
            }`}
        >
          <UmkmStoreMap
            stores={mapStores}
            selectedStoreId={activeSelectedStoreId}
            viewerLocation={viewerLocation}
            isId={isId}
            interactive={mapInteractive}
            theme={mapTheme}
            routeToStoreId={activeSelectedStoreId}
            showRoute={showRoute}
            onRouteResolved={setRouteSummary}
            focusMode={mapFocusMode}
            focusNonce={mapFocusNonce}
            onSelectStore={storeId =>
              handleSelectStore(storeId, { scrollToPreview: !edgeToEdge })
            }
            className={className}
          />
          <div
            className={cn(
              'pointer-events-none absolute z-[1100]',
              edgeToEdge
                ? 'right-3 top-[calc(env(safe-area-inset-top)+8.35rem)] sm:top-[calc(env(safe-area-inset-top)+7.55rem)] lg:right-4 lg:top-[calc(env(safe-area-inset-top)+7.25rem)]'
                : 'bottom-3 left-3 sm:bottom-4',
            )}
          >
            <MapQuickControls
              isId={isId}
              interactive={mapInteractive}
              locating={locating}
              locationError={locationError}
              routeEnabled={showRoute}
              distanceLabel={routeDistanceLabel}
              themeLabel={getUmkmMapThemeLabel(mapTheme, isId)}
              onCycleTheme={cycleMapTheme}
              compact={edgeToEdge}
              onToggleInteractive={() => setMapInteractive(current => !current)}
              onFocusViewer={async () => {
                const nextLocation =
                  viewerLocation || (await requestViewerLocation());
                if (!nextLocation) return;
                bumpMapFocus('viewer');
              }}
              onToggleRoute={async () => {
                if (showRoute) {
                  setShowRoute(false);
                  bumpMapFocus('selected');
                  return;
                }

                const nextLocation =
                  viewerLocation || (await requestViewerLocation());
                if (!nextLocation) return;
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
      handleSelectStore,
      isId,
      locating,
      locationError,
      mapFocusMode,
      mapFocusNonce,
      mapInteractive,
      mapTheme,
      requestViewerLocation,
      routeDistanceLabel,
      selectedPlace,
      showRoute,
      viewerLocation,
      visibleStores,
    ],
  );

  if (variant === 'immersive') {
    const sheetTitle =
      title || (isId ? 'Usaha sekitar kamu' : 'Businesses around you');
    const sheetSubtitle =
      description ||
      (city?.trim()
        ? isId
          ? `Area ${city.trim()}`
          : `${city.trim()} area`
        : isId
          ? 'Geser peta, pilih pin, lalu chat atau lihat rute.'
          : 'Move the map, pick a pin, then chat or open route.');

    return (
      <section className="absolute inset-0
    h-full w-full
    overflow-hidden overscroll-none
    bg-slate-100 text-[color:var(--app-text)]
    dark:bg-slate-950">
        <div className="absolute inset-0">
          {renderDiscoveryMap('h-full w-full', true)}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+7.15rem)] z-[1150] flex justify-center px-3 sm:top-[calc(env(safe-area-inset-top)+6.55rem)] lg:left-[510px] lg:right-4 lg:top-[calc(env(safe-area-inset-top)+6.35rem)] lg:px-0">
          <div className="flex min-w-0 flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setListPage(1);
                bumpMapFocus('stores');
              }}
              className="pointer-events-auto inline-flex min-h-[38px] items-center gap-2 rounded-full border border-white/80 bg-white/94 px-4 text-[12px] font-bold text-slate-800 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.34)]  transition hover:-translate-y-0.5 hover:text-[color:var(--app-accent)] dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-100"
            >
              <Search className="h-4 w-4 text-[color:var(--app-accent)]" />
              {isId ? 'Cari area ini' : 'Search this area'}
            </button>
            <button
              type="button"
              onClick={() => setMapOnly(current => !current)}
              className="pointer-events-auto inline-flex min-h-[38px] items-center gap-2 rounded-full border border-white/80 bg-white/94 px-4 text-[12px] font-bold text-slate-800 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.34)]  transition hover:-translate-y-0.5 hover:text-[color:var(--app-accent)] dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-100"
            >
              {mapOnly ? (
                <List className="h-4 w-4 text-[color:var(--app-accent)]" />
              ) : (
                <Maximize2 className="h-4 w-4 text-[color:var(--app-accent)]" />
              )}
              {mapOnly
                ? isId
                  ? 'Tampilkan daftar'
                  : 'Show list'
                : isId
                  ? 'Peta full'
                  : 'Full map'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="absolute left-3 right-3 top-[calc(env(safe-area-inset-top)+15.25rem)] z-[1160] mx-auto max-w-md rounded-[22px] border border-rose-200 bg-white/94 px-4 py-3 text-[12px] font-semibold text-rose-700 shadow-[0_18px_44px_-28px_rgba(244,63,94,0.36)]  dark:border-rose-900/60 dark:bg-slate-950/88">
            {error}
          </div>
        ) : null}

        {loading && !selectedPlace && !error ? (
          <div className="absolute left-3 right-3 top-1/2 z-[1160] mx-auto max-w-sm -translate-y-1/2 rounded-[24px] border border-white/80 bg-white/94 px-5 py-4 text-center text-[13px] font-bold text-slate-700 shadow-[0_22px_52px_-34px_rgba(15,23,42,0.36)]  dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-100">
            {isId
              ? 'Lagi mencari usaha sekitar...'
              : 'Finding nearby businesses...'}
          </div>
        ) : null}

        {!error && !mapOnly ? (
          <div
            className={cn(
              'absolute inset-x-2 bottom-[calc(0.30rem+env(safe-area-inset-bottom))] z-[1250] mx-auto flex max-w-[760px] flex-col overflow-hidden rounded-[26px] border border-white/86 bg-white/97 p-2 shadow-[0_24px_64px_-40px_rgba(15,23,42,0.48)]  transition-all duration-300 dark:border-white/10 dark:bg-slate-950/94 sm:inset-x-4 lg:inset-x-auto lg:bottom-3 lg:left-3 lg:top-[calc(env(safe-area-inset-top)+6.85rem)] lg:mx-0 lg:w-[486px] lg:max-w-none lg:rounded-[24px] lg:p-3',
              sheetExpanded
                ? 'max-h-[min(calc(var(--app-viewport-height)-7rem),520px)] lg:max-h-[calc(var(--app-viewport-height)-1.5rem)]'
                : 'max-h-[100px] min-h-[100px] lg:max-h-[calc(var(--app-viewport-height)-1.5rem)] lg:min-h-0',
            )}
          >
            <button
              type="button"
              onClick={() => setSheetExpanded(current => !current)}
              className="mx-auto mb-1 flex h-4 w-16 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100 lg:hidden"
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

            <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 px-1 pb-1">
              <div className="min-w-0">
                <p className="line-clamp-1 text-[1rem] font-bold leading-tight tracking-[-0.035em] text-[color:var(--app-text)]">
                  {sheetTitle}
                </p>
                <p className="mt-0.5 hidden line-clamp-1 text-[11px] font-semibold leading-4 text-[color:var(--app-text-soft)] sm:block">
                  {sheetSubtitle}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="inline-flex max-w-[92px] items-center justify-center truncate rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold leading-none text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200 sm:max-w-none">
                  {totalLabel}
                </span>
              </div>
            </div>

            {selectedPlace ? (
              <div className="min-h-0 flex-1 overflow-hidden pr-0.5">
                <article className="rounded-[22px] border border-emerald-900/10 bg-[linear-gradient(135deg,#ffffff,#f7fef9)] p-2.5 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.3)] ring-1 ring-white/76 dark:border-slate-800 dark:bg-[linear-gradient(135deg,#0f172a,#061b16)] dark:ring-white/10">
                  <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[78px_minmax(0,1fr)]">
                    <div className="relative">
                      <PlaceThumb
                        src={
                          selectedPlace.ui.gallery[0] ||
                          selectedPlace.ui.coverImage
                        }
                        alt={selectedPlace.store.name}
                        className="h-[72px] rounded-[18px] sm:h-[78px]"
                      />
                      <span
                        className={cn(
                          'absolute -bottom-1 left-1/2 inline-flex -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold shadow-sm ',
                          selectedPlace.ui.openNow !== false
                            ? 'bg-emerald-500/94 text-white'
                            : 'bg-slate-900/76 text-white',
                        )}
                      >
                        {getOpenLabel(selectedPlace.ui.openNow !== false, isId)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-[color:var(--app-text-soft)]">
                        <span className="truncate rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
                          {selectedPlace.ui.kindLabel}
                        </span>
                        {selectedTrustProfile ? (
                          <TrustStatusChip
                            profile={selectedTrustProfile}
                            compact
                          />
                        ) : null}
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0 text-[color:var(--app-accent)]" />
                          <span className="truncate">
                            {selectedLocationLabel}
                          </span>
                        </span>
                      </div>
                      <h3 className="mt-1 line-clamp-2 text-[1.02rem] font-bold leading-tight tracking-[-0.035em] text-[color:var(--app-text)]">
                        {selectedPlace.store.name}
                      </h3>
                      <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                        {selectedAddressLabel}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-[1fr_1fr_40px] gap-1.5">
                    <Link
                      href={buildUmkmStorefrontPath(selectedPlace.store.slug)}
                      className="inline-flex min-h-[38px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-3 text-[11px] font-bold text-white shadow-[0_12px_24px_-20px_color-mix(in_srgb,var(--app-accent)_42%,transparent)]"
                    >
                      <Store className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {isId ? 'Profil' : 'Profile'}
                      </span>
                    </Link>
                    {selectedContactHref ? (
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
                    ) : (
                      <Link
                        href={buildUmkmStorefrontPath(selectedPlace.store.slug)}
                        className="inline-flex min-h-[38px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-3 text-[11px] font-bold text-[color:var(--app-accent)]"
                      >
                        <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Info</span>
                      </Link>
                    )}
                    <a
                      href={selectedPlace.ui.googleMapsDirectionsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[38px] min-w-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] dark:bg-slate-800 dark:text-slate-100"
                      aria-label={isId ? 'Buka rute' : 'Open route'}
                    >
                      <Navigation className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </div>

                  {sheetExpanded ? (
                    <div className="mt-2.5 space-y-1.5 border-t border-slate-200/72 pt-2.5 dark:border-slate-800">
                      <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <span className="inline-flex min-h-[27px] shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
                          <Store className="h-3.5 w-3.5" />
                          {isId ? 'Belanja di toko' : 'In-store'}
                        </span>
                        {selectedPlace.ui.serviceBadges
                          .filter(isVisibleMapServiceBadge)
                          .slice(0, 2)
                          .map(badge => (
                            <span
                              key={badge}
                              className="inline-flex min-h-[27px] shrink-0 items-center rounded-full bg-slate-100 px-2.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            >
                              {badge}
                            </span>
                          ))}
                      </div>

                      <div className="grid gap-1.5 text-[12px] font-semibold leading-5 text-[color:var(--app-text)]">
                        {selectedTrustProfile && selectedRiskProfile ? (
                          <SafetyNotice
                            isId={isId}
                            trustProfile={selectedTrustProfile}
                            riskProfile={selectedRiskProfile}
                            reportHref={selectedReportHref}
                            compact
                          />
                        ) : null}
                        <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 rounded-[15px] bg-slate-50 px-2.5 py-2 dark:bg-slate-900/80">
                          <MapPin className="mt-0.5 h-4 w-4 text-[color:var(--app-accent)]" />
                          <span className="line-clamp-2">
                            {selectedPlace.ui.addressLine ||
                              selectedPlace.store.city ||
                              (isId
                                ? 'Alamat belum lengkap'
                                : 'Address not completed yet')}
                          </span>
                        </div>
                        <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 rounded-[15px] bg-slate-50 px-2.5 py-2 dark:bg-slate-900/80">
                          <Clock3 className="mt-0.5 h-4 w-4 text-[color:var(--app-accent)]" />
                          <span>
                            <span
                              className={
                                selectedPlace.ui.openNow !== false
                                  ? 'font-bold text-emerald-700 dark:text-emerald-200'
                                  : 'font-bold text-rose-600 dark:text-rose-300'
                              }
                            >
                              {getOpenLabel(
                                selectedPlace.ui.openNow !== false,
                                isId,
                              )}
                            </span>
                            <span className="text-[color:var(--app-text-soft)]">
                              {' '}
                              ·{' '}
                              {isId
                                ? 'Chat dulu untuk memastikan jam layanan.'
                                : 'Chat first to confirm service hours.'}
                            </span>
                          </span>
                        </div>
                        {selectedPlace.store.phone ? (
                          <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 rounded-[15px] bg-slate-50 px-2.5 py-2 dark:bg-slate-900/80">
                            <Phone className="mt-0.5 h-4 w-4 text-[color:var(--app-accent)]" />
                            <span className="truncate">
                              {selectedPlace.store.phone}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </article>

              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                {/* <div className="flex shrink-0 items-center justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff,#f8fafc)] px-3 py-2.5 shadow-[0_14px_32px_-28px_rgba(15,23,42,0.2)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,#0f172a,#020617)]">
                  <p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                    {isId ? 'Pilih dari daftar' : 'Pick from results'}
                  </p>
                  <span className="inline-flex shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
                    {totalLabel}
                  </span>
                </div> */}

                {loading ? (
                  <div className="rounded-[18px] border border-slate-200/80 bg-white px-4 py-6 text-center text-[12px] font-semibold text-[color:var(--app-text-soft)] dark:border-slate-800 dark:bg-slate-900/84">
                    {isId
                      ? 'Lagi memuat daftar usaha...'
                      : 'Loading business results...'}
                  </div>
                ) : paginatedListedPlaces.length > 0 ? (
                  <div className="grid min-h-0 min-w-0 flex-1 auto-rows-min gap-2 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-gutter:stable]">
                    {paginatedListedPlaces.map(item => {
                      const isOpen = item.ui.openNow !== false;
                      const trustProfile = getUmkmTrustProfile(
                        item.store,
                        isId,
                      );
                      return (
                        <button
                          key={item.store.id}
                          type="button"
                          onClick={() => handleSelectStore(item.store.id)}
                          className="group grid min-w-0 grid-cols-[74px_minmax(0,1fr)_auto] items-center gap-2 rounded-[18px] border border-slate-200/80 bg-white p-2 text-left shadow-[0_12px_26px_-24px_rgba(15,23,42,0.16)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_10%,white)] dark:border-slate-800 dark:bg-slate-900/82"
                        >
                          <PlaceThumb
                            src={item.ui.gallery[0] || item.ui.coverImage}
                            alt={item.store.name}
                            className="h-[74px] rounded-[14px]"
                          />
                          <span className="min-w-0">
                            <span className="line-clamp-2 text-[13px] font-bold leading-tight text-[color:var(--app-text)]">
                              {item.store.name}
                            </span>
                            <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] font-semibold text-[color:var(--app-text-soft)]">
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
                              <TrustStatusChip profile={trustProfile} compact />
                            </span>
                            <span
                              className={cn(
                                'mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold',
                                isOpen ? 'text-emerald-600' : 'text-slate-500',
                              )}
                            >
                              <span
                                className={cn(
                                  'h-2 w-2 rounded-full',
                                  isOpen ? 'bg-emerald-500' : 'bg-slate-300',
                                )}
                              />
                              {getOpenLabel(isOpen, isId)}
                            </span>
                            <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-[color:var(--app-text-soft)]">
                              <MapPin className="h-3 w-3 shrink-0 text-[color:var(--app-accent)]" />
                              <span className="truncate">
                                {getPlaceLocationLabel(item, isId)}
                              </span>
                            </span>
                          </span>
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition group-hover:bg-[color:var(--app-accent)] group-hover:text-white dark:bg-slate-800 dark:text-slate-200">
                            <ChevronDown className="-rotate-90 h-4 w-4" />
                          </span>
                        </button>
                      );
                    })}

                    {canLoadMoreList ? (
                      <button
                        type="button"
                        onClick={() => setListPage(current => current + 1)}
                        className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {isId ? 'Muat lagi' : 'Load more'}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-slate-200/80 bg-white px-4 py-6 text-center text-[12px] font-semibold text-[color:var(--app-text-soft)] dark:border-slate-800 dark:bg-slate-900/84">
                    {isId
                      ? 'Belum ada usaha yang cocok. Coba ubah kata kunci atau area.'
                      : 'No matching businesses yet. Try another keyword or area.'}
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
            {isId ? 'Tampilkan daftar usaha' : 'Show business list'}
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
                (isId ? 'Pilih cepat, buka cepat.' : 'Pick fast, open fast.')}
            </p>
          </div>

          <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] shadow-[0_12px_26px_-22px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950">
            {totalLabel}
          </span>
        </div>

        <div className="flex min-w-0 justify-start lg:justify-end">
          <button
            type="button"
            onClick={handleOpenMapPreview}
            className="inline-flex min-h-[36px] w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-[color:var(--app-accent)] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_10%,white)] sm:w-fit dark:border-slate-800 dark:bg-slate-950"
          >
            <MapPinned className="h-4 w-4" />
            {isId ? 'Buka Lajukan Maps' : 'Open Lajukan Maps'}
          </button>
        </div>

        {error ? (
          <div className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-8 text-center text-sm text-[color:var(--app-text-soft)] shadow-[0_18px_34px_-28px_rgba(15,23,42,0.14)]">
            {error}
          </div>
        ) : loading && !selectedPlace ? (
          <div className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-8 text-center text-sm font-semibold text-[color:var(--app-text-soft)] shadow-[0_18px_34px_-28px_rgba(15,23,42,0.14)]">
            {isId ? 'Lagi muat daftar usaha...' : 'Loading business results...'}
          </div>
        ) : selectedPlace ? (
          <>
            <div className="grid min-w-0 gap-3 lg:grid-cols-1 lg:gap-4">
              <div className="min-w-0 space-y-3">
                <article
                  ref={selectedPreviewRef}
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
                        <RatingStars
                          rating={selectedPlace.ui.ratingNumber}
                          countLabel={selectedPlace.ui.reviewCountLabel}
                          isId={isId}
                          compact
                        />
                        <span className="text-[color:var(--app-text-soft)]">
                          {selectedPlace.ui.kindLabel}
                        </span>
                        {selectedTrustProfile ? (
                          <TrustStatusChip
                            profile={selectedTrustProfile}
                            compact
                          />
                        ) : null}
                        {getVisibleMapServiceBadges(
                          selectedPlace.ui.serviceBadges,
                        )[0] ? (
                          <span className="text-[color:var(--app-text-soft)]">
                            {
                              getVisibleMapServiceBadges(
                                selectedPlace.ui.serviceBadges,
                              )[0]
                            }
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-1.5 line-clamp-2 text-[1.02rem] font-bold leading-tight text-[color:var(--app-text)] sm:text-[1.35rem]">
                        <Link
                          href={buildUmkmStorefrontPath(
                            selectedPlace.store.slug,
                          )}
                        >
                          {selectedPlace.store.name}
                        </Link>
                      </h3>

                      <p className="mt-1.5 inline-flex items-center gap-2 text-[12px] font-semibold text-emerald-600 sm:text-[13px]">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${selectedPlace.ui.openNow !== false
                            ? 'bg-emerald-500'
                            : 'bg-slate-300'
                            }`}
                        />
                        {getOpenLabel(selectedPlace.ui.openNow !== false, isId)}
                      </p>

                      <p className="mt-0.5 truncate text-[12px] text-[color:var(--app-text-soft)] sm:text-[13px]">
                        {selectedLocationLabel}
                      </p>

                      <p className="mt-2 hidden text-[12px] leading-5 text-[color:var(--app-text-soft)] min-[420px]:line-clamp-2 min-[420px]:block">
                        {selectedPlace.store.description ||
                          selectedPlace.ui.addressLine}
                      </p>

                      <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                        <Link
                          href={buildUmkmStorefrontPath(
                            selectedPlace.store.slug,
                          )}
                          className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-2.5 text-[12px] font-semibold text-white shadow-[0_16px_28px_-24px_color-mix(in_srgb,var(--app-accent)_40%,transparent)] transition hover:brightness-105 sm:px-3"
                        >
                          <Store className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {isId ? 'Profil' : 'Profile'}
                          </span>
                        </Link>
                        {selectedContactHref ? (
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
                        <a
                          href={selectedPlace.ui.googleMapsDirectionsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 sm:px-3"
                        >
                          <Navigation className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {isId ? 'Rute' : 'Route'}
                          </span>
                        </a>
                      </div>
                    </div>
                  </div>
                </article>

                {selectedTrustProfile && selectedRiskProfile ? (
                  <SafetyNotice
                    isId={isId}
                    trustProfile={selectedTrustProfile}
                    riskProfile={selectedRiskProfile}
                    reportHref={selectedReportHref}
                  />
                ) : null}

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
                            {selectedTrustProfile ? (
                              <div className="mt-1">
                                <TrustStatusChip
                                  profile={selectedTrustProfile}
                                  compact
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          <Link
                            href={buildUmkmStorefrontPath(
                              selectedPlace.store.slug,
                            )}
                            className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-accent)] px-2 text-[11px] font-bold text-white"
                          >
                            <Store className="h-3.5 w-3.5" />
                            <span className="truncate">
                              {isId ? 'Profil' : 'Profile'}
                            </span>
                          </Link>
                          {selectedContactHref ? (
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
                              className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-2 text-[11px] font-bold text-[color:var(--app-accent)]"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span className="truncate">
                                {selectedContactLabel}
                              </span>
                            </a>
                          ) : (
                            <Link
                              href={buildUmkmStorefrontPath(
                                selectedPlace.store.slug,
                              )}
                              className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-2 text-[11px] font-bold text-[color:var(--app-accent)]"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span className="truncate">Info</span>
                            </Link>
                          )}
                          <a
                            href={selectedPlace.ui.googleMapsDirectionsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-surface-muted)] px-2 text-[11px] font-bold text-[color:var(--app-text)]"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            <span className="truncate">
                              {isId ? 'Rute' : 'Route'}
                            </span>
                          </a>
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

                {paginatedListedPlaces.length > 0 ? (
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {paginatedListedPlaces.map(item => {
                      const isOpen = item.ui.openNow !== false;
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
                                <RatingStars
                                  rating={item.ui.ratingNumber}
                                  countLabel={item.ui.reviewCountLabel}
                                  isId={isId}
                                  compact
                                />
                                <span className="text-[color:var(--app-text-soft)]">
                                  {item.ui.kindLabel}
                                </span>
                                <TrustStatusChip
                                  profile={trustProfile}
                                  compact
                                />
                              </div>

                              <p
                                className={`mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold ${isOpen ? 'text-emerald-600' : 'text-slate-500'
                                  }`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-slate-300'
                                    }`}
                                />
                                {getOpenLabel(isOpen, isId)}
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

                {canLoadMoreList ? (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setListPage(current => current + 1)}
                      className="inline-flex min-h-[34px] items-center rounded-full border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]"
                    >
                      {isId ? 'Muat lagi' : 'Load more'}
                    </button>
                  </div>
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

                  {renderDiscoveryMap(
                    'h-[min(560px,calc(var(--app-viewport-height)-180px))] min-h-[430px] w-full',
                  )}
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
