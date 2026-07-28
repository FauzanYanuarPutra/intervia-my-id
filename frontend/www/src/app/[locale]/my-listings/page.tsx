'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildLoginPath } from '@/lib/authRoutes';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';
import { EmptyState } from '@/components/system/feedback/EmptyState';
import { useDialog } from '@/components/system/feedback/DialogProvider';
import {
  MyListingsListSkeleton,
  MyListingsSkeleton,
} from '@/components/system/feedback/RouteSkeletons';
import {
  BookmarkCheck,
  Clock3,
  Eye,
  EyeOff,
  Heart,
  ImageIcon,
  Megaphone,
  MessageCircle,
  PencilLine,
  Plus,
  Search,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  readSearchCartSession,
  removeSearchCartItem,
  subscribeSearchCartSession,
  type SearchCartItem,
} from '@/lib/searchCartSession';
import {
  readListingViewHistory,
  removeListingViewHistoryItem,
  subscribeListingViewHistory,
  type ListingViewHistoryItem,
} from '@/lib/listingViewHistory';
import CreateMarketplaceShell from '../(app)/create/CreateMarketplaceShell';

type ListingStatus = 'draft' | 'active' | 'archived';
type ListingCollectionMode = 'mine' | 'favorites' | 'history';
type ListingActivityKind =
  | 'available_today'
  | 'stock_updated'
  | 'busy_today'
  | 'fully_booked';

type ListingItem = {
  id: string;
  slug?: string | null;
  title?: string | null;
  summary?: string | null;
  content_type?: string | null;
  type?: string | null;
  cover_image?: string | null;
  content_status?: string | null;
  status?: string | null;
  updated_at?: string;
  created_at?: string;
  metadata?: Record<string, unknown> | null;
};

const VALID_LISTING_TYPES = new Set([
  'product',
  'service',
  'job',
  'property',
  'tool_rental',
  'company',
  'business_transfer',
]);

const DAILY_ACTIVITY_OPTIONS: Array<{
  id: ListingActivityKind;
  labelId: string;
  labelEn: string;
  noteId: string;
  noteEn: string;
}> = [
    {
      id: 'available_today',
      labelId: 'Tersedia hari ini',
      labelEn: 'Available today',
      noteId: 'Siap dihubungi hari ini',
      noteEn: 'Ready to contact today',
    },
    {
      id: 'stock_updated',
      labelId: 'Stok update',
      labelEn: 'Stock updated',
      noteId: 'Info stok baru diperbarui',
      noteEn: 'Stock info was just refreshed',
    },
    {
      id: 'busy_today',
      labelId: 'Lagi rame',
      labelEn: 'Busy today',
      noteId: 'Masih aktif, respon mungkin bergantian',
      noteEn: 'Still active, replies may take turns',
    },
    {
      id: 'fully_booked',
      labelId: 'Full dulu',
      labelEn: 'Full for now',
      noteId: 'Sementara tidak menerima permintaan baru',
      noteEn: 'Temporarily not accepting new requests',
    },
  ];

function parseId(value: string): string {
  const clean = value.trim();
  if (!clean) return '';
  const match = clean.match(
    /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i,
  );
  return match ? match[1] : clean;
}

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function readProgress(item: ListingItem): number {
  const meta = (item.metadata || {}) as Record<string, unknown>;
  const progress = meta.listing_progress as Record<string, unknown> | undefined;
  const current =
    typeof progress?.current_step === 'number' ? progress.current_step : 1;
  const total =
    typeof progress?.total_steps === 'number' ? progress.total_steps : 3;
  return Math.min(
    100,
    Math.max(0, Math.round((current / Math.max(total, 1)) * 100)),
  );
}

function summarizeText(value?: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.length > 150 ? `${trimmed.slice(0, 147)}...` : trimmed;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getActivityOption(kind: string): (typeof DAILY_ACTIVITY_OPTIONS)[number] | null {
  return DAILY_ACTIVITY_OPTIONS.find(option => option.id === kind) || null;
}

function readListingActivity(item: ListingItem): {
  kind: ListingActivityKind;
  labelId: string;
  labelEn: string;
  noteId: string;
  noteEn: string;
  updatedAt: string;
} | null {
  const metadata = readRecord(item.metadata) || {};
  const activity = readRecord(metadata.listing_activity);
  const kind = readString(activity?.kind) as ListingActivityKind;
  const option = getActivityOption(kind);
  if (!option) return null;
  return {
    kind,
    labelId: readString(activity?.label_id) || option.labelId,
    labelEn: readString(activity?.label_en) || option.labelEn,
    noteId: readString(activity?.note_id) || option.noteId,
    noteEn: readString(activity?.note_en) || option.noteEn,
    updatedAt: readString(activity?.updated_at),
  };
}

function payloadListingType(item: ListingItem): string {
  const raw = (item.content_type || item.type || '').toLowerCase();
  return VALID_LISTING_TYPES.has(raw) ? raw : 'product';
}

function buildDailyActivityMetadata(
  item: ListingItem,
  kind: ListingActivityKind,
): Record<string, unknown> {
  const metadata = { ...(readRecord(item.metadata) || {}) };
  const option = getActivityOption(kind) || DAILY_ACTIVITY_OPTIONS[0]!;
  const now = new Date().toISOString();
  const nextActivity = {
    kind,
    label_id: option.labelId,
    label_en: option.labelEn,
    note_id: option.noteId,
    note_en: option.noteEn,
    updated_at: now,
  };
  const existingLog = Array.isArray(metadata.listing_activity_log)
    ? metadata.listing_activity_log.filter(
      entry => entry && typeof entry === 'object' && !Array.isArray(entry),
    )
    : [];

  return {
    ...metadata,
    availability_status: kind,
    last_activity_update_at: now,
    listing_activity: nextActivity,
    listing_activity_log: [nextActivity, ...existingLog].slice(0, 8),
  };
}

function buildDailyActivityPayload(
  item: ListingItem,
  kind: ListingActivityKind,
  fallbackStatus: ListingStatus,
): Record<string, unknown> {
  const metadata = buildDailyActivityMetadata(item, kind);
  const currentStatus = item.content_status || item.status || fallbackStatus;
  const type = payloadListingType(item);

  return {
    content_type: type,
    category: type,
    title: item.title || 'Untitled listing',
    summary: item.summary || undefined,
    cover_image: item.cover_image || undefined,
    content_status: currentStatus,
    metadata,
  };
}

function mergeUpdatedListing(
  fallback: ListingItem,
  payload: unknown,
  optimisticMetadata: Record<string, unknown>,
): ListingItem {
  const data = readRecord(payload);
  const candidate =
    readRecord(data?.item) ||
    readRecord(data?.content) ||
    readRecord(data?.data) ||
    data;

  if (!candidate) {
    return {
      ...fallback,
      metadata: optimisticMetadata,
      updated_at: new Date().toISOString(),
    };
  }

  return {
    ...fallback,
    ...(candidate as ListingItem),
    metadata:
      readRecord(candidate.metadata) || optimisticMetadata || fallback.metadata,
  };
}

function readImageCandidate(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return (
      readString(objectValue.url) ||
      readString(objectValue.src) ||
      readString(objectValue.preview) ||
      readString(objectValue.image_url)
    );
  }
  return '';
}

