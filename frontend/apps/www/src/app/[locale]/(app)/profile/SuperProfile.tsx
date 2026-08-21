'use client';

import {
  type ChangeEvent,
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import NextImage from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BriefcaseBusiness,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  Circle,
  ClipboardList,
  Eye,
  FileText,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  MoreVertical,
  Package,
  PencilLine,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShoppingBag,
  Star,
  Store,
  Users,
  X,
} from 'lucide-react';

import { ImageCropModal } from '@/components/common/ImageCropModal';

import { ProfileRail, ProfileRailItem } from '@/components/profile/ProfileRail';
import { OwnerProfileSkeleton } from '@/components/system/feedback/RouteSkeletons';
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
import { OwnerProfileEditModal, OwnerProfileEditSection } from './OwnerProfileEditModal';

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

type QuickAction = {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
};

type ProfileSocialUser = {
  id: string;
  username?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  title?: string | null;
};

type ProfileSocialSummary = {
  userId?: string;
  forumUserId?: string;
  followersCount: number;
  followingCount: number;
  reelsCount: number;
  followers: ProfileSocialUser[];
  following: ProfileSocialUser[];
};

type ProfileSocialTab = 'followers' | 'following';
type ProfileModalKind = 'edit' | 'social' | 'crop';
type CropTarget = 'avatar' | 'cover';
type ModalNavigationMode = 'push' | 'replace';

function normalizeProfileModalKind(value: string | null): ProfileModalKind | null {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'edit' || normalized === 'social' || normalized === 'crop') {
    return normalized;
  }
  return null;
}

function normalizeProfileSocialTab(value: string | null): ProfileSocialTab | null {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'followers' || normalized === 'following') return normalized;
  return null;
}

function normalizeCropTarget(value: string | null): CropTarget | null {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'avatar' || normalized === 'cover') return normalized;
  return null;
}

function normalizeOwnerProfileEditSection(
  value: string | null,
): OwnerProfileEditSection | null {
  switch ((value || '').trim().toLowerCase()) {
    case 'menu':
      return 'menu';
    case 'identity':
    case 'profile':
    case 'main':
      return 'identity';
    case 'contact':
      return 'contact';
    case 'business':
    case 'seller':
    case 'provider':
      return 'business';
    case 'professional':
    case 'talent':
    case 'freelancer':
      return 'professional';
    case 'buyer':
    case 'need':
      return 'buyer';
    case 'history':
    case 'experience':
    case 'education':
      return 'history';
    case 'media':
    case 'gallery':
    case 'document':
      return 'media';
    case 'trust':
    case 'verification':
      return 'trust';
    default:
      return null;
  }
}

type Copy = ReturnType<typeof buildCopy>;

