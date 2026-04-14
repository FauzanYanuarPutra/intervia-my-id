'use client';

import { useEffect, useState } from 'react';
import NextImage from 'next/image';
import { Link, useRouter } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import {
  BadgePercent,
  Building2,
  Briefcase,
  Calendar,
  Clock3,
  FileText,
  Gift,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  Package,
  Share2,
  ShieldCheck,
  Star,
  Tag,
  Trophy,
  User,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getSectorLabel, useSectors } from '@/context/SectorContext';
import { findSubSector, getSubSectorName } from '@/data/subSectors';
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
  parseImages,
  type ContentOwnerProfile,
} from '@/lib/content/catalog';
import { buildContentHref, extractContentId } from '@/lib/content/routes';
import { createPromotionSnapshot } from '@/lib/content/promotionPrograms';
import { buildPublicProfileHref } from '@/lib/profile/publicProfileLink';
import ImageCarousel from '@/components/content/ImageCarousel';
import { Modal } from '@/components/common/Modal';
import { DetailAccordion } from '@/components/ui/DetailAccordion';
import { ContentDetailSkeleton } from '@/components/system/feedback/RouteSkeletons';
import { TransactionVerificationPromptModal } from '@/components/verification/TransactionVerificationPromptModal';
import { createIdempotencyKey } from '@/lib/clientIdempotency';
import {
  PHONE_VERIFICATION_SETTINGS_PATH,
  readTransactionVerification,
  type TransactionVerificationState,
} from '@/lib/identityVerification';

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
      ? 'Belum ada order. Mulai dari tombol aksi biar chat dan pembayaran rapi.'
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
      ? 'Lanjut ke workspace order untuk bayar aman dan simpan detail transaksi.'
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
    ? 'Buka workspace order untuk lihat langkah berikutnya dan status pembayaran.'
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
  return parseImages(item as Parameters<typeof parseImages>[0]);
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
    if (showApplyModal) setApplyError(null);
  }, [showApplyModal]);

  useEffect(() => {
    if (showOfferModal) setOfferError(null);
  }, [showOfferModal]);

  useEffect(() => {
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
    if (!resolvedContentId || !user) {
      setRelatedTx(null);
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
          ? 'Halo kak, saya mau lanjut sewa ini. Tolong info jadwal ready, deposit, dan cara ambilnya.'
          : 'Hi, I want to proceed with this rental. Please share the available schedule, deposit, and pickup details.'
        : displayType === 'property'
          ? locale === 'id'
            ? 'Halo kak, saya tertarik lanjut untuk lokasi ini. Tolong info langkah survey dan syarat dealnya.'
            : 'Hi, I want to proceed with this location. Please share the viewing steps and key deal terms.'
          : displayType === 'service' || displayType === 'profile'
            ? locale === 'id'
              ? 'Halo kak, saya mau lanjut deal jasa ini. Tolong kirim langkah mulai, timeline, dan detail kerja utamanya.'
              : 'Hi, I want to proceed with this service. Please share the start steps, timeline, and key work details.'
            : displayType === 'product'
              ? locale === 'id'
                ? 'Halo kak, saya mau lanjut order sesuai harga listing. Mohon info stok, ongkir, dan langkah bayarnya.'
                : 'Hi, I want to proceed at the listed price. Please confirm stock, delivery, and payment steps.'
              : locale === 'id'
                ? 'Halo kak, saya mau lanjut sesuai detail listing. Tolong kirim langkah berikutnya.'
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
                  ? 'Lanjutkan detail di chat agar scope, harga, dan timeline tersimpan rapi.'
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
              ? 'Offer berhasil dibuat, tapi room chat belum tersedia. Coba tekan tombol chat.'
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
              ? 'Transaksi belum bisa diproses sekarang. Coba lanjutkan chat atau ulangi lagi nanti.'
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
        value_cents: item?.price_cents,
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
      router.push(
        `/chat/${encodeURIComponent(roomId)}${
          chatDraft ? `?draft=${encodeURIComponent(chatDraft)}` : ''
        }`,
      );
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
        pricing_mode: pricingMode,
        price_cents:
          typeof item.price_cents === 'number' &&
          Number.isFinite(item.price_cents)
            ? item.price_cents
            : 0,
        original_price_cents:
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
        rating: typeof item.rating === 'number' ? item.rating : undefined,
        review_count:
          typeof item.review_count === 'number' ? item.review_count : undefined,
        identity_verified: Boolean(
          (item.seller_stats?.completion_rate || 0) > 0.5 ||
          (item.seller_stats?.total_transactions || 0) > 3,
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
              ? 'Recruiter bisa buka chat ini untuk review profil, CV, dan lanjut tanya detail.'
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
  const subSectorId = meta.sub_sector as string | undefined;
  const sectorObj = sectorId ? getSectorById(sectorId) : null;
  const sectorColorClass =
    sectorObj?.colorClass || 'bg-[color:var(--app-surface)]';
  const sectorColorStyle = sectorObj?.colorStyle;
  const subSectorObj =
    sectorId && subSectorId ? findSubSector(sectorId, subSectorId) : null;
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
    pricingMode === 'fixed' &&
    typeof item.price_cents === 'number' &&
    item.price_cents > 0;
  const hasOriginalPrice =
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
  const priceLabel = hasPrice
    ? formatCurrency(item.price_cents as number, item.currency || 'IDR')
    : locale === 'id'
      ? 'Harga menyesuaikan'
      : 'Price on request';
  const salaryRange =
    typeof meta.salary_range === 'string' ? meta.salary_range.trim() : '';
  const priceHeading =
    displayType === 'job'
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
    displayType === 'job'
      ? salaryRange ||
        (hasPrice ? priceLabel : locale === 'id' ? 'Nego' : 'Negotiable')
      : displayType === 'tool_rental'
        ? hasPrice
          ? priceLabel
          : locale === 'id'
            ? 'Tarif menyesuaikan'
            : 'Rate on request'
        : displayType === 'company'
          ? (typeof meta.industry_focus === 'string' && meta.industry_focus) ||
            (typeof meta.company_size === 'string' && meta.company_size) ||
            (locale === 'id' ? 'Profil publik' : 'Public profile')
          : priceLabel;
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
          ? 'Jelaskan tanggal pakai, durasi sewa, dan kebutuhan alat Anda.'
          : 'Share your rental date, duration, and asset needs.'
        : displayType === 'company'
          ? locale === 'id'
            ? 'Jelaskan konteks intro, kemitraan, atau kebutuhan percakapan Anda.'
            : 'Explain the intro context, partnership angle, or what you want to discuss.'
          : isDemandListing
            ? locale === 'id'
              ? 'Jelaskan bagaimana Anda bisa memenuhi kebutuhan listing ini.'
              : 'Explain how you can fulfill this listing need.'
            : displayType === 'service'
              ? locale === 'id'
                ? 'Jelaskan kebutuhan layanan dan budget Anda.'
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
          ? 'Tulis konteks intro, kebutuhan kemitraan, atau topik yang ingin dibahas...'
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
  const ratingValue = typeof item.rating === 'number' ? item.rating : 0;
  const ratingRounded = Math.round(ratingValue);
  const sellerStats = item.seller_stats || null;
  const sellerRating =
    typeof sellerStats?.rating === 'number' ? sellerStats.rating : 0;
  const sellerReviewCount =
    typeof sellerStats?.review_count === 'number'
      ? sellerStats.review_count
      : 0;
  const sellerTotalTransactions =
    typeof sellerStats?.total_transactions === 'number'
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
  const sellerCancelledTransactions =
    typeof sellerStats?.cancelled_transactions === 'number'
      ? sellerStats.cancelled_transactions
      : 0;
  const sellerPendingTransactions =
    typeof sellerStats?.pending_transactions === 'number'
      ? sellerStats.pending_transactions
      : 0;
  const sellerAcceptanceRate =
    typeof sellerStats?.acceptance_rate === 'number'
      ? sellerStats.acceptance_rate
      : sellerTotalTransactions > 0
        ? (sellerCompletedTransactions + sellerAcceptedTransactions) /
          sellerTotalTransactions
        : 0;
  const sellerCancelRate =
    typeof sellerStats?.cancel_rate === 'number'
      ? sellerStats.cancel_rate
      : sellerTotalTransactions > 0
        ? sellerCancelledTransactions / sellerTotalTransactions
        : 0;
  const sellerRatingRounded = Math.round(sellerRating);
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
  const hasReviews = reviews.length > 0 || (item.review_count ?? 0) > 0;
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
          value: salaryRange || (hasPrice ? priceLabel : ''),
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
            value: hasPrice ? priceLabel : '',
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
            value: hasPrice ? priceLabel : '',
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
            value: hasPrice ? priceLabel : '',
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
          value: hasPrice ? priceLabel : '',
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
  const highlightKeys = new Set(highlightItems.map(item => item.key));
  const detailFields = displayFields.filter(f => f.key !== 'work_mode');
  const detailEntries = detailFields.filter(field => {
    const value = meta[field.key];
    return value != null && value !== '' && !highlightKeys.has(field.key);
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
  ].filter(item => item.value);
  const tags = item.tags ?? [];
  const previewHighlightItems = highlightItems.slice(0, 4);
  const expandedDetailItems = [
    ...highlightItems.slice(previewHighlightItems.length).map(entry => ({
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
  const previewTags = tags.slice(0, 4);
  const extraTagCount = Math.max(0, tags.length - previewTags.length);
  const summaryPreview =
    collapseWhitespace(item.summary) ||
    buildPreviewText(undefined, item.body, 110);
  const bodyPreview = buildPreviewText(
    item.summary,
    item.body,
    displayType === 'product' || displayType === 'property' ? 120 : 140,
  );
  const hasEssentialsPanel =
    Boolean(bodyPreview) ||
    previewHighlightItems.length > 0 ||
    previewTags.length > 0;
  const hiddenDetailCount = expandedDetailItems.length + extraTagCount;
  const showDetailAccordion =
    Boolean(item.body) || expandedDetailItems.length > 0 || extraTagCount > 0;
  const detailAccordionDescriptionParts = [
    item.body ? (locale === 'id' ? 'deskripsi' : 'overview') : '',
    expandedDetailItems.length > 0
      ? locale === 'id'
        ? `${expandedDetailItems.length} spec`
        : `${expandedDetailItems.length} specs`
      : '',
    tags.length > 0
      ? locale === 'id'
        ? `${tags.length} tag`
        : `${tags.length} tags`
      : '',
  ].filter(Boolean);
  const detailAccordionDescription =
    detailAccordionDescriptionParts.length > 0
      ? detailAccordionDescriptionParts.join(' / ')
      : locale === 'id'
        ? 'Buka detail lengkap.'
        : 'Open full details.';
  const flowSteps = (() => {
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
    displayType === 'job'
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
          : pricingMode === 'fixed'
            ? locale === 'id'
              ? 'Lanjutkan Deal'
              : 'Continue Deal'
            : locale === 'id'
              ? 'Pilih Respons'
              : 'Choose Action';
  const primaryActionHint =
    displayType === 'job'
      ? locale === 'id'
        ? 'Mulai seperti chat WhatsApp. Tanyakan langkah lanjut atau langsung apply.'
        : 'Apply fast or chat the recruiter.'
      : displayType === 'company'
        ? locale === 'id'
          ? 'Mulai dari chat singkat dulu, lalu lanjut ke profil atau listing yang relevan.'
          : 'Start with chat or the owner profile.'
        : displayType === 'tool_rental'
          ? locale === 'id'
            ? 'Mulai dari chat jadwal dulu. Kalau cocok, baru lanjut request sewa.'
            : 'Check schedule and rate, then send a rental request.'
          : displayType === 'property'
            ? locale === 'id'
              ? 'Mulai dari chat survey dulu. Kalau cocok, baru lanjut deal.'
              : 'Start by chatting about the viewing first, then continue the deal.'
            : displayType === 'service' || displayType === 'profile'
              ? locale === 'id'
                ? 'Mulai dari chat singkat dulu. Kalau cocok, lanjut offer dan transaksi.'
                : 'Start with a short chat first, then continue to offers and transactions.'
              : displayType === 'product'
                ? locale === 'id'
                  ? 'Mulai dari chat stok dulu. Kalau cocok, lanjut offer atau bayar aman.'
                  : 'Start by confirming stock in chat, then continue to offers or safe payment.'
                : isDemandListing
                  ? locale === 'id'
                    ? 'Mulai dari chat singkat dulu. Kalau sudah paham, baru kirim respons atau offer.'
                    : 'Start with a short chat, then send a response or offer.'
                  : locale === 'id'
                    ? 'Mulai dari chat dulu, lalu lanjutkan deal kalau sudah cocok.'
                    : 'Start with chat first, then continue the deal when ready.';
  const chatStarterDraft = (() => {
    const title =
      item?.title?.trim() || (locale === 'id' ? 'listing ini' : 'this listing');

    if (displayType === 'job') {
      return locale === 'id'
        ? `Halo kak, saya tertarik ${title}. Masih buka? Saya mau tanya langkah lanjutnya.`
        : `Hi, I am interested in ${title}. Is it still open? I want to ask about the next step.`;
    }

    if (displayType === 'company') {
      return locale === 'id'
        ? `Halo kak, saya lihat ${title}. Saya mau tanya lebih lanjut soal usaha dan peluang kerjanya.`
        : `Hi, I saw ${title}. I want to ask more about the business and the opportunity.`;
    }

    if (displayType === 'tool_rental') {
      return locale === 'id'
        ? `Halo kak, ${title} masih ready? Saya mau tanya jadwal sewa, deposit, dan cara ambilnya.`
        : `Hi, is ${title} still available? I want to ask about schedule, deposit, and pickup.`;
    }

    if (displayType === 'property') {
      return locale === 'id'
        ? `Halo kak, ${title} masih tersedia? Saya mau tanya survey, harga, dan syarat sewanya.`
        : `Hi, is ${title} still available? I want to ask about viewing, price, and terms.`;
    }

    if (displayType === 'service' || displayType === 'profile') {
      return locale === 'id'
        ? `Halo kak, saya tertarik ${title}. Boleh info scope, timeline, dan cara mulainya?`
        : `Hi, I am interested in ${title}. Can you share the scope, timeline, and how to start?`;
    }

    if (isDemandListing) {
      return locale === 'id'
        ? `Halo kak, saya lihat kebutuhan ${title}. Saya bisa bantu. Boleh kirim detail inti yang paling penting dulu?`
        : `Hi, I saw the need for ${title}. I may be able to help. Can you share the key details first?`;
    }

    return locale === 'id'
      ? `Halo kak, saya lihat ${title}. Masih tersedia? Saya mau cek stok, harga, dan cara ordernya.`
      : `Hi, I saw ${title}. Is it still available? I want to check stock, price, and how to order.`;
  })();
  const chatFirstLabel =
    displayType === 'job'
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
    displayType === 'job'
      ? locale === 'id'
        ? 'Masuk ke chat dulu seperti WhatsApp supaya langkah berikutnya lebih gampang.'
        : 'Open chat first so the next step feels more natural.'
      : displayType === 'tool_rental'
        ? locale === 'id'
          ? 'Cek jadwal, deposit, dan cara ambil dulu sebelum kirim request.'
          : 'Confirm schedule, deposit, and pickup before sending the request.'
        : displayType === 'property'
          ? locale === 'id'
            ? 'Cek survey, harga, dan syarat deal dulu sebelum lanjut.'
            : 'Confirm viewing, price, and terms before continuing.'
          : displayType === 'product'
            ? locale === 'id'
              ? 'Cek stok, ongkir, dan cara order dulu supaya tidak bolak-balik.'
              : 'Confirm stock, delivery, and ordering first so the chat stays simple.'
            : isDemandListing
              ? locale === 'id'
                ? 'Tanya detail inti dulu supaya respons yang kamu kirim langsung pas.'
                : 'Ask for the core details first so your response is more precise.'
              : locale === 'id'
                ? 'Mulai dari chat singkat dulu seperti WhatsApp, lalu lanjutkan deal kalau sudah cocok.'
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
      ? 'Masukkan nominal, scope, dan catatan supaya lawan bicara langsung paham.'
      : 'Send amount, scope, and notes so the other side understands quickly.'
    : displayType === 'tool_rental'
      ? locale === 'id'
        ? 'Kirim nominal, durasi sewa, dan catatan kebutuhan agar mudah dibalas.'
        : 'Send amount, rental duration, and notes so the other side can respond quickly.'
      : displayType === 'property'
        ? locale === 'id'
          ? 'Cocok kalau harga, survey, atau syarat deal masih perlu dinego.'
          : 'Best when price, viewing, or terms still need negotiation.'
        : locale === 'id'
          ? 'Cocok kalau nominal, scope, atau timeline masih perlu dirapikan dulu.'
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
        ? 'Cocok kalau jadwal sewa sudah pas. Pickup dan deposit tetap lanjut rapi di chat.'
        : 'Best when the rental schedule already fits. Pickup and deposit can still be finalized in chat.'
      : displayType === 'property'
        ? locale === 'id'
          ? 'Cocok kalau lokasi sudah sesuai. Detail survey dan syarat tetap lanjut di chat.'
          : 'Best when the location already fits. Viewing and term details can continue in chat.'
        : displayType === 'service' || displayType === 'profile'
          ? locale === 'id'
            ? 'Cocok kalau scope sudah jelas. Timeline dan revisi tetap bisa dibahas di chat.'
            : 'Best when the scope is already clear. Timeline and revisions can still be discussed in chat.'
          : locale === 'id'
            ? 'Transaksi dibuat dulu, lalu detail teknis tetap lanjut di chat seperti WhatsApp.'
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
  const detailPageShellClass =
    'page-shell overflow-x-hidden py-0 pb-10 sm:pb-0 sm:py-3';
  const detailShellStackClass =
    'flex w-full flex-col gap-3 sm:mx-auto sm:max-w-[var(--app-max-width)] sm:gap-3.5';
  const detailSectionClass =
    'relative overflow-hidden rounded-[24px] bg-white px-4 py-4 shadow-[0_16px_30px_-26px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800/80 sm:rounded-[28px] sm:p-5 sm:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.16)]';
  const detailInsetClass =
    'rounded-[18px] bg-slate-50 px-3 py-3 ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-800/70';
  const detailInsetCompactClass =
    'rounded-[16px] bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-800/70';
  const detailPrimaryButtonClass =
    'inline-flex min-h-[44px] items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-sm font-semibold text-white shadow-[0_18px_34px_-24px_color-mix(in_srgb,var(--app-accent)_48%,transparent)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-60';
  const detailSecondaryButtonClass =
    'inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-60 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';
  const detailTextLinkClass =
    'text-sm font-semibold text-[color:var(--app-accent)] transition hover:text-[color:var(--app-accent-strong)]';

  const actionButtons = (
    <div className="flex flex-wrap gap-2">
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
          onClick={openDealFlowPicker}
          disabled={!peerUserId}
          className={detailPrimaryButtonClass}
        >
          {primaryActionLabel}
        </button>
      )}
      {!isOwner && displayType !== 'company' && (
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
            {ownerAvatarUrl ? (
              <NextImage
                src={ownerAvatarUrl}
                alt={ownerDisplayName}
                width={48}
                height={48}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <User className="h-5 w-5 text-[color:var(--app-text-soft)]" />
            )}
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
          {priceHeading}
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
      <div className="mt-2 text-[30px] font-semibold leading-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
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
      {promotionSnapshot?.offerType && (
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
      {user && !isOwner && displayType !== 'company' && (
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

  return (
    <div className={detailPageShellClass}>
      <div className={detailShellStackClass}>
        <section className="ui-page-section ui-home-section-shell px-2 sm:px-3">
          <div className="ui-home-section-content">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-start lg:gap-4 xl:grid-cols-[minmax(0,1fr)_348px]">
              <div className="space-y-3 sm:space-y-4">
                <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_16px_30px_-26px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800/80 sm:rounded-[28px] sm:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.16)]">
                  {images.length > 0 ? (
                    <div className="bg-slate-100/70 dark:bg-slate-900/70">
                      <ImageCarousel images={images} />
                    </div>
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-slate-100/80 text-xs text-[color:var(--app-text-soft)] dark:bg-slate-900/80">
                      {locale === 'id' ? 'Belum ada foto' : 'No images yet'}
                    </div>
                  )}

                  <div className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      {ct && (
                        <span className="rounded-full bg-[color:color-mix(in_srgb,var(--app-accent-soft)_52%,white)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent)_22%,rgba(15,23,42,0.96))] dark:text-[color:var(--app-accent)]">
                          {getContentTypeName(ct, locale)}
                        </span>
                      )}
                      {sectorObj && (
                        <Link
                          href={`/search?sector=${sectorId}`}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${sectorColorClass} text-[color:var(--app-text-inverse)] hover:opacity-90 transition-opacity`}
                          style={sectorColorStyle}
                        >
                          <sectorObj.icon className="h-3.5 w-3.5" />
                          {getSectorLabel(sectorObj, locale)}
                        </Link>
                      )}
                      {subSectorObj && (
                        <Link
                          href={`/search?sector=${sectorId}&sub_sector=${subSectorId}`}
                          className="inline-flex items-center rounded-full bg-[color:var(--app-info-soft)] px-2.5 py-1 text-xs font-medium text-[color:var(--app-info)] transition-colors hover:bg-[color:var(--app-info-border)] dark:bg-[color:var(--app-surface)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface)]"
                        >
                          {getSubSectorName(subSectorObj, locale)}
                        </Link>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusBadgeClass}`}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 max-w-3xl">
                        <h1 className="text-2xl font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[28px]">
                          {item.title}
                        </h1>
                        {summaryPreview ? (
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-[color:var(--app-text-soft)]">
                            {summaryPreview}
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 rounded-[20px] bg-slate-50 px-3 py-2.5 text-right dark:bg-slate-900/72 lg:hidden">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                          {priceHeading}
                        </div>
                        <div className="text-lg font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                          {primaryPrice}
                        </div>
                        {hasOriginalPrice && (
                          <div className="mt-1 text-[11px] text-[color:var(--app-text-soft)] line-through">
                            {formatCurrency(
                              displayOriginalPriceCents as number,
                              item.currency || 'IDR',
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {quickSpecs.map(spec => {
                        const SpecIcon = spec.icon;
                        return (
                          <div
                            key={spec.key}
                            className={detailInsetCompactClass}
                          >
                            <div className="flex items-start gap-2">
                              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[color:var(--app-accent)] shadow-[0_10px_22px_-18px_rgba(15,23,42,0.35)] dark:bg-slate-950">
                                <SpecIcon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                                  {spec.label}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                  {spec.value}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {hasEssentialsPanel && (
                      <div className={`mt-4 space-y-3 ${detailInsetClass}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                              <TypeIcon className="h-4 w-4" />
                              {highlightHeading}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                              {locale === 'id'
                                ? 'Poin utama langsung terlihat'
                                : 'Key details are surfaced first'}
                            </p>
                          </div>
                          {hiddenDetailCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-[color:color-mix(in_srgb,var(--app-accent-soft)_52%,white)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent)_22%,rgba(15,23,42,0.96))] dark:text-[color:var(--app-accent)]">
                              {locale === 'id'
                                ? `${hiddenDetailCount} detail lanjutan`
                                : `${hiddenDetailCount} more details`}
                            </span>
                          )}
                        </div>

                        {bodyPreview && (
                          <p className="text-sm leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {bodyPreview}
                          </p>
                        )}

                        {previewHighlightItems.length > 0 && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {previewHighlightItems.map(item => (
                              <div
                                key={item.key}
                                className={detailInsetCompactClass}
                              >
                                <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                                  {item.label}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                  {item.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {previewTags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {previewTags.map(tag => (
                              <span
                                key={tag}
                                className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200/70 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-800/80"
                              >
                                {tag}
                              </span>
                            ))}
                            {extraTagCount > 0 && (
                              <span className="rounded-full bg-[color:color-mix(in_srgb,var(--app-accent-soft)_52%,white)] px-3 py-1 text-[11px] font-semibold text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent)_22%,rgba(15,23,42,0.96))] dark:text-[color:var(--app-accent)]">
                                +{extraTagCount}
                              </span>
                            )}
                          </div>
                        )}

                        {showDetailAccordion && (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] bg-white px-3 py-2 text-[11px] text-[color:var(--app-text-soft)] ring-1 ring-slate-200/70 dark:bg-slate-950 dark:ring-slate-800/80">
                            <span>
                              {locale === 'id'
                                ? 'Detail lengkap ada di panel bawah.'
                                : 'Full details live in the panel below.'}
                            </span>
                            <span className="font-semibold text-[color:var(--app-accent)]">
                              {locale === 'id'
                                ? 'Buka saat perlu'
                                : 'Open when needed'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {ratingValue > 0 && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-amber-700 dark:bg-amber-500/12 dark:text-amber-200">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={`header-rating-${i}`}
                              className={`h-4 w-4 ${
                                i < ratingRounded
                                  ? 'fill-[color:var(--app-warning)] text-[color:var(--app-warning)]'
                                  : 'text-[color:var(--app-text-soft)] dark:text-[color:var(--app-text)]'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-semibold">
                          {ratingValue.toFixed(1)} ({item.review_count || 0}{' '}
                          {locale === 'id' ? 'review' : 'reviews'})
                        </span>
                      </div>
                    )}

                    {(displayType === 'job' ||
                      displayType === 'service' ||
                      displayType === 'profile') &&
                      (meta.work_mode as string) && (
                        <div className="mt-4">
                          {(() => {
                            const wm = WORK_MODE_OPTIONS.find(
                              o => o.value === (meta.work_mode as string),
                            );
                            if (!wm) return null;
                            return (
                              <div className="inline-flex flex-wrap items-center gap-2 rounded-[20px] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_46%,white)] px-3 py-2 text-sm font-medium text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent)_24%,rgba(15,23,42,0.96))] dark:text-[color:var(--app-accent)]">
                                <span className="text-lg">{wm.icon}</span>
                                <span>
                                  {locale === 'id' ? wm.labelId : wm.labelEn}
                                </span>
                                <span className="text-xs text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]">
                                  {locale === 'id' ? wm.descId : wm.descEn}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                      {updatedLabel && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-900">
                          <Calendar className="h-3.5 w-3.5" />
                          {locale === 'id' ? 'Diperbarui' : 'Updated'}{' '}
                          {updatedLabel}
                        </span>
                      )}
                      {images.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-900">
                          <ImageIcon className="h-3.5 w-3.5" />
                          {images.length} {locale === 'id' ? 'foto' : 'images'}
                        </span>
                      )}
                      {documents.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-900">
                          <FileText className="h-3.5 w-3.5" />
                          {documents.length}{' '}
                          {locale === 'id' ? 'dokumen' : 'documents'}
                        </span>
                      )}
                    </div>
                  </div>
                </section>

                <div className="grid gap-3 lg:hidden sm:grid-cols-2">
                  {ownerProfileCard}
                  {actionCard}
                </div>

                {showDetailAccordion && (
                  <DetailAccordion
                    title={
                      locale === 'id'
                        ? 'Lihat detail lengkap'
                        : 'See full details'
                    }
                    description={detailAccordionDescription}
                    className="rounded-[24px] border-transparent bg-white shadow-[0_16px_30px_-26px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800/80 sm:rounded-[28px] sm:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.16)]"
                  >
                    <div className="space-y-5">
                      {item.body ? (
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                            {locale === 'id'
                              ? 'Deskripsi lengkap'
                              : 'Full overview'}
                          </div>
                          <div className="prose prose-sm mt-3 max-w-none whitespace-pre-line text-[color:var(--app-text)] dark:prose-invert dark:text-[color:var(--app-text-soft)]">
                            {item.body}
                          </div>
                        </div>
                      ) : null}

                      {expandedDetailItems.length > 0 && (
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                            {detailHeading}
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-[color:var(--app-text)]">
                            {expandedDetailItems.map(entry => (
                              <div
                                key={entry.key}
                                className={detailInsetCompactClass}
                              >
                                <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                                  {entry.label}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                  {entry.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {tags.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                            <Tag className="h-4 w-4" />
                            {locale === 'id' ? 'Tag terkait' : 'Related tags'}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {tags.map(tag => (
                              <span
                                key={tag}
                                className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </DetailAccordion>
                )}

                {(reviewsLoading || hasReviews) && (
                  <section className={detailSectionClass}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                        {locale === 'id' ? 'Ulasan' : 'Reviews'}
                      </div>
                      {ratingValue > 0 && (
                        <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:bg-amber-500/12 dark:text-amber-200">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={`reviews-rating-${i}`}
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
                    </div>
                    <div className="mt-4 space-y-3">
                      {reviewsLoading && (
                        <div className="text-xs text-[color:var(--app-text)]">
                          {locale === 'id'
                            ? 'Memuat ulasan...'
                            : 'Loading reviews...'}
                        </div>
                      )}
                      {!reviewsLoading && reviews.length === 0 && (
                        <div
                          className={`${detailInsetClass} text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]`}
                        >
                          {locale === 'id'
                            ? 'Belum ada ulasan untuk listing ini.'
                            : 'No reviews for this listing yet.'}
                        </div>
                      )}
                      {reviews.slice(0, 5).map(review => (
                        <div
                          key={review.id}
                          className={`${detailInsetClass} text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5">
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
                              <span className="font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                {review.rating.toFixed(1)}
                              </span>
                            </div>
                            <span className="text-[11px] text-[color:var(--app-text-soft)]">
                              {formatDate(review.created_at || '')}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {review.comment ||
                              (locale === 'id'
                                ? 'Tanpa komentar.'
                                : 'No comment provided.')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {documents.length > 0 && (
                  <section className={detailSectionClass}>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                      <FileText className="h-4 w-4" />
                      {locale === 'id' ? 'Dokumen' : 'Documents'}
                    </div>
                    <div className="mt-4 space-y-2">
                      {documents.map(doc => (
                        <a
                          key={`${doc.url}-${doc.name}`}
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group flex items-center justify-between gap-3 rounded-[20px] bg-slate-50/92 px-3 py-2.5 text-sm transition hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_32%,white)] dark:bg-slate-900/72 dark:hover:bg-[color:color-mix(in_srgb,var(--app-accent)_20%,rgba(15,23,42,0.96))]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[color:var(--app-text)] shadow-[0_10px_22px_-18px_rgba(15,23,42,0.35)] dark:bg-slate-950 dark:text-[color:var(--app-text-soft)]">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                                {doc.name}
                              </p>
                              <p className="text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                {doc.mime ||
                                  (locale === 'id' ? 'Dokumen' : 'Document')}
                                {doc.size ? ` - ${formatSize(doc.size)}` : ''}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-[color:var(--app-accent)] group-hover:underline dark:text-[color:var(--app-accent)]">
                            {locale === 'id' ? 'Lihat' : 'View'}
                          </span>
                        </a>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <aside className="hidden lg:block">
                <div className="sticky top-24 space-y-3">
                  {ownerProfileCard}
                  {actionCard}
                  {showSellerStats && (
                    <section className={detailSectionClass}>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                        {locale === 'id'
                          ? 'Kepercayaan Penjual'
                          : 'Seller Trust'}
                      </div>
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {locale === 'id'
                              ? 'Rating penjual'
                              : 'Seller rating'}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={`seller-rating-${i}`}
                                  className={`h-3.5 w-3.5 ${
                                    i < sellerRatingRounded
                                      ? 'fill-[color:var(--app-warning)] text-[color:var(--app-warning)]'
                                      : 'text-[color:var(--app-text-soft)] dark:text-[color:var(--app-text)]'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                              {sellerRating > 0
                                ? sellerRating.toFixed(1)
                                : '0.0'}
                            </span>
                          </div>
                        </div>
                        <div className="text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                          {sellerReviewCount > 0
                            ? `${sellerReviewCount} ${locale === 'id' ? 'ulasan' : 'reviews'}`
                            : locale === 'id'
                              ? 'Belum ada ulasan'
                              : 'No reviews yet'}
                        </div>
                        <div
                          className={`${detailInsetCompactClass} grid gap-2 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]`}
                        >
                          <div className="flex items-center justify-between">
                            <span>
                              {locale === 'id'
                                ? 'Transaksi selesai'
                                : 'Completed transactions'}
                            </span>
                            <span className="font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                              {sellerCompletedTransactions}/
                              {sellerTotalTransactions}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>
                              {locale === 'id'
                                ? 'Acceptance rate'
                                : 'Acceptance rate'}
                            </span>
                            <span className="font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                              {formatPercent(sellerAcceptanceRate)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>
                              {locale === 'id' ? 'Cancel rate' : 'Cancel rate'}
                            </span>
                            <span className="font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                              {formatPercent(sellerCancelRate)}
                            </span>
                          </div>
                          {sellerPendingTransactions > 0 && (
                            <div className="flex items-center justify-between">
                              <span>
                                {locale === 'id'
                                  ? 'Transaksi berjalan'
                                  : 'Active deals'}
                              </span>
                              <span className="font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                {sellerPendingTransactions}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  )}
                  <section className={detailSectionClass}>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                      {locale === 'id' ? 'Info Listing' : 'Listing Info'}
                    </div>
                    <div
                      className={`${detailInsetCompactClass} mt-3 space-y-2 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]`}
                    >
                      {updatedLabel && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-[color:var(--app-text-soft)]" />
                          <span>
                            {locale === 'id' ? 'Diperbarui' : 'Updated'}:{' '}
                            {updatedLabel}
                          </span>
                        </div>
                      )}
                      {createdLabel && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-[color:var(--app-text-soft)]" />
                          <span>
                            {locale === 'id' ? 'Dibuat' : 'Created'}:{' '}
                            {createdLabel}
                          </span>
                        </div>
                      )}
                      {item.id && (
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 text-[color:var(--app-text-soft)]" />
                          <span>ID: {item.id.slice(0, 8)}...</span>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </div>

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
                          ? 'Cocok kalau ingin kirim profil, pengalaman, ekspektasi, dan catatan lebih lengkap.'
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
                  ? 'Chat tetap dipakai untuk tektokan, update progres, dan bukti percakapan.'
                  : 'Chat is still used for discussion, progress updates, and conversation evidence.',
                locale === 'id'
                  ? 'Kalau ada masalah, CRM bisa lihat kronologi order, status dana, dan bukti dari sini.'
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
                  ? 'Untuk pembelian langsung, lanjutkan ke workspace order agar user bisa bayar aman di platform sebelum pekerjaan atau pengiriman dimulai.'
                  : 'For direct purchases, continue to the order workspace so the buyer can pay safely on-platform before work or delivery starts.'
                : locale === 'id'
                  ? 'Untuk offer, gunakan workspace order untuk memantau status, lalu lanjutkan detail teknis di chat tanpa kehilangan jejak transaksi.'
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
                      ? 'Cek nominal dan kirim konfirmasi. Penjual akan menerima permintaan beli langsung.'
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