function resolveListingImage(item: ListingItem): string {
  const meta = (item.metadata || {}) as Record<string, unknown>;
  const direct =
    readString(item.cover_image) ||
    readString(meta.cover_image) ||
    readString(meta.thumbnail) ||
    readString(meta.image) ||
    readString(meta.image_url) ||
    readString(meta.photo_url);
  if (direct) return direct;

  for (const key of ['images', 'photos', 'media', 'attachments']) {
    const collection = meta[key];
    if (!Array.isArray(collection)) continue;
    for (const entry of collection) {
      const candidate = readImageCandidate(entry);
      if (candidate) return candidate;
    }
  }

  return '';
}

function listingTypeLabel(value: string, locale: string): string {
  const normalized = value.toLowerCase();
  const labels: Record<string, { id: string; en: string }> = {
    product: { id: 'Produk', en: 'Product' },
    service: { id: 'Jasa', en: 'Service' },
    job: { id: 'Lowongan', en: 'Job' },
    property: { id: 'Properti', en: 'Property' },
    tool_rental: { id: 'Sewa alat', en: 'Tool rental' },
    business_transfer: { id: 'Oper usaha', en: 'Business transfer' },
    company: { id: 'Profil usaha', en: 'Business profile' },
  };
  const matched = labels[normalized];
  if (matched) return locale === 'id' ? matched.id : matched.en;
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, token => token.toUpperCase());
}

function listingStatusLabel(value: string, locale: string): string {
  const normalized = value.toLowerCase();
  if (normalized === 'active') return locale === 'id' ? 'Tayang' : 'Live';
  if (normalized === 'archived') return locale === 'id' ? 'Arsip' : 'Archived';
  return locale === 'id' ? 'Draft' : 'Draft';
}

function statusToneClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'active') {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-400/12 dark:text-emerald-200 dark:ring-emerald-400/20';
  }
  if (normalized === 'archived') {
    return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-white/8 dark:text-slate-300 dark:ring-white/10';
  }
  return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100 dark:bg-amber-400/12 dark:text-amber-200 dark:ring-amber-400/20';
}

function listingNextStep(status: ListingStatus, locale: string): string {
  if (status === 'active') {
    return locale === 'id'
      ? 'Sudah tayang. Pantau chat dan rapikan info kalau ada yang kurang.'
      : 'This is live. Watch chats and refine details if needed.';
  }
  if (status === 'archived') {
    return locale === 'id'
      ? 'Disimpan di arsip. Kamu masih bisa edit kalau mau dipakai lagi.'
      : 'Saved in archive. You can still edit it if needed.';
  }
  return locale === 'id'
    ? 'Belum tayang. Lengkapi dulu supaya siap dilihat orang.'
    : 'Not live yet. Complete it so people can view it.';
}

function listingStatusToggle(
  status: ListingStatus,
  locale: string,
): {
  label: string;
  nextStatus: 'active' | 'archived';
  icon: LucideIcon;
  className: string;
} | null {
  if (status === 'active') {
    return {
      label: locale === 'id' ? 'Sembunyikan' : 'Hide',
      nextStatus: 'archived',
      icon: EyeOff,
      className:
        'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-white',
    };
  }

  if (status === 'archived') {
    return {
      label: locale === 'id' ? 'Tampilkan' : 'Unhide',
      nextStatus: 'active',
      icon: Eye,
      className:
        'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/20 dark:bg-emerald-400/12 dark:text-emerald-200',
    };
  }

  return null;
}

