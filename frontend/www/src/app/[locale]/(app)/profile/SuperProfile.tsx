'use client';

import {
  Children,
  type ChangeEvent,
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import NextImage from 'next/image';
import { usePathname } from 'next/navigation';
import useEmblaCarousel from 'embla-carousel-react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Camera,
  Check,
  Circle,
  ClipboardList,
  Eye,
  FileText,
  Heart,
  Loader2,
  MapPin,
  Megaphone,
  MessageCircle,
  MoreVertical,
  Package,
  PencilLine,
  Plus,
  RefreshCw,
  Settings2,
  ShoppingBag,
} from 'lucide-react';

import { ImageCropModal } from '@/components/common/ImageCropModal';
import { ProfileViewSkeleton } from '@/components/system/feedback/RouteSkeletons';
import { LocalizedLink } from '@/components/ui-kit';
import { useAuth } from '@/context/AuthContext';
import { useChatInbox } from '@/context/ChatInboxContext';
import {
  extractContentItems,
  normalizeContentMediaUrl,
} from '@/lib/content/catalog';
import { buildContentHref } from '@/lib/content/routes';
import { resolveLocaleFromPathname } from '@/lib/locale';
import { prepareUploadFile } from '@/lib/media/prepareUploadMedia';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import {
  extractFirstUploadedImageUrl,
  normalizeProfileMediaUrl,
} from '@/lib/profile/profileMedia';
import {
  buildPublicProfileSlug,
  normalizePublicProfileHandleInput,
} from '@/lib/profile/publicProfileLink';
import { cn } from '@/lib/utils';

type MetaRecord = Record<string, unknown>;

type OwnerTab = 'posts' | 'drafts';
type ListingFilter = 'all' | 'product' | 'service' | 'supplier' | 'place';
type SortMode = 'newest' | 'oldest' | 'most_viewed';

type UserDetail = {
  id: string;
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  username?: string | null;
  bio?: string | null;
  location?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  cover_image?: string | null;
  created_at?: string | null;
  joined_at?: string | null;

  email_verified?: boolean | null;
  phone_verified?: boolean | null;
  document_verified?: boolean | null;
  liveness_verified?: boolean | null;
  identity_verified?: boolean | null;
  kyc_status?: string | null;

  verification?: Record<string, unknown> | null;
  media?: Record<string, unknown> | null;
  metadata?: {
    avatar_url?: string | null;
    cover_image?: string | null;
    media?: Record<string, unknown> | null;
    [key: string]: unknown;
  } | null;
};

type OwnerListing = {
  id: string;
  slug?: string | null;
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  content_type?: string | null;
  type?: string | null;
  category?: string | null;
  content_status?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  price?: number | string | null;
  price_cents?: number | null;
  price_min?: number | string | null;
  price_label?: string | null;
  price_unit?: string | null;
  currency?: string | null;
  unit?: string | null;

  image_url?: string | null;
  thumbnail_url?: string | null;
  cover_image?: string | null;
  images?: unknown;
  media?: unknown;
  metadata?: unknown;

  view_count?: number | string | null;
  views_count?: number | string | null;
  favorite_count?: number | string | null;
  favorites_count?: number | string | null;
  like_count?: number | string | null;
  likes_count?: number | string | null;
  chat_count?: number | string | null;
  chats_count?: number | string | null;
  comment_count?: number | string | null;
  comments_count?: number | string | null;
};

type DashboardStats = {
  total_content: number;
  active_transactions: number;
  unread_messages: number;
  user_rating: number;
  profile_views: number;
  total_favorites: number;
};

type StatItem = {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
};

type QuickAction = {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
};

type Copy = ReturnType<typeof buildCopy>;

const ROUTES = {
  create: '/create?mode=quick',
  manage: '/my-listings',
  drafts: '/my-listings?status=draft',
  promotion: '/create?mode=promotion',
  insights: '/dashboard',
  editProfile: '/profile/edit',
  chat: '/chat',
} as const;

const EMPTY_DASHBOARD_STATS: DashboardStats = {
  total_content: 0,
  active_transactions: 0,
  unread_messages: 0,
  user_rating: 0,
  profile_views: 0,
  total_favorites: 0,
};

