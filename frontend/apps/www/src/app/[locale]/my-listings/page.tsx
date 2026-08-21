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
  Eye,
  EyeOff,
  ImageIcon,
  MoreHorizontal,
  PencilLine,
  Plus,
  Search,
  Trash2,
  X,
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

function listingStatusToggle(
  status: ListingStatus,
  locale: string,
): {
  label: string;
  nextStatus: 'active' | 'archived';
} | null {
  if (status === 'active') {
    return {
      label: locale === 'id' ? 'Arsipkan' : 'Archive',
      nextStatus: 'archived',
    };
  }

  if (status === 'archived') {
    return {
      label: locale === 'id' ? 'Tayangkan' : 'Publish',
      nextStatus: 'active',
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

  const [activeStatus, setActiveStatus] = useState<ListingStatus>('active');
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
      { id: 'active' as const, label: locale === 'id' ? 'Tayang' : 'Live' },
      { id: 'draft' as const, label: locale === 'id' ? 'Draft' : 'Draft' },
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
        label: locale === 'id' ? 'Milik saya' : 'Mine',
      },
      {
        id: 'favorites',
        href: '/my-listings?filter=favorites',
        label: locale === 'id' ? 'Disimpan' : 'Saved',
      },
      {
        id: 'history',
        href: '/my-listings?filter=history',
        label: locale === 'id' ? 'Riwayat' : 'History',
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
          ? `${option.labelId} tersimpan.`
          : `${option.labelEn} saved.`,
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

    setUpdatingStatusId(item.id);
    setError('');
    setActivityNotice('');

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

      // The page is filtered by status, so a successfully moved listing should
      // leave the current list instead of lingering with a mismatched badge.
      setItems(current => current.filter(entry => entry.id !== item.id));
      setActivityNotice(
        nextStatus === 'active'
          ? locale === 'id'
            ? 'Postingan ditayangkan.'
            : 'Listing published.'
          : locale === 'id'
            ? 'Postingan dipindahkan ke Arsip.'
            : 'Listing moved to Archive.',
      );
    } catch (err) {
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


    const isMine = collectionMode === 'mine';
    const pageTitle =
      collectionMode === 'favorites'
        ? locale === 'id'
          ? 'Disimpan'
          : 'Saved'
        : collectionMode === 'history'
          ? locale === 'id'
            ? 'Riwayat'
            : 'History'
          : locale === 'id'
            ? 'Kelola postingan'
            : 'Manage listings';

    const pageDescription =
      collectionMode === 'favorites'
        ? locale === 'id'
          ? 'Yang kamu simpan untuk dibuka lagi.'
          : 'Things you saved for later.'
        : collectionMode === 'history'
          ? locale === 'id'
            ? 'Postingan yang baru kamu lihat.'
            : 'Listings you recently viewed.'
          : locale === 'id'
            ? 'Edit, tayangkan, atau arsipkan dari satu tempat.'
            : 'Edit, publish, or archive from one place.';

    const closeDetails = (target: EventTarget & HTMLElement) => {
      target.closest('details')?.removeAttribute('open');
    };

    return (
      <CreateMarketplaceShell>
        <div className="mx-auto w-full max-w-5xl px-0 pb-8 sm:px-2 lg:px-3">
          <header className="border-b border-slate-200 bg-white px-3 pb-3 pt-2 dark:border-white/10 dark:bg-slate-950 sm:rounded-t-[20px] sm:px-4 sm:pt-4">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-black tracking-[-0.025em] text-slate-950 dark:text-white sm:text-xl">
                  {pageTitle}
                </h1>
                <p className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {pageDescription}
                </p>
              </div>

              <Link
                href={isMine ? '/create' : '/explore'}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-emerald-700 px-3.5 text-xs font-bold text-white transition hover:bg-emerald-800 sm:px-4 sm:text-sm"
              >
                {isMine ? <Plus className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                {isMine
                  ? locale === 'id'
                    ? 'Buat baru'
                    : 'Create'
                  : locale === 'id'
                    ? 'Jelajahi'
                    : 'Explore'}
              </Link>
            </div>

            <nav className="mt-3 grid grid-cols-3 gap-1 rounded-[14px] bg-slate-100 p-1 dark:bg-white/[0.05]" aria-label={locale === 'id' ? 'Bagian postingan' : 'Listing sections'}>
              {collectionTabs.map(tab => {
                const active = tab.id === collectionMode;
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex min-h-9 items-center justify-center rounded-[11px] px-2 text-xs font-bold transition sm:text-[13px] ${
                      active
                        ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-300'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              {isMine ? (
                <div className="grid shrink-0 grid-cols-3 gap-1 rounded-[13px] bg-slate-100 p-1 dark:bg-white/[0.05] sm:w-[310px]">
                  {statusTabs.map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveStatus(tab.id)}
                      aria-pressed={activeStatus === tab.id}
                      className={`min-h-9 rounded-[10px] px-2 text-xs font-bold transition ${
                        activeStatus === tab.id
                          ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-300'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-[13px] border border-slate-200 bg-white px-3 transition focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 dark:border-white/10 dark:bg-slate-950 dark:focus-within:ring-emerald-400/15">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={
                    locale === 'id'
                      ? isMine
                        ? 'Cari postingan'
                        : collectionMode === 'favorites'
                          ? 'Cari yang disimpan'
                          : 'Cari riwayat'
                      : isMine
                        ? 'Search listings'
                        : collectionMode === 'favorites'
                          ? 'Search saved'
                          : 'Search history'
                  }
                  className="w-full min-w-0 bg-transparent text-[13px] font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                  aria-label={locale === 'id' ? 'Cari' : 'Search'}
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/8 dark:hover:text-white"
                    aria-label={locale === 'id' ? 'Hapus pencarian' : 'Clear search'}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </label>
            </div>
          </header>

          {error ? (
            <div className="border-b border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100 sm:px-4">
              {error}
            </div>
          ) : null}

          {activityNotice ? (
            <div className="border-b border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100 sm:px-4">
              {activityNotice}
            </div>
          ) : null}

          <section className="bg-white dark:bg-slate-950 sm:rounded-b-[20px] sm:border-x sm:border-b sm:border-slate-200 sm:dark:border-white/10">
            {collectionMode === 'mine' ? (
              loading ? (
                <div className="p-3 sm:p-4">
                  <MyListingsListSkeleton count={4} />
                </div>
              ) : filteredItems.length === 0 ? (
                <EmptyState
                  className="px-4 py-12"
                  title={
                    query
                      ? locale === 'id'
                        ? 'Tidak ditemukan'
                        : 'No match'
                      : activeStatus === 'active'
                        ? locale === 'id'
                          ? 'Belum ada yang tayang'
                          : 'Nothing live yet'
                        : activeStatus === 'draft'
                          ? locale === 'id'
                            ? 'Tidak ada draft'
                            : 'No drafts'
                          : locale === 'id'
                            ? 'Arsip masih kosong'
                            : 'Archive is empty'
                  }
                  description={
                    query
                      ? locale === 'id'
                        ? 'Coba kata lain atau hapus pencarian.'
                        : 'Try another keyword or clear search.'
                      : activeStatus === 'active'
                        ? locale === 'id'
                          ? 'Postingan yang sudah diterbitkan akan muncul di sini.'
                          : 'Published listings will appear here.'
                        : activeStatus === 'draft'
                          ? locale === 'id'
                            ? 'Draft tersimpan otomatis saat kamu belum selesai membuat postingan.'
                            : 'Drafts are saved when you have not finished a listing.'
                          : locale === 'id'
                            ? 'Postingan yang kamu arsipkan akan tetap tersimpan di sini.'
                            : 'Archived listings stay available here.'
                  }
                  action={
                    query ? (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                      >
                        {locale === 'id' ? 'Hapus pencarian' : 'Clear search'}
                      </button>
                    ) : (
                      <Link
                        href="/create"
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800"
                      >
                        <Plus className="h-4 w-4" />
                        {locale === 'id' ? 'Buat postingan' : 'Create listing'}
                      </Link>
                    )
                  }
                />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/8">
                  {filteredItems.map(item => {
                    const id = parseId(item.id);
                    const rawType = item.type || item.content_type || 'listing';
                    const typeLabel = listingTypeLabel(rawType, locale);
                    const rawStatus = item.content_status || item.status || activeStatus;
                    const normalizedStatus = rawStatus.toLowerCase();
                    const cardStatus: ListingStatus =
                      normalizedStatus === 'active' || normalizedStatus === 'archived'
                        ? normalizedStatus
                        : 'draft';
                    const itemStatus = listingStatusLabel(rawStatus, locale);
                    const progress = readProgress(item);
                    const imageUrl = resolveListingImage(item);
                    const imageStyle = imageUrl
                      ? { backgroundImage: `url("${imageUrl.replace(/"/g, '%22')}")` }
                      : undefined;
                    const statusToggle = listingStatusToggle(cardStatus, locale);
                    const activity = readListingActivity(item);
                    const activityLabel = activity
                      ? locale === 'id'
                        ? activity.labelId
                        : activity.labelEn
                      : '';
                    const activityBusy = updatingActivityId === item.id;
                    const statusBusy = updatingStatusId === item.id;

                    const primaryAction =
                      cardStatus === 'draft'
                        ? {
                            label: locale === 'id' ? 'Lanjutkan' : 'Continue',
                            href: `/create?draft=${id}`,
                            tone: 'bg-amber-600 text-white hover:bg-amber-700',
                          }
                        : cardStatus === 'archived'
                          ? null
                          : {
                              label: locale === 'id' ? 'Edit' : 'Edit',
                              href: `/create?draft=${id}`,
                              tone: 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-white',
                            };

                    return (
                      <article key={item.id} className="relative p-3 sm:p-4">
                        <div className="flex min-w-0 gap-3">
                          <Link
                            href={cardStatus === 'draft' ? `/create?draft=${id}` : `/content/${id}`}
                            className="relative h-[82px] w-[82px] shrink-0 overflow-hidden rounded-[14px] bg-slate-100 bg-cover bg-center ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-white/10 sm:h-[92px] sm:w-[92px]"
                            style={imageStyle}
                            aria-label={item.title || typeLabel}
                          >
                            {!imageUrl ? (
                              <span className="absolute inset-0 grid place-items-center text-slate-400">
                                <ImageIcon className="h-5 w-5" />
                              </span>
                            ) : null}
                            <span className={`absolute left-1.5 top-1.5 max-w-[70px] truncate rounded-full px-2 py-0.5 text-[9px] font-bold ${statusToneClass(rawStatus)}`}>
                              {itemStatus}
                            </span>
                          </Link>

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              <div className="min-w-0">
                                <Link
                                  href={cardStatus === 'draft' ? `/create?draft=${id}` : `/content/${id}`}
                                  className="line-clamp-2 text-[14px] font-bold leading-snug text-slate-950 hover:text-emerald-700 dark:text-white dark:hover:text-emerald-300 sm:text-[15px]"
                                >
                                  {item.title || (locale === 'id' ? 'Tanpa judul' : 'Untitled')}
                                </Link>
                                <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 sm:text-[11px]">
                                  <span>{typeLabel}</span>
                                  <span aria-hidden="true">•</span>
                                  <span>{formatDate(item.updated_at || item.created_at)}</span>
                                  {activityLabel && cardStatus === 'active' ? (
                                    <>
                                      <span aria-hidden="true">•</span>
                                      <span className="text-emerald-700 dark:text-emerald-300">{activityLabel}</span>
                                    </>
                                  ) : null}
                                </p>
                              </div>

                              <details className="group relative shrink-0">
                                <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-white [&::-webkit-details-marker]:hidden" aria-label={locale === 'id' ? 'Aksi lainnya' : 'More actions'}>
                                  <MoreHorizontal className="h-5 w-5" />
                                </summary>
                                <div className="absolute right-0 top-10 z-30 w-[240px] overflow-hidden rounded-[16px] border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-950/10 dark:border-white/10 dark:bg-slate-900">
                                  {cardStatus === 'active' ? (
                                    <>
                                      <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                        {locale === 'id' ? 'Ketersediaan hari ini' : 'Availability today'}
                                      </p>
                                      {DAILY_ACTIVITY_OPTIONS.map(option => {
                                        const active = activity?.kind === option.id;
                                        return (
                                          <button
                                            key={option.id}
                                            type="button"
                                            disabled={activityBusy}
                                            onClick={event => {
                                              closeDetails(event.currentTarget);
                                              void updateDailyActivity(item, option.id);
                                            }}
                                            className={`flex w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 text-left text-xs font-semibold transition disabled:opacity-50 ${
                                              active
                                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/12 dark:text-emerald-200'
                                                : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/6'
                                            }`}
                                          >
                                            <span>{locale === 'id' ? option.labelId : option.labelEn}</span>
                                            {active ? <span className="text-[10px]">✓</span> : null}
                                          </button>
                                        );
                                      })}
                                      <div className="my-1 border-t border-slate-100 dark:border-white/8" />
                                    </>
                                  ) : null}

                                  {cardStatus === 'active' && statusToggle ? (
                                    <button
                                      type="button"
                                      disabled={statusBusy}
                                      onClick={event => {
                                        closeDetails(event.currentTarget);
                                        void updateListingStatus(item, statusToggle.nextStatus);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/6"
                                    >
                                      <EyeOff className="h-4 w-4" />
                                      {statusToggle.label}
                                    </button>
                                  ) : null}

                                  {cardStatus === 'draft' ? (
                                    <button
                                      type="button"
                                      disabled={deletingDraftId === item.id}
                                      onClick={event => {
                                        closeDetails(event.currentTarget);
                                        void deleteDraft(item);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-400/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      {deletingDraftId === item.id
                                        ? locale === 'id'
                                          ? 'Menghapus...'
                                          : 'Deleting...'
                                        : locale === 'id'
                                          ? 'Hapus draft'
                                          : 'Delete draft'}
                                    </button>
                                  ) : null}
                                </div>
                              </details>
                            </div>

                            {item.summary ? (
                              <p className="mt-1.5 line-clamp-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                {summarizeText(item.summary)}
                              </p>
                            ) : null}

                            {cardStatus === 'draft' ? (
                              <div className="mt-2 max-w-[280px]">
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/8">
                                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${progress}%` }} />
                                </div>
                                <p className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                  {locale === 'id' ? `Kelengkapan ${progress}%` : `${progress}% complete`}
                                </p>
                              </div>
                            ) : null}

                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              {primaryAction ? (
                                <Link
                                  href={primaryAction.href}
                                  className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold transition ${primaryAction.tone}`}
                                >
                                  <PencilLine className="h-3.5 w-3.5" />
                                  {primaryAction.label}
                                </Link>
                              ) : null}

                              {cardStatus === 'active' ? (
                                <Link
                                  href={`/content/${id}`}
                                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/8 dark:hover:text-white"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  {locale === 'id' ? 'Lihat' : 'View'}
                                </Link>
                              ) : null}

                              {cardStatus === 'archived' && statusToggle ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void updateListingStatus(item, statusToggle.nextStatus)}
                                    disabled={statusBusy}
                                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-emerald-700 px-3 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    {statusBusy
                                      ? locale === 'id'
                                        ? 'Menyimpan...'
                                        : 'Saving...'
                                      : statusToggle.label}
                                  </button>
                                  <Link
                                    href={`/create?draft=${id}`}
                                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/8 dark:hover:text-white"
                                  >
                                    <PencilLine className="h-3.5 w-3.5" />
                                    {locale === 'id' ? 'Edit' : 'Edit'}
                                  </Link>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )
            ) : collectionMode === 'favorites' ? (
              filteredReferences.length === 0 ? (
                <EmptyState
                  className="px-4 py-12"
                  title={query ? (locale === 'id' ? 'Tidak ditemukan' : 'No match') : locale === 'id' ? 'Belum ada yang disimpan' : 'Nothing saved yet'}
                  description={query ? (locale === 'id' ? 'Coba kata lain atau hapus pencarian.' : 'Try another keyword or clear search.') : locale === 'id' ? 'Simpan produk, jasa, atau usaha dari Explore supaya gampang ditemukan lagi.' : 'Save products, services, or businesses from Explore to find them again quickly.'}
                  action={!query ? (
                    <Link href="/explore" className="inline-flex min-h-10 items-center rounded-full bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">
                      {locale === 'id' ? 'Jelajahi' : 'Explore'}
                    </Link>
                  ) : undefined}
                />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/8">
                  {filteredReferences.map(item => {
                    const imageStyle = item.image ? { backgroundImage: `url("${item.image.replace(/"/g, '%22')}")` } : undefined;
                    return (
                      <article key={item.id} className="flex min-w-0 items-center gap-3 p-3 sm:p-4">
                        <Link href={item.href} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[13px] bg-slate-100 bg-cover bg-center ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-white/10" style={imageStyle}>
                          {!item.image ? <span className="absolute inset-0 grid place-items-center"><ImageIcon className="h-5 w-5 text-slate-400" /></span> : null}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link href={item.href} className="line-clamp-2 text-sm font-bold text-slate-950 hover:text-emerald-700 dark:text-white dark:hover:text-emerald-300">{item.title}</Link>
                          <p className="mt-1 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{[item.typeLabel, item.priceLabel, item.location].filter(Boolean).join(' • ')}</p>
                        </div>
                        <button type="button" onClick={() => removeReference(item.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-400/10" aria-label={locale === 'id' ? 'Hapus dari simpanan' : 'Remove saved'}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </article>
                    );
                  })}
                </div>
              )
            ) : filteredViewedReferences.length === 0 ? (
              <EmptyState
                className="px-4 py-12"
                title={query ? (locale === 'id' ? 'Tidak ditemukan' : 'No match') : locale === 'id' ? 'Riwayat masih kosong' : 'History is empty'}
                description={query ? (locale === 'id' ? 'Coba kata lain atau hapus pencarian.' : 'Try another keyword or clear search.') : locale === 'id' ? 'Postingan yang kamu buka dari Explore atau Search akan muncul di sini.' : 'Listings you open from Explore or Search will appear here.'}
                action={!query ? (
                  <Link href="/explore" className="inline-flex min-h-10 items-center rounded-full bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">
                    {locale === 'id' ? 'Jelajahi' : 'Explore'}
                  </Link>
                ) : undefined}
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/8">
                {filteredViewedReferences.map(item => {
                  const imageStyle = item.image ? { backgroundImage: `url("${item.image.replace(/"/g, '%22')}")` } : undefined;
                  return (
                    <article key={item.id} className="flex min-w-0 items-center gap-3 p-3 sm:p-4">
                      <Link href={item.href} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[13px] bg-slate-100 bg-cover bg-center ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-white/10" style={imageStyle}>
                        {!item.image ? <span className="absolute inset-0 grid place-items-center"><ImageIcon className="h-5 w-5 text-slate-400" /></span> : null}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link href={item.href} className="line-clamp-2 text-sm font-bold text-slate-950 hover:text-emerald-700 dark:text-white dark:hover:text-emerald-300">{item.title}</Link>
                        <p className="mt-1 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{[item.typeLabel, item.priceLabel, item.location].filter(Boolean).join(' • ')}</p>
                      </div>
                      <button type="button" onClick={() => removeViewedReference(item.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/8 dark:hover:text-white" aria-label={locale === 'id' ? 'Hapus dari riwayat' : 'Remove from history'}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </CreateMarketplaceShell>
    );
  }