export default function MyListingsPage() {
  const locale = useLocale() || 'id';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, authFetch } = useAuth();
  const { confirm } = useDialog();
  const currentSearch = searchParams?.toString() || '';
  const filterParam = (searchParams?.get('filter') || '').toLowerCase();
  const isFavoritesMode = filterParam === 'favorites';
  const isHistoryMode = filterParam === 'history';
  const collectionMode: ListingCollectionMode = isFavoritesMode
    ? 'favorites'
    : isHistoryMode
      ? 'history'
      : 'mine';

  const [activeStatus, setActiveStatus] = useState<ListingStatus>('draft');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<ListingItem[]>([]);
  const [savedReferences, setSavedReferences] = useState<SearchCartItem[]>([]);
  const [viewedReferences, setViewedReferences] = useState<
    ListingViewHistoryItem[]
  >([]);
  const [updatingActivityId, setUpdatingActivityId] = useState('');
  const [updatingStatusId, setUpdatingStatusId] = useState('');
  const [deletingDraftId, setDeletingDraftId] = useState('');
  const [activityNotice, setActivityNotice] = useState('');
  const createHref = '/create';
  const createLabel = locale === 'id' ? 'Buat baru' : 'Create new';

  const statusTabs = useMemo(
    () => [
      { id: 'draft' as const, label: locale === 'id' ? 'Draft' : 'Draft' },
      { id: 'active' as const, label: locale === 'id' ? 'Tayang' : 'Live' },
      {
        id: 'archived' as const,
        label: locale === 'id' ? 'Arsip' : 'Archived',
      },
    ],
    [locale],
  );

  const collectionTabs = useMemo(
    () => [
      {
        id: 'mine',
        href: '/my-listings',
        label: locale === 'id' ? 'Postingan saya' : 'My posts',
      },
      {
        id: 'favorites',
        href: '/my-listings?filter=favorites',
        label: locale === 'id' ? 'Disimpan' : 'Saved',
      },
      {
        id: 'history',
        href: '/my-listings?filter=history',
        label: locale === 'id' ? 'Dilihat' : 'Viewed',
      },
    ],
    [locale],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;
    return items.filter(item => {
      const rawType = item.type || item.content_type || 'listing';
      const rawStatus = item.content_status || item.status || activeStatus;
      const text = [
        item.title,
        item.summary,
        item.type,
        item.content_type,
        item.content_status,
        item.status,
        listingTypeLabel(rawType, locale),
        listingStatusLabel(rawStatus, locale),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(normalizedQuery);
    });
  }, [activeStatus, items, locale, query]);

  const filteredReferences = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return savedReferences;
    return savedReferences.filter(item => {
      const text = [
        item.title,
        item.summary,
        item.typeLabel,
        item.actionLabel,
        item.location,
        item.priceLabel,
        item.storeName,
        item.kind,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(normalizedQuery);
    });
  }, [query, savedReferences]);

  const filteredViewedReferences = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return viewedReferences;
    return viewedReferences.filter(item => {
      const text = [
        item.title,
        item.summary,
        item.typeLabel,
        item.actionLabel,
        item.location,
        item.priceLabel,
        item.storeName,
        item.kind,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(normalizedQuery);
    });
  }, [query, viewedReferences]);

  useEffect(() => {
    const syncSavedReferences = () => {
      setSavedReferences(readSearchCartSession().items);
    };

    syncSavedReferences();
    return subscribeSearchCartSession(syncSavedReferences);
  }, []);

  useEffect(() => {
    const syncViewedReferences = () => {
      setViewedReferences(readListingViewHistory());
    };

    syncViewedReferences();
    return subscribeListingViewHistory(syncViewedReferences);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(buildLoginPath(locale, pathname, currentSearch));
      return;
    }

    if (isFavoritesMode || isHistoryMode) {
      setLoading(false);
      setError('');
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await authFetch(`/api/my-listings?status=${activeStatus}`);
        const data = (await res.json().catch(() => ({}))) as {
          results?: ListingItem[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'Failed to load listings');
        if (!cancelled)
          setItems(Array.isArray(data.results) ? data.results : []);
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setError(
            err instanceof Error ? err.message : 'Failed to load listings',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [
    activeStatus,
    authFetch,
    authLoading,
    currentSearch,
    isFavoritesMode,
    isHistoryMode,
    locale,
    pathname,
    router,
    user,
  ]);

  if (authLoading) {
    return (
      <CreateMarketplaceShell>
        <MyListingsSkeleton />
      </CreateMarketplaceShell>
    );
  }

  const removeReference = (itemId: string) => {
    setSavedReferences(removeSearchCartItem(itemId).items);
  };

  const removeViewedReference = (itemId: string) => {
    setViewedReferences(removeListingViewHistoryItem(itemId));
  };

  const updateDailyActivity = async (
    item: ListingItem,
    kind: ListingActivityKind,
  ) => {
    const id = parseId(item.id);
    if (!id || updatingActivityId) return;

    const option = getActivityOption(kind) || DAILY_ACTIVITY_OPTIONS[0]!;
    const metadata = buildDailyActivityMetadata(item, kind);
    const optimisticItem: ListingItem = {
      ...item,
      metadata,
      updated_at: new Date().toISOString(),
    };

    setUpdatingActivityId(item.id);
    setError('');
    setActivityNotice('');
    setItems(current =>
      current.map(entry => (entry.id === item.id ? optimisticItem : entry)),
    );

    try {
      const response = await authFetch(`/api/content/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildDailyActivityPayload(item, kind, activeStatus)),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : 'Failed to update listing',
        );
      }

      setItems(current =>
        current.map(entry =>
          entry.id === item.id
            ? mergeUpdatedListing(optimisticItem, payload, metadata)
            : entry,
        ),
      );
      setActivityNotice(
        locale === 'id'
          ? `${option.labelId} tersimpan. Listing terlihat aktif lagi.`
          : `${option.labelEn} saved. The listing looks active again.`,
      );
    } catch (err) {
      setItems(current =>
        current.map(entry => (entry.id === item.id ? item : entry)),
      );
      setError(
        err instanceof Error
          ? err.message
          : locale === 'id'
            ? 'Update belum tersimpan'
            : 'Update was not saved',
      );
    } finally {
      setUpdatingActivityId('');
    }
  };

  const updateListingStatus = async (
    item: ListingItem,
    nextStatus: 'active' | 'archived',
  ) => {
    const id = parseId(item.id);
    if (!id || updatingStatusId) return;

    const currentStatus = (item.content_status || item.status || activeStatus)
      .toString()
      .toLowerCase();
    if (currentStatus === nextStatus) return;

    const optimisticItem: ListingItem = {
      ...item,
      content_status: nextStatus,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    setUpdatingStatusId(item.id);
    setError('');
    setItems(current =>
      current.map(entry => (entry.id === item.id ? optimisticItem : entry)),
    );

    try {
      const response = await authFetch(`/api/content/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_type: payloadListingType(item),
          category: payloadListingType(item),
          title: item.title || 'Untitled listing',
          summary: item.summary || undefined,
          cover_image: item.cover_image || undefined,
          content_status: nextStatus,
          metadata: readRecord(item.metadata) || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : 'Failed to update listing status',
        );
      }

      setItems(current =>
        current.map(entry =>
          entry.id === item.id
            ? mergeUpdatedListing(
              optimisticItem,
              payload,
              optimisticItem.metadata || {},
            )
            : entry,
        ),
      );
    } catch (err) {
      setItems(current =>
        current.map(entry => (entry.id === item.id ? item : entry)),
      );
      setError(
        err instanceof Error
          ? err.message
          : locale === 'id'
            ? 'Status belum tersimpan'
            : 'Status update was not saved',
      );
    } finally {
      setUpdatingStatusId('');
    }
  };

  const deleteDraft = async (item: ListingItem) => {
    const id = parseId(item.id);
    if (!id || deletingDraftId) return;

    const approved = await confirm({
      title: locale === 'id' ? 'Hapus draft?' : 'Delete draft?',
      description:
        locale === 'id'
          ? 'Draft ini akan dihapus permanen dari daftar kamu. Tindakan ini tidak bisa dibatalkan.'
          : 'This draft will be permanently removed from your list. This action cannot be undone.',
      confirmLabel: locale === 'id' ? 'Hapus draft' : 'Delete draft',
      cancelLabel: locale === 'id' ? 'Batal' : 'Cancel',
      tone: 'danger',
    });
    if (!approved) return;

    setDeletingDraftId(item.id);
    setError('');
    try {
      const response = await authFetch(
        `/api/content/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : locale === 'id'
              ? 'Draft belum berhasil dihapus'
              : 'Draft could not be deleted',
        );
      }
      setItems(current => current.filter(entry => entry.id !== item.id));
      setActivityNotice(
        locale === 'id' ? 'Draft berhasil dihapus.' : 'Draft deleted.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : locale === 'id'
            ? 'Draft belum berhasil dihapus'
            : 'Draft could not be deleted',
      );
    } finally {
      setDeletingDraftId('');
    }
  };

  const pageTitle =
    collectionMode === 'favorites'
      ? locale === 'id'
        ? 'Disimpan'
        : 'Saved posts'
      : collectionMode === 'history'
        ? locale === 'id'
          ? 'Pernah dilihat'
          : 'Viewed posts'
        : locale === 'id'
          ? 'Postingan Saya'
          : 'My posts';
  const pageDescription =
    collectionMode === 'favorites'
      ? locale === 'id'
        ? 'Tempat menyimpan produk, jasa, atau usaha yang menarik.'
        : 'Products, services, or businesses you saved.'
      : collectionMode === 'history'
        ? locale === 'id'
          ? 'Nanti isi riwayat listing yang pernah kamu buka.'
          : 'Listings you recently opened will appear here.'
        : locale === 'id'
          ? 'Kelola draft, postingan tayang, dan arsip tanpa ribet.'
          : 'Manage drafts, live posts, and archives without clutter.';
  const HeaderIcon =
    collectionMode === 'favorites'
      ? BookmarkCheck
      : collectionMode === 'history'
        ? Eye
        : Megaphone;
  const primaryAction =
    collectionMode !== 'mine'
      ? {
        label: locale === 'id' ? 'Cari inspirasi' : 'Search ideas',
        href: '/explore',
        icon: Search,
      }
      : {
        label: createLabel,
        href: createHref,
        icon: Plus,
      };
  const PrimaryActionIcon = primaryAction.icon;
  const secondaryAction =
    collectionMode !== 'mine'
      ? {
        label: locale === 'id' ? 'Postingan saya' : 'My posts',
        href: '/my-listings',
        icon: Megaphone,
      }
      : {
        label: locale === 'id' ? 'Cari inspirasi' : 'Find ideas',
        href: '/explore',
        icon: Search,
      };
  const SecondaryActionIcon = secondaryAction.icon;
  const totalShown =
    collectionMode === 'favorites'
      ? filteredReferences.length
      : collectionMode === 'history'
        ? filteredViewedReferences.length
        : filteredItems.length;
  const heroStatusLabel =
    collectionMode === 'mine'
      ? statusTabs.find(tab => tab.id === activeStatus)?.label || 'Draft'
      : collectionMode === 'favorites'
        ? locale === 'id'
          ? 'Disimpan'
          : 'Saved'
        : locale === 'id'
          ? 'Dilihat'
          : 'Viewed';

  return (
    <CreateMarketplaceShell>
      <div className="mx-auto w-full max-w-7xl px-0 py-0 sm:px-1">
        <div className="space-y-2.5 sm:space-y-3">
          <section className="relative overflow-hidden rounded-none border border-x-0 border-emerald-100 bg-[linear-gradient(135deg,#fffdf6_0%,#eefdf4_58%,#fff8e8_100%)] p-3 shadow-[0_18px_42px_-38px_rgba(15,23,42,0.32)] dark:border-white/10 dark:bg-[linear-gradient(135deg,#0f172a_0%,#052e21_58%,#1c1917_100%)] sm:rounded-[22px] sm:border-x sm:p-4">
            <div className="pointer-events-none absolute -right-16 -top-20 h-32 w-32 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-400/10" />
            <div className="pointer-events-none absolute -bottom-20 left-4 h-28 w-28 rounded-full bg-orange-300/22 blur-3xl dark:bg-orange-400/10" />

            <div className="relative grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-white/86 text-emerald-700 shadow-sm ring-1 ring-emerald-100 dark:bg-white/10 dark:text-emerald-200 dark:ring-white/10">
                    <HeaderIcon className="h-4 w-4" />
                  </span>
                  <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700 ring-1 ring-emerald-100 dark:bg-white/8 dark:text-emerald-200 dark:ring-white/10">
                    {locale === 'id' ? 'Ruang promosi' : 'Promo space'}
                  </span>
                </div>
                <h1 className="mt-2 text-xl font-bold leading-tight tracking-[-0.05em] text-slate-950 dark:text-white sm:text-2xl">
                  {pageTitle}
                </h1>
                <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300 sm:text-[13px]">
                  {pageDescription}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:w-[300px]">
                <Link
                  href={primaryAction.href}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 text-xs font-bold text-white shadow-[0_18px_34px_-24px_rgba(4,120,87,0.72)] transition hover:bg-emerald-800"
                >
                  <PrimaryActionIcon className="h-4 w-4" />
                  {primaryAction.label}
                </Link>
                <Link
                  href={secondaryAction.href}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/84 px-4 text-xs font-bold text-slate-800 transition hover:bg-white dark:border-white/10 dark:bg-white/8 dark:text-white"
                >
                  <SecondaryActionIcon className="h-4 w-4" />
                  {secondaryAction.label}
                </Link>
              </div>
            </div>

            <div className="relative mt-3 grid gap-1.5 sm:grid-cols-3">
              <div className="rounded-[15px] bg-white/72 p-2.5 ring-1 ring-white/80 dark:bg-white/[0.06] dark:ring-white/10">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {locale === 'id' ? 'Mode' : 'Mode'}
                </p>
                <p className="mt-0.5 truncate text-sm font-bold text-slate-950 dark:text-white">
                  {heroStatusLabel}
                </p>
              </div>
              <div className="rounded-[15px] bg-white/72 p-2.5 ring-1 ring-white/80 dark:bg-white/[0.06] dark:ring-white/10">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {locale === 'id' ? 'Tampil' : 'Shown'}
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-950 dark:text-white">
                  {totalShown.toLocaleString(locale)}
                </p>
              </div>
              <div className="rounded-[15px] bg-white/72 p-2.5 ring-1 ring-white/80 dark:bg-white/[0.06] dark:ring-white/10">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {locale === 'id' ? 'Fokus launch' : 'Launch focus'}
                </p>
                <p className="mt-0.5 truncate text-sm font-bold text-slate-950 dark:text-white">
                  {locale === 'id' ? 'Promosi + chat' : 'Promo + chat'}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[20px] border border-slate-200 bg-white p-2.5 shadow-[0_14px_34px_-32px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-900 sm:p-3">
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(250px,340px)] lg:items-center">
              <div className="grid grid-cols-3 gap-1 rounded-[15px] bg-slate-100 p-1 ring-1 ring-slate-200/70 dark:bg-white/[0.04] dark:ring-white/10">
                {collectionTabs.map(tab => {
                  const active =
                    (tab.id === 'favorites' &&
                      collectionMode === 'favorites') ||
                    (tab.id === 'history' && collectionMode === 'history') ||
                    (tab.id === 'mine' && collectionMode === 'mine');
                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      aria-current={active ? 'page' : undefined}
                      className={`inline-flex min-h-9 items-center justify-center rounded-[12px] px-2 text-center text-xs font-bold transition sm:text-[13px] ${active
                          ? 'bg-emerald-700 text-white shadow-[0_12px_24px_-18px_rgba(4,120,87,0.45)] ring-1 ring-emerald-800/10 dark:bg-emerald-500 dark:text-slate-950'
                          : 'text-slate-500 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-950/70 dark:hover:text-white'
                        }`}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </div>

              <div className="rounded-[15px] border border-slate-200 bg-white px-3 py-1 transition focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 dark:border-white/10 dark:bg-slate-950 dark:focus-within:ring-emerald-400/12">
                <label className="flex min-h-9 items-center gap-2">
                  <Search className="h-4 w-4 shrink-0 text-slate-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={
                      isFavoritesMode
                        ? locale === 'id'
                          ? 'Cari yang disimpan'
                          : 'Search saved'
                        : isHistoryMode
                          ? locale === 'id'
                            ? 'Cari yang pernah dilihat'
                            : 'Search viewed'
                          : locale === 'id'
                            ? 'Cari judul, jenis, atau status'
                            : 'Search title, type, or status'
                    }
                    className="w-full min-w-0 bg-transparent text-[13px] font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                    aria-label={
                      locale === 'id' ? 'Cari postingan' : 'Search posts'
                    }
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
                      aria-label={
                        locale === 'id' ? 'Hapus pencarian' : 'Clear search'
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </label>
              </div>
            </div>

            {collectionMode === 'mine' ? (
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-[15px] bg-slate-100 p-1 ring-1 ring-slate-200/70 dark:bg-white/[0.04] dark:ring-white/10 sm:max-w-lg">
                {statusTabs.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveStatus(tab.id)}
                    aria-pressed={activeStatus === tab.id}
                    className={`min-h-9 rounded-[12px] px-2 text-xs font-bold transition sm:text-[13px] ${activeStatus === tab.id
                        ? 'bg-emerald-700 text-white shadow-[0_12px_24px_-18px_rgba(4,120,87,0.45)] ring-1 ring-emerald-800/10 dark:bg-emerald-500 dark:text-slate-950'
                        : 'text-slate-500 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-950/70 dark:hover:text-white'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          {error ? (
            <section className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">
              {error}
            </section>
          ) : null}

          {activityNotice ? (
            <section className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
              {activityNotice}
            </section>
          ) : null}

          <section className="rounded-[20px] border border-slate-200 bg-white p-2.5 shadow-[0_14px_34px_-32px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-900 sm:p-3">
            {collectionMode === 'history' ? (
              filteredViewedReferences.length === 0 ? (
                <EmptyState
                  className="px-3 py-8 sm:py-10"
                  title={
                    query
                      ? locale === 'id'
                        ? 'Tidak ketemu'
                        : 'No match'
                      : locale === 'id'
                        ? 'Belum ada yang dilihat'
                        : 'No viewed posts yet'
                  }
                  description={
                    query
                      ? locale === 'id'
                        ? 'Coba kata lain atau hapus pencarian.'
                        : 'Try another keyword or clear search.'
                      : locale === 'id'
                        ? 'Setelah kamu buka postingan dari Home atau Search, riwayatnya muncul di sini.'
                        : 'After you open posts from Home or Search, they will appear here.'
                  }
                  action={
                    query ? (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                      >
                        {locale === 'id' ? 'Reset cari' : 'Reset search'}
                      </button>
                    ) : (
                      <Link
                        href="/explore"
                        className="inline-flex min-h-10 items-center rounded-full bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800"
                      >
                        {locale === 'id' ? 'Cari postingan' : 'Search posts'}
                      </Link>
                    )
                  }
                />
              ) : (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {filteredViewedReferences.map(item => {
                    const imageStyle = item.image
                      ? {
                        backgroundImage: `url("${item.image.replace(/"/g, '%22')}")`,
                      }
                      : undefined;

                    return (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-[18px] border border-slate-200 bg-[#fffdf7] p-2 shadow-[0_12px_28px_-26px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 hover:border-emerald-200 dark:border-white/10 dark:bg-white/[0.04]"
                      >
                        <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-2">
                          <div
                            className="relative flex h-[78px] w-full items-center justify-center overflow-hidden rounded-[15px] bg-slate-100 bg-cover bg-center text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-white/10"
                            style={imageStyle}
                          >
                            {!item.image ? (
                              <Eye className="h-5 w-5 text-emerald-500" />
                            ) : null}
                            <span className="absolute left-1.5 top-1.5 max-w-[64px] truncate rounded-full bg-white/88 px-1.5 py-0.5 text-[9px] font-bold text-slate-700 shadow-sm dark:bg-slate-950/78 dark:text-white">
                              {item.typeLabel}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <h2 className="line-clamp-2 text-[13.5px] font-bold leading-snug tracking-[-0.02em] text-slate-950 dark:text-white">
                              {item.title}
                            </h2>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200">
                                {item.priceLabel}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-white/8 dark:text-slate-300">
                                {formatDate(new Date(item.viewedAt).toISOString())}
                              </span>
                            </div>
                            {item.location ? (
                              <p className="mt-1 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                {item.location}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {item.summary ? (
                          <p className="mt-2 line-clamp-1 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
                            {item.summary}
                          </p>
                        ) : null}

                        <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-1.5">
                          <button
                            type="button"
                            onClick={() => removeViewedReference(item.id)}
                            className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
                            aria-label={
                              locale === 'id'
                                ? 'Hapus dari riwayat'
                                : 'Remove from history'
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <Link
                            href={item.href}
                            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-emerald-700 px-3 text-xs font-bold text-white transition hover:bg-emerald-800"
                          >
                            <Eye className="h-4 w-4" />
                            {locale === 'id' ? 'Buka lagi' : 'Open again'}
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )
            ) : collectionMode === 'favorites' ? (
              filteredReferences.length === 0 ? (
                <EmptyState
                  className="px-3 py-8 sm:py-10"
                  title={
                    query
                      ? locale === 'id'
                        ? 'Tidak ketemu'
                        : 'No match'
                      : locale === 'id'
                        ? 'Belum ada yang disimpan'
                        : 'No saved posts yet'
                  }
                  description={
                    query
                      ? locale === 'id'
                        ? 'Coba kata lain atau hapus pencarian.'
                        : 'Try another keyword or clear search.'
                      : locale === 'id'
                        ? 'Simpan produk, jasa, atau usaha dari Search supaya gampang dibuka lagi.'
                        : 'Save products, services, or businesses from Search so they are easy to open again.'
                  }
                  action={
                    query ? (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                      >
                        {locale === 'id' ? 'Reset cari' : 'Reset search'}
                      </button>
                    ) : (
                      <Link
                        href="/explore"
                        className="inline-flex min-h-10 items-center rounded-full bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800"
                      >
                        {locale === 'id' ? 'Cari inspirasi' : 'Search ideas'}
                      </Link>
                    )
                  }
                />
              ) : (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {filteredReferences.map(item => {
                    const imageStyle = item.image
                      ? {
                        backgroundImage: `url("${item.image.replace(/"/g, '%22')}")`,
                      }
                      : undefined;

                    return (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-[18px] border border-slate-200 bg-[#fffdf7] p-2 shadow-[0_12px_28px_-26px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 hover:border-emerald-200 dark:border-white/10 dark:bg-white/[0.04]"
                      >
                        <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-2">
                          <div
                            className="relative flex h-[78px] w-full items-center justify-center overflow-hidden rounded-[15px] bg-slate-100 bg-cover bg-center text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-white/10"
                            style={imageStyle}
                          >
                            {!item.image ? (
                              <Heart className="h-5 w-5 text-rose-400" />
                            ) : null}
                            <span className="absolute left-1.5 top-1.5 max-w-[64px] truncate rounded-full bg-white/88 px-1.5 py-0.5 text-[9px] font-bold text-slate-700 shadow-sm dark:bg-slate-950/78 dark:text-white">
                              {item.typeLabel}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <h2 className="line-clamp-2 text-[13.5px] font-bold leading-snug tracking-[-0.02em] text-slate-950 dark:text-white">
                              {item.title}
                            </h2>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200">
                                {item.priceLabel}
                              </span>
                              {item.quantity > 1 ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-white/8 dark:text-slate-300">
                                  x{item.quantity}
                                </span>
                              ) : null}
                            </div>
                            {item.location ? (
                              <p className="mt-1 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                {item.location}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {item.summary ? (
                          <p className="mt-2 line-clamp-1 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
                            {item.summary}
                          </p>
                        ) : null}

                        <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-1.5">
                          <button
                            type="button"
                            onClick={() => removeReference(item.id)}
                            className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
                            aria-label={
                              locale === 'id'
                                ? 'Hapus dari simpanan'
                                : 'Remove saved post'
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <Link
                            href={item.href}
                            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-emerald-700 px-3 text-xs font-bold text-white transition hover:bg-emerald-800"
                          >
                            <Eye className="h-4 w-4" />
                            {item.actionLabel ||
                              (locale === 'id' ? 'Buka' : 'Open')}
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )
            ) : loading ? (
              <div className="py-1">
                <MyListingsListSkeleton count={3} />
              </div>
            ) : filteredItems.length === 0 ? (
              <EmptyState
                className="px-3 py-8 sm:py-10"
                title={
                  query
                    ? locale === 'id'
                      ? 'Tidak ketemu'
                      : 'No match'
                    : locale === 'id'
                      ? 'Belum ada postingan'
                      : 'No posts yet'
                }
                description={
                  query
                    ? locale === 'id'
                      ? 'Coba kata lain atau pindah tab Draft, Tayang, atau Arsip.'
                      : 'Try another keyword or switch Draft, Live, or Archived tabs.'
                    : locale === 'id'
                      ? 'Mulai dari satu postingan produk, jasa, atau profil usaha yang paling mudah dijelaskan.'
                      : 'Start with one product, service, or business profile that is easy to explain.'
                }
                action={
                  query ? (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                    >
                      {locale === 'id' ? 'Reset cari' : 'Reset search'}
                    </button>
                  ) : (
                    <Link
                      href={createHref}
                      className="inline-flex min-h-10 items-center rounded-full bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800"
                    >
                      {createLabel}
                    </Link>
                  )
                }
              />
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map(item => {
                  const id = parseId(item.id);
                  const rawType = item.type || item.content_type || 'listing';
                  const typeLabel = listingTypeLabel(rawType, locale);
                  const rawStatus =
                    item.content_status || item.status || activeStatus;
                  const normalizedStatus = rawStatus.toLowerCase();
                  const cardStatus: ListingStatus =
                    normalizedStatus === 'active' ||
                      normalizedStatus === 'archived'
                      ? normalizedStatus
                      : 'draft';
                  const itemStatus = listingStatusLabel(rawStatus, locale);
                  const progress = readProgress(item);
                  const imageUrl = resolveListingImage(item);
                  const imageStyle = imageUrl
                    ? {
                      backgroundImage: `url("${imageUrl.replace(/"/g, '%22')}")`,
                    }
                    : undefined;
                  const statusToggle = listingStatusToggle(cardStatus, locale);
                  const actionGridClass = statusToggle
                    ? 'grid-cols-3'
                    : 'grid-cols-2';
                  const activity = readListingActivity(item);
                  const activityLabel = activity
                    ? locale === 'id'
                      ? activity.labelId
                      : activity.labelEn
                    : '';
                  const activityNote = activity
                    ? locale === 'id'
                      ? activity.noteId
                      : activity.noteEn
                    : '';
                  const activityBusy = updatingActivityId === item.id;

                  return (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-[18px] border border-slate-200 bg-[#fffdf7] p-2 shadow-[0_12px_28px_-26px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 hover:border-emerald-200 dark:border-white/10 dark:bg-white/[0.04]"
                    >
                      <div className="grid grid-cols-[78px_minmax(0,1fr)] gap-2">
                        <div
                          className="relative flex h-[84px] w-full items-center justify-center overflow-hidden rounded-[15px] bg-slate-100 bg-cover bg-center text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-white/10"
                          style={imageStyle}
                          aria-label={imageUrl ? typeLabel : undefined}
                        >
                          {!imageUrl ? (
                            <ImageIcon className="h-5 w-5" />
                          ) : null}
                          <span
                            className={`absolute left-1.5 top-1.5 max-w-[68px] truncate rounded-full px-1.5 py-0.5 text-[9px] font-bold ${statusToneClass(rawStatus)}`}
                          >
                            {itemStatus}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <h2 className="line-clamp-2 text-[13.5px] font-bold leading-snug tracking-[-0.02em] text-slate-950 dark:text-white">
                            {item.title ||
                              (locale === 'id' ? 'Tanpa judul' : 'Untitled')}
                          </h2>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-white/8 dark:text-slate-300">
                              {typeLabel}
                            </span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-white/10">
                              {formatDate(item.updated_at || item.created_at)}
                            </span>
                            {activityLabel ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-400/12 dark:text-emerald-200 dark:ring-emerald-400/20">
                                {activityLabel}
                              </span>
                            ) : null}
                          </div>

                          {summarizeText(item.summary) ? (
                            <p className="mt-1.5 line-clamp-1 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
                              {summarizeText(item.summary)}
                            </p>
                          ) : (
                            <p className="mt-1.5 line-clamp-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                              {locale === 'id'
                                ? 'Belum ada ringkasan. Tambahkan cerita singkat supaya orang cepat paham.'
                                : 'No summary yet. Add a short story so people understand faster.'}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 rounded-[14px] bg-slate-50 p-2 dark:bg-white/[0.04]">
                        <div className="flex gap-2">
                          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200">
                            {cardStatus === 'draft' ? (
                              <PencilLine className="h-3.5 w-3.5" />
                            ) : cardStatus === 'active' ? (
                              <MessageCircle className="h-3.5 w-3.5" />
                            ) : (
                              <Clock3 className="h-3.5 w-3.5" />
                            )}
                          </span>
                          <p className="line-clamp-2 text-[11px] font-bold leading-4 text-slate-600 dark:text-slate-300">
                            {listingNextStep(cardStatus, locale)}
                          </p>
                        </div>

                        {cardStatus === 'active' ? (
                          <div className="mt-2 border-t border-slate-200/80 pt-2 dark:border-white/10">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                                {locale === 'id'
                                  ? 'Update cepat'
                                  : 'Quick update'}
                              </p>
                              {activityNote ? (
                                <p className="hidden min-w-0 truncate text-[10px] font-bold text-emerald-700 dark:text-emerald-200 sm:block">
                                  {activityNote}
                                </p>
                              ) : null}
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              {DAILY_ACTIVITY_OPTIONS.map(option => {
                                const activeActivity =
                                  activity?.kind === option.id;
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    disabled={activityBusy}
                                    onClick={() =>
                                      void updateDailyActivity(item, option.id)
                                    }
                                    className={`min-h-8 rounded-full border px-1.5 text-[10px] font-bold transition disabled:cursor-wait disabled:opacity-60 ${activeActivity
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/12 dark:text-emerald-200'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-emerald-400/20 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-200'
                                      }`}
                                  >
                                    {activityBusy
                                      ? locale === 'id'
                                        ? 'Simpan...'
                                        : 'Saving...'
                                      : locale === 'id'
                                        ? option.labelId
                                        : option.labelEn}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        {cardStatus === 'draft' ? (
                          <div className="mt-2">
                            <div className="h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-white/10">
                              <div
                                className="h-full rounded-full bg-amber-500"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <p className="mt-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              {locale === 'id'
                                ? `Kelengkapan ${progress}%`
                                : `${progress}% complete`}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      <div className={`mt-2 grid gap-1.5 ${actionGridClass}`}>
                        {cardStatus === 'draft' ? (
                          <>
                            <Link
                              href={`/create?draft=${id}`}
                              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-amber-600 px-3 text-xs font-bold text-white transition hover:bg-amber-700"
                            >
                              <PencilLine className="h-4 w-4" />
                              {locale === 'id'
                                ? 'Lanjut isi draft'
                                : 'Continue draft'}
                            </Link>
                            <button
                              type="button"
                              onClick={() => void deleteDraft(item)}
                              disabled={deletingDraftId === item.id}
                              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-60 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/15"
                              aria-label={
                                locale === 'id' ? 'Hapus draft' : 'Delete draft'
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                              {deletingDraftId === item.id
                                ? locale === 'id'
                                  ? 'Menghapus...'
                                  : 'Deleting...'
                                : locale === 'id'
                                  ? 'Hapus'
                                  : 'Delete'}
                            </button>
                          </>
                        ) : (
                          <>
                            <Link
                              href={`/create?draft=${id}`}
                              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                            >
                              <PencilLine className="h-4 w-4" />
                              {locale === 'id' ? 'Edit' : 'Edit'}
                            </Link>
                            <Link
                              href={`/content/${id}`}
                              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-emerald-700 px-3 text-xs font-bold text-white transition hover:bg-emerald-800"
                            >
                              <Eye className="h-4 w-4" />
                              {locale === 'id' ? 'Lihat' : 'View'}
                            </Link>
                            {statusToggle ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateListingStatus(
                                    item,
                                    statusToggle.nextStatus,
                                  )
                                }
                                disabled={updatingStatusId === item.id}
                                className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border-2 px-3 text-xs font-bold transition disabled:cursor-wait disabled:opacity-60 ${statusToggle.className}`}
                              >
                                <statusToggle.icon className="h-4 w-4" />
                                {statusToggle.label}
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </CreateMarketplaceShell>
  );

  return (
    <CreateMarketplaceShell>
      <div className="mx-auto w-full max-w-5xl px-0 py-0 sm:px-1">
        <div className="rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] p-3 dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] dark:bg-[color:var(--app-surface-strong)] sm:rounded-2xl sm:border-x sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-[color:color-mix(in_srgb,var(--app-accent)_12%,white)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)] dark:bg-emerald-400/10">
                <HeaderIcon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-[17px] font-bold leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {pageTitle}
                </h1>
                <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-[color:var(--app-text-soft)]">
                  {pageDescription}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:justify-end">
              <Link
                href={primaryAction.href}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[13px] bg-[color:var(--app-accent-strong)] px-3 text-xs font-bold text-[color:var(--app-text-inverse)] shadow-[0_14px_24px_-20px_rgba(15,23,42,0.35)]"
              >
                <PrimaryActionIcon className="h-3.5 w-3.5" />
                {primaryAction.label}
              </Link>
              <Link
                href={
                  collectionMode !== 'mine' ? '/my-listings' : '/transactions'
                }
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[13px] border border-[color:var(--app-border)] bg-white px-3 text-xs font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950"
              >
                <SecondaryActionIcon className="h-3.5 w-3.5" />
                {collectionMode !== 'mine'
                  ? locale === 'id'
                    ? 'Postingan'
                    : 'Posts'
                  : locale === 'id'
                    ? 'Transaksi'
                    : 'Transactions'}
              </Link>
            </div>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(230px,320px)] lg:items-center">
            <div className="grid grid-cols-3 gap-1 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-1 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55">
              {collectionTabs.map(tab => {
                const active =
                  (tab.id === 'favorites' && collectionMode === 'favorites') ||
                  (tab.id === 'history' && collectionMode === 'history') ||
                  (tab.id === 'mine' && collectionMode === 'mine');
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={`inline-flex min-h-9 items-center justify-center rounded-[12px] px-2 text-xs font-bold transition sm:text-[13px] ${active
                        ? 'bg-white text-[color:var(--app-accent)] shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)] dark:bg-slate-900 dark:text-emerald-300'
                        : 'text-[color:var(--app-text-soft)] hover:bg-white/70 hover:text-[color:var(--app-text)] dark:hover:bg-slate-900'
                      }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>

            <div className="ui-field-shell rounded-[14px] border border-slate-300 bg-white px-2.5 py-1 shadow-none transition focus-within:border-[color:var(--app-accent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--app-accent)_14%,transparent)] dark:border-slate-700 dark:bg-slate-950 dark:focus-within:border-emerald-400">
              <label className="flex min-h-[34px] items-center gap-2">
                <Search className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
                <input
                  type="search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={
                    isFavoritesMode
                      ? locale === 'id'
                        ? 'Cari favorit'
                        : 'Search favorites'
                      : isHistoryMode
                        ? locale === 'id'
                          ? 'Cari riwayat'
                          : 'Search history'
                        : locale === 'id'
                          ? 'Cari postingan'
                          : 'Search posts'
                  }
                  className="w-full min-w-0 bg-transparent text-[13px] font-semibold text-[color:var(--app-text)] outline-none placeholder:text-slate-400"
                  aria-label={
                    locale === 'id' ? 'Cari postingan' : 'Search listings'
                  }
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[color:var(--app-text-soft)] transition hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800"
                    aria-label={
                      locale === 'id' ? 'Hapus pencarian' : 'Clear search'
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </label>
            </div>
          </div>

          {collectionMode === 'mine' ? (
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-1 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55 sm:max-w-md">
              {statusTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveStatus(tab.id)}
                  className={`min-h-9 rounded-[12px] px-2 text-xs font-bold transition sm:text-[13px] ${activeStatus === tab.id
                      ? 'bg-white text-[color:var(--app-accent)] shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)] dark:bg-slate-900 dark:text-emerald-300'
                      : 'text-[color:var(--app-text-soft)] hover:bg-white/70 hover:text-[color:var(--app-text)] dark:hover:bg-slate-900'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}

          {error && (
            <div className="mt-4 rounded-lg border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-xs text-[color:var(--app-danger)]">
              {error}
            </div>
          )}

          {collectionMode === 'history' ? (
            <EmptyState
              className="mt-3 px-3 py-6 sm:py-7"
              title={
                query
                  ? locale === 'id'
                    ? 'Tidak ketemu'
                    : 'No match'
                  : locale === 'id'
                    ? 'Riwayat masih kosong'
                    : 'No viewed history yet'
              }
              description={
                query
                  ? locale === 'id'
                    ? 'Coba kata lain atau reset pencarian.'
                    : 'Try another keyword or reset search.'
                  : locale === 'id'
                    ? 'Setelah kamu membuka listing dari Search atau Home, riwayatnya akan muncul di sini.'
                    : 'After you open listings from Search or Home, your viewed history will show here.'
              }
              action={
                query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="inline-flex min-h-9 items-center rounded-xl border border-[color:var(--app-border-strong)] bg-white px-3 text-xs font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:bg-slate-950"
                  >
                    {locale === 'id' ? 'Reset cari' : 'Reset search'}
                  </button>
                ) : (
                  <Link
                    href="/explore"
                    className="inline-flex min-h-9 items-center rounded-xl bg-[color:var(--app-accent-strong)] px-3 text-xs font-bold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                  >
                    {locale === 'id' ? 'Cari listing' : 'Search listings'}
                  </Link>
                )
              }
            />
          ) : collectionMode === 'favorites' ? (
            filteredReferences.length === 0 ? (
              <EmptyState
                className="mt-3 px-3 py-6 sm:py-7"
                title={
                  query
                    ? locale === 'id'
                      ? 'Tidak ketemu'
                      : 'No match'
                    : locale === 'id'
                      ? 'Belum ada favorit'
                      : 'No favorites yet'
                }
                description={
                  query
                    ? locale === 'id'
                      ? 'Coba kata lain atau reset pencarian.'
                      : 'Try another keyword or reset search.'
                    : locale === 'id'
                      ? 'Buka Search, tambah item yang menarik, nanti referensinya muncul di sini.'
                      : 'Open Search, add interesting items, and the references will show here.'
                }
                action={
                  query ? (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="inline-flex min-h-9 items-center rounded-xl border border-[color:var(--app-border-strong)] bg-white px-3 text-xs font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:bg-slate-950"
                    >
                      {locale === 'id' ? 'Reset cari' : 'Reset search'}
                    </button>
                  ) : (
                    <Link
                      href="/explore"
                      className="inline-flex min-h-9 items-center rounded-xl bg-[color:var(--app-accent-strong)] px-3 text-xs font-bold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                    >
                      {locale === 'id' ? 'Cari listing' : 'Search listings'}
                    </Link>
                  )
                }
              />
            ) : (
              <div className="mt-4 space-y-3">
                {filteredReferences.map(item => {
                  const imageStyle = item.image
                    ? {
                      backgroundImage: `url("${item.image.replace(/"/g, '%22')}")`,
                    }
                    : undefined;

                  return (
                    <div
                      key={item.id}
                      className="rounded-[18px] border border-[color:var(--app-border)] bg-white p-3 shadow-[0_14px_32px_-26px_rgba(15,23,42,0.26)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/72"
                    >
                      <div className="flex gap-3">
                        <div
                          className="flex h-[86px] w-[86px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] bg-cover bg-center text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]"
                          style={imageStyle}
                        >
                          {item.image ? null : <Heart className="h-6 w-6" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h2 className="line-clamp-2 text-[15px] font-bold leading-snug text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                                {item.title}
                              </h2>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-text)] dark:bg-slate-900">
                                  {item.typeLabel}
                                </span>
                                <span className="rounded-full bg-[color:color-mix(in_srgb,var(--app-accent)_10%,transparent)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-accent)]">
                                  {item.priceLabel}
                                </span>
                                {item.quantity > 1 ? (
                                  <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-text-soft)] dark:bg-slate-900">
                                    x{item.quantity}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <span className="hidden shrink-0 text-[11px] font-semibold text-[color:var(--app-text-soft)] min-[420px]:inline">
                              {item.location}
                            </span>
                          </div>

                          {item.summary ? (
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                              {item.summary}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                        <button
                          type="button"
                          onClick={() => removeReference(item.id)}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] border-2 border-slate-300 bg-white px-3 text-sm font-bold text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] dark:border-slate-700 dark:bg-slate-950"
                          aria-label={
                            locale === 'id'
                              ? 'Hapus favorit'
                              : 'Remove favorite'
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <Link
                          href={item.href}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] bg-[color:var(--app-accent-strong)] px-3 text-sm font-bold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                        >
                          {item.actionLabel ||
                            (locale === 'id' ? 'Buka' : 'Open')}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : loading ? (
            <MyListingsListSkeleton count={3} />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              className="mt-3 px-3 py-6 sm:py-7"
              title={
                query
                  ? locale === 'id'
                    ? 'Tidak ketemu'
                    : 'No match'
                  : locale === 'id'
                    ? 'Belum ada'
                    : 'No listings found for this status'
              }
              description={
                query
                  ? locale === 'id'
                    ? 'Coba kata lain atau pindah tab.'
                    : 'Try another keyword or switch tabs.'
                  : locale === 'id'
                    ? 'Buat baru atau pindah tab.'
                    : 'Start a new post or switch tabs to see the others.'
              }
              action={
                query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="inline-flex min-h-9 items-center rounded-xl border border-[color:var(--app-border-strong)] bg-white px-3 text-xs font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:bg-slate-950"
                  >
                    {locale === 'id' ? 'Reset cari' : 'Reset search'}
                  </button>
                ) : (
                  <Link
                    href={createHref}
                    className="inline-flex min-h-9 items-center rounded-xl bg-[color:var(--app-accent-strong)] px-3 text-xs font-bold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                  >
                    {createLabel}
                  </Link>
                )
              }
            />
          ) : (
            <div className="mt-4 space-y-3">
              {filteredItems.map(item => {
                const id = parseId(item.id);
                const rawType = item.type || item.content_type || 'listing';
                const typeLabel = listingTypeLabel(rawType, locale);
                const rawStatus =
                  item.content_status || item.status || activeStatus;
                const itemStatus = listingStatusLabel(rawStatus, locale);
                const normalizedStatus = rawStatus.toLowerCase();
                const cardStatus: ListingStatus =
                  normalizedStatus === 'active' ||
                    normalizedStatus === 'archived'
                    ? normalizedStatus
                    : 'draft';
                const progress = readProgress(item);
                const imageUrl = resolveListingImage(item);
                const imageStyle = imageUrl
                  ? {
                    backgroundImage: `url("${imageUrl.replace(/"/g, '%22')}")`,
                  }
                  : undefined;
                const statusToggle = listingStatusToggle(cardStatus, locale);
                const actionGridClass = statusToggle
                  ? 'grid-cols-3'
                  : 'grid-cols-2';

                return (
                  <div
                    key={item.id}
                    className="rounded-[18px] border border-[color:var(--app-border)] bg-white p-3 shadow-[0_14px_32px_-26px_rgba(15,23,42,0.26)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/72"
                  >
                    <div className="flex gap-3">
                      <div
                        className="flex h-[86px] w-[86px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] bg-cover bg-center text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]"
                        style={imageStyle}
                        aria-label={imageUrl ? typeLabel : undefined}
                      >
                        {!imageUrl ? <ImageIcon className="h-6 w-6" /> : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="line-clamp-2 text-[15px] font-bold leading-snug text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                              {item.title ||
                                (locale === 'id' ? 'Tanpa judul' : 'Untitled')}
                            </h2>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-text)] dark:bg-slate-900">
                                {typeLabel}
                              </span>
                              <span className="rounded-full bg-[color:color-mix(in_srgb,var(--app-accent)_10%,transparent)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-accent)]">
                                {itemStatus}
                              </span>
                            </div>
                          </div>
                          <span className="hidden shrink-0 text-[11px] font-semibold text-[color:var(--app-text-soft)] min-[420px]:inline">
                            {formatDate(item.updated_at || item.created_at)}
                          </span>
                        </div>

                        {summarizeText(item.summary) ? (
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                            {summarizeText(item.summary)}
                          </p>
                        ) : null}

                        {activeStatus === 'draft' ? (
                          <div className="mt-3">
                            <div className="h-2 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)] dark:bg-slate-900">
                              <div
                                className="h-full bg-[color:var(--app-warning)]"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <p className="mt-1 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                              {locale === 'id'
                                ? 'Progress'
                                : 'Current progress'}
                              : {progress}%
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className={`mt-3 grid gap-2 ${actionGridClass}`}>
                      {activeStatus === 'draft' ? (
                        <>
                          <Link
                            href={`/create?draft=${id}`}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] bg-[color:var(--app-warning)] px-3 text-sm font-bold text-[color:var(--app-text-inverse)]"
                          >
                            {locale === 'id' ? 'Lanjut isi' : 'Continue Draft'}
                          </Link>
                          <button
                            type="button"
                            onClick={() => void deleteDraft(item)}
                            disabled={deletingDraftId === item.id}
                            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[14px] bg-[color:var(--app-danger-soft)] px-3 text-sm font-bold text-[color:var(--app-danger)] transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-red-400/15"
                          >
                            <Trash2 className="h-4 w-4" />
                            {deletingDraftId === item.id
                              ? locale === 'id'
                                ? 'Menghapus...'
                                : 'Deleting...'
                              : locale === 'id'
                                ? 'Hapus'
                                : 'Delete'}
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            href={`/create?draft=${id}`}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] border-2 border-slate-300 bg-white px-3 text-sm font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-slate-700 dark:bg-slate-950"
                          >
                            {locale === 'id' ? 'Edit' : 'Edit'}
                          </Link>
                          <Link
                            href={`/content/${id}`}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] bg-[color:var(--app-accent-strong)] px-3 text-sm font-bold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                          >
                            {locale === 'id' ? 'Lihat' : 'View'}
                          </Link>
                          {statusToggle ? (
                            <button
                              type="button"
                              onClick={() =>
                                void updateListingStatus(
                                  item,
                                  statusToggle.nextStatus,
                                )
                              }
                              disabled={updatingStatusId === item.id}
                              className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[14px] border-2 px-3 text-sm font-bold transition disabled:cursor-wait disabled:opacity-60 ${statusToggle.className}`}
                            >
                              <statusToggle.icon className="h-4 w-4" />
                              {statusToggle.label}
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CreateMarketplaceShell>
  );
}
