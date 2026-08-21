'use client';

import { useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import { Link, useRouter } from '@/i18n/navigation';
import { MediaPreviewCarousel } from '@/components/common/MediaPreviewCarousel';
import {
  ContentLocationMap,
  type ContentMapPoint,
} from '@/components/content/ContentLocationMap';
import { useLocale } from 'next-intl';
import {
  BadgePercent,
  Building2,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CircleCheck,
  ExternalLink,
  FileText,
  Flag,
  Gift,
  Globe2,
  Heart,
  Handshake,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  Pencil,
  Search,
  Share2,
  ShieldCheck,
  Store,
  Trophy,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getSectorLabel, useSectors } from '@/context/SectorContext';
import { getFieldsForDisplay, WORK_MODE_OPTIONS } from '@/data/sectorFields';
import { CONTENT_TYPES, getContentTypeName } from '@/data/contentTypes';
import {
  filterFieldsForListingSide,
  getListingSideVerbLabel,
  resolveListingSide,
  toMarketSideValue,
} from '@/lib/content/listingSide';
import {
  normalizeContentMediaUrl,
  resolveImageGallery,
  type ContentItem as CatalogContentItem,
  type ContentOwnerProfile,
} from '@/lib/content/catalog';
import {
  formatPriceWithUnit,
  resolveContentPriceUnitLabel,
} from '@/lib/content/priceUnit';
import { buildContentHref, extractContentId } from '@/lib/content/routes';
import { readPublicReference } from '@/lib/content/publicReference';
import { createPromotionSnapshot } from '@/lib/content/promotionPrograms';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { buildPublicProfileHref } from '@/lib/profile/publicProfileLink';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import { Modal } from '@/components/common/Modal';
import { DetailMobileTopBar } from '@/components/layout/DetailMobileTopBar';
import { ContentDetailSkeleton } from '@/components/system/feedback/RouteSkeletons';
import { TransactionVerificationPromptModal } from '@/components/verification/TransactionVerificationPromptModal';
import { createIdempotencyKey } from '@/lib/clientIdempotency';
import { useAppBack } from '@/lib/navigation/useAppBack';
import {
  // PHONE_VERIFICATION_SETTINGS_PATH,
  readTransactionVerification,
  type TransactionVerificationState,
} from '@/lib/identityVerification';
import { recordListingView } from '@/lib/listingViewHistory';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import { useViewerLocation } from '@/components/super-app/useViewerLocation';
import { haversineKm, isCoordinateValid } from '@/lib/super-app/location-guard';
import { formatDistanceKm } from '@/lib/geo/distance';

export type ContentItem = {
  id: string;
  owner_id?: string;
  owner_profile?: ContentOwnerProfile | null;
  slug?: string;
  type: string;
  content_type?: string;
  title: string;
  summary?: string | null;
  body?: string | null;
  pricing_mode?: 'fixed' | 'request' | string | null;
  price_cents?: number | null;
  price_unit?: string | null;
  original_price_cents?: number | null;
  promo_label?: string | null;
  promo_start_at?: string | null;
  promo_end_at?: string | null;
  currency?: string;
  rating?: number | null;
  review_count?: number | null;
  likeCount?: number | null;
  like_count?: number | null;
  likes_count?: number | null;
  tags?: string[];
  cover_image?: string | null;
  content_status?: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
  seller_stats?: SellerStats | null;
  created_at?: string;
  updated_at?: string;
};

type SellerStats = {
  rating?: number | null;
  review_count?: number | null;
  total_transactions?: number | null;
  completed_transactions?: number | null;
  accepted_transactions?: number | null;
  cancelled_transactions?: number | null;
  pending_transactions?: number | null;
  completion_rate?: number | null;
  acceptance_rate?: number | null;
  cancel_rate?: number | null;
};

type QuickApplyData = {
  full_name: string;
  email: string;
  phone?: string;
  headline?: string;
  location?: string;
  years_exp?: string;
  expected_salary?: string;
  resume_url?: string;
};

const QUICK_APPLY_KEY = 'lajukan_quick_apply_v1';

type DealKind =
  | 'job'
  | 'service'
  | 'product'
  | 'property'
  | 'tool_rental'
  | 'profile'
  | 'other';

type InboxRoomItem = {
  id: string;
  room_name: string | null;
  room_type: string | null;
  room_avatar: string | null;
  last_message: string | null;
  last_message_at: string | null;
};

type RelatedTransaction = {
  id: string;
  content_id?: string;
  status?: string;
  transaction_status?: string;
  protection_status?: string;
  payment_status?: string;
  amount_cents?: number;
  currency?: string;
  created_at?: string;
  updated_at?: string;
  expires_at?: string;
  deadline_at?: string;
  payment_due_at?: string;
  transaction_meta?: Record<string, unknown> | null;
};

type CreatedDealHandoff = {
  transactionId: string;
  roomId: string;
  amountCents: number | null;
  currency: string;
  status: string;
  protectionStatus: string;
  flowMode: 'offer' | 'direct';
};

function extractDeadlineIso(txn: RelatedTransaction | null): string {
  if (!txn) return '';
  const direct = [txn.expires_at, txn.deadline_at, txn.payment_due_at].find(
    value => typeof value === 'string' && value.trim(),
  );
  if (direct) return String(direct);
  const meta =
    txn.transaction_meta && typeof txn.transaction_meta === 'object'
      ? txn.transaction_meta
      : {};
  const metaDeadline = [
    meta.expires_at,
    meta.deadline_at,
    meta.payment_due_at,
    meta.offer_expires_at,
    meta.payment_expiry_at,
  ].find(value => typeof value === 'string' && String(value).trim());
  return typeof metaDeadline === 'string' ? metaDeadline : '';
}

function resolveTxnStatusText(txn: RelatedTransaction | null): string {
  if (!txn) return '';
  const raw = (txn.status || txn.transaction_status || '')
    .toString()
    .trim()
    .toLowerCase();
  return raw || 'pending';
}

function humanizeValue(value: string): string {
  return String(value || '')
    .trim()
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolveTxnPaymentStatus(txn: RelatedTransaction | null): string {
  if (!txn) return 'awaiting_payment';
  const meta = (
    txn.transaction_meta && typeof txn.transaction_meta === 'object'
      ? txn.transaction_meta
      : {}
  ) as Record<string, unknown>;
  const payment = (
    meta.payment && typeof meta.payment === 'object' ? meta.payment : {}
  ) as Record<string, unknown>;
  const raw = (txn.payment_status || payment.status || '')
    .toString()
    .trim()
    .toLowerCase();
  return raw || 'awaiting_payment';
}

function resolveRelatedTxnGuidance(
  txn: RelatedTransaction | null,
  locale: string,
): string {
  if (!txn) {
    return locale === 'id'
      ? 'Belum ada order. Mulai dari tombol aksi.'
      : 'No order yet. Start from the action button to keep chat and transaction details tidy.';
  }

  const status = resolveTxnStatusText(txn);
  const paymentStatus = resolveTxnPaymentStatus(txn);

  if (status === 'pending') {
    if (paymentStatus === 'paid') {
      return locale === 'id'
        ? 'Dana buyer sudah aman. Tinggal lanjut di chat.'
        : 'Buyer funds are protected. Continue in chat.';
    }
    return locale === 'id'
      ? 'Lanjut order untuk cek pembayaran dan langkah berikutnya.'
      : 'Continue to the order workspace to check payment availability and the next step.';
  }

  if (status === 'accepted') {
    return locale === 'id'
      ? 'Order disetujui. Cek status pembayaran, lalu atur kerja atau pengiriman di chat.'
      : 'The order is accepted. Check payment status, then coordinate work or delivery in chat.';
  }

  if (status === 'in_progress') {
    return locale === 'id'
      ? 'Order berjalan. Update progres di chat, lalu selesaikan dari halaman pesanan.'
      : 'The order is in progress. Update progress in chat, then complete it from the order page.';
  }

  if (status === 'delivered') {
    return locale === 'id'
      ? 'Seller sudah kirim. Cek hasil lalu selesaikan atau buka dispute.'
      : 'The seller has delivered. Review it, complete it, or open a dispute.';
  }

  if (status === 'disputed') {
    return locale === 'id'
      ? 'Order sedang ditinjau. Simpan bukti di chat dan lanjutkan dari support bila perlu.'
      : 'This order is under review. Keep evidence in chat and continue from support if needed.';
  }

  if (status === 'completed') {
    return locale === 'id'
      ? 'Order selesai. Riwayatnya tetap bisa dipakai untuk review atau bukti.'
      : 'This order is completed. The record is still useful for reviews or proof.';
  }

  if (status === 'cancelled') {
    return locale === 'id'
      ? 'Order dibatalkan. Riwayatnya masih bisa dibuka kapan saja.'
      : 'This order was cancelled. The history is still available anytime.';
  }

  return locale === 'id'
    ? 'Buka order untuk cek langkah berikutnya.'
    : 'Open the order workspace to see the next step and payment status.';
}

function formatRemainingDuration(ms: number, locale: string): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (locale === 'id') {
    return `${hours}j ${minutes}m ${seconds}d`;
  }
  return `${hours}h ${minutes}m ${seconds}s`;
}

function getImages(item: ContentItem): string[] {
  return resolveImageGallery(item as Parameters<typeof resolveImageGallery>[0]);
}

function getDocuments(
  item: ContentItem,
): Array<{ name: string; url: string; size?: number; mime?: string }> {
  const raw = (item.metadata as Record<string, unknown> | null)?.documents;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, idx) => {
      if (typeof entry === 'string' && entry.trim()) {
        return {
          name: `Document ${idx + 1}`,
          url: normalizeContentMediaUrl(entry.trim()),
        };
      }
      if (!entry || typeof entry !== 'object') return null;
      const doc = entry as Record<string, unknown>;
      const url =
        typeof doc.url === 'string'
          ? normalizeContentMediaUrl(doc.url.trim())
          : '';
      if (!url) return null;
      return {
        name:
          typeof doc.name === 'string' && doc.name.trim()
            ? doc.name.trim()
            : `Document ${idx + 1}`,
        url,
        size: typeof doc.size === 'number' ? doc.size : undefined,
        mime: typeof doc.mime === 'string' ? doc.mime : undefined,
      };
    })
    .filter(
      (
        doc,
      ): doc is { name: string; url: string; size?: number; mime?: string } =>
        Boolean(doc),
    );
}

function formatSize(bytes?: number): string {
  if (!Number.isFinite(bytes as number) || !bytes) return '-';
  if ((bytes as number) < 1024) return `${bytes} B`;
  if ((bytes as number) < 1024 * 1024)
    return `${((bytes as number) / 1024).toFixed(1)} KB`;
  return `${((bytes as number) / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCurrency(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'IDR',
      maximumFractionDigits: currency === 'IDR' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency || 'IDR'} ${amount.toLocaleString()}`;
  }
}

function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function humanizeToken(value: unknown): string {
  if (value == null) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(part => (part ? part[0].toUpperCase() + part.slice(1) : ''))
    .join(' ');
}

function readMetaText(
  meta: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value))
      return String(value);
  }
  return '';
}

const CONTENT_LATITUDE_KEYS = [
  'lat',
  'latitude',
  'location_lat',
  'location_latitude',
  'geo_lat',
  'address_lat',
  'pickup_lat',
  'return_lat',
  'store_lat',
  'outlet_lat',
  'branch_lat',
];

const CONTENT_LONGITUDE_KEYS = [
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
  'pickup_lon',
  'return_lng',
  'return_lon',
  'store_lng',
  'store_lon',
  'outlet_lng',
  'outlet_lon',
  'branch_lng',
  'branch_lon',
];

const CONTENT_NESTED_LOCATION_KEYS = [
  'metadata',
  'location',
  'geo',
  'geometry',
  'coordinates',
  'coordinate',
  'coords',
  'latlng',
  'lat_lng',
  'position',
  'point',
  'address',
  'pickup',
  'pickup_location',
  'return_location',
  'store',
  'outlet',
  'branch',
  'primary_umkm_store',
  'umkm_store',
  'linked_umkm_stores',
  'umkm_store_inventory',
  'branches',
  'outlets',
];

function asContentRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readContentCoordinateNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim().replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readBoundedContentCoordinate(
  source: Record<string, unknown>,
  keys: string[],
  limit: number,
): number | null {
  for (const key of keys) {
    const parsed = readContentCoordinateNumber(source[key]);
    if (parsed !== null && Math.abs(parsed) <= limit) return parsed;
  }
  return null;
}

function readContentLatLngFromRecord(value: unknown): ContentMapPoint | null {
  const record = asContentRecord(value);
  if (!record) return null;
  const lat = readBoundedContentCoordinate(record, CONTENT_LATITUDE_KEYS, 90);
  const lng = readBoundedContentCoordinate(record, CONTENT_LONGITUDE_KEYS, 180);
  if (lat === null || lng === null) return null;
  const point = { lat, lng };
  return isCoordinateValid(point) ? point : null;
}

function readContentLatLngFromArray(value: unknown[]): ContentMapPoint | null {
  if (value.length < 2) return null;
  const first = readContentCoordinateNumber(value[0]);
  const second = readContentCoordinateNumber(value[1]);
  if (first === null || second === null) return null;

  const latLng = { lat: first, lng: second };
  if (isCoordinateValid(latLng)) return latLng;

  const lngLat = { lat: second, lng: first };
  return isCoordinateValid(lngLat) ? lngLat : null;
}

function extractContentLocationPoint(
  value: unknown,
  depth = 0,
): ContentMapPoint | null {
  if (depth > 4 || value == null) return null;

  if (Array.isArray(value)) {
    const directPoint = readContentLatLngFromArray(value);
    if (directPoint) return directPoint;
    for (const entry of value.slice(0, 20)) {
      const point = extractContentLocationPoint(entry, depth + 1);
      if (point) return point;
    }
    return null;
  }

  const record = asContentRecord(value);
  if (!record) return null;

  const directPoint = readContentLatLngFromRecord(record);
  if (directPoint) return directPoint;

  for (const key of CONTENT_NESTED_LOCATION_KEYS) {
    const point = extractContentLocationPoint(record[key], depth + 1);
    if (point) return point;
  }

  return null;
}

function resolveContentLocationPoint(
  item: ContentItem,
  meta: Record<string, unknown>,
): ContentMapPoint | null {
  return extractContentLocationPoint(item) || extractContentLocationPoint(meta);
}

function readLocationTextFromValue(value: unknown): string {
  const record = asContentRecord(value);
  if (!record) return '';
  return readMetaText(
    record,
    'full_address',
    'street_address',
    'address',
    'location_address',
    'pickup_address',
    'return_address',
    'formatted_address',
    'place_name',
    'name',
    'label',
    'city',
    'region',
  );
}

function resolveContentLocationAddress(
  meta: Record<string, unknown>,
  fallback: string,
): string {
  const directAddress = readMetaText(
    meta,
    'full_address',
    'street_address',
    'address',
    'location_address',
    'pickup_address',
    'return_address',
    'formatted_address',
    'place_name',
    'location',
    'city',
    'region',
  );
  if (directAddress) return directAddress;

  for (const key of CONTENT_NESTED_LOCATION_KEYS) {
    const value = meta[key];
    if (Array.isArray(value)) {
      for (const entry of value.slice(0, 10)) {
        const text = readLocationTextFromValue(entry);
        if (text) return text;
      }
      continue;
    }

    const text = readLocationTextFromValue(value);
    if (text) return text;
  }

  return fallback;
}

function formatContentDistanceLabel(distanceKm: number | null): string {
  return formatDistanceKm(distanceKm) || '';
}

