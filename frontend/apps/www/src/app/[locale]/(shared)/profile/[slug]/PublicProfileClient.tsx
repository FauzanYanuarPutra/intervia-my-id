'use client';

import {
  type ComponentType,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  BadgeCheck,
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Edit3,
  Eye,
  ExternalLink,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  PhoneCall,
  RefreshCcw,
  Share2,
  ShieldCheck,
  Star,
  Store,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react';

import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { DetailMobileTopBar } from '@/components/layout/DetailMobileTopBar';
import { ProfileRail, ProfileRailItem } from '@/components/profile/ProfileRail';
import { ProfileViewSkeleton } from '@/components/system/feedback/RouteSkeletons';
import { useAuth } from '@/context/AuthContext';
import { Link, useRouter } from '@/i18n/navigation';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import {
  extractContentItems,
  formatIDRFromCents,
  normalizeContentMediaUrl,
} from '@/lib/content/catalog';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import { normalizeProfileMediaUrl } from '@/lib/profile/profileMedia';
import {
  getProfileContentTabLabel,
  normalizeProfileContentTab,
  type ProfileContentTab,
  type ProfileLeafTab,
} from '@/lib/profile/profileContentTabs';
import {
  buildPublicProfileSlug,
  decodePublicProfileSlug,
  extractPublicProfileIdFromSlug,
  matchesPublicProfileSlug,
} from '@/lib/profile/publicProfileLink';

type PublicProfileClientProps = {
  locale: string;
  slug: string;
  initialProfile?: unknown;
  initialSocial?: unknown;
};

type ProfileRecord = Record<string, unknown>;

type PublicUserProfile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  cover_image?: string | null;
  bio?: string | null;
  location?: string | null;
  headline?: string | null;
  created_at?: string | null;
  joined_at?: string | null;

  roles?: string[] | null;
  metadata_roles?: unknown;
  metadata?: unknown;

  freelancer_profile?: unknown;
  provider_profile?: unknown;
  buyer_profile?: unknown;

  rating?: number | null;
  review_count?: number | null;
  completed_jobs?: number | null;

  email_verified?: boolean | null;
  phone_verified?: boolean | null;
  identity_verified?: boolean | null;
  transaction_eligible?: boolean | null;
};

type PublicListing = {
  id: string;
  slug?: string;
  title?: string;
  summary?: string;
  content_type?: string;
  category?: string;
  metadata?: Record<string, unknown> | null;
  cover_image?: string | null;
  price_cents?: number | null;
  created_at?: string;
  updated_at?: string;

  view_count?: number;
  favorite_count?: number;
  chat_count?: number;
};

type ProfileDetail = {
  displayName: string;
  handle: string;
  headline: string;
  summary: string;
  roles: string[];
  skills: string[];
  languages: string[];
  experience: string[];
  education: string[];
  certifications: string[];
  links: Array<{ label: string; url: string }>;
};

type PublicProfileTab = 'posts' | 'about' | 'reviews' | 'business';

type PublicReview = {
  id: string;
  name: string;
  avatarUrl: string;
  rating: number;
  comment: string;
  date: string;
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
  viewerFollowing: boolean;
  followers: ProfileSocialUser[];
  following: ProfileSocialUser[];
};

type ProfileSocialTab = 'followers' | 'following';

const PUBLIC_PROFILE_SAVE_KEY = 'lajukan.public-profile.saved.v2';

const PROFILE_LEAF_TABS: ProfileLeafTab[] = [
  'job',
  'freelancer',
  'product',
  'service',
  'tool_rental',
  'business_transfer',
  'property',
  'umkm',
];

function asRecord(value: unknown): ProfileRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as ProfileRecord;
}

function readString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
}

function readBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'y', 'on', 'verified', 'approved'].includes(
      value.trim().toLowerCase(),
    );
  }

  return false;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const result = readString(value);
    if (result) return result;
  }

  return '';
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => readString(item)).filter(Boolean);
  }

  const text = readString(value);
  if (!text) return [];

  return text
    .split(/[\n,;|]/g)
    .map(item => item.trim())
    .filter(Boolean);
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(value);
  }

  return result;
}

function normalizeExternalUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z]+:\/\//i.test(value)) return '';

  return `https://${value}`;
}

function formatRole(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, token => token.toUpperCase());
}

function readNestedString(
  roots: Array<ProfileRecord | null>,
  keys: string[],
): string {
  for (const root of roots) {
    if (!root) continue;

    for (const key of keys) {
      const value = readString(root[key]);
      if (value) return value;
    }
  }

  return '';
}

function readNestedNumber(
  roots: Array<ProfileRecord | null>,
  keys: string[],
): number | undefined {
  for (const root of roots) {
    if (!root) continue;

    for (const key of keys) {
      const value = readNumber(root[key]);
      if (value !== undefined) return value;
    }
  }

  return undefined;
}

function normalizePublicUserProfile(
  payload: unknown,
): PublicUserProfile | null {
  const root = asRecord(payload);
  const body =
    asRecord(root?.data) ||
    asRecord(root?.user) ||
    asRecord(root?.profile) ||
    root;

  const id = readString(body?.id);
  if (!id) return null;
  const metadata = asRecord(body?.metadata);
  const metadataProfile = asRecord(metadata?.profile);
  const metadataMedia = asRecord(metadata?.media);
  const bodyMedia = asRecord(body?.media);

  return {
    id,
    username: readString(body?.username) || null,
    full_name: firstString(body?.full_name, body?.fullName, body?.name) || null,
    avatar_url:
      firstString(
        body?.avatar_url,
        body?.avatarUrl,
        body?.avatar,
        body?.photo_url,
        body?.picture,
        metadata?.avatar_url,
        metadata?.avatarUrl,
        metadataProfile?.avatar_url,
        metadataProfile?.avatarUrl,
        metadataMedia?.avatar_url,
        metadataMedia?.avatarUrl,
        metadataMedia?.photo_url,
        bodyMedia?.avatar_url,
        bodyMedia?.avatarUrl,
        bodyMedia?.photo_url,
      ) || null,
    cover_image:
      firstString(
        body?.cover_image,
        body?.cover_image_url,
        body?.coverUrl,
        body?.cover_url,
        metadata?.cover_image,
        metadata?.cover_image_url,
        metadataProfile?.cover_image,
        metadataProfile?.cover_image_url,
        metadataMedia?.cover_image,
        metadataMedia?.cover_url,
        bodyMedia?.cover_image,
        bodyMedia?.cover_url,
      ) || null,
    bio: readString(body?.bio) || null,
    location: firstString(body?.location, body?.city, body?.region) || null,
    headline:
      firstString(body?.headline, body?.professional_title, body?.tagline) ||
      null,
    created_at: firstString(body?.created_at, body?.createdAt) || null,
    joined_at: firstString(body?.joined_at, body?.joinedAt) || null,

    roles: Array.isArray(body?.roles)
      ? body.roles.map(item => readString(item)).filter(Boolean)
      : [],
    metadata_roles: body?.metadata_roles,
    metadata: body?.metadata,

    freelancer_profile: body?.freelancer_profile,
    provider_profile: body?.provider_profile,
    buyer_profile: body?.buyer_profile,

    rating: readNumber(body?.rating) ?? null,
    review_count: readNumber(body?.review_count ?? body?.reviews_count) ?? null,
    completed_jobs: readNumber(body?.completed_jobs) ?? null,

    email_verified: readBoolean(body?.email_verified),
    phone_verified: readBoolean(body?.phone_verified),
    identity_verified: readBoolean(body?.identity_verified),
    transaction_eligible: readBoolean(body?.transaction_eligible),
  };
}

function collectLinks(
  roots: Array<ProfileRecord | null>,
): Array<{ label: string; url: string }> {
  const links: Array<{ label: string; url: string }> = [];

  const add = (label: string, value: unknown) => {
    const url = normalizeExternalUrl(readString(value));
    if (!url) return;

    if (links.some(item => item.url.toLowerCase() === url.toLowerCase())) {
      return;
    }

    links.push({ label, url });
  };

  for (const root of roots) {
    if (!root) continue;

    add('Portfolio', root.portfolio_url);
    add('Portfolio', root.portfolio);
    add('Website', root.website);
    add('LinkedIn', root.linkedin);
    add('LinkedIn', root.linkedin_url);
    add('GitHub', root.github);
    add('GitHub', root.github_url);
    add('Instagram', root.instagram);
    add('Instagram', root.instagram_url);
    add('TikTok', root.tiktok);
    add('TikTok', root.tiktok_url);

    if (Array.isArray(root.links)) {
      for (const item of root.links) {
        const row = asRecord(item);
        if (!row) continue;

        add(
          firstString(row.label, row.name) || 'Link',
          firstString(row.url, row.href, row.link),
        );
      }
    }
  }

  return links;
}