function buildCopy(isId: boolean) {
  return isId
    ? {
        login: 'Silakan masuk terlebih dahulu',
        loadError: 'Profil belum berhasil dimuat.',
        retry: 'Coba lagi',
        refresh: 'Muat ulang',
        refreshing: 'Memuat...',
        profileReady: 'Kelengkapan profil',
        profileHint:
          'Lengkapi profil agar orang lebih cepat percaya dan menghubungi kamu.',
        completeProfile: 'Lengkapi Profil',
        publicProfile: 'Lihat Profil Publik',
        editProfile: 'Edit Profil',
        verified: 'Akun Terverifikasi',
        joined: 'Bergabung',
        viewed: 'Dilihat',
        favorites: 'Favorit',
        unreadChats: 'Chat belum dibalas',
        activePosts: 'Postingan Aktif',
        totalViews: 'Total kunjungan',
        savedByUsers: 'Disimpan pengguna',
        unreadHint: 'Segera balas prospek',
        inboxClean: 'Inbox sedang bersih',
        currentlyActive: 'Sedang tayang',
        quickActions: 'Aksi Cepat',
        createPost: 'Buat Posting',
        managePosts: 'Kelola Posting',
        drafts: 'Draft',
        promotion: 'Promosi',
        insights: 'Insight',
        myPosts: 'Postingan Saya',
        all: 'Semua',
        products: 'Produk',
        services: 'Jasa',
        suppliers: 'Supplier',
        places: 'Tempat Usaha',
        newest: 'Terbaru',
        oldest: 'Terlama',
        mostViewed: 'Paling Dilihat',
        active: 'Aktif',
        viewAll: 'Lihat Semua Postingan',
        noPostsTitle: 'Belum ada postingan aktif',
        noPostsDescription:
          'Buat postingan pertama untuk menawarkan produk, jasa, bahan usaha, atau tempat usaha.',
        makePost: 'Buat Postingan',
        noDraftTitle: 'Belum ada draft',
        noDraftDescription:
          'Postingan yang belum diterbitkan akan muncul di sini.',
        manageDrafts: 'Kelola Draft',
        photoProfile: 'Foto profil',
        bioBusiness: 'Bio usaha',
        businessLocation: 'Lokasi usaha',
        contact: 'Kontak',
        businessPhoto: 'Foto usaha',
        identityVerification: 'Verifikasi identitas',
        updateSuccess: 'Foto profil berhasil diperbarui.',
        coverSuccess: 'Sampul profil berhasil diperbarui.',
        uploadError: 'Gagal mengunggah gambar.',
        saveError: 'Gagal menyimpan perubahan profil.',
        coverLabel: 'Ubah sampul',
        avatarLabel: 'Ubah foto profil',
        profileFallback:
          'Ceritakan usaha, layanan, atau keahlian yang kamu tawarkan.',
        locationFallback: 'Lokasi belum ditambahkan',
        manage: 'Kelola postingan',
        profileApiPartial:
          'Sebagian data statistik belum tersedia dari server.',
        emptyPrice: 'Hubungi penjual',
        swipe: 'Geser',
      }
    : {
        login: 'Please sign in first',
        loadError: 'The profile could not be loaded.',
        retry: 'Try again',
        refresh: 'Refresh',
        refreshing: 'Loading...',
        profileReady: 'Profile completion',
        profileHint:
          'Complete your profile so people can trust and contact you faster.',
        completeProfile: 'Complete Profile',
        publicProfile: 'View Public Profile',
        editProfile: 'Edit Profile',
        verified: 'Verified Account',
        joined: 'Joined',
        viewed: 'Views',
        favorites: 'Favorites',
        unreadChats: 'Unread chats',
        activePosts: 'Active Posts',
        totalViews: 'Total visits',
        savedByUsers: 'Saved by users',
        unreadHint: 'Reply to prospects',
        inboxClean: 'Inbox is clear',
        currentlyActive: 'Currently live',
        quickActions: 'Quick Actions',
        createPost: 'Create Post',
        managePosts: 'Manage Posts',
        drafts: 'Drafts',
        promotion: 'Promotion',
        insights: 'Insights',
        myPosts: 'My Posts',
        all: 'All',
        products: 'Products',
        services: 'Services',
        suppliers: 'Suppliers',
        places: 'Business Places',
        newest: 'Newest',
        oldest: 'Oldest',
        mostViewed: 'Most Viewed',
        active: 'Active',
        viewAll: 'View All Posts',
        noPostsTitle: 'No active posts yet',
        noPostsDescription:
          'Create your first post to offer products, services, supplies, or business places.',
        makePost: 'Create Post',
        noDraftTitle: 'No drafts yet',
        noDraftDescription:
          'Posts that have not been published will appear here.',
        manageDrafts: 'Manage Drafts',
        photoProfile: 'Profile photo',
        bioBusiness: 'Business bio',
        businessLocation: 'Business location',
        contact: 'Contact',
        businessPhoto: 'Business photo',
        identityVerification: 'Identity verification',
        updateSuccess: 'Profile photo updated successfully.',
        coverSuccess: 'Profile cover updated successfully.',
        uploadError: 'Failed to upload image.',
        saveError: 'Failed to save profile changes.',
        coverLabel: 'Change cover',
        avatarLabel: 'Change profile photo',
        profileFallback:
          'Tell people about your business, services, or expertise.',
        locationFallback: 'Location has not been added',
        manage: 'Manage post',
        profileApiPartial:
          'Some profile statistics are not available from the server yet.',
        emptyPrice: 'Contact seller',
        swipe: 'Swipe',
      };
}

function asRecord(value: unknown): MetaRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as MetaRecord;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const next = readString(value);
    if (next) return next;
  }
  return '';
}

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function readCollection<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  const body = asRecord(payload);
  if (!body) return [];

  for (const key of ['results', 'items', 'data', 'listings']) {
    const value = body[key];
    if (Array.isArray(value)) return value as T[];

    const nested = asRecord(value);
    if (nested) {
      for (const nestedKey of ['results', 'items', 'data', 'listings']) {
        if (Array.isArray(nested[nestedKey])) {
          return nested[nestedKey] as T[];
        }
      }
    }
  }

  return [];
}

function normalizeDashboardStats(payload: unknown): DashboardStats {
  const root = asRecord(payload);
  const data = asRecord(root?.data) || root;
  const stats = asRecord(data?.stats) || data;

  return {
    total_content: Math.max(
      0,
      Math.floor(
        readNumber(
          stats?.total_content ??
            stats?.active_content ??
            stats?.active_listings,
        ),
      ),
    ),
    active_transactions: Math.max(
      0,
      Math.floor(readNumber(stats?.active_transactions)),
    ),
    unread_messages: Math.max(
      0,
      Math.floor(readNumber(stats?.unread_messages ?? stats?.unread_chats)),
    ),
    user_rating: Math.max(
      0,
      Math.min(5, readNumber(stats?.user_rating ?? stats?.rating)),
    ),
    profile_views: Math.max(
      0,
      Math.floor(
        readNumber(
          stats?.profile_views ?? stats?.views_count ?? stats?.total_views,
        ),
      ),
    ),
    total_favorites: Math.max(
      0,
      Math.floor(
        readNumber(
          stats?.total_favorites ??
            stats?.favorites_count ??
            stats?.saved_count,
        ),
      ),
    ),
  };
}

function normalizeStatus(item: OwnerListing): string {
  return firstString(item.content_status, item.status).toLowerCase();
}

function normalizeListingType(item: OwnerListing): ListingFilter {
  const value = firstString(
    item.content_type,
    item.type,
    item.category,
    asRecord(item.metadata)?.content_type,
    asRecord(item.metadata)?.category,
  ).toLowerCase();

  if (
    value.includes('service') ||
    value.includes('jasa') ||
    value.includes('freelancer') ||
    value.includes('talent')
  ) {
    return 'service';
  }

  if (
    value.includes('supplier') ||
    value.includes('material') ||
    value.includes('bahan')
  ) {
    return 'supplier';
  }

  if (
    value.includes('place') ||
    value.includes('property') ||
    value.includes('location') ||
    value.includes('tempat') ||
    value.includes('ruko')
  ) {
    return 'place';
  }

  return 'product';
}

function readListingMetric(item: OwnerListing, keys: string[]): number {
  const row = item as unknown as MetaRecord;
  const metadata = asRecord(item.metadata);
  const metrics =
    asRecord(metadata?.metrics) ||
    asRecord(metadata?.stats) ||
    asRecord(asRecord(item.media)?.metrics);

  for (const key of keys) {
    const value = readNumber(row[key] ?? metadata?.[key] ?? metrics?.[key]);
    if (value > 0) return value;
  }

  return 0;
}

function extractImageFromUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return normalizeContentMediaUrl(value) || '';
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = extractImageFromUnknown(item);
      if (result) return result;
    }
    return '';
  }

  const row = asRecord(value);
  if (!row) return '';

  for (const key of [
    'url',
    'src',
    'image_url',
    'thumbnail_url',
    'cover_image',
    'path',
  ]) {
    const result = extractImageFromUnknown(row[key]);
    if (result) return result;
  }

  for (const key of ['images', 'gallery', 'media', 'files']) {
    const result = extractImageFromUnknown(row[key]);
    if (result) return result;
  }

  return '';
}

function getListingImage(item: OwnerListing): string {
  return (
    extractImageFromUnknown(item.cover_image) ||
    extractImageFromUnknown(item.image_url) ||
    extractImageFromUnknown(item.thumbnail_url) ||
    extractImageFromUnknown(item.images) ||
    extractImageFromUnknown(item.media) ||
    extractImageFromUnknown(item.metadata)
  );
}

function formatCompactNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(Math.max(0, value));
}

function formatJoinedDate(
  input: string | null | undefined,
  locale: string,
): string {
  if (!input) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatPrice(
  item: OwnerListing,
  locale: string,
  emptyLabel: string,
): string {
  const customLabel = readString(item.price_label);
  if (customLabel) return customLabel;

  const currency = readString(item.currency) || 'IDR';
  const unit = firstString(item.price_unit, item.unit);

  let amount = 0;
  if (
    typeof item.price_cents === 'number' &&
    Number.isFinite(item.price_cents)
  ) {
    amount = item.price_cents / 100;
  } else {
    amount = readNumber(item.price ?? item.price_min);
  }

  if (amount <= 0) return emptyLabel;

  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

  return unit ? `${formatted} / ${unit}` : formatted;
}

function getListingHref(item: OwnerListing): string {
  return buildContentHref(
    item.id,
    item.title || 'listing',
    item.slug || undefined,
  );
}

function mapContentPayload(payload: unknown): OwnerListing[] {
  const catalogItems = extractContentItems(payload);

  if (catalogItems.length > 0) {
    return catalogItems.map(item => {
      const raw = item as unknown as MetaRecord;
      return {
        id: item.id,
        slug: item.slug || null,
        title: item.title || null,
        summary: item.summary || null,
        content_type: item.content_type || null,
        category: item.category || null,
        content_status:
          readString(raw.content_status) || readString(raw.status) || null,
        status: readString(raw.status) || null,
        cover_image:
          normalizeContentMediaUrl(item.cover_image ?? undefined) || null,
        price_cents: item.price_cents ?? null,
        price_unit: readString(raw.price_unit) || null,
        created_at: item.created_at || null,
        updated_at: item.updated_at || null,
        metadata: item.metadata || null,
        view_count: readNumber(raw.view_count ?? raw.views_count),
        favorite_count: readNumber(
          raw.favorite_count ?? raw.favorites_count ?? raw.like_count,
        ),
        chat_count: readNumber(
          raw.chat_count ?? raw.chats_count ?? raw.comment_count,
        ),
      } satisfies OwnerListing;
    });
  }

  return readCollection<OwnerListing>(payload).filter(item =>
    Boolean(item?.id),
  );
}

function isVerifiedProfile(
  detail: UserDetail | null,
  metadata: MetaRecord,
): boolean {
  if (
    detail?.identity_verified ||
    detail?.document_verified ||
    detail?.liveness_verified
  ) {
    return true;
  }

  const status = firstString(
    detail?.kyc_status,
    detail?.verification?.status,
    metadata.kyc_status,
    asRecord(metadata.verification)?.status,
  ).toLowerCase();

  return ['verified', 'approved', 'complete', 'completed'].includes(status);
}

function getTypePresentation(type: ListingFilter, isId: boolean) {
  switch (type) {
    case 'service':
      return {
        label: isId ? 'JASA' : 'SERVICE',
        className:
          'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
      };
    case 'supplier':
      return {
        label: 'SUPPLIER',
        className:
          'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
      };
    case 'place':
      return {
        label: isId ? 'TEMPAT USAHA' : 'BUSINESS PLACE',
        className:
          'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
      };
    default:
      return {
        label: isId ? 'PRODUK' : 'PRODUCT',
        className:
          'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      };
  }
}

type EmblaApi = ReturnType<typeof useEmblaCarousel>[1];

function useEmblaControls(api: EmblaApi) {
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const sync = useCallback(() => {
    if (!api) return;
    setCanPrev(api.canScrollPrev());
    setCanNext(api.canScrollNext());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    const timer = window.setTimeout(sync, 0);
    api.on('select', sync);
    api.on('reInit', sync);
    return () => {
      window.clearTimeout(timer);
      api.off('select', sync);
      api.off('reInit', sync);
    };
  }, [api, sync]);

  return {
    canPrev,
    canNext,
    scrollPrev: () => api?.scrollPrev(),
    scrollNext: () => api?.scrollNext(),
  };
}

function EmblaRail({
  children,
  ariaLabel,
  itemClassName,
  className,
  showControls = true,
}: {
  children: ReactNode;
  ariaLabel: string;
  itemClassName: string;
  className?: string;
  showControls?: boolean;
}) {
  const items = useMemo(() => Children.toArray(children), [children]);
  const [viewportRef, api] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  });
  const { canPrev, canNext, scrollPrev, scrollNext } = useEmblaControls(api);

  return (
    <div className={cn('relative min-w-0 max-w-full', className)}>
      <div ref={viewportRef} className="overflow-hidden" aria-label={ariaLabel}>
        <div className="flex touch-pan-y gap-3">
          {items.map((child, index) => (
            <div key={index} className={cn('min-w-0', itemClassName)}>
              {child}
            </div>
          ))}
        </div>
      </div>

      {showControls && (canPrev || canNext) ? (
        <div className="mt-3 hidden justify-end gap-2 sm:flex">
          <button
            type="button"
            onClick={scrollPrev}
            disabled={!canPrev}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-35 dark:text-[color:var(--app-text-inverse)]"
            aria-label="Previous"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            disabled={!canNext}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-35 dark:text-[color:var(--app-text-inverse)]"
            aria-label="Next"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ProfileTabRail({
  activeTab,
  items,
  onChange,
}: {
  activeTab: OwnerTab;
  items: Array<{ key: OwnerTab; label: string; count: number }>;
  onChange: (tab: OwnerTab) => void;
}) {
  const [viewportRef, api] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  });

  useEffect(() => {
    const index = items.findIndex(item => item.key === activeTab);
    if (index >= 0) api?.scrollTo(index);
  }, [activeTab, api, items]);

  return (
    <div className="px-3 pt-3 sm:px-5 sm:pt-5">
      <div className="rounded-2xl bg-[color:var(--app-surface-muted)] p-1 dark:bg-[color:var(--app-surface)]">
        <div ref={viewportRef} className="overflow-hidden">
          <div className="flex touch-pan-y gap-1">
            {items.map(item => {
              const active = item.key === activeTab;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onChange(item.key)}
                  className={cn(
                    'flex min-h-10 flex-[0_0_auto] items-center gap-2 rounded-xl px-4 text-xs font-black transition sm:text-sm',
                    active
                      ? 'bg-[color:var(--app-surface-strong)] text-emerald-700 shadow-sm dark:text-emerald-300'
                      : 'text-[color:var(--app-text-soft)] hover:text-[color:var(--app-text)]',
                  )}
                >
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px]',
                      active
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-black/5 text-[color:var(--app-text-soft)] dark:bg-white/10',
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterRail({
  activeFilter,
  items,
  onChange,
}: {
  activeFilter: ListingFilter;
  items: Array<{ key: ListingFilter; label: string }>;
  onChange: (filter: ListingFilter) => void;
}) {
  const [viewportRef, api] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  });

  useEffect(() => {
    const index = items.findIndex(item => item.key === activeFilter);
    if (index >= 0) api?.scrollTo(index);
  }, [activeFilter, api, items]);

  return (
    <div ref={viewportRef} className="min-w-0 flex-1 overflow-hidden">
      <div className="flex touch-pan-y gap-2">
        {items.map(item => {
          const active = item.key === activeFilter;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={cn(
                'min-h-9 flex-[0_0_auto] rounded-full border px-4 text-xs font-bold transition',
                active
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-[color:var(--app-border)] text-[color:var(--app-text-soft)] hover:border-emerald-300 hover:text-[color:var(--app-text)]',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ item }: { item: StatItem }) {
  const Icon = item.icon;

  return (
    <div className="h-full rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3.5 sm:p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            item.iconClassName,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-[color:var(--app-text-soft)]">
            {item.label}
          </p>
          <p className="mt-0.5 text-xl font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {item.value}
          </p>
          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
            {item.hint}
          </p>
        </div>
      </div>
    </div>
  );
}

function CompletionItem({
  label,
  complete,
}: {
  label: string;
  complete: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
      {complete ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-slate-400" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}

function EmptyState({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <FileText className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[color:var(--app-text-soft)]">
        {description}
      </p>
      <LocalizedLink
        href={href}
        className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-600 px-4 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
      >
        {actionLabel}
      </LocalizedLink>
    </div>
  );
}

function ListingCard({
  item,
  isId,
  locale,
  copy,
}: {
  item: OwnerListing;
  isId: boolean;
  locale: string;
  copy: Copy;
}) {
  const imageUrl = getListingImage(item);
  const type = normalizeListingType(item);
  const presentation = getTypePresentation(type, isId);
  const status = normalizeStatus(item);
  const views = readListingMetric(item, ['view_count', 'views_count', 'views']);
  const favorites = readListingMetric(item, [
    'favorite_count',
    'favorites_count',
    'like_count',
    'likes_count',
    'favorites',
    'likes',
  ]);
  const chats = readListingMetric(item, [
    'chat_count',
    'chats_count',
    'comment_count',
    'comments_count',
    'chats',
    'comments',
  ]);

  return (
    <article className="relative grid min-w-0 grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 transition hover:border-emerald-200 hover:shadow-sm sm:grid-cols-[132px_minmax(0,1fr)_auto] sm:gap-4 sm:p-4">
      <LocalizedLink
        href={getListingHref(item)}
        className="relative h-24 overflow-hidden rounded-xl bg-[color:var(--app-surface-muted)] sm:h-28"
      >
        {imageUrl ? (
          <NextImage
            src={imageUrl}
            alt={item.title || ''}
            fill
            unoptimized
            sizes="132px"
            className="object-cover transition duration-300 hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[color:var(--app-text-soft)]">
            <Package className="h-8 w-8" />
          </div>
        )}
      </LocalizedLink>

      <div className="min-w-0 self-center pr-8 sm:pr-0">
        <div className="flex min-w-0 flex-wrap items-start gap-2">
          <LocalizedLink href={getListingHref(item)} className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-black leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
              {item.title || 'Untitled'}
            </h3>
          </LocalizedLink>

          <span
            className={cn(
              'hidden shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold sm:inline-flex',
              status === 'draft'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
            )}
          >
            {status === 'draft' ? copy.drafts : copy.active}
          </span>
        </div>

        <span
          className={cn(
            'mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[9px] font-black tracking-wide',
            presentation.className,
          )}
        >
          {presentation.label}
        </span>

        <p className="mt-1.5 truncate text-sm font-black text-emerald-700 dark:text-emerald-300">
          {formatPrice(item, locale, copy.emptyPrice)}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-[color:var(--app-text-soft)] sm:text-[11px]">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {formatCompactNumber(views, locale)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            {formatCompactNumber(favorites, locale)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {formatCompactNumber(chats, locale)}
          </span>
        </div>

        <span
          className={cn(
            'mt-2 inline-flex rounded-lg px-2.5 py-1 text-[9px] font-bold sm:hidden',
            status === 'draft'
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
          )}
        >
          {status === 'draft' ? copy.drafts : copy.active}
        </span>
      </div>

      <LocalizedLink
        href={`${ROUTES.manage}?listing=${encodeURIComponent(item.id)}`}
        aria-label={copy.manage}
        title={copy.manage}
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)] sm:static sm:self-center"
      >
        <MoreVertical className="h-5 w-5" />
      </LocalizedLink>
    </article>
  );
}

export default function SuperProfile() {
  const { user, authFetch, refreshUser, loading: authLoading } = useAuth();
  const { totalUnread } = useChatInbox();
  const pathname = usePathname();
  const isId = resolveLocaleFromPathname(pathname) === 'id';
  const numberLocale = isId ? 'id-ID' : 'en-US';
  const copy = useMemo(() => buildCopy(isId), [isId]);

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [activeListings, setActiveListings] = useState<OwnerListing[]>([]);
  const [draftListings, setDraftListings] = useState<OwnerListing[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>(
    EMPTY_DASHBOARD_STATS,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [statsPartial, setStatsPartial] = useState(false);

  const [activeTab, setActiveTab] = useState<OwnerTab>('posts');
  const [activeFilter, setActiveFilter] = useState<ListingFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const [cropSource, setCropSource] = useState('');
  const [cropTarget, setCropTarget] = useState<'avatar' | 'cover' | null>(null);

  const mergedMetadata = useMemo(
    () => ({
      ...(asRecord(user?.metadata) || {}),
      ...(asRecord(detail?.metadata) || {}),
    }),
    [detail?.metadata, user?.metadata],
  );

  const hydrateMedia = useCallback(
    (value: UserDetail) => {
      const detailMetadata = asRecord(value.metadata) || {};
      const detailMedia =
        asRecord(value.media) || asRecord(detailMetadata.media) || {};
      const userMetadata = asRecord(user?.metadata) || {};
      const userMedia = asRecord(userMetadata.media) || {};

      setAvatarUrlInput(
        normalizeProfileMediaUrl(
          firstString(
            value.avatar_url,
            value.avatarUrl,
            detailMetadata.avatar_url,
            detailMedia.avatar_url,
            user?.avatarUrl,
            user?.avatar_url,
            userMetadata.avatar_url,
          ),
        ) || '',
      );

      setCoverUrlInput(
        normalizeProfileMediaUrl(
          firstString(
            value.cover_image,
            detailMetadata.cover_image,
            detailMedia.cover_image,
            userMetadata.cover_image,
            userMedia.cover_image,
          ),
        ) || '',
      );
    },
    [user],
  );

  const loadProfile = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      setProfileError('');
      setStatsPartial(false);

      try {
        const [detailResult, activeResult, draftResult, statsResult] =
          await Promise.allSettled([
            authFetch(`/api/users/${user.id}`, { cache: 'no-store' }),
            authFetch('/api/my-listings?status=active&limit=50', {
              cache: 'no-store',
            }),
            authFetch('/api/my-listings?status=draft&limit=50', {
              cache: 'no-store',
            }),
            authFetch('/api/dashboard/stats', { cache: 'no-store' }),
          ]);

        if (detailResult.status !== 'fulfilled') {
          throw detailResult.reason;
        }

        const detailResponse = detailResult.value;
        const detailData = (await detailResponse
          .json()
          .catch(() => null)) as UserDetail | null;

        if (!detailResponse.ok || !detailData) {
          throw new Error(copy.loadError);
        }

        setDetail(detailData);
        hydrateMedia(detailData);

        let nextActive: OwnerListing[] = [];
        let nextDrafts: OwnerListing[] = [];
        let hadListingFailure = false;

        if (activeResult.status === 'fulfilled' && activeResult.value.ok) {
          const payload = await activeResult.value.json().catch(() => null);
          nextActive = mapContentPayload(payload).filter(item => {
            const status = normalizeStatus(item);
            return !['draft', 'archived', 'deleted', 'inactive'].includes(
              status,
            );
          });
        } else {
          hadListingFailure = true;
        }

        if (draftResult.status === 'fulfilled' && draftResult.value.ok) {
          const payload = await draftResult.value.json().catch(() => null);
          nextDrafts = mapContentPayload(payload).filter(item => {
            const status = normalizeStatus(item);
            return status === 'draft' || !status;
          });
        } else {
          hadListingFailure = true;
        }

        if (hadListingFailure) {
          const fallbackResponse = await authFetch(
            '/api/my-listings?limit=100',
            {
              cache: 'no-store',
            },
          );

          if (fallbackResponse.ok) {
            const fallbackPayload = await fallbackResponse
              .json()
              .catch(() => null);
            const allItems = mapContentPayload(fallbackPayload);

            if (nextActive.length === 0) {
              nextActive = allItems.filter(item => {
                const status = normalizeStatus(item);
                return !['draft', 'archived', 'deleted', 'inactive'].includes(
                  status,
                );
              });
            }

            if (nextDrafts.length === 0) {
              nextDrafts = allItems.filter(
                item => normalizeStatus(item) === 'draft',
              );
            }
          }
        }

        setActiveListings(nextActive);
        setDraftListings(nextDrafts);

        if (statsResult.status === 'fulfilled' && statsResult.value.ok) {
          const payload = await statsResult.value.json().catch(() => null);
          setDashboardStats(normalizeDashboardStats(payload));
        } else {
          setDashboardStats(EMPTY_DASHBOARD_STATS);
          setStatsPartial(true);
        }
      } catch (error) {
        setProfileError(
          error instanceof Error ? error.message : copy.loadError,
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authFetch, copy.loadError, hydrateMedia, user?.id],
  );

  useEffect(() => {
    if (!authLoading) void loadProfile('initial');
  }, [authLoading, loadProfile]);

  useEffect(() => {
    return () => {
      if (cropSource) URL.revokeObjectURL(cropSource);
    };
  }, [cropSource]);

  const displayName = firstString(
    detail?.full_name,
    detail?.fullName,
    user?.full_name,
    user?.email,
  );

  const handle = normalizePublicProfileHandleInput(
    firstString(detail?.username, user?.username),
  );
  const bio = firstString(detail?.bio, user?.bio, copy.profileFallback);
  const location = firstString(detail?.location);
  const phone = firstString(detail?.phone, user?.phone);
  const joinedDate = formatJoinedDate(
    detail?.joined_at || detail?.created_at,
    numberLocale,
  );

  const verified = useMemo(
    () => isVerifiedProfile(detail, mergedMetadata),
    [detail, mergedMetadata],
  );

  const effectiveAvatarUrl = useMemo(() => {
    const detailMedia =
      asRecord(detail?.media) || asRecord(detail?.metadata?.media) || {};
    const userMetadata = asRecord(user?.metadata) || {};
    const userMedia = asRecord(userMetadata.media) || {};
    const rawAvatar =
      normalizeProfileMediaUrl(avatarUrlInput) ||
      normalizeProfileMediaUrl(
        firstString(
          detail?.avatar_url,
          detail?.avatarUrl,
          detail?.metadata?.avatar_url,
          detailMedia.avatar_url,
          detailMedia.avatarUrl,
          detailMedia.photo_url,
          user?.avatarUrl,
          user?.avatar_url,
          userMetadata.avatar_url,
          userMedia.avatar_url,
          userMedia.avatarUrl,
          userMedia.photo_url,
        ),
      );

    return profileAvatarSrc(
      rawAvatar,
      readProfileAvatarStyle(detail) || readProfileAvatarStyle(user),
      displayName || user?.email,
    );
  }, [avatarUrlInput, detail, displayName, user]);

  const effectiveCoverUrl = useMemo(() => {
    const detailMedia =
      asRecord(detail?.media) || asRecord(detail?.metadata?.media) || {};
    const userMetadata = asRecord(user?.metadata) || {};
    const userMedia = asRecord(userMetadata.media) || {};

    return (
      normalizeProfileMediaUrl(coverUrlInput) ||
      normalizeProfileMediaUrl(
        firstString(
          detail?.cover_image,
          detail?.metadata?.cover_image,
          detailMedia.cover_image,
          userMetadata.cover_image,
          userMedia.cover_image,
        ),
      ) ||
      ''
    );
  }, [coverUrlInput, detail, user?.metadata]);

  const allListings = useMemo(
    () => [...activeListings, ...draftListings],
    [activeListings, draftListings],
  );

  const aggregateMetrics = useMemo(
    () =>
      allListings.reduce(
        (totals, item) => ({
          views:
            totals.views +
            readListingMetric(item, ['view_count', 'views_count', 'views']),
          favorites:
            totals.favorites +
            readListingMetric(item, [
              'favorite_count',
              'favorites_count',
              'like_count',
              'likes_count',
              'favorites',
              'likes',
            ]),
        }),
        { views: 0, favorites: 0 },
      ),
    [allListings],
  );

  const unreadChats = Math.max(
    0,
    Number.isFinite(totalUnread) ? totalUnread : 0,
    dashboardStats.unread_messages,
  );

  const totalViews =
    dashboardStats.profile_views > 0
      ? dashboardStats.profile_views
      : aggregateMetrics.views;

  const totalFavorites =
    dashboardStats.total_favorites > 0
      ? dashboardStats.total_favorites
      : aggregateMetrics.favorites;

  const activePostCount = Math.max(
    dashboardStats.total_content,
    activeListings.length,
  );

  const stats = useMemo<StatItem[]>(
    () => [
      {
        key: 'views',
        label: copy.viewed,
        value: formatCompactNumber(totalViews, numberLocale),
        hint: copy.totalViews,
        icon: Eye,
        iconClassName:
          'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      },
      {
        key: 'favorites',
        label: copy.favorites,
        value: formatCompactNumber(totalFavorites, numberLocale),
        hint: copy.savedByUsers,
        icon: Heart,
        iconClassName:
          'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
      },
      {
        key: 'chats',
        label: copy.unreadChats,
        value: formatCompactNumber(unreadChats, numberLocale),
        hint: unreadChats > 0 ? copy.unreadHint : copy.inboxClean,
        icon: MessageCircle,
        iconClassName:
          'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
      },
      {
        key: 'active',
        label: copy.activePosts,
        value: formatCompactNumber(activePostCount, numberLocale),
        hint: copy.currentlyActive,
        icon: ShoppingBag,
        iconClassName:
          'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
      },
    ],
    [
      activePostCount,
      copy,
      numberLocale,
      totalFavorites,
      totalViews,
      unreadChats,
    ],
  );

  const completionItems = useMemo(
    () => [
      {
        key: 'avatar',
        label: copy.photoProfile,
        complete: Boolean(
          normalizeProfileMediaUrl(avatarUrlInput) ||
          detail?.avatar_url ||
          detail?.avatarUrl ||
          detail?.metadata?.avatar_url,
        ),
      },
      {
        key: 'bio',
        label: copy.bioBusiness,
        complete: Boolean(firstString(detail?.bio, user?.bio)),
      },
      {
        key: 'location',
        label: copy.businessLocation,
        complete: Boolean(location),
      },
      {
        key: 'contact',
        label: copy.contact,
        complete: Boolean(phone || detail?.email || user?.email),
      },
      {
        key: 'cover',
        label: copy.businessPhoto,
        complete: Boolean(effectiveCoverUrl),
      },
      {
        key: 'verification',
        label: copy.identityVerification,
        complete: verified,
      },
    ],
    [
      avatarUrlInput,
      copy,
      detail,
      effectiveCoverUrl,
      location,
      phone,
      user,
      verified,
    ],
  );

  const profilePercent = useMemo(() => {
    const complete = completionItems.filter(item => item.complete).length;
    return Math.round((complete / completionItems.length) * 100);
  }, [completionItems]);

  const sourceListings =
    activeTab === 'drafts' ? draftListings : activeListings;

  const visibleListings = useMemo(() => {
    const filtered = sourceListings.filter(item => {
      if (activeFilter === 'all') return true;
      return normalizeListingType(item) === activeFilter;
    });

    return [...filtered].sort((left, right) => {
      if (sortMode === 'most_viewed') {
        return (
          readListingMetric(right, ['view_count', 'views_count', 'views']) -
          readListingMetric(left, ['view_count', 'views_count', 'views'])
        );
      }

      const leftDate = new Date(
        left.created_at || left.updated_at || 0,
      ).getTime();
      const rightDate = new Date(
        right.created_at || right.updated_at || 0,
      ).getTime();

      return sortMode === 'oldest'
        ? leftDate - rightDate
        : rightDate - leftDate;
    });
  }, [activeFilter, sortMode, sourceListings]);

  const saveProfileMedia = useCallback(
    async ({
      avatarUrl,
      coverUrl,
      successMessage,
    }: {
      avatarUrl?: string;
      coverUrl?: string;
      successMessage: string;
    }) => {
      const currentMedia =
        asRecord(detail?.media) || asRecord(mergedMetadata.media) || {};

      const nextMedia = {
        ...currentMedia,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        ...(coverUrl ? { cover_image: coverUrl } : {}),
      };

      const body = {
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        ...(coverUrl ? { cover_image: coverUrl } : {}),
        media: nextMedia,
        metadata: {
          ...mergedMetadata,
          media: nextMedia,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          ...(coverUrl ? { cover_image: coverUrl } : {}),
        },
      };

      const response = await authFetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error || copy.saveError);
      }

      setSaveMessage(successMessage);
      await Promise.all([loadProfile('refresh'), refreshUser()]);
    },
    [
      authFetch,
      copy.saveError,
      detail?.media,
      loadProfile,
      mergedMetadata,
      refreshUser,
    ],
  );

  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      if (!file.type.startsWith('image/')) {
        throw new Error(copy.uploadError);
      }

      const optimizedFile = await prepareUploadFile(file);
      const formData = new FormData();
      formData.append('images', optimizedFile);

      const response = await authFetch('/api/content/upload-images', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          firstString(asRecord(payload)?.error) || copy.uploadError,
        );
      }

      const uploadedUrl = extractFirstUploadedImageUrl(payload);
      if (!uploadedUrl) throw new Error(copy.uploadError);
      return uploadedUrl;
    },
    [authFetch, copy.uploadError],
  );

  const openCropper = (
    event: ChangeEvent<HTMLInputElement>,
    target: 'avatar' | 'cover',
  ) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;

    if (cropSource) URL.revokeObjectURL(cropSource);
    setSaveMessage('');
    setCropSource(URL.createObjectURL(file));
    setCropTarget(target);
  };

  const closeCropper = () => {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource('');
    setCropTarget(null);
  };

  const confirmCrop = async (file: File) => {
    if (!cropTarget) return;

    if (cropTarget === 'avatar') {
      setAvatarUploading(true);
      try {
        const uploadedUrl = await uploadImage(file);
        setAvatarUrlInput(uploadedUrl);
        await saveProfileMedia({
          avatarUrl: uploadedUrl,
          successMessage: copy.updateSuccess,
        });
      } catch (error) {
        setSaveMessage(
          error instanceof Error ? error.message : copy.uploadError,
        );
      } finally {
        setAvatarUploading(false);
        closeCropper();
      }
      return;
    }

    setCoverUploading(true);
    try {
      const uploadedUrl = await uploadImage(file);
      setCoverUrlInput(uploadedUrl);
      await saveProfileMedia({
        coverUrl: uploadedUrl,
        successMessage: copy.coverSuccess,
      });
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : copy.uploadError);
    } finally {
      setCoverUploading(false);
      closeCropper();
    }
  };

  if (authLoading || loading) return <ProfileViewSkeleton />;

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4">
        <div className="w-full rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-8 text-center">
          <h1 className="text-xl font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {copy.login}
          </h1>
        </div>
      </div>
    );
  }

  const publicProfileHref = detail?.id
    ? `/profile/${buildPublicProfileSlug({
        id: detail.id,
        username: handle || undefined,
        full_name: displayName || 'member',
      })}`
    : ROUTES.editProfile;

  const quickActions: QuickAction[] = [
    {
      key: 'create',
      label: copy.createPost,
      href: ROUTES.create,
      icon: Plus,
    },
    {
      key: 'manage',
      label: copy.managePosts,
      href: ROUTES.manage,
      icon: ClipboardList,
    },
    {
      key: 'drafts',
      label: copy.drafts,
      href: ROUTES.drafts,
      icon: FileText,
      badge: draftListings.length,
    },
    {
      key: 'promotion',
      label: copy.promotion,
      href: ROUTES.promotion,
      icon: Megaphone,
    },
    {
      key: 'insights',
      label: copy.insights,
      href: ROUTES.insights,
      icon: BarChart3,
    },
  ];

  const tabItems: Array<{ key: OwnerTab; label: string; count: number }> = [
    { key: 'posts', label: copy.myPosts, count: activeListings.length },
    { key: 'drafts', label: copy.drafts, count: draftListings.length },
  ];

  const filterItems: Array<{ key: ListingFilter; label: string }> = [
    { key: 'all', label: copy.all },
    { key: 'product', label: copy.products },
    { key: 'service', label: copy.services },
    { key: 'supplier', label: copy.suppliers },
    { key: 'place', label: copy.places },
  ];

  const sortLabel =
    sortMode === 'oldest'
      ? copy.oldest
      : sortMode === 'most_viewed'
        ? copy.mostViewed
        : copy.newest;

  const cycleSort = () => {
    setSortMode(current => {
      if (current === 'newest') return 'most_viewed';
      if (current === 'most_viewed') return 'oldest';
      return 'newest';
    });
  };

  return (
    <>
      <main className="min-h-screen max-w-full overflow-x-clip bg-[color:var(--app-surface-muted)] pb-[calc(6rem+env(safe-area-inset-bottom))] pt-2 sm:pb-10 sm:pt-6">
        <div className="page-shell min-w-0 max-w-full space-y-4 overflow-x-clip px-3 sm:px-4 lg:px-6">
          <section className="min-w-0 max-w-full overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-sm sm:rounded-[28px]">
            <div className="relative h-40 overflow-hidden sm:h-52 lg:h-60">
              {effectiveCoverUrl ? (
                <NextImage
                  src={effectiveCoverUrl}
                  alt=""
                  fill
                  priority
                  unoptimized
                  sizes="100vw"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_26%,rgba(16,185,129,0.24),transparent_32%),radial-gradient(circle_at_78%_36%,rgba(52,211,153,0.2),transparent_28%),linear-gradient(135deg,#ecfdf5_0%,#f8fafc_48%,#dcfce7_100%)] dark:bg-[radial-gradient(circle_at_18%_26%,rgba(16,185,129,0.18),transparent_32%),radial-gradient(circle_at_78%_36%,rgba(52,211,153,0.14),transparent_28%),linear-gradient(135deg,#0f172a_0%,#111827_48%,#052e25_100%)]">
                  <div className="absolute bottom-0 left-[8%] h-16 w-16 rounded-t-[34px] bg-emerald-200/60 dark:bg-emerald-900/40 sm:h-20 sm:w-20" />
                  <div className="absolute bottom-0 left-[18%] h-24 w-28 rounded-t-[42px] bg-white/70 dark:bg-slate-800/70 sm:h-28 sm:w-32" />
                  <div className="absolute bottom-0 right-[8%] h-20 w-40 rounded-t-3xl border-x border-t border-emerald-200/80 bg-white/80 dark:border-emerald-900/70 dark:bg-slate-800/80 sm:right-[12%] sm:h-24 sm:w-52" />
                  <div className="absolute bottom-10 right-[13%] rounded-lg bg-emerald-700 px-5 py-1.5 text-xs font-black tracking-wide text-white shadow-lg sm:bottom-14 sm:right-[17%] sm:px-7 sm:py-2 sm:text-sm">
                    LAJUKAN
                  </div>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/15" />

              <label
                htmlFor="owner-cover-upload"
                className="absolute right-3 top-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-white/70 bg-black/45 px-3 text-xs font-bold text-white shadow-sm backdrop-blur-md transition hover:bg-black/60"
              >
                {coverUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{copy.coverLabel}</span>
              </label>

              <input
                id="owner-cover-upload"
                type="file"
                accept="image/*"
                className="hidden"
                disabled={coverUploading || avatarUploading}
                onChange={event => openCropper(event, 'cover')}
              />
            </div>

            <div className="relative min-w-0 px-4 pb-5 sm:px-7 sm:pb-7">
              <div className="-mt-12 flex items-end justify-between gap-3 sm:-mt-16">
                <div className="relative h-24 w-24 shrink-0 rounded-full border-[5px] border-[color:var(--app-surface-strong)] bg-[color:var(--app-surface-muted)] shadow-lg sm:h-32 sm:w-32">
                  <div className="absolute inset-0 overflow-hidden rounded-full">
                    <NextImage
                      src={effectiveAvatarUrl}
                      alt={displayName || user.email}
                      fill
                      priority
                      unoptimized
                      sizes="128px"
                      className="object-cover"
                    />
                  </div>

                  <label
                    htmlFor="owner-avatar-upload"
                    aria-label={copy.avatarLabel}
                    className="absolute -bottom-1 -right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-4 border-[color:var(--app-surface-strong)] bg-white text-slate-900 shadow-md transition hover:scale-105 dark:bg-slate-800 dark:text-white"
                  >
                    {avatarUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </label>

                  <input
                    id="owner-avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={avatarUploading || coverUploading}
                    onChange={event => openCropper(event, 'avatar')}
                  />
                </div>

                <div className="hidden items-center gap-2 pb-2 md:flex">
                  <button
                    type="button"
                    onClick={() => void loadProfile('refresh')}
                    disabled={refreshing}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm font-bold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] disabled:opacity-60 dark:text-[color:var(--app-text-inverse)]"
                  >
                    <RefreshCw
                      className={cn('h-4 w-4', refreshing && 'animate-spin')}
                    />
                    {refreshing ? copy.refreshing : copy.refresh}
                  </button>

                  <LocalizedLink
                    href={publicProfileHref}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-sm font-bold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] dark:text-[color:var(--app-text-inverse)]"
                  >
                    <Eye className="h-4 w-4" />
                    {copy.publicProfile}
                  </LocalizedLink>

                  <LocalizedLink
                    href={ROUTES.editProfile}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-600 px-4 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                  >
                    <PencilLine className="h-4 w-4" />
                    {copy.editProfile}
                  </LocalizedLink>
                </div>
              </div>

              <div className="mt-4 min-w-0">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h1 className="min-w-0 max-w-full break-words text-2xl font-black leading-tight tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-3xl">
                      {displayName}
                    </h1>

                    {verified ? (
                      <BadgeCheck
                        className="h-6 w-6 shrink-0 fill-emerald-600 text-white"
                        aria-label={copy.verified}
                      />
                    ) : null}
                  </div>

                  <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                    <span className="max-w-full break-all text-sm font-medium text-[color:var(--app-text-soft)]">
                      @{handle || 'user'}
                    </span>

                    {verified ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        {copy.verified}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-4 max-w-2xl break-words text-sm leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    {bio}
                  </p>

                  <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-[color:var(--app-text-soft)]">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {location || copy.locationFallback}
                      </span>
                    </span>

                    {joinedDate ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4 shrink-0" />
                        {copy.joined} {joinedDate}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 md:hidden">
                  <LocalizedLink
                    href={publicProfileHref}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] px-3 text-xs font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]"
                  >
                    <Eye className="h-4 w-4" />
                    <span className="truncate">{copy.publicProfile}</span>
                  </LocalizedLink>

                  <LocalizedLink
                    href={ROUTES.editProfile}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-600 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-300"
                  >
                    <PencilLine className="h-4 w-4" />
                    {copy.editProfile}
                  </LocalizedLink>

                  <button
                    type="button"
                    onClick={() => void loadProfile('refresh')}
                    disabled={refreshing}
                    className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] text-xs font-bold text-[color:var(--app-text-soft)] disabled:opacity-60"
                  >
                    <RefreshCw
                      className={cn('h-4 w-4', refreshing && 'animate-spin')}
                    />
                    {refreshing ? copy.refreshing : copy.refresh}
                  </button>
                </div>
              </div>

              {saveMessage ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {saveMessage}
                </div>
              ) : null}

              {profileError ? (
                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between">
                  <span>{profileError}</span>
                  <button
                    type="button"
                    onClick={() => void loadProfile('refresh')}
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-rose-300 px-3 font-bold dark:border-rose-800"
                  >
                    {copy.retry}
                  </button>
                </div>
              ) : null}

              <section className="mt-6 min-w-0 rounded-2xl border border-[color:var(--app-border)] p-4 sm:p-5">
                <div className="flex min-w-0 items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {copy.profileReady}
                    </h2>
                    <div className="mt-2 flex min-w-0 items-center gap-3 sm:gap-4">
                      <span className="shrink-0 text-2xl font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-3xl">
                        {profilePercent}%
                      </span>
                      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-emerald-600 transition-[width] duration-500"
                          style={{ width: `${profilePercent}%` }}
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                      {copy.profileHint}
                    </p>
                  </div>

                  <LocalizedLink
                    href={ROUTES.editProfile}
                    className="hidden min-h-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--app-border)] px-4 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10 sm:inline-flex"
                  >
                    {copy.completeProfile}
                  </LocalizedLink>
                </div>

                <div className="mt-5 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  {completionItems.map(item => (
                    <CompletionItem
                      key={item.key}
                      label={item.label}
                      complete={item.complete}
                    />
                  ))}
                </div>

                <LocalizedLink
                  href={ROUTES.editProfile}
                  className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-[color:var(--app-border)] text-xs font-bold text-emerald-700 dark:text-emerald-300 sm:hidden"
                >
                  {copy.completeProfile}
                </LocalizedLink>
              </section>

              <section className="mt-4 min-w-0">
                <EmblaRail
                  ariaLabel={copy.swipe}
                  itemClassName="flex-[0_0_78%] xs:flex-[0_0_64%] sm:flex-[0_0_46%] lg:flex-[0_0_calc(25%-0.6rem)]"
                >
                  {stats.map(item => (
                    <StatCard key={item.key} item={item} />
                  ))}
                </EmblaRail>

                {statsPartial ? (
                  <p className="mt-2 text-[11px] text-[color:var(--app-text-soft)]">
                    {copy.profileApiPartial}
                  </p>
                ) : null}
              </section>

              <section className="mt-6 min-w-0">
                <h2 className="text-base font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {copy.quickActions}
                </h2>

                <div className="mt-4">
                  <EmblaRail
                    ariaLabel={copy.quickActions}
                    itemClassName="flex-[0_0_29%] xs:flex-[0_0_24%] sm:flex-[0_0_18%] lg:flex-[0_0_calc(20%-0.6rem)]"
                    showControls={false}
                  >
                    {quickActions.map(action => {
                      const Icon = action.icon;

                      return (
                        <LocalizedLink
                          key={action.key}
                          href={action.href}
                          className="group flex min-w-0 flex-col items-center gap-2 text-center"
                        >
                          <span className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-emerald-700 transition group-hover:-translate-y-0.5 group-hover:border-emerald-300 group-hover:bg-emerald-50 dark:text-emerald-300 dark:group-hover:bg-emerald-500/10 sm:h-14 sm:w-14">
                            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                            {typeof action.badge === 'number' &&
                            action.badge > 0 ? (
                              <span className="absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white">
                                {action.badge > 99 ? '99+' : action.badge}
                              </span>
                            ) : null}
                          </span>
                          <span className="line-clamp-2 text-[10px] font-bold leading-4 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:text-xs">
                            {action.label}
                          </span>
                        </LocalizedLink>
                      );
                    })}
                  </EmblaRail>
                </div>
              </section>
            </div>
          </section>

          <section className="min-w-0 max-w-full overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-sm sm:rounded-[28px]">
            <ProfileTabRail
              activeTab={activeTab}
              items={tabItems}
              onChange={tab => {
                setActiveTab(tab);
                setActiveFilter('all');
              }}
            />

            <div className="flex min-w-0 items-center gap-2 px-3 py-3 sm:px-5 sm:py-4">
              <FilterRail
                activeFilter={activeFilter}
                items={filterItems}
                onChange={setActiveFilter}
              />

              <button
                type="button"
                onClick={cycleSort}
                aria-label={sortLabel}
                title={sortLabel}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] px-2.5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:px-3"
              >
                <Settings2 className="h-4 w-4" />
                <span className="hidden text-xs font-bold sm:inline">
                  {sortLabel}
                </span>
              </button>
            </div>

            {visibleListings.length > 0 ? (
              <div className="space-y-3 px-3 pb-3 sm:px-5 sm:pb-5">
                {visibleListings.map(item => (
                  <ListingCard
                    key={item.id}
                    item={item}
                    isId={isId}
                    locale={numberLocale}
                    copy={copy}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title={
                  activeTab === 'drafts' ? copy.noDraftTitle : copy.noPostsTitle
                }
                description={
                  activeTab === 'drafts'
                    ? copy.noDraftDescription
                    : copy.noPostsDescription
                }
                href={activeTab === 'drafts' ? ROUTES.drafts : ROUTES.create}
                actionLabel={
                  activeTab === 'drafts' ? copy.manageDrafts : copy.makePost
                }
              />
            )}

            {visibleListings.length > 0 ? (
              <div className="px-3 pb-4 sm:px-5 sm:pb-5">
                <LocalizedLink
                  href={activeTab === 'drafts' ? ROUTES.drafts : ROUTES.manage}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-black text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                >
                  {copy.viewAll}
                  <ArrowRight className="h-4 w-4" />
                </LocalizedLink>
              </div>
            ) : null}
          </section>
        </div>
      </main>

      <ImageCropModal
        open={Boolean(cropTarget && cropSource)}
        imageSrc={cropSource}
        aspect={cropTarget === 'cover' ? 16 / 9 : 1}
        maxOutputSize={cropTarget === 'cover' ? 1600 : 512}
        title={cropTarget === 'cover' ? copy.coverLabel : copy.avatarLabel}
        shape={cropTarget === 'avatar' ? 'round' : 'rect'}
        onCancel={closeCropper}
        onConfirm={confirmCrop}
      />
    </>
  );
}