function buildContentGoogleMapsSearchUrl(
  point: ContentMapPoint,
  title: string,
  address: string,
): string {
  const label = [title, address].filter(Boolean).join(', ');
  const query = label
    ? `${label} @ ${point.lat},${point.lng}`
    : `${point.lat},${point.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildContentGoogleMapsDirectionsUrl(point: ContentMapPoint): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;
}

function readMetaList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(entry => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[,\n]/)
      .map(entry => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function formatMetaList(value: unknown): string {
  return readMetaList(value).join(', ');
}

function formatDetailValue(value: unknown): string {
  if (value == null) return '';

  if (typeof value === 'string') {
    return value
      .replace(/\u00A0/g, ' ')
      .replace(/\u00C2/g, '')
      .trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map(entry => formatDetailValue(entry))
      .filter(Boolean)
      .join(', ');
  }

  const record = asContentRecord(value);
  if (record) {
    const primaryLabel = readMetaText(
      record,
      'label',
      'name',
      'title',
      'value',
      'text',
      'full_address',
      'formatted_address',
    );
    if (primaryLabel) return primaryLabel;

    return Object.entries(record)
      .map(([key, entryValue]) => {
        const formatted = formatDetailValue(entryValue);
        return formatted ? `${humanizeToken(key)}: ${formatted}` : '';
      })
      .filter(Boolean)
      .join(' • ');
  }

  return String(value);
}

function collapseWhitespace(value?: string | null): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

const LISTING_COPY_NOISE_MARKERS = [
  'yang penting',
  'dibikin cepat',
  'bikin cepat',
  'udah kepasang',
  'nangkep inti',
  'detail lain bisa',
  'siap dipakai',
  'mulai jalan',
  'biar orang langsung',
  'biar penawaran',
  'bisa ditambahin setelah',
];

function cleanListingCopyText(
  value?: string | null,
  title?: string | null,
): string {
  const text = collapseWhitespace(value);
  if (!text) return '';

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean)
    .filter(sentence => {
      const lower = sentence.toLowerCase();
      return !LISTING_COPY_NOISE_MARKERS.some(marker => lower.includes(marker));
    });

  let cleaned = sentences.join(' ').trim();
  if (!cleaned) cleaned = text;

  const cleanTitle = collapseWhitespace(title);
  if (cleanTitle) {
    const normalizedTitle = cleanTitle.toLowerCase();
    const normalizedText = cleaned.toLowerCase();
    if (normalizedText.startsWith(normalizedTitle)) {
      cleaned = cleaned
        .slice(cleanTitle.length)
        .replace(/^[\s,.;:-]+/, '')
        .trim();
    }
  }

  return cleaned;
}

function buildInteractionReference(prefix: string, primaryId: string): string {
  const compactId = String(primaryId || '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 6)
    .toUpperCase();
  const timePart = Date.now().toString().slice(-6);
  return `${prefix}-${compactId || 'FLOW'}-${timePart}`;
}

function loadQuickApply(): QuickApplyData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(QUICK_APPLY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as QuickApplyData;
  } catch {
    // ignore
  }
  return null;
}

function saveQuickApply(data: QuickApplyData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUICK_APPLY_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function isUuidLike(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function readPositiveInteger(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }
  return 0;
}

function resolveListingLikeCount(item: ContentItem | null): number {
  if (!item) return 0;
  const meta =
    item.metadata &&
    typeof item.metadata === 'object' &&
    !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : {};
  const candidates = [
    item.likeCount,
    item.like_count,
    item.likes_count,
    meta.like_count,
    meta.likes_count,
    meta.reaction_count,
    meta.reactions_count,
  ];
  for (const candidate of candidates) {
    const value = readPositiveInteger(candidate);
    if (value > 0) return value;
  }
  return 0;
}

type ContentDetailClientProps = {
  contentId: string;
  initialItem: ContentItem;
};

export default function ContentDetailClient({
  contentId,
  initialItem,
}: ContentDetailClientProps) {
  const router = useRouter();
  const handleBack = useAppBack(router, '/explore');
  const locale = useLocale() || 'id';
  const { user, authFetch } = useAuth();
  const { viewerLocation } = useViewerLocation({
    autoRequest: false,
    isId: locale === 'id',
  });
  const { getSectorById } = useSectors();
  const [item, setItem] = useState<ContentItem | null>(initialItem);
  const [loading, setLoading] = useState(false);
  const [showDealChoiceModal, setShowDealChoiceModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerFlowMode, setOfferFlowMode] = useState<'offer' | 'direct'>(
    'offer',
  );
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [applyFullName, setApplyFullName] = useState('');
  const [applyEmail, setApplyEmail] = useState('');
  const [applyPhone, setApplyPhone] = useState('');
  const [applyHeadline, setApplyHeadline] = useState('');
  const [applyLocation, setApplyLocation] = useState('');
  const [applyYearsExp, setApplyYearsExp] = useState('');
  const [applyExpectedSalary, setApplyExpectedSalary] = useState('');
  const [applyMessage, setApplyMessage] = useState('');
  const [applyResumeFile, setApplyResumeFile] = useState<File | null>(null);
  const [applyResumeUrl, setApplyResumeUrl] = useState('');
  const [applyRemember, setApplyRemember] = useState(true);
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [offerError, setOfferError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [chatStarting, setChatStarting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [shareRooms, setShareRooms] = useState<InboxRoomItem[]>([]);
  const [shareRoomId, setShareRoomId] = useState('');
  const [shareNote, setShareNote] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [contentLiked, setContentLiked] = useState(false);
  const [contentLikeCount, setContentLikeCount] = useState<number | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [relatedTx, setRelatedTx] = useState<RelatedTransaction | null>(null);
  const [relatedTxLoading, setRelatedTxLoading] = useState(false);
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [verificationPrompt, setVerificationPrompt] =
    useState<TransactionVerificationState | null>(null);
  const [createdDealHandoff, setCreatedDealHandoff] =
    useState<CreatedDealHandoff | null>(null);
  const trackedContentViewRef = useRef<string>('');
  const resolvedContentId = extractContentId(contentId);

  useEffect(() => {
    if (!user) return;
    const saved = loadQuickApply();
    setApplyFullName(saved?.full_name || user.full_name || user.email || '');
    setApplyEmail(saved?.email || user.email || '');
    setApplyPhone(saved?.phone || user.phone || '');
    setApplyHeadline(saved?.headline || '');
    setApplyLocation(saved?.location || '');
    setApplyYearsExp(saved?.years_exp || '');
    setApplyExpectedSalary(saved?.expected_salary || '');
    setApplyResumeUrl(saved?.resume_url || '');
    setApplyRemember(true);
  }, [user]);

  useEffect(() => {
    const load = async () => {
      if (!resolvedContentId) return;
      try {
        const res = await fetch(
          `/api/content/${resolvedContentId}?include_owner=1`,
        );
        if (res.ok) {
          const data = await res.json();
          setItem(data);

          // Redirect to slug URL if slug exists and current URL doesn't have it
          const currentParamId = contentId;
          if (
            data.slug &&
            currentParamId &&
            !currentParamId.includes(data.slug)
          ) {
            const slug = data.slug
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .trim()
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .slice(0, 80);
            const newUrl = `/content/${slug}-${resolvedContentId}`;
            router.replace(newUrl);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [contentId, resolvedContentId, router]);

  useEffect(() => {
    if (!item) return;
    const meta = (item.metadata as Record<string, unknown> | null) || {};
    setApplyLocation(
      prev =>
        prev ||
        (typeof meta.location === 'string' ? meta.location : '') ||
        (typeof meta.city === 'string' ? meta.city : '') ||
        (typeof meta.region === 'string' ? meta.region : ''),
    );
    setApplyHeadline(
      prev =>
        prev ||
        (typeof meta.role === 'string' ? meta.role : '') ||
        (typeof meta.position === 'string' ? meta.position : '') ||
        (typeof meta.profession === 'string' ? meta.profession : ''),
    );
  }, [item]);

  useEffect(() => {
    if (!item || !resolvedContentId) return;

    const metadata =
      item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
    const contentType = item.content_type || item.type || 'other';
    const matchedType = CONTENT_TYPES.find(type => type.id === contentType);
    const catalogItem = {
      ...item,
      summary: item.summary || undefined,
      body: item.body || undefined,
    } as CatalogContentItem;
    const typeLabel = matchedType
      ? getContentTypeName(matchedType, locale)
      : humanizeToken(contentType) || 'Listing';
    const priceLabel =
      typeof item.price_cents === 'number' && item.price_cents > 0
        ? formatPriceWithUnit(
            formatCurrency(item.price_cents, item.currency || 'IDR'),
            resolveContentPriceUnitLabel(catalogItem, locale as 'id' | 'en'),
          )
        : locale === 'id'
          ? 'Negosiasi'
          : 'Contact';
    const gallery = resolveImageGallery(catalogItem);
    const location = [
      metadata.location,
      metadata.city,
      metadata.region,
      metadata.address,
    ]
      .map(value => (typeof value === 'string' ? value.trim() : ''))
      .find(Boolean);

    recordListingView({
      id: resolvedContentId,
      title: item.title || 'Listing',
      summary: item.summary || item.body || '',
      href: buildContentHref(resolvedContentId, item.title, item.slug),
      image: item.cover_image || gallery[0] || null,
      kind: contentType,
      typeLabel,
      actionLabel: locale === 'id' ? 'Buka lagi' : 'Open again',
      location: location || 'Indonesia',
      priceLabel,
      priceCents:
        typeof item.price_cents === 'number' &&
        Number.isFinite(item.price_cents)
          ? item.price_cents
          : null,
      storeName: item.owner_profile?.full_name || null,
    });

    if (readPublicReference(catalogItem)) return;

    const targetUserId = String(
      item.owner_id || item.owner_profile?.id || '',
    ).trim();
    const actorId = String(user?.id || '').trim();
    if (!actorId || !targetUserId || actorId === targetUserId) return;

    const trackingKey = `${resolvedContentId}:${actorId}`;
    if (trackedContentViewRef.current === trackingKey) return;
    trackedContentViewRef.current = trackingKey;

    const contentHref = buildContentHref(
      resolvedContentId,
      item.title,
      item.slug,
    );
    void trackLajukanEvent('content.viewed', {
      entityType: 'content',
      entityId: resolvedContentId,
      page: contentHref,
      properties: {
        entity_label: item.title,
        href: contentHref,
        target_href: contentHref,
        target_user_id: targetUserId,
        target_username:
          item.owner_profile?.username ||
          item.owner_profile?.full_name ||
          item.title ||
          '',
        target_name:
          item.owner_profile?.full_name ||
          item.owner_profile?.username ||
          item.title ||
          '',
        actor_user_id: actorId,
        actor_username: String(user?.username || '').trim(),
        actor_name:
          user?.fullName ||
          user?.full_name ||
          user?.username ||
          user?.email ||
          '',
        actor_avatar_url: user?.avatarUrl || user?.avatar_url || '',
        source: 'content',
        surface: 'content',
        action: 'view',
      },
    });
  }, [item, locale, resolvedContentId, user]);

  useEffect(() => {
    if (showApplyModal) setApplyError(null);
  }, [showApplyModal]);

  useEffect(() => {
    if (showOfferModal) setOfferError(null);
  }, [showOfferModal]);

  useEffect(() => {
    if (showReportModal) setReportError(null);
  }, [showReportModal]);

  useEffect(() => {
    if (!resolvedContentId) return;

    let active = true;
    const loadLikeState = async () => {
      try {
        const res = await authFetch(
          `/api/content/${encodeURIComponent(resolvedContentId)}/like`,
          {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          liked?: unknown;
          likeCount?: unknown;
          like_count?: unknown;
        };

        if (!active || !res.ok) return;

        setContentLiked(Boolean(data.liked));
        setContentLikeCount(
          readPositiveInteger(data.likeCount ?? data.like_count),
        );
        return;
      } catch {
        // Fall back to local storage below if the backend is unavailable.
      }

      if (!active) return;
      try {
        if (typeof window === 'undefined') return;
        const storageKey = `lajukan:content-like:${resolvedContentId}`;
        setContentLiked(window.localStorage.getItem(storageKey) === '1');
      } catch {
        setContentLiked(false);
      }
    };

    void loadLikeState();
    return () => {
      active = false;
    };
  }, [authFetch, resolvedContentId]);

  useEffect(() => {
    if (!resolvedContentId || typeof window === 'undefined') return;
    const storageKey = `lajukan:content-like:${resolvedContentId}`;
    try {
      if (contentLiked) {
        window.localStorage.setItem(storageKey, '1');
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      // ignore storage failures
    }
  }, [contentLiked, resolvedContentId]);

  useEffect(() => {
    setShowFullDescription(false);
  }, [resolvedContentId]);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (PROMO_ONLY_MODE || !resolvedContentId || !user) {
      setRelatedTx(null);
      setRelatedTxLoading(false);
      return;
    }
    let active = true;
    const loadRelatedTransaction = async () => {
      setRelatedTxLoading(true);
      try {
        const res = await authFetch('/api/transactions?limit=60&offset=0');
        const payload = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(
            (payload as { error?: string }).error ||
              'Failed to load transactions',
          );
        const rawList = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as { data?: unknown[] }).data)
            ? (payload as { data: unknown[] }).data
            : Array.isArray((payload as { items?: unknown[] }).items)
              ? (payload as { items: unknown[] }).items
              : [];
        const candidates = rawList
          .filter((entry): entry is RelatedTransaction =>
            Boolean(entry && typeof entry === 'object'),
          )
          .filter(
            txn => String(txn.content_id || '').trim() === resolvedContentId,
          )
          .sort((a, b) => {
            const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
            const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
            return bTime - aTime;
          });
        if (active) setRelatedTx(candidates[0] || null);
      } catch (error) {
        console.error('[RELATED_TX_LOAD_ERROR]', error);
      } finally {
        if (active) setRelatedTxLoading(false);
      }
    };

    loadRelatedTransaction();
    const poll = setInterval(loadRelatedTransaction, 15000);
    return () => {
      active = false;
      clearInterval(poll);
    };
  }, [authFetch, resolvedContentId, user]);

  const openDealFlowPicker = async () => {
    if (displayType === 'company') {
      await handleStartChat();
      return;
    }
    if (!user) {
      const callbackUrl = `/${locale}/content/${contentId || resolvedContentId}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }
    if (displayType === 'job') {
      setShowDealChoiceModal(true);
      return;
    }
    if (isDemandListing) {
      setShowDealChoiceModal(true);
      return;
    }
    await startDealFlow(pricingMode === 'fixed' ? 'direct' : 'offer');
  };

  const ensureTransactionEligible = async () => {
    let latestUser: unknown = user;
    try {
      const meRes = await authFetch('/api/auth/me', { cache: 'no-store' });
      if (meRes.ok) {
        latestUser = await meRes.json().catch(() => user);
      }
    } catch {
      // Fallback to current auth context data.
    }

    const verification = readTransactionVerification(latestUser);
    if (!verification.transactionEligible) {
      setVerificationPrompt(verification);
      return false;
    }
    return true;
  };

  const startDealFlow = async (mode: 'offer' | 'direct') => {
    const allowed = await ensureTransactionEligible();
    if (!allowed) return;
    setOfferFlowMode(mode);
    const directPrefillMessage =
      displayType === 'tool_rental'
        ? locale === 'id'
          ? 'Halo kak, saya mau sewa. Jadwal, deposit, ambilnya gimana?'
          : 'Hi, I want to proceed with this rental. Please share the available schedule, deposit, and pickup details.'
        : displayType === 'property'
          ? locale === 'id'
            ? 'Halo kak, saya tertarik lokasi ini. Bisa survey kapan?'
            : 'Hi, I want to proceed with this location. Please share the viewing steps and key deal terms.'
          : displayType === 'service' || displayType === 'profile'
            ? locale === 'id'
              ? 'Halo kak, saya mau lanjut jasa ini. Mulainya gimana?'
              : 'Hi, I want to proceed with this service. Please share the start steps, timeline, and key work details.'
            : displayType === 'product'
              ? locale === 'id'
                ? 'Halo kak, saya mau order. Stok dan ongkirnya ada?'
                : 'Hi, I want to proceed at the listed price. Please confirm stock, delivery, and payment steps.'
              : locale === 'id'
                ? 'Halo kak, saya mau lanjut. Langkah berikutnya apa?'
                : 'Hi, I want to proceed based on the listing details. Please share the next steps.';
    if (mode === 'direct' && listPriceCents > 0) {
      setOfferAmount(String(Math.round(listPriceCents / 100)));
      setOfferMessage(directPrefillMessage);
    } else {
      setOfferAmount('');
      setOfferMessage('');
    }
    setShowDealChoiceModal(false);
    setShowOfferModal(true);
  };

  const handleMakeOffer = async () => {
    if (!resolvedContentId) return;
    const numericAmount = parseInt(offerAmount.replace(/\D/g, ''), 10);
    const fallbackDirectAmount =
      listPriceCents > 0 ? Math.round(listPriceCents / 100) : 0;
    const finalAmount =
      Number.isFinite(numericAmount) && numericAmount > 0
        ? numericAmount
        : offerFlowMode === 'direct'
          ? fallbackDirectAmount
          : 0;

    const canRespondWithoutAmount =
      isDemandListing &&
      offerFlowMode === 'offer' &&
      offerMessage.trim().length > 0;

    if (!finalAmount && !canRespondWithoutAmount) {
      setOfferError(
        isDemandListing
          ? locale === 'id'
            ? 'Isi nominal atau tulis scope respons terlebih dulu.'
            : 'Enter an amount or describe your response scope first.'
          : locale === 'id'
            ? 'Masukkan nominal terlebih dulu.'
            : 'Please enter an amount.',
      );
      return;
    }

    setOfferError(null);
    setSubmitting(true);
    try {
      const amountCents = finalAmount > 0 ? finalAmount * 100 : undefined;
      const createdAt = new Date().toISOString();
      const interactionReference = buildInteractionReference(
        offerFlowMode === 'direct' ? 'TRX' : 'OFF',
        resolvedContentId || item?.id || '',
      );

      const dealKind:
        | 'job'
        | 'service'
        | 'product'
        | 'property'
        | 'tool_rental'
        | 'profile'
        | 'other' =
        displayType === 'job'
          ? 'job'
          : displayType === 'tool_rental'
            ? 'tool_rental'
            : displayType === 'service'
              ? 'service'
              : displayType === 'property'
                ? 'property'
                : displayType === 'profile'
                  ? 'profile'
                  : displayType === 'product'
                    ? 'product'
                    : 'other';
      const localFulfillmentMode =
        displayType === 'service' || displayType === 'profile'
          ? 'remote'
          : displayType === 'tool_rental'
            ? 'pickup'
            : displayType === 'job'
              ? 'onsite'
              : displayType === 'property'
                ? 'onsite'
                : 'shipping';
      const safetyChecklist = {
        identity_confirmed: true,
        platform_payment_confirmed: true,
        item_detail_confirmed: true,
        anti_scam_acknowledged: true,
      };
      const riskFlags =
        /whatsapp|telegram|transfer langsung|outside platform/i.test(
          offerMessage,
        )
          ? ['off_platform_payment_risk']
          : [];

      const res = await authFetch('/api/transactions/offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': createIdempotencyKey('offer'),
        },
        body: JSON.stringify({
          content_id: resolvedContentId,
          amount_cents: amountCents,
          currency: baseCurrency,
          offer_message: offerMessage.trim() || undefined,
          deal_kind: dealKind,
          fulfillment_mode: localFulfillmentMode,
          safety_checklist: safetyChecklist,
          risk_flags: riskFlags,
          transaction_meta: {
            source: 'content_detail',
            pricing_mode: pricingMode,
            promo_label: item?.promo_label || undefined,
            market_side: toMarketSideValue(listingSide),
            ticket: {
              reference: interactionReference,
              kind: offerFlowMode === 'direct' ? 'transaction' : 'offer',
              created_at: createdAt,
              next_step:
                locale === 'id'
                  ? 'Lanjut di chat biar detail tersimpan.'
                  : 'Continue the discussion in chat so scope, price, and timeline stay clear.',
            },
          },
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const transactionId = typeof data?.id === 'string' ? data.id : '';
        const resolvedAmount =
          typeof data?.amount_cents === 'number'
            ? data.amount_cents
            : (amountCents ?? null);
        const resolvedCurrency =
          typeof data?.currency === 'string' ? data.currency : baseCurrency;
        const resolvedStatus =
          typeof data?.status === 'string'
            ? data.status
            : typeof data?.transaction_status === 'string'
              ? data.transaction_status
              : 'pending';
        const resolvedProtectionStatus =
          typeof data?.protection_status === 'string'
            ? data.protection_status
            : 'awaiting_funding';

        const offerPayload = {
          transaction_id: transactionId,
          content_id: resolvedContentId,
          content_title: item?.title ?? 'Listing',
          content_url: listingHref,
          amount_cents: resolvedAmount,
          currency: resolvedCurrency,
          offer_message: offerMessage.trim() || undefined,
          market_side: toMarketSideValue(listingSide),
          created_at: createdAt,
          buyer_id:
            typeof data?.buyer_id === 'string' ? data.buyer_id : user?.id,
          seller_id:
            typeof data?.seller_id === 'string'
              ? data.seller_id
              : item?.owner_id,
          deal_kind:
            typeof data?.deal_kind === 'string' ? data.deal_kind : dealKind,
          fulfillment_mode:
            typeof data?.fulfillment_mode === 'string'
              ? data.fulfillment_mode
              : localFulfillmentMode,
          protection_status: resolvedProtectionStatus,
          snapshot_listing:
            typeof data?.snapshot_listing === 'object'
              ? data.snapshot_listing
              : {
                  title: item?.title,
                  cover_image: item?.cover_image,
                  pricing_mode: pricingMode,
                  market_side: toMarketSideValue(listingSide),
                  content_url: listingHref,
                },
          safety_checklist: safetyChecklist,
          risk_flags: riskFlags,
          status: resolvedStatus,
          flow_mode: offerFlowMode,
          ticket: {
            reference: interactionReference,
            kind: offerFlowMode === 'direct' ? 'transaction' : 'offer',
            status: resolvedStatus,
            created_at: createdAt,
            next_step:
              locale === 'id'
                ? 'Buka detail di chat untuk cek nominal, status, dan tindak lanjut.'
                : 'Open the chat detail to review amount, status, and next actions.',
          },
        };

        let roomId = '';
        try {
          const sellerPeerId =
            (typeof data?.seller_id === 'string' && isUuidLike(data.seller_id)
              ? data.seller_id
              : peerUserId) || '';
          const isSelfSeller =
            Boolean(user?.id) &&
            Boolean(sellerPeerId) &&
            (user?.id || '').trim().toLowerCase() ===
              sellerPeerId.toLowerCase();
          if (sellerPeerId) {
            if (isSelfSeller) {
              throw new Error(
                locale === 'id'
                  ? 'Tidak bisa membuat room chat ke akun sendiri.'
                  : 'Cannot create chat room with your own account.',
              );
            }
            const chatRes = await authFetch('/api/chat/dm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                peer_user_id: sellerPeerId,
                lead: {
                  source: 'offer',
                  name: item?.title || 'Listing',
                  sector: sectorId,
                  value_cents: resolvedAmount ?? undefined,
                  currency: resolvedCurrency,
                  content_id: resolvedContentId,
                  metadata: {
                    transaction_id: transactionId,
                    content_type: item?.type || item?.content_type,
                    slug: item?.slug,
                    flow_mode: offerFlowMode,
                  },
                },
              }),
            });

            const chatPayload = await chatRes.json().catch(() => ({}));
            if (!chatRes.ok) {
              throw new Error(
                chatPayload?.error || 'Failed to create chat room',
              );
            }
            roomId = chatPayload?.room_id || chatPayload?.data?.room_id || '';

            if (roomId) {
              const amountSummary =
                resolvedAmount != null
                  ? formatCurrency(resolvedAmount, resolvedCurrency)
                  : locale === 'id'
                    ? 'nominal menyusul'
                    : 'amount to follow';
              const summary =
                offerFlowMode === 'direct'
                  ? `${locale === 'id' ? 'Deal langsung' : 'Direct deal'}: ${amountSummary}`
                  : isDemandListing
                    ? `${locale === 'id' ? 'Respons kebutuhan' : 'Need response'}: ${amountSummary}`
                    : `Offer: ${amountSummary}`;
              await authFetch(
                `/api/chat/rooms/${encodeURIComponent(roomId)}/messages`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    content: summary,
                    type: offerFlowMode === 'direct' ? 'transaction' : 'offer',
                    attachments: [JSON.stringify(offerPayload)],
                  }),
                },
              );
            }
          } else {
            throw new Error(
              locale === 'id'
                ? 'Seller listing tidak valid untuk membuat room chat.'
                : 'Listing seller is invalid for chat room creation.',
            );
          }
        } catch (chatError) {
          console.error('[OFFER_CHAT_MESSAGE_ERROR]', chatError);
        }

        setRelatedTx({
          id: transactionId,
          content_id: resolvedContentId,
          status: resolvedStatus,
          protection_status: resolvedProtectionStatus,
          amount_cents: resolvedAmount,
          currency: resolvedCurrency,
          created_at:
            typeof data?.created_at === 'string' ? data.created_at : createdAt,
          updated_at:
            typeof data?.updated_at === 'string' ? data.updated_at : createdAt,
          transaction_meta:
            typeof data?.transaction_meta === 'object'
              ? (data.transaction_meta as Record<string, unknown>)
              : {
                  ticket: offerPayload.ticket,
                },
        });
        setShowOfferModal(false);
        setOfferAmount('');
        setOfferMessage('');
        setOfferFlowMode('offer');

        if (offerFlowMode === 'direct' && transactionId) {
          router.push(
            `/transactions?transaction_id=${encodeURIComponent(transactionId)}&open_payment=1`,
          );
          return;
        }

        setCreatedDealHandoff({
          transactionId,
          roomId,
          amountCents: resolvedAmount,
          currency: resolvedCurrency,
          status: resolvedStatus,
          protectionStatus: resolvedProtectionStatus,
          flowMode: offerFlowMode,
        });

        if (!roomId) {
          setChatError(
            locale === 'id'
              ? 'Offer dibuat. Kalau chat belum muncul, tekan tombol chat.'
              : 'Offer created, but chat room is not available yet. Please start chat manually.',
          );
        } else {
          setChatError(null);
        }
      } else {
        const errorData =
          data && typeof data === 'object'
            ? (data as Record<string, unknown>)
            : {};
        const errorMessage =
          (typeof errorData.error === 'string' && errorData.error) ||
          'Failed to submit offer';
        if (errorData.code === 'verification_required') {
          if (errorData.buyer_verified === false) {
            setShowOfferModal(false);
            setVerificationPrompt(readTransactionVerification(user));
            return;
          }
          setOfferError(
            locale === 'id'
              ? 'Transaksi belum bisa diproses. Lanjut chat atau coba lagi.'
              : 'This transaction cannot be processed right now. Continue in chat or try again later.',
          );
          return;
        }
        setOfferError(errorMessage);
      }
    } catch (error) {
      console.error(error);
      setOfferError(
        locale === 'id'
          ? 'Terjadi error saat mengirim offer.'
          : 'Error submitting offer.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartChat = async () => {
    if (!peerUserId) {
      setChatError(
        locale === 'id'
          ? 'Owner listing tidak valid, room chat belum bisa dibuat.'
          : 'Listing owner is invalid, chat room cannot be created yet.',
      );
      return;
    }
    if (isSelfPeer) {
      setChatError(
        locale === 'id'
          ? 'Tidak bisa membuat chat ke akun sendiri.'
          : 'Cannot start chat with your own account.',
      );
      return;
    }
    if (!user) {
      const callbackUrl = `/${locale}/content/${contentId || resolvedContentId}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    setChatStarting(true);
    setChatError(null);
    try {
      const contentIdValid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          resolvedContentId,
        );
      const leadPayload: Record<string, unknown> = {
        source: 'content',
        name: item?.title || 'Listing',
        sector: sectorId,
        value_cents: PROMO_ONLY_MODE ? undefined : item?.price_cents,
        currency: item?.currency,
        metadata: {
          content_type: item?.type || item?.content_type,
          slug: item?.slug,
          market_side: toMarketSideValue(listingSide),
          content_url: listingHref,
        },
      };
      if (contentIdValid) {
        leadPayload.content_id = resolvedContentId;
      }

      const res = await authFetch('/api/chat/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peer_user_id: peerUserId,
          lead: leadPayload,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to start chat');
      }

      const roomId = payload?.room_id || payload?.data?.room_id;
      if (!roomId) {
        throw new Error('Chat room not returned');
      }

      const chatDraft = chatStarterDraft.trim();
      if (item) {
        const itemMeta =
          (item.metadata as Record<string, unknown> | null) || {};
        const listingPayload = {
          source: 'content_detail_chat',
          snapshot_at: new Date().toISOString(),
          content_id: resolvedContentId || item.id,
          content_title: item.title,
          summary: item.summary || '',
          cover_image: item.cover_image || '',
          pricing_mode: PROMO_ONLY_MODE ? 'request' : pricingMode,
          price_cents:
            !PROMO_ONLY_MODE &&
            typeof item.price_cents === 'number' &&
            Number.isFinite(item.price_cents)
              ? item.price_cents
              : 0,
          original_price_cents:
            !PROMO_ONLY_MODE &&
            typeof displayOriginalPriceCents === 'number' &&
            Number.isFinite(displayOriginalPriceCents)
              ? displayOriginalPriceCents
              : undefined,
          promo_label:
            promotionSnapshot?.promoLabel ||
            (typeof item.promo_label === 'string'
              ? item.promo_label
              : undefined),
          currency: item.currency || 'IDR',
          content_type: item.type || item.content_type || 'content',
          market_side: toMarketSideValue(listingSide),
          deal_kind: dealKind,
          slug: item.slug || null,
          content_url: listingHref,
          owner_id: peerUserId || null,
          rating:
            !PROMO_ONLY_MODE && typeof item.rating === 'number'
              ? item.rating
              : undefined,
          review_count:
            !PROMO_ONLY_MODE && typeof item.review_count === 'number'
              ? item.review_count
              : undefined,
          identity_verified: Boolean(
            !PROMO_ONLY_MODE &&
            ((item.seller_stats?.completion_rate || 0) > 0.5 ||
              (item.seller_stats?.total_transactions || 0) > 3),
          ),
          location:
            (typeof itemMeta.location === 'string' && itemMeta.location) ||
            (typeof itemMeta.city === 'string' && itemMeta.city) ||
            (typeof itemMeta.region === 'string' ? itemMeta.region : ''),
        };

        await authFetch(
          `/api/chat/rooms/${encodeURIComponent(roomId)}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content:
                chatDraft ||
                (locale === 'id'
                  ? `Halo kak, saya mau tanya soal ${item.title}.`
                  : `Hi, I want to ask about ${item.title}.`),
              type: 'listing',
              attachments: [JSON.stringify(listingPayload)],
            }),
          },
        ).catch(() => null);
      }

      router.push(`/chat/${encodeURIComponent(roomId)}`);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to start chat');
    } finally {
      setChatStarting(false);
    }
  };

  const openShareListingModal = async () => {
    if (!item || !isOwner) return;
    if (!user) {
      const callbackUrl = `/${locale}/content/${contentId || resolvedContentId}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    setShareLoading(true);
    setShareError(null);
    try {
      const res = await authFetch('/api/chat/inbox?limit=80');
      const payload = (await res.json().catch(() => ({}))) as {
        data?: Array<Record<string, unknown>>;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to load chat rooms');
      }
      const rooms = Array.isArray(payload.data)
        ? payload.data
            .map(room => ({
              id:
                (typeof room.id === 'string' && room.id) ||
                (typeof room.room_id === 'string' ? room.room_id : ''),
              room_name:
                typeof room.room_name === 'string' ? room.room_name : null,
              room_type:
                typeof room.room_type === 'string' ? room.room_type : null,
              room_avatar:
                typeof room.room_avatar === 'string' ? room.room_avatar : null,
              last_message:
                typeof room.last_message === 'string'
                  ? room.last_message
                  : null,
              last_message_at:
                typeof room.last_message_at === 'string'
                  ? room.last_message_at
                  : null,
            }))
            .filter((room): room is InboxRoomItem => Boolean(room.id))
        : [];

      setShareRooms(rooms);
      if (rooms.length > 0) {
        setShareRoomId(prev => prev || rooms[0].id);
      } else {
        setShareRoomId('');
      }
      setShareNote('');
      setShowShareModal(true);
    } catch (err) {
      setShareError(
        err instanceof Error ? err.message : 'Failed to load rooms',
      );
    } finally {
      setShareLoading(false);
    }
  };

  const openReportListingModal = () => {
    if (!item) return;
    setReportReason('spam');
    setReportDetails('');
    setReportError(null);
    setShowReportModal(true);
  };

  const submitListingReport = async () => {
    if (!resolvedContentId) return;
    setReportSubmitting(true);
    setReportError(null);
    try {
      const normalizedDetails = reportDetails.trim();
      const res = await authFetch(`/api/content/${resolvedContentId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reportReason,
          details: normalizedDetails,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to submit report');
      }
      setShowReportModal(false);
    } catch (err) {
      setReportError(
        err instanceof Error ? err.message : 'Failed to submit report',
      );
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleShareListingToRoom = async () => {
    if (!item || !shareRoomId) return;
    setShareSubmitting(true);
    setShareError(null);
    try {
      const itemMeta = (item.metadata as Record<string, unknown> | null) || {};
      const listingPayload = {
        content_id: resolvedContentId || item.id,
        content_title: item.title,
        summary: item.summary || '',
        cover_image: item.cover_image || '',
        pricing_mode: PROMO_ONLY_MODE ? 'request' : pricingMode,
        price_cents:
          !PROMO_ONLY_MODE &&
          typeof item.price_cents === 'number' &&
          Number.isFinite(item.price_cents)
            ? item.price_cents
            : 0,
        original_price_cents:
          !PROMO_ONLY_MODE &&
          typeof displayOriginalPriceCents === 'number' &&
          Number.isFinite(displayOriginalPriceCents)
            ? displayOriginalPriceCents
            : undefined,
        promo_label:
          promotionSnapshot?.promoLabel ||
          (typeof item.promo_label === 'string' ? item.promo_label : undefined),
        currency: item.currency || 'IDR',
        content_type: item.type || item.content_type || 'content',
        market_side: toMarketSideValue(listingSide),
        deal_kind: dealKind,
        slug: item.slug || null,
        content_url: listingHref,
        owner_id: peerUserId || null,
        rating:
          !PROMO_ONLY_MODE && typeof item.rating === 'number'
            ? item.rating
            : undefined,
        review_count:
          !PROMO_ONLY_MODE && typeof item.review_count === 'number'
            ? item.review_count
            : undefined,
        identity_verified: Boolean(
          !PROMO_ONLY_MODE &&
          ((item.seller_stats?.completion_rate || 0) > 0.5 ||
            (item.seller_stats?.total_transactions || 0) > 3),
        ),
        location:
          (typeof itemMeta.location === 'string' && itemMeta.location) ||
          (typeof itemMeta.city === 'string' && itemMeta.city) ||
          (typeof itemMeta.region === 'string' ? itemMeta.region : ''),
      };

      const messageText = shareNote.trim() || `Listing: ${item.title}`;
      const res = await authFetch(
        `/api/chat/rooms/${encodeURIComponent(shareRoomId)}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: messageText,
            type: 'listing',
            attachments: [JSON.stringify(listingPayload)],
          }),
        },
      );
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to share listing');
      }

      setShowShareModal(false);
      setShareNote('');
      router.push(`/chat/${encodeURIComponent(shareRoomId)}`);
    } catch (err) {
      setShareError(
        err instanceof Error ? err.message : 'Failed to share listing',
      );
    } finally {
      setShareSubmitting(false);
    }
  };

  const uploadResumeIfNeeded = async (): Promise<string> => {
    if (applyResumeUrl) return applyResumeUrl;
    if (!applyResumeFile) return '';
    const formData = new FormData();
    formData.append('files', applyResumeFile);
    const res = await authFetch('/api/content/upload-files', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || 'Upload CV gagal');
    }
    const url =
      Array.isArray((data as { files?: Array<{ url?: string }> }).files) &&
      (data as { files: Array<{ url?: string }> }).files[0]?.url
        ? (data as { files: Array<{ url?: string }> }).files[0]?.url
        : Array.isArray((data as { urls?: string[] }).urls)
          ? (data as { urls: string[] }).urls[0]
          : '';
    if (!url) throw new Error('Tidak ada URL CV dari server');
    setApplyResumeUrl(url);
    setApplyResumeFile(null);
    return url;
  };

  const handleApplySubmit = async (quick = false) => {
    if (!peerUserId) {
      setApplyError(
        locale === 'id'
          ? 'Owner listing tidak valid, chat belum bisa dibuka.'
          : 'Listing owner is invalid, chat cannot be opened yet.',
      );
      return;
    }
    if (isSelfPeer) {
      setApplyError(
        locale === 'id'
          ? 'Tidak bisa kirim lamaran ke listing milik akun sendiri.'
          : 'Cannot apply to your own listing.',
      );
      return;
    }
    if (!user) {
      const callbackUrl = `/${locale}/content/${contentId || resolvedContentId}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    setApplySubmitting(true);
    setApplyError(null);
    try {
      if (!applyFullName.trim() || !applyEmail.trim()) {
        throw new Error(
          locale === 'id'
            ? 'Nama & email wajib diisi'
            : 'Name & email required',
        );
      }

      const resumeUrl = await uploadResumeIfNeeded();
      const expectedCents = applyExpectedSalary.trim()
        ? parseInt(applyExpectedSalary.replace(/\D/g, ''), 10) * 100
        : undefined;
      const submittedAt = new Date().toISOString();
      const applicationReference = buildInteractionReference(
        'APL',
        resolvedContentId || item?.id || '',
      );
      const listingSnapshot = {
        title: item?.title,
        cover_image: item?.cover_image,
        content_type: item?.type || item?.content_type,
        pricing_mode: pricingMode,
        price_cents: item?.price_cents,
        currency: item?.currency || 'IDR',
        market_side: toMarketSideValue(listingSide),
        location:
          (typeof meta.location === 'string' && meta.location) ||
          (typeof meta.city === 'string' && meta.city) ||
          (typeof meta.region === 'string' ? meta.region : ''),
        slug: item?.slug || undefined,
        content_url: listingHref,
      };

      const payload = {
        content_id: resolvedContentId,
        content_title: item?.title || 'Listing',
        content_url: listingHref,
        market_side: toMarketSideValue(listingSide),
        deal_kind: dealKind,
        submitted_at: submittedAt,
        ticket: {
          reference: applicationReference,
          kind: 'application',
          status: 'submitted',
          created_at: submittedAt,
          next_step:
            locale === 'id'
              ? 'Recruiter bisa review profil, CV, lalu lanjut chat.'
              : 'The recruiter can review this profile, CV, and continue the discussion in chat.',
        },
        snapshot_listing: listingSnapshot,
        applicant: {
          full_name: applyFullName.trim(),
          email: applyEmail.trim(),
          phone: applyPhone.trim() || undefined,
          headline: applyHeadline.trim() || undefined,
          location: applyLocation.trim() || undefined,
          years_exp: applyYearsExp.trim() || undefined,
          expected_salary_cents: expectedCents,
          message: applyMessage.trim() || undefined,
          resume_url: resumeUrl || undefined,
        },
        quick,
      };

      if (applyRemember) {
        saveQuickApply({
          full_name: payload.applicant.full_name,
          email: payload.applicant.email,
          phone: payload.applicant.phone,
          headline: payload.applicant.headline,
          location: payload.applicant.location,
          years_exp: payload.applicant.years_exp,
          expected_salary: applyExpectedSalary,
          resume_url: payload.applicant.resume_url,
        });
      }

      const leadPayload: Record<string, unknown> = {
        source: 'application',
        name: item?.title || 'Listing',
        sector: sectorId,
        value_cents: expectedCents ?? item?.price_cents,
        currency: item?.currency || 'IDR',
        content_id: resolvedContentId,
        metadata: {
          content_type: item?.type || item?.content_type,
          slug: item?.slug,
          deal_kind: dealKind,
          fulfillment_mode: fulfillmentMode,
          market_side: toMarketSideValue(listingSide),
        },
      };

      const dmRes = await authFetch('/api/chat/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peer_user_id: peerUserId,
          lead: leadPayload,
        }),
      });
      const dmPayload = await dmRes.json().catch(() => ({}));
      if (!dmRes.ok) throw new Error(dmPayload?.error || 'Gagal membuka chat');
      const roomId = dmPayload?.room_id || dmPayload?.data?.room_id;
      if (!roomId) throw new Error('Room chat tidak tersedia');

      await authFetch(
        `/api/chat/rooms/${encodeURIComponent(roomId)}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `${locale === 'id' ? 'Lamaran masuk' : 'Application submitted'}: ${applyHeadline || applyFullName}`,
            type: 'application',
            attachments: [JSON.stringify(payload)],
          }),
        },
      );

      setShowApplyModal(false);
      setApplySubmitting(false);
      router.push(`/chat/${encodeURIComponent(roomId)}`);
    } catch (error) {
      setApplyError(
        error instanceof Error ? error.message : 'Gagal mengirim lamaran',
      );
      setApplySubmitting(false);
    }
  };

  const quickApplyAvailable = Boolean(applyFullName && applyEmail);

  const handleResumeInput = (file: File | null) => {
    setApplyResumeFile(file);
    if (file) setApplyResumeUrl('');
  };

  if (loading) {
    return <ContentDetailSkeleton />;
  }

  if (!item) {
    return (
      <div className="min-h-[100svh] bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface)]">
        <div className="content-width py-12 text-center text-sm text-[color:var(--app-text-soft)]">
          {locale === 'id' ? 'Listing tidak ditemukan.' : 'Listing not found.'}
        </div>
      </div>
    );
  }

  const meta = (item.metadata as Record<string, unknown> | null) || {};
  const publicReference = readPublicReference(item as CatalogContentItem);
  const localeCode = locale === 'id' ? 'id' : 'en';
  const ownerCandidateIds = [
    item.owner_id,
    typeof meta.owner_id === 'string' ? meta.owner_id : null,
    typeof meta.seller_id === 'string' ? meta.seller_id : null,
    typeof meta.user_id === 'string' ? meta.user_id : null,
    typeof meta.contact_user_id === 'string' ? meta.contact_user_id : null,
  ]
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    )
    .map(value => value.trim());
  const peerUserId =
    ownerCandidateIds.find(value => isUuidLike(value)) ||
    (isUuidLike(item.owner_id) ? item.owner_id.trim() : '');
  const isOwner =
    Boolean(user?.id) &&
    Boolean(peerUserId) &&
    (user?.id || '').trim().toLowerCase() === peerUserId.toLowerCase();
  const isSelfPeer =
    Boolean(user?.id) &&
    Boolean(peerUserId) &&
    (user?.id || '').trim().toLowerCase() === peerUserId.toLowerCase();
  const sectorId = meta.sector as string | undefined;
  const sectorObj = sectorId ? getSectorById(sectorId) : null;
  const images = getImages(item);
  const documents = getDocuments(item);
  const contentType = item.type || item.content_type || 'product';
  const rawType = String(contentType || '').toLowerCase();
  const isOpportunityType =
    rawType.includes('opportun') ||
    rawType.includes('franchise') ||
    rawType.includes('reseller') ||
    rawType.includes('distributor') ||
    rawType.includes('partnership') ||
    rawType.includes('kemitra');
  const displayType =
    rawType.includes('job') || rawType.includes('vacancy') || rawType.includes('loker')
      ? 'job'
      : rawType.includes('tool_rental') || rawType.includes('rental')
        ? 'tool_rental'
        : rawType.includes('company') ||
            rawType.includes('business') ||
            rawType.includes('umkm') ||
            isOpportunityType
          ? 'company'
          : rawType.includes('service')
            ? 'service'
            : rawType.includes('property') || rawType.includes('place')
              ? 'property'
              : rawType.includes('product') || rawType.includes('material')
                ? 'product'
                : rawType.includes('profile') ||
                    rawType.includes('user') ||
                    rawType.includes('talent') ||
                    rawType.includes('freelancer') ||
                    rawType.includes('mentor') ||
                    rawType.includes('expert')
                  ? 'profile'
                  : 'product';
  const dealKind: DealKind =
    displayType === 'job'
      ? 'job'
      : displayType === 'tool_rental'
        ? 'tool_rental'
        : displayType === 'service'
          ? 'service'
          : displayType === 'property'
            ? 'property'
            : displayType === 'profile'
              ? 'profile'
              : displayType === 'product'
                ? 'product'
                : 'other';
  const fulfillmentMode =
    displayType === 'service' || displayType === 'profile'
      ? 'remote'
      : displayType === 'tool_rental'
        ? 'pickup'
        : displayType === 'job'
          ? 'onsite'
          : displayType === 'property'
            ? 'onsite'
            : 'shipping';
  const listingSide = resolveListingSide({
    type: contentType,
    metadata: meta,
    title: item.title,
    summary: item.summary,
  });
  const listingSideLabel = publicReference
    ? locale === 'id'
      ? 'Referensi publik'
      : 'Public reference'
    : getListingSideVerbLabel(listingSide, localeCode);
  const isDemandListing = listingSide === 'demand';
  const ListingSideIcon = publicReference
    ? Globe2
    : isDemandListing
      ? Search
      : Store;
  const listingSideVisual = publicReference
    ? {
        chip: 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] ring-[color:var(--app-border)]',
        price: 'text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]',
      }
    : isDemandListing
      ? {
          chip: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/12 dark:text-blue-200 dark:ring-blue-400/20',
          price: 'text-blue-600 dark:text-blue-300',
        }
      : {
          chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/12 dark:text-emerald-200 dark:ring-emerald-400/20',
          price: 'text-emerald-600 dark:text-emerald-300',
        };
  const listingHref = buildContentHref(
    resolvedContentId || item.id,
    item.title,
    item.slug,
  );
  const displayFields = filterFieldsForListingSide(
    getFieldsForDisplay(contentType, sectorId, 'detail'),
    contentType,
    listingSide,
  ).filter(
    f =>
      ![
        'title',
        'summary',
        'body',
        'price_cents',
        'tags',
        'location',
        'images',
      ].includes(f.key),
  );
  const ct = CONTENT_TYPES.find(c => c.id === contentType);
  const pricingMode =
    String(
      item.pricing_mode ||
        (typeof item.price_cents === 'number' && item.price_cents > 0
          ? 'fixed'
          : 'request'),
    ).toLowerCase() === 'request'
      ? 'request'
      : 'fixed';
  const promotionSnapshot = createPromotionSnapshot(
    meta.promotion,
    typeof item.price_cents === 'number' ? item.price_cents : undefined,
    localeCode,
  );
  const displayOriginalPriceCents =
    promotionSnapshot?.estimatedOriginalPriceCents ||
    (typeof item.original_price_cents === 'number'
      ? item.original_price_cents
      : undefined);
  const hasPrice =
    !PROMO_ONLY_MODE &&
    !publicReference &&
    pricingMode === 'fixed' &&
    typeof item.price_cents === 'number' &&
    item.price_cents > 0;
  const hasOriginalPrice =
    !PROMO_ONLY_MODE &&
    hasPrice &&
    typeof displayOriginalPriceCents === 'number' &&
    displayOriginalPriceCents > (item.price_cents || 0);
  const discountPercent = hasOriginalPrice
    ? Math.round(
        ((displayOriginalPriceCents - (item.price_cents as number)) /
          displayOriginalPriceCents) *
          100,
      )
    : 0;
  const PromotionIcon =
    promotionSnapshot?.offerType === 'discount'
      ? BadgePercent
      : promotionSnapshot?.offerType === 'loyalty_card'
        ? Gift
        : Trophy;
  const priceUnitLabel = resolveContentPriceUnitLabel(
    {
      id: item.id,
      content_type: item.content_type || item.type,
      category: item.type,
      price_unit: item.price_unit,
      metadata: meta,
    },
    localeCode,
  );
  const demandBudgetCents = readPositiveInteger(meta.budget_cents);
  const demandBudgetLabel = isDemandListing
    ? readMetaText(meta, 'budget_label', 'budget', 'capital_range') ||
      (demandBudgetCents > 0
        ? formatCurrency(demandBudgetCents, item.currency || 'IDR')
        : '')
    : '';
  const flexibleBudgetLabel =
    locale === 'id' ? 'Budget fleksibel' : 'Flexible budget';
  const priceLabel = publicReference
    ? locale === 'id'
      ? 'Bukan penawaran'
      : 'Not an offer'
    : PROMO_ONLY_MODE
      ? locale === 'id'
        ? 'Tanya detail'
        : 'Ask details'
      : hasPrice
        ? formatCurrency(item.price_cents as number, item.currency || 'IDR')
        : isDemandListing
          ? demandBudgetLabel || flexibleBudgetLabel
          : locale === 'id'
            ? 'Harga menyesuaikan'
            : 'Price on request';
  const priceLabelWithUnit = hasPrice
    ? formatPriceWithUnit(priceLabel, priceUnitLabel)
    : priceLabel;
  const salaryRange =
    typeof meta.salary_range === 'string' ? meta.salary_range.trim() : '';
  const priceHeading = publicReference
    ? locale === 'id'
      ? 'Status data'
      : 'Data status'
    : PROMO_ONLY_MODE
      ? locale === 'id'
        ? 'Info promosi'
        : 'Promo info'
      : displayType === 'job'
        ? locale === 'id'
          ? 'Kompensasi'
          : 'Compensation'
        : !isDemandListing && displayType === 'tool_rental'
          ? locale === 'id'
            ? 'Tarif sewa'
            : 'Rental rate'
          : displayType === 'company'
            ? locale === 'id'
              ? 'Profil perusahaan'
              : 'Company profile'
            : isDemandListing
              ? locale === 'id'
                ? 'Budget acuan'
                : 'Reference budget'
              : displayType === 'service'
                ? locale === 'id'
                  ? 'Mulai dari'
                  : 'Starting from'
                : displayType === 'profile'
                  ? locale === 'id'
                    ? 'Rate'
                    : 'Rate'
                  : locale === 'id'
                    ? 'Harga'
                    : 'Price';
  const primaryPrice = publicReference
    ? locale === 'id'
      ? 'Referensi saja'
      : 'Reference only'
    : PROMO_ONLY_MODE
      ? locale === 'id'
        ? 'Tanya detail'
        : 'Ask details'
      : displayType === 'job'
        ? salaryRange ||
          (hasPrice
            ? priceLabelWithUnit
            : locale === 'id'
              ? 'Nego'
              : 'Negotiable')
        : displayType === 'company'
          ? (typeof meta.industry_focus === 'string' && meta.industry_focus) ||
            (typeof meta.company_size === 'string' && meta.company_size) ||
            (locale === 'id' ? 'Profil publik' : 'Public profile')
          : isDemandListing
            ? demandBudgetLabel || flexibleBudgetLabel
            : displayType === 'tool_rental'
              ? hasPrice
                ? priceLabelWithUnit
                : locale === 'id'
                  ? 'Tarif menyesuaikan'
                  : 'Rate on request'
              : priceLabelWithUnit;
  const displayPriceHeading = PROMO_ONLY_MODE
    ? locale === 'id'
      ? 'Mulai dari chat'
      : 'Start with chat'
    : !isDemandListing && displayType === 'service' && priceUnitLabel
      ? `${locale === 'id' ? 'Harga per' : 'Price per'} ${priceUnitLabel}`
      : priceHeading;
  const baseCurrency = item.currency || 'IDR';
  const listPriceCents = hasPrice ? Number(item.price_cents || 0) : 0;
  const suggestedOfferCents = (() => {
    if (!listPriceCents) return [] as number[];
    if (displayType === 'property')
      return [
        Math.round(listPriceCents * 0.97),
        listPriceCents,
        Math.round(listPriceCents * 1.03),
      ];
    if (displayType === 'tool_rental')
      return [
        Math.round(listPriceCents * 0.95),
        listPriceCents,
        Math.round(listPriceCents * 1.08),
      ];
    if (displayType === 'service' || displayType === 'profile')
      return [
        Math.round(listPriceCents * 0.9),
        listPriceCents,
        Math.round(listPriceCents * 1.1),
      ];
    return [
      Math.round(listPriceCents * 0.92),
      listPriceCents,
      Math.round(listPriceCents * 1.05),
    ];
  })();
  const offerLabel =
    displayType === 'job'
      ? locale === 'id'
        ? 'Negosiasi gaji'
        : 'Negotiate salary'
      : displayType === 'company'
        ? locale === 'id'
          ? 'Minta intro'
          : 'Request intro'
        : isDemandListing
          ? locale === 'id'
            ? displayType === 'service'
              ? 'Kirim proposal'
              : 'Kirim respons'
            : displayType === 'service'
              ? 'Send proposal'
              : 'Send response'
          : displayType === 'tool_rental'
            ? locale === 'id'
              ? 'Ajukan booking / negosiasi sewa'
              : 'Request booking / negotiate rental'
            : displayType === 'service'
              ? locale === 'id'
                ? 'Minta penawaran'
                : 'Request quote'
              : displayType === 'property'
                ? locale === 'id'
                  ? 'Buat penawaran'
                  : 'Make offer'
                : displayType === 'profile'
                  ? locale === 'id'
                    ? 'Ajukan tawaran'
                    : 'Make offer'
                  : locale === 'id'
                    ? 'Buat penawaran'
                    : 'Make offer';
  const chatLabel =
    displayType === 'job'
      ? locale === 'id'
        ? 'Lamar / Chat'
        : 'Apply / Chat'
      : displayType === 'company'
        ? locale === 'id'
          ? 'Chat perusahaan'
          : 'Chat company'
        : isDemandListing
          ? locale === 'id'
            ? 'Tanya detail kebutuhan'
            : 'Ask for details'
          : displayType === 'tool_rental'
            ? locale === 'id'
              ? 'Chat pemilik alat'
              : 'Chat asset owner'
            : displayType === 'service'
              ? locale === 'id'
                ? 'Chat penyedia'
                : 'Chat provider'
              : displayType === 'property'
                ? locale === 'id'
                  ? 'Jadwalkan survei'
                  : 'Schedule viewing'
                : displayType === 'profile'
                  ? locale === 'id'
                    ? 'Undang ke proyek'
                    : 'Invite to project'
                  : locale === 'id'
                    ? 'Chat penjual'
                    : 'Chat seller';
  const offerSubmitLabel =
    displayType === 'job'
      ? locale === 'id'
        ? 'Kirim negosiasi'
        : 'Send negotiation'
      : displayType === 'company'
        ? locale === 'id'
          ? 'Kirim intro'
          : 'Send intro'
        : isDemandListing
          ? locale === 'id'
            ? 'Kirim respons'
            : 'Send response'
          : displayType === 'tool_rental'
            ? locale === 'id'
              ? 'Kirim permintaan sewa'
              : 'Send rental request'
            : displayType === 'service'
              ? locale === 'id'
                ? 'Kirim permintaan'
                : 'Send request'
              : locale === 'id'
                ? 'Kirim penawaran'
                : 'Submit offer';
  const offerPrompt =
    displayType === 'job'
      ? locale === 'id'
        ? 'Kirim detail kompensasi yang Anda ajukan.'
        : 'Send the compensation you propose.'
      : displayType === 'company'
        ? locale === 'id'
          ? 'Tulis konteks intro atau kemitraan.'
          : 'Explain the intro context, partnership angle, or what you want to discuss.'
        : isDemandListing
          ? locale === 'id'
            ? 'Tulis cara Anda memenuhi kebutuhan ini.'
            : 'Explain how you can fulfill this listing need.'
          : displayType === 'tool_rental'
            ? locale === 'id'
              ? 'Tulis tanggal, durasi, kebutuhan alat.'
              : 'Share your rental date, duration, and asset needs.'
            : displayType === 'service'
              ? locale === 'id'
                ? 'Tulis layanan dan budget.'
                : 'Share your service needs and budget.'
              : displayType === 'profile'
                ? locale === 'id'
                  ? 'Ajukan rate atau budget proyek Anda.'
                  : 'Share your rate or project budget.'
                : locale === 'id'
                  ? 'Ajukan harga terbaik Anda.'
                  : 'Send your best offer.';
  const offerAmountLabel =
    displayType === 'job'
      ? locale === 'id'
        ? 'Gaji yang diajukan (IDR) *'
        : 'Proposed salary (IDR) *'
      : displayType === 'company'
        ? locale === 'id'
          ? 'Budget / nilai peluang (IDR) *'
          : 'Budget / opportunity value (IDR) *'
        : isDemandListing
          ? locale === 'id'
            ? 'Nominal respons Anda (IDR) *'
            : 'Your response amount (IDR) *'
          : displayType === 'tool_rental'
            ? locale === 'id'
              ? 'Budget sewa / rate yang Anda ajukan (IDR) *'
              : 'Proposed rental budget / rate (IDR) *'
            : displayType === 'service'
              ? locale === 'id'
                ? 'Budget (IDR) *'
                : 'Budget (IDR) *'
              : displayType === 'profile'
                ? locale === 'id'
                  ? 'Rate / budget (IDR) *'
                  : 'Rate / budget (IDR) *'
                : locale === 'id'
                  ? 'Nominal penawaran (IDR) *'
                  : 'Offer amount (IDR) *';
  const offerAmountPlaceholder =
    displayType === 'job'
      ? locale === 'id'
        ? 'contoh: 12000000'
        : 'e.g. 12000000'
      : displayType === 'company'
        ? locale === 'id'
          ? 'contoh: 10000000'
          : 'e.g. 10000000'
        : isDemandListing
          ? locale === 'id'
            ? 'contoh: 3500000'
            : 'e.g. 3500000'
          : displayType === 'tool_rental'
            ? locale === 'id'
              ? 'contoh: 450000'
              : 'e.g. 450000'
            : displayType === 'service'
              ? locale === 'id'
                ? 'contoh: 2500000'
                : 'e.g. 2500000'
              : locale === 'id'
                ? 'contoh: 5000000'
                : 'e.g. 5000000';
  const offerMessagePlaceholder = isDemandListing
    ? locale === 'id'
      ? 'Tulis solusi, scope, timeline, dan syarat kerja Anda...'
      : 'Share your solution, scope, timeline, and terms...'
    : displayType === 'tool_rental'
      ? locale === 'id'
        ? 'Tulis tanggal pakai, durasi, lokasi pickup, dan kebutuhan detail...'
        : 'Share the rental date, duration, pickup location, and key details...'
      : displayType === 'company'
        ? locale === 'id'
          ? 'Tulis konteks intro atau topik...'
          : 'Describe the intro context, partnership need, or what you want to discuss...'
        : displayType === 'service'
          ? locale === 'id'
            ? 'Tulis kebutuhan layanan dan deadline...'
            : 'Share your needs and deadline...'
          : displayType === 'job'
            ? locale === 'id'
              ? 'Tulis alasan, benefit, atau detail tambahan...'
              : 'Add context, benefits, or extra details...'
            : locale === 'id'
              ? 'Tulis pesan untuk penjual...'
              : 'Add a message for the seller...';
  const TypeIcon =
    displayType === 'job'
      ? Briefcase
      : displayType === 'tool_rental'
        ? Wrench
        : displayType === 'company'
          ? isOpportunityType
            ? Handshake
            : Building2
          : displayType === 'service'
            ? Wrench
            : displayType === 'property'
              ? Building2
              : displayType === 'profile'
                ? User
                : Package;
  const listingLikeCount = contentLikeCount ?? resolveListingLikeCount(item);
  const sellerStats = item.seller_stats || null;
  const sellerRating =
    !PROMO_ONLY_MODE && typeof sellerStats?.rating === 'number'
      ? sellerStats.rating
      : 0;
  const sellerReviewCount =
    !PROMO_ONLY_MODE && typeof sellerStats?.review_count === 'number'
      ? sellerStats.review_count
      : 0;
  const sellerCompletedTransactions =
    typeof sellerStats?.completed_transactions === 'number'
      ? sellerStats.completed_transactions
      : 0;
  const showSellerStats =
    sellerReviewCount > 0 || sellerCompletedTransactions > 0;
  const metadataOwnerProfile =
    meta.owner_profile &&
    typeof meta.owner_profile === 'object' &&
    !Array.isArray(meta.owner_profile)
      ? (meta.owner_profile as ContentOwnerProfile)
      : null;
  const ownerProfile = item.owner_profile || metadataOwnerProfile;
  const ownerDisplayName =
    ownerProfile?.full_name ||
    ownerProfile?.username ||
    (typeof meta.full_name === 'string' ? meta.full_name : '') ||
    (typeof meta.username === 'string' ? meta.username : '') ||
    '';
  const ownerHeadline =
    ownerProfile?.headline ||
    (typeof meta.headline === 'string' ? meta.headline : '') ||
    '';
  const ownerProfileHref =
    ownerProfile && (ownerProfile.id || peerUserId)
      ? buildPublicProfileHref({
          id: ownerProfile.id || peerUserId,
          username: ownerProfile.username || undefined,
          full_name: ownerProfile.full_name || ownerDisplayName || item.title,
          title: ownerDisplayName || item.title,
        })
      : peerUserId
        ? buildPublicProfileHref({
            id: peerUserId,
            full_name: ownerDisplayName || item.title,
            title: ownerDisplayName || item.title,
          })
        : null;
  const ownerAvatarUrl = normalizeContentMediaUrl(
    ownerProfile?.avatar_url ||
      (typeof meta.avatar_url === 'string' ? meta.avatar_url : ''),
  );
  const workModeValue =
    typeof meta.work_mode === 'string' ? meta.work_mode : '';
  const workModeOption = WORK_MODE_OPTIONS.find(o => o.value === workModeValue);
  const workModeLabel = workModeOption
    ? locale === 'id'
      ? workModeOption.labelId
      : workModeOption.labelEn
    : humanizeToken(workModeValue);
  const highlightItems = (() => {
    if (displayType === 'job') {
      const openingsValue =
        typeof meta.openings === 'number' || typeof meta.openings === 'string'
          ? `${meta.openings} ${locale === 'id' ? 'posisi' : 'positions'}`
          : '';
      return [
        {
          key: 'company_name',
          label: locale === 'id' ? 'Perusahaan' : 'Company',
          value: typeof meta.company_name === 'string' ? meta.company_name : '',
        },
        {
          key: 'employment_type',
          label: locale === 'id' ? 'Tipe kerja' : 'Employment',
          value: humanizeToken(meta.employment_type),
        },
        {
          key: 'level',
          label: locale === 'id' ? 'Level' : 'Level',
          value: humanizeToken(meta.level),
        },
        {
          key: 'work_mode',
          label: locale === 'id' ? 'Mode kerja' : 'Work mode',
          value: workModeLabel,
        },
        {
          key: 'salary_range',
          label: locale === 'id' ? 'Range gaji' : 'Salary range',
          value: salaryRange || (hasPrice ? priceLabelWithUnit : ''),
        },
        {
          key: 'openings',
          label: locale === 'id' ? 'Jumlah posisi' : 'Openings',
          value: openingsValue,
        },
        {
          key: 'start_date',
          label: locale === 'id' ? 'Mulai' : 'Start date',
          value: formatDate(String(meta.start_date || '')),
        },
        {
          key: 'application_deadline',
          label: locale === 'id' ? 'Batas lamaran' : 'Deadline',
          value: formatDate(String(meta.application_deadline || '')),
        },
      ];
    }
    if (isDemandListing) {
      if (displayType === 'service') {
        const serviceOutputValue = formatMetaList(meta.output_needed);
        const serviceAreaValue = readMetaText(
          meta,
          'area_served',
          'location',
          'city',
        );
        const serviceDeadlineValue = readMetaText(
          meta,
          'delivery_time',
          'deadline',
        );
        const serviceNeedStartValue = formatDate(
          String(meta.next_available || ''),
        );
        const serviceProviderNotes = readMetaText(
          meta,
          'client_requirements',
          'budget_note',
        );
        return [
          {
            key: 'work_mode',
            label: locale === 'id' ? 'Mode kerja' : 'Work mode',
            value: workModeLabel,
          },
          {
            key: 'price_cents',
            label: locale === 'id' ? 'Budget' : 'Budget',
            value: hasPrice ? priceLabelWithUnit : '',
          },
          {
            key: serviceOutputValue ? 'output_needed' : 'area_served',
            label: serviceOutputValue
              ? locale === 'id'
                ? 'Output utama'
                : 'Primary output'
              : locale === 'id'
                ? 'Area kebutuhan'
                : 'Need area',
            value: serviceOutputValue || serviceAreaValue,
          },
          {
            key: 'delivery_time',
            label: locale === 'id' ? 'Deadline' : 'Deadline',
            value: serviceDeadlineValue,
          },
          {
            key: serviceNeedStartValue
              ? 'next_available'
              : 'client_requirements',
            label: serviceNeedStartValue
              ? locale === 'id'
                ? 'Mulai dibutuhkan'
                : 'Needed from'
              : locale === 'id'
                ? 'Catatan'
                : 'Notes',
            value: serviceNeedStartValue || serviceProviderNotes,
          },
        ];
      }
      if (displayType === 'property') {
        const areaValue =
          meta.area_sqm != null && String(meta.area_sqm).trim()
            ? `${meta.area_sqm} m2`
            : '';
        const preferredPeriodValue = readMetaText(meta, 'preferred_period');
        const needStartValue = formatDate(String(meta.available_from || ''));
        const trafficValue = readMetaText(meta, 'traffic_note', 'deadline');
        return [
          {
            key: 'listing_purpose',
            label: locale === 'id' ? 'Kebutuhan' : 'Need type',
            value: humanizeToken(meta.listing_purpose),
          },
          {
            key: 'property_type',
            label: locale === 'id' ? 'Tipe properti' : 'Property type',
            value: humanizeToken(meta.property_type),
          },
          {
            key: 'price_cents',
            label: locale === 'id' ? 'Budget' : 'Budget',
            value: hasPrice ? priceLabelWithUnit : '',
          },
          {
            key: areaValue ? 'area_sqm' : 'preferred_period',
            label: areaValue
              ? locale === 'id'
                ? 'Luas target'
                : 'Target area'
              : locale === 'id'
                ? 'Periode target'
                : 'Preferred period',
            value: areaValue || preferredPeriodValue,
          },
          {
            key: needStartValue ? 'available_from' : 'traffic_note',
            label: needStartValue
              ? locale === 'id'
                ? 'Mulai dibutuhkan'
                : 'Needed from'
              : locale === 'id'
                ? 'Traffic yang dicari'
                : 'Target traffic',
            value: needStartValue || trafficValue,
          },
        ];
      }
      if (displayType === 'tool_rental') {
        const rentalSupportValue = formatMetaList(meta.support_needed);
        const rentalCategoryValue =
          readMetaText(meta, 'brand') || humanizeToken(meta.asset_type);
        const rentalDurationValue =
          meta.minimum_rental_days != null
            ? `${meta.minimum_rental_days} ${locale === 'id' ? 'hari' : 'days'}`
            : readMetaText(meta, 'preferred_period');
        return [
          {
            key: 'brand',
            label: locale === 'id' ? 'Kategori alat' : 'Asset category',
            value: rentalCategoryValue,
          },
          {
            key: rentalSupportValue ? 'support_needed' : 'minimum_rental_days',
            label: rentalSupportValue
              ? locale === 'id'
                ? 'Support dibutuhkan'
                : 'Support needed'
              : locale === 'id'
                ? 'Durasi minimum'
                : 'Minimum duration',
            value: rentalSupportValue || rentalDurationValue,
          },
          {
            key: 'pickup_location',
            label: locale === 'id' ? 'Area pickup' : 'Pickup area',
            value:
              typeof meta.pickup_location === 'string'
                ? meta.pickup_location
                : '',
          },
          {
            key: 'delivery_estimate',
            label: locale === 'id' ? 'Tanggal pakai' : 'Needed date',
            value: readMetaText(meta, 'delivery_estimate', 'deadline'),
          },
          {
            key: 'price_cents',
            label: locale === 'id' ? 'Budget' : 'Budget',
            value: hasPrice ? priceLabelWithUnit : '',
          },
        ];
      }
      const productPartnerValue = formatMetaList(meta.preferred_partner);
      const productActivationValue = readMetaText(meta, 'budget_note', 'specs');
      return [
        {
          key: productPartnerValue ? 'preferred_partner' : 'brand',
          label: productPartnerValue
            ? locale === 'id'
              ? 'Partner / channel'
              : 'Partner / channel'
            : locale === 'id'
              ? 'Merek / kategori'
              : 'Brand / category',
          value:
            productPartnerValue ||
            (typeof meta.brand === 'string' ? meta.brand : ''),
        },
        {
          key: productActivationValue ? 'budget_note' : 'condition',
          label: productActivationValue
            ? locale === 'id'
              ? 'Fokus kebutuhan'
              : 'Need focus'
            : locale === 'id'
              ? 'Kondisi target'
              : 'Target condition',
          value: productActivationValue || humanizeToken(meta.condition),
        },
        {
          key: meta.stock != null ? 'stock' : 'location',
          label:
            meta.stock != null
              ? locale === 'id'
                ? 'Jumlah dibutuhkan'
                : 'Quantity needed'
              : locale === 'id'
                ? 'Kota utama'
                : 'Primary city',
          value:
            meta.stock != null
              ? String(meta.stock)
              : readMetaText(meta, 'location', 'city'),
        },
        {
          key: 'delivery_estimate',
          label: locale === 'id' ? 'Target diterima' : 'Target receive date',
          value: readMetaText(meta, 'delivery_estimate', 'deadline'),
        },
        {
          key: 'price_cents',
          label: locale === 'id' ? 'Budget' : 'Budget',
          value: hasPrice ? priceLabelWithUnit : '',
        },
      ];
    }
    if (displayType === 'service') {
      return [
        {
          key: 'work_mode',
          label: locale === 'id' ? 'Mode layanan' : 'Delivery mode',
          value: workModeLabel,
        },
        {
          key: 'rate_type',
          label: locale === 'id' ? 'Tipe tarif' : 'Rate type',
          value: humanizeToken(meta.rate_type),
        },
        {
          key: 'level',
          label: locale === 'id' ? 'Level' : 'Level',
          value: humanizeToken(meta.level),
        },
        {
          key: 'availability',
          label: locale === 'id' ? 'Ketersediaan' : 'Availability',
          value: typeof meta.availability === 'string' ? meta.availability : '',
        },
        {
          key: 'delivery_time',
          label: locale === 'id' ? 'Waktu pengerjaan' : 'Delivery time',
          value:
            typeof meta.delivery_time === 'string' ? meta.delivery_time : '',
        },
        {
          key: 'next_available',
          label: locale === 'id' ? 'Mulai tersedia' : 'Next available',
          value: formatDate(String(meta.next_available || '')),
        },
      ];
    }
    if (displayType === 'tool_rental') {
      const depositCents = Number(meta.deposit_amount_cents);
      const complaintWindowValue =
        meta.complaint_window_hours != null &&
        String(meta.complaint_window_hours).trim()
          ? `${meta.complaint_window_hours} ${
              locale === 'id' ? 'jam' : 'hours'
            }`
          : '';
      return [
        {
          key: 'brand',
          label: locale === 'id' ? 'Merek' : 'Brand',
          value: typeof meta.brand === 'string' ? meta.brand : '',
        },
        {
          key: 'model_name',
          label: locale === 'id' ? 'Model' : 'Model',
          value: typeof meta.model_name === 'string' ? meta.model_name : '',
        },
        {
          key: 'condition',
          label: locale === 'id' ? 'Kondisi' : 'Condition',
          value: humanizeToken(meta.condition),
        },
        {
          key: 'deposit_amount_cents',
          label: locale === 'id' ? 'Deposit' : 'Deposit',
          value:
            Number.isFinite(depositCents) && depositCents > 0
              ? formatCurrency(depositCents, item.currency || 'IDR')
              : '',
        },
        {
          key: 'minimum_rental_days',
          label: locale === 'id' ? 'Durasi minimum' : 'Minimum duration',
          value:
            meta.minimum_rental_days != null
              ? `${meta.minimum_rental_days} ${
                  locale === 'id' ? 'hari' : 'days'
                }`
              : '',
        },
        {
          key: 'pickup_location',
          label: locale === 'id' ? 'Pickup' : 'Pickup',
          value:
            typeof meta.pickup_location === 'string'
              ? meta.pickup_location
              : '',
        },
        {
          key: 'availability_status',
          label: locale === 'id' ? 'Ketersediaan' : 'Availability',
          value: humanizeToken(meta.availability_status),
        },
        {
          key: 'complaint_window_hours',
          label: locale === 'id' ? 'Jendela komplain' : 'Complaint window',
          value: complaintWindowValue,
        },
      ];
    }
    if (displayType === 'company') {
      const foundedYear =
        meta.founded_year != null ? String(meta.founded_year) : '';
      return [
        {
          key: 'company_name',
          label: locale === 'id' ? 'Perusahaan' : 'Company',
          value:
            typeof meta.company_name === 'string'
              ? meta.company_name
              : item.title,
        },
        {
          key: 'industry_focus',
          label: locale === 'id' ? 'Industri' : 'Industry',
          value:
            typeof meta.industry_focus === 'string' ? meta.industry_focus : '',
        },
        {
          key: 'company_size',
          label: locale === 'id' ? 'Ukuran' : 'Company size',
          value: humanizeToken(meta.company_size),
        },
        {
          key: 'headquarters',
          label: locale === 'id' ? 'Kantor pusat' : 'Headquarters',
          value: typeof meta.headquarters === 'string' ? meta.headquarters : '',
        },
        {
          key: 'founded_year',
          label: locale === 'id' ? 'Tahun berdiri' : 'Founded',
          value: foundedYear,
        },
        {
          key: 'hiring_focus',
          label: locale === 'id' ? 'Fokus' : 'Focus',
          value: typeof meta.hiring_focus === 'string' ? meta.hiring_focus : '',
        },
      ];
    }
    if (displayType === 'property') {
      const areaValue =
        meta.area_sqm != null && String(meta.area_sqm).trim()
          ? `${meta.area_sqm} m2`
          : '';
      return [
        {
          key: 'property_type',
          label: locale === 'id' ? 'Tipe properti' : 'Property type',
          value: humanizeToken(meta.property_type),
        },
        {
          key: 'bedrooms',
          label: locale === 'id' ? 'Kamar tidur' : 'Bedrooms',
          value: meta.bedrooms != null ? String(meta.bedrooms) : '',
        },
        {
          key: 'bathrooms',
          label: locale === 'id' ? 'Kamar mandi' : 'Bathrooms',
          value: meta.bathrooms != null ? String(meta.bathrooms) : '',
        },
        {
          key: 'area_sqm',
          label: locale === 'id' ? 'Luas' : 'Area',
          value: areaValue,
        },
        {
          key: 'available_from',
          label: locale === 'id' ? 'Tersedia' : 'Available from',
          value: formatDate(String(meta.available_from || '')),
        },
        {
          key: 'ownership',
          label: locale === 'id' ? 'Kepemilikan' : 'Ownership',
          value: humanizeToken(meta.ownership),
        },
        {
          key: 'year_built',
          label: locale === 'id' ? 'Tahun bangun' : 'Year built',
          value: meta.year_built != null ? String(meta.year_built) : '',
        },
        {
          key: 'lease_term',
          label: locale === 'id' ? 'Durasi sewa' : 'Lease term',
          value: typeof meta.lease_term === 'string' ? meta.lease_term : '',
        },
        {
          key: 'address',
          label: locale === 'id' ? 'Alamat' : 'Address',
          value: typeof meta.address === 'string' ? meta.address : '',
        },
      ];
    }
    if (displayType === 'profile') {
      return [
        {
          key: 'experience',
          label: locale === 'id' ? 'Pengalaman' : 'Experience',
          value: typeof meta.experience === 'string' ? meta.experience : '',
        },
        {
          key: 'tech_stack',
          label: locale === 'id' ? 'Tech stack' : 'Tech stack',
          value: typeof meta.tech_stack === 'string' ? meta.tech_stack : '',
        },
        {
          key: 'availability',
          label: locale === 'id' ? 'Ketersediaan' : 'Availability',
          value: typeof meta.availability === 'string' ? meta.availability : '',
        },
        {
          key: 'work_mode',
          label: locale === 'id' ? 'Mode kerja' : 'Work mode',
          value: workModeLabel,
        },
        {
          key: 'rate_type',
          label: locale === 'id' ? 'Tipe tarif' : 'Rate type',
          value: humanizeToken(meta.rate_type),
        },
      ];
    }
    return [
      {
        key: 'brand',
        label: locale === 'id' ? 'Merek' : 'Brand',
        value: typeof meta.brand === 'string' ? meta.brand : '',
      },
      {
        key: 'condition',
        label: locale === 'id' ? 'Kondisi' : 'Condition',
        value: humanizeToken(meta.condition),
      },
      {
        key: 'stock',
        label: locale === 'id' ? 'Stok' : 'Stock',
        value: meta.stock != null ? String(meta.stock) : '',
      },
      {
        key: 'warranty',
        label: locale === 'id' ? 'Garansi' : 'Warranty',
        value: typeof meta.warranty === 'string' ? meta.warranty : '',
      },
      {
        key: 'delivery_estimate',
        label: locale === 'id' ? 'Estimasi kirim' : 'Delivery estimate',
        value:
          typeof meta.delivery_estimate === 'string'
            ? meta.delivery_estimate
            : '',
      },
      {
        key: 'shipping_method',
        label: locale === 'id' ? 'Metode kirim' : 'Shipping method',
        value: humanizeToken(meta.shipping_method),
      },
      {
        key: 'return_policy',
        label: locale === 'id' ? 'Kebijakan retur' : 'Return policy',
        value: typeof meta.return_policy === 'string' ? meta.return_policy : '',
      },
    ];
  })().filter(item => item.value);
  const availabilityValue =
    readMetaText(
      meta,
      'availability',
      'availability_status',
      'request_status',
    ) ||
    (meta.stock != null
      ? `${locale === 'id' ? 'Stok' : 'Stock'} ${String(meta.stock)}`
      : '');
  const deliveryValue =
    displayType === 'company'
      ? readMetaText(meta, 'hiring_focus', 'about_company')
      : readMetaText(
          meta,
          'delivery_time',
          'delivery_estimate',
          'deadline',
          'preferred_period',
        ) || formatDate(String(meta.available_from || ''));
  const locationValue =
    (displayType === 'company'
      ? readMetaText(meta, 'headquarters')
      : displayType === 'tool_rental'
        ? readMetaText(meta, 'pickup_location')
        : '') || readMetaText(meta, 'location', 'city');
  const quickSpecs = [
    {
      key: 'availability',
      icon:
        displayType === 'job'
          ? Briefcase
          : displayType === 'company'
            ? Building2
            : displayType === 'tool_rental'
              ? Wrench
              : CircleCheck,
      label: isDemandListing
        ? locale === 'id'
          ? 'Status kebutuhan'
          : 'Need status'
        : locale === 'id'
          ? 'Ketersediaan'
          : 'Availability',
      value: availabilityValue,
    },
    {
      key: 'delivery',
      icon: Clock3,
      label:
        displayType === 'company'
          ? locale === 'id'
            ? 'Fokus'
            : 'Focus'
          : isDemandListing
            ? locale === 'id'
              ? 'Deadline/Timeline'
              : 'Deadline/Timeline'
            : locale === 'id'
              ? 'Pengiriman/Timeline'
              : 'Delivery/Timeline',
      value: deliveryValue,
    },
    {
      key: 'location',
      icon: MapPin,
      label: locale === 'id' ? 'Lokasi' : 'Location',
      value: locationValue,
    },
  ].filter(spec => Boolean(spec.value));
  const quickSpecKeys = new Set(quickSpecs.map(spec => spec.key));
  const quickSpecDetailKeys = new Set<string>();
  if (quickSpecKeys.has('availability')) {
    ['availability', 'availability_status', 'request_status', 'stock'].forEach(
      key => quickSpecDetailKeys.add(key),
    );
  }
  if (quickSpecKeys.has('delivery')) {
    [
      'hiring_focus',
      'about_company',
      'delivery_time',
      'delivery_estimate',
      'deadline',
      'preferred_period',
      'available_from',
    ].forEach(key => quickSpecDetailKeys.add(key));
  }
  if (quickSpecKeys.has('location')) {
    ['headquarters', 'pickup_location', 'location', 'city'].forEach(key =>
      quickSpecDetailKeys.add(key),
    );
  }
  const isMoneyDetail = (entry: { key: string; label?: string }) =>
    PROMO_ONLY_MODE &&
    /(price|harga|budget|rate|tarif|salary|kompensasi|nominal|fee|deposit|payment|saldo|wallet)/i.test(
      `${entry.key} ${entry.label || ''}`,
    );
  const visibleHighlightItems = highlightItems.filter(
    entry => !isMoneyDetail(entry),
  );
  const highlightKeys = new Set(visibleHighlightItems.map(item => item.key));
  const detailFields = displayFields.filter(f => f.key !== 'work_mode');
  const detailEntries = detailFields.filter(field => {
    const value = meta[field.key];
    return (
      value != null &&
      value !== '' &&
      !highlightKeys.has(field.key) &&
      !quickSpecDetailKeys.has(field.key) &&
      !isMoneyDetail(field)
    );
  });
  const detailFieldKeys = new Set(detailEntries.map(field => field.key));
  const supplementalDetailItems = [
    {
      key: 'preferred_partner',
      label:
        locale === 'id'
          ? 'Partner / channel target'
          : 'Target partner / channel',
      value:
        !highlightKeys.has('preferred_partner') && !detailFieldKeys.has('brand')
          ? formatMetaList(meta.preferred_partner)
          : '',
    },
    {
      key: 'moq',
      label: locale === 'id' ? 'MOQ yang masih masuk' : 'Acceptable MOQ',
      value:
        isDemandListing &&
        displayType === 'product' &&
        !detailFieldKeys.has('min_order_qty')
          ? readMetaText(meta, 'moq')
          : '',
    },
    {
      key: 'budget_note',
      label: locale === 'id' ? 'Catatan budget' : 'Budget notes',
      value:
        !highlightKeys.has('budget_note') &&
        !detailFieldKeys.has('specs') &&
        !detailFieldKeys.has('client_requirements')
          ? readMetaText(meta, 'budget_note')
          : '',
    },
    {
      key: 'deadline',
      label: locale === 'id' ? 'Deadline' : 'Deadline',
      value:
        !quickSpecKeys.has('delivery') &&
        !detailFieldKeys.has('delivery_time') &&
        !detailFieldKeys.has('delivery_estimate') &&
        !detailFieldKeys.has('available_from')
          ? readMetaText(meta, 'deadline')
          : '',
    },
    {
      key: 'output_needed',
      label: locale === 'id' ? 'Output yang diharapkan' : 'Expected output',
      value:
        isDemandListing &&
        displayType === 'service' &&
        !highlightKeys.has('output_needed') &&
        !detailFieldKeys.has('deliverables')
          ? formatMetaList(meta.output_needed)
          : '',
    },
    {
      key: 'preferred_period',
      label: locale === 'id' ? 'Periode target' : 'Preferred period',
      value:
        isDemandListing &&
        (displayType === 'property' || displayType === 'tool_rental') &&
        !highlightKeys.has('preferred_period') &&
        !detailFieldKeys.has('available_from')
          ? readMetaText(meta, 'preferred_period')
          : '',
    },
    {
      key: 'traffic_note',
      label: locale === 'id' ? 'Target pengunjung' : 'Target traffic',
      value:
        isDemandListing &&
        displayType === 'property' &&
        !highlightKeys.has('traffic_note') &&
        !detailFieldKeys.has('amenities')
          ? readMetaText(meta, 'traffic_note')
          : '',
    },
    {
      key: 'support_needed',
      label: locale === 'id' ? 'Support dibutuhkan' : 'Support needed',
      value:
        isDemandListing &&
        displayType === 'tool_rental' &&
        !highlightKeys.has('support_needed') &&
        !detailFieldKeys.has('usage_restrictions')
          ? formatMetaList(meta.support_needed)
          : '',
    },
  ].filter(item => item.value && !isMoneyDetail(item));
  const tags = item.tags ?? [];
  const expandedDetailItems = [
    ...visibleHighlightItems.map(entry => ({
      key: `highlight-${entry.key}`,
      label: entry.label,
      value: entry.value,
    })),
    ...supplementalDetailItems,
    ...detailEntries.map(field => {
      const value = meta[field.key];
      return {
        key: field.key,
        label: locale === 'id' ? field.labelId : field.labelEn,
        value:
          field.kind === 'date'
            ? formatDate(String(value)) || formatDetailValue(value)
            : formatDetailValue(value),
      };
    }),
  ];
  const visibleExpandedDetailItems = expandedDetailItems;
  const visibleTags = tags;
  const normalizeText = (text?: string) =>
    (text || '')
      .replace(/\u00A0/g, ' ')
      .replace(/\u00C2/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const safeSummary = normalizeText(
    cleanListingCopyText(item.summary, item.title),
  );
  const cleanedBody =
    cleanListingCopyText(item.body, item.title) || item.body || '';
  const normalizedBody = normalizeText(cleanedBody);
  const summaryMatchesBody =
    Boolean(safeSummary) &&
    Boolean(normalizedBody) &&
    safeSummary.localeCompare(normalizedBody, undefined, { sensitivity: 'base' }) === 0;

  // Summary is only the short intro near the title. If it is identical to the
  // full body, do not render the same description again in the detail section.
  const summaryPreview = safeSummary;
  const bodyDisplayText = summaryMatchesBody ? '' : cleanedBody;

  const detailSectionTitle = isDemandListing
    ? locale === 'id'
      ? 'Detail kebutuhan'
      : 'Need details'
    : displayType === 'job'
      ? locale === 'id'
        ? 'Detail pekerjaan'
        : 'Job details'
      : displayType === 'service'
        ? locale === 'id'
          ? 'Detail layanan'
          : 'Service details'
        : displayType === 'property'
          ? locale === 'id'
            ? 'Detail tempat'
            : 'Place details'
          : displayType === 'tool_rental'
            ? locale === 'id'
              ? 'Detail alat & sewa'
              : 'Rental details'
            : displayType === 'profile'
              ? locale === 'id'
                ? 'Tentang penyedia'
                : 'About the provider'
              : displayType === 'company'
                ? isOpportunityType
                  ? locale === 'id'
                    ? 'Detail peluang usaha'
                    : 'Business opportunity details'
                  : locale === 'id'
                    ? 'Tentang usaha'
                    : 'About the business'
                : locale === 'id'
                  ? 'Detail produk'
                  : 'Product details';

  const ownerRoleLabel = isDemandListing
    ? locale === 'id'
      ? 'Pemilik kebutuhan'
      : 'Need owner'
    : displayType === 'job'
      ? locale === 'id'
        ? 'Perekrut / perusahaan'
        : 'Recruiter / company'
      : displayType === 'service' || displayType === 'profile'
        ? locale === 'id'
          ? 'Penyedia'
          : 'Provider'
        : displayType === 'product'
          ? locale === 'id'
            ? 'Penjual'
            : 'Seller'
          : displayType === 'tool_rental' || displayType === 'property'
            ? locale === 'id'
              ? 'Pemilik'
              : 'Owner'
            : displayType === 'company' && isOpportunityType
              ? locale === 'id'
                ? 'Penyedia peluang'
                : 'Opportunity provider'
              : locale === 'id'
                ? 'Usaha'
                : 'Business';

  const locationSectionLabel = isDemandListing
    ? locale === 'id'
      ? 'Area kebutuhan'
      : 'Need area'
    : displayType === 'job'
      ? locale === 'id'
        ? 'Lokasi kerja'
        : 'Work location'
      : displayType === 'tool_rental'
        ? locale === 'id'
          ? 'Lokasi alat / pickup'
          : 'Asset / pickup location'
        : displayType === 'property'
          ? locale === 'id'
            ? 'Lokasi tempat'
            : 'Place location'
          : displayType === 'company' && isOpportunityType
            ? locale === 'id'
              ? 'Area peluang'
              : 'Opportunity area'
            : locale === 'id'
            ? 'Lokasi'
            : 'Location';

  const primaryActionLabel = PROMO_ONLY_MODE
    ? chatLabel
    : displayType === 'job'
      ? locale === 'id'
        ? 'Lanjutkan lamaran'
        : 'Continue Application'
      : displayType === 'company'
        ? isOpportunityType
          ? locale === 'id'
            ? 'Bahas peluang'
            : 'Discuss opportunity'
          : locale === 'id'
            ? 'Mulai percakapan'
            : 'Start Conversation'
        : isDemandListing
          ? locale === 'id'
            ? 'Tanggapi kebutuhan'
            : 'Respond to Need'
          : displayType === 'service'
            ? locale === 'id'
              ? 'Minta penawaran'
              : 'Request Quote'
            : pricingMode === 'fixed'
              ? locale === 'id'
                ? 'Lanjutkan deal'
                : 'Continue Deal'
              : locale === 'id'
                ? 'Pilih respons'
                : 'Choose Action';
  const primaryActionHint = PROMO_ONLY_MODE
    ? locale === 'id'
      ? 'Fase awal: promosi dan chat dulu.'
      : 'Early launch: promotion and chat first.'
    : displayType === 'job'
      ? locale === 'id'
        ? 'Chat dulu. Lanjut apply.'
        : 'Apply fast or chat the recruiter.'
      : displayType === 'company'
        ? isOpportunityType
          ? locale === 'id'
            ? 'Cek model, modal, area, dan dukungan lewat chat.'
            : 'Check the model, capital, area, and support in chat.'
          : locale === 'id'
            ? 'Chat dulu. Lanjut profil usaha.'
            : 'Start with chat or the business profile.'
        : isDemandListing
          ? locale === 'id'
            ? 'Chat dulu. Baru kirim respons yang sesuai.'
            : 'Start with a short chat, then send a response or offer.'
          : displayType === 'tool_rental'
            ? locale === 'id'
              ? 'Chat jadwal. Lanjut sewa.'
              : 'Check schedule and rate, then send a rental request.'
            : displayType === 'property'
              ? locale === 'id'
                ? 'Chat survei. Lanjut deal.'
                : 'Start by chatting about the viewing first, then continue the deal.'
              : displayType === 'service' || displayType === 'profile'
                ? locale === 'id'
                  ? 'Scope, timeline, dan harga bisa dikunci setelah chat.'
                  : 'Align scope, timeline, and price in chat before continuing.'
                : displayType === 'product'
                  ? locale === 'id'
                    ? 'Chat stok. Lanjut deal.'
                    : 'Confirm stock in chat, then continue the deal when ready.'
                  : locale === 'id'
                    ? 'Chat dulu. Deal kalau cocok.'
                    : 'Start with chat first, then continue the deal when ready.';
  const chatStarterDraft = (() => {
    const title =
      item?.title?.trim() || (locale === 'id' ? 'listing ini' : 'this listing');

    if (PROMO_ONLY_MODE) {
      if (isDemandListing) {
        return locale === 'id'
          ? `Halo kak, saya melihat kebutuhan ${title}. Boleh tahu detail kebutuhan dan kriteria utamanya?`
          : `Hi, I saw the need for ${title}. Can you share the key details and criteria first?`;
      }

      if (displayType === 'product') {
        return locale === 'id'
          ? `Halo kak, apakah ${title} masih tersedia? Boleh info stok, varian, MOQ, dan area kirimnya?`
          : `Hi, is ${title} still available? Can you share stock, variants, MOQ, and delivery area?`;
      }

      return locale === 'id'
        ? `Halo kak, apakah ${title} masih tersedia? Saya mau tanya detail dan info terbarunya.`
        : `Hi, is ${title} still available? I want to ask for the latest details.`;
    }

    if (displayType === 'job') {
      return locale === 'id'
        ? `Halo kak, ${title} masih buka?`
        : `Hi, I am interested in ${title}. Is it still open? I want to ask about the next step.`;
    }

    if (displayType === 'company') {
      if (isOpportunityType) {
        return locale === 'id'
          ? `Halo kak, saya tertarik ${title}. Boleh info model kemitraan, kebutuhan modal, area, dan dukungannya?`
          : `Hi, I am interested in ${title}. Can you share the partnership model, capital needs, area, and support?`;
      }
      return locale === 'id'
        ? `Halo kak, saya mau tanya tentang ${title}.`
        : `Hi, I saw ${title}. I want to ask more about the business.`;
    }

    if (isDemandListing) {
      return locale === 'id'
        ? `Halo kak, saya bisa bantu ${title}. Detail intinya apa?`
        : `Hi, I saw the need for ${title}. I may be able to help. Can you share the key details first?`;
    }

    if (displayType === 'tool_rental') {
      return locale === 'id'
        ? `Halo kak, ${title} masih ready? Jadwal dan depositnya?`
        : `Hi, is ${title} still available? I want to ask about schedule, deposit, and pickup.`;
    }

    if (displayType === 'property') {
      return locale === 'id'
        ? `Halo kak, ${title} tersedia? Survei dan harganya?`
        : `Hi, is ${title} still available? I want to ask about viewing, price, and terms.`;
    }

    if (displayType === 'service' || displayType === 'profile') {
      return locale === 'id'
        ? `Halo kak, tertarik ${title}. Scope dan timeline?`
        : `Hi, I am interested in ${title}. Can you share the scope, timeline, and how to start?`;
    }

    return locale === 'id'
      ? `Halo kak, ${title} masih ada? Stok dan harganya berapa?`
      : `Hi, I saw ${title}. Is it still available? I want to check stock, price, and how to order.`;
  })();
  const chatFirstLabel = PROMO_ONLY_MODE
    ? locale === 'id'
      ? 'Chat tanya detail'
      : 'Chat for details'
    : displayType === 'job'
      ? locale === 'id'
        ? 'Chat recruiter dulu'
        : 'Chat recruiter first'
      : isDemandListing
        ? locale === 'id'
          ? 'Tanya kebutuhan dulu'
          : 'Ask about the need first'
        : displayType === 'tool_rental'
          ? locale === 'id'
            ? 'Chat jadwal dulu'
            : 'Chat about schedule first'
          : displayType === 'property'
            ? locale === 'id'
              ? 'Chat survei dulu'
              : 'Chat about viewing first'
            : displayType === 'product'
              ? locale === 'id'
                ? 'Chat stok dulu'
                : 'Confirm stock in chat'
              : locale === 'id'
                ? 'Chat dulu'
                : 'Chat first';
  const chatFirstBody = PROMO_ONLY_MODE
    ? locale === 'id'
      ? 'Cek stok, katalog, MOQ, area kirim, atau detail kebutuhan lewat chat.'
      : 'Confirm stock, catalog, MOQ, delivery area, or need details in chat.'
    : displayType === 'job'
      ? locale === 'id'
        ? 'Masuk chat dulu biar lanjutnya gampang.'
        : 'Open chat first so the next step feels more natural.'
      : isDemandListing
        ? locale === 'id'
          ? 'Tanya detail inti dulu supaya respons Anda lebih pas.'
          : 'Ask for the core details first so your response is more precise.'
        : displayType === 'tool_rental'
          ? locale === 'id'
            ? 'Cek jadwal, deposit, cara ambil.'
            : 'Confirm schedule, deposit, and pickup before sending the request.'
          : displayType === 'property'
            ? locale === 'id'
              ? 'Cek survey, harga, syarat deal.'
              : 'Confirm viewing, price, and terms before continuing.'
            : displayType === 'product'
              ? locale === 'id'
                ? 'Cek stok, ongkir, cara order.'
                : 'Confirm stock, delivery, and ordering first so the chat stays simple.'
              : locale === 'id'
                ? 'Chat dulu. Deal kalau cocok.'
                : 'Start with a short chat, then continue the deal when ready.';
  const offerCardTitle =
    displayType === 'job'
      ? locale === 'id'
        ? 'Kirim lamaran'
        : 'Send application'
      : isDemandListing
        ? locale === 'id'
          ? 'Kirim respons'
          : 'Send response'
        : displayType === 'tool_rental'
          ? locale === 'id'
            ? 'Kirim request sewa'
            : 'Send rental request'
          : displayType === 'property'
            ? locale === 'id'
              ? 'Kirim penawaran'
              : 'Send offer'
            : locale === 'id'
              ? 'Atur offer dulu'
              : 'Prepare an offer';
  const offerCardBody = isDemandListing
    ? locale === 'id'
      ? 'Isi nominal, scope, catatan.'
      : 'Send amount, scope, and notes so the other side understands quickly.'
    : displayType === 'tool_rental'
      ? locale === 'id'
        ? 'Kirim nominal, durasi, catatan.'
        : 'Send amount, rental duration, and notes so the other side can respond quickly.'
      : displayType === 'property'
        ? locale === 'id'
          ? 'Kalau harga atau syarat masih dinego.'
          : 'Best when price, viewing, or terms still need negotiation.'
        : locale === 'id'
          ? 'Kalau nominal, scope, atau timeline belum rapi.'
          : 'Best when amount, scope, or timeline still need negotiation.';
  const directDealTitle =
    displayType === 'tool_rental'
      ? locale === 'id'
        ? 'Lanjut sewa'
        : 'Proceed with rental'
      : displayType === 'property'
        ? locale === 'id'
          ? 'Lanjut deal'
          : 'Proceed with deal'
        : displayType === 'service' || displayType === 'profile'
          ? locale === 'id'
            ? 'Deal jasa'
            : 'Proceed with service'
          : locale === 'id'
            ? 'Lanjut langsung'
            : 'Proceed directly';
  const directDealBody =
    displayType === 'tool_rental'
      ? locale === 'id'
        ? 'Kalau jadwal sewa sudah pas.'
        : 'Best when the rental schedule already fits. Pickup and deposit can still be finalized in chat.'
      : displayType === 'property'
        ? locale === 'id'
          ? 'Kalau lokasi sudah sesuai.'
          : 'Best when the location already fits. Viewing and term details can continue in chat.'
        : displayType === 'service' || displayType === 'profile'
          ? locale === 'id'
            ? 'Kalau scope sudah jelas.'
            : 'Best when the scope is already clear. Timeline and revisions can still be discussed in chat.'
          : locale === 'id'
            ? 'Buat transaksi dulu. Detail lanjut di chat.'
            : 'Create the transaction first, then continue the practical details in chat.';

  const relatedTxStatus = resolveTxnStatusText(relatedTx);
  const relatedTxPaymentStatus = resolveTxnPaymentStatus(relatedTx);
  const relatedTxGuidance = resolveRelatedTxnGuidance(relatedTx, locale);
  const explicitDeadlineIso = extractDeadlineIso(relatedTx);
  const fallbackDeadlineIso =
    !explicitDeadlineIso &&
    relatedTx &&
    (relatedTxStatus === 'pending' || relatedTxStatus === 'accepted') &&
    typeof relatedTx.created_at === 'string'
      ? new Date(
          new Date(relatedTx.created_at).getTime() + 24 * 60 * 60 * 1000,
        ).toISOString()
      : '';
  const activeDeadlineIso = explicitDeadlineIso || fallbackDeadlineIso;
  const deadlineTs = activeDeadlineIso
    ? new Date(activeDeadlineIso).getTime()
    : 0;
  const remainingMs = deadlineTs > 0 ? deadlineTs - nowTs : 0;
  const deadlineExpired = Boolean(deadlineTs) && remainingMs <= 0;
  const showRealtimeDeadline =
    Boolean(relatedTx) &&
    (relatedTxStatus === 'pending' ||
      relatedTxStatus === 'accepted' ||
      relatedTxStatus === 'in_progress');
  const relatedTxUpdatedLabel = relatedTx
    ? new Date(
        relatedTx.updated_at || relatedTx.created_at || Date.now(),
      ).toLocaleString()
    : '';
  const relatedTxWorkspaceHref = relatedTx
    ? `/transactions?focus_transaction_id=${encodeURIComponent(relatedTx.id)}`
    : '/transactions';
  const detailRowClass =
    'bg-[color:var(--app-surface-muted)] hover:bg-[color:var(--app-accent-soft)]';
  const detailPageShellClass =
    'lajukan-market-page lajukan-market-detail page-shell max-lg:!px-0 lg:!px-4 xl:!px-6 overflow-x-hidden bg-[color:var(--app-bg)] py-0 pb-[calc(6.25rem+env(safe-area-inset-bottom))] sm:py-2 lg:pb-8';
  const detailShellStackClass =
    'mx-auto flex w-full max-w-[1200px] flex-col gap-2.5 !px-0 sm:gap-3';
  const detailSectionClass =
    'relative overflow-hidden border-y border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-4 py-4 sm:rounded-[20px] sm:border sm:px-4 sm:shadow-[0_12px_28px_-28px_rgba(15,23,42,0.28)]';
  const detailInsetClass =
    'rounded-[14px] bg-[color:var(--app-surface-muted)] px-3 py-3';
  const detailInsetCompactClass =
    'rounded-[12px] bg-[color:var(--app-surface-muted)] px-3 py-2.5 sm:rounded-[14px]';
  const detailPrimaryButtonClass =
    'inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-[color:var(--app-accent)] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto';

  const detailSecondaryButtonClass =
    'inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-2.5 text-sm font-bold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 sm:w-auto';

  const detailTextLinkClass =
    'text-sm font-bold text-[color:var(--app-accent)] transition hover:underline';
  const actionCardClass =
    'relative overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]';
  const priceValueClass = isDemandListing
    ? `break-words text-2xl font-bold leading-tight tracking-normal sm:text-3xl ${listingSideVisual.price}`
    : `text-3xl font-bold leading-tight tracking-tight sm:text-4xl ${listingSideVisual.price}`;
  const detailChatButtonClass =
    '!inline-flex !min-h-[44px] !w-full !items-center !justify-center !gap-2 !rounded-[14px] !border !border-[color:var(--app-border)] !bg-[color:var(--app-surface-strong)] !px-4 !py-2.5 !text-sm !font-bold !text-[color:var(--app-text)] !shadow-none !transition hover:!bg-[color:var(--app-surface-muted)] focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-[color:var(--app-accent)] focus-visible:!ring-offset-2 disabled:!cursor-not-allowed disabled:!opacity-60 sm:!w-auto';
  const canStartChat = !publicReference && !isOwner && Boolean(peerUserId);
  const typeLabel = ct
    ? getContentTypeName(ct, locale)
    : humanizeToken(displayType);
  const chatOwnerActionLabel = isDemandListing
    ? locale === 'id'
      ? 'Chat pemilik kebutuhan'
      : 'Chat need owner'
    : displayType === 'job'
      ? locale === 'id'
        ? 'Chat perekrut'
        : 'Chat recruiter'
      : displayType === 'product'
        ? locale === 'id'
          ? 'Chat penjual'
          : 'Chat seller'
        : displayType === 'tool_rental'
          ? locale === 'id'
            ? 'Chat pemilik alat'
            : 'Chat asset owner'
          : displayType === 'property'
            ? locale === 'id'
              ? 'Chat pemilik'
              : 'Chat owner'
            : displayType === 'company'
              ? locale === 'id'
                ? 'Chat usaha'
                : 'Chat business'
              : locale === 'id'
                ? 'Chat penyedia'
                : 'Chat provider';

  const actionButtons = publicReference ? (
    <a
      href={publicReference.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className={detailPrimaryButtonClass}
    >
      <ExternalLink className="mr-2 h-4 w-4" />
      {locale === 'id' ? 'Buka sumber asli' : 'Open original source'}
    </a>
  ) : (
    <div className="grid w-full grid-cols-2 gap-2 lg:grid-cols-1 [&>*:only-child]:col-span-2 lg:[&>*:only-child]:col-span-1">
      {isOwner && (
        <Link
          href={`/create?draft=${item.id}`}
          className={detailPrimaryButtonClass}
        >
          <Pencil className="h-4 w-4" />
          {locale === 'id' ? 'Edit listing' : 'Edit listing'}
        </Link>
      )}
      {isOwner && (
        <button
          type="button"
          onClick={openShareListingModal}
          disabled={shareLoading}
          className={detailSecondaryButtonClass}
        >
          <Share2 className="h-3.5 w-3.5" />
          {shareLoading
            ? locale === 'id'
              ? 'Memuat room...'
              : 'Loading rooms...'
            : locale === 'id'
              ? 'Share ke chat room'
              : 'Share to chat room'}
        </button>
      )}
      {!isOwner && PROMO_ONLY_MODE && canStartChat && (
        <button
          type="button"
          onClick={() => void handleStartChat()}
          disabled={chatStarting}
          className={detailChatButtonClass}
        >
          <MessageCircle className="h-4 w-4" />
          {chatStarting
            ? locale === 'id'
              ? 'Membuka chat...'
              : 'Opening chat...'
            : chatOwnerActionLabel}
        </button>
      )}
      {!isOwner && !PROMO_ONLY_MODE && canStartChat && (
        <>
          <button
            type="button"
            onClick={openDealFlowPicker}
            disabled={!peerUserId}
            className={detailPrimaryButtonClass}
          >
            {primaryActionLabel}
          </button>
          <button
            type="button"
            onClick={() => void handleStartChat()}
            disabled={chatStarting}
            className={detailChatButtonClass}
          >
            <MessageCircle className="h-4 w-4" />
            {chatStarting
              ? locale === 'id'
                ? 'Membuka chat...'
                : 'Opening chat...'
              : chatOwnerActionLabel}
          </button>
        </>
      )}
    </div>
  );

  const ownerProfileCard =
    !publicReference && ownerProfileHref && ownerDisplayName ? (
      <section className={detailSectionClass}>
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
            <NextImage
              src={profileAvatarSrc(
                ownerAvatarUrl,
                readProfileAvatarStyle(ownerProfile || meta),
                ownerDisplayName,
              )}
              alt={ownerDisplayName}
              width={48}
              height={48}
              className="h-full w-full object-cover"
              unoptimized
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
              {ownerRoleLabel}
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-[color:var(--app-text)] [overflow-wrap:anywhere] dark:text-[color:var(--app-text-inverse)]">
              {ownerDisplayName}
            </p>
            {ownerHeadline ? (
              <p className="mt-1 whitespace-pre-line break-words text-xs leading-5 text-[color:var(--app-text)] [overflow-wrap:anywhere] dark:text-[color:var(--app-text-soft)]">
                {ownerHeadline}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={ownerProfileHref}
                className="inline-flex items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--app-accent-soft)_52%,white)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent)_24%,rgba(15,23,42,0.96))]"
              >
                {locale === 'id' ? 'Lihat profil' : 'View profile'}
              </Link>
              {ownerProfile?.identity_verified && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-[color:var(--app-accent)]" />
                  {locale === 'id' ? 'Identitas terverifikasi' : 'Identity verified'}
                </span>
              )}
            </div>
            {showSellerStats ? (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[color:var(--app-border)] pt-3 text-xs text-[color:var(--app-text-soft)]">
                {sellerRating > 0 ? (
                  <span>
                    <strong className="text-[color:var(--app-text)]">
                      {sellerRating.toFixed(1)}
                    </strong>{' '}
                    {locale === 'id'
                      ? `dari ${sellerReviewCount} ulasan`
                      : `from ${sellerReviewCount} reviews`}
                  </span>
                ) : null}
                {sellerCompletedTransactions > 0 ? (
                  <span>
                    <strong className="text-[color:var(--app-text)]">
                      {sellerCompletedTransactions}
                    </strong>{' '}
                    {locale === 'id'
                      ? 'transaksi selesai'
                      : 'completed transactions'}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    ) : null;

  const actionCard = (
    <section className={actionCardClass}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${listingSideVisual.chip}`}
        >
          <ListingSideIcon className="h-3.5 w-3.5" />
          {listingSideLabel}
        </span>
        <span className="text-xs font-semibold text-[color:var(--app-text-soft)]">
          {typeLabel}
        </span>
      </div>
      <p className="mt-4 text-xs font-semibold text-[color:var(--app-text-soft)]">
        {displayPriceHeading}
      </p>
      <div className={`mt-1 ${priceValueClass}`}>{primaryPrice}</div>
      {publicReference ? (
        <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-950 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-100">
          <p className="font-bold">{publicReference.sourceTitle}</p>
          <p className="mt-1">
            {locale === 'id' ? 'Izin/sumber' : 'License/source'}:{' '}
            {publicReference.sourceLicense}
          </p>
          {publicReference.trustNote ? (
            <p className="mt-2 leading-5">{publicReference.trustNote}</p>
          ) : null}
          {publicReference.imageSourceUrl ? (
            <div className="mt-3 border-t border-blue-200/70 pt-2 dark:border-blue-300/20">
              <p className="font-semibold">
                {locale === 'id' ? 'Kredit foto' : 'Photo credit'}:{' '}
                {publicReference.imageAttribution}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <a
                  href={publicReference.imageSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold underline underline-offset-2"
                >
                  {locale === 'id' ? 'Sumber foto' : 'Photo source'}
                </a>
                {publicReference.imageLicenseUrl ? (
                  <a
                    href={publicReference.imageLicenseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold underline underline-offset-2"
                  >
                    {publicReference.imageLicense ||
                      (locale === 'id' ? 'Lisensi foto' : 'Photo license')}
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {hasOriginalPrice && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="text-[color:var(--app-text-soft)] line-through">
            {formatCurrency(
              displayOriginalPriceCents as number,
              item.currency || 'IDR',
            )}
          </span>
          <span className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-danger)_15%,_transparent)] px-2 py-0.5 font-semibold text-[color:var(--app-danger)] dark:text-[color:var(--app-danger)]">
            -{discountPercent}%
          </span>
          {(promotionSnapshot?.promoLabel ||
            (typeof item.promo_label === 'string' &&
              item.promo_label.trim())) && (
            <span className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-accent-soft)_52%,_white)] px-2 py-0.5 font-semibold text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_24%,rgba(15,23,42,0.96))] dark:text-[color:var(--app-accent)]">
              {promotionSnapshot?.promoLabel || item.promo_label}
            </span>
          )}
        </div>
      )}

      {!PROMO_ONLY_MODE && promotionSnapshot?.offerType && (
        <div className="mt-3 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]">
                <PromotionIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold text-[color:var(--app-text)]">
                  {promotionSnapshot.offerLabel}
                </p>
                <p className="mt-1 text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {promotionSnapshot.benefitLabel}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                promotionSnapshot.status === 'safe'
                  ? 'bg-[color:color-mix(in_srgb,var(--app-accent-soft)_56%,white)] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent)_24%,rgba(15,23,42,0.96))]'
                  : promotionSnapshot.status === 'unsafe'
                    ? 'bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)]'
                    : 'bg-white text-[color:var(--app-text)] dark:bg-slate-950'
              }`}
            >
              {promotionSnapshot.status === 'safe'
                ? locale === 'id'
                  ? 'Benefit aktif'
                  : 'Benefit active'
                : promotionSnapshot.status === 'unsafe'
                  ? locale === 'id'
                    ? 'Periode cek'
                    : 'Check period'
                  : locale === 'id'
                    ? 'Campaign aktif'
                    : 'Campaign active'}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            {promotionSnapshot.supportLabel}
          </p>
        </div>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {actionButtons}
      </div>
      {!isOwner && canStartChat ? (
        <p className="mt-3 text-xs leading-5 text-[color:var(--app-text-soft)]">
          {primaryActionHint}
        </p>
      ) : null}
      {!isOwner && !peerUserId && (
        <p className="mt-2 text-xs text-[color:var(--app-warning)] dark:text-[color:var(--app-warning)]">
          {locale === 'id'
            ? 'Kontak owner listing belum valid, room chat belum bisa dibuat.'
            : 'Listing owner contact is not valid yet, chat room cannot be created.'}
        </p>
      )}
      {chatError && (
        <p className="mt-2 text-xs text-[color:var(--app-danger)]">
          {chatError}
        </p>
      )}
      {!showShareModal && shareError && (
        <p className="mt-2 text-xs text-[color:var(--app-danger)]">
          {shareError}
        </p>
      )}
      {!publicReference &&
        !PROMO_ONLY_MODE &&
        user &&
        !isOwner &&
        displayType !== 'company' && (
          <div
            className={`mt-4 ${detailInsetClass} border border-[color:var(--app-border)] bg-[color:var(--app-surface)] shadow-[0_18px_36px_-28px_rgba(15,23,42,0.18)]`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                {locale === 'id'
                  ? 'Status transaksi realtime'
                  : 'Realtime transaction status'}
              </p>
              {relatedTxLoading ? (
                <span className="text-[11px] text-[color:var(--app-text)]">
                  {locale === 'id' ? 'Memuat...' : 'Loading...'}
                </span>
              ) : relatedTx ? (
                <span className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-accent)_15%,_transparent)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]">
                  {relatedTxStatus}
                </span>
              ) : (
                <span className="text-[11px] text-[color:var(--app-text)]">
                  {locale === 'id'
                    ? 'Belum ada transaksi'
                    : 'No transaction yet'}
                </span>
              )}
            </div>

            {relatedTx && showRealtimeDeadline && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <Clock3 className="h-3.5 w-3.5 text-[color:var(--app-warning)]" />
                <span
                  className={
                    deadlineExpired
                      ? 'font-semibold text-[color:var(--app-danger)] dark:text-[color:var(--app-danger)]'
                      : 'font-semibold text-[color:var(--app-warning)] dark:text-[color:var(--app-warning)]'
                  }
                >
                  {deadlineExpired
                    ? locale === 'id'
                      ? 'Waktu bayar/konfirmasi sudah habis'
                      : 'Payment/confirmation window expired'
                    : locale === 'id'
                      ? `Batas bayar/konfirmasi: ${formatRemainingDuration(remainingMs, locale)}`
                      : `Payment/confirmation deadline: ${formatRemainingDuration(remainingMs, locale)}`}
                </span>
              </div>
            )}

            {relatedTx ? (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className={detailInsetCompactClass}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                      {locale === 'id' ? 'Nominal' : 'Amount'}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                      {formatCurrency(
                        relatedTx.amount_cents || 0,
                        relatedTx.currency || baseCurrency,
                      )}
                    </p>
                  </div>
                  <div className={detailInsetCompactClass}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                      {locale === 'id' ? 'Proteksi' : 'Protection'}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                      {humanizeValue(
                        relatedTx.protection_status || 'awaiting_funding',
                      )}
                    </p>
                  </div>
                  <div className={detailInsetCompactClass}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                      {locale === 'id' ? 'Pembayaran' : 'Payment'}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                      {humanizeValue(relatedTxPaymentStatus)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-[20px] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_48%,white)] p-3 dark:bg-[color:color-mix(in_srgb,var(--app-accent)_20%,rgba(15,23,42,0.96))]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                    {locale === 'id' ? 'Langkah berikutnya' : 'Next step'}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[color:var(--app-text)]">
                    {relatedTxGuidance}
                  </p>
                  <p className="mt-2 text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    {locale === 'id'
                      ? `Update terakhir: ${relatedTxUpdatedLabel}`
                      : `Last update: ${relatedTxUpdatedLabel}`}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={relatedTxWorkspaceHref}
                    className={detailPrimaryButtonClass}
                  >
                    {locale === 'id'
                      ? 'Buka workspace order'
                      : 'Open order workspace'}
                  </Link>
                  <Link href="/support" className={detailSecondaryButtonClass}>
                    {locale === 'id' ? 'Butuh bantuan' : 'Need help'}
                  </Link>
                </div>
              </>
            ) : (
              <div
                className={`mt-3 ${detailInsetCompactClass} text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]`}
              >
                {relatedTxGuidance}
              </div>
            )}
          </div>
        )}
    </section>
  );

  const locationLabel =
    quickSpecs.find(spec => spec.key === 'location')?.value ||
    readMetaText(meta, 'location', 'city', 'region', 'address') ||
    (locale === 'id' ? 'Indonesia' : 'Indonesia');
  const contentLocationPoint = resolveContentLocationPoint(item, meta);
  const contentLocationAddress = resolveContentLocationAddress(
    meta,
    locationLabel,
  );
  const contentDistanceKm =
    contentLocationPoint && viewerLocation && isCoordinateValid(viewerLocation)
      ? haversineKm(viewerLocation, contentLocationPoint)
      : null;
  const contentDistanceLabel = formatContentDistanceLabel(contentDistanceKm);
  const contentGoogleMapsUrl = contentLocationPoint
    ? buildContentGoogleMapsSearchUrl(
        contentLocationPoint,
        item.title,
        contentLocationAddress,
      )
    : '';
  const contentDirectionsUrl = contentLocationPoint
    ? buildContentGoogleMapsDirectionsUrl(contentLocationPoint)
    : '';
  const localizedListingHref = listingHref.startsWith(`/${locale}/`)
    ? listingHref
    : `/${locale}${listingHref.startsWith('/') ? listingHref : `/${listingHref}`}`;
  const handleNativeShare = async () => {
    if (typeof window === 'undefined') return;
    const shareUrl = new URL(
      localizedListingHref,
      window.location.origin,
    ).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url: shareUrl });
        return;
      }
      await navigator.clipboard?.writeText(shareUrl);
    } catch {
      // Native share and clipboard can be cancelled by the user.
    }
  };
  const toggleListingLike = async () => {
    if (!resolvedContentId) return;
    if (!user) {
      const callbackUrl = `/${locale}/content/${contentId || resolvedContentId}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    const previousLiked = contentLiked;
    const previousCount = contentLikeCount ?? resolveListingLikeCount(item);
    const nextLiked = !contentLiked;
    setContentLiked(nextLiked);
    setContentLikeCount(Math.max(previousCount + (nextLiked ? 1 : -1), 0));

    try {
      const response = await authFetch(
        `/api/content/${encodeURIComponent(resolvedContentId)}/like`,
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
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Gagal menyimpan like');
      }

      setContentLiked(Boolean(payload.liked));
      setContentLikeCount(
        readPositiveInteger(payload.likeCount ?? payload.like_count),
      );

      if (nextLiked) {
        try {
          const targetUserId = String(
            item.owner_id || item.owner_profile?.id || '',
          ).trim();
          const actorId = String(user.id || '').trim();
          const actorName =
            user.fullName ||
            user.full_name ||
            user.name ||
            user.username ||
            user.email ||
            '';
          await trackLajukanEvent('content.liked', {
            entityType: 'content',
            entityId: resolvedContentId || item.id,
            page: localizedListingHref,
            properties: {
              entity_label: item.title,
              href: localizedListingHref,
              target_href: localizedListingHref,
              target_user_id: targetUserId,
              target_username:
                item.owner_profile?.username ||
                item.owner_profile?.full_name ||
                '',
              target_name:
                item.owner_profile?.full_name ||
                item.owner_profile?.username ||
                '',
              actor_user_id: actorId,
              actor_username: String(user.username || '').trim(),
              actor_name: actorName,
              actor_avatar_url: user.avatarUrl || user.avatar_url || '',
              action: 'like',
              source: 'content_detail',
              surface: 'content',
            },
          });
        } catch {
          // Analytics is best-effort and should never undo the like itself.
        }
      }
    } catch {
      setContentLiked(previousLiked);
      setContentLikeCount(previousCount);
    }
  };
  const detailSurfaceClass =
    'overflow-hidden rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] shadow-[0_16px_34px_-32px_rgba(15,23,42,0.28)] sm:rounded-[22px]';
  const mediaAspectClassName =
    images.length > 0
      ? displayType === 'property'
        ? 'aspect-[16/10] w-full sm:aspect-[16/9]'
        : displayType === 'product' || displayType === 'tool_rental'
          ? 'aspect-[4/3] w-full sm:aspect-[4/3]'
          : 'aspect-[16/10] w-full sm:aspect-[16/9]'
      : displayType === 'job' || displayType === 'service' || displayType === 'profile'
        ? 'h-[220px] w-full sm:h-[280px] lg:h-[300px]'
        : 'h-[260px] w-full sm:h-[320px] lg:h-[340px]';

  return (
    <div className={detailPageShellClass}>
      <DetailMobileTopBar
        title={item.title}
        eyebrow={typeLabel}
        backLabel={locale === 'id' ? 'Kembali' : 'Back'}
        shareLabel={locale === 'id' ? 'Bagikan' : 'Share'}
        onShare={() => void handleNativeShare()}
      />
      <div className={detailShellStackClass}>
        <section className="w-full px-0">
          <div className="mx-auto flex w-full flex-col gap-2.5">
            <div className="hidden items-center justify-between gap-3 px-1 text-xs text-[color:var(--app-text-soft)] lg:flex">
              <div className="flex min-w-0 items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[color:var(--app-text)] ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-950 dark:text-[color:var(--app-text-soft)] dark:ring-slate-800"
                  aria-label={locale === 'id' ? 'Kembali' : 'Back'}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <Link
                  href="/explore"
                  className="flex items-center justify-center font-semibold text-[color:var(--app-text)]"
                >
                  {locale === 'id' ? 'Jelajahi' : 'Explore'}
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="truncate">{typeLabel}</span>
                {sectorObj ? (
                  <>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span className="truncate">
                      {getSectorLabel(sectorObj, locale)}
                    </span>
                  </>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void handleNativeShare()}
                className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 font-semibold text-[color:var(--app-text)] ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-950 dark:text-[color:var(--app-text-soft)] dark:ring-slate-800"
              >
                <Share2 className="h-3.5 w-3.5" />
                {locale === 'id' ? 'Bagikan' : 'Share'}
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.85fr)_minmax(300px,332px)] lg:items-start lg:gap-4 xl:grid-cols-[minmax(0,1.95fr)_minmax(312px,348px)]">
              <div className="min-w-0 space-y-3">
                <section className="overflow-hidden bg-[color:var(--app-surface)] sm:rounded-[20px] sm:border sm:border-[color:var(--app-border)]">
                  <div className="relative overflow-hidden bg-[color:var(--app-surface-muted)] sm:rounded-[18px]">
                    <MediaPreviewCarousel
                      items={images}
                      alt={item.title}
                      aspectClassName={mediaAspectClassName}
                      sizes="(min-width: 1280px) 820px, (min-width: 1024px) 68vw, 100vw"
                      priority
                      controls
                      lightbox
                    />
                  </div>
                </section>

                <section
                  className={`${detailSurfaceClass} p-3.5 sm:p-5`}
                  data-testid="content-detail-summary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${listingSideVisual.chip}`}
                      >
                        <ListingSideIcon className="h-3.5 w-3.5" />
                        {listingSideLabel}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--app-text-soft)]">
                        <TypeIcon className="h-3.5 w-3.5" />
                        {typeLabel}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void toggleListingLike()}
                        aria-pressed={contentLiked}
                        aria-label={
                          contentLiked
                            ? locale === 'id'
                              ? 'Hapus dari tersimpan'
                              : 'Remove from saved'
                            : locale === 'id'
                              ? 'Simpan listing'
                              : 'Save listing'
                        }
                        className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] ${
                          contentLiked
                            ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]'
                            : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]'
                        }`}
                      >
                        <Heart
                          className={`h-4 w-4 ${contentLiked ? 'fill-current' : ''}`}
                        />
                        <span>{locale === 'id' ? 'Simpan' : 'Save'}</span>
                        {listingLikeCount > 0 ? (
                          <span className="font-semibold text-[color:var(--app-text-soft)]">
                            {listingLikeCount}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  </div>

                  <h1 className="mt-3 break-words text-2xl font-bold leading-tight text-[color:var(--app-text)] [overflow-wrap:anywhere] dark:text-[color:var(--app-text-inverse)] sm:text-3xl lg:text-4xl">
                    {item.title}
                  </h1>
                  {summaryPreview ? (
                    <p className="mt-2 max-w-3xl whitespace-pre-line break-words text-sm leading-6 text-[color:var(--app-text-soft)] [overflow-wrap:anywhere] sm:text-base">
                      {summaryPreview}
                    </p>
                  ) : null}

                  <div className="mt-4 border-y border-[color:var(--app-border)] lg:hidden">
                    <div className="py-3">
                      <p className="text-xs font-semibold text-[color:var(--app-text-soft)]">
                        {displayPriceHeading}
                      </p>
                      <p className={`mt-1 ${priceValueClass}`}>
                        {primaryPrice}
                      </p>
                    </div>
                  </div>

                  {quickSpecs.length > 0 ? (
                    <dl className="mt-4 grid divide-y divide-[color:var(--app-border)] border-y border-[color:var(--app-border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                      {quickSpecs.map(spec => {
                        const SpecIcon = spec.icon;
                        return (
                          <div
                            key={spec.key}
                            className="flex min-w-0 items-start gap-2.5 py-3 sm:px-3 sm:first:pl-0 sm:last:pr-0"
                          >
                            <SpecIcon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                            <div className="min-w-0">
                              <dt className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                                {spec.label}
                              </dt>
                              <dd
                                title={String(spec.value)}
                                className="mt-0.5 whitespace-pre-line break-words text-sm font-semibold leading-5 text-[color:var(--app-text)] [overflow-wrap:anywhere]"
                              >
                                {spec.value}
                              </dd>
                            </div>
                          </div>
                        );
                      })}
                    </dl>
                  ) : null}

                  {visibleTags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {visibleTags.map(tag => (
                        <span
                          key={tag}
                          className="max-w-full whitespace-normal break-words rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-semibold leading-4 text-[color:var(--app-text-soft)] [overflow-wrap:anywhere]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </section>

                {bodyDisplayText || visibleExpandedDetailItems.length > 0 ? (
                  <section className={`${detailSurfaceClass} p-3 sm:p-4`}>
                    <h2 className="text-lg font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-xl">
                      {detailSectionTitle}
                    </h2>

                    {bodyDisplayText ? (
                      <div className="mt-3">
                        {bodyDisplayText.length > 320 ? (
                          <>
                            <p
                              id="listing-description"
                              className={`${
                                showFullDescription ? '' : 'line-clamp-5'
                              } whitespace-pre-line break-words text-sm leading-6 text-[color:var(--app-text)] [overflow-wrap:anywhere]`}
                            >
                              {bodyDisplayText}
                            </p>
                            <button
                              type="button"
                              aria-controls="listing-description"
                              aria-expanded={showFullDescription}
                              onClick={() =>
                                setShowFullDescription(current => !current)
                              }
                              className="mt-2 inline-flex min-h-10 items-center py-2 text-sm font-bold text-[color:var(--app-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
                            >
                              {showFullDescription
                                ? locale === 'id'
                                  ? 'Tampilkan lebih sedikit'
                                  : 'Show less'
                                : locale === 'id'
                                  ? 'Baca deskripsi lengkap'
                                  : 'Read full description'}
                            </button>
                          </>
                        ) : (
                          <p className="whitespace-pre-line break-words text-sm leading-6 text-[color:var(--app-text)] [overflow-wrap:anywhere]">
                            {bodyDisplayText}
                          </p>
                        )}
                      </div>
                    ) : null}

                    {visibleExpandedDetailItems.length > 0 ? (
                      <dl className="mt-4 divide-y divide-[color:var(--app-border)] border-y border-[color:var(--app-border)]">
                        {visibleExpandedDetailItems.map(entry => (
                          <div
                            key={entry.key}
                            className="grid min-w-0 gap-1 py-3 sm:grid-cols-[minmax(140px,0.34fr)_minmax(0,1fr)] sm:gap-4"
                          >
                            <dt className="min-w-0 break-words text-xs font-semibold leading-5 text-[color:var(--app-text-soft)] [overflow-wrap:anywhere]">
                              {entry.label}
                            </dt>
                            <dd
                              title={entry.value}
                              className="min-w-0 whitespace-pre-line break-words text-sm font-medium leading-6 text-[color:var(--app-text)] [overflow-wrap:anywhere] sm:font-semibold"
                            >
                              {entry.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </section>
                ) : null}

                {contentLocationPoint ? (
                  <section
                    className={`${detailSurfaceClass} isolate p-3 sm:p-3.5`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-accent)]">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[color:var(--app-text)]">
                          {locationSectionLabel}
                        </p>
                        <h2 className="mt-1 break-words text-base font-semibold leading-6 text-[color:var(--app-text)] [overflow-wrap:anywhere] dark:text-[color:var(--app-text-inverse)] sm:text-lg">
                          {contentLocationAddress}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-[color:var(--app-text-soft)]">
                          {contentDistanceLabel
                            ? locale === 'id'
                              ? `${contentDistanceLabel} dari lokasimu`
                              : `${contentDistanceLabel} from you`
                            : locale === 'id'
                              ? 'Gunakan peta untuk melihat area dan rute.'
                              : 'Use the map to understand the area and route.'}
                        </p>
                      </div>
                    </div>
                    <div className="relative z-0 mt-3 h-[224px] isolate overflow-hidden rounded-[18px] bg-[color:var(--app-surface-muted)] ring-1 ring-[color:var(--app-border)] dark:bg-slate-950 dark:ring-slate-800 sm:h-[276px]">
                      <ContentLocationMap
                        point={contentLocationPoint}
                        title={item.title}
                        address={contentLocationAddress}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={contentDirectionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[12px] bg-[color:var(--app-accent)] px-4 text-sm font-bold text-white transition hover:brightness-105"
                      >
                        <Navigation className="h-4 w-4" />
                        {locale === 'id' ? 'Lihat rute' : 'Directions'}
                      </a>
                      <a
                        href={contentGoogleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[12px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-sm font-bold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)]"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {locale === 'id'
                          ? 'Buka Google Maps'
                          : 'Open Google Maps'}
                      </a>
                    </div>
                  </section>
                ) : null}

                <div className="min-w-0 space-y-3">
                  {documents.length > 0 ? (
                    <section className={`${detailSurfaceClass} p-3.5 sm:p-4`}>
                      <div className="flex items-center gap-2 text-base font-bold text-[color:var(--app-text)]">
                        <FileText className="h-4 w-4" />
                        {locale === 'id' ? 'Dokumen' : 'Documents'}
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {documents.map(doc => (
                          <a
                            key={`${doc.url}-${doc.name}`}
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`group flex min-h-12 items-center justify-between gap-3 rounded-[16px] px-3 py-2.5 text-sm transition ${detailRowClass}`}
                          >
                            <div className="min-w-0">
                              <p
                                title={doc.name}
                                className="break-words font-semibold leading-5 text-[color:var(--app-text)] [overflow-wrap:anywhere] dark:text-[color:var(--app-text-inverse)]"
                              >
                                {doc.name}
                              </p>
                              <p className="text-xs text-[color:var(--app-text-soft)]">
                                {doc.mime ||
                                  (locale === 'id' ? 'Dokumen' : 'Document')}
                                {doc.size ? ` - ${formatSize(doc.size)}` : ''}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-[color:var(--app-accent)]">
                              {locale === 'id' ? 'Lihat' : 'View'}
                            </span>
                          </a>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>

                <div className="lg:hidden">{ownerProfileCard}</div>

                {!isOwner ? (
                  <div className="px-4 pb-1 sm:px-0">
                    <button
                      type="button"
                      onClick={openReportListingModal}
                      className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-text)]"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      {locale === 'id' ? 'Laporkan listing' : 'Report listing'}
                    </button>
                  </div>
                ) : null}
              </div>

              <aside className="hidden lg:block lg:self-start">
                <div className="sticky top-[calc(4.75rem+env(safe-area-inset-top))] space-y-3 lg:max-w-[348px]">
                  {actionCard}
                  {ownerProfileCard}
                </div>
              </aside>
            </div>
          </div>
        </section>

        {isOwner || canStartChat ? (
          <div
            className="fixed inset-x-0 bottom-0 z-40 px-2 pt-2 lg:hidden"
            style={{
              paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)',
            }}
          >
            <div className="mx-auto max-w-md rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)]/96 p-1.5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.32)] backdrop-blur-xl">
              {actionButtons}
            </div>
          </div>
        ) : null}
      </div>

      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_50%,_transparent)] p-3">
          <div className="max-h-[calc(var(--app-viewport-height)-2rem)] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white/98 p-5 shadow-[0_28px_56px_-32px_rgba(15,23,42,0.32)] dark:bg-slate-950/96 dark:shadow-[0_32px_60px_-36px_rgba(2,6,23,0.8)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                  {locale === 'id' ? 'Share listing' : 'Share listing'}
                </p>
                <h2 className="text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {item.title}
                </h2>
                <p className="text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {locale === 'id'
                    ? 'Pilih room chat untuk membagikan listing ini sebagai bubble card.'
                    : 'Choose a chat room to share this listing as a bubble card.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] transition hover:bg-[color:var(--app-accent-soft)]"
                aria-label={locale === 'id' ? 'Tutup' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)]">
                  {locale === 'id' ? 'Pilih room' : 'Choose room'}
                </label>
                <select
                  value={shareRoomId}
                  onChange={e => setShareRoomId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-inverse)] dark:focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_40%,_transparent)]"
                >
                  <option value="">
                    {locale === 'id'
                      ? 'Pilih room tujuan'
                      : 'Select destination room'}
                  </option>
                  {shareRooms.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.room_name || room.id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)]">
                  {locale === 'id' ? 'Catatan (opsional)' : 'Note (optional)'}
                </label>
                <textarea
                  rows={3}
                  value={shareNote}
                  onChange={e => setShareNote(e.target.value)}
                  placeholder={
                    locale === 'id'
                      ? 'Contoh: Lagi buka slot untuk listing ini.'
                      : 'Example: We have open slots for this listing.'
                  }
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-inverse)] dark:focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_40%,_transparent)]"
                />
              </div>
            </div>

            {shareError ? (
              <p className="mt-3 text-xs font-semibold text-[color:var(--app-danger)]">
                {shareError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => setShowShareModal(false)}
                className="rounded-[12px] border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] hover:border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
              >
                {locale === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button
                onClick={handleShareListingToRoom}
                disabled={shareSubmitting || !shareRoomId}
                className="inline-flex flex-1 items-center justify-center rounded-[12px] bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {shareSubmitting
                  ? locale === 'id'
                    ? 'Mengirim...'
                    : 'Sending...'
                  : locale === 'id'
                    ? 'Kirim bubble listing'
                    : 'Share listing bubble'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_50%,_transparent)] p-3">
          <div className="w-full max-w-md rounded-[24px] bg-white/98 p-5 shadow-[0_28px_56px_-32px_rgba(15,23,42,0.32)] dark:bg-slate-950/96">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-danger)]">
                  {locale === 'id' ? 'Laporkan listing' : 'Report listing'}
                </p>
                <h2 className="mt-1 text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {item.title}
                </h2>
                <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                  {locale === 'id'
                    ? 'Pilih alasan singkat. Tim Lajukan bisa meninjau dari riwayat ini.'
                    : 'Choose a short reason. Lajukan can review it from this record.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="rounded-full bg-slate-100 p-2 text-[color:var(--app-text)] transition hover:bg-slate-200 dark:bg-slate-900 dark:text-[color:var(--app-text-soft)]"
                aria-label={locale === 'id' ? 'Tutup' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-[color:var(--app-text)]">
                {locale === 'id' ? 'Alasan' : 'Reason'}
                <select
                  value={reportReason}
                  onChange={event => setReportReason(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm"
                >
                  <option value="spam">Spam</option>
                  <option value="fraud">
                    {locale === 'id' ? 'Dugaan penipuan' : 'Suspected fraud'}
                  </option>
                  <option value="illegal">
                    {locale === 'id'
                      ? 'Barang/jasa dilarang'
                      : 'Prohibited goods/services'}
                  </option>
                  <option value="misleading">
                    {locale === 'id'
                      ? 'Informasi menyesatkan'
                      : 'Misleading information'}
                  </option>
                </select>
              </label>

              <label className="block text-xs font-semibold text-[color:var(--app-text)]">
                {locale === 'id' ? 'Catatan' : 'Note'} (
                {locale === 'id' ? 'opsional' : 'optional'})
                <textarea
                  value={reportDetails}
                  onChange={event => setReportDetails(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm"
                  placeholder={
                    locale === 'id'
                      ? 'Tambahkan detail singkat jika perlu.'
                      : 'Add short details if needed.'
                  }
                />
              </label>
            </div>

            {reportError ? (
              <p className="mt-3 text-xs font-semibold text-[color:var(--app-danger)]">
                {reportError}
              </p>
            ) : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="min-h-10 rounded-[12px] border border-[color:var(--app-border)] px-4 text-xs font-semibold text-[color:var(--app-text)]"
              >
                {locale === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void submitListingReport()}
                disabled={reportSubmitting}
                className="min-h-10 flex-1 rounded-[12px] bg-[color:var(--app-danger)] px-4 text-xs font-semibold text-white disabled:opacity-60"
              >
                {reportSubmitting
                  ? locale === 'id'
                    ? 'Mengirim...'
                    : 'Sending...'
                  : locale === 'id'
                    ? 'Kirim laporan'
                    : 'Submit report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_50%,_transparent)] p-3">
          <div className="max-h-[calc(var(--app-viewport-height)-2rem)] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white/98 p-5 shadow-[0_28px_56px_-32px_rgba(15,23,42,0.32)] dark:bg-slate-950/96 dark:shadow-[0_32px_60px_-36px_rgba(2,6,23,0.8)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                  {locale === 'id' ? 'Lamar cepat' : 'Quick apply'}
                </p>
                <h2 className="text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {item.title}
                </h2>
                <p className="text-xs text-[color:var(--app-text)]">
                  {locale === 'id'
                    ? 'Lengkapi data sekali, kirim ke pemberi kerja via chat.'
                    : 'Fill once, send to employer via chat.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] transition hover:bg-[color:var(--app-accent-soft)]"
                aria-label={locale === 'id' ? 'Tutup' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                <span>{locale === 'id' ? 'Nama lengkap*' : 'Full name*'}</span>
                <input
                  value={applyFullName}
                  onChange={e => setApplyFullName(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_40%,_transparent)]"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                <span>Email*</span>
                <input
                  type="email"
                  value={applyEmail}
                  onChange={e => setApplyEmail(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_40%,_transparent)]"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                <span>{locale === 'id' ? 'Nomor HP' : 'Phone'}</span>
                <input
                  value={applyPhone}
                  onChange={e => setApplyPhone(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_40%,_transparent)]"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                <span>{locale === 'id' ? 'Lokasi' : 'Location'}</span>
                <input
                  value={applyLocation}
                  onChange={e => setApplyLocation(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_40%,_transparent)]"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:col-span-2">
                <span>
                  {locale === 'id' ? 'Headline / posisi' : 'Headline / role'}
                </span>
                <input
                  value={applyHeadline}
                  onChange={e => setApplyHeadline(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_40%,_transparent)]"
                  placeholder={
                    locale === 'id'
                      ? 'Contoh: Senior Legal Counsel'
                      : 'e.g. Senior Legal Counsel'
                  }
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                <span>
                  {locale === 'id'
                    ? 'Pengalaman (tahun)'
                    : 'Years of experience'}
                </span>
                <input
                  value={applyYearsExp}
                  onChange={e => setApplyYearsExp(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_40%,_transparent)]"
                  placeholder="5"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                <span>
                  {locale === 'id'
                    ? 'Ekspektasi gaji (IDR)'
                    : 'Expected salary (IDR)'}
                </span>
                <input
                  value={applyExpectedSalary}
                  onChange={e => setApplyExpectedSalary(e.target.value)}
                  inputMode="numeric"
                  className="h-10 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_40%,_transparent)]"
                  placeholder="15000000"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:col-span-2">
                <span>{locale === 'id' ? 'Pesan singkat' : 'Cover note'}</span>
                <textarea
                  value={applyMessage}
                  onChange={e => setApplyMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_40%,_transparent)]"
                  placeholder={
                    locale === 'id'
                      ? 'Kenalkan diri & ketersediaan...'
                      : 'Introduce yourself & availability...'
                  }
                />
              </label>
              <div className="space-y-1 text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:col-span-2">
                <span>CV / Resume</span>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={e =>
                      handleResumeInput(e.target.files?.[0] || null)
                    }
                    className="text-xs text-[color:var(--app-text)] file:mr-2 file:rounded-lg file:border-0 file:bg-[color:var(--app-accent-soft)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[color:var(--app-accent)] dark:text-[color:var(--app-text-soft)] dark:file:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)] dark:file:text-[color:var(--app-accent)]"
                  />
                  {applyResumeUrl ? (
                    <a
                      href={applyResumeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-[color:var(--app-accent)] hover:underline dark:text-[color:var(--app-accent)]"
                    >
                      {locale === 'id' ? 'Lihat CV tersimpan' : 'View saved CV'}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                <input
                  type="checkbox"
                  checked={applyRemember}
                  onChange={e => setApplyRemember(e.target.checked)}
                  className="accent-emerald-600"
                />
                {locale === 'id'
                  ? 'Simpan untuk lamar cepat'
                  : 'Remember for quick apply'}
              </label>
              {applyError ? (
                <span className="text-[11px] font-semibold text-[color:var(--app-danger)]">
                  {applyError}
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setShowApplyModal(false)}
                className="rounded-[12px] border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] hover:border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
              >
                {locale === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button
                onClick={() => handleApplySubmit(false)}
                disabled={applySubmitting}
                className="inline-flex flex-1 items-center justify-center rounded-[12px] bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {applySubmitting
                  ? locale === 'id'
                    ? 'Mengirim...'
                    : 'Submitting...'
                  : locale === 'id'
                    ? 'Kirim lamaran'
                    : 'Send application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDealChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_50%,_transparent)] p-3">
          <div className="max-h-[calc(var(--app-viewport-height)-2rem)] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white/98 p-5 shadow-[0_28px_56px_-32px_rgba(15,23,42,0.32)] dark:bg-slate-950/96 dark:shadow-[0_32px_60px_-36px_rgba(2,6,23,0.8)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                  {displayType === 'job'
                    ? locale === 'id'
                      ? 'Pilih langkah lamaran'
                      : 'Choose application path'
                    : isDemandListing
                      ? locale === 'id'
                        ? 'Pilih cara merespons'
                        : 'Choose response path'
                      : locale === 'id'
                        ? 'Pilih langkah deal'
                        : 'Choose your next step'}
                </p>
                <h2 className="text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {item.title}
                </h2>
                <p className="text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {primaryActionHint}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDealChoiceModal(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] transition hover:bg-[color:var(--app-accent-soft)]"
                aria-label={locale === 'id' ? 'Tutup' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {displayType === 'job' ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDealChoiceModal(false);
                        if (quickApplyAvailable) {
                          void handleApplySubmit(true);
                          return;
                        }
                        setShowApplyModal(true);
                      }}
                      className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 text-left transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-muted)]"
                    >
                      <p className="text-xs font-bold text-[color:var(--app-accent)]">
                        {locale === 'id' ? 'Lamar cepat' : 'Quick apply'}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                        {quickApplyAvailable
                          ? locale === 'id'
                            ? 'Kirim profil tersimpan sekarang'
                            : 'Send saved profile now'
                          : locale === 'id'
                            ? 'Lengkapi profil dasar dulu'
                            : 'Complete basic profile first'}
                      </p>
                      <p className="mt-1 text-[11px] text-[color:var(--app-text)]">
                        {locale === 'id'
                          ? 'Paling cepat kalau data nama, email, dan CV sudah siap.'
                          : 'Fastest path when your name, email, and CV are ready.'}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDealChoiceModal(false);
                        setShowApplyModal(true);
                      }}
                      className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 text-left transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-muted)]"
                    >
                      <p className="text-xs font-bold text-[color:var(--app-accent)]">
                        {locale === 'id'
                          ? 'Isi data lamaran'
                          : 'Fill application form'}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                        {locale === 'id'
                          ? 'Lengkapi detail kandidat'
                          : 'Complete candidate details'}
                      </p>
                      <p className="mt-1 text-[11px] text-[color:var(--app-text)]">
                        {locale === 'id'
                          ? 'Kirim profil, pengalaman, dan catatan.'
                          : 'Use this when you want to send a fuller profile, experience, expectations, and note.'}
                      </p>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDealChoiceModal(false);
                      void handleStartChat();
                    }}
                    className="w-full rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-left text-xs font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)]"
                  >
                    {locale === 'id'
                      ? 'Chat recruiter dulu'
                      : 'Chat recruiter first'}
                  </button>
                </>
              ) : isDemandListing ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void startDealFlow('offer')}
                      className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 text-left transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-muted)]"
                    >
                      <p className="text-xs font-bold text-[color:var(--app-accent)]">
                        {offerCardTitle}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                        {offerLabel}
                      </p>
                      <p className="mt-1 text-[11px] text-[color:var(--app-text)]">
                        {offerCardBody}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDealChoiceModal(false);
                        void handleStartChat();
                      }}
                      className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 text-left transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-muted)]"
                    >
                      <p className="text-xs font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                        {chatFirstLabel}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                        {chatLabel}
                      </p>
                      <p className="mt-1 text-[11px] text-[color:var(--app-text)]">
                        {chatFirstBody}
                      </p>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className={`grid gap-3 ${pricingMode === 'fixed' ? 'sm:grid-cols-2' : ''}`}
                  >
                    {pricingMode === 'fixed' && (
                      <button
                        type="button"
                        onClick={() => void startDealFlow('direct')}
                        className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 text-left transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-muted)]"
                      >
                        <p className="text-xs font-bold text-[color:var(--app-accent)]">
                          {directDealTitle}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                          {listPriceCents > 0
                            ? formatCurrency(listPriceCents, baseCurrency)
                            : primaryPrice}
                        </p>
                        <p className="mt-1 text-[11px] text-[color:var(--app-text)]">
                          {directDealBody}
                        </p>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void startDealFlow('offer')}
                      className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 text-left transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-muted)]"
                    >
                      <p className="text-xs font-bold text-[color:var(--app-accent)]">
                        {offerCardTitle}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                        {offerLabel}
                      </p>
                      <p className="mt-1 text-[11px] text-[color:var(--app-text)]">
                        {offerCardBody}
                      </p>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDealChoiceModal(false);
                      void handleStartChat();
                    }}
                    className="w-full rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-left text-xs font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)]"
                  >
                    {chatFirstLabel}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <TransactionVerificationPromptModal
        open={Boolean(verificationPrompt)}
        locale={locale}
        prompt={verificationPrompt}
        onClose={() => setVerificationPrompt(null)}
        onOpenVerification={() => {
          const shouldOpenPhoneVerification = Boolean(
            verificationPrompt?.hasPhone && !verificationPrompt.phoneReady,
          );
          setVerificationPrompt(null);
          // router.push(
          //   shouldOpenPhoneVerification
          //     ? PHONE_VERIFICATION_SETTINGS_PATH
          //     : '/profile/edit',
          // );
        }}
        onOpenProfile={() => {
          setVerificationPrompt(null);
          router.push('/profile');
        }}
      />

      <Modal
        open={Boolean(createdDealHandoff)}
        title={
          locale === 'id' ? 'Pesanan siap dilanjutkan' : 'Your order is ready'
        }
        onClose={() => setCreatedDealHandoff(null)}
        footer={
          createdDealHandoff ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  router.push(
                    createdDealHandoff.flowMode === 'direct'
                      ? `/transactions?transaction_id=${encodeURIComponent(
                          createdDealHandoff.transactionId,
                        )}&open_payment=1`
                      : `/transactions?focus_transaction_id=${encodeURIComponent(
                          createdDealHandoff.transactionId,
                        )}`,
                  );
                  setCreatedDealHandoff(null);
                }}
                className="inline-flex flex-1 items-center justify-center rounded-[12px] bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
              >
                {createdDealHandoff.flowMode === 'direct'
                  ? locale === 'id'
                    ? 'Buka transaksi'
                    : 'Pay safely now'
                  : locale === 'id'
                    ? 'Buka workspace order'
                    : 'Open order workspace'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (createdDealHandoff.roomId) {
                    router.push(
                      `/chat/${encodeURIComponent(createdDealHandoff.roomId)}`,
                    );
                  } else {
                    router.push('/chat');
                  }
                  setCreatedDealHandoff(null);
                }}
                className="inline-flex flex-1 items-center justify-center rounded-[12px] border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
              >
                {createdDealHandoff.roomId
                  ? locale === 'id'
                    ? 'Buka chat order'
                    : 'Open order chat'
                  : locale === 'id'
                    ? 'Buka daftar chat'
                    : 'Open chat list'}
              </button>
            </div>
          ) : null
        }
      >
        {createdDealHandoff ? (
          <div className="space-y-3">
            <div className={detailInsetClass}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                {locale === 'id' ? 'Ikhtisar order' : 'Order overview'}
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {item?.title}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className={detailInsetCompactClass}>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                    {locale === 'id' ? 'Nominal' : 'Amount'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    {createdDealHandoff.amountCents != null
                      ? formatCurrency(
                          createdDealHandoff.amountCents,
                          createdDealHandoff.currency,
                        )
                      : locale === 'id'
                        ? 'Nominal menyusul'
                        : 'Amount to follow'}
                  </p>
                </div>
                <div className={detailInsetCompactClass}>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                    {locale === 'id' ? 'Status' : 'Status'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    {humanizeValue(createdDealHandoff.status)}
                  </p>
                </div>
                <div className={detailInsetCompactClass}>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                    {locale === 'id' ? 'Proteksi' : 'Protection'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    {humanizeValue(createdDealHandoff.protectionStatus)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {[
                locale === 'id'
                  ? 'Order sudah tersimpan dan bisa dibuka lagi dari halaman Pesanan Saya.'
                  : 'The order is stored and can be reopened from My Orders.',
                locale === 'id'
                  ? 'Chat tetap untuk progres dan bukti.'
                  : 'Chat is still used for discussion, progress updates, and conversation evidence.',
                locale === 'id'
                  ? 'Kalau ada masalah, bukti tetap rapi.'
                  : 'If something goes wrong, CRM can review the order timeline, fund status, and evidence from this flow.',
              ].map((copy, index) => (
                <div
                  key={`handoff-step-${index}`}
                  className={`${detailInsetCompactClass} text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]`}
                >
                  <p className="font-semibold text-[color:var(--app-accent)]">
                    {locale === 'id'
                      ? `Langkah ${index + 1}`
                      : `Step ${index + 1}`}
                  </p>
                  <p className="mt-1">{copy}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[16px] bg-[color:var(--app-surface-muted)] p-3 text-xs text-[color:var(--app-text)]">
              {createdDealHandoff.flowMode === 'direct'
                ? locale === 'id'
                  ? 'Lanjut ke order untuk mencatat nominal, status, dan kesepakatan. Ketersediaan pembayaran ditandai jelas di halaman transaksi.'
                  : 'Continue to the order workspace to record the amount, status, and agreement. Payment availability is shown explicitly on the transaction page.'
                : locale === 'id'
                  ? 'Pantau status di order. Detail tetap lanjut di chat.'
                  : 'For offer-based deals, use the order workspace to track status, then continue technical discussion in chat without losing the transaction trail.'}
            </div>
          </div>
        ) : null}
      </Modal>

      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_50%,_transparent)] p-3">
          <div className="max-h-[calc(var(--app-viewport-height)-2rem)] w-full max-w-md overflow-y-auto rounded-[28px] bg-white/98 p-5 shadow-[0_28px_56px_-32px_rgba(15,23,42,0.32)] dark:bg-slate-950/96 dark:shadow-[0_32px_60px_-36px_rgba(2,6,23,0.8)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {offerFlowMode === 'direct'
                    ? locale === 'id'
                      ? 'Konfirmasi Pembelian Langsung'
                      : 'Confirm Direct Purchase'
                    : offerLabel}
                </h2>
                <p className="mt-1 text-xs text-[color:var(--app-text)]">
                  {offerFlowMode === 'direct'
                    ? locale === 'id'
                      ? 'Cek nominal, lalu kirim konfirmasi.'
                      : 'Review amount and send confirmation. Seller will receive a direct purchase request.'
                    : offerPrompt}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowOfferModal(false);
                  setOfferFlowMode('offer');
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] transition hover:bg-[color:var(--app-accent-soft)]"
                aria-label={locale === 'id' ? 'Tutup' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div
                className={`${detailInsetCompactClass} text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]`}
              >
                {item.title}
              </div>
              {offerFlowMode === 'direct' ? (
                <button
                  type="button"
                  onClick={() => setOfferFlowMode('offer')}
                  className={`${detailTextLinkClass} text-left text-xs`}
                >
                  {locale === 'id'
                    ? 'Perlu nego dulu? Ubah ke penawaran biasa.'
                    : 'Need to negotiate first? Switch to a regular offer.'}
                </button>
              ) : null}
              {offerFlowMode === 'offer' && suggestedOfferCents.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--app-text)]">
                    {locale === 'id' ? 'Nominal cepat' : 'Quick amounts'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedOfferCents.map(value => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setOfferAmount(String(Math.round(value / 100)))
                        }
                        className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_40%,white)] hover:text-[color:var(--app-accent)] dark:bg-slate-900 dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:color-mix(in_srgb,var(--app-accent)_18%,rgba(15,23,42,0.96))]"
                      >
                        {formatCurrency(value, baseCurrency)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {offerFlowMode === 'direct'
                    ? locale === 'id'
                      ? 'Nominal checkout (IDR) *'
                      : 'Checkout amount (IDR) *'
                    : isDemandListing
                      ? locale === 'id'
                        ? 'Nominal respons (opsional)'
                        : 'Response amount (optional)'
                      : offerAmountLabel}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={offerAmount}
                  onChange={e => setOfferAmount(e.target.value)}
                  placeholder={offerAmountPlaceholder}
                  readOnly={offerFlowMode === 'direct' && listPriceCents > 0}
                  className="h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_40%,_transparent)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {isDemandListing
                    ? locale === 'id'
                      ? 'Scope / catatan respons'
                      : 'Response scope / notes'
                    : locale === 'id'
                      ? 'Pesan (Opsional)'
                      : 'Message (Optional)'}
                </label>
                <textarea
                  value={offerMessage}
                  onChange={e => setOfferMessage(e.target.value)}
                  placeholder={
                    offerFlowMode === 'direct'
                      ? locale === 'id'
                        ? 'Tambahkan catatan konfirmasi, jadwal, atau metode pembayaran...'
                        : 'Add confirmation notes, schedule, or payment method...'
                      : offerMessagePlaceholder
                  }
                  rows={3}
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_40%,_transparent)]"
                />
              </div>
            </div>

            {offerError ? (
              <div className="mt-4 rounded-xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--app-danger)]">
                {offerError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setShowOfferModal(false);
                  setOfferFlowMode('offer');
                }}
                className={detailSecondaryButtonClass}
              >
                {locale === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button
                onClick={handleMakeOffer}
                disabled={
                  submitting ||
                  (isDemandListing
                    ? !offerAmount.trim() && !offerMessage.trim()
                    : !offerAmount.trim())
                }
                className="inline-flex flex-1 items-center justify-center rounded-[12px] bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? locale === 'id'
                    ? 'Mengirim...'
                    : 'Submitting...'
                  : offerFlowMode === 'direct'
                    ? locale === 'id'
                      ? 'Konfirmasi Beli Langsung'
                      : 'Confirm Direct Purchase'
                    : offerSubmitLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