function buildProfileDetail(
  profile: PublicUserProfile,
  localeCode: 'id' | 'en',
): ProfileDetail {
  const metadata = asRecord(profile.metadata);
  const metadataProfile = asRecord(metadata?.profile);
  const freelancer = asRecord(profile.freelancer_profile);
  const provider = asRecord(profile.provider_profile);
  const buyer = asRecord(profile.buyer_profile);

  const displayName =
    firstString(profile.full_name, profile.username) ||
    (localeCode === 'id' ? 'Member Lajukan' : 'Lajukan member');

  const handle = readString(profile.username) || profile.id.slice(0, 8);

  const headline =
    firstString(
      freelancer?.professional_title,
      freelancer?.tagline,
      provider?.headline,
      provider?.tagline,
      profile.headline,
      metadataProfile?.headline,
      metadata?.headline,
    ) ||
    (localeCode === 'id'
      ? 'Profil publik di Lajukan'
      : 'Public profile on Lajukan');

  const summary =
    firstString(
      freelancer?.bio,
      freelancer?.summary,
      provider?.summary,
      provider?.bio,
      profile.bio,
      metadataProfile?.bio,
      metadata?.about,
      buyer?.intent,
    ) ||
    (localeCode === 'id'
      ? 'Pengguna ini belum menambahkan deskripsi publik.'
      : 'This user has not added a public description yet.');

  const roles = dedupeStrings([
    ...(Array.isArray(profile.roles) ? profile.roles : []),
    ...toStringList(profile.metadata_roles),
    ...toStringList(metadata?.roles),
    ...toStringList(metadataProfile?.roles),
  ]);

  const skills = dedupeStrings([
    ...toStringList(freelancer?.skills),
    ...toStringList(freelancer?.skill_set),
    ...toStringList(provider?.skills),
    ...toStringList(provider?.expertise),
    ...toStringList(metadata?.skills),
  ]);

  const languages = dedupeStrings([
    ...toStringList(freelancer?.languages),
    ...toStringList(provider?.languages),
    ...toStringList(metadata?.languages),
  ]);

  const experience = dedupeStrings([
    ...toStringList(freelancer?.experience),
    ...toStringList(freelancer?.work_history),
    ...toStringList(freelancer?.work_experience),
    ...toStringList(provider?.experience),
    ...toStringList(metadata?.experience),
  ]);

  const education = dedupeStrings([
    ...toStringList(freelancer?.education),
    ...toStringList(provider?.education),
    ...toStringList(metadata?.education),
  ]);

  const certifications = dedupeStrings([
    ...toStringList(freelancer?.certifications),
    ...toStringList(freelancer?.certificates),
    ...toStringList(provider?.certifications),
    ...toStringList(metadata?.certifications),
  ]);

  const links = collectLinks([freelancer, provider, metadataProfile, metadata]);

  return {
    displayName,
    handle,
    headline,
    summary,
    roles,
    skills,
    languages,
    experience,
    education,
    certifications,
    links,
  };
}

function getPublicProfileCoverUrl(profile: PublicUserProfile): string {
  const metadata = asRecord(profile.metadata);
  const media = asRecord(metadata?.media);
  const metadataProfile = asRecord(metadata?.profile);

  return (
    normalizeProfileMediaUrl(
      readNestedString(
        [profile as unknown as ProfileRecord, metadata, media, metadataProfile],
        [
          'cover_image',
          'cover_image_url',
          'coverUrl',
          'cover_url',
          'banner_image',
          'banner_url',
        ],
      ),
    ) || ''
  );
}

function getPublicProfileAvatarUrl(profile: PublicUserProfile): string {
  const metadata = asRecord(profile.metadata);
  const media = asRecord(metadata?.media);
  const metadataProfile = asRecord(metadata?.profile);

  return (
    normalizeProfileMediaUrl(
      readNestedString(
        [profile as unknown as ProfileRecord, metadata, media, metadataProfile],
        [
          'avatar_url',
          'avatarUrl',
          'avatar',
          'photo_url',
          'photoUrl',
          'picture',
          'picture_url',
          'profile_image',
          'profile_image_url',
          'image',
          'image_url',
        ],
      ),
    ) || ''
  );
}

function getPublicProfilePhone(profile: PublicUserProfile): string {
  const metadata = asRecord(profile.metadata);
  const contact = asRecord(metadata?.contact);
  const publicContact = asRecord(metadata?.public_contact);
  const provider = asRecord(profile.provider_profile);
  const providerContact = asRecord(provider?.contact);

  return readNestedString(
    [publicContact, contact, providerContact, provider, metadata],
    ['whatsapp', 'whatsapp_number', 'phone', 'phone_number', 'contact_phone'],
  );
}

function normalizeIndonesianPhoneForWhatsApp(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;

  return digits;
}