const ROUTES = {
  create: '/create?mode=quick',
  manage: '/manage',
  manageListings: '/my-listings',
  manageCommunity: '/manage/community',
  manageReels: '/manage/reels',
  drafts: '/my-listings?status=draft',
  promotion: '/create?mode=promotion',
  insights: '/dashboard',
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
        profileReady: 'Siapkan profil usahamu',
        profileHint:
          'Profil yang jelas membuat calon pembeli lebih yakin untuk menghubungi kamu.',
        needAttention: 'belum diisi',
        alreadyNeat: 'Profil siap digunakan',
        openTask: 'Lengkapi',
        completeProfile: 'Lengkapi profil usaha',
        completeLabel: 'Lengkap',
        missingLabel: 'Belum lengkap',
        nextStep: 'Lengkapi berikutnya',
        improveNow: 'Lengkapi sekarang',
        publicProfile: 'Lihat sebagai pengunjung',
        editProfile: 'Edit Profil',
        verified: 'Akun Terverifikasi',
        joined: 'Bergabung',
        followers: 'Pengikut',
        followersHint: 'Akun yang mengikuti kamu',
        following: 'Mengikuti',
        followingHint: 'Akun yang kamu ikuti',
        reels: 'Reels',
        reelsHint: 'Video pendek aktif',
        socialTitle: 'Pengikut & Mengikuti',
        noFollowers: 'Belum ada pengikut yang terekam.',
        noFollowing: 'Kamu belum mengikuti akun lain.',
        openPublicProfile: 'Buka profil publik',
        viewed: 'Kunjungan',
        favorites: 'Disimpan',
        unreadChats: 'Chat belum dibalas',
        activePosts: 'Posting aktif',
        totalViews: 'Total orang yang melihat',
        savedByUsers: 'Disimpan calon pembeli',
        unreadHint: 'Ada pesan yang perlu dibalas',
        inboxClean: 'Semua pesan sudah dibalas',
        currentlyActive: 'Sedang tayang',
        quickActions: 'Apa yang ingin kamu lakukan?',
        createPost: 'Buat penawaran',
        managePosts: 'Kelola konten',
        manageListings: 'Produk & jasa saya',
        contentStudio: 'Pusat aktivitas usaha',
        contentStudioHint:
          'Kelola produk, jasa, komunitas, dan video dari satu tempat.',
        openContentStudio: 'Kelola aktivitas',
        communityChannel: 'Komunitas saya',
        reelsChannel: 'Video saya',
        activeChannel: 'Aktif',
        draftChannel: 'Belum diterbitkan',
        manageChannel: 'Kelola',
        drafts: 'Belum diterbitkan',
        promotion: 'Promosikan usaha',
        insights: 'Statistik',
        myPosts: 'Sudah tayang',
        all: 'Semua',
        products: 'Produk',
        services: 'Jasa',
        suppliers: 'Supplier',
        places: 'Tempat Usaha',
        newest: 'Paling baru',
        oldest: 'Paling lama',
        mostViewed: 'Paling banyak dilihat',
        active: 'Aktif',
        viewAll: 'Buka halaman pengelolaan',
        noPostsTitle: 'Belum ada penawaran yang tayang',
        noPostsDescription:
          'Mulai tawarkan produk, jasa, bahan usaha, atau tempat usaha kepada calon pembeli.',
        makePost: 'Buat penawaran pertama',
        noDraftTitle: 'Tidak ada penawaran yang belum diterbitkan',
        noDraftDescription:
          'Penawaran yang kamu simpan sebelum diterbitkan akan muncul di sini.',
        manageDrafts: 'Kelola yang belum diterbitkan',
        photoProfile: 'Foto profil',
        bioBusiness: 'Tentang usaha atau keahlian',
        businessLocation: 'Lokasi usaha',
        contact: 'Kontak',
        businessPhoto: 'Foto sampul usaha',
        identityVerification: 'Verifikasi identitas',
        updateSuccess: 'Foto profil berhasil diperbarui.',
        coverSuccess: 'Sampul profil berhasil diperbarui.',
        uploadError: 'Gagal mengunggah gambar.',
        saveError: 'Gagal menyimpan perubahan profil.',
        coverLabel: 'Ubah sampul',
        avatarLabel: 'Ubah foto profil',
        profileFallback:
          'Jelaskan produk, jasa, usaha, atau keahlian yang kamu tawarkan.',
        locationFallback: 'Tambahkan lokasi usaha',
        manage: 'Kelola penawaran',
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
        needAttention: 'Needs input',
        alreadyNeat: 'Looks good',
        openTask: 'Fill',
        completeProfile: 'Complete Profile',
        completeLabel: 'Complete',
        missingLabel: 'Missing',
        nextStep: 'Next step',
        improveNow: 'Improve now',
        publicProfile: 'View Public Profile',
        editProfile: 'Edit Profile',
        verified: 'Verified Account',
        joined: 'Joined',
        followers: 'Followers',
        followersHint: 'Accounts following you',
        following: 'Following',
        followingHint: 'Accounts you follow',
        reels: 'Reels',
        reelsHint: 'Active short videos',
        socialTitle: 'Followers & Following',
        noFollowers: 'No recorded followers yet.',
        noFollowing: 'You are not following anyone yet.',
        openPublicProfile: 'Open public profile',
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
        managePosts: 'Content Studio',
        manageListings: 'My Listings',
        contentStudio: 'Your content hub',
        contentStudioHint:
          'Listings, community posts, and reels can now be managed from one clear place.',
        openContentStudio: 'Open Content Studio',
        communityChannel: 'Community',
        reelsChannel: 'Video saya',
        activeChannel: 'Live',
        draftChannel: 'Drafts',
        manageChannel: 'Manage',
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

function normalizeProfileSocialUser(value: unknown): ProfileSocialUser | null {
  const row = asRecord(value);
  if (!row) return null;

  const id = firstString(row.id, row.user_id, row.userId);
  if (!id) return null;

  return {
    id,
    username: firstString(row.username, row.handle) || null,
    name: firstString(row.name, row.full_name, row.fullName) || null,
    avatarUrl: firstString(row.avatarUrl, row.avatar_url, row.avatar) || null,
    title: firstString(row.title, row.headline, row.bio) || null,
  };
}

function normalizeProfileSocialSummary(
  payload: unknown,
): ProfileSocialSummary | null {
  const row = asRecord(payload);
  if (!row) return null;

  const followers = Array.isArray(row.followers)
    ? row.followers
        .map(item => normalizeProfileSocialUser(item))
        .filter((item): item is ProfileSocialUser => Boolean(item))
    : [];
  const following = Array.isArray(row.following)
    ? row.following
        .map(item => normalizeProfileSocialUser(item))
        .filter((item): item is ProfileSocialUser => Boolean(item))
    : [];

  return {
    userId: firstString(row.userId, row.user_id) || undefined,
    forumUserId: firstString(row.forumUserId, row.forum_user_id) || undefined,
    followersCount: Math.max(
      followers.length,
      Math.floor(readNumber(row.followersCount ?? row.followers_count)),
    ),
    followingCount: Math.max(
      following.length,
      Math.floor(readNumber(row.followingCount ?? row.following_count)),
    ),
    reelsCount: Math.max(
      0,
      Math.floor(readNumber(row.reelsCount ?? row.reels_count)),
    ),
    followers,
    following,
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

function ProfileTabRail({
  activeTab,
  items,
  onChange,
}: {
  activeTab: OwnerTab;
  items: Array<{ key: OwnerTab; label: string; count: number }>;
  onChange: (tab: OwnerTab) => void;
}) {
  return (
    <div className="px-2.5 pt-2.5 sm:px-2 sm:pt-4">
      <div className="rounded-xl bg-[color:var(--app-surface-muted)] p-1 dark:bg-[color:var(--app-surface)]">
        <ProfileRail
          activeIndex={items.findIndex(item => item.key === activeTab)}
          ariaLabel="Profile content status"
          trackClassName="gap-1"
        >
          {items.map(item => {
            const active = item.key === activeTab;
            return (
              <ProfileRailItem key={item.key}>
                <button
                  type="button"
                  onClick={() => onChange(item.key)}
                  aria-pressed={active}
                  className={cn(
                    'flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-black transition',
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
              </ProfileRailItem>
            );
          })}
        </ProfileRail>
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
  return (
    <ProfileRail
      activeIndex={items.findIndex(item => item.key === activeFilter)}
      ariaLabel="Listing filters"
      className="min-w-0 flex-1"
    >
      {items.map(item => {
        const active = item.key === activeFilter;
        return (
          <ProfileRailItem key={item.key}>
            <button
              type="button"
              onClick={() => onChange(item.key)}
              aria-pressed={active}
              className={cn(
                'min-h-9 whitespace-nowrap rounded-full border px-4 text-xs font-bold transition',
                active
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)] hover:border-emerald-300 hover:text-[color:var(--app-text)]',
              )}
            >
              {item.label}
            </button>
          </ProfileRailItem>
        );
      })}
    </ProfileRail>
  );
}

function ProfileSocialModal({
  open,
  tab,
  copy,
  locale,
  followers,
  following,
  followersCount,
  followingCount,
  onTabChange,
  onClose,
}: {
  open: boolean;
  tab: ProfileSocialTab;
  copy: Copy;
  locale: string;
  followers: ProfileSocialUser[];
  following: ProfileSocialUser[];
  followersCount: number;
  followingCount: number;
  onTabChange: (tab: ProfileSocialTab) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const activeUsers = tab === 'followers' ? followers : following;
  const emptyText = tab === 'followers' ? copy.noFollowers : copy.noFollowing;
  const tabs: Array<{ key: ProfileSocialTab; label: string; count: number }> = [
    { key: 'followers', label: copy.followers, count: followersCount },
    { key: 'following', label: copy.following, count: followingCount },
  ];

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[86vh] w-full max-w-lg overflow-hidden rounded-t-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-[color:var(--app-border)] px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
              Social
            </p>
            <h2 className="text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {copy.socialTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-[color:var(--app-border)] p-3">
          {tabs.map(item => {
            const active = tab === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={cn(
                  'rounded-2xl px-4 py-3 text-left transition',
                  active
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
                    : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] hover:text-[color:var(--app-text)]',
                )}
              >
                <p className="text-lg font-black">
                  {formatCompactNumber(item.count, locale)}
                </p>
                <p className="text-xs font-bold">{item.label}</p>
              </button>
            );
          })}
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-3">
          {activeUsers.length > 0 ? (
            <div className="space-y-2">
              {activeUsers.map(item => {
                const name = item.name || item.username || item.id;
                const avatar = profileAvatarSrc(
                  item.avatarUrl || item.avatar_url || '',
                  undefined,
                  name,
                );
                const publicId = item.id.replace(/^auth-/, '');
                const href = `/profile/${buildPublicProfileSlug({
                  id: publicId,
                  username: item.username || undefined,
                  full_name: name,
                })}`;

                return (
                  <LocalizedLink
                    key={item.id}
                    href={href}
                    onClick={onClose}
                    className="flex min-w-0 items-center gap-3 rounded-2xl border border-transparent p-2 transition hover:border-[color:var(--app-border)] hover:bg-[color:var(--app-surface-muted)]"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
                      <NextImage
                        src={avatar}
                        alt={name}
                        fill
                        unoptimized
                        sizes="48px"
                        className="object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        {name}
                      </p>
                      <p className="truncate text-xs text-[color:var(--app-text-soft)]">
                        @{item.username || publicId}
                      </p>
                      {item.title ? (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-[color:var(--app-text-soft)]">
                          {item.title}
                        </p>
                      ) : null}
                    </div>
                  </LocalizedLink>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--app-border)] px-5 text-center">
              <Users className="h-8 w-8 text-[color:var(--app-text-soft)]" />
              <p className="mt-3 text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {emptyText}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompletionItem({
  label,
  href,
  complete,
  completeLabel,
  missingLabel,
  actionLabel,
}: {
  label: string;
  href: string;
  complete: boolean;
  completeLabel: string;
  missingLabel: string;
  actionLabel: string;
}) {
  const content = (
    <>
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
          complete
            ? 'bg-emerald-600 text-white'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
        )}
      >
        {complete ? (
          <Check className="h-3 w-3" strokeWidth={3} />
        ) : (
          <Circle className="h-2.5 w-2.5 fill-current" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        <span
          className={cn(
            'mt-0.5 block truncate text-[10px] font-semibold',
            complete
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-amber-700 dark:text-amber-200',
          )}
        >
          {complete ? completeLabel : missingLabel}
        </span>
      </span>
      {!complete ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 text-[10px] font-black text-amber-800 shadow-sm dark:bg-white/10 dark:text-amber-100">
          {actionLabel}
          <ArrowRight className="h-3 w-3" />
        </span>
      ) : null}
    </>
  );

  if (!complete) {
    return (
      <LocalizedLink
        href={href}
        className="group flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-100 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-amber-900/60 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/15"
      >
        {content}
      </LocalizedLink>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-500/10 dark:text-emerald-200">
      {content}
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

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_16px_36px_-28px_rgba(15,23,42,0.45)]">
      <LocalizedLink href={getListingHref(item)} className="block min-w-0">
        <div className="relative aspect-square w-full overflow-hidden bg-[color:var(--app-surface-muted)]">
          {imageUrl ? (
            <NextImage
              src={imageUrl}
              alt={item.title || ''}
              fill
              unoptimized
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[color:var(--app-text-soft)]">
              <Package className="h-9 w-9" />
            </div>
          )}

          <span
            className={cn(
              'absolute left-2 top-2 inline-flex rounded-lg px-2 py-1 text-[8px] font-black tracking-[0.04em] shadow-sm backdrop-blur-sm sm:text-[9px]',
              presentation.className,
            )}
          >
            {presentation.label}
          </span>

          <span
            className={cn(
              'absolute bottom-2 left-2 inline-flex rounded-full px-2 py-1 text-[8px] font-black shadow-sm backdrop-blur-sm',
              status === 'draft'
                ? 'bg-amber-50/95 text-amber-700'
                : 'bg-emerald-50/95 text-emerald-700',
            )}
          >
            {status === 'draft' ? copy.drafts : copy.active}
          </span>
        </div>

        <div className="min-w-0 p-3">
          <h3 className="line-clamp-2 min-h-10 text-[13px] font-black leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-sm">
            {item.title || (isId ? 'Tanpa judul' : 'Untitled')}
          </h3>
          <p className="mt-1 truncate text-[13px] font-black text-emerald-700 dark:text-emerald-300 sm:text-sm">
            {formatPrice(item, locale, copy.emptyPrice)}
          </p>

          <div className="mt-2 flex items-center gap-3 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {formatCompactNumber(views, locale)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              {formatCompactNumber(favorites, locale)}
            </span>
          </div>
        </div>
      </LocalizedLink>

      <LocalizedLink
        href={`${ROUTES.manageListings}?listing=${encodeURIComponent(item.id)}`}
        aria-label={copy.manage}
        title={copy.manage}
        className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/48 text-white shadow-sm backdrop-blur-md transition hover:bg-black/68"
      >
        <MoreVertical className="h-[18px] w-[18px]" />
      </LocalizedLink>
    </article>
  );
}

export default function SuperProfile() {
  const { user, authFetch, refreshUser, loading: authLoading } = useAuth();
  const { totalUnread } = useChatInbox();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isId = resolveLocaleFromPathname(pathname) === 'id';
  const numberLocale = isId ? 'id-ID' : 'en-US';
  const copy = useMemo(() => buildCopy(isId), [isId]);

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [activeListings, setActiveListings] = useState<OwnerListing[]>([]);
  const [draftListings, setDraftListings] = useState<OwnerListing[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>(
    EMPTY_DASHBOARD_STATS,
  );
  const [profileSocial, setProfileSocial] =
    useState<ProfileSocialSummary | null>(null);
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
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
  const modalOpenedByUiRef = useRef(false);
  const cropModalSessionRef = useRef(false);

  const modalKind = normalizeProfileModalKind(searchParams.get('modal'));
  const legacyEditSection = normalizeOwnerProfileEditSection(
    searchParams.get('edit'),
  );
  const editSection =
    modalKind === 'edit'
      ? normalizeOwnerProfileEditSection(searchParams.get('section')) || 'menu'
      : modalKind === null
        ? legacyEditSection
        : null;
  const socialModalTab =
    modalKind === 'social'
      ? normalizeProfileSocialTab(searchParams.get('tab')) || 'followers'
      : null;
  const urlCropTarget =
    modalKind === 'crop' ? normalizeCropTarget(searchParams.get('target')) : null;

  const navigateModal = useCallback(
    (
      next:
        | { kind: 'edit'; section: OwnerProfileEditSection }
        | { kind: 'social'; tab: ProfileSocialTab }
        | { kind: 'crop'; target: CropTarget }
        | null,
      mode: ModalNavigationMode = 'push',
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const key of ['modal', 'section', 'tab', 'target', 'edit']) {
        params.delete(key);
      }

      if (next) {
        params.set('modal', next.kind);
        if (next.kind === 'edit') params.set('section', next.section);
        if (next.kind === 'social') params.set('tab', next.tab);
        if (next.kind === 'crop') params.set('target', next.target);
      }

      const query = params.toString();
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const href = `${pathname}${query ? `?${query}` : ''}${hash}`;
      const options = { scroll: false } as const;

      if (mode === 'replace') router.replace(href, options);
      else router.push(href, options);
    },
    [pathname, router, searchParams],
  );

  const openEditModal = useCallback(
    (section: OwnerProfileEditSection = 'menu') => {
      modalOpenedByUiRef.current = true;
      navigateModal({ kind: 'edit', section }, 'push');
    },
    [navigateModal],
  );

  const changeEditSection = useCallback(
    (section: OwnerProfileEditSection) => {
      navigateModal({ kind: 'edit', section }, 'replace');
    },
    [navigateModal],
  );

  const openSocialModal = useCallback(
    (tab: ProfileSocialTab = 'followers') => {
      modalOpenedByUiRef.current = true;
      navigateModal({ kind: 'social', tab }, 'push');
    },
    [navigateModal],
  );

  const changeSocialTab = useCallback(
    (tab: ProfileSocialTab) => {
      navigateModal({ kind: 'social', tab }, 'replace');
    },
    [navigateModal],
  );

  const closeProfileModal = useCallback(() => {
    if (
      modalOpenedByUiRef.current &&
      typeof window !== 'undefined' &&
      window.history.length > 1
    ) {
      modalOpenedByUiRef.current = false;
      router.back();
      return;
    }
    navigateModal(null, 'replace');
  }, [navigateModal, router]);

  useEffect(() => {
    if (!modalKind && !legacyEditSection) modalOpenedByUiRef.current = false;
  }, [legacyEditSection, modalKind]);

  useEffect(() => {
    if (!legacyEditSection || modalKind) return;
    navigateModal({ kind: 'edit', section: legacyEditSection }, 'replace');
  }, [legacyEditSection, modalKind, navigateModal]);

  useEffect(() => {
    if (modalKind !== 'crop') {
      cropModalSessionRef.current = false;
      return;
    }
    if (!urlCropTarget || (!cropSource && !cropModalSessionRef.current)) {
      navigateModal(null, 'replace');
      return;
    }
    if (cropSource && cropTarget !== urlCropTarget) setCropTarget(urlCropTarget);
  }, [cropSource, cropTarget, modalKind, navigateModal, urlCropTarget]);

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
        const [
          detailResult,
          activeResult,
          draftResult,
          statsResult,
          socialResult,
        ] = await Promise.allSettled([
          authFetch(`/api/users/${user.id}`, { cache: 'no-store' }),
          authFetch('/api/my-listings?status=active&limit=50', {
            cache: 'no-store',
          }),
          authFetch('/api/my-listings?status=draft&limit=50', {
            cache: 'no-store',
          }),
          authFetch('/api/dashboard/stats', { cache: 'no-store' }),
          authFetch(
            `/api/community/users/${encodeURIComponent(user.id)}/social?limit=64`,
            { cache: 'no-store' },
          ),
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

        if (socialResult.status === 'fulfilled' && socialResult.value.ok) {
          const payload = await socialResult.value.json().catch(() => null);
          setProfileSocial(normalizeProfileSocialSummary(payload));
        } else {
          setProfileSocial(null);
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

  const unreadChats = Math.max(
    0,
    Number.isFinite(totalUnread) ? totalUnread : 0,
    dashboardStats.unread_messages,
  );

  const activePostCount = Math.max(
    dashboardStats.total_content,
    activeListings.length,
  );

  const followersCount = Math.max(
    profileSocial?.followersCount ?? 0,
    Math.floor(
      readNumber(
        mergedMetadata.followers_count ??
          mergedMetadata.follower_count ??
          mergedMetadata.followers,
      ),
    ),
    profileSocial?.followers.length ?? 0,
  );

  const followingCount = Math.max(
    profileSocial?.followingCount ?? 0,
    Math.floor(
      readNumber(mergedMetadata.following_count ?? mergedMetadata.following),
    ),
    profileSocial?.following.length ?? 0,
  );

  const reelsCount = Math.max(
    profileSocial?.reelsCount ?? 0,
    Math.floor(
      readNumber(
        mergedMetadata.reels_count ??
          mergedMetadata.reel_count ??
          mergedMetadata.videos_count,
      ),
    ),
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
    ],
    [
      avatarUrlInput,
      copy,
      detail,
      effectiveCoverUrl,
      location,
      phone,
      user,
    ],
  );

  const profilePercent = useMemo(() => {
    const complete = completionItems.filter(item => item.complete).length;
    return Math.round((complete / completionItems.length) * 100);
  }, [completionItems]);

  const incompleteCompletionItems = useMemo(
    () => completionItems.filter(item => !item.complete),
    [completionItems],
  );
  const nextCompletionItem = incompleteCompletionItems[0] || null;

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
    target: CropTarget,
  ) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;

    if (cropSource) URL.revokeObjectURL(cropSource);
    setSaveMessage('');
    setCropSource(URL.createObjectURL(file));
    setCropTarget(target);
    modalOpenedByUiRef.current = true;
    cropModalSessionRef.current = true;
    navigateModal({ kind: 'crop', target }, 'push');
  };

  const closeCropper = () => {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource('');
    setCropTarget(null);
    if (modalKind === 'crop') closeProfileModal();
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

  if (authLoading || loading) return <OwnerProfileSkeleton />;

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
    : '/profile';

  const contactVerified = Boolean(
    detail?.phone_verified ||
      detail?.email_verified ||
      mergedMetadata.phone_verified === true ||
      mergedMetadata.email_verified === true,
  );
  const coreProfileReady = completionItems.every(item => item.complete);
  const catalogTarget = 5;
  const catalogComplete = activeListings.length >= catalogTarget;
  const catalogRemaining = Math.max(0, catalogTarget - activeListings.length);

  const trustSignals = [
    {
      key: 'identity',
      label: isId ? 'Identitas' : 'Identity',
      active: verified,
      icon: BadgeCheck,
    },
    {
      key: 'contact',
      label: isId ? 'Kontak' : 'Contact',
      active: contactVerified,
      icon: MessageCircle,
    },
    {
      key: 'profile',
      label: isId ? 'Profil' : 'Profile',
      active: coreProfileReady,
      icon: Check,
    },
    {
      key: 'catalog',
      label: isId ? 'Katalog 5+' : 'Catalog 5+',
      active: catalogComplete,
      icon: ShoppingBag,
    },
  ];
  const trustSignalCount = trustSignals.filter(item => item.active).length;
  const trustPercent = Math.round((trustSignalCount / trustSignals.length) * 100);

  const nextTrustMission = !contactVerified
    ? {
        label: isId ? 'Verifikasi kontak' : 'Verify contact',
        helper: isId
          ? 'Nomor atau email terverifikasi menambah kepercayaan.'
          : 'A verified phone or email builds trust.',
        section: 'contact' as OwnerProfileEditSection,
      }
    : !coreProfileReady && nextCompletionItem
      ? {
          label: nextCompletionItem.label,
          helper: isId
            ? `Profil ${profilePercent}% lengkap`
            : `Profile ${profilePercent}% complete`,
          section:
            nextCompletionItem.key === 'bio' || nextCompletionItem.key === 'location'
              ? ('identity' as OwnerProfileEditSection)
              : nextCompletionItem.key === 'contact'
                ? ('contact' as OwnerProfileEditSection)
                : ('menu' as OwnerProfileEditSection),
          target:
            nextCompletionItem.key === 'avatar' || nextCompletionItem.key === 'cover'
              ? nextCompletionItem.key
              : undefined,
        }
      : !catalogComplete
        ? {
            label: isId
              ? `Tambah ${catalogRemaining} penawaran lagi`
              : `Add ${catalogRemaining} more offer${catalogRemaining === 1 ? '' : 's'}`,
            helper: isId
              ? 'Buka lencana Katalog 5+.'
              : 'Unlock the Catalog 5+ badge.',
            href: ROUTES.create,
          }
        : !verified
          ? {
              label: isId ? 'Pelajari verifikasi identitas' : 'Review identity verification',
              helper: isId
                ? 'Lihat status verifikasi yang benar-benar aktif.'
                : 'Review the verification signals that are actually active.',
              section: 'trust' as OwnerProfileEditSection,
            }
          : null;

  const attentionAction = unreadChats > 0
    ? {
        label: isId
          ? `${unreadChats > 99 ? '99+' : unreadChats} pesan perlu dibalas`
          : `${unreadChats > 99 ? '99+' : unreadChats} messages need replies`,
        href: ROUTES.chat,
        icon: MessageCircle,
        tone: 'bg-blue-600 text-white',
      }
    : draftListings.length > 0
      ? {
          label: isId
            ? `${draftListings.length} draft belum diterbitkan`
            : `${draftListings.length} drafts are unpublished`,
          href: ROUTES.drafts,
          icon: FileText,
          tone: 'bg-amber-500 text-white',
        }
      : null;

  const AttentionIcon = attentionAction?.icon ?? ArrowRight;

  const providerProfile = asRecord(mergedMetadata.provider_profile) ?? {};
  const freelancerProfile = asRecord(mergedMetadata.freelancer_profile) ?? {};
  const buyerProfile = asRecord(mergedMetadata.buyer_profile) ?? {};
  const profileDetailRows = [
    {
      key: 'business',
      label: isId ? 'Usaha / layanan' : 'Business / services',
      value: firstString(providerProfile.headline),
      section: 'business' as OwnerProfileEditSection,
      icon: Store,
    },
    {
      key: 'professional',
      label: isId ? 'Keahlian' : 'Expertise',
      value: firstString(
        freelancerProfile.professional_title,
        freelancerProfile.tagline,
      ),
      section: 'professional' as OwnerProfileEditSection,
      icon: BriefcaseBusiness,
    },
    {
      key: 'buyer',
      label: isId ? 'Sedang mencari' : 'Looking for',
      value: firstString(buyerProfile.intent),
      section: 'buyer' as OwnerProfileEditSection,
      icon: Search,
    },
  ].filter(item => item.value);

  const quickActions: QuickAction[] = [
    {
      key: 'create',
      label: isId ? 'Buat' : 'Create',
      href: ROUTES.create,
      icon: Plus,
    },
    {
      key: 'manage-listings',
      label: isId ? 'Etalase' : 'Storefront',
      href: ROUTES.manageListings,
      icon: ClipboardList,
      badge: draftListings.length,
    },
    {
      key: 'chat',
      label: isId ? 'Pesan' : 'Messages',
      href: ROUTES.chat,
      icon: MessageCircle,
      badge: unreadChats,
    },
    {
      key: 'insights',
      label: isId ? 'Statistik' : 'Insights',
      href: ROUTES.insights,
      icon: BarChart3,
    },
  ];

  const quickActionTone: Record<string, string> = {
    create: 'bg-emerald-600 text-white',
    'manage-listings': 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    chat: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    insights: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  };

  const tabItems: Array<{ key: OwnerTab; label: string; count: number }> = [
    { key: 'posts', label: isId ? 'Tayang' : 'Published', count: activeListings.length },
    { key: 'drafts', label: copy.drafts, count: draftListings.length },
  ];

  const filterItems: Array<{ key: ListingFilter; label: string }> = [
    { key: 'all', label: copy.all },
    { key: 'product', label: copy.products },
    { key: 'service', label: copy.services },
    { key: 'supplier', label: copy.suppliers },
    { key: 'place', label: copy.places },
  ];

  const sortOptions: Array<{ value: SortMode; label: string }> = [
    { value: 'newest', label: copy.newest },
    { value: 'most_viewed', label: copy.mostViewed },
    { value: 'oldest', label: copy.oldest },
  ];

  return (
    <>
      <main className="min-h-screen max-w-full overflow-x-clip bg-[color:var(--app-surface-muted)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-8">
        <div className="mx-auto w-full max-w-[1120px] space-y-3 px-0 py-0 sm:space-y-4 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
          {/* PROFILE — identity first, like familiar social/business profiles. */}
          <section className="overflow-hidden border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] sm:rounded-[24px] sm:border sm:shadow-[0_18px_48px_-40px_rgba(15,23,42,0.35)]">
            <div className="relative h-28 overflow-hidden sm:h-36 lg:h-40">
              {effectiveCoverUrl ? (
                <NextImage
                  src={effectiveCoverUrl}
                  alt=""
                  fill
                  priority
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 1120px"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_24%,rgba(16,185,129,0.28),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(14,165,233,0.14),transparent_28%),linear-gradient(135deg,#d1fae5_0%,#f8fafc_52%,#ecfdf5_100%)] dark:bg-[radial-gradient(circle_at_16%_24%,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(14,165,233,0.1),transparent_28%),linear-gradient(135deg,#052e25_0%,#0f172a_52%,#022c22_100%)]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/30" />

              <div className="absolute right-2.5 top-2.5 flex items-center gap-2 sm:right-4 sm:top-4">
                <button
                  type="button"
                  onClick={() => void loadProfile('refresh')}
                  disabled={refreshing}
                  className="grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur-md transition hover:bg-black/60 disabled:opacity-60"
                  aria-label={refreshing ? copy.refreshing : copy.refresh}
                  title={refreshing ? copy.refreshing : copy.refresh}
                >
                  <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                </button>

                <label
                  htmlFor="owner-cover-upload"
                  className="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur-md transition hover:bg-black/60"
                  aria-label={copy.coverLabel}
                  title={copy.coverLabel}
                >
                  {coverUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
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
            </div>

            <div className="relative px-3 pb-4 sm:px-5 sm:pb-5">
              <div className="-mt-10 flex min-w-0 items-start gap-3 sm:-mt-12 sm:gap-4">
                <div className="relative h-20 w-20 shrink-0 rounded-full bg-[color:var(--app-surface-muted)] shadow-lg ring-[4px] ring-[color:var(--app-surface-strong)] sm:h-24 sm:w-24">
                  <div className="absolute inset-0 overflow-hidden rounded-full">
                    <NextImage
                      src={effectiveAvatarUrl}
                      alt={displayName || user.email}
                      fill
                      priority
                      unoptimized
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                  <label
                    htmlFor="owner-avatar-upload"
                    aria-label={copy.avatarLabel}
                    className="absolute bottom-0 right-0 grid h-8 w-8 cursor-pointer place-items-center rounded-full border-[3px] border-[color:var(--app-surface-strong)] bg-emerald-600 text-white shadow-md transition hover:bg-emerald-700"
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

                <div className="min-w-0 flex-1 pb-0.5 sm:pb-1.5 pt-10">
                  <div className="flex min-w-0 items-center gap-1.5 -mb-[10px]">
                    <h1 className="min-w-0 truncate text-xl font-black leading-tight tracking-[-0.025em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-2xl">
                      {displayName}
                    </h1>
                    {verified ? (
                      <BadgeCheck
                        className="h-5 w-5 shrink-0 fill-emerald-600 text-white"
                        aria-label={isId ? 'Identitas terverifikasi' : 'Identity verified'}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openEditModal('identity')}
                      className="ml-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]"
                      aria-label={isId ? 'Edit profil utama' : 'Edit main profile'}
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-[color:var(--app-text-soft)] sm:text-xs">
                    @{handle || 'user'}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-[color:var(--app-text-soft)] sm:text-xs">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-[62vw] truncate sm:max-w-sm">
                    {location || copy.locationFallback}
                  </span>
                </span>
                {joinedDate ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {copy.joined} {joinedDate}
                  </span>
                ) : null}
              </div>

              <p className="mt-2.5 line-clamp-2 max-w-2xl text-[12px] font-medium leading-5 text-[color:var(--app-text-soft)] sm:text-sm sm:leading-6">
                {bio}
              </p>

              <div className="mt-3 flex min-w-0 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {trustSignals
                  .filter(item => item.active)
                  .map(item => {
                    const Icon = item.icon;
                    return (
                      <span
                        key={item.key}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </span>
                    );
                  })}
                {trustSignalCount === 0 ? (
                  <button
                    type="button"
                    onClick={() => openEditModal('trust')}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                  >
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {isId ? 'Bangun kepercayaan' : 'Build trust'}
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-4 divide-x divide-[color:var(--app-border)] border-y border-[color:var(--app-border)] py-2.5 sm:max-w-2xl sm:rounded-xl sm:border sm:py-0">
                <LocalizedLink href={ROUTES.manageListings} className="min-w-0 px-1 py-1 text-center transition hover:bg-[color:var(--app-surface-muted)] sm:px-3 sm:py-3">
                  <span className="block truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
                    {formatCompactNumber(activePostCount, numberLocale)}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] font-semibold text-[color:var(--app-text-soft)] sm:text-[11px]">
                    {isId ? 'Penawaran' : 'Offers'}
                  </span>
                </LocalizedLink>
                <button type="button" onClick={() => openSocialModal('followers')} className="min-w-0 px-1 py-1 text-center transition hover:bg-[color:var(--app-surface-muted)] sm:px-3 sm:py-3">
                  <span className="block truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
                    {formatCompactNumber(followersCount, numberLocale)}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] font-semibold text-[color:var(--app-text-soft)] sm:text-[11px]">
                    {copy.followers}
                  </span>
                </button>
                <LocalizedLink href={`/reels?creator=${encodeURIComponent(user.id)}`} className="min-w-0 px-1 py-1 text-center transition hover:bg-[color:var(--app-surface-muted)] sm:px-3 sm:py-3">
                  <span className="block truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
                    {formatCompactNumber(reelsCount, numberLocale)}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] font-semibold text-[color:var(--app-text-soft)] sm:text-[11px]">
                    {copy.reels}
                  </span>
                </LocalizedLink>
                <LocalizedLink href={ROUTES.insights} className="min-w-0 px-1 py-1 text-center transition hover:bg-[color:var(--app-surface-muted)] sm:px-3 sm:py-3">
                  <span className="flex items-center justify-center gap-1 truncate text-sm font-black text-amber-600 dark:text-amber-300 sm:text-base">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {dashboardStats.user_rating > 0 ? dashboardStats.user_rating.toFixed(1) : '—'}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] font-semibold text-[color:var(--app-text-soft)] sm:text-[11px]">
                    Rating
                  </span>
                </LocalizedLink>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => openEditModal('menu')}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-xs font-black text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] dark:text-[color:var(--app-text-inverse)]"
                >
                  <PencilLine className="h-4 w-4" />
                  {copy.editProfile}
                </button>
                <LocalizedLink
                  href={publicProfileHref}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-xs font-black text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] dark:text-[color:var(--app-text-inverse)]"
                >
                  <Eye className="h-4 w-4" />
                  {copy.publicProfile}
                </LocalizedLink>
              </div>
            </div>
          </section>

          {saveMessage ? (
            <div className="mx-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-500/10 dark:text-emerald-200 sm:mx-0">
              {saveMessage}
            </div>
          ) : null}

          {profileError ? (
            <div className="mx-3 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-200 sm:mx-0 sm:flex-row sm:items-center sm:justify-between">
              <span>{profileError}</span>
              <button
                type="button"
                onClick={() => void loadProfile('refresh')}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-rose-300 px-4 font-bold dark:border-rose-800"
              >
                {copy.retry}
              </button>
            </div>
          ) : null}

          {/* ONE NEXT ACTION — no dashboard wall. */}
          {attentionAction ? (
            <LocalizedLink
              href={attentionAction.href}
              className="mx-3 flex min-h-14 items-center gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2.5 transition hover:border-emerald-200 hover:bg-[color:var(--app-surface-muted)] sm:mx-0 sm:px-4"
            >
              <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', attentionAction.tone)}>
                <AttentionIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {attentionAction.label}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
            </LocalizedLink>
          ) : null}

          {/* TRUST — proof, not decorative badges. */}
          <section className="border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-4 sm:rounded-[24px] sm:border sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {isId ? 'Kepercayaan' : 'Trust'}
                </h2>
                <p className="mt-0.5 text-[10px] font-semibold text-[color:var(--app-text-soft)] sm:text-xs">
                  {trustSignalCount}/{trustSignals.length} {isId ? 'tanda aktif' : 'signals active'}
                </p>
              </div>
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                {trustPercent}%
              </span>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${trustPercent}%` }} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {trustSignals.map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.key}
                    className={cn(
                      'flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-[10px] font-black sm:text-[11px]',
                      item.active
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                    )}
                  >
                    <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full', item.active ? 'bg-emerald-600 text-white' : 'bg-black/5 dark:bg-white/10')}>
                      {item.active ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Icon className="h-3.5 w-3.5" />}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              })}
            </div>

            {nextTrustMission ? (
              nextTrustMission.href ? (
                <LocalizedLink
                  href={nextTrustMission.href}
                  className="mt-3 flex min-h-12 items-center gap-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/55 px-3 transition hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/10"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><ArrowRight className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">{nextTrustMission.label}</span><span className="mt-0.5 block truncate text-[10px] text-[color:var(--app-text-soft)]">{nextTrustMission.helper}</span></span>
                </LocalizedLink>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (nextTrustMission.target === 'avatar') {
                      document.getElementById('owner-avatar-upload')?.click();
                      return;
                    }
                    if (nextTrustMission.target === 'cover') {
                      document.getElementById('owner-cover-upload')?.click();
                      return;
                    }
                    openEditModal(nextTrustMission.section || 'menu');
                  }}
                  className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/55 px-3 text-left transition hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/10"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><ArrowRight className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">{nextTrustMission.label}</span><span className="mt-0.5 block truncate text-[10px] text-[color:var(--app-text-soft)]">{nextTrustMission.helper}</span></span>
                </button>
              )
            ) : (
              <div className="mt-3 flex min-h-11 items-center gap-2 rounded-xl bg-emerald-50 px-3 text-xs font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <BadgeCheck className="h-4 w-4" />
                {isId ? 'Profil siap dipercaya dan ditemukan.' : 'Your profile is ready to be discovered.'}
              </div>
            )}
          </section>

          {profileDetailRows.length > 0 ? (
            <section className="border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] sm:rounded-[24px] sm:border">
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] px-3 py-3 sm:px-5">
                <div>
                  <h2 className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">{isId ? 'Tentang' : 'About'}</h2>
                  <p className="mt-0.5 text-[10px] text-[color:var(--app-text-soft)]">{isId ? 'Ringkasan yang membantu orang memahami profilmu.' : 'A quick summary that helps people understand your profile.'}</p>
                </div>
                <button type="button" onClick={() => openEditModal('menu')} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"><PencilLine className="h-3.5 w-3.5" />{isId ? 'Edit' : 'Edit'}</button>
              </div>
              <div className="divide-y divide-[color:var(--app-border)]">
                {profileDetailRows.map(item => {
                  const Icon = item.icon;
                  return (
                    <button key={item.key} type="button" onClick={() => openEditModal(item.section)} className="flex min-h-14 w-full min-w-0 items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[color:var(--app-surface-muted)] sm:px-5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]"><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold text-[color:var(--app-text-soft)]">{item.label}</span><span className="mt-0.5 block truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">{item.value}</span></span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* OWNER TOOLS — four actions only. */}
          <section className="border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-3 sm:rounded-[24px] sm:border sm:px-5 sm:py-4">
            <div className="grid grid-cols-4 gap-2">
              {quickActions.map(action => {
                const Icon = action.icon;
                return (
                  <LocalizedLink
                    key={action.key}
                    href={action.href}
                    className="group relative flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-center transition hover:bg-[color:var(--app-surface-muted)]"
                  >
                    <span className={cn('relative grid h-10 w-10 place-items-center rounded-xl', quickActionTone[action.key])}>
                      <Icon className="h-[18px] w-[18px]" />
                      {typeof action.badge === 'number' && action.badge > 0 ? (
                        <span className="absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white ring-2 ring-[color:var(--app-surface-strong)]">
                          {action.badge > 99 ? '99+' : action.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="max-w-full truncate text-[10px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-xs">
                      {action.label}
                    </span>
                  </LocalizedLink>
                );
              })}
            </div>
          </section>

          {/* STOREFRONT — visual first, like familiar profile/shop grids. */}
          <section className="overflow-hidden border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] sm:rounded-[24px] sm:border">
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] px-3 py-3.5 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-base font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-lg">
                  {isId ? 'Etalase' : 'Storefront'}
                </h2>
                <p className="mt-0.5 text-[10px] font-semibold text-[color:var(--app-text-soft)] sm:text-xs">
                  {activeListings.length} {isId ? 'penawaran tayang' : 'published offers'}
                </p>
              </div>
              <LocalizedLink
                href={ROUTES.create}
                className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-[11px] font-black text-white transition hover:bg-emerald-700 sm:text-xs"
              >
                <Plus className="h-4 w-4" />
                {isId ? 'Tambah' : 'Add'}
              </LocalizedLink>
            </div>

            <ProfileTabRail
              activeTab={activeTab}
              items={tabItems}
              onChange={tab => {
                setActiveTab(tab);
                setActiveFilter('all');
              }}
            />

            <div className="flex min-w-0 items-center gap-2 border-b border-[color:var(--app-border)]/70 px-3 py-2.5 sm:px-5">
              <FilterRail activeFilter={activeFilter} items={filterItems} onChange={setActiveFilter} />
              <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2.5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                <Settings2 className="h-3.5 w-3.5 shrink-0 text-[color:var(--app-text-soft)]" />
                <span className="sr-only">{isId ? 'Urutkan berdasarkan' : 'Sort by'}</span>
                <select
                  value={sortMode}
                  onChange={event => setSortMode(event.target.value as SortMode)}
                  className="max-w-28 bg-transparent text-[10px] font-bold outline-none sm:max-w-none sm:text-xs"
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {visibleListings.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 p-2.5 sm:grid-cols-3 sm:gap-3 sm:p-4 lg:grid-cols-4">
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
                title={activeTab === 'drafts' ? copy.noDraftTitle : copy.noPostsTitle}
                description={activeTab === 'drafts' ? copy.noDraftDescription : copy.noPostsDescription}
                href={activeTab === 'drafts' ? ROUTES.drafts : ROUTES.create}
                actionLabel={activeTab === 'drafts' ? copy.manageDrafts : copy.makePost}
              />
            )}

            {visibleListings.length > 0 ? (
              <div className="border-t border-[color:var(--app-border)] px-3 py-3 sm:px-5">
                <LocalizedLink
                  href={activeTab === 'drafts' ? ROUTES.drafts : ROUTES.manageListings}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-black text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                >
                  {copy.viewAll}
                  <ArrowRight className="h-4 w-4" />
                </LocalizedLink>
              </div>
            ) : null}
          </section>

          <div className="flex items-center justify-center gap-4 px-3 pb-1 text-[10px] font-bold text-[color:var(--app-text-soft)] sm:text-xs">
            <LocalizedLink href={ROUTES.manageReels} className="inline-flex items-center gap-1.5 hover:text-emerald-700 dark:hover:text-emerald-300">
              <Play className="h-3.5 w-3.5" />
              {isId ? 'Kelola Reels' : 'Manage Reels'}
            </LocalizedLink>
            <span aria-hidden="true">·</span>
            <LocalizedLink href={ROUTES.manageCommunity} className="inline-flex items-center gap-1.5 hover:text-emerald-700 dark:hover:text-emerald-300">
              <Users className="h-3.5 w-3.5" />
              {isId ? 'Komunitas' : 'Community'}
            </LocalizedLink>
          </div>
        </div>
      </main>

      <ProfileSocialModal
        open={Boolean(socialModalTab)}
        tab={socialModalTab || 'followers'}
        copy={copy}
        locale={numberLocale}
        followers={profileSocial?.followers || []}
        following={profileSocial?.following || []}
        followersCount={followersCount}
        followingCount={followingCount}
        onTabChange={changeSocialTab}
        onClose={closeProfileModal}
      />

      <OwnerProfileEditModal
        open={Boolean(editSection)}
        detail={detail}
        metadata={mergedMetadata}
        isId={isId}
        initialSection={editSection || 'menu'}
        onSectionChange={changeEditSection}
        onClose={closeProfileModal}
        onSaved={async () => {
          await loadProfile('refresh');
        }}
      />

      <ImageCropModal
        open={Boolean(modalKind === 'crop' && cropTarget && cropSource)}
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
