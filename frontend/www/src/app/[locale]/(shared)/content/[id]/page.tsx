'use client';

import { useEffect, useState } from 'react';
import NextImage from 'next/image';
import { Link, useRouter } from '@/i18n/navigation';
import { MediaPreviewCarousel } from '@/components/common/MediaPreviewCarousel';
import { useLocale } from 'next-intl';
import {
  BadgePercent,
  Building2,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Coins,
  FileText,
  Gift,
  Layers3,
  ListChecks,
  MapPin,
  MessageCircle,
  Package,
  Share2,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  User,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getSectorLabel, useSectors } from '@/context/SectorContext';
import { getFieldsForDisplay, WORK_MODE_OPTIONS } from '@/data/sectorFields';
import { CONTENT_TYPES, getContentTypeName } from '@/data/contentTypes';
import {
  filterFieldsForListingSide,
  getListingSideContextLabel,
  getListingSideLabel,
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
import { createPromotionSnapshot } from '@/lib/content/promotionPrograms';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { buildPublicProfileHref } from '@/lib/profile/publicProfileLink';
import { profileAvatarSrc } from '@/lib/profile/avatar';
import { Modal } from '@/components/common/Modal';
import { DetailMobileTopBar } from '@/components/layout/DetailMobileTopBar';
import { ContentDetailSkeleton } from '@/components/system/feedback/RouteSkeletons';
import { TransactionVerificationPromptModal } from '@/components/verification/TransactionVerificationPromptModal';
import { createIdempotencyKey } from '@/lib/clientIdempotency';
import { useAppBack } from '@/lib/navigation/useAppBack';
import {
  PHONE_VERIFICATION_SETTINGS_PATH,
  readTransactionVerification,
  type TransactionVerificationState,
} from '@/lib/identityVerification';
import { recordListingView } from '@/lib/listingViewHistory';

type ContentItem = {
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

type ReviewItem = {
  id: string;
  transaction_id?: string | null;
  content_id?: string | null;
  reviewer_id?: string | null;
  reviewee_id?: string | null;
  rating: number;
  comment?: string | null;
  created_at?: string | null;
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
  amountCents: number;
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
      : 'No order yet. Start from the action button to keep chat and payments tidy.';
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
      ? 'Lanjut order untuk bayar aman.'
      : 'Continue to the order workspace for safe payment and organized transaction details.';
  }

  if (status === 'accepted') {
    return locale === 'id'
      ? 'Order disetujui. Lanjut bayar lalu atur kerja atau pengiriman di chat.'
      : 'The order is accepted. Finish payment, then coordinate work or delivery in chat.';
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

function normalizeStatus(
  raw: unknown,
): 'draft' | 'active' | 'archived' | 'unknown' {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (value === 'draft') return 'draft';
  if (value === 'active') return 'active';
  if (value === 'archived') return 'archived';
  return 'unknown';
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

function formatPercent(value?: number | null): string {
  if (!Number.isFinite(value as number)) return '0%';
  return `${Math.round((value as number) * 100)}%`;
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

function collapseWhitespace(value?: string | null): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const clipped = value.slice(0, Math.max(0, maxLength - 1));
  const lastSpace = clipped.lastIndexOf(' ');
  const safeText = lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped;
  return `${safeText.trim()}...`;
}

function buildPreviewText(
  summary?: string | null,
  body?: string | null,
  maxLength = 220,
): string {
  const summaryText = collapseWhitespace(summary);
  const bodyText = collapseWhitespace(body);

  if (!bodyText) return '';
  if (!summaryText) return truncateText(bodyText, maxLength);

  const normalizedSummary = summaryText.toLowerCase();
  const normalizedBody = bodyText.toLowerCase();
  if (normalizedBody === normalizedSummary)
    return truncateText(bodyText, maxLength);

  if (normalizedBody.startsWith(normalizedSummary)) {
    const remainder = bodyText
      .slice(summaryText.length)
      .replace(/^[\s,.;:-]+/, '')
      .trim();
    return truncateText(remainder || bodyText, maxLength);
  }

  return truncateText(bodyText, maxLength);
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

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default function ContentDetailPage({ params }: PageProps) {
  const router = useRouter();
  const handleBack = useAppBack(router, '/search');
  const locale = useLocale() || 'id';
  const { user, authFetch } = useAuth();
  const { getSectorById } = useSectors();
  const [item, setItem] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [relatedTx, setRelatedTx] = useState<RelatedTransaction | null>(null);
  const [relatedTxLoading, setRelatedTxLoading] = useState(false);
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [resolvedParams, setResolvedParams] = useState<{
    locale: string;
    id: string;
  } | null>(null);
  const [verificationPrompt, setVerificationPrompt] =
    useState<TransactionVerificationState | null>(null);
  const [createdDealHandoff, setCreatedDealHandoff] =
    useState<CreatedDealHandoff | null>(null);
  const resolvedContentId = extractContentId(resolvedParams?.id || '');

  useEffect(() => {
    params.then(p => setResolvedParams(p));
  }, [params]);

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
          const currentParamId = resolvedParams?.id || '';
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
  }, [resolvedContentId, resolvedParams?.id, router]);

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
        typeof item.price_cents === 'number' && Number.isFinite(item.price_cents)
          ? item.price_cents
          : null,
      storeName: item.owner_profile?.full_name || null,
    });
  }, [item, locale, resolvedContentId]);

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
    if (PROMO_ONLY_MODE) {
      setReviews([]);
      setReviewsLoading(false);
      return;
    }
    if (!resolvedContentId) return;
    let active = true;
    const loadReviews = async () => {
      setReviewsLoading(true);
      try {
        const res = await fetch(`/api/content/${resolvedContentId}/reviews`);
        if (!res.ok) {
          if (active) setReviews([]);
          return;
        }
        const data = await res.json().catch(() => []);
        if (!active) return;
        if (Array.isArray(data)) {
          setReviews(data as ReviewItem[]);
        } else if (Array.isArray((data as { data?: unknown }).data)) {
          setReviews((data as { data: ReviewItem[] }).data);
        } else {
          setReviews([]);
        }
      } catch (error) {
        console.error(error);
        if (active) setReviews([]);
      } finally {
        if (active) setReviewsLoading(false);
      }
    };
    loadReviews();
    return () => {
      active = false;
    };
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
      const callbackUrl = `/${locale}/content/${resolvedParams?.id || resolvedContentId}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }
    if (displayType === 'job') {
      setShowDealChoiceModal(true);
      return;
    }
    if (isDemandListing) {
      await startDealFlow('offer');
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

    if (!finalAmount) {
      setOfferError(
        locale === 'id'
          ? 'Masukkan nominal terlebih dulu.'
          : 'Please enter an amount.',
      );
      return;
    }

    setOfferError(null);
    setSubmitting(true);
    try {
      const amountCents = finalAmount * 100;
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
            : amountCents;
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
                  value_cents: resolvedAmount,
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
              const summary =
                offerFlowMode === 'direct'
                  ? `${locale === 'id' ? 'Deal langsung' : 'Direct deal'}: ${formatCurrency(resolvedAmount, resolvedCurrency)}`
                  : isDemandListing
                    ? `${locale === 'id' ? 'Respons kebutuhan' : 'Need response'}: ${formatCurrency(resolvedAmount, resolvedCurrency)}`
                    : `Offer: ${formatCurrency(resolvedAmount, resolvedCurrency)}`;
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
      const callbackUrl = `/${locale}/content/${resolvedParams?.id || resolvedContentId}`;
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
        const itemMeta = (item.metadata as Record<string, unknown> | null) || {};
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
      const callbackUrl = `/${locale}/content/${resolvedParams?.id || resolvedContentId}`;
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
      const callbackUrl = `/${locale}/content/${resolvedParams?.id || resolvedContentId}`;
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
        <div className="content-width py-8 text-center text-xs text-[color:var(--app-text)]">
          Content not found.
        </div>
      </div>
    );
  }

  const meta = (item.metadata as Record<string, unknown> | null) || {};
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
  const displayType = rawType.includes('job')
    ? 'job'
    : rawType.includes('tool_rental') || rawType.includes('rental')
      ? 'tool_rental'
      : rawType.includes('company')
        ? 'company'
        : rawType.includes('service')
          ? 'service'
          : rawType.includes('property')
            ? 'property'
            : rawType.includes('product')
              ? 'product'
              : rawType.includes('profile') ||
                  rawType.includes('user') ||
                  rawType.includes('talent')
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
  const listingSideLabel = getListingSideLabel(listingSide, localeCode);
  const listingSideContextLabel = getListingSideContextLabel(
    listingSide,
    displayType,
    localeCode,
  );
  const isDemandListing = listingSide === 'demand';
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
  const listingStatus = normalizeStatus(item.content_status || item.status);
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
  const priceLabel = PROMO_ONLY_MODE
    ? locale === 'id'
      ? 'Tanya detail'
      : 'Ask details'
    : hasPrice
    ? formatCurrency(item.price_cents as number, item.currency || 'IDR')
    : locale === 'id'
      ? 'Harga menyesuaikan'
      : 'Price on request';
  const priceLabelWithUnit = hasPrice
    ? formatPriceWithUnit(priceLabel, priceUnitLabel)
    : priceLabel;
  const salaryRange =
    typeof meta.salary_range === 'string' ? meta.salary_range.trim() : '';
  const priceHeading =
    PROMO_ONLY_MODE
      ? locale === 'id'
        ? 'Info promosi'
        : 'Promo info'
      : displayType === 'job'
      ? locale === 'id'
        ? 'Kompensasi'
        : 'Compensation'
      : displayType === 'tool_rental'
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
  const primaryPrice =
    PROMO_ONLY_MODE
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
      : displayType === 'tool_rental'
        ? hasPrice
          ? priceLabelWithUnit
          : locale === 'id'
            ? 'Tarif menyesuaikan'
            : 'Rate on request'
        : displayType === 'company'
          ? (typeof meta.industry_focus === 'string' && meta.industry_focus) ||
            (typeof meta.company_size === 'string' && meta.company_size) ||
            (locale === 'id' ? 'Profil publik' : 'Public profile')
          : priceLabelWithUnit;
  const displayPriceHeading =
    PROMO_ONLY_MODE
      ? locale === 'id'
        ? 'Mulai dari chat'
        : 'Start with chat'
      : displayType === 'service' && priceUnitLabel
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
      : displayType === 'tool_rental'
        ? locale === 'id'
          ? 'Ajukan booking / negosiasi sewa'
          : 'Request booking / negotiate rental'
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
      : displayType === 'tool_rental'
        ? locale === 'id'
          ? 'Chat pemilik alat'
          : 'Chat asset owner'
        : displayType === 'company'
          ? locale === 'id'
            ? 'Chat perusahaan'
            : 'Chat company'
          : isDemandListing
            ? locale === 'id'
              ? 'Tanya detail kebutuhan'
              : 'Ask for details'
            : displayType === 'service'
              ? locale === 'id'
                ? 'Chat penyedia'
                : 'Chat provider'
              : displayType === 'property'
                ? locale === 'id'
                  ? 'Jadwalkan survey'
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
      : displayType === 'tool_rental'
        ? locale === 'id'
          ? 'Kirim permintaan sewa'
          : 'Send rental request'
        : displayType === 'company'
          ? locale === 'id'
            ? 'Kirim intro'
            : 'Send intro'
          : isDemandListing
            ? locale === 'id'
              ? 'Kirim respons'
              : 'Send response'
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
      : displayType === 'tool_rental'
        ? locale === 'id'
          ? 'Tulis tanggal, durasi, kebutuhan alat.'
          : 'Share your rental date, duration, and asset needs.'
        : displayType === 'company'
          ? locale === 'id'
            ? 'Tulis konteks intro atau kemitraan.'
            : 'Explain the intro context, partnership angle, or what you want to discuss.'
          : isDemandListing
            ? locale === 'id'
              ? 'Tulis cara Anda memenuhi kebutuhan ini.'
              : 'Explain how you can fulfill this listing need.'
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
      : displayType === 'tool_rental'
        ? locale === 'id'
          ? 'Budget sewa / rate yang Anda ajukan (IDR) *'
          : 'Proposed rental budget / rate (IDR) *'
        : displayType === 'company'
          ? locale === 'id'
            ? 'Budget / nilai peluang (IDR) *'
            : 'Budget / opportunity value (IDR) *'
          : isDemandListing
            ? locale === 'id'
              ? 'Nominal respons Anda (IDR) *'
              : 'Your response amount (IDR) *'
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
      : displayType === 'tool_rental'
        ? locale === 'id'
          ? 'contoh: 450000'
          : 'e.g. 450000'
        : displayType === 'company'
          ? locale === 'id'
            ? 'contoh: 10000000'
            : 'e.g. 10000000'
          : isDemandListing
            ? locale === 'id'
              ? 'contoh: 3500000'
              : 'e.g. 3500000'
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
        ? ShieldCheck
        : displayType === 'company'
          ? Building2
          : displayType === 'service'
            ? Wrench
            : displayType === 'property'
              ? Building2
              : displayType === 'profile'
                ? User
                : Package;
  const highlightHeading =
    displayType === 'job'
      ? locale === 'id'
        ? 'Ringkasan Posisi'
        : 'Role Highlights'
      : displayType === 'tool_rental'
        ? locale === 'id'
          ? 'Ringkasan Sewa'
          : 'Rental Highlights'
        : displayType === 'company'
          ? locale === 'id'
            ? 'Ringkasan Perusahaan'
            : 'Company Highlights'
          : isDemandListing
            ? locale === 'id'
              ? 'Ringkasan Kebutuhan'
              : 'Need Highlights'
            : displayType === 'service'
              ? locale === 'id'
                ? 'Ringkasan Layanan'
                : 'Service Highlights'
              : displayType === 'property'
                ? locale === 'id'
                  ? 'Ringkasan Properti'
                  : 'Property Highlights'
                : displayType === 'profile'
                  ? locale === 'id'
                    ? 'Ringkasan Profil'
                    : 'Profile Highlights'
                  : locale === 'id'
                    ? 'Ringkasan Produk'
                    : 'Product Highlights';
  const detailHeading =
    displayType === 'job'
      ? locale === 'id'
        ? 'Detail Lowongan'
        : 'Job Details'
      : displayType === 'tool_rental'
        ? locale === 'id'
          ? 'Detail Aturan Sewa'
          : 'Rental Rules & Details'
        : displayType === 'company'
          ? locale === 'id'
            ? 'Detail Perusahaan'
            : 'Company Details'
          : isDemandListing
            ? locale === 'id'
              ? 'Detail Kebutuhan'
              : 'Requirement Details'
            : displayType === 'service'
              ? locale === 'id'
                ? 'Detail Layanan'
                : 'Service Details'
              : displayType === 'property'
                ? locale === 'id'
                  ? 'Detail Properti'
                  : 'Property Details'
                : displayType === 'profile'
                  ? locale === 'id'
                    ? 'Detail Profil'
                    : 'Profile Details'
                  : locale === 'id'
                    ? 'Detail Produk'
                    : 'Product Details';
  const statusLabel =
    listingStatus === 'active'
      ? locale === 'id'
        ? 'Aktif'
        : 'Active'
      : listingStatus === 'draft'
        ? 'Draft'
        : listingStatus === 'archived'
          ? locale === 'id'
            ? 'Arsip'
            : 'Archived'
          : locale === 'id'
            ? 'Tidak diketahui'
            : 'Unknown';
  const statusBadgeClass =
    listingStatus === 'active'
      ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)] dark:text-[color:var(--app-accent)]'
      : listingStatus === 'draft'
        ? 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)] dark:border-[color:color-mix(in_srgb,_var(--app-warning-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_30%,_transparent)] dark:text-[color:var(--app-warning)]'
        : listingStatus === 'archived'
          ? 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]'
          : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]';
  const updatedLabel = formatDate(item.updated_at);
  const createdLabel = formatDate(item.created_at);
  const ratingValue =
    !PROMO_ONLY_MODE && typeof item.rating === 'number' ? item.rating : 0;
  const ratingRounded = Math.round(ratingValue);
  const sellerStats = item.seller_stats || null;
  const sellerRating =
    !PROMO_ONLY_MODE && typeof sellerStats?.rating === 'number'
      ? sellerStats.rating
      : 0;
  const sellerReviewCount =
    !PROMO_ONLY_MODE && typeof sellerStats?.review_count === 'number'
      ? sellerStats.review_count
      : 0;
  const sellerTotalTransactions =
    !PROMO_ONLY_MODE && typeof sellerStats?.total_transactions === 'number'
      ? sellerStats.total_transactions
      : 0;
  const sellerCompletedTransactions =
    typeof sellerStats?.completed_transactions === 'number'
      ? sellerStats.completed_transactions
      : 0;
  const sellerAcceptedTransactions =
    typeof sellerStats?.accepted_transactions === 'number'
      ? sellerStats.accepted_transactions
      : 0;
  const sellerAcceptanceRate =
    typeof sellerStats?.acceptance_rate === 'number'
      ? sellerStats.acceptance_rate
      : sellerTotalTransactions > 0
        ? (sellerCompletedTransactions + sellerAcceptedTransactions) /
          sellerTotalTransactions
        : 0;
  const showSellerStats = sellerReviewCount > 0 || sellerTotalTransactions > 0;
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
              : ShieldCheck,
      label: isDemandListing
        ? locale === 'id'
          ? 'Status kebutuhan'
          : 'Need status'
        : locale === 'id'
          ? 'Ketersediaan'
          : 'Availability',
      value:
        displayType === 'company'
          ? locale === 'id'
            ? 'Profil perusahaan'
            : 'Company profile'
          : (typeof meta.availability === 'string' &&
              meta.availability.trim()) ||
            (isDemandListing
              ? locale === 'id'
                ? 'Sedang dibuka'
                : 'Open'
              : locale === 'id'
                ? 'Tersedia'
                : 'Available'),
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
      value:
        displayType === 'company'
          ? (typeof meta.hiring_focus === 'string' &&
              meta.hiring_focus.trim()) ||
            (typeof meta.about_company === 'string' &&
              meta.about_company.trim()) ||
            (locale === 'id' ? 'Terbuka untuk intro' : 'Open for introductions')
          : readMetaText(
              meta,
              'delivery_time',
              'delivery_estimate',
              'deadline',
              'preferred_period',
            ) ||
            formatDate(String(meta.available_from || '')) ||
            (locale === 'id' ? 'Sesuai kesepakatan' : 'By agreement'),
    },
    {
      key: 'location',
      icon: MapPin,
      label: locale === 'id' ? 'Lokasi' : 'Location',
      value:
        (displayType === 'company' &&
          typeof meta.headquarters === 'string' &&
          meta.headquarters.trim()) ||
        (displayType === 'tool_rental' &&
          typeof meta.pickup_location === 'string' &&
          meta.pickup_location.trim()) ||
        (typeof meta.location === 'string' && meta.location.trim()) ||
        (typeof meta.city === 'string' && meta.city.trim()) ||
        (locale === 'id' ? 'Indonesia' : 'Indonesia'),
    },
  ];
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
      label: locale === 'id' ? 'Traffic yang dicari' : 'Target traffic',
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
  const heroHighlightLimit = PROMO_ONLY_MODE ? 1 : 2;
  const heroTagLimit = PROMO_ONLY_MODE ? 2 : 3;
  const previewHighlightItems = visibleHighlightItems.slice(
    0,
    heroHighlightLimit,
  );
  const expandedDetailItems = [
    ...visibleHighlightItems
      .slice(previewHighlightItems.length)
      .map(entry => ({
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
            ? formatDate(String(value)) || String(value)
            : String(value),
      };
    }),
  ];
  const visibleExpandedDetailItems = PROMO_ONLY_MODE
    ? expandedDetailItems.slice(0, 6)
    : expandedDetailItems;
  const hiddenExpandedDetailCount = Math.max(
    0,
    expandedDetailItems.length - visibleExpandedDetailItems.length,
  );
  const previewTags = tags.slice(0, heroTagLimit);
  const extraTagCount = Math.max(0, tags.length - previewTags.length);
  const detailTags = PROMO_ONLY_MODE ? tags.slice(0, 8) : tags;
  const hiddenDetailTagCount = Math.max(0, tags.length - detailTags.length);
  const summaryPreview =
    collapseWhitespace(item.summary) ||
    buildPreviewText(undefined, item.body, PROMO_ONLY_MODE ? 62 : 110);
  const bodyPreview = buildPreviewText(
    item.summary,
    item.body,
    PROMO_ONLY_MODE
      ? displayType === 'product' || displayType === 'property'
        ? 72
        : 84
      : displayType === 'product' || displayType === 'property'
        ? 120
        : 140,
  );
  const deliveryDaysLabel =
    meta.delivery_days != null && String(meta.delivery_days).trim()
      ? `${meta.delivery_days} ${locale === 'id' ? 'hari kerja' : 'business days'}`
      : '';
  const nextAvailableLabel = formatDate(String(meta.next_available || ''));
  const getDetailEntryIcon = (key: string, label: string) => {
    const text = `${key} ${label}`.toLowerCase();
    if (
      /(price|harga|budget|rate|tarif|salary|kompensasi|nominal|fee)/.test(text)
    ) {
      return Coins;
    }
    if (/(deliver|output|hasil|file|handoff|terima)/.test(text)) {
      return Package;
    }
    if (/(require|kebutuhan|dibutuhkan|data|brief|klien|client)/.test(text)) {
      return ClipboardCheck;
    }
    if (/(scope|ruang lingkup|cakupan|dikerjakan|responsibil)/.test(text)) {
      return ListChecks;
    }
    if (
      /(time|timeline|waktu|durasi|delivery|jadwal|available|tersedia|mulai|date|tanggal)/.test(
        text,
      )
    ) {
      return Clock3;
    }
    if (/(location|lokasi|alamat|city|kota|region|wilayah)/.test(text)) {
      return MapPin;
    }
    if (/(mode|type|tipe|jenis|category|kategori|level|kelas)/.test(text)) {
      return Layers3;
    }
    if (/(target|goal|tujuan|audience|market)/.test(text)) {
      return Target;
    }
    if (/(company|perusahaan|owner|pemilik|seller|penjual)/.test(text)) {
      return Building2;
    }
    return FileText;
  };
  const serviceSummaryDescription =
    bodyPreview && bodyPreview !== summaryPreview ? bodyPreview : '';
  const serviceTimelineValue = [
    readMetaText(meta, 'availability'),
    readMetaText(meta, 'delivery_time') || deliveryDaysLabel,
    nextAvailableLabel
      ? `${locale === 'id' ? 'Mulai' : 'Starts'} ${nextAvailableLabel}`
      : '',
  ]
    .filter(Boolean)
    .join(' - ');
  const serviceGuideSections =
    displayType === 'service'
      ? [
          {
            key: 'service_summary',
            icon: FileText,
            eyebrow: locale === 'id' ? 'Mulai dari sini' : 'Start here',
            title: locale === 'id' ? 'Ringkasan Layanan' : 'Service Summary',
            value:
              summaryPreview ||
              (locale === 'id'
                ? 'Layanan profesional yang bisa dibahas dulu sebelum pekerjaan dimulai.'
                : 'A professional service that can be aligned before the work starts.'),
            description: serviceSummaryDescription,
          },
          {
            key: 'service_scope',
            icon: ListChecks,
            eyebrow: locale === 'id' ? 'Scope kerja' : 'Work scope',
            title: locale === 'id' ? 'Ruang lingkup layanan' : 'Service scope',
            value:
              readMetaText(meta, 'service_scope') ||
              (locale === 'id'
                ? 'Scope mencakup briefing, eksekusi inti, revisi seperlunya, dan handoff yang siap dipakai buyer.'
                : 'Scope includes briefing, core execution, necessary revisions, and a usable handoff.'),
          },
          {
            key: 'deliverables',
            icon: Package,
            eyebrow: locale === 'id' ? 'Hasil akhir' : 'Final output',
            title: locale === 'id' ? 'Output yang diterima' : 'Deliverables',
            value:
              readMetaText(meta, 'deliverables') ||
              (locale === 'id'
                ? 'Buyer menerima output kerja utama, ringkasan tindak lanjut, serta file akhir atau checklist eksekusi.'
                : 'Buyer receives the main work output, follow-up notes, and final files or execution checklist.'),
          },
          {
            key: 'client_requirements',
            icon: ClipboardCheck,
            eyebrow: locale === 'id' ? 'Sebelum mulai' : 'Before starting',
            title:
              locale === 'id'
                ? 'Data yang dibutuhkan dari klien'
                : 'Client requirements',
            value:
              readMetaText(meta, 'client_requirements') ||
              (locale === 'id'
                ? 'Siapkan brief, referensi, target audience, dan akses dasar yang memang diperlukan untuk eksekusi.'
                : 'Prepare a brief, references, target audience, and the basic access needed for execution.'),
          },
          {
            key: 'availability_window',
            icon: Clock3,
            eyebrow: locale === 'id' ? 'Jadwal' : 'Schedule',
            title: locale === 'id' ? 'Slot & timeline' : 'Slot & timeline',
            value:
              serviceTimelineValue ||
              (locale === 'id'
                ? 'Timeline dan slot kerja dikonfirmasi setelah kebutuhan jelas.'
                : 'Timeline and work slots are confirmed once the requirements are clear.'),
          },
        ].filter(section => section.value || section.description)
      : [];
  const flowSteps = (() => {
    if (PROMO_ONLY_MODE) {
      if (isOwner) {
        return locale === 'id'
          ? [
              'Pastikan data promosi jelas',
              'Balas chat calon pembeli',
              'Kirim katalog atau detail tambahan',
              'Update posting saat stok berubah',
            ]
          : [
              'Keep the promo details clear',
              'Reply to interested chats',
              'Share catalog or extra details',
              'Update the post when stock changes',
            ];
      }

      return locale === 'id'
        ? [
            'Baca ringkasan dan foto',
            'Chat untuk tanya stok/detail',
            'Minta katalog atau kontak lanjutan',
            'Simpan posting kalau cocok',
          ]
        : [
            'Review summary and photos',
            'Chat to ask stock or details',
            'Ask for catalog or follow-up contact',
            'Save the post if it fits',
          ];
    }

    if (isOwner) {
      return locale === 'id'
        ? [
            'Bagikan ke room terkait',
            'Terima apply atau offer',
            'Lanjut negosiasi',
            'Pantau sampai selesai',
          ]
        : [
            'Share to relevant rooms',
            'Receive applications or offers',
            'Continue the negotiation',
            'Track it to completion',
          ];
    }

    if (displayType === 'job') {
      return locale === 'id'
        ? [
            'Cek role dan syarat',
            'Kirim lamaran',
            'Chat recruiter',
            'Lanjut offer',
          ]
        : [
            'Review the role and requirements',
            'Send your application',
            'Chat with the recruiter',
            'Continue the offer flow',
          ];
    }

    if (displayType === 'company') {
      return locale === 'id'
        ? [
            'Lihat profil perusahaan',
            'Buka profil owner atau chat',
            'Bahas hiring atau partnership',
            'Lanjut ke listing spesifik bila perlu',
          ]
        : [
            'Review the company profile',
            'Open the owner profile or chat',
            'Discuss hiring or partnerships',
            'Move to a specific listing if needed',
          ];
    }

    if (displayType === 'tool_rental') {
      return locale === 'id'
        ? [
            'Cek rate dan deposit',
            'Validasi jadwal dan kondisi',
            'Kirim request sewa',
            'Catat pickup dan return',
          ]
        : [
            'Review the rate and deposit',
            'Confirm schedule and condition',
            'Send the rental request',
            'Document pickup and return',
          ];
    }

    if (isDemandListing) {
      return locale === 'id'
        ? [
            'Pahami kebutuhan utamanya',
            'Kirim proposal atau offer',
            'Samakan scope dan harga',
            'Lanjut kalau sudah cocok',
          ]
        : [
            'Understand the core need',
            'Send a proposal or offer',
            'Align scope and price',
            'Proceed when both sides agree',
          ];
    }

    if (displayType === 'service' || displayType === 'profile') {
      return locale === 'id'
        ? [
            'Mulai dari chat brief',
            'Kirim offer atau counter',
            'Mulai kerja saat deal',
            'Tandai selesai',
          ]
        : [
            'Start with the project brief chat',
            'Send an offer or counter',
            'Start once the deal is set',
            'Mark it completed',
          ];
    }

    if (displayType === 'property') {
      return locale === 'id'
        ? [
            'Atur survey atau viewing',
            'Kirim penawaran',
            'Sepakati syarat deal',
            'Finalisasi transaksi',
          ]
        : [
            'Schedule the viewing',
            'Submit the offer',
            'Agree on the terms',
            'Finalize the transaction',
          ];
    }

    return locale === 'id'
      ? [
          'Chat untuk cek detail',
          'Kirim offer atau counter',
          'Lanjutkan transaksi',
          'Konfirmasi saat diterima',
        ]
      : [
          'Chat to confirm the details',
          'Send an offer or counter',
          'Continue the transaction',
          'Confirm after delivery',
        ];
  })();
  const flowOverviewDescription =
    locale === 'id'
      ? `${flowSteps.length} langkah cepat`
      : `${flowSteps.length} quick steps`;
  const primaryActionLabel =
    PROMO_ONLY_MODE
      ? chatLabel
      : displayType === 'job'
      ? locale === 'id'
        ? 'Lanjutkan Lamaran'
        : 'Continue Application'
      : displayType === 'company'
        ? locale === 'id'
          ? 'Mulai Percakapan'
          : 'Start Conversation'
        : isDemandListing
          ? locale === 'id'
            ? 'Tanggapi Kebutuhan'
            : 'Respond to Need'
          : displayType === 'service'
            ? locale === 'id'
              ? 'Minta Penawaran'
              : 'Request Quote'
            : pricingMode === 'fixed'
              ? locale === 'id'
                ? 'Lanjutkan Deal'
                : 'Continue Deal'
              : locale === 'id'
                ? 'Pilih Respons'
                : 'Choose Action';
  const primaryActionHint =
    PROMO_ONLY_MODE
      ? locale === 'id'
        ? 'Fase awal: promosi dan chat dulu.'
        : 'Early launch: promotion and chat first.'
      : displayType === 'job'
      ? locale === 'id'
        ? 'Chat dulu. Lanjut apply.'
        : 'Apply fast or chat the recruiter.'
      : displayType === 'company'
        ? locale === 'id'
          ? 'Chat dulu. Lanjut profil/listing.'
          : 'Start with chat or the owner profile.'
        : displayType === 'tool_rental'
          ? locale === 'id'
            ? 'Chat jadwal. Lanjut sewa.'
            : 'Check schedule and rate, then send a rental request.'
          : displayType === 'property'
            ? locale === 'id'
              ? 'Chat survey. Lanjut deal.'
              : 'Start by chatting about the viewing first, then continue the deal.'
            : displayType === 'service' || displayType === 'profile'
              ? locale === 'id'
                ? 'Scope, timeline, dan harga bisa dikunci setelah chat.'
                : 'Align scope, timeline, and price in chat before continuing.'
              : displayType === 'product'
                ? locale === 'id'
                  ? 'Chat stok. Lanjut bayar.'
                  : 'Start by confirming stock in chat, then continue to offers or safe payment.'
                : isDemandListing
                  ? locale === 'id'
                    ? 'Chat dulu. Baru kirim offer.'
                    : 'Start with a short chat, then send a response or offer.'
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
      return locale === 'id'
        ? `Halo kak, mau tanya ${title}.`
        : `Hi, I saw ${title}. I want to ask more about the business and the opportunity.`;
    }

    if (displayType === 'tool_rental') {
      return locale === 'id'
        ? `Halo kak, ${title} masih ready? Jadwal dan depositnya?`
        : `Hi, is ${title} still available? I want to ask about schedule, deposit, and pickup.`;
    }

    if (displayType === 'property') {
      return locale === 'id'
        ? `Halo kak, ${title} tersedia? Survey dan harganya?`
        : `Hi, is ${title} still available? I want to ask about viewing, price, and terms.`;
    }

    if (displayType === 'service' || displayType === 'profile') {
      return locale === 'id'
        ? `Halo kak, tertarik ${title}. Scope dan timeline?`
        : `Hi, I am interested in ${title}. Can you share the scope, timeline, and how to start?`;
    }

    if (isDemandListing) {
      return locale === 'id'
        ? `Halo kak, saya bisa bantu ${title}. Detail intinya apa?`
        : `Hi, I saw the need for ${title}. I may be able to help. Can you share the key details first?`;
    }

    return locale === 'id'
      ? `Halo kak, ${title} masih ada? Stok dan harganya berapa?`
      : `Hi, I saw ${title}. Is it still available? I want to check stock, price, and how to order.`;
  })();
  const chatFirstLabel =
    PROMO_ONLY_MODE
      ? locale === 'id'
        ? 'Chat tanya detail'
        : 'Chat for details'
      : displayType === 'job'
      ? locale === 'id'
        ? 'Chat recruiter dulu'
        : 'Chat recruiter first'
      : displayType === 'tool_rental'
        ? locale === 'id'
          ? 'Chat jadwal dulu'
          : 'Chat about schedule first'
        : displayType === 'property'
          ? locale === 'id'
            ? 'Chat survey dulu'
            : 'Chat about viewing first'
          : displayType === 'product'
            ? locale === 'id'
              ? 'Chat stok dulu'
              : 'Confirm stock in chat'
            : locale === 'id'
              ? 'Chat dulu'
              : 'Chat first';
  const chatFirstBody =
    PROMO_ONLY_MODE
      ? locale === 'id'
        ? 'Cek stok, katalog, MOQ, area kirim, atau detail kebutuhan lewat chat.'
        : 'Confirm stock, catalog, MOQ, delivery area, or need details in chat.'
      : displayType === 'job'
      ? locale === 'id'
        ? 'Masuk chat dulu biar lanjutnya gampang.'
        : 'Open chat first so the next step feels more natural.'
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
            : isDemandListing
              ? locale === 'id'
                ? 'Tanya detail inti dulu.'
                : 'Ask for the core details first so your response is more precise.'
              : locale === 'id'
                ? 'Chat dulu. Deal kalau cocok.'
                : 'Start with a short WhatsApp-like chat first, then continue the deal when ready.';
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
  const detailTone =
    displayType === 'job'
      ? {
          page: 'bg-[linear-gradient(180deg,#fffdf5_0%,#ffffff_34%,#f7fff9_100%)] dark:bg-[linear-gradient(180deg,#1c1002_0%,#020617_42%,#04110d_100%)]',
          surface:
            'border-emerald-200/80 bg-[linear-gradient(135deg,#fffdf5_0%,#ffffff_54%,#ecfdf5_100%)] ring-emerald-100/80 dark:border-emerald-400/20 dark:bg-[linear-gradient(135deg,rgba(69,26,3,0.28),rgba(2,6,23,0.96)_56%,rgba(6,78,59,0.22))] dark:ring-emerald-400/15',
          inset:
            'bg-amber-50/72 ring-amber-100/80 dark:bg-amber-400/10 dark:ring-amber-300/15',
          compact:
            'bg-white/76 ring-emerald-100/80 dark:bg-white/[0.06] dark:ring-emerald-300/12',
          row: 'bg-white/74 ring-emerald-100/80 hover:bg-emerald-50 dark:bg-white/[0.06] dark:ring-emerald-300/12 dark:hover:bg-emerald-400/12',
        }
      : displayType === 'service' || displayType === 'profile'
        ? {
            page: 'bg-[linear-gradient(180deg,#f0fdfa_0%,#ffffff_36%,#f0f9ff_100%)] dark:bg-[linear-gradient(180deg,#042f2e_0%,#020617_44%,#082f49_100%)]',
            surface:
              'border-teal-200/80 bg-[linear-gradient(135deg,#f0fdfa_0%,#ffffff_54%,#ecfeff_100%)] ring-teal-100/80 dark:border-teal-400/20 dark:bg-[linear-gradient(135deg,rgba(19,78,74,0.28),rgba(2,6,23,0.96)_56%,rgba(8,47,73,0.24))] dark:ring-teal-400/15',
            inset:
              'bg-teal-50/72 ring-teal-100/80 dark:bg-teal-400/10 dark:ring-teal-300/15',
            compact:
              'bg-white/76 ring-teal-100/80 dark:bg-white/[0.06] dark:ring-teal-300/12',
            row: 'bg-white/74 ring-teal-100/80 hover:bg-teal-50 dark:bg-white/[0.06] dark:ring-teal-300/12 dark:hover:bg-teal-400/12',
          }
        : displayType === 'property'
          ? {
              page: 'bg-[linear-gradient(180deg,#fff7ed_0%,#ffffff_36%,#f7fff9_100%)] dark:bg-[linear-gradient(180deg,#431407_0%,#020617_44%,#04110d_100%)]',
              surface:
                'border-orange-200/80 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_54%,#ecfdf5_100%)] ring-orange-100/80 dark:border-orange-400/20 dark:bg-[linear-gradient(135deg,rgba(67,20,7,0.3),rgba(2,6,23,0.96)_56%,rgba(6,78,59,0.2))] dark:ring-orange-400/15',
              inset:
                'bg-orange-50/72 ring-orange-100/80 dark:bg-orange-400/10 dark:ring-orange-300/15',
              compact:
                'bg-white/76 ring-orange-100/80 dark:bg-white/[0.06] dark:ring-orange-300/12',
              row: 'bg-white/74 ring-orange-100/80 hover:bg-orange-50 dark:bg-white/[0.06] dark:ring-orange-300/12 dark:hover:bg-orange-400/12',
            }
          : displayType === 'tool_rental'
            ? {
                page: 'bg-[linear-gradient(180deg,#f7fee7_0%,#ffffff_36%,#ecfdf5_100%)] dark:bg-[linear-gradient(180deg,#1a2e05_0%,#020617_44%,#04110d_100%)]',
                surface:
                  'border-lime-200/80 bg-[linear-gradient(135deg,#f7fee7_0%,#ffffff_54%,#ecfdf5_100%)] ring-lime-100/80 dark:border-lime-400/20 dark:bg-[linear-gradient(135deg,rgba(54,83,20,0.28),rgba(2,6,23,0.96)_56%,rgba(6,78,59,0.2))] dark:ring-lime-400/15',
                inset:
                  'bg-lime-50/72 ring-lime-100/80 dark:bg-lime-400/10 dark:ring-lime-300/15',
                compact:
                  'bg-white/76 ring-lime-100/80 dark:bg-white/[0.06] dark:ring-lime-300/12',
                row: 'bg-white/74 ring-lime-100/80 hover:bg-lime-50 dark:bg-white/[0.06] dark:ring-lime-300/12 dark:hover:bg-lime-400/12',
              }
            : {
                page: 'bg-[linear-gradient(180deg,#f7fff9_0%,#ffffff_34%,#f0fdfa_100%)] dark:bg-[linear-gradient(180deg,#04110d_0%,#020617_42%,#042f2e_100%)]',
                surface:
                  'border-emerald-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f7fff9_56%,#ecfdf5_100%)] ring-emerald-100/80 dark:border-emerald-400/20 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.28),rgba(2,6,23,0.96)_56%,rgba(20,83,45,0.22))] dark:ring-emerald-400/15',
                inset:
                  'bg-emerald-50/72 ring-emerald-100/80 dark:bg-emerald-400/10 dark:ring-emerald-300/15',
                compact:
                  'bg-white/76 ring-emerald-100/80 dark:bg-white/[0.06] dark:ring-emerald-300/12',
                row: 'bg-white/74 ring-emerald-100/80 hover:bg-emerald-50 dark:bg-white/[0.06] dark:ring-emerald-300/12 dark:hover:bg-emerald-400/12',
              };
  const detailPageShellClass = `lajukan-market-page lajukan-market-detail page-shell max-lg:!px-0 lg:!px-4 xl:!px-6 overflow-x-hidden py-0 pb-[calc(6.25rem+env(safe-area-inset-bottom))] sm:py-1.5 lg:pb-7 ${detailTone.page}`;
  const detailShellStackClass =
    'mx-auto flex w-full max-w-[1320px] flex-col gap-2 px-2 sm:gap-2.5 sm:px-3 lg:px-0';
  const detailSectionClass = `relative overflow-hidden rounded-[16px] border px-3 py-3 shadow-[0_14px_26px_-24px_rgba(15,23,42,0.16)] ring-1 sm:rounded-[20px] sm:p-3.5 ${detailTone.surface}`;
  const detailInsetClass = `rounded-[16px] px-2.5 py-2.5 ring-1 sm:px-3 sm:py-3 ${detailTone.inset}`;
  const detailInsetCompactClass = `rounded-[14px] px-2.5 py-2 ring-1 sm:rounded-[16px] sm:px-3 sm:py-2.5 ${detailTone.compact}`;
  const detailPrimaryButtonClass =
    'inline-flex min-h-[40px] items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-3.5 text-xs font-black text-white shadow-[0_18px_34px_-24px_color-mix(in_srgb,var(--app-accent)_48%,transparent)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[42px] sm:px-4 sm:text-sm';
  const detailSecondaryButtonClass =
    'inline-flex min-h-[40px] items-center justify-center gap-1 rounded-full bg-slate-100 px-3.5 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:opacity-60 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:min-h-[42px] sm:px-4 sm:text-sm';
  const detailTextLinkClass =
    'text-sm font-semibold text-[color:var(--app-accent)] transition hover:text-[color:var(--app-accent-strong)]';
  const heroSummaryCard = summaryPreview || bodyPreview ? (
    <div className="mt-2.5 rounded-[16px] bg-white/68 p-2.5 text-sm leading-5 text-[color:var(--app-text)] ring-1 ring-slate-200/60 dark:bg-slate-950/58 dark:text-[color:var(--app-text-soft)] dark:ring-slate-800 sm:p-3 sm:leading-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
        {locale === 'id' ? 'Ringkasan' : 'Summary'}
      </p>
      {summaryPreview ? (
        <p className="mt-1.5 line-clamp-3 font-medium">{summaryPreview}</p>
      ) : null}
      {bodyPreview ? (
        <p
          className={`line-clamp-2 ${summaryPreview ? 'mt-1.5 sm:mt-2' : 'mt-1.5'} ${PROMO_ONLY_MODE ? 'hidden sm:block' : ''}`}
        >
          {bodyPreview}
        </p>
      ) : null}
    </div>
  ) : null;

  const actionButtons = (
    <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(118px,1fr))] gap-1.5 sm:gap-2 lg:grid-cols-1">
      {isOwner && (
        <Link
          href={`/create?draft=${item.id}`}
          className={detailPrimaryButtonClass}
        >
          {locale === 'id' ? 'Edit Listing' : 'Edit Listing'}
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
      {!isOwner && (
        <button
          type="button"
          onClick={openReportListingModal}
          className={detailSecondaryButtonClass}
        >
          {locale === 'id' ? 'Report listing' : 'Report listing'}
        </button>
      )}
      {!isOwner && PROMO_ONLY_MODE && (
        <button
          type="button"
          onClick={() => void handleStartChat()}
          disabled={!peerUserId || chatStarting}
          className={detailPrimaryButtonClass}
        >
          {chatStarting
            ? locale === 'id'
              ? 'Membuka chat...'
              : 'Opening chat...'
            : primaryActionLabel}
        </button>
      )}
      {!isOwner && !PROMO_ONLY_MODE && (
        <button
          type="button"
          onClick={openDealFlowPicker}
          disabled={!peerUserId}
          className={detailPrimaryButtonClass}
        >
          {primaryActionLabel}
        </button>
      )}
      {!isOwner && !PROMO_ONLY_MODE && displayType !== 'company' && (
        <button
          type="button"
          onClick={() => void handleStartChat()}
          disabled={!peerUserId || chatStarting}
          className={detailSecondaryButtonClass}
        >
          {chatStarting
            ? locale === 'id'
              ? 'Membuka chat...'
              : 'Opening chat...'
            : chatLabel}
        </button>
      )}
    </div>
  );

  const ownerProfileCard =
    ownerProfileHref && ownerDisplayName ? (
      <section className={detailSectionClass}>
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-900">
            <NextImage
              src={profileAvatarSrc(ownerAvatarUrl)}
              alt={ownerDisplayName}
              width={48}
              height={48}
              className="h-full w-full object-cover"
              unoptimized
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
              {locale === 'id' ? 'Profil pemilik' : 'Owner profile'}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {ownerDisplayName}
            </p>
            {ownerHeadline ? (
              <p className="mt-1 line-clamp-2 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {ownerHeadline}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={ownerProfileHref}
                className="inline-flex items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--app-accent-soft)_52%,white)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent)_24%,rgba(15,23,42,0.96))]"
              >
                {locale === 'id' ? 'Lihat profile' : 'View profile'}
              </Link>
              {ownerProfile?.identity_verified && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-[color:var(--app-accent)]" />
                  {locale === 'id' ? 'Identity verified' : 'Identity verified'}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>
    ) : null;

  const actionCard = (
    <section className={detailSectionClass}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.25em] text-[color:var(--app-text-soft)]">
          {displayPriceHeading}
        </span>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {listingSideContextLabel}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusBadgeClass}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>
      <div className="mt-2 text-[26px] font-semibold leading-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        {primaryPrice}
      </div>
      <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[color:color-mix(in_srgb,var(--app-accent-soft)_46%,white)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent)_24%,rgba(15,23,42,0.96))]">
        <MessageCircle className="h-3.5 w-3.5" />
        {primaryActionHint}
      </div>
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
        <div className="mt-3 rounded-[20px] bg-[color:var(--app-warning-soft)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[color:var(--app-warning)] dark:bg-slate-950">
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
      {!isOwner && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <MessageCircle className="h-3.5 w-3.5" />
          {listingSideLabel}
        </div>
      )}
      {ratingValue > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={`rating-${i}`}
                className={`h-3.5 w-3.5 ${
                  i < ratingRounded
                    ? 'fill-[color:var(--app-warning)] text-[color:var(--app-warning)]'
                    : 'text-[color:var(--app-text-soft)] dark:text-[color:var(--app-text)]'
                }`}
              />
            ))}
          </div>
          <span>
            {ratingValue.toFixed(1)} ({item.review_count || 0}{' '}
            {locale === 'id' ? 'review' : 'reviews'})
          </span>
        </div>
      )}
      <div className="mt-4">{actionButtons}</div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[color:var(--app-text-soft)]">
        <Link href="/search" className={detailTextLinkClass}>
          {locale === 'id' ? 'Kembali ke search' : 'Back to search'}
        </Link>
        {isOwner && (
          <Link href="/my-listings" className={detailTextLinkClass}>
            {locale === 'id' ? 'Kelola listing' : 'Manage listings'}
          </Link>
        )}
      </div>
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
      {!PROMO_ONLY_MODE && user && !isOwner && displayType !== 'company' && (
        <div className={`mt-3 ${detailInsetClass}`}>
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
                {locale === 'id' ? 'Belum ada transaksi' : 'No transaction yet'}
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
      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
            {locale === 'id' ? 'Langkah cepat' : 'Quick steps'}
          </p>
          <span className="text-[11px] font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            {flowOverviewDescription}
          </span>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {flowSteps.map((step, index) => (
            <div key={`${step}-${index}`} className={detailInsetCompactClass}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[10px] font-semibold text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_40%,_transparent)] dark:text-[color:var(--app-accent)]">
                  {index + 1}
                </span>
                <p className="text-[11px] font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {step}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const mobileActionCard = null;

  const typeLabel = ct
    ? getContentTypeName(ct, locale)
    : humanizeToken(displayType);
  const locationLabel =
    quickSpecs.find(spec => spec.key === 'location')?.value ||
    readMetaText(meta, 'location', 'city', 'region', 'address') ||
    (locale === 'id' ? 'Indonesia' : 'Indonesia');
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
  const detailVisual =
    displayType === 'property'
      ? {
          chip: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-500/12 dark:text-rose-200 dark:ring-rose-400/20',
          icon: 'bg-rose-50 text-rose-600 dark:bg-rose-500/12 dark:text-rose-300',
          line: 'from-rose-500 via-orange-400 to-emerald-500',
          wash: 'bg-[linear-gradient(135deg,rgba(255,241,242,0.86),rgba(255,255,255,0.96)_48%,rgba(240,253,244,0.72))] dark:bg-[linear-gradient(135deg,rgba(76,5,25,0.28),rgba(2,6,23,0.96)_54%,rgba(6,78,59,0.2))]',
          eyebrow: locale === 'id' ? 'Detail properti' : 'Property detail',
        }
      : displayType === 'service' || displayType === 'profile'
        ? {
            chip: 'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-500/12 dark:text-teal-200 dark:ring-teal-400/20',
            icon: 'bg-teal-50 text-teal-700 dark:bg-teal-500/12 dark:text-teal-300',
            line: 'from-teal-500 via-emerald-400 to-emerald-500',
            wash: 'bg-[linear-gradient(135deg,rgba(240,249,255,0.9),rgba(255,255,255,0.97)_48%,rgba(236,253,245,0.76))] dark:bg-[linear-gradient(135deg,rgba(8,47,73,0.34),rgba(2,6,23,0.96)_54%,rgba(6,78,59,0.2))]',
            eyebrow:
              displayType === 'profile'
                ? locale === 'id'
                  ? 'Detail profil'
                  : 'Profile detail'
                : locale === 'id'
                  ? 'Detail layanan'
                  : 'Service detail',
          }
        : displayType === 'job'
          ? {
              chip: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/12 dark:text-amber-200 dark:ring-amber-400/20',
              icon: 'bg-amber-50 text-amber-600 dark:bg-amber-500/12 dark:text-amber-300',
              line: 'from-amber-500 via-orange-400 to-emerald-500',
              wash: 'bg-[linear-gradient(135deg,rgba(255,251,235,0.9),rgba(255,255,255,0.97)_48%,rgba(240,253,244,0.74))] dark:bg-[linear-gradient(135deg,rgba(69,26,3,0.3),rgba(2,6,23,0.96)_54%,rgba(6,78,59,0.2))]',
              eyebrow: locale === 'id' ? 'Detail lowongan' : 'Job detail',
            }
          : displayType === 'tool_rental'
            ? {
                chip: 'bg-lime-50 text-lime-800 ring-lime-100 dark:bg-lime-500/12 dark:text-lime-200 dark:ring-lime-400/20',
                icon: 'bg-lime-50 text-lime-700 dark:bg-lime-500/12 dark:text-lime-300',
                line: 'from-lime-500 via-emerald-400 to-emerald-500',
                wash: 'bg-[linear-gradient(135deg,rgba(238,242,255,0.9),rgba(255,255,255,0.97)_48%,rgba(236,253,245,0.74))] dark:bg-[linear-gradient(135deg,rgba(49,46,129,0.32),rgba(2,6,23,0.96)_54%,rgba(6,78,59,0.2))]',
                eyebrow: locale === 'id' ? 'Detail sewa alat' : 'Rental detail',
              }
            : {
                chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/12 dark:text-emerald-200 dark:ring-emerald-400/20',
                icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300',
                line: 'from-emerald-500 via-teal-400 to-lime-500',
                wash: 'bg-[linear-gradient(135deg,rgba(236,253,245,0.9),rgba(255,255,255,0.97)_48%,rgba(240,249,255,0.74))] dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.28),rgba(2,6,23,0.96)_54%,rgba(8,47,73,0.2))]',
                eyebrow:
                  displayType === 'company'
                    ? locale === 'id'
                      ? 'Detail perusahaan'
                      : 'Company detail'
                    : locale === 'id'
                      ? 'Detail item'
                      : 'Item detail',
              };
  const detailSurfaceClass = `overflow-hidden rounded-[18px] border shadow-[0_16px_34px_-32px_rgba(15,23,42,0.28)] ring-1 sm:rounded-[22px] ${detailTone.surface}`;
  const reviewBuckets = [5, 4, 3, 2, 1].map(score => ({
    score,
    count: reviews.filter(review => Math.round(review.rating) === score).length,
  }));
  const reviewBucketTotal = Math.max(1, reviews.length);

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
        <section className="ui-page-section w-full px-0">
          <div className="mx-auto flex w-full flex-col gap-2.5">
            <div className="hidden items-center justify-between gap-3 px-1 text-xs text-[color:var(--app-text-soft)] lg:flex">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[color:var(--app-text)] ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-950 dark:text-[color:var(--app-text-soft)] dark:ring-slate-800"
                  aria-label={locale === 'id' ? 'Kembali' : 'Back'}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <Link
                  href="/search"
                  className="font-semibold text-[color:var(--app-text)]"
                >
                  {locale === 'id' ? 'Search' : 'Search'}
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

            <div className="grid min-w-0 gap-2.5 sm:gap-3 lg:grid-cols-12 lg:items-start xl:gap-4">
              <section
                className={`${detailSurfaceClass} p-1 lg:col-span-7 lg:col-start-1 lg:row-start-1 xl:col-span-8`}
              >
                <div className="relative overflow-hidden rounded-[16px] bg-slate-100 dark:bg-slate-900 sm:rounded-[18px]">
                  <MediaPreviewCarousel
                    items={images}
                    alt={item.title}
                    aspectClassName="aspect-[4/3] w-full min-[480px]:aspect-[16/10] sm:aspect-[16/9] lg:aspect-[4/3] xl:aspect-[16/10]"
                    sizes="(min-width: 1280px) 820px, (min-width: 1024px) 58vw, 100vw"
                    priority
                    controls
                    lightbox
                    overlay={
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-slate-950/68 via-slate-950/12 to-transparent p-2.5 text-white sm:p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {PROMO_ONLY_MODE
                              ? locale === 'id'
                                ? 'Siap ditanya'
                                : 'Ready to ask'
                              : locale === 'id'
                                ? 'Terverifikasi'
                                : 'Verified'}
                          </span>
                          <span className="rounded-full bg-white/18 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
                            {listingSideContextLabel}
                          </span>
                        </div>
                      </div>
                    }
                  />
                </div>
              </section>

              <section
                className={`${detailSurfaceClass} ${detailVisual.wash} p-3 sm:p-3.5 lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:self-start xl:col-span-4 xl:col-start-9`}
              >
                <div
                  className={`h-1 w-20 rounded-full bg-gradient-to-r ${detailVisual.line}`}
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${detailVisual.chip}`}
                  >
                    <TypeIcon className="h-3.5 w-3.5" />
                    {detailVisual.eyebrow}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusBadgeClass}`}
                  >
                    {statusLabel}
                  </span>
                  {ct ? (
                    <span className="rounded-full bg-white/82 px-2.5 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200/70 dark:bg-slate-950/70 dark:text-slate-200 dark:ring-slate-800">
                      {typeLabel}
                    </span>
                  ) : null}
                </div>

                <h1 className="mt-2.5 line-clamp-3 break-words text-[20px] font-black leading-[1.08] tracking-[-0.035em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[25px] lg:text-[23px] xl:text-[26px]">
                  {item.title}
                </h1>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {ratingValue > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1.5 font-semibold text-amber-700 dark:bg-amber-500/12 dark:text-amber-200">
                      <Star className="h-3.5 w-3.5 fill-[color:var(--app-warning)] text-[color:var(--app-warning)]" />
                      {ratingValue.toFixed(1)}
                      <span className="font-medium text-amber-700/80 dark:text-amber-100/80">
                        ({item.review_count || 0})
                      </span>
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/78 px-2.5 py-1.5 font-semibold ring-1 ring-slate-200/70 dark:bg-slate-950/70 dark:ring-slate-800">
                    <MapPin className="h-3.5 w-3.5" />
                    {locationLabel}
                  </span>
                  {updatedLabel ? (
                    <span className="hidden items-center gap-1.5 rounded-full bg-white/78 px-2.5 py-1.5 font-semibold ring-1 ring-slate-200/70 dark:bg-slate-950/70 dark:ring-slate-800 sm:inline-flex">
                      <Calendar className="h-3.5 w-3.5" />
                      {locale === 'id' ? 'Update' : 'Updated'} {updatedLabel}
                    </span>
                  ) : null}
                </div>

                <div className="mt-2.5 rounded-[16px] bg-white/82 p-2.5 ring-1 ring-slate-200/70 dark:bg-slate-950/72 dark:ring-slate-800 sm:p-3">
                  <div className="flex flex-col gap-2.5 min-[520px]:flex-row min-[520px]:items-end min-[520px]:justify-between lg:flex-col lg:items-stretch xl:flex-row xl:items-end">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ${detailVisual.icon}`}
                      >
                        {PROMO_ONLY_MODE ? (
                          <MessageCircle className="h-4.5 w-4.5" />
                        ) : (
                          <Coins className="h-4.5 w-4.5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                          {displayPriceHeading}
                        </p>
                        <p className="mt-1 text-[22px] font-black leading-none text-[color:var(--app-accent)] sm:text-[25px] lg:text-[22px] xl:text-[25px]">
                          {primaryPrice}
                        </p>
                        {hasOriginalPrice ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-[color:var(--app-text-soft)] line-through">
                              {formatCurrency(
                                displayOriginalPriceCents as number,
                                item.currency || 'IDR',
                              )}
                            </span>
                            <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600 dark:bg-red-500/12 dark:text-red-300">
                              -{discountPercent}%
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 min-[520px]:items-end lg:items-stretch xl:items-end">
                      <span
                        className={`inline-flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${detailVisual.chip}`}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {primaryActionHint}
                      </span>
                      {!isOwner ? (
                        <button
                          type="button"
                          onClick={() => void handleStartChat()}
                          disabled={!peerUserId || chatStarting}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-sm font-black text-white shadow-[0_18px_34px_-24px_color-mix(in_srgb,var(--app-accent)_60%,transparent)] transition hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {chatStarting
                            ? locale === 'id'
                              ? 'Membuka chat...'
                              : 'Opening chat...'
                            : chatLabel}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {heroSummaryCard}

                {PROMO_ONLY_MODE && !isOwner ? (
                  <div className="mt-2.5 hidden rounded-[16px] bg-white/86 p-2.5 ring-1 ring-emerald-100/80 dark:bg-slate-950/72 dark:ring-emerald-400/20 lg:block">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                          {locale === 'id'
                            ? 'Mulai lewat chat'
                            : 'Start with chat'}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                          {locale === 'id'
                            ? 'Tanya stok, katalog, MOQ, area kirim, atau detail kebutuhan tanpa transaksi dulu.'
                            : 'Ask about stock, catalog, MOQ, delivery area, or needs before any transaction.'}
                        </p>
                      </div>
                      <span
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] ${detailVisual.icon}`}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-2">{actionButtons}</div>
                    <div className="mt-2 grid gap-1.5 xl:grid-cols-2">
                      {flowSteps.slice(0, 4).map((step, index) => (
                        <div
                          key={`promo-step-${step}-${index}`}
                          className="flex items-start gap-2 rounded-[13px] bg-emerald-50/78 px-2.5 py-2 text-[11px] font-semibold leading-4 text-emerald-900 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-400/20"
                        >
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:gap-2">
                  {quickSpecs.slice(0, 4).map(spec => {
                    const SpecIcon = spec.icon;
                    return (
                      <div
                        key={spec.key}
                        className="min-w-0 rounded-[14px] bg-white/78 p-2 ring-1 ring-slate-200/70 dark:bg-slate-950/66 dark:ring-slate-800 sm:p-2.5"
                      >
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-[11px] ${detailVisual.icon} sm:h-8 sm:w-8 sm:rounded-xl`}
                        >
                          <SpecIcon className="h-3.5 w-3.5" />
                        </span>
                        <p className="mt-1.5 truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)] sm:text-[10px] sm:tracking-[0.18em]">
                          {spec.label}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-4 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:mt-1 sm:text-sm">
                          {spec.value}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {displayType === 'service' &&
                serviceGuideSections.length > 0 ? (
                  <div className="mt-2.5 overflow-hidden rounded-[16px] bg-white/74 ring-1 ring-slate-200/70 dark:bg-slate-950/64 dark:ring-slate-800">
                    {serviceGuideSections.slice(0, 2).map((section, index) => {
                      const SectionIcon = section.icon;
                      return (
                        <div
                          key={section.key}
                          className={`flex gap-2.5 p-2.5 sm:gap-3 sm:p-3 ${
                            index > 0
                              ? 'border-t border-slate-200/70 dark:border-slate-800'
                              : ''
                          }`}
                        >
                          <span
                            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] ${detailVisual.icon}`}
                          >
                            <SectionIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                              {section.eyebrow}
                            </p>
                            <h3 className="mt-0.5 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                              {section.title}
                            </h3>
                            <p className="mt-1 text-sm leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:leading-6">
                              {section.value}
                            </p>
                            {section.description ? (
                              <p className="mt-1 text-sm leading-5 text-[color:var(--app-text-soft)] sm:leading-6">
                                {section.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {previewHighlightItems.length > 0 ? (
                  <div
                    className={`mt-2.5 grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2 ${PROMO_ONLY_MODE ? 'hidden sm:grid' : 'grid'}`}
                  >
                    {previewHighlightItems.map(entry => {
                      const EntryIcon = getDetailEntryIcon(
                        entry.key,
                        entry.label,
                      );
                      return (
                        <div
                          key={entry.key}
                          className="min-w-0 rounded-[14px] bg-white/72 px-2.5 py-2 ring-1 ring-slate-200/70 dark:bg-slate-950/62 dark:ring-slate-800 sm:rounded-[16px] sm:px-3"
                        >
                          <div className="flex items-start gap-2.5">
                            <span
                              className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[12px] ${detailVisual.icon}`}
                            >
                              <EntryIcon className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)] sm:text-[10px] sm:tracking-[0.18em]">
                                {entry.label}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:text-sm">
                                {entry.value}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {previewTags.length > 0 ? (
                  <div
                    className={`mt-3 flex-wrap gap-1.5 ${PROMO_ONLY_MODE ? 'hidden sm:flex' : 'flex'}`}
                  >
                    {previewTags.map(tag => (
                      <span
                        key={tag}
                        className="rounded-full bg-white/82 px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200/70 dark:bg-slate-950/72 dark:text-slate-200 dark:ring-slate-800"
                      >
                        {tag}
                      </span>
                    ))}
                    {extraTagCount > 0 ? (
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${detailVisual.chip}`}
                      >
                        +{extraTagCount}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <div className="grid gap-2.5 lg:hidden">
                {mobileActionCard}
                {ownerProfileCard}
              </div>

              <aside className="hidden lg:col-span-4 lg:col-start-9 lg:row-start-2 lg:block">
                <div className="sticky top-[calc(4.75rem+env(safe-area-inset-top))] space-y-2.5">
                  {!PROMO_ONLY_MODE ? actionCard : null}
                  {ownerProfileCard}
                  <section className={`${detailSurfaceClass} p-3.5`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                        {locale === 'id' ? 'Info cepat' : 'Quick info'}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${detailVisual.chip}`}
                      >
                        {listingSideLabel}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                      {[
                        locationLabel
                          ? `${locale === 'id' ? 'Lokasi' : 'Location'}: ${locationLabel}`
                          : '',
                        updatedLabel
                          ? `${locale === 'id' ? 'Diperbarui' : 'Updated'}: ${updatedLabel}`
                          : '',
                        createdLabel
                          ? `${locale === 'id' ? 'Dibuat' : 'Created'}: ${createdLabel}`
                          : '',
                        images.length
                          ? `${images.length} ${locale === 'id' ? 'foto' : 'images'}`
                          : '',
                        documents.length
                          ? `${documents.length} ${locale === 'id' ? 'dokumen' : 'documents'}`
                          : '',
                      ]
                        .filter(Boolean)
                        .map(label => (
                          <div
                            key={label}
                            className={`flex items-center gap-2 rounded-[14px] px-3 py-2 ring-1 ${detailTone.row}`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
                            <span>{label}</span>
                          </div>
                        ))}
                    </div>
                  </section>
                </div>
              </aside>

              <div className="min-w-0 space-y-2.5 lg:col-span-8 lg:col-start-1 lg:row-start-2">
                <section className={`${detailSurfaceClass} p-3 sm:p-3.5`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                        {detailHeading}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-xl">
                        {PROMO_ONLY_MODE
                          ? locale === 'id'
                            ? 'Ringkasan promosi'
                            : 'Promo summary'
                          : locale === 'id'
                            ? 'Informasi lengkap'
                            : 'Full information'}
                      </h2>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${detailVisual.chip}`}
                    >
                      {highlightHeading}
                    </span>
                  </div>

                  {item.body ? (
                    <div className="mt-2.5 rounded-[16px] bg-white/68 p-2.5 ring-1 ring-slate-200/70 dark:bg-slate-950/58 dark:ring-slate-800 sm:p-3">
                      <div className="flex items-start gap-2.5 sm:gap-3">
                        <span
                          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] ${detailVisual.icon}`}
                        >
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                            {locale === 'id' ? 'Ringkasan' : 'Summary'}
                          </p>
                          <h3 className="mt-0.5 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                            {displayType === 'service'
                              ? locale === 'id'
                                ? 'Ringkasan Layanan'
                                : 'Service Summary'
                              : highlightHeading}
                          </h3>
                          {PROMO_ONLY_MODE ? (
                            <>
                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                {summaryPreview || bodyPreview || item.body}
                              </p>
                              <details className="group mt-2">
                                <summary className="cursor-pointer list-none text-xs font-black text-[color:var(--app-accent)] transition hover:text-[color:var(--app-accent-strong)]">
                                  {locale === 'id'
                                    ? 'Lihat detail lengkap'
                                    : 'View full details'}
                                </summary>
                                <div className="prose prose-sm mt-2 max-w-none whitespace-pre-line leading-6 text-[color:var(--app-text)] dark:prose-invert dark:text-[color:var(--app-text-soft)]">
                                  {item.body}
                                </div>
                              </details>
                            </>
                          ) : (
                            <div className="prose prose-sm mt-2 max-w-none whitespace-pre-line leading-6 text-[color:var(--app-text)] dark:prose-invert dark:text-[color:var(--app-text-soft)]">
                              {item.body}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {visibleExpandedDetailItems.length > 0 ? (
                    displayType === 'service' ? (
                      <div className="mt-3 overflow-hidden rounded-[16px] bg-white/66 ring-1 ring-slate-200/70 dark:bg-slate-950/58 dark:ring-slate-800">
                        {visibleExpandedDetailItems.map((entry, index) => {
                          const DetailIcon = getDetailEntryIcon(
                            entry.key,
                            entry.label,
                          );
                          return (
                            <div
                              key={entry.key}
                              className={`flex items-start gap-2.5 p-2.5 sm:gap-3 sm:p-3 ${
                                index > 0
                                  ? 'border-t border-slate-200/70 dark:border-slate-800'
                                  : ''
                              }`}
                            >
                              <span
                                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] ${detailVisual.icon}`}
                              >
                                <DetailIcon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                                  {entry.label}
                                </p>
                                <p className="mt-1 text-sm font-semibold leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                  {entry.value}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-3 grid grid-cols-1 gap-1.5 min-[560px]:grid-cols-2 sm:gap-2.5 xl:grid-cols-2">
                        {visibleExpandedDetailItems.map(entry => {
                          const DetailIcon = getDetailEntryIcon(
                            entry.key,
                            entry.label,
                          );
                          return (
                            <div
                              key={entry.key}
                              className={detailInsetCompactClass}
                            >
                              <div className="flex items-start gap-2.5">
                                <span
                                  className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[13px] ${detailVisual.icon}`}
                                >
                                  <DetailIcon className="h-3.5 w-3.5" />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)] sm:text-[10px] sm:tracking-[0.18em]">
                                    {entry.label}
                                  </p>
                                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:text-sm">
                                    {entry.value}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : null}
                  {hiddenExpandedDetailCount > 0 ? (
                    <p className="mt-2 text-xs font-semibold text-[color:var(--app-text-soft)]">
                      {locale === 'id'
                        ? `+${hiddenExpandedDetailCount} info lain bisa ditanyakan lewat chat.`
                        : `+${hiddenExpandedDetailCount} more details can be asked in chat.`}
                    </p>
                  ) : null}

                  {detailTags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {detailTags.map(tag => (
                        <span
                          key={tag}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${detailVisual.chip}`}
                        >
                          {tag}
                        </span>
                      ))}
                      {hiddenDetailTagCount > 0 ? (
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${detailVisual.chip}`}
                        >
                          +{hiddenDetailTagCount}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </section>

                {reviewsLoading || reviews.length > 0 || ratingValue > 0 ? (
                  <section className={`${detailSurfaceClass} p-3 sm:p-3.5`}>
                    <div className="grid gap-3 md:grid-cols-[170px_minmax(0,1fr)]">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                          {locale === 'id'
                            ? 'Ulasan pelanggan'
                            : 'Customer reviews'}
                        </p>
                        <div className="mt-3 flex items-end gap-2">
                          <span className="text-3xl font-semibold leading-none text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                            {ratingValue > 0 ? ratingValue.toFixed(1) : '0.0'}
                          </span>
                          <div className="pb-1">
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={`reviews-summary-${i}`}
                                  className={`h-3.5 w-3.5 ${
                                    i < ratingRounded
                                      ? 'fill-[color:var(--app-warning)] text-[color:var(--app-warning)]'
                                      : 'text-[color:var(--app-text-soft)] dark:text-[color:var(--app-text)]'
                                  }`}
                                />
                              ))}
                            </div>
                            <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                              {item.review_count || reviews.length}{' '}
                              {locale === 'id' ? 'review' : 'reviews'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 space-y-1.5">
                          {reviewBuckets.map(bucket => (
                            <div
                              key={bucket.score}
                              className="flex items-center gap-2 text-[11px] text-[color:var(--app-text-soft)]"
                            >
                              <span className="w-3">{bucket.score}</span>
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
                                <div
                                  className="h-full rounded-full bg-[color:var(--app-accent)]"
                                  style={{
                                    width: `${(bucket.count / reviewBucketTotal) * 100}%`,
                                  }}
                                />
                              </div>
                              <span className="w-5 text-right">
                                {bucket.count}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {reviewsLoading ? (
                          <div
                            className={`${detailInsetClass} text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]`}
                          >
                            {locale === 'id'
                              ? 'Memuat ulasan...'
                              : 'Loading reviews...'}
                          </div>
                        ) : (
                          reviews.slice(0, 4).map(review => (
                            <div
                              key={review.id}
                              className={`rounded-[18px] p-3 text-sm text-[color:var(--app-text)] ring-1 dark:text-[color:var(--app-text-soft)] ${detailTone.row}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={`review-${review.id}-star-${i}`}
                                      className={`h-3.5 w-3.5 ${
                                        i < review.rating
                                          ? 'fill-[color:var(--app-warning)] text-[color:var(--app-warning)]'
                                          : 'text-[color:var(--app-text-soft)] dark:text-[color:var(--app-text)]'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-[11px] text-[color:var(--app-text-soft)]">
                                  {formatDate(review.created_at || '')}
                                </span>
                              </div>
                              <p className="mt-2 leading-6">
                                {review.comment ||
                                  (locale === 'id'
                                    ? 'Tanpa komentar.'
                                    : 'No comment provided.')}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </section>
                ) : null}

                {!PROMO_ONLY_MODE && showSellerStats ? (
                  <section
                    className={`${detailSurfaceClass} p-3.5 sm:p-4 lg:hidden`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                      {locale === 'id' ? 'Kepercayaan penjual' : 'Seller trust'}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {[
                        {
                          label:
                            locale === 'id'
                              ? 'Rating penjual'
                              : 'Seller rating',
                          value:
                            sellerRating > 0 ? sellerRating.toFixed(1) : '0.0',
                        },
                        {
                          label:
                            locale === 'id'
                              ? 'Transaksi selesai'
                              : 'Completed deals',
                          value: `${sellerCompletedTransactions}/${sellerTotalTransactions}`,
                        },
                        {
                          label:
                            locale === 'id'
                              ? 'Acceptance rate'
                              : 'Acceptance rate',
                          value: formatPercent(sellerAcceptanceRate),
                        },
                      ].map(stat => (
                        <div key={stat.label} className={detailInsetClass}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                            {stat.label}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                            {stat.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {documents.length > 0 ? (
                  <section className={`${detailSurfaceClass} p-3.5 sm:p-4`}>
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
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
                          className={`group flex items-center justify-between gap-3 rounded-[18px] px-3 py-2.5 text-sm ring-1 transition ${detailTone.row}`}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
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
            </div>
          </div>
        </section>

        <div
          className="fixed inset-x-0 bottom-0 z-40 px-2 pt-2 lg:hidden"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
        >
          <div className="mx-auto max-w-md rounded-[20px] border border-slate-200/80 bg-white/96 p-1.5 shadow-[0_18px_44px_-26px_rgba(15,23,42,0.36)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/94">
            {actionButtons}
          </div>
        </div>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_50%,_transparent)] p-3">
          <div className="max-h-[80svh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white/98 p-5 shadow-[0_28px_56px_-32px_rgba(15,23,42,0.32)] dark:bg-slate-950/96 dark:shadow-[0_32px_60px_-36px_rgba(2,6,23,0.8)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-warning)]">
                  {locale === 'id' ? 'Report listing' : 'Report listing'}
                </p>
                <h2 className="text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {item.title}
                </h2>
                <p className="text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {locale === 'id'
                    ? 'Laporan ini akan masuk ke CRM moderation queue dan bisa ditinjau oleh tim.'
                    : 'This report will enter the CRM moderation queue for review by the team.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="rounded-full bg-slate-100 p-2 text-[color:var(--app-text)] transition hover:bg-slate-200 dark:bg-slate-900 dark:text-[color:var(--app-text-soft)] dark:hover:bg-slate-800"
                aria-label={locale === 'id' ? 'Tutup' : 'Close'}
              >
                X
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)]">
                  {locale === 'id' ? 'Alasan' : 'Reason'}
                </label>
                <select
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-warning-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-warning)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-inverse)]"
                >
                  <option value="spam">{locale === 'id' ? 'Spam / promosi' : 'Spam / promotion'}</option>
                  <option value="fake">{locale === 'id' ? 'Palsu / tidak asli' : 'Fake / not genuine'}</option>
                  <option value="scam">{locale === 'id' ? 'Penipuan' : 'Scam'}</option>
                  <option value="harassment">{locale === 'id' ? 'Pelecehan' : 'Harassment'}</option>
                  <option value="illegal">{locale === 'id' ? 'Konten ilegal' : 'Illegal content'}</option>
                  <option value="inaccurate">{locale === 'id' ? 'Informasi tidak akurat' : 'Inaccurate info'}</option>
                  <option value="other">{locale === 'id' ? 'Lainnya' : 'Other'}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)]">
                  {locale === 'id' ? 'Detail tambahan' : 'Extra details'}
                </label>
                <textarea
                  rows={4}
                  value={reportDetails}
                  onChange={e => setReportDetails(e.target.value)}
                  placeholder={
                    locale === 'id'
                      ? 'Contoh: foto bukan milik listing, jam salah, nomor tidak aktif.'
                      : 'Example: unrelated photo, wrong hours, inactive number.'
                  }
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm focus:border-[color:var(--app-warning-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-warning)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-inverse)]"
                />
              </div>
            </div>

            <div className="rounded-xl bg-[color:color-mix(in_srgb,_var(--app-warning-soft)_35%,_white)] px-3 py-2 text-[11px] leading-5 text-[color:var(--app-text)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_12%,_rgba(2,6,23,0.94))] dark:text-[color:var(--app-text-soft)]">
              {locale === 'id'
                ? 'Setelah terkirim, laporan masuk ke queue CRM moderation. Tim bisa lihat alasan, detail, siapa yang report, lalu pilih warn, flag, restrict, atau ban bila berulang.'
                : 'After submission, the report enters the CRM moderation queue. The team can review reasons, details, reporters, then choose warn, flag, restrict, or ban if abuse repeats.'}
            </div>

            {reportError ? (
              <p className="mt-3 text-xs font-semibold text-[color:var(--app-danger)]">
                {reportError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="rounded-full border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] hover:border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
              >
                {locale === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void submitListingReport()}
                disabled={reportSubmitting}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[color:var(--app-warning)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-warning)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reportSubmitting
                  ? locale === 'id'
                    ? 'Mengirim...'
                    : 'Sending...'
                  : locale === 'id'
                    ? 'Kirim report'
                    : 'Submit report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_50%,_transparent)] p-3">
          <div className="max-h-[80svh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white/98 p-5 shadow-[0_28px_56px_-32px_rgba(15,23,42,0.32)] dark:bg-slate-950/96 dark:shadow-[0_32px_60px_-36px_rgba(2,6,23,0.8)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-info)]">
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
                className="rounded-full bg-slate-100 p-2 text-[color:var(--app-text)] transition hover:bg-slate-200 dark:bg-slate-900 dark:text-[color:var(--app-text-soft)] dark:hover:bg-slate-800"
                aria-label={locale === 'id' ? 'Tutup' : 'Close'}
              >
                X
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
                  className="h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-info-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-info)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-inverse)] dark:focus:ring-[color:color-mix(in_srgb,_var(--app-info)_40%,_transparent)]"
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
                  className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm focus:border-[color:var(--app-info-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-info)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-inverse)] dark:focus:ring-[color:color-mix(in_srgb,_var(--app-info)_40%,_transparent)]"
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
                className="rounded-full border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] hover:border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
              >
                {locale === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button
                onClick={handleShareListingToRoom}
                disabled={shareSubmitting || !shareRoomId}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[color:var(--app-info)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-info)] disabled:cursor-not-allowed disabled:opacity-50"
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

      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_50%,_transparent)] p-3">
          <div className="max-h-[80svh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white/98 p-5 shadow-[0_28px_56px_-32px_rgba(15,23,42,0.32)] dark:bg-slate-950/96 dark:shadow-[0_32px_60px_-36px_rgba(2,6,23,0.8)]">
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
                className="rounded-full bg-slate-100 p-2 text-[color:var(--app-text)] transition hover:bg-slate-200 dark:bg-slate-900 dark:text-[color:var(--app-text-soft)] dark:hover:bg-slate-800"
                aria-label={locale === 'id' ? 'Tutup' : 'Close'}
              >
                X
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
                className="rounded-full border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] hover:border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
              >
                {locale === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button
                onClick={() => handleApplySubmit(false)}
                disabled={applySubmitting}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="max-h-[80svh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white/98 p-5 shadow-[0_28px_56px_-32px_rgba(15,23,42,0.32)] dark:bg-slate-950/96 dark:shadow-[0_32px_60px_-36px_rgba(2,6,23,0.8)]">
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
                className="rounded-full bg-slate-100 p-2 text-[color:var(--app-text)] transition hover:bg-slate-200 dark:bg-slate-900 dark:text-[color:var(--app-text-soft)] dark:hover:bg-slate-800"
                aria-label={locale === 'id' ? 'Tutup' : 'Close'}
              >
                X
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
                      className="rounded-[24px] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_48%,white)] p-4 text-left transition hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_62%,white)] dark:bg-[color:color-mix(in_srgb,var(--app-accent)_20%,rgba(15,23,42,0.96))]"
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
                      className="rounded-[24px] bg-[color:color-mix(in_srgb,var(--app-info-soft)_56%,white)] p-4 text-left transition hover:bg-[color:color-mix(in_srgb,var(--app-info-soft)_72%,white)] dark:bg-[color:color-mix(in_srgb,var(--app-info)_18%,rgba(15,23,42,0.96))]"
                    >
                      <p className="text-xs font-bold text-[color:var(--app-info)]">
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
                    className="w-full rounded-[22px] bg-slate-100 px-4 py-3 text-left text-xs font-semibold text-[color:var(--app-text)] transition hover:bg-slate-200 dark:bg-slate-900 dark:text-[color:var(--app-text-soft)] dark:hover:bg-slate-800"
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
                      className="rounded-[24px] bg-[color:color-mix(in_srgb,var(--app-info-soft)_56%,white)] p-4 text-left transition hover:bg-[color:color-mix(in_srgb,var(--app-info-soft)_72%,white)] dark:bg-[color:color-mix(in_srgb,var(--app-info)_18%,rgba(15,23,42,0.96))]"
                    >
                      <p className="text-xs font-bold text-[color:var(--app-info)]">
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
                      className="rounded-[24px] bg-slate-100 p-4 text-left transition hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800"
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
                        className="rounded-[24px] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_48%,white)] p-4 text-left transition hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_62%,white)] dark:bg-[color:color-mix(in_srgb,var(--app-accent)_20%,rgba(15,23,42,0.96))]"
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
                      className="rounded-[24px] bg-[color:color-mix(in_srgb,var(--app-info-soft)_56%,white)] p-4 text-left transition hover:bg-[color:color-mix(in_srgb,var(--app-info-soft)_72%,white)] dark:bg-[color:color-mix(in_srgb,var(--app-info)_18%,rgba(15,23,42,0.96))]"
                    >
                      <p className="text-xs font-bold text-[color:var(--app-info)]">
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
                    className="w-full rounded-[22px] bg-slate-100 px-4 py-3 text-left text-xs font-semibold text-[color:var(--app-text)] transition hover:bg-slate-200 dark:bg-slate-900 dark:text-[color:var(--app-text-soft)] dark:hover:bg-slate-800"
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
          router.push(
            shouldOpenPhoneVerification
              ? PHONE_VERIFICATION_SETTINGS_PATH
              : '/profile/edit',
          );
        }}
        onOpenProfile={() => {
          setVerificationPrompt(null);
          router.push('/profile');
        }}
      />

      <Modal
        open={Boolean(createdDealHandoff)}
        title={
          locale === 'id' ? 'Order siap dilanjutkan' : 'Your order is ready'
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
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
              >
                {createdDealHandoff.flowMode === 'direct'
                  ? locale === 'id'
                    ? 'Bayar aman sekarang'
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
                className="inline-flex flex-1 items-center justify-center rounded-full border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
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
                {locale === 'id' ? 'Ringkasan order' : 'Order summary'}
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
                    {formatCurrency(
                      createdDealHandoff.amountCents,
                      createdDealHandoff.currency,
                    )}
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

            <div className="rounded-[20px] bg-[color:color-mix(in_srgb,var(--app-info-soft)_62%,white)] p-3 text-xs text-[color:var(--app-text)] dark:bg-[color:color-mix(in_srgb,var(--app-info)_18%,rgba(15,23,42,0.96))]">
              {createdDealHandoff.flowMode === 'direct'
                ? locale === 'id'
                  ? 'Lanjut ke order biar pembayaran aman.'
                  : 'For direct purchases, continue to the order workspace so the buyer can pay safely on-platform before work or delivery starts.'
                : locale === 'id'
                  ? 'Pantau status di order. Detail tetap lanjut di chat.'
                  : 'For offer-based deals, use the order workspace to track status, then continue technical discussion in chat without losing the transaction trail.'}
            </div>
          </div>
        ) : null}
      </Modal>

      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_50%,_transparent)] p-3">
          <div className="max-h-[80svh] w-full max-w-md overflow-y-auto rounded-[28px] bg-white/98 p-5 shadow-[0_28px_56px_-32px_rgba(15,23,42,0.32)] dark:bg-slate-950/96 dark:shadow-[0_32px_60px_-36px_rgba(2,6,23,0.8)]">
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
                className="rounded-full bg-slate-100 p-2 text-[color:var(--app-text)] transition hover:bg-slate-200 dark:bg-slate-900 dark:text-[color:var(--app-text-soft)] dark:hover:bg-slate-800"
                aria-label={locale === 'id' ? 'Tutup' : 'Close'}
              >
                X
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
                  {locale === 'id' ? 'Pesan (Opsional)' : 'Message (Optional)'}
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
                disabled={submitting || !offerAmount.trim()}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
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