function buildWhatsAppHref(phone: string, message: string): string {
  const normalizedPhone = normalizeIndonesianPhoneForWhatsApp(phone);
  if (!normalizedPhone) return '';

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

function formatJoinedDate(
  value: string | null | undefined,
  localeCode: 'id' | 'en',
): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(localeCode === 'id' ? 'id-ID' : 'en-US', {
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatReviewDate(value: string, localeCode: 'id' | 'en'): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(localeCode === 'id' ? 'id-ID' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function buildPublicListingHref(item: PublicListing): string {
  return item.slug
    ? `/content/${encodeURIComponent(item.slug)}-${encodeURIComponent(item.id)}`
    : `/content/${encodeURIComponent(item.id)}`;
}

function formatPublicListingValue(
  item: PublicListing,
  localeCode: 'id' | 'en',
): string {
  if (PROMO_ONLY_MODE) {
    return localeCode === 'id' ? 'Tanya detail' : 'Ask details';
  }

  if (typeof item.price_cents === 'number' && item.price_cents > 0) {
    return formatIDRFromCents(item.price_cents);
  }

  return localeCode === 'id' ? 'Negosiasi' : 'Negotiable';
}

function getListingLocation(item: PublicListing): string {
  const metadata = item.metadata || {};

  return firstString(
    metadata.location,
    metadata.city,
    metadata.region,
    metadata.address,
  );
}

function getListingMetric(item: PublicListing, keys: string[]): number {
  const metadata = item.metadata || {};
  const stats =
    asRecord(metadata.stats) ||
    asRecord(metadata.metrics) ||
    asRecord(metadata.analytics);

  const direct = item as unknown as ProfileRecord;
  const value = readNestedNumber([direct, metadata, stats], keys);

  return Math.max(0, value ?? 0);
}

function getProfileMetric(
  profile: PublicUserProfile,
  keys: string[],
): number | undefined {
  const metadata = asRecord(profile.metadata);
  const stats =
    asRecord(metadata?.stats) ||
    asRecord(metadata?.profile_stats) ||
    asRecord(metadata?.metrics) ||
    asRecord(metadata?.analytics);

  return readNestedNumber(
    [profile as unknown as ProfileRecord, metadata, stats],
    keys,
  );
}

function formatCompactNumber(value: number, localeCode: 'id' | 'en'): string {
  return new Intl.NumberFormat(localeCode === 'id' ? 'id-ID' : 'en-US', {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(Math.max(0, value));
}

function getTabTone(tab: ProfileContentTab): string {
  switch (tab) {
    case 'service':
    case 'freelancer':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
    case 'tool_rental':
      return 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300';
    case 'property':
    case 'business_transfer':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
    case 'job':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
    default:
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
  }
}

function buildPublicListingChatQuestion(
  item: PublicListing,
  displayName: string,
  localeCode: 'id' | 'en',
): string {
  const title =
    readString(item.title) ||
    (localeCode === 'id' ? 'postingan ini' : 'this listing');

  const kind = normalizeProfileContentTab({
    type: item.content_type,
    category: item.category,
    metadata: item.metadata || null,
  });

  const greeting =
    localeCode === 'id' ? `Halo ${displayName},` : `Hi ${displayName},`;

  if (kind === 'product') {
    return localeCode === 'id'
      ? `${greeting} ${title} masih tersedia? Boleh info stok, jumlah minimum, dan cara kirimnya?`
      : `${greeting} is ${title} still available? Could you share stock, minimum quantity, and delivery details?`;
  }

  if (kind === 'service' || kind === 'freelancer') {
    return localeCode === 'id'
      ? `${greeting} saya tertarik dengan ${title}. Boleh tanya paket, harga, jadwal, dan hasil yang didapat?`
      : `${greeting} I am interested in ${title}. Could you share packages, pricing, schedule, and deliverables?`;
  }

  if (kind === 'tool_rental') {
    return localeCode === 'id'
      ? `${greeting} saya tertarik menyewa ${title}. Boleh info jadwal, deposit, dan cara pengambilannya?`
      : `${greeting} I am interested in renting ${title}. Could you share availability, deposit, and pickup details?`;
  }

  if (kind === 'property') {
    return localeCode === 'id'
      ? `${greeting} saya tertarik dengan ${title}. Boleh tanya harga, fasilitas, dan jadwal surveinya?`
      : `${greeting} I am interested in ${title}. Could you share the price, facilities, and viewing schedule?`;
  }

  return localeCode === 'id'
    ? `${greeting} saya tertarik dengan ${title}. Boleh tanya detailnya?`
    : `${greeting} I am interested in ${title}. Could I ask for more details?`;
}

function buildPublicListingChatPayload(
  item: PublicListing,
  profile: PublicUserProfile,
  localeCode: 'id' | 'en',
): Record<string, unknown> {
  const metadata = item.metadata || {};
  const href = buildPublicListingHref(item);
  const kind = normalizeProfileContentTab({
    type: item.content_type,
    category: item.category,
    metadata,
  });

  return {
    source: 'public_profile_listing_chat',
    snapshot_at: new Date().toISOString(),
    content_id: item.id,
    content_title:
      readString(item.title) ||
      (localeCode === 'id' ? 'Postingan tanpa judul' : 'Untitled listing'),
    summary: readString(item.summary),
    cover_image: item.cover_image || '',
    pricing_mode:
      !PROMO_ONLY_MODE &&
      typeof item.price_cents === 'number' &&
      item.price_cents > 0
        ? 'fixed'
        : 'request',
    price_cents:
      !PROMO_ONLY_MODE && typeof item.price_cents === 'number'
        ? item.price_cents
        : 0,
    currency: 'IDR',
    content_type: item.content_type || item.category || kind,
    market_side:
      firstString(
        metadata.market_side,
        metadata.listing_side,
        metadata.listingSide,
      ) || 'supply',
    deal_kind: item.content_type || item.category || kind,
    slug: item.slug || null,
    content_url: href,
    owner_id: profile.id,
    owner_name: profile.full_name || profile.username || profile.id,
    location: getListingLocation(item),
  };
}

function normalizeReviews(
  profile: PublicUserProfile,
  localeCode: 'id' | 'en',
): PublicReview[] {
  const metadata = asRecord(profile.metadata);
  const source =
    (Array.isArray(metadata?.reviews) && metadata.reviews) ||
    (Array.isArray(metadata?.ratings) && metadata.ratings) ||
    [];

  return source
    .map((item, index) => {
      const row = asRecord(item);
      if (!row) return null;

      const rating = Math.min(
        5,
        Math.max(0, readNumber(row.rating ?? row.score) ?? 0),
      );

      const name =
        firstString(
          row.reviewer_name,
          row.author_name,
          row.name,
          asRecord(row.author)?.name,
        ) || (localeCode === 'id' ? 'Pengguna Lajukan' : 'Lajukan user');

      const avatarUrl = normalizeContentMediaUrl(
        firstString(
          row.reviewer_avatar,
          row.author_avatar,
          row.avatar_url,
          asRecord(row.author)?.avatar_url,
        ),
      );

      return {
        id: firstString(row.id, row.review_id) || `review-${index}`,
        name,
        avatarUrl,
        rating,
        comment: firstString(row.comment, row.review, row.body, row.text),
        date: firstString(row.created_at, row.date, row.updated_at),
      } satisfies PublicReview;
    })
    .filter((item): item is PublicReview => Boolean(item));
}

async function fetchProfileById(
  id: string,
  signal: AbortSignal,
): Promise<PublicUserProfile | null> {
  const response = await fetch(`/api/users/public/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  return normalizePublicUserProfile(payload);
}

async function fetchDiscoverProfiles(
  signal: AbortSignal,
  query?: string,
  limit = 24,
): Promise<PublicUserProfile[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const normalizedQuery = query?.trim();

  if (normalizedQuery) {
    params.set('q', normalizedQuery);
  }

  const response = await fetch(`/api/users/discover?${params.toString()}`, {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) return [];

  const payload = (await response.json().catch(() => ({}))) as {
    data?: unknown[];
    results?: unknown[];
    items?: unknown[];
  };

  const items =
    (Array.isArray(payload.data) && payload.data) ||
    (Array.isArray(payload.results) && payload.results) ||
    (Array.isArray(payload.items) && payload.items) ||
    [];

  return items
    .map(item => normalizePublicUserProfile(item))
    .filter((item): item is PublicUserProfile => Boolean(item));
}

function normalizeProfileSocialUser(value: unknown): ProfileSocialUser | null {
  const record = asRecord(value);
  if (!record) return null;

  const id = firstString(record.id, record.user_id, record.userId);
  if (!id) return null;

  return {
    id,
    username: firstString(record.username, record.handle) || null,
    name: firstString(record.name, record.full_name, record.fullName) || null,
    avatarUrl:
      firstString(
        record.avatarUrl,
        record.avatar_url,
        record.avatar,
        asRecord(record.profile)?.avatar_url,
        asRecord(record.profile)?.avatarUrl,
      ) || null,
    title: firstString(record.title, record.headline, record.bio) || null,
  };
}

function normalizeProfileSocialSummary(
  value: unknown,
): ProfileSocialSummary | null {
  const record = asRecord(value);
  if (!record) return null;

  const followers = Array.isArray(record.followers)
    ? record.followers
        .map(item => normalizeProfileSocialUser(item))
        .filter((item): item is ProfileSocialUser => Boolean(item))
    : [];

  const following = Array.isArray(record.following)
    ? record.following
        .map(item => normalizeProfileSocialUser(item))
        .filter((item): item is ProfileSocialUser => Boolean(item))
    : [];

  return {
    userId: firstString(record.userId, record.user_id) || undefined,
    forumUserId:
      firstString(record.forumUserId, record.forum_user_id) || undefined,
    followersCount: Math.max(
      readNumber(record.followersCount) ??
        readNumber(record.followers_count) ??
        0,
      followers.length,
    ),
    followingCount: Math.max(
      readNumber(record.followingCount) ??
        readNumber(record.following_count) ??
        0,
      following.length,
    ),
    reelsCount:
      readNumber(record.reelsCount) ?? readNumber(record.reels_count) ?? 0,
    viewerFollowing: readBoolean(
      record.viewerFollowing ?? record.viewer_following,
    ),
    followers,
    following,
  };
}

async function fetchProfileSocialSummary(
  id: string,
  signal: AbortSignal,
): Promise<ProfileSocialSummary | null> {
  const response = await fetch(
    `/api/community/users/${encodeURIComponent(id)}/social?limit=48`,
    {
      cache: 'no-store',
      signal,
    },
  );

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  return normalizeProfileSocialSummary(payload);
}

function ProfileSocialModal({
  open,
  tab,
  localeCode,
  followers,
  following,
  followersCount,
  followingCount,
  onTabChange,
  onClose,
}: {
  open: boolean;
  tab: ProfileSocialTab;
  localeCode: 'id' | 'en';
  followers: ProfileSocialUser[];
  following: ProfileSocialUser[];
  followersCount: number;
  followingCount: number;
  onTabChange: (tab: ProfileSocialTab) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const isId = localeCode === 'id';
  const activeUsers = tab === 'followers' ? followers : following;
  const emptyText =
    tab === 'followers'
      ? isId
        ? 'Belum ada pengikut yang terekam.'
        : 'No recorded followers yet.'
      : isId
        ? 'Belum mengikuti akun lain.'
        : 'Not following anyone yet.';

  const tabs: Array<{ key: ProfileSocialTab; label: string; count: number }> = [
    {
      key: 'followers',
      label: isId ? 'Pengikut' : 'Followers',
      count: followersCount,
    },
    {
      key: 'following',
      label: isId ? 'Mengikuti' : 'Following',
      count: followingCount,
    },
  ];

  return (
    <div className="fixed inset-0 z-[1500] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[86vh] w-full max-w-lg overflow-hidden rounded-t-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-[color:var(--app-border)] px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
              Social
            </p>
            <h2 className="text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {isId ? 'Pengikut & Mengikuti' : 'Followers & Following'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)]"
            aria-label={isId ? 'Tutup' : 'Close'}
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
                className={`rounded-2xl px-4 py-3 text-left transition ${
                  active
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
                    : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] hover:text-[color:var(--app-text)]'
                }`}
              >
                <p className="text-lg font-black">
                  {formatCompactNumber(item.count, localeCode)}
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
                const href = `/profile/${buildPublicProfileSlug({
                  id: item.id.replace(/^auth-/, ''),
                  username: item.username || undefined,
                  full_name: name,
                })}`;

                return (
                  <Link
                    key={item.id}
                    href={href}
                    onClick={onClose}
                    className="flex min-w-0 items-center gap-3 rounded-2xl border border-transparent p-2 transition hover:border-[color:var(--app-border)] hover:bg-[color:var(--app-surface-muted)]"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
                      <Image
                        src={avatar}
                        alt={name}
                        fill
                        unoptimized
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        {name}
                      </p>
                      <p className="truncate text-xs text-[color:var(--app-text-soft)]">
                        @{item.username || item.id.replace(/^auth-/, '')}
                      </p>
                      {item.title ? (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-[color:var(--app-text-soft)]">
                          {item.title}
                        </p>
                      ) : null}
                    </div>
                  </Link>
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

function EmptyState({
  icon: Icon = Package,
  title,
  description,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <Icon className="h-6 w-6" />
      </div>

      <h3 className="mt-4 text-base font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        {title}
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-[color:var(--app-text-soft)]">
        {description}
      </p>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h2 className="text-base font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export default function PublicProfileClient({
  locale,
  slug,
  initialProfile,
  initialSocial,
}: PublicProfileClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, authFetch } = useAuth();

  const localeCode: 'id' | 'en' = locale === 'id' ? 'id' : 'en';

  const copy = useMemo(
    () =>
      localeCode === 'id'
        ? {
            publicProfile: 'Profil publik',
            back: 'Kembali',
            notFound: 'Profil tidak ditemukan',
            notFoundDescription:
              'Profil ini belum tersedia atau alamat profilnya sudah berubah.',
            findOthers: 'Cari profil lain',
            loadFailed: 'Gagal memuat profil',
            retry: 'Coba lagi',

            share: 'Bagikan',
            linkCopied: 'Link disalin',
            copyFailed: 'Gagal menyalin',
            save: 'Simpan',
            saved: 'Disimpan',
            followAction: 'Ikuti',
            followingAction: 'Diikuti',
            followLoading: 'Menyimpan...',
            chat: 'Chat',
            opening: 'Membuka...',
            editProfile: 'Edit Profil',
            managePosts: 'Studio Konten',

            verified: 'Identitas terverifikasi',
            joined: 'Bergabung',
            locationFallback: 'Lokasi belum ditambahkan',

            views: 'Dilihat',
            viewsHelper: 'Total kunjungan profil',
            favorites: 'Favorit',
            favoritesHelper: 'Disimpan oleh pengguna',
            response: 'Estimasi Balasan',
            responseHelper: 'Perkiraan dari pemilik profil',
            activePosts: 'Postingan Aktif',
            activePostsHelper: 'Produk, jasa, dan lainnya',
            followers: 'Pengikut',
            followersHelper: 'Akun yang mengikuti profil ini',
            following: 'Mengikuti',
            followingHelper: 'Akun yang diikuti profil ini',
            reelsStat: 'Reels',
            reelsStatHelper: 'Video pendek aktif',
            rating: 'Rating',
            ratingHelper: 'Dari ulasan pengguna',
            notAvailable: 'Belum ada',

            posts: 'Postingan',
            about: 'Tentang',
            reviews: 'Ulasan',
            businessInfo: 'Info Usaha',

            all: 'Semua',
            newest: 'Terbaru',
            noPosts: 'Belum ada postingan aktif',
            noPostsDescription:
              'Pengguna ini belum menampilkan produk, jasa, atau kebutuhan publik.',
            viewAllPosts: 'Lihat Semua Postingan',
            askDetails: 'Tanya detail',
            active: 'Aktif',

            aboutTitle: 'Tentang',
            skills: 'Keahlian',
            roles: 'Peran di Lajukan',
            languages: 'Bahasa',
            experience: 'Pengalaman',
            education: 'Pendidikan',
            certifications: 'Sertifikasi',
            links: 'Tautan',
            noAbout: 'Informasi tambahan belum dilengkapi oleh pemilik profil.',

            reviewSummary: 'Ringkasan ulasan',
            reviewCount: 'ulasan',
            noReviews: 'Belum ada ulasan',
            noReviewsDescription:
              'Ulasan akan muncul setelah pengguna menerima penilaian yang valid.',

            businessType: 'Jenis Profil',
            category: 'Kategori',
            businessLocation: 'Lokasi Usaha',
            businessHours: 'Jam Operasional',
            contact: 'Hubungi',
            chatOnLajukan: 'Chat di Lajukan',
            whatsapp: 'WhatsApp',
            fastResponse: 'Respon cepat',
            askByChat: 'Tanya lewat chat',
            noBusinessInfo:
              'Informasi usaha belum dilengkapi oleh pemilik profil.',

            chatFailed: 'Gagal membuka chat.',
            chatRoomFailed: 'Room chat belum bisa dibuat.',
            followFailed: 'Gagal memperbarui follow.',
          }
        : {
            publicProfile: 'Public profile',
            back: 'Back',
            notFound: 'Profile not found',
            notFoundDescription:
              'This profile is unavailable or its address has changed.',
            findOthers: 'Find other profiles',
            loadFailed: 'Failed to load profile',
            retry: 'Retry',

            share: 'Share',
            linkCopied: 'Link copied',
            copyFailed: 'Copy failed',
            save: 'Save',
            saved: 'Saved',
            followAction: 'Follow',
            followingAction: 'Following',
            followLoading: 'Saving...',
            chat: 'Chat',
            opening: 'Opening...',
            editProfile: 'Edit Profile',
            managePosts: 'Content Studio',

            verified: 'Identity verified',
            joined: 'Joined',
            locationFallback: 'Location has not been added',

            views: 'Views',
            viewsHelper: 'Total profile visits',
            favorites: 'Favorites',
            favoritesHelper: 'Saved by users',
            response: 'Reply Estimate',
            responseHelper: 'Estimate provided by the profile owner',
            activePosts: 'Active Posts',
            activePostsHelper: 'Products, services, and more',
            followers: 'Followers',
            followersHelper: 'Accounts following this profile',
            following: 'Following',
            followingHelper: 'Accounts this profile follows',
            reelsStat: 'Reels',
            reelsStatHelper: 'Active short videos',
            rating: 'Rating',
            ratingHelper: 'From user reviews',
            notAvailable: 'Not available',

            posts: 'Posts',
            about: 'About',
            reviews: 'Reviews',
            businessInfo: 'Business Info',

            all: 'All',
            newest: 'Newest',
            noPosts: 'No active posts yet',
            noPostsDescription:
              'This user has not published products, services, or public needs.',
            viewAllPosts: 'View All Posts',
            askDetails: 'Ask details',
            active: 'Active',

            aboutTitle: 'About',
            skills: 'Skills',
            roles: 'Roles on Lajukan',
            languages: 'Languages',
            experience: 'Experience',
            education: 'Education',
            certifications: 'Certifications',
            links: 'Links',
            noAbout:
              'Additional information has not been completed by the profile owner.',

            reviewSummary: 'Review summary',
            reviewCount: 'reviews',
            noReviews: 'No reviews yet',
            noReviewsDescription:
              'Reviews will appear after the user receives valid ratings.',

            businessType: 'Profile Type',
            category: 'Category',
            businessLocation: 'Business Location',
            businessHours: 'Business Hours',
            contact: 'Contact',
            chatOnLajukan: 'Chat on Lajukan',
            whatsapp: 'WhatsApp',
            fastResponse: 'Fast response',
            askByChat: 'Ask via chat',
            noBusinessInfo:
              'Business information has not been completed by the profile owner.',

            chatFailed: 'Failed to open chat.',
            chatRoomFailed: 'Chat room could not be created.',
            followFailed: 'Failed to update follow.',
          },
    [localeCode],
  );

  const initialProfileRef = useRef<PublicUserProfile | null>(
    normalizePublicUserProfile(initialProfile),
  );
  const initialSocialRef = useRef<ProfileSocialSummary | null>(
    normalizeProfileSocialSummary(initialSocial),
  );
  const [profile, setProfile] = useState<PublicUserProfile | null>(
    initialProfileRef.current,
  );
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [profileSocial, setProfileSocial] =
    useState<ProfileSocialSummary | null>(initialSocialRef.current);
  const [isFollowingProfile, setIsFollowingProfile] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState('');

  const [loading, setLoading] = useState(!initialProfileRef.current);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  const [activeProfileTab, setActiveProfileTab] =
    useState<PublicProfileTab>('posts');
  const [activeContentTab, setActiveContentTab] =
    useState<ProfileContentTab>('all');
  const [socialModalTab, setSocialModalTab] = useState<ProfileSocialTab | null>(
    null,
  );

  const [isSaved, setIsSaved] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [startingChatKey, setStartingChatKey] = useState<string | null>(null);
  const [chatError, setChatError] = useState('');

  const trackedProfileViewRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      const serverProfile = initialProfileRef.current;
      if (!serverProfile) setLoading(true);
      setNotFound(false);
      setError('');
      if (!serverProfile) setProfile(null);
      setListings([]);
      if (!initialSocialRef.current) setProfileSocial(null);
      setIsFollowingProfile(Boolean(initialSocialRef.current?.viewerFollowing));
      setFollowError('');

      try {
        let nextProfile: PublicUserProfile | null = serverProfile
          ? (await fetchProfileById(serverProfile.id, controller.signal)) ||
            serverProfile
          : null;
        const directId = extractPublicProfileIdFromSlug(slug);

        if (!nextProfile && directId) {
          nextProfile = await fetchProfileById(directId, controller.signal);
        }

        if (!nextProfile) {
          const decodedSlug = decodePublicProfileSlug(slug);
          const slugHandle = decodedSlug.replace(/--.+$/, '').trim();
          const searchTerm = slugHandle.replace(/-/g, ' ').trim();

          if (!slugHandle && !searchTerm) {
            setNotFound(true);
            return;
          }

          const directSlugProfile = slugHandle
            ? await fetchProfileById(slugHandle, controller.signal)
            : null;

          let candidate =
            directSlugProfile &&
            matchesPublicProfileSlug(slug, directSlugProfile)
              ? directSlugProfile
              : null;

          const searchVariants = Array.from(
            new Set(
              [searchTerm, slugHandle, slugHandle.replace(/-/g, '_')]
                .map(item => item.trim())
                .filter(Boolean),
            ),
          );

          for (const variant of searchVariants) {
            if (candidate) break;

            const candidates = await fetchDiscoverProfiles(
              controller.signal,
              variant,
              32,
            );

            candidate =
              candidates.find(item => matchesPublicProfileSlug(slug, item)) ||
              null;
          }

          if (!candidate) {
            const candidates = await fetchDiscoverProfiles(
              controller.signal,
              undefined,
              100,
            );

            candidate =
              candidates.find(item => matchesPublicProfileSlug(slug, item)) ||
              null;
          }

          if (!candidate) {
            setNotFound(true);
            return;
          }

          nextProfile =
            (await fetchProfileById(candidate.id, controller.signal)) ||
            candidate;
        }

        if (!nextProfile) {
          setNotFound(true);
          return;
        }

        const canonicalSlug = buildPublicProfileSlug({
          id: nextProfile.id,
          username: nextProfile.username,
          full_name: nextProfile.full_name || nextProfile.username || 'member',
        });

        if (slug !== canonicalSlug) {
          router.replace(`/profile/${canonicalSlug}`);
        }

        const listingResponse = await fetch(
          `/api/content?owner_id=${encodeURIComponent(nextProfile.id)}&limit=36&status=active`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        );

        let nextListings: PublicListing[] = [];

        if (listingResponse.ok) {
          const listingPayload = await listingResponse.json().catch(() => ({}));

          nextListings = extractContentItems(listingPayload).map(item => {
            const raw = item as unknown as ProfileRecord;
            const metadata = asRecord(item.metadata) || {};

            return {
              id: item.id,
              slug: item.slug,
              title: item.title,
              summary: item.summary,
              content_type: item.content_type,
              category: item.category,
              metadata,
              cover_image:
                normalizeContentMediaUrl(item.cover_image ?? undefined) || null,
              price_cents: item.price_cents,
              created_at: item.created_at,
              updated_at: item.updated_at,
              view_count:
                readNumber(
                  raw.view_count ??
                    raw.views_count ??
                    metadata.view_count ??
                    metadata.views_count,
                ) ?? 0,
              favorite_count:
                readNumber(
                  raw.favorite_count ??
                    raw.favorites_count ??
                    raw.like_count ??
                    metadata.favorite_count ??
                    metadata.favorites_count,
                ) ?? 0,
              chat_count:
                readNumber(
                  raw.chat_count ??
                    raw.comment_count ??
                    raw.comments_count ??
                    metadata.chat_count ??
                    metadata.comment_count,
                ) ?? 0,
            };
          });
        }

        if (!controller.signal.aborted) {
          setProfile(nextProfile);
          setListings(nextListings);
        }
      } catch (loadError) {
        if (controller.signal.aborted) return;

        setError(
          loadError instanceof Error ? loadError.message : copy.loadFailed,
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [copy.loadFailed, router, slug]);

  useEffect(() => {
    setIsFollowingProfile(Boolean(profileSocial?.viewerFollowing));
  }, [profileSocial?.viewerFollowing]);

  useEffect(() => {
    const profileId = profile?.id;
    if (!profileId) return;

    const controller = new AbortController();

    async function loadSocial(targetProfileId: string) {
      const social = await fetchProfileSocialSummary(
        targetProfileId,
        controller.signal,
      ).catch(() => null);

      if (!controller.signal.aborted) {
        setProfileSocial(social);
      }
    }

    void loadSocial(profileId);

    return () => controller.abort();
  }, [profile?.id]);

  useEffect(() => {
    if (!profile || typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(PUBLIC_PROFILE_SAVE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed)
        ? parsed.map(item => String(item)).filter(Boolean)
        : [];

      setIsSaved(ids.includes(profile.id));
    } catch {
      setIsSaved(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile?.id || !user?.id) return;
    if (profile.id === user.id) return;

    const trackingKey = `${profile.id}:${user.id}`;
    if (trackedProfileViewRef.current === trackingKey) return;

    trackedProfileViewRef.current = trackingKey;

    void trackLajukanEvent('profile.viewed', {
      entityType: 'profile',
      entityId: profile.id,
      page: pathname || `/profile/${slug}`,
      properties: {
        target_user_id: profile.id,
        target_username: profile.username || '',
        target_name: profile.full_name || profile.username || profile.id,
        target_href: pathname || `/profile/${slug}`,
        profile_slug: slug,
        actor_user_id: user.id,
        actor_username: user.username || '',
        actor_name: user.name || user.fullName || user.username || '',
        actor_avatar_url: user.avatarUrl || user.avatar_url || '',
        source: 'public_profile',
      },
    });
  }, [
    pathname,
    profile?.full_name,
    profile?.id,
    profile?.username,
    slug,
    user?.avatarUrl,
    user?.avatar_url,
    user?.fullName,
    user?.id,
    user?.name,
    user?.username,
  ]);

  const detail = useMemo(
    () => (profile ? buildProfileDetail(profile, localeCode) : null),
    [localeCode, profile],
  );

  const reviews = useMemo(
    () => (profile ? normalizeReviews(profile, localeCode) : []),
    [localeCode, profile],
  );

  if (loading) {
    return <ProfileViewSkeleton />;
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[color:var(--app-surface-muted)] pb-10 dark:bg-[color:var(--app-surface)]">
        <DetailMobileTopBar
          title={copy.notFound}
          eyebrow={copy.publicProfile}
          backLabel={copy.back}
        />

        <div className="page-shell py-6">
          <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-8 text-center">
            <h1 className="text-2xl font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {copy.notFound}
            </h1>

            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[color:var(--app-text-soft)]">
              {copy.notFoundDescription}
            </p>

            <Link
              href="/explore"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              {copy.findOthers}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile || !detail) {
    return (
      <div className="min-h-screen bg-[color:var(--app-surface-muted)] pb-10 dark:bg-[color:var(--app-surface)]">
        <DetailMobileTopBar
          title={copy.loadFailed}
          eyebrow={copy.publicProfile}
          backLabel={copy.back}
        />

        <div className="page-shell py-6">
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/60 dark:bg-rose-500/10">
            <h1 className="text-xl font-black text-rose-900 dark:text-rose-200">
              {copy.loadFailed}
            </h1>

            <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">
              {error || copy.loadFailed}
            </p>

            <button
              type="button"
              onClick={() => router.refresh()}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white px-5 text-sm font-bold text-rose-800 dark:border-rose-800 dark:bg-transparent dark:text-rose-200"
            >
              <RefreshCcw className="h-4 w-4" />
              {copy.retry}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isOwnProfile = Boolean(user?.id && user.id === profile.id);

  const avatarUrl = profileAvatarSrc(
    getPublicProfileAvatarUrl(profile),
    readProfileAvatarStyle(profile),
    detail.displayName,
  );

  const coverUrl = getPublicProfileCoverUrl(profile);
  const publicPhone = getPublicProfilePhone(profile);

  const defaultChatDraft =
    localeCode === 'id'
      ? `Halo ${detail.displayName}, saya tertarik dengan profil Anda.`
      : `Hi ${detail.displayName}, I am interested in your profile.`;

  const whatsAppHref = buildWhatsAppHref(publicPhone, defaultChatDraft);

  const joinedDate = formatJoinedDate(
    profile.joined_at || profile.created_at,
    localeCode,
  );

  const metadata = asRecord(profile.metadata);
  const provider = asRecord(profile.provider_profile);
  const freelancer = asRecord(profile.freelancer_profile);
  const statsRecord =
    asRecord(metadata?.stats) ||
    asRecord(metadata?.profile_stats) ||
    asRecord(metadata?.metrics);

  const followersCount = Math.max(
    profileSocial?.followersCount ?? 0,
    getProfileMetric(profile, [
      'followers_count',
      'follower_count',
      'followers',
    ]) ?? 0,
    profileSocial?.followers.length ?? 0,
  );

  const followingCount = Math.max(
    profileSocial?.followingCount ?? 0,
    getProfileMetric(profile, ['following_count', 'following']) ?? 0,
    profileSocial?.following.length ?? 0,
  );

  const reelsCount = Math.max(
    profileSocial?.reelsCount ?? 0,
    getProfileMetric(profile, [
      'reels_count',
      'reel_count',
      'videos_count',
      'videos',
    ]) ?? 0,
  );

  const rating =
    profile.rating ??
    readNestedNumber(
      [profile as unknown as ProfileRecord, metadata, statsRecord],
      ['rating', 'average_rating', 'rating_average'],
    );

  const reviewCount =
    profile.review_count ??
    readNestedNumber(
      [profile as unknown as ProfileRecord, metadata, statsRecord],
      ['review_count', 'reviews_count', 'rating_count'],
    ) ??
    reviews.length;

  // Public trust shows only proof that is active right now.
  // It intentionally does not expose owner-only completion percentages or locked missions.
  const publicTrustSignals = [
    {
      key: 'identity',
      label: localeCode === 'id' ? 'Identitas' : 'Identity',
      active: Boolean(profile.identity_verified),
      icon: ShieldCheck,
    },
    {
      key: 'contact',
      label: localeCode === 'id' ? 'Kontak' : 'Contact',
      active: Boolean(profile.email_verified || profile.phone_verified),
      icon: UserCheck,
    },
    {
      key: 'catalog',
      label: localeCode === 'id' ? 'Katalog 5+' : 'Catalog 5+',
      active: listings.length >= 5,
      icon: Store,
    },
    ...(!PROMO_ONLY_MODE
      ? [
          {
            key: 'transaction',
            label: localeCode === 'id' ? 'Siap transaksi' : 'Transaction ready',
            active: Boolean(profile.transaction_eligible),
            icon: CheckCircle2,
          },
        ]
      : []),
  ].filter(item => item.active);

  const listingGroups = PROFILE_LEAF_TABS.reduce<
    Record<ProfileLeafTab, PublicListing[]>
  >(
    (groups, tab) => {
      groups[tab] = [];
      return groups;
    },
    {} as Record<ProfileLeafTab, PublicListing[]>,
  );

  for (const item of listings) {
    const tab = normalizeProfileContentTab({
      type: item.content_type,
      category: item.category,
      metadata: item.metadata || null,
    });

    listingGroups[tab].push(item);
  }

  const availableContentTabs: ProfileContentTab[] = [
    'all',
    ...PROFILE_LEAF_TABS.filter(tab => listingGroups[tab].length > 0),
  ];

  const resolvedContentTab = availableContentTabs.includes(activeContentTab)
    ? activeContentTab
    : 'all';

  const visibleListings =
    resolvedContentTab === 'all' ? listings : listingGroups[resolvedContentTab];

  const businessCategory =
    firstString(
      provider?.business_category,
      provider?.category,
      metadata?.business_category,
      metadata?.category,
      freelancer?.category,
    ) || detail.roles.map(formatRole).join(', ');

  const businessHours =
    firstString(
      provider?.business_hours,
      provider?.operational_hours,
      metadata?.business_hours,
      metadata?.operational_hours,
      provider?.response_time,
    ) || copy.askByChat;

  const businessRows = [
    {
      key: 'type',
      label: copy.businessType,
      value:
        detail.roles.map(formatRole).join(', ') ||
        (profile.identity_verified ? copy.verified : copy.publicProfile),
      icon: ShieldCheck,
    },
    {
      key: 'category',
      label: copy.category,
      value: businessCategory,
      icon: Store,
    },
    {
      key: 'location',
      label: copy.businessLocation,
      value: profile.location || '',
      icon: MapPin,
    },
    {
      key: 'hours',
      label: copy.businessHours,
      value: businessHours,
      icon: Clock3,
    },
  ].filter(item => item.value);

  const hasAboutContent =
    detail.skills.length > 0 ||
    detail.roles.length > 0 ||
    detail.languages.length > 0 ||
    detail.experience.length > 0 ||
    detail.education.length > 0 ||
    detail.certifications.length > 0 ||
    detail.links.length > 0;

  const handleToggleSaved = () => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(PUBLIC_PROFILE_SAVE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed)
        ? parsed.map(item => String(item)).filter(Boolean)
        : [];

      const nextSaved = !isSaved;
      const nextIds = nextSaved
        ? Array.from(new Set([...ids, profile.id]))
        : ids.filter(item => item !== profile.id);

      window.localStorage.setItem(
        PUBLIC_PROFILE_SAVE_KEY,
        JSON.stringify(nextIds),
      );

      setIsSaved(nextSaved);
    } catch {
      setIsSaved(value => !value);
    }
  };

  const handleToggleProfileFollow = async () => {
    if (!isAuthenticated) {
      router.push(
        `/login?callbackUrl=${encodeURIComponent(
          pathname || `/profile/${slug}`,
        )}`,
      );
      return;
    }

    if (isOwnProfile || followLoading) return;

    const nextFollowing = !isFollowingProfile;
    const previousSocial = profileSocial;
    const previousFollowing = isFollowingProfile;
    const viewerId = user?.id ? `auth-${user.id}` : '';
    const viewerName =
      user?.name || user?.fullName || user?.username || user?.id || '';

    setFollowError('');
    setFollowLoading(true);
    setIsFollowingProfile(nextFollowing);
    setProfileSocial(current => {
      const base = current || {
        userId: profile.id,
        forumUserId: `auth-${profile.id}`,
        followersCount: 0,
        followingCount: 0,
        reelsCount: 0,
        viewerFollowing: false,
        followers: [],
        following: [],
      };

      const followerExists = viewerId
        ? base.followers.some(
            item => item.id === viewerId || item.id === user?.id,
          )
        : true;
      const nextFollowers =
        nextFollowing && viewerId && !followerExists
          ? [
              {
                id: viewerId,
                username: user?.username || null,
                name: viewerName || null,
                avatarUrl: user?.avatarUrl || user?.avatar_url || null,
                title: null,
              },
              ...base.followers,
            ]
          : !nextFollowing && viewerId
            ? base.followers.filter(
                item => item.id !== viewerId && item.id !== user?.id,
              )
            : base.followers;

      return {
        ...base,
        viewerFollowing: nextFollowing,
        followersCount: Math.max(
          nextFollowers.length,
          base.followersCount + (nextFollowing ? 1 : -1),
          0,
        ),
        followers: nextFollowers,
      };
    });

    try {
      const response = await authFetch(
        `/api/community/users/${encodeURIComponent(profile.id)}/follow`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: nextFollowing }),
        },
      );
      const payload = await response.json().catch(() => null);
      const nextSocial = normalizeProfileSocialSummary(payload);

      if (!response.ok || !nextSocial) {
        throw new Error(copy.followFailed);
      }

      setProfileSocial(nextSocial);
      setIsFollowingProfile(nextSocial.viewerFollowing);
    } catch {
      setProfileSocial(previousSocial);
      setIsFollowingProfile(previousFollowing);
      setFollowError(copy.followFailed);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShareProfile = async () => {
    const url =
      typeof window !== 'undefined'
        ? window.location.href
        : `https://www.lajukan.com/${localeCode}/profile/${slug}`;

    try {
      await navigator.clipboard.writeText(url);
      setShareMessage(copy.linkCopied);
    } catch {
      setShareMessage(copy.copyFailed);
    }

    window.setTimeout(() => setShareMessage(''), 1600);
  };

  const handleOpenChat = async (
    draft = defaultChatDraft,
    listing?: PublicListing,
  ) => {
    if (!isAuthenticated) {
      router.push(
        `/login?callbackUrl=${encodeURIComponent(
          pathname || `/profile/${slug}`,
        )}`,
      );
      return;
    }

    if (isOwnProfile) {
      router.push(listing ? buildPublicListingHref(listing) : '/profile/edit');
      return;
    }

    const chatKey = listing?.id || 'profile';
    setStartingChatKey(chatKey);
    setChatError('');

    try {
      const response = await authFetch('/api/chat/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peer_user_id: profile.id,
          lead: {
            source: listing ? 'profile_listing' : 'public_profile',
            name: listing?.title || detail.displayName,
            content_id: listing?.id,
            metadata: listing
              ? {
                  content_url: buildPublicListingHref(listing),
                  content_type: listing.content_type || listing.category,
                }
              : {
                  profile_id: profile.id,
                  profile_slug: slug,
                },
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        room_id?: string;
        data?: { room_id?: string };
        error?: string;
      };

      const roomId = firstString(payload.room_id, payload.data?.room_id);

      if (!response.ok || !roomId) {
        throw new Error(payload.error || copy.chatRoomFailed);
      }

      const messageText = draft.trim() || defaultChatDraft;

      if (listing) {
        const attachment = buildPublicListingChatPayload(
          listing,
          profile,
          localeCode,
        );

        await authFetch(
          `/api/chat/rooms/${encodeURIComponent(roomId)}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: messageText,
              type: 'listing',
              attachments: [JSON.stringify(attachment)],
            }),
          },
        ).catch(() => null);
      } else {
        await authFetch(
          `/api/chat/rooms/${encodeURIComponent(roomId)}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: messageText,
              type: 'text',
              attachments: [],
            }),
          },
        ).catch(() => null);
      }

      router.push(`/chat/${encodeURIComponent(roomId)}`);
    } catch (openChatError) {
      setChatError(
        openChatError instanceof Error
          ? openChatError.message
          : copy.chatFailed,
      );
    } finally {
      setStartingChatKey(null);
    }
  };

  const profileTabs: Array<{
    key: PublicProfileTab;
    label: string;
  }> = [
    { key: 'posts', label: localeCode === 'id' ? 'Etalase' : 'Storefront' },
    { key: 'about', label: copy.about },
    { key: 'reviews', label: `${copy.reviews} (${reviewCount})` },
    { key: 'business', label: copy.businessInfo },
  ];

  return (
    <>
      <div className="min-h-screen overflow-x-clip bg-[color:var(--app-surface-muted)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] dark:bg-[color:var(--app-surface)] sm:pb-8">
        <DetailMobileTopBar
          title={detail.displayName}
          eyebrow={copy.publicProfile}
          backLabel={copy.back}
        />

        <main className="mx-auto w-full max-w-[1180px] space-y-3 px-0 py-0 sm:space-y-4 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
          {/* =====================================================
              PROFILE IDENTITY — same visual language as SuperProfile.
              Public view changes actions, not identity hierarchy.
          ====================================================== */}
          <section className="overflow-hidden border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] sm:rounded-[24px] sm:border sm:shadow-[0_18px_48px_-40px_rgba(15,23,42,0.35)]">
            <div className="relative h-32 overflow-hidden sm:h-44 lg:h-52">
              {coverUrl ? (
                <Image
                  src={coverUrl}
                  alt={`${detail.displayName} cover`}
                  fill
                  priority
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 1180px"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_24%,rgba(16,185,129,0.32),transparent_32%),radial-gradient(circle_at_78%_22%,rgba(14,165,233,0.16),transparent_28%),linear-gradient(135deg,#d1fae5_0%,#f8fafc_50%,#dcfce7_100%)] dark:bg-[radial-gradient(circle_at_16%_24%,rgba(16,185,129,0.18),transparent_32%),radial-gradient(circle_at_78%_22%,rgba(14,165,233,0.12),transparent_28%),linear-gradient(135deg,#052e25_0%,#0f172a_52%,#022c22_100%)]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/40" />

              <div className="absolute right-2.5 top-2.5 flex items-center gap-2 sm:right-4 sm:top-4">
                <button
                  type="button"
                  onClick={handleShareProfile}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/35 bg-black/45 text-white shadow-sm backdrop-blur-md transition hover:bg-black/60 sm:h-10 sm:w-10"
                  aria-label={shareMessage || copy.share}
                  title={shareMessage || copy.share}
                >
                  {shareMessage ? <Copy className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                </button>

                {!isOwnProfile ? (
                  <button
                    type="button"
                    onClick={handleToggleSaved}
                    className={`grid h-9 w-9 place-items-center rounded-full border text-white shadow-sm backdrop-blur-md transition sm:h-10 sm:w-10 ${
                      isSaved
                        ? 'border-emerald-300 bg-emerald-600'
                        : 'border-white/35 bg-black/45 hover:bg-black/60'
                    }`}
                    aria-label={isSaved ? copy.saved : copy.save}
                    title={isSaved ? copy.saved : copy.save}
                  >
                    <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="relative px-3 pb-4 sm:px-6 sm:pb-6">
              <div className="-mt-11 flex min-w-0 items-end gap-3 sm:-mt-14 sm:gap-4">
                <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-full border-[4px] border-[color:var(--app-surface-strong)] bg-[color:var(--app-surface-muted)] shadow-lg sm:h-28 sm:w-28 sm:border-[5px]">
                  <Image
                    src={avatarUrl}
                    alt={detail.displayName}
                    fill
                    priority
                    unoptimized
                    sizes="112px"
                    className="object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1 pb-0.5 sm:pb-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <h1 className="min-w-0 truncate text-[20px] font-black leading-tight tracking-[-0.025em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[28px]">
                      {detail.displayName}
                    </h1>
                    {profile.identity_verified ? (
                      <BadgeCheck
                        className="h-5 w-5 shrink-0 fill-emerald-600 text-white sm:h-6 sm:w-6"
                        aria-label={copy.verified}
                      />
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-[color:var(--app-text-soft)] sm:text-sm">
                    @{detail.handle}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5">
                {businessCategory ? (
                  <span className="inline-flex max-w-[70vw] items-center rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-accent)] sm:max-w-sm sm:text-[11px]">
                    <span className="truncate">{businessCategory}</span>
                  </span>
                ) : null}
                <span className="inline-flex max-w-[70vw] items-center gap-1 rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-text-soft)] sm:max-w-sm sm:text-[11px]">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{profile.location || copy.locationFallback}</span>
                </span>
                {joinedDate ? (
                  <span className="hidden items-center gap-1 rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-text-soft)] sm:inline-flex sm:text-[11px]">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {copy.joined} {joinedDate}
                  </span>
                ) : null}
              </div>

              {detail.headline ? (
                <p className="mt-3 line-clamp-1 max-w-3xl text-[13px] font-black leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-sm">
                  {detail.headline}
                </p>
              ) : null}
              <p className="mt-1 line-clamp-2 max-w-3xl text-[12px] font-medium leading-5 text-[color:var(--app-text-soft)] sm:line-clamp-3 sm:text-[13px] sm:leading-6">
                {detail.summary}
              </p>

              {/* Match SuperProfile: Offers · Followers · Reels · Rating. */}
              <div className="mt-4 grid grid-cols-4 divide-x divide-[color:var(--app-border)] border-y border-[color:var(--app-border)] py-2.5 sm:max-w-2xl sm:rounded-xl sm:border sm:py-0">
                <button type="button" onClick={() => setActiveProfileTab('posts')} className="min-w-0 px-1 py-1 text-center transition hover:bg-[color:var(--app-surface-muted)] sm:px-3 sm:py-3">
                  <span className="block truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
                    {formatCompactNumber(listings.length, localeCode)}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] font-semibold text-[color:var(--app-text-soft)] sm:text-[11px]">
                    {localeCode === 'id' ? 'Penawaran' : 'Offers'}
                  </span>
                </button>
                <button type="button" onClick={() => setSocialModalTab('followers')} className="min-w-0 px-1 py-1 text-center transition hover:bg-[color:var(--app-surface-muted)] sm:px-3 sm:py-3">
                  <span className="block truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
                    {formatCompactNumber(followersCount, localeCode)}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] font-semibold text-[color:var(--app-text-soft)] sm:text-[11px]">{copy.followers}</span>
                </button>
                <Link href={`/reels?creator=${encodeURIComponent(profile.id)}`} className="min-w-0 px-1 py-1 text-center transition hover:bg-[color:var(--app-surface-muted)] sm:px-3 sm:py-3">
                  <span className="block truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
                    {formatCompactNumber(reelsCount, localeCode)}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] font-semibold text-[color:var(--app-text-soft)] sm:text-[11px]">{copy.reelsStat}</span>
                </Link>
                <button type="button" onClick={() => setActiveProfileTab('reviews')} className="min-w-0 px-1 py-1 text-center transition hover:bg-[color:var(--app-surface-muted)] sm:px-3 sm:py-3">
                  <span className="flex items-center justify-center gap-1 truncate text-sm font-black text-amber-600 dark:text-amber-300 sm:text-base">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {typeof rating === 'number' && rating > 0 ? rating.toFixed(1) : '—'}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] font-semibold text-[color:var(--app-text-soft)] sm:text-[11px]">{copy.rating}</span>
                </button>
              </div>

              {/* Visitors get only two primary decisions. */}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                {isOwnProfile ? (
                  <>
                    <Link href="/profile/edit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-xs font-black text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] dark:text-[color:var(--app-text-inverse)]">
                      <Edit3 className="h-4 w-4" />
                      {copy.editProfile}
                    </Link>
                    <Link href="/manage" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-xs font-black text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] dark:text-[color:var(--app-text-inverse)]">
                      <Wrench className="h-4 w-4" />
                      {copy.managePosts}
                    </Link>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleOpenChat()}
                      disabled={startingChatKey === 'profile'}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70 sm:min-w-32 sm:text-sm"
                    >
                      {startingChatKey === 'profile' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                      {startingChatKey === 'profile' ? copy.opening : copy.chat}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleProfileFollow()}
                      disabled={followLoading}
                      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-black transition disabled:cursor-wait disabled:opacity-70 sm:text-sm ${
                        isFollowingProfile
                          ? 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]'
                          : 'border-emerald-600 bg-[color:var(--app-surface-strong)] text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10'
                      }`}
                    >
                      {followLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isFollowingProfile ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                      {followLoading ? copy.followLoading : isFollowingProfile ? copy.followingAction : copy.followAction}
                    </button>
                  </>
                )}
              </div>

              {chatError ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-200">{chatError}</div>
              ) : null}
              {followError ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-500/10 dark:text-amber-200">{followError}</div>
              ) : null}
            </div>
          </section>

          {/* Public trust mirrors SuperProfile, but only active proof is shown. */}
          {publicTrustSignals.length > 0 ? (
            <section className="border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-3 sm:rounded-[24px] sm:border sm:px-5 sm:py-4">
              <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex shrink-0 items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-white">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {localeCode === 'id' ? 'Kepercayaan' : 'Trust'}
                  </span>
                </div>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {publicTrustSignals.map(item => {
                    const Icon = item.icon;
                    return (
                      <span key={item.key} className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 sm:text-[11px]">
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}

          {/* =====================================================
              PROFILE CONTENT — one card, simple sticky navigation.
          ====================================================== */}
          <section className="border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] sm:overflow-hidden sm:rounded-[24px] sm:border sm:shadow-[0_16px_44px_-38px_rgba(15,23,42,0.25)]">
            <div className="sticky top-0 z-20 border-b border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)]/96 px-2 backdrop-blur sm:px-4">
              <ProfileRail
                activeIndex={profileTabs.findIndex(tab => tab.key === activeProfileTab)}
                ariaLabel={localeCode === 'id' ? 'Navigasi profil' : 'Profile navigation'}
                trackClassName="gap-0"
                viewportClassName="py-0"
              >
                {profileTabs.map(tab => {
                  const active = activeProfileTab === tab.key;
                  return (
                    <ProfileRailItem key={tab.key}>
                      <button
                        type="button"
                        onClick={() => setActiveProfileTab(tab.key)}
                        aria-current={active ? 'page' : undefined}
                        className={`relative min-h-12 whitespace-nowrap px-3 text-[12px] font-bold transition sm:min-h-14 sm:px-4 sm:text-sm ${
                          active
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-[color:var(--app-text-soft)] hover:text-[color:var(--app-text)]'
                        }`}
                      >
                        {tab.label}
                        {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-emerald-600" /> : null}
                      </button>
                    </ProfileRailItem>
                  );
                })}
              </ProfileRail>
            </div>

            {activeProfileTab === 'posts' ? (
              <div className="min-w-0 p-3 sm:p-4 lg:p-5">
                <div className="min-w-0">
                  <div className="-mx-3 px-3 pb-1 sm:mx-0 sm:px-0">
                    <ProfileRail
                      activeIndex={availableContentTabs.indexOf(resolvedContentTab)}
                      ariaLabel={localeCode === 'id' ? 'Filter konten profil' : 'Profile content filters'}
                    >
                      {availableContentTabs.map(tab => {
                        const active = resolvedContentTab === tab;
                        return (
                          <ProfileRailItem key={tab}>
                            <button
                              type="button"
                              onClick={() => setActiveContentTab(tab)}
                              aria-pressed={active}
                              className={`min-h-9 whitespace-nowrap rounded-full border px-3.5 text-[11px] font-bold transition sm:text-xs ${
                                active
                                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                  : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)] hover:border-emerald-300 hover:text-[color:var(--app-text)]'
                              }`}
                            >
                              {tab === 'all' ? copy.all : getProfileContentTabLabel(tab, localeCode)}
                            </button>
                          </ProfileRailItem>
                        );
                      })}
                    </ProfileRail>
                  </div>

                  {visibleListings.length > 0 ? (
                    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3">
                      {visibleListings.map(item => {
                        const tab = normalizeProfileContentTab({
                          type: item.content_type,
                          category: item.category,
                          metadata: item.metadata || null,
                        });
                        const views = getListingMetric(item, ['view_count', 'views_count', 'views']);
                        const favorites = getListingMetric(item, ['favorite_count', 'favorites_count', 'like_count', 'likes_count', 'favorites', 'likes']);
                        const chats = getListingMetric(item, ['chat_count', 'chats_count', 'comment_count', 'comments_count', 'chats', 'comments']);
                        const location = getListingLocation(item);
                        const href = buildPublicListingHref(item);

                        return (
                          <article
                            key={item.id}
                            className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
                          >
                            <Link href={href} className="relative aspect-square w-full overflow-hidden bg-[color:var(--app-surface-muted)]">
                              {item.cover_image ? (
                                <Image
                                  src={item.cover_image}
                                  alt={item.title || ''}
                                  fill
                                  unoptimized
                                  sizes="(max-width: 768px) 50vw, 260px"
                                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-[color:var(--app-text-soft)]">
                                  <Package className="h-8 w-8" />
                                </div>
                              )}
                              <span className={`absolute left-2 top-2 max-w-[80%] truncate rounded-md px-2 py-1 text-[9px] font-black ${getTabTone(tab)}`}>
                                {getProfileContentTabLabel(tab, localeCode)}
                              </span>
                            </Link>

                            <div className="flex min-h-[142px] flex-1 flex-col p-2.5 sm:p-3">
                              <Link href={href} className="min-w-0">
                                <h3 className="line-clamp-2 text-[12px] font-extrabold leading-[18px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-sm sm:leading-5">
                                  {item.title || (localeCode === 'id' ? 'Postingan' : 'Post')}
                                </h3>
                              </Link>

                              {item.summary ? (
                                <p className="mt-1 hidden line-clamp-2 text-[11px] leading-4 text-[color:var(--app-text-soft)] sm:block">
                                  {item.summary}
                                </p>
                              ) : null}

                              <p className="mt-2 truncate text-[13px] font-black text-emerald-700 dark:text-emerald-300 sm:text-sm">
                                {formatPublicListingValue(item, localeCode)}
                              </p>

                              <div className="flex-1" />

                              {location ? (
                                <p className="mt-1.5 truncate text-[9px] font-medium text-[color:var(--app-text-soft)] sm:text-[10px]">
                                  {location}
                                </p>
                              ) : null}

                              <div className="mt-2 flex items-center gap-2 text-[9px] font-semibold text-[color:var(--app-text-soft)] sm:text-[10px]">
                                <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{formatCompactNumber(views, localeCode)}</span>
                                <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{formatCompactNumber(favorites, localeCode)}</span>
                                <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{formatCompactNumber(chats, localeCode)}</span>
                              </div>

                              {!isOwnProfile ? (
                                <button
                                  type="button"
                                  onClick={() => void handleOpenChat(buildPublicListingChatQuestion(item, detail.displayName, localeCode), item)}
                                  disabled={startingChatKey === item.id}
                                  className="mt-2 inline-flex min-h-7 items-center gap-1 text-[10px] font-black text-emerald-700 transition hover:underline disabled:opacity-60 dark:text-emerald-300"
                                >
                                  {startingChatKey === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                                  {copy.askDetails}
                                </button>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState icon={Package} title={copy.noPosts} description={copy.noPostsDescription} />
                  )}
                </div>


              </div>
            ) : null}

            {activeProfileTab === 'about' ? (
              <div className="p-3 sm:p-5">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="space-y-3">
                    <section className="rounded-2xl border border-[color:var(--app-border)] p-4 sm:p-5">
                      <SectionTitle title={copy.aboutTitle} />
                      <p className="mt-3 text-sm leading-6 text-[color:var(--app-text-soft)]">{detail.summary}</p>
                    </section>

                    {detail.skills.length > 0 ? (
                      <section className="rounded-2xl border border-[color:var(--app-border)] p-4 sm:p-5">
                        <SectionTitle title={copy.skills} />
                        <div className="mt-3 flex flex-wrap gap-2">
                          {detail.skills.map(item => <span key={item} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{item}</span>)}
                        </div>
                      </section>
                    ) : null}

                    {detail.experience.length > 0 ? (
                      <section className="rounded-2xl border border-[color:var(--app-border)] p-4 sm:p-5">
                        <SectionTitle title={copy.experience} />
                        <div className="mt-3 space-y-2">
                          {detail.experience.map(item => <div key={item} className="rounded-xl bg-[color:var(--app-surface-muted)] px-3 py-2.5 text-sm font-semibold leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">{item}</div>)}
                        </div>
                      </section>
                    ) : null}

                    {!hasAboutContent ? <EmptyState icon={BriefcaseBusiness} title={copy.aboutTitle} description={copy.noAbout} /> : null}
                  </div>

                  <aside className="space-y-3">
                    {detail.roles.length > 0 ? (
                      <section className="rounded-2xl border border-[color:var(--app-border)] p-4">
                        <SectionTitle title={copy.roles} />
                        <div className="mt-3 flex flex-wrap gap-2">{detail.roles.map(item => <span key={item} className="rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1.5 text-xs font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">{formatRole(item)}</span>)}</div>
                      </section>
                    ) : null}
                    {detail.languages.length > 0 ? (
                      <section className="rounded-2xl border border-[color:var(--app-border)] p-4"><SectionTitle title={copy.languages} /><p className="mt-3 text-sm leading-6 text-[color:var(--app-text-soft)]">{detail.languages.join(' · ')}</p></section>
                    ) : null}
                    {detail.education.length > 0 ? (
                      <section className="rounded-2xl border border-[color:var(--app-border)] p-4"><SectionTitle title={copy.education} /><div className="mt-3 space-y-2">{detail.education.map(item => <p key={item} className="text-sm leading-5 text-[color:var(--app-text-soft)]">{item}</p>)}</div></section>
                    ) : null}
                    {detail.certifications.length > 0 ? (
                      <section className="rounded-2xl border border-[color:var(--app-border)] p-4"><SectionTitle title={copy.certifications} /><div className="mt-3 space-y-2">{detail.certifications.map(item => <p key={item} className="text-sm leading-5 text-[color:var(--app-text-soft)]">{item}</p>)}</div></section>
                    ) : null}
                    {detail.links.length > 0 ? (
                      <section className="rounded-2xl border border-[color:var(--app-border)] p-4">
                        <SectionTitle title={copy.links} />
                        <div className="mt-3 space-y-2">{detail.links.map(link => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer noopener" className="flex items-center justify-between gap-3 rounded-xl bg-[color:var(--app-surface-muted)] px-3 py-2.5 text-xs font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]"><span className="truncate">{link.label}</span><ExternalLink className="h-4 w-4 shrink-0 text-emerald-600" /></a>)}</div>
                      </section>
                    ) : null}
                  </aside>
                </div>
              </div>
            ) : null}

            {activeProfileTab === 'reviews' ? (
              <div className="p-3 sm:p-5">
                <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-5">
                  <section className="rounded-2xl border border-[color:var(--app-border)] p-4 text-center lg:sticky lg:top-16 lg:self-start">
                    <p className="text-4xl font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">{typeof rating === 'number' && rating > 0 ? rating.toFixed(1) : '—'}</p>
                    <div className="mt-2 flex justify-center gap-1">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={`h-4 w-4 ${typeof rating === 'number' && rating >= index + 1 ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />)}</div>
                    <p className="mt-2 text-xs text-[color:var(--app-text-soft)]">{formatCompactNumber(reviewCount, localeCode)} {copy.reviewCount}</p>
                  </section>

                  <section className="min-w-0">
                    {reviews.length > 0 ? (
                      <div className="space-y-2.5">
                        {reviews.map(review => (
                          <article key={review.id} className="rounded-2xl border border-[color:var(--app-border)] p-3.5 sm:p-4">
                            <div className="flex items-start gap-3">
                              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
                                {review.avatarUrl ? <Image src={review.avatarUrl} alt={review.name} fill unoptimized sizes="40px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-sm font-black text-emerald-700">{review.name.slice(0, 1).toUpperCase()}</div>}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">{review.name}</p>{review.date ? <span className="shrink-0 text-[10px] text-[color:var(--app-text-soft)]">{formatReviewDate(review.date, localeCode)}</span> : null}</div>
                                <div className="mt-1 flex gap-0.5">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={`h-3.5 w-3.5 ${review.rating >= index + 1 ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />)}</div>
                                {review.comment ? <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">{review.comment}</p> : null}
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : <EmptyState icon={Star} title={copy.noReviews} description={copy.noReviewsDescription} />}
                  </section>
                </div>
              </div>
            ) : null}

            {activeProfileTab === 'business' ? (
              <div className="grid gap-3 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-5">
                <section className="rounded-2xl border border-[color:var(--app-border)] p-4 sm:p-5">
                  <SectionTitle title={copy.businessInfo} subtitle={detail.headline} />
                  {businessRows.length > 0 ? (
                    <div className="mt-3 divide-y divide-[color:var(--app-border)]">
                      {businessRows.map(item => {
                        const Icon = item.icon;
                        return <div key={item.key} className="grid gap-1.5 py-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4"><div className="flex items-center gap-2 text-[11px] font-bold text-[color:var(--app-text-soft)]"><Icon className="h-4 w-4 text-emerald-600" />{item.label}</div><p className="text-sm font-semibold leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">{item.value}</p></div>;
                      })}
                    </div>
                  ) : <EmptyState icon={Store} title={copy.businessInfo} description={copy.noBusinessInfo} />}
                </section>

                <aside className="space-y-3">
                  <section className="rounded-2xl border border-[color:var(--app-border)] p-4">
                    <SectionTitle title={copy.contact} />
                    <div className="mt-3 space-y-2">
                      {isOwnProfile ? (
                        <>
                          <Link href="/profile/edit" className="flex min-h-11 items-center gap-3 rounded-xl bg-[color:var(--app-surface-muted)] px-3 text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]"><Edit3 className="h-4 w-4 text-emerald-600" />{copy.editProfile}</Link>
                          <Link href="/manage" className="flex min-h-11 items-center gap-3 rounded-xl bg-[color:var(--app-surface-muted)] px-3 text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]"><BriefcaseBusiness className="h-4 w-4 text-emerald-600" />{copy.managePosts}</Link>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => void handleOpenChat()} className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-emerald-600 px-3 text-left text-sm font-black text-white"><MessageCircle className="h-4 w-4" />{copy.chatOnLajukan}</button>
                          {whatsAppHref ? <a href={whatsAppHref} target="_blank" rel="noreferrer noopener" className="flex min-h-11 items-center gap-3 rounded-xl bg-[color:var(--app-surface-muted)] px-3 text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]"><PhoneCall className="h-4 w-4 text-emerald-600" />{copy.whatsapp}</a> : null}
                        </>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-[color:var(--app-border)] p-4">
                    <SectionTitle title={copy.verified} />
                    <div className="mt-3 space-y-2 text-sm">
                      {[
                        { label: 'Email', ready: Boolean(profile.email_verified) },
                        { label: localeCode === 'id' ? 'Telepon' : 'Phone', ready: Boolean(profile.phone_verified) },
                        { label: localeCode === 'id' ? 'Identitas' : 'Identity', ready: Boolean(profile.identity_verified) },
                        ...(!PROMO_ONLY_MODE ? [{ label: localeCode === 'id' ? 'Siap transaksi' : 'Transaction ready', ready: Boolean(profile.transaction_eligible) }] : []),
                      ].map(item => <div key={item.label} className="flex min-h-9 items-center justify-between gap-3"><span className="text-[color:var(--app-text-soft)]">{item.label}</span>{item.ready ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <span className="h-5 w-5 rounded-full border border-slate-300 dark:border-slate-600" />}</div>)}
                    </div>
                  </section>
                </aside>
              </div>
            ) : null}
          </section>
        </main>
      </div>

      <ProfileSocialModal
        open={Boolean(socialModalTab)}
        tab={socialModalTab || 'followers'}
        localeCode={localeCode}
        followers={profileSocial?.followers || []}
        following={profileSocial?.following || []}
        followersCount={followersCount}
        followingCount={followingCount}
        onTabChange={setSocialModalTab}
        onClose={() => setSocialModalTab(null)}
      />
    </>
  );
}
