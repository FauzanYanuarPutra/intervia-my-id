'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { Modal } from '@/components/common/Modal';
import { useAuth } from '@/context/AuthContext';
import { Link, useRouter } from '@/i18n/navigation';
import { usePathname } from 'next/navigation';
import {
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Clapperboard,
  Copy,
  ExternalLink,
  GraduationCap,
  Languages,
  Link2,
  MapPin,
  MessageCircle,
  PackageCheck,
  RefreshCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  extractContentItems,
  formatIDRFromCents,
  normalizeContentMediaUrl,
} from '@/lib/content/catalog';
import {
  buildPublicProfileSlug,
  decodePublicProfileSlug,
  extractPublicProfileIdFromSlug,
  matchesPublicProfileSlug,
} from '@/lib/profile/publicProfileLink';
import {
  getProfileContentTabDefinition,
  getProfileContentTabLabel,
  normalizeProfileContentTab,
  type ProfileContentTab,
  type ProfileLeafTab,
} from '@/lib/profile/profileContentTabs';
import type { CommunityFeedItem } from '@/lib/community/types';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import { DetailMobileTopBar } from '@/components/layout/DetailMobileTopBar';
import type { LajukanReel } from '../../../_data/reels';

type PublicProfileClientProps = {
  locale: string;
  slug: string;
};

type PublicUserProfile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  metadata?: unknown;
  bio?: string | null;
  location?: string | null;
  headline?: string | null;
  roles?: string[] | null;
  metadata_roles?: unknown;
  level?: string | null;
  rating?: number | null;
  completed_jobs?: number | null;
  hourly_rate?: number | null;
  freelancer_profile?: unknown;
  provider_profile?: unknown;
  buyer_profile?: unknown;
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
};

type ProfileRecord = Record<string, unknown>;

type ProfileDetail = {
  displayName: string;
  headline: string;
  summary: string;
  roles: string[];
  skills: string[];
  languages: string[];
  experience: string[];
  education: string[];
  certifications: string[];
  links: Array<{ label: string; url: string }>;
  verificationBadges: string[];
};

type PublicProfileTab = 'ringkas' | 'etalase' | 'reels' | 'komunitas' | 'trust';

type PublicSocialModal = 'followers' | 'following';

type PublicSocialUser = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  badge: string;
  verified: boolean;
};

type PublicProfileActivityPayload<T> = {
  items?: T[];
};

const PUBLIC_PROFILE_FOLLOW_KEY = 'lajukan.public-profile.following.v1';

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
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
  }
  return false;
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(entry => readString(entry)).filter(Boolean);
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
  const next: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(value);
  }
  return next;
}

function formatRole(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, token => token.toUpperCase());
}

function normalizeExternalUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z]+:\/\//i.test(trimmed)) return '';
  return `https://${trimmed}`;
}

function normalizePublicUserProfile(
  payload: unknown,
): PublicUserProfile | null {
  const body = asRecord(payload);
  const id = readString(body?.id);
  if (!id) return null;

  return {
    id,
    username: readString(body?.username) || null,
    full_name: readString(body?.full_name) || null,
    avatar_url: readString(body?.avatar_url) || null,
    metadata: body?.metadata,
    bio: readString(body?.bio) || null,
    location: readString(body?.location) || null,
    headline: readString(body?.headline) || null,
    roles: Array.isArray(body?.roles)
      ? body.roles.map(entry => readString(entry)).filter(Boolean)
      : [],
    metadata_roles: body?.metadata_roles,
    level: readString(body?.level) || null,
    rating: readNumber(body?.rating) ?? null,
    completed_jobs: readNumber(body?.completed_jobs) ?? null,
    hourly_rate: readNumber(body?.hourly_rate) ?? null,
    freelancer_profile: body?.freelancer_profile,
    provider_profile: body?.provider_profile,
    buyer_profile: body?.buyer_profile,
    email_verified: readBoolean(body?.email_verified),
    phone_verified: readBoolean(body?.phone_verified),
    identity_verified: readBoolean(body?.identity_verified),
    transaction_eligible: readBoolean(body?.transaction_eligible),
  };
}

function mapProfileToSocialUser(
  profile: PublicUserProfile,
  localeCode: 'id' | 'en',
): PublicSocialUser {
  const name =
    readString(profile.full_name) ||
    readString(profile.username) ||
    (localeCode === 'id' ? 'Member Lajukan' : 'Lajukan member');
  const handle = readString(profile.username)
    ? `@${readString(profile.username).toLowerCase()}`
    : '@lajukan';
  const roles = [
    ...(Array.isArray(profile.roles) ? profile.roles : []),
    ...toStringList(profile.metadata_roles),
  ];

  return {
    id: profile.id,
    name,
    handle,
    avatarUrl: profileAvatarSrc(
      profile.avatar_url,
      readProfileAvatarStyle(profile),
      name,
    ),
    badge:
      roles.length > 0
        ? roles.slice(0, 1).map(formatRole).join('')
        : profile.identity_verified
          ? localeCode === 'id'
            ? 'Trusted'
            : 'Trusted'
          : localeCode === 'id'
            ? 'Member'
            : 'Member',
    verified: Boolean(profile.identity_verified),
  };
}

function collectLinks(
  root: ProfileRecord | null,
): Array<{ label: string; url: string }> {
  const links: Array<{ label: string; url: string }> = [];

  const register = (label: string, value: unknown) => {
    const url = normalizeExternalUrl(readString(value));
    if (!url) return;
    if (links.some(item => item.url.toLowerCase() === url.toLowerCase()))
      return;
    links.push({ label, url });
  };

  register('Portfolio', root?.portfolio_url);
  register('Portfolio', root?.portfolio);
  register('Website', root?.website);
  register('LinkedIn', root?.linkedin);
  register('LinkedIn', root?.linkedin_url);
  register('GitHub', root?.github);
  register('GitHub', root?.github_url);

  return links;
}

function buildProfileDetail(
  profile: PublicUserProfile,
  localeCode: 'id' | 'en',
): ProfileDetail {
  const freelancer = asRecord(profile.freelancer_profile);
  const provider = asRecord(profile.provider_profile);
  const buyer = asRecord(profile.buyer_profile);
  const displayName =
    readString(profile.full_name) ||
    readString(profile.username) ||
    'Lajukan member';
  const headline =
    readString(freelancer?.professional_title) ||
    readString(freelancer?.tagline) ||
    readString(provider?.headline) ||
    readString(profile.headline) ||
    readString(profile.level) ||
    (localeCode === 'id' ? 'Profil publik Lajukan' : 'Public Lajukan profile');
  const summary =
    readString(freelancer?.bio) ||
    readString(provider?.summary) ||
    readString(provider?.bio) ||
    readString(profile.bio) ||
    readString(buyer?.intent) ||
    (localeCode === 'id'
      ? 'Pengguna ini belum menambahkan ringkasan publik.'
      : 'This user has not added a public summary yet.');

  const roles = dedupeStrings([
    ...(Array.isArray(profile.roles) ? profile.roles : []),
    ...toStringList(profile.metadata_roles),
  ]);

  const skills = dedupeStrings([
    ...toStringList(freelancer?.skills),
    ...toStringList(provider?.skills),
  ]);

  const languages = dedupeStrings([
    ...toStringList(freelancer?.languages),
    ...toStringList(provider?.languages),
  ]);

  const experience = dedupeStrings([
    ...toStringList(freelancer?.experience),
    ...toStringList(freelancer?.work_history),
    ...toStringList(provider?.experience),
  ]);

  const education = dedupeStrings([
    ...toStringList(freelancer?.education),
    ...toStringList(provider?.education),
  ]);

  const certifications = dedupeStrings([
    ...toStringList(freelancer?.certifications),
    ...toStringList(freelancer?.certificates),
    ...toStringList(provider?.certifications),
  ]);

  const links = [...collectLinks(freelancer), ...collectLinks(provider)].filter(
    (item, index, list) =>
      list.findIndex(
        entry => entry.url.toLowerCase() === item.url.toLowerCase(),
      ) === index,
  );

  const verificationBadges = [
    profile.identity_verified
      ? localeCode === 'id'
        ? 'Identitas terverifikasi'
        : 'Identity verified'
      : '',
    !PROMO_ONLY_MODE && profile.transaction_eligible
      ? localeCode === 'id'
        ? 'Siap transaksi'
        : 'Transaction ready'
      : '',
    profile.email_verified ? 'Email verified' : '',
    profile.phone_verified ? 'Phone verified' : '',
  ].filter(Boolean);

  return {
    displayName,
    headline,
    summary,
    roles,
    skills,
    languages,
    experience,
    education,
    certifications,
    links,
    verificationBadges,
  };
}

function formatShortDate(
  value: string | undefined,
  localeCode: 'id' | 'en',
): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(localeCode === 'id' ? 'id-ID' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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
  return typeof item.price_cents === 'number' && item.price_cents > 0
    ? formatIDRFromCents(item.price_cents)
    : localeCode === 'id'
      ? 'Negosiasi'
      : 'Negotiable';
}

function getPublicListingKindLabel(
  item: PublicListing,
  localeCode: 'id' | 'en',
): string {
  const tab = normalizeProfileContentTab({
    type: item.content_type,
    category: item.category,
    metadata: item.metadata || null,
  });
  return getProfileContentTabLabel(tab, localeCode);
}

function getListingLocation(item: PublicListing): string {
  const meta = item.metadata || {};
  return (
    readString(meta.location) ||
    readString(meta.city) ||
    readString(meta.region) ||
    readString(meta.address)
  );
}

function buildPublicListingChatQuestion(
  item: PublicListing,
  displayName: string,
  localeCode: 'id' | 'en',
): string {
  const title =
    readString(item.title) ||
    (localeCode === 'id' ? 'penawaran ini' : 'this listing');
  const kind = normalizeProfileContentTab({
    type: item.content_type,
    category: item.category,
    metadata: item.metadata || null,
  });
  const greeting =
    localeCode === 'id' ? `Halo ${displayName},` : `Hi ${displayName},`;

  if (kind === 'product') {
    return localeCode === 'id'
      ? `${greeting} ${title} masih tersedia? Boleh info stok, MOQ, dan cara kirimnya?`
      : `${greeting} is ${title} still available? Could you share stock, MOQ, and delivery details?`;
  }

  if (kind === 'service' || kind === 'freelancer') {
    return localeCode === 'id'
      ? `${greeting} saya tertarik dengan ${title}. Boleh tanya paket, harga, jadwal, dan output yang didapat?`
      : `${greeting} I am interested in ${title}. Could you share packages, price, schedule, and deliverables?`;
  }

  if (kind === 'tool_rental') {
    return localeCode === 'id'
      ? `${greeting} saya tertarik sewa ${title}. Jadwal ready, deposit, dan cara ambilnya gimana?`
      : `${greeting} I am interested in renting ${title}. What is the availability, deposit, and pickup flow?`;
  }

  if (kind === 'property') {
    return localeCode === 'id'
      ? `${greeting} saya tertarik lokasi ${title}. Bisa tanya harga, jadwal survey, dan fasilitasnya?`
      : `${greeting} I am interested in ${title}. Could I ask about price, viewing schedule, and facilities?`;
  }

  return localeCode === 'id'
    ? `${greeting} saya tertarik dengan ${title}. Boleh tanya detailnya dulu?`
    : `${greeting} I am interested in ${title}. Could I ask for the details first?`;
}

function buildPublicListingChatPayload(
  item: PublicListing,
  profile: PublicUserProfile,
  localeCode: 'id' | 'en',
): Record<string, unknown> {
  const meta = item.metadata || {};
  const href = buildPublicListingHref(item);
  const kind = normalizeProfileContentTab({
    type: item.content_type,
    category: item.category,
    metadata: meta,
  });

  return {
    source: 'public_profile_listing_chat',
    snapshot_at: new Date().toISOString(),
    content_id: item.id,
    content_title:
      readString(item.title) ||
      (localeCode === 'id' ? 'Listing tanpa judul' : 'Untitled listing'),
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
      readString(meta.market_side) ||
      readString(meta.listing_side) ||
      readString(meta.listingSide) ||
      'supply',
    deal_kind: item.content_type || item.category || kind,
    slug: item.slug || null,
    content_url: href,
    owner_id: profile.id,
    owner_name: profile.full_name || profile.username || profile.id,
    location: getListingLocation(item),
  };
}

function normalizeComparableName(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function profileNameCandidates(profile: PublicUserProfile): string[] {
  return Array.from(
    new Set(
      [profile.id, profile.username, profile.full_name]
        .map(item => normalizeComparableName(item))
        .filter(Boolean),
    ),
  );
}

function isImageMediaUrl(value?: string | null): boolean {
  const lower = (value || '').split('?')[0]?.toLowerCase() || '';
  return /\.(avif|gif|jpe?g|png|webp)$/.test(lower);
}

function matchesPublicProfileReel(
  reel: LajukanReel,
  profile: PublicUserProfile,
): boolean {
  if (reel.creatorUserId && reel.creatorUserId === profile.id) return true;
  const candidates = profileNameCandidates(profile);
  const creator = normalizeComparableName(reel.creator);
  return Boolean(creator && candidates.includes(creator));
}

function matchesPublicProfileCommunityItem(
  item: CommunityFeedItem,
  profile: PublicUserProfile,
): boolean {
  if (item.author?.id && item.author.id === profile.id) return true;
  const candidates = profileNameCandidates(profile);
  const author = normalizeComparableName(item.author?.name);
  return Boolean(author && candidates.includes(author));
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
  };
  return (Array.isArray(payload.data) ? payload.data : [])
    .map(item => normalizePublicUserProfile(item))
    .filter((item): item is PublicUserProfile => Boolean(item));
}

function PublicProfileLoadingState({
  localeCode,
}: {
  localeCode: 'id' | 'en';
}) {
  return (
    <div className="lajukan-market-page lajukan-market-profile min-h-screen bg-[color:var(--app-surface-muted)] pb-6 pt-0 dark:bg-[color:var(--app-surface)]">
      <DetailMobileTopBar
        title={localeCode === 'id' ? 'Memuat profil' : 'Loading profile'}
        eyebrow={localeCode === 'id' ? 'Profil publik' : 'Public profile'}
        backLabel={localeCode === 'id' ? 'Kembali' : 'Back'}
      />
      <div className="mx-auto flex w-full max-w-[1220px] flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
        <section className="overflow-hidden rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_24px_52px_-38px_rgba(15,23,42,0.42)] dark:border-[color:var(--app-border-strong)]">
          <div className="relative h-36 bg-[linear-gradient(135deg,#dcfce7_0%,#ecfeff_52%,#fef3c7_100%)] sm:h-44 lg:h-52">
            <div className="absolute left-5 top-5 h-7 w-36 rounded-full bg-white/48" />
            <div className="absolute left-5 top-16 h-8 w-[min(420px,70%)] rounded-full bg-white/42" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[color:var(--app-surface-strong)] to-transparent" />
          </div>
          <div className="px-4 pb-4 sm:px-5">
            <div className="-mt-12 grid gap-3 sm:-mt-14 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
              <div className="flex items-end gap-3 sm:gap-4">
                <div className="ui-skeleton ui-skeleton-pulse h-24 w-24 rounded-[26px] border-[4px] border-[color:var(--app-surface-strong)] sm:h-28 sm:w-28" />
                <div className="min-w-0 flex-1 pb-2">
                  <div className="ui-skeleton ui-skeleton-pulse h-7 max-w-[320px] rounded-full" />
                  <div className="ui-skeleton ui-skeleton-pulse mt-3 h-4 max-w-[520px] rounded-full" />
                  <div className="ui-skeleton ui-skeleton-pulse mt-2 h-4 max-w-[280px] rounded-full" />
                </div>
              </div>
              <div className="rounded-[24px] border border-[color:var(--app-border)] bg-white/80 p-3 dark:border-[color:var(--app-border-strong)] dark:bg-white/8">
                <div className="ui-skeleton ui-skeleton-pulse h-4 w-28 rounded-full" />
                <div className="ui-skeleton ui-skeleton-pulse mt-3 h-10 rounded-[14px]" />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="ui-skeleton ui-skeleton-pulse h-10 rounded-[14px]" />
                  <div className="ui-skeleton ui-skeleton-pulse h-10 rounded-[14px]" />
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
                >
                  <div className="ui-skeleton ui-skeleton-pulse h-4 w-20 rounded-full" />
                  <div className="ui-skeleton ui-skeleton-pulse mt-3 h-5 w-32 rounded-full" />
                  <div className="ui-skeleton ui-skeleton-pulse mt-2 h-3 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function PublicProfileClient({
  locale,
  slug,
}: PublicProfileClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, authFetch } = useAuth();
  const localeCode = locale === 'id' ? 'id' : 'en';
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [profileReels, setProfileReels] = useState<LajukanReel[]>([]);
  const [profileCommunityItems, setProfileCommunityItems] = useState<
    CommunityFeedItem[]
  >([]);
  const [profileActivityLoading, setProfileActivityLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeContentTab, setActiveContentTab] =
    useState<ProfileContentTab>('all');
  const [activeProfileTab, setActiveProfileTab] =
    useState<PublicProfileTab>('ringkas');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followedSocialIds, setFollowedSocialIds] = useState<string[]>([]);
  const [socialModal, setSocialModal] = useState<PublicSocialModal | null>(
    null,
  );
  const [socialUsers, setSocialUsers] = useState<PublicSocialUser[]>([]);
  const [shareMessage, setShareMessage] = useState('');
  const [startingChatKey, setStartingChatKey] = useState<string | null>(null);
  const [profileChatError, setProfileChatError] = useState('');
  const trackedProfileViewRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);
      setProfileReels([]);
      setProfileCommunityItems([]);

      try {
        let nextProfile: PublicUserProfile | null = null;
        const directId = extractPublicProfileIdFromSlug(slug);

        if (directId) {
          nextProfile = await fetchProfileById(directId, controller.signal);
        }

        if (!nextProfile) {
          const decodedSlug = decodePublicProfileSlug(slug);
          const slugHandle = decodedSlug.replace(/--.+$/, '').trim();
          const searchTerm = slugHandle.replace(/-/g, ' ').trim();

          if (!slugHandle && !searchTerm) {
            setNotFound(true);
            setProfile(null);
            setListings([]);
            return;
          }

          const directSlugProfile = slugHandle
            ? await fetchProfileById(slugHandle, controller.signal)
            : null;

          const searchVariants = Array.from(
            new Set(
              [searchTerm, slugHandle, slugHandle.replace(/-/g, '_')]
                .map(item => item.trim())
                .filter(Boolean),
            ),
          );
          let candidate =
            directSlugProfile &&
            matchesPublicProfileSlug(slug, directSlugProfile)
              ? directSlugProfile
              : null;

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
            setProfile(null);
            setListings([]);
            return;
          }

          nextProfile =
            (await fetchProfileById(candidate.id, controller.signal)) ||
            candidate;
        }

        if (!nextProfile) {
          setNotFound(true);
          setProfile(null);
          setListings([]);
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

        setProfile(nextProfile);

        const listingResponse = await fetch(
          `/api/content?owner_id=${encodeURIComponent(nextProfile.id)}&limit=36&status=active`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        );

        const listingPayload = await listingResponse.json().catch(() => ({}));
        const nextListings = extractContentItems(listingPayload).map(item => ({
          id: item.id,
          slug: item.slug,
          title: item.title,
          summary: item.summary,
          content_type: item.content_type,
          category: item.category,
          metadata: item.metadata || null,
          cover_image: item.cover_image,
          price_cents: item.price_cents,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));

        setListings(nextListings);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load profile');
        setProfile(null);
        setListings([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => controller.abort();
  }, [router, slug]);

  useEffect(() => {
    if (!profile || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(PUBLIC_PROFILE_FOLLOW_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed)
        ? parsed.map(item => String(item)).filter(Boolean)
        : [];
      setFollowedSocialIds(ids);
      setIsFollowing(ids.includes(profile.id));
    } catch {
      setFollowedSocialIds([]);
      setIsFollowing(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const controller = new AbortController();
    const profileId = profile.id;

    async function loadSocialUsers() {
      try {
        const response = await fetch('/api/users/discover?limit=16', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as {
          data?: unknown[];
        };
        const users = Array.isArray(payload.data)
          ? payload.data
              .map(item => normalizePublicUserProfile(item))
              .filter((item): item is PublicUserProfile => Boolean(item))
              .filter(item => item.id !== profileId)
              .map(item => mapProfileToSocialUser(item, localeCode))
          : [];
        if (!controller.signal.aborted) {
          setSocialUsers(users);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSocialUsers([]);
        }
      }
    }

    void loadSocialUsers();

    return () => controller.abort();
  }, [localeCode, profile]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const controller = new AbortController();
    const activeProfile = profile;

    async function loadPublicActivity() {
      setProfileActivityLoading(true);
      try {
        const [reelsResponse, communityResponse] = await Promise.all([
          fetch('/api/reels?limit=36', {
            cache: 'no-store',
            signal: controller.signal,
          }),
          fetch('/api/community/feed?limit=36&tab=for-you', {
            cache: 'no-store',
            signal: controller.signal,
          }),
        ]);

        const [reelsPayload, communityPayload] = await Promise.all([
          reelsResponse.json().catch(() => ({})),
          communityResponse.json().catch(() => ({})),
        ]);

        if (controller.signal.aborted) return;

        const nextReels = Array.isArray(
          (reelsPayload as PublicProfileActivityPayload<LajukanReel>).items,
        )
          ? (reelsPayload as PublicProfileActivityPayload<LajukanReel>)
              .items!.filter(item =>
                matchesPublicProfileReel(item, activeProfile),
              )
              .slice(0, 6)
          : [];
        const nextCommunityItems = Array.isArray(
          (communityPayload as PublicProfileActivityPayload<CommunityFeedItem>)
            .items,
        )
          ? (
              communityPayload as PublicProfileActivityPayload<CommunityFeedItem>
            )
              .items!.filter(item =>
                matchesPublicProfileCommunityItem(item, activeProfile),
              )
              .slice(0, 6)
          : [];

        setProfileReels(nextReels);
        setProfileCommunityItems(nextCommunityItems);
      } catch {
        if (!controller.signal.aborted) {
          setProfileReels([]);
          setProfileCommunityItems([]);
        }
      } finally {
        if (!controller.signal.aborted) setProfileActivityLoading(false);
      }
    }

    void loadPublicActivity();
    return () => controller.abort();
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
        target_href:
          pathname || `/profile/${slug}`,
        profile_slug: slug,
        actor_user_id: user.id,
        actor_username: user.username || '',
        actor_name: user.name || user.fullName || user.username || '',
        actor_avatar_url: user.avatarUrl || user.avatar_url || '',
        source: 'public_profile',
      },
    });
  }, [pathname, profile?.full_name, profile?.id, profile?.username, slug, user?.avatarUrl, user?.avatar_url, user?.fullName, user?.id, user?.name, user?.username]);

  const detail = useMemo(
    () => (profile ? buildProfileDetail(profile, localeCode) : null),
    [localeCode, profile],
  );

  if (loading) return <PublicProfileLoadingState localeCode={localeCode} />;

  if (notFound) {
    return (
      <div className="lajukan-market-page lajukan-market-profile min-h-screen bg-[color:var(--app-surface-muted)] pb-6">
        <DetailMobileTopBar
          title={
            localeCode === 'id' ? 'Profil tidak ditemukan' : 'Profile not found'
          }
          eyebrow={localeCode === 'id' ? 'Profil publik' : 'Public profile'}
          backLabel={localeCode === 'id' ? 'Kembali' : 'Back'}
        />
        <div className="page-shell px-4 py-6">
          <div className="rounded-[2rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-8 text-center shadow-sm dark:border-[color:var(--app-border-strong)]">
            <h1 className="text-2xl font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {localeCode === 'id'
                ? 'Profil tidak ditemukan'
                : 'Profile not found'}
            </h1>
            <p className="mt-3 text-sm text-[color:var(--app-text-soft)]">
              {localeCode === 'id'
                ? 'Profil publik ini belum tersedia atau slug-nya tidak cocok.'
                : 'This public profile is not available or the slug does not match.'}
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Link
                href="/search?type=freelancer"
                className="rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--app-text-inverse)]"
              >
                {localeCode === 'id' ? 'Cari talent lain' : 'Find more talent'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile || !detail) {
    return (
      <div className="lajukan-market-page lajukan-market-profile min-h-screen bg-[color:var(--app-surface-muted)] pb-6">
        <DetailMobileTopBar
          title={
            localeCode === 'id'
              ? 'Gagal memuat profil'
              : 'Failed to load profile'
          }
          eyebrow={localeCode === 'id' ? 'Profil publik' : 'Public profile'}
          backLabel={localeCode === 'id' ? 'Kembali' : 'Back'}
        />
        <div className="page-shell px-4 py-6">
          <div className="rounded-[2rem] border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] p-6 text-center">
            <h1 className="text-xl font-bold text-[color:var(--app-text)]">
              {localeCode === 'id'
                ? 'Gagal memuat profil'
                : 'Failed to load profile'}
            </h1>
            <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
              {error || 'Unknown error'}
            </p>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--app-warning-border)] bg-[color:var(--app-surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--app-text)]"
            >
              <RefreshCcw className="h-4 w-4" />
              {localeCode === 'id' ? 'Coba lagi' : 'Retry'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const avatarUrl = profileAvatarSrc(
    profile.avatar_url,
    readProfileAvatarStyle(profile),
    profile.full_name || profile.username || 'Lajukan avatar',
  );
  const numberLocale = localeCode === 'id' ? 'id-ID' : 'en-US';
  const publicActivityCount =
    profileReels.length + profileCommunityItems.length;
  const publicContentCount = listings.length + publicActivityCount;
  const profileReady =
    detail.summary.length > 70 ||
    detail.skills.length > 0 ||
    listings.length > 0 ||
    publicActivityCount > 0;
  const trustItems = PROMO_ONLY_MODE
    ? [
        {
          label: localeCode === 'id' ? 'Identitas' : 'Identity',
          ready: Boolean(profile.identity_verified),
        },
        { label: 'Email', ready: Boolean(profile.email_verified) },
        {
          label: localeCode === 'id' ? 'Telepon' : 'Phone',
          ready: Boolean(profile.phone_verified),
        },
        {
          label: localeCode === 'id' ? 'Profil lengkap' : 'Profile ready',
          ready: profileReady,
        },
      ]
    : [
        {
          label: localeCode === 'id' ? 'Identitas' : 'Identity',
          ready: Boolean(profile.identity_verified),
        },
        {
          label: localeCode === 'id' ? 'Transaksi' : 'Transaction',
          ready: Boolean(profile.transaction_eligible),
        },
        { label: 'Email', ready: Boolean(profile.email_verified) },
        {
          label: localeCode === 'id' ? 'Telepon' : 'Phone',
          ready: Boolean(profile.phone_verified),
        },
      ];
  const trustScore = trustItems.filter(item => item.ready).length;
  const trustScoreLabel = `${trustScore}/${trustItems.length}`;
  const statCards = [
    {
      label: localeCode === 'id' ? 'Rating' : 'Rating',
      value:
        typeof profile.rating === 'number' && profile.rating > 0
          ? profile.rating.toFixed(1)
          : '-',
      icon: Star,
    },
    {
      label: PROMO_ONLY_MODE
        ? localeCode === 'id'
          ? 'Konten publik'
          : 'Public content'
        : localeCode === 'id'
          ? 'Job selesai'
          : 'Completed jobs',
      value: PROMO_ONLY_MODE
        ? publicContentCount.toLocaleString(numberLocale)
        : typeof profile.completed_jobs === 'number'
          ? profile.completed_jobs.toLocaleString(numberLocale)
          : '0',
      icon: PROMO_ONLY_MODE ? Sparkles : Award,
    },
    {
      label: PROMO_ONLY_MODE
        ? localeCode === 'id'
          ? 'Cara kontak'
          : 'Contact'
        : localeCode === 'id'
          ? 'Rate mulai'
          : 'Starting rate',
      value: PROMO_ONLY_MODE
        ? localeCode === 'id'
          ? 'Chat dulu'
          : 'Chat first'
        : typeof profile.hourly_rate === 'number' && profile.hourly_rate > 0
          ? formatIDRFromCents(profile.hourly_rate * 100)
          : localeCode === 'id'
            ? 'Negosiasi'
            : 'Negotiable',
      icon: PROMO_ONLY_MODE ? MessageCircle : Sparkles,
    },
    {
      label: 'Trust',
      value: trustScoreLabel,
      icon: ShieldCheck,
    },
  ];

  const listingGroups = listings.reduce<
    Record<ProfileLeafTab, PublicListing[]>
  >(
    (acc, item) => {
      const key = normalizeProfileContentTab({
        type: item.content_type,
        category: item.category,
        metadata: item.metadata || null,
      });
      acc[key].push(item);
      return acc;
    },
    {
      job: [],
      freelancer: [],
      product: [],
      service: [],
      tool_rental: [],
      business_transfer: [],
      property: [],
      umkm: [],
    },
  );

  const availableTabs = (
    [
      'all',
      ...Object.entries(listingGroups)
        .filter(([, items]) => items.length > 0)
        .map(([key]) => key as ProfileLeafTab),
    ] as ProfileContentTab[]
  ).filter((tab, index, list) => list.indexOf(tab) === index);

  const resolvedActiveContentTab = availableTabs.includes(activeContentTab)
    ? activeContentTab
    : 'all';

  const activeListingItems =
    resolvedActiveContentTab === 'all'
      ? listings
      : listingGroups[resolvedActiveContentTab];
  const previewListingItems = activeListingItems.slice(0, 4);
  const featuredListing = listings[0] || null;
  const buyerOfferItems = listings.slice(0, 6);
  const profileShellClass =
    'mx-auto flex w-full max-w-[1220px] flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:px-6';
  const profileSectionClass =
    'rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3.5 py-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.32)] dark:border-[color:var(--app-border-strong)] sm:rounded-[22px] sm:p-4';
  const profileTileClass =
    'rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_14px_26px_-26px_rgba(15,23,42,0.26)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)] sm:rounded-[20px]';
  const profileRowClass =
    'rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3.5 py-3 shadow-none dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]';
  const profilePrimaryActionClass =
    'inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[14px] bg-[color:var(--app-accent)] px-4 py-2.5 text-sm font-bold text-[color:var(--app-text-inverse)] shadow-[0_18px_30px_-22px_rgba(22,163,74,0.55)] transition hover:bg-[color:var(--app-accent-strong)]';
  const inviteHref = featuredListing
    ? buildPublicListingHref(featuredListing)
    : `/search?q=${encodeURIComponent(detail.displayName)}`;
  const defaultChatDraft =
    localeCode === 'id'
      ? `Halo ${detail.displayName}, saya tertarik dengan profil Anda.`
      : `Hi ${detail.displayName}, I am interested in your profile.`;
  const profileTabs: Array<{
    key: PublicProfileTab;
    label: string;
    icon: typeof Sparkles;
  }> = [
    {
      key: 'ringkas',
      label: localeCode === 'id' ? 'Tentang' : 'About',
      icon: Sparkles,
    },
    {
      key: 'etalase',
      label: localeCode === 'id' ? 'Karya' : 'Work',
      icon: Store,
    },
    { key: 'reels', label: 'Reels', icon: Clapperboard },
    {
      key: 'komunitas',
      label: localeCode === 'id' ? 'Aktivitas' : 'Activity',
      icon: Users,
    },
    { key: 'trust', label: 'Trust', icon: ShieldCheck },
  ];
  const followerCount =
    Math.max(
      socialUsers.length +
        listings.length * 2 +
        (profile.identity_verified ? 8 : 3),
      typeof profile.completed_jobs === 'number' ? profile.completed_jobs : 0,
    ) + (isFollowing ? 1 : 0);
  const followingCount = Math.max(
    1,
    Math.min(99, Math.ceil(socialUsers.length / 2) + detail.roles.length),
  );
  const socialModalUsers =
    socialModal === 'followers'
      ? socialUsers.slice(0, 10)
      : socialUsers.slice().reverse().slice(0, 10);
  const capabilityIconByTab: Record<ProfileLeafTab, typeof Sparkles> = {
    job: BriefcaseBusiness,
    freelancer: Award,
    product: Store,
    service: Sparkles,
    tool_rental: Clock3,
    business_transfer: Store,
    property: MapPin,
    umkm: Store,
  };
  const capabilityLabelByTab: Record<ProfileLeafTab, string> = {
    job: localeCode === 'id' ? 'Merekrut talent' : 'Hiring talent',
    freelancer: localeCode === 'id' ? 'Profil talent' : 'Talent profile',
    product: localeCode === 'id' ? 'Menjual produk' : 'Selling products',
    service: localeCode === 'id' ? 'Menyediakan jasa' : 'Offering services',
    tool_rental:
      localeCode === 'id'
        ? 'Sewa alat/inventaris'
        : 'Tool and inventory rental',
    business_transfer: localeCode === 'id' ? 'Oper usaha' : 'Business transfer',
    property: localeCode === 'id' ? 'Properti/lokasi' : 'Property/spaces',
    umkm: localeCode === 'id' ? 'Toko UMKM' : 'UMKM store',
  };
  const capabilityHelperByTab: Record<ProfileLeafTab, string> = {
    job:
      localeCode === 'id'
        ? 'Lowongan dan kebutuhan tim yang sedang dibuka.'
        : 'Open jobs and team needs.',
    freelancer:
      localeCode === 'id'
        ? 'Skill, pengalaman, dan portofolio yang bisa dinilai cepat.'
        : 'Skills, experience, and portfolio visitors can scan quickly.',
    product:
      localeCode === 'id'
        ? 'Produk atau stok yang bisa langsung dicek.'
        : 'Products or stock visitors can inspect.',
    service:
      localeCode === 'id'
        ? 'Layanan yang bisa diajak kerja sama.'
        : 'Services available for collaboration.',
    tool_rental:
      localeCode === 'id'
        ? 'Alat atau perlengkapan yang bisa disewa.'
        : 'Tools or equipment available to rent.',
    business_transfer:
      localeCode === 'id'
        ? 'Usaha berjalan yang bisa dilihat peluangnya.'
        : 'Running businesses visitors can evaluate.',
    property:
      localeCode === 'id'
        ? 'Ruang, ruko, kios, atau aset lokasi.'
        : 'Spaces, shops, kiosks, or location assets.',
    umkm:
      localeCode === 'id'
        ? 'Toko dan operasional usaha yang terhubung.'
        : 'Connected store and business operations.',
  };
  const listingCapabilityCards = (
    Object.entries(listingGroups) as Array<[ProfileLeafTab, PublicListing[]]>
  )
    .filter(([, items]) => items.length > 0)
    .map(([tab, items]) => {
      const Icon = capabilityIconByTab[tab];
      const preview = items
        .slice(0, 3)
        .map(item => readString(item.title))
        .filter(Boolean)
        .join(' / ');

      return {
        key: tab,
        label: capabilityLabelByTab[tab],
        helper: capabilityHelperByTab[tab],
        meta:
          localeCode === 'id'
            ? `${items.length.toLocaleString(numberLocale)} aktif`
            : `${items.length.toLocaleString(numberLocale)} active`,
        preview,
        icon: Icon,
        onSelect: () => {
          setActiveProfileTab('etalase');
          setActiveContentTab(tab);
        },
      };
    });
  const capabilityCards: Array<{
    key: string;
    label: string;
    helper: string;
    meta: string;
    preview: string;
    icon: typeof Sparkles;
    onSelect: () => void;
  }> = [
    ...(detail.roles.length > 0
      ? [
          {
            key: 'roles',
            label: localeCode === 'id' ? 'Mode profil' : 'Profile modes',
            helper:
              localeCode === 'id'
                ? 'Peran utama yang dipakai di Lajukan.'
                : 'Primary roles used on Lajukan.',
            meta:
              localeCode === 'id'
                ? `${detail.roles.length.toLocaleString(numberLocale)} peran`
                : `${detail.roles.length.toLocaleString(numberLocale)} roles`,
            preview: detail.roles.slice(0, 4).map(formatRole).join(' / '),
            icon: ShieldCheck,
            onSelect: () => setActiveProfileTab('ringkas'),
          },
        ]
      : []),
    ...listingCapabilityCards,
    ...(detail.skills.length > 0
      ? [
          {
            key: 'skills',
            label: localeCode === 'id' ? 'Skill inti' : 'Core skills',
            helper:
              localeCode === 'id'
                ? 'Keahlian yang paling cepat dinilai pengunjung.'
                : 'Skills visitors can evaluate quickly.',
            meta:
              localeCode === 'id'
                ? `${detail.skills.length.toLocaleString(numberLocale)} skill`
                : `${detail.skills.length.toLocaleString(numberLocale)} skills`,
            preview: detail.skills.slice(0, 5).join(' / '),
            icon: Sparkles,
            onSelect: () => setActiveProfileTab('ringkas'),
          },
        ]
      : []),
    ...(profileReels.length > 0
      ? [
          {
            key: 'reels',
            label: 'Reels',
            helper:
              localeCode === 'id'
                ? 'Bukti aktivitas dan konten singkat.'
                : 'Short-form proof and activity.',
            meta: `${profileReels.length.toLocaleString(numberLocale)} reels`,
            preview: profileReels
              .slice(0, 3)
              .map(reel => reel.title)
              .filter(Boolean)
              .join(' / '),
            icon: Clapperboard,
            onSelect: () => setActiveProfileTab('reels'),
          },
        ]
      : []),
    ...(profileCommunityItems.length > 0
      ? [
          {
            key: 'community',
            label: localeCode === 'id' ? 'Komunitas' : 'Community',
            helper:
              localeCode === 'id'
                ? 'Diskusi dan kontribusi publik.'
                : 'Public discussions and contributions.',
            meta:
              localeCode === 'id'
                ? `${profileCommunityItems.length.toLocaleString(numberLocale)} aktivitas`
                : `${profileCommunityItems.length.toLocaleString(numberLocale)} activities`,
            preview: profileCommunityItems
              .slice(0, 3)
              .map(item => item.title)
              .filter(Boolean)
              .join(' / '),
            icon: Users,
            onSelect: () => setActiveProfileTab('komunitas'),
          },
        ]
      : []),
    {
      key: 'trust',
      label: localeCode === 'id' ? 'Siap dipercaya' : 'Trust ready',
      helper:
        localeCode === 'id'
          ? 'Status verifikasi yang membantu orang cepat yakin.'
          : 'Verification signals that help visitors trust faster.',
      meta: trustScoreLabel,
      preview:
        detail.verificationBadges.slice(0, 3).join(' / ') ||
        (localeCode === 'id'
          ? 'Verifikasi belum lengkap'
          : 'Verification is not complete yet'),
      icon: ShieldCheck,
      onSelect: () => setActiveProfileTab('trust'),
    },
  ];
  const topRoleLabel =
    detail.roles.length > 0
      ? detail.roles.slice(0, 2).map(formatRole).join(' / ')
      : localeCode === 'id'
        ? 'Member Lajukan'
        : 'Lajukan member';
  const heroQuickFacts = [
    {
      key: 'location',
      label: localeCode === 'id' ? 'Lokasi' : 'Location',
      value:
        profile.location || (localeCode === 'id' ? 'Indonesia' : 'Indonesia'),
      icon: MapPin,
    },
    {
      key: 'role',
      label: localeCode === 'id' ? 'Fokus' : 'Focus',
      value: topRoleLabel,
      icon: BriefcaseBusiness,
    },
    {
      key: 'content',
      label: localeCode === 'id' ? 'Etalase' : 'Showcase',
      value:
        publicContentCount > 0
          ? localeCode === 'id'
            ? `${publicContentCount.toLocaleString(numberLocale)} konten`
            : `${publicContentCount.toLocaleString(numberLocale)} posts`
          : localeCode === 'id'
            ? 'Profil baru'
            : 'New profile',
      icon: Store,
    },
    {
      key: 'trust',
      label: 'Trust',
      value: trustScoreLabel,
      icon: ShieldCheck,
    },
  ];
  const conversationPrompts = (
    localeCode === 'id'
      ? [
          `Halo ${detail.displayName}, boleh tahu detail produk/jasa yang sedang aktif?`,
          `Halo ${detail.displayName}, saya mau tanya apakah bisa konsultasi kebutuhan dulu?`,
          `Halo ${detail.displayName}, ada katalog, contoh karya, atau info terbaru yang bisa saya lihat?`,
        ]
      : [
          `Hi ${detail.displayName}, can I ask about your active products or services?`,
          `Hi ${detail.displayName}, can we discuss my needs first?`,
          `Hi ${detail.displayName}, do you have a catalog, samples, or recent updates I can review?`,
        ]
  ).slice(0, 3);

  const handleFollowToggle = () => {
    if (typeof window === 'undefined') return;
    const nextFollowing = !isFollowing;
    try {
      const raw = window.localStorage.getItem(PUBLIC_PROFILE_FOLLOW_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed)
        ? parsed.map(item => String(item)).filter(Boolean)
        : [];
      const nextIds = nextFollowing
        ? Array.from(new Set([...ids, profile.id]))
        : ids.filter(item => item !== profile.id);
      window.localStorage.setItem(
        PUBLIC_PROFILE_FOLLOW_KEY,
        JSON.stringify(nextIds),
      );
      setFollowedSocialIds(nextIds);
    } catch {
      // Follow public profile is optimistic until backend social graph exists.
    }
    setIsFollowing(nextFollowing);
  };

  const handleSocialFollowToggle = (targetId: string) => {
    if (!targetId || targetId === profile.id) return;
    const nextIds = followedSocialIds.includes(targetId)
      ? followedSocialIds.filter(item => item !== targetId)
      : Array.from(new Set([...followedSocialIds, targetId]));
    setFollowedSocialIds(nextIds);
    try {
      window.localStorage.setItem(
        PUBLIC_PROFILE_FOLLOW_KEY,
        JSON.stringify(nextIds),
      );
    } catch {
      // Follow list is intentionally best-effort in this UI-only phase.
    }
  };

  const handleOpenChat = async (
    draft = defaultChatDraft,
    listing?: PublicListing,
  ) => {
    if (!isAuthenticated) {
      router.push(
        `/login?callbackUrl=${encodeURIComponent(pathname || `/profile/${slug}`)}`,
      );
      return;
    }
    if (user?.id && user.id === profile.id) {
      if (listing) router.push(buildPublicListingHref(listing));
      return;
    }

    const chatKey = listing?.id || 'profile';
    setStartingChatKey(chatKey);
    setProfileChatError('');

    try {
      const res = await authFetch('/api/chat/dm', {
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
      const payload = (await res.json().catch(() => ({}))) as {
        room_id?: string;
        data?: { room_id?: string };
        error?: string;
      };
      const roomId = String(
        payload.room_id || payload.data?.room_id || '',
      ).trim();
      if (!res.ok || !roomId) {
        throw new Error(
          payload.error ||
            (localeCode === 'id'
              ? 'Room chat belum bisa dibuat.'
              : 'Chat room could not be created.'),
        );
      }

      const messageText = draft.trim() || defaultChatDraft;
      if (listing) {
        const cardPayload = buildPublicListingChatPayload(
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
              attachments: [JSON.stringify(cardPayload)],
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
    } catch (err) {
      setProfileChatError(
        err instanceof Error
          ? err.message
          : localeCode === 'id'
            ? 'Gagal membuka chat.'
            : 'Failed to open chat.',
      );
    } finally {
      setStartingChatKey(null);
    }
  };

  const handleShareProfile = async () => {
    const url =
      typeof window !== 'undefined'
        ? window.location.href
        : `https://www.lajukan.com/${localeCode}/profile/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage(localeCode === 'id' ? 'Link disalin' : 'Link copied');
    } catch {
      setShareMessage(localeCode === 'id' ? 'Gagal salin' : 'Copy failed');
    }
    window.setTimeout(() => setShareMessage(''), 1600);
  };

  return (
    <div className="lajukan-market-page lajukan-market-profile min-h-screen bg-[color:var(--app-surface-muted)] pb-[calc(9rem+env(safe-area-inset-bottom))] pt-0 dark:bg-[color:var(--app-surface)] sm:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_24%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_22%),var(--app-surface-muted)] dark:sm:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_24%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_22%),var(--app-surface-strong)] lg:pb-6">
      <DetailMobileTopBar
        title={detail.displayName}
        eyebrow={localeCode === 'id' ? 'Profil publik' : 'Public profile'}
        backLabel={localeCode === 'id' ? 'Kembali' : 'Back'}
      />
      <div className={profileShellClass}>
        <section className="overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_22px_48px_-40px_rgba(15,23,42,0.38)] dark:border-[color:var(--app-border-strong)] sm:rounded-[28px]">
          <div className="relative h-24 overflow-hidden bg-[linear-gradient(135deg,#0f8f4d_0%,#0f766e_48%,#f59e0b_100%)] sm:h-32 lg:h-36">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.26),transparent_28%),radial-gradient(circle_at_82%_8%,rgba(255,255,255,0.2),transparent_20%)]" />
            <div className="absolute -right-10 -top-16 h-36 w-36 rounded-full bg-white/20 blur-2xl" />
            <div className="absolute -bottom-20 left-8 h-40 w-40 rounded-full bg-emerald-950/18 blur-2xl" />
            <div className="absolute left-3 top-3 flex max-w-[72%] flex-wrap gap-1.5 text-white sm:left-5 sm:top-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ring-1 ring-white/22 backdrop-blur sm:text-[11px]">
                <Sparkles className="h-3.5 w-3.5" />
                {publicContentCount > 0
                  ? localeCode === 'id'
                    ? 'Profil aktif'
                    : 'Active profile'
                  : localeCode === 'id'
                    ? 'Profil publik'
                    : 'Public profile'}
              </span>
            </div>
            {profile.identity_verified ? (
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/18 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white ring-1 ring-white/22 backdrop-blur sm:right-5 sm:top-5 sm:text-[11px]">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[color:var(--app-surface-strong)] via-[color:color-mix(in_srgb,var(--app-surface-strong)_68%,transparent)] to-transparent" />
          </div>

          <div className="relative px-3 pb-3.5 sm:px-5 sm:pb-5">
            <div className="-mt-10 grid gap-3 sm:-mt-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end">
              <div className="flex min-w-0 flex-1 items-end gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[22px] border-[4px] border-[color:var(--app-surface-strong)] bg-[color:var(--app-surface-muted)] shadow-xl sm:h-24 sm:w-24 sm:rounded-[26px]">
                  <Image
                    src={avatarUrl}
                    alt={detail.displayName}
                    fill
                    sizes="96px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 pb-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <h1 className="line-clamp-1 min-w-0 text-xl font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-2xl lg:text-[28px]">
                      {detail.displayName}
                    </h1>
                    <span className="inline-flex max-w-full items-center rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--app-text-soft)] dark:bg-[color:var(--app-surface)]">
                      <span className="truncate">
                        @{profile.username || profile.id.slice(0, 8)}
                      </span>
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:text-base">
                    {detail.headline}
                  </p>
                </div>
              </div>

              <div className="rounded-[20px] border border-[color:var(--app-border)] bg-white/94 p-2.5 shadow-[0_18px_34px_-32px_rgba(15,23,42,0.42)] ring-1 ring-white/70 backdrop-blur-xl dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,var(--app-surface)_92%,transparent)]">
                <div className="grid grid-cols-[minmax(0,1fr)_42px_42px] gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenChat()}
                    disabled={startingChatKey === 'profile'}
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[14px] bg-[color:var(--app-accent)] px-4 text-sm font-black text-[color:var(--app-text-inverse)] shadow-[0_16px_28px_-22px_rgba(22,163,74,0.55)] transition hover:bg-[color:var(--app-accent-strong)] disabled:cursor-wait disabled:opacity-70"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {startingChatKey === 'profile'
                      ? localeCode === 'id'
                        ? 'Membuka...'
                        : 'Opening...'
                      : localeCode === 'id'
                        ? 'Chat sekarang'
                        : 'Chat now'}
                  </button>
                  <button
                    type="button"
                    onClick={handleFollowToggle}
                    className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)] dark:text-[color:var(--app-text-soft)]"
                    aria-label={
                      isFollowing
                        ? localeCode === 'id'
                          ? 'Berhenti mengikuti'
                          : 'Unfollow'
                        : 'Follow'
                    }
                  >
                    {isFollowing ? (
                      <UserMinus className="h-4.5 w-4.5" />
                    ) : (
                      <UserPlus className="h-4.5 w-4.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleShareProfile}
                    className="inline-flex min-h-[42px] items-center justify-center rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)] dark:text-[color:var(--app-text-soft)]"
                    aria-label={
                      localeCode === 'id'
                        ? shareMessage || 'Bagikan profil'
                        : shareMessage || 'Share profile'
                    }
                  >
                    {shareMessage ? (
                      <Copy className="h-4.5 w-4.5" />
                    ) : (
                      <Share2 className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
                {profileChatError ? (
                  <p className="mt-2 rounded-[12px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-[11px] font-semibold text-[color:var(--app-danger)]">
                    {profileChatError}
                  </p>
                ) : null}
                <div className="mt-2 flex min-w-0 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {conversationPrompts.slice(0, 2).map((prompt, index) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleOpenChat(prompt)}
                      className={`min-h-[30px] max-w-full shrink-0 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-left text-[11px] font-bold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)] dark:text-[color:var(--app-text-soft)] ${index > 0 ? 'hidden sm:inline-flex' : 'inline-flex'}`}
                    >
                      <span className="max-w-[220px] truncate">
                        {prompt.replace(
                          /^Halo\s+[^,]+,\s+|^Hi\s+[^,]+,\s+/i,
                          '',
                        )}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2 rounded-[14px] bg-[color:var(--app-accent-soft)] px-3 py-2 text-[11px] font-black text-[color:var(--app-accent)]">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Trust {trustScoreLabel}</span>
                  <span className="h-1 w-1 rounded-full bg-current opacity-50" />
                  <span>
                    {localeCode === 'id' ? 'Chat dulu' : 'Chat first'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {heroQuickFacts.map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.key}
                    className="min-w-0 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2.5 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[12px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 leading-none">
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
                          {item.label}
                        </p>
                        <p className="mt-1 truncate text-xs font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-sm">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {detail.summary ? (
              <p className="mt-3 line-clamp-2 max-w-4xl text-sm leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {detail.summary}
              </p>
            ) : null}

            <div className="mt-3 hidden grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setSocialModal('followers')}
                className={`${profileRowClass} text-left transition hover:border-[color:var(--app-accent-border)]`}
              >
                <span className="block text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {followerCount.toLocaleString(
                    localeCode === 'id' ? 'id-ID' : 'en-US',
                  )}
                </span>
                <span className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  {localeCode === 'id' ? 'Pengikut' : 'Followers'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSocialModal('following')}
                className={`${profileRowClass} text-left transition hover:border-[color:var(--app-accent-border)]`}
              >
                <span className="block text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {followingCount.toLocaleString(
                    localeCode === 'id' ? 'id-ID' : 'en-US',
                  )}
                </span>
                <span className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  {localeCode === 'id' ? 'Mengikuti' : 'Following'}
                </span>
              </button>
              <Link
                href={inviteHref}
                className={`${profileRowClass} text-left transition hover:border-[color:var(--app-accent-border)]`}
              >
                <span className="block text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {listings.length.toLocaleString(
                    localeCode === 'id' ? 'id-ID' : 'en-US',
                  )}
                </span>
                <span className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  {localeCode === 'id' ? 'Karya' : 'Work'}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setActiveProfileTab('trust')}
                className={`${profileRowClass} text-left transition hover:border-[color:var(--app-accent-border)]`}
              >
                <span className="block text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {trustScoreLabel}
                </span>
                <span className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  Trust
                </span>
              </button>
            </div>
          </div>
        </section>

        {buyerOfferItems.length > 0 ? (
          <section className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.28)] dark:border-[color:var(--app-border-strong)] sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                  {localeCode === 'id' ? 'Penawaran aktif' : 'Active offers'}
                </p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-xl">
                  {localeCode === 'id'
                    ? 'Langsung pilih yang mau ditanya'
                    : 'Pick what you want to ask about'}
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
                  {localeCode === 'id'
                    ? 'Produk, jasa, mentor, tools, atau lokasi yang aktif. Klik chat supaya konteksnya otomatis masuk ke room.'
                    : 'Active products, services, mentoring, tools, or spaces. Chat will carry the item context into the room.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveProfileTab('etalase');
                  setActiveContentTab('all');
                }}
                className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3.5 text-sm font-bold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
              >
                <Store className="h-4 w-4" />
                {localeCode === 'id' ? 'Lihat semua' : 'View all'}
              </button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {buyerOfferItems.map(item => {
                const href = buildPublicListingHref(item);
                const imageSrc =
                  normalizeContentMediaUrl(item.cover_image || '') ||
                  '/default-avatar.svg';
                const kindLabel = getPublicListingKindLabel(item, localeCode);
                const location = getListingLocation(item);
                const question = buildPublicListingChatQuestion(
                  item,
                  detail.displayName,
                  localeCode,
                );
                const isStarting = startingChatKey === item.id;

                return (
                  <article
                    key={item.id}
                    className="group overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] shadow-[0_14px_30px_-28px_rgba(15,23,42,0.36)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
                  >
                    <Link href={href} className="block">
                      <div className="relative aspect-[4/3] overflow-hidden bg-[color:var(--app-surface)]">
                        <Image
                          src={imageSrc}
                          alt={item.title || 'Listing'}
                          fill
                          sizes="(max-width: 640px) 100vw, 33vw"
                          className="object-cover transition duration-300 group-hover:scale-[1.03]"
                          unoptimized
                        />
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-black text-[color:var(--app-accent)] shadow-sm backdrop-blur">
                          <PackageCheck className="h-3.5 w-3.5" />
                          {kindLabel}
                        </span>
                      </div>
                    </Link>
                    <div className="p-3">
                      <Link href={href} className="block">
                        <h3 className="line-clamp-2 text-sm font-black leading-5 text-[color:var(--app-text)] transition group-hover:text-[color:var(--app-accent)] dark:text-[color:var(--app-text-inverse)]">
                          {item.title ||
                            (localeCode === 'id'
                              ? 'Listing tanpa judul'
                              : 'Untitled listing')}
                        </h3>
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                        <span className="text-[color:var(--app-accent)]">
                          {formatPublicListingValue(item, localeCode)}
                        </span>
                        {location ? <span>{location}</span> : null}
                      </div>
                      {item.summary ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                          {item.summary}
                        </p>
                      ) : null}
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleOpenChat(question, item)}
                          disabled={isStarting}
                          className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-2 rounded-full bg-[color:var(--app-accent)] px-3 text-xs font-black text-[color:var(--app-text-inverse)] transition hover:bg-[color:var(--app-accent-strong)] disabled:cursor-wait disabled:opacity-70"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {isStarting
                            ? localeCode === 'id'
                              ? 'Membuka...'
                              : 'Opening...'
                            : localeCode === 'id'
                              ? 'Chat soal ini'
                              : 'Ask about this'}
                        </button>
                        <Link
                          href={href}
                          className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white px-3 text-xs font-black text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-strong)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]"
                        >
                          Detail
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="hidden rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2.5 dark:border-[color:var(--app-border-strong)] lg:block">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.label} className={profileTileClass}>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                        {item.label}
                      </span>
                      <p className="mt-1 truncate text-xl font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        {item.value}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                {localeCode === 'id'
                  ? 'Kemampuan profil'
                  : 'Profile capabilities'}
              </p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-xl">
                {localeCode === 'id'
                  ? 'Bisa dibantu apa?'
                  : 'What can they help with?'}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
                {localeCode === 'id'
                  ? 'Semua mode aktif diringkas jadi pilihan cepat. Buka yang relevan tanpa harus membaca seluruh profil.'
                  : 'Active modes are summarized into quick choices, so visitors can open the relevant part without reading everything.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveProfileTab('etalase');
                setActiveContentTab('all');
              }}
              className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3.5 text-sm font-bold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)] dark:text-[color:var(--app-text-soft)]"
            >
              <Store className="h-4 w-4" />
              {localeCode === 'id' ? 'Lihat semua' : 'View all'}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {capabilityCards.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onSelect}
                  className="group min-h-[132px] rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3.5 text-left shadow-[0_14px_30px_-28px_rgba(15,23,42,0.3)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.36)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] transition group-hover:bg-[color:var(--app-accent)] group-hover:text-[color:var(--app-text-inverse)]">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-black text-[color:var(--app-text-soft)] dark:bg-[color:var(--app-surface-strong)]">
                      {item.meta}
                    </span>
                  </span>
                  <span className="mt-3 block text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {item.label}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                    {item.preview || item.helper}
                  </span>
                  <span className="mt-3 inline-flex items-center text-xs font-black text-[color:var(--app-accent)]">
                    {localeCode === 'id' ? 'Buka bagian ini' : 'Open section'}
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="sticky top-[calc(52px+env(safe-area-inset-top))] z-20 overflow-x-auto rounded-[20px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,transparent)] p-2 shadow-[0_16px_34px_-32px_rgba(15,23,42,0.32)] backdrop-blur-xl dark:border-[color:var(--app-border-strong)] sm:top-[calc(60px+env(safe-area-inset-top))]">
          <div className="flex min-w-max gap-2">
            {profileTabs.map(tab => {
              const Icon = tab.icon;
              const active = activeProfileTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveProfileTab(tab.key)}
                  className={`inline-flex min-h-[40px] items-center gap-2 rounded-full px-3.5 text-sm font-black transition ${
                    active
                      ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] shadow-[0_12px_24px_-18px_rgba(22,163,74,0.56)]'
                      : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] dark:bg-[color:var(--app-surface)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        {activeProfileTab === 'ringkas' ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="space-y-3">
              <section className={profileSectionClass}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                      {localeCode === 'id'
                        ? 'Ringkasan cepat'
                        : 'Quick summary'}
                    </p>
                    <h2 className="mt-1 text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {localeCode === 'id'
                        ? 'Hal yang paling relevan'
                        : 'Most relevant signals'}
                    </h2>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-black text-[color:var(--app-accent)]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {localeCode === 'id' ? 'Aktif' : 'Active'}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {detail.summary}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {capabilityCards.slice(0, 6).map(item => (
                    <button
                      key={`quick-${item.key}`}
                      type="button"
                      onClick={item.onSelect}
                      className="inline-flex min-h-[34px] items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-xs font-bold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)] dark:text-[color:var(--app-text-soft)]"
                    >
                      {item.label}
                      <span className="text-[color:var(--app-text-soft)]">
                        {item.meta}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {detail.skills.length > 0 ? (
                <section className={profileSectionClass}>
                  <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                    {localeCode === 'id' ? 'Keahlian inti' : 'Core skills'}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detail.skills.map(skill => (
                      <span
                        key={skill}
                        className="rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-accent)]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {detail.experience.length > 0 ? (
                <section className={profileSectionClass}>
                  <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                    {localeCode === 'id' ? 'Pengalaman' : 'Experience'}
                  </h2>
                  <div className="mt-3 space-y-2.5">
                    {detail.experience.slice(0, 6).map(item => (
                      <div
                        key={item}
                        className={`${profileRowClass} text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]`}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {detail.education.length > 0 ||
              detail.certifications.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {detail.education.length > 0 ? (
                    <section className={profileSectionClass}>
                      <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                        <GraduationCap className="h-4 w-4" />
                        {localeCode === 'id' ? 'Pendidikan' : 'Education'}
                      </h2>
                      <div className="mt-3 space-y-2.5">
                        {detail.education.slice(0, 5).map(item => (
                          <div
                            key={item}
                            className="text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {detail.certifications.length > 0 ? (
                    <section className={profileSectionClass}>
                      <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                        <Award className="h-4 w-4" />
                        {localeCode === 'id' ? 'Sertifikasi' : 'Certifications'}
                      </h2>
                      <div className="mt-3 space-y-2.5">
                        {detail.certifications.slice(0, 5).map(item => (
                          <div
                            key={item}
                            className="text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              {detail.languages.length > 0 ? (
                <section className={profileSectionClass}>
                  <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                    <Languages className="h-4 w-4" />
                    {localeCode === 'id' ? 'Bahasa' : 'Languages'}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detail.languages.map(language => (
                      <span
                        key={language}
                        className="rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] dark:bg-[color:var(--app-surface)] dark:text-[color:var(--app-text-soft)] sm:border sm:border-[color:var(--app-border)] dark:sm:border-[color:var(--app-border-strong)]"
                      >
                        {language}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {detail.links.length > 0 ? (
                <section className={profileSectionClass}>
                  <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                    <Link2 className="h-4 w-4" />
                    {localeCode === 'id'
                      ? 'Link profesional'
                      : 'Professional links'}
                  </h2>
                  <div className="mt-3 space-y-2">
                    {detail.links.slice(0, 8).map(item => (
                      <a
                        key={`${item.label}-${item.url}`}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`${profileRowClass} flex items-center justify-between text-sm font-medium text-[color:var(--app-text)] transition sm:hover:border-[color:var(--app-accent-border)] sm:hover:text-[color:var(--app-accent)] dark:text-[color:var(--app-text-soft)]`}
                      >
                        <span className="truncate">{item.label}</span>
                        <ExternalLink className="h-4 w-4 shrink-0" />
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className={profileSectionClass}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                    {localeCode === 'id' ? 'Konten publik' : 'Public content'}
                  </h2>
                  {activeListingItems.length > 0 ? (
                    <Link
                      href={
                        getProfileContentTabDefinition(resolvedActiveContentTab)
                          .browseHref
                      }
                      className="text-[11px] font-semibold text-[color:var(--app-accent)]"
                    >
                      {localeCode === 'id' ? 'Lihat lebih banyak' : 'See more'}
                    </Link>
                  ) : null}
                </div>

                {availableTabs.length > 1 ? (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {availableTabs.map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveContentTab(tab)}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                          resolvedActiveContentTab === tab
                            ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                            : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]'
                        }`}
                      >
                        <span>
                          {getProfileContentTabLabel(tab, localeCode)}
                        </span>
                        <span className="rounded-full bg-[color:var(--app-surface-strong)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-muted)] dark:text-[color:var(--app-text-soft)]">
                          {tab === 'all'
                            ? listings.length
                            : listingGroups[tab].length}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {activeListingItems.length === 0 ? (
                  <p className="mt-3 text-sm text-[color:var(--app-text-soft)]">
                    {resolvedActiveContentTab === 'all'
                      ? localeCode === 'id'
                        ? 'Belum ada listing publik yang aktif.'
                        : 'No public active listings yet.'
                      : localeCode === 'id'
                        ? `${getProfileContentTabDefinition(resolvedActiveContentTab).labelId} belum tersedia di profil ini.`
                        : `${getProfileContentTabDefinition(resolvedActiveContentTab).labelEn} is not available on this profile yet.`}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    {previewListingItems.map(item => (
                      <Link
                        key={item.id}
                        href={buildPublicListingHref(item)}
                        className={`${profileRowClass} flex items-start gap-3 transition sm:hover:border-[color:var(--app-accent-border)]`}
                      >
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[color:var(--app-surface)]">
                          <Image
                            src={
                              normalizeContentMediaUrl(
                                item.cover_image || '',
                              ) || '/default-avatar.svg'
                            }
                            alt={item.title || 'Listing'}
                            fill
                            sizes="64px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                            {item.title ||
                              (localeCode === 'id'
                                ? 'Listing tanpa judul'
                                : 'Untitled listing')}
                          </p>
                          {item.summary ? (
                            <p className="mt-1 line-clamp-2 text-sm text-[color:var(--app-text-soft)]">
                              {item.summary}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--app-text-soft)]">
                            <span className="font-semibold text-[color:var(--app-accent)]">
                              {formatPublicListingValue(item, localeCode)}
                            </span>
                            <span>
                              {getProfileContentTabLabel(
                                normalizeProfileContentTab({
                                  type: item.content_type,
                                  category: item.category,
                                  metadata: item.metadata || null,
                                }),
                                localeCode,
                              )}
                            </span>
                            {item.updated_at || item.created_at ? (
                              <span>
                                {formatShortDate(
                                  item.updated_at || item.created_at,
                                  localeCode,
                                )}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : null}

        {activeProfileTab === 'etalase' ? (
          <section className={profileSectionClass}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {localeCode === 'id' ? 'Karya publik' : 'Public work'}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                  {PROMO_ONLY_MODE
                    ? localeCode === 'id'
                      ? 'Produk, jasa, postingan promosi, dan konten aktif yang bisa ditanyakan lewat chat.'
                      : 'Products, services, promo posts, and active content visitors can ask about in chat.'
                    : localeCode === 'id'
                      ? 'Listing aktif, jasa, produk, lokasi, dan peluang.'
                      : 'Active listings, services, products, places, and opportunities.'}
                </p>
              </div>
              <Link href={inviteHref} className={profilePrimaryActionClass}>
                <ExternalLink className="h-4 w-4" />
                {localeCode === 'id' ? 'Lihat detail' : 'View detail'}
              </Link>
            </div>

            {availableTabs.length > 1 ? (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {availableTabs.map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveContentTab(tab)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                      resolvedActiveContentTab === tab
                        ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                        : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]'
                    }`}
                  >
                    {getProfileContentTabLabel(tab, localeCode)}
                    <span className="rounded-full bg-[color:var(--app-surface-strong)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-muted)] dark:text-[color:var(--app-text-soft)]">
                      {tab === 'all'
                        ? listings.length
                        : listingGroups[tab].length}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {activeListingItems.length === 0 ? (
              <div className="mt-4 rounded-[18px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-6 text-center dark:border-[color:var(--app-border-strong)]">
                <BriefcaseBusiness className="mx-auto h-9 w-9 text-[color:var(--app-text-soft)]" />
                <p className="mt-3 text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {localeCode === 'id'
                    ? 'Belum ada listing publik.'
                    : 'No public listing yet.'}
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {activeListingItems.slice(0, 8).map(item => (
                  <Link
                    key={item.id}
                    href={buildPublicListingHref(item)}
                    className={`${profileRowClass} flex items-start gap-3 transition sm:hover:border-[color:var(--app-accent-border)]`}
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[color:var(--app-surface)]">
                      <Image
                        src={
                          normalizeContentMediaUrl(item.cover_image || '') ||
                          '/default-avatar.svg'
                        }
                        alt={item.title || 'Listing'}
                        fill
                        sizes="80px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        {item.title ||
                          (localeCode === 'id'
                            ? 'Listing tanpa judul'
                            : 'Untitled listing')}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[color:var(--app-accent)]">
                        {formatPublicListingValue(item, localeCode)}
                      </p>
                      {item.summary ? (
                        <p className="mt-1 line-clamp-2 text-sm text-[color:var(--app-text-soft)]">
                          {item.summary}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {activeProfileTab === 'reels' ? (
          <section className={profileSectionClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <Clapperboard className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    Reels
                  </h2>
                  <p className="text-sm text-[color:var(--app-text-soft)]">
                    {localeCode === 'id'
                      ? 'Video singkat dari creator ini, termasuk reels yang dibuat dari komunitas.'
                      : 'Short videos from this creator, including reels created from community posts.'}
                  </p>
                </div>
              </div>
              <Link
                href="/reels"
                className="hidden shrink-0 text-sm font-semibold text-[color:var(--app-accent)] sm:inline-flex"
              >
                {localeCode === 'id' ? 'Buka Reels' : 'Open Reels'}
              </Link>
            </div>
            {profileActivityLoading ? (
              <p className="mt-4 rounded-[16px] bg-[color:var(--app-surface-muted)] px-4 py-4 text-sm font-semibold text-[color:var(--app-text-soft)]">
                {localeCode === 'id'
                  ? 'Memuat reels profil...'
                  : 'Loading profile reels...'}
              </p>
            ) : profileReels.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {profileReels.map(reel => {
                  const mediaIsImage =
                    reel.mediaType === 'image' ||
                    isImageMediaUrl(reel.videoSrc);
                  return (
                    <Link
                      key={reel.id}
                      href={`/reels?reel=${encodeURIComponent(reel.id)}`}
                      className="group overflow-hidden rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]"
                    >
                      <div className="relative aspect-[9/12] overflow-hidden bg-slate-950">
                        {mediaIsImage ? (
                          <Image
                            src={reel.videoSrc || '/default-avatar.svg'}
                            alt={reel.title}
                            fill
                            sizes="(max-width: 640px) 50vw, 220px"
                            className="object-cover transition group-hover:scale-[1.03]"
                            unoptimized
                          />
                        ) : (
                          <video
                            src={reel.videoSrc}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                          />
                        )}
                        <span className="absolute left-2 top-2 rounded-full bg-black/48 px-2 py-1 text-[10px] font-black text-white backdrop-blur">
                          {reel.tag || 'Reels'}
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-2 text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                          {reel.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                          {reel.caption}
                        </p>
                        <p className="mt-2 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                          {reel.likes} suka - {reel.comments} komentar
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-[18px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-5 text-sm text-[color:var(--app-text-soft)]">
                {localeCode === 'id'
                  ? 'Belum ada reels publik dari profil ini.'
                  : 'No public reels from this profile yet.'}
              </div>
            )}
          </section>
        ) : null}

        {activeProfileTab === 'komunitas' ? (
          <section className={profileSectionClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <Users className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {localeCode === 'id' ? 'Komunitas' : 'Community'}
                  </h2>
                  <p className="text-sm text-[color:var(--app-text-soft)]">
                    {localeCode === 'id'
                      ? 'Postingan, diskusi, dan komentar publik yang terhubung ke profil ini.'
                      : 'Public posts, discussions, and comments connected to this profile.'}
                  </p>
                </div>
              </div>
              <Link
                href="/community"
                className="hidden shrink-0 text-sm font-semibold text-[color:var(--app-accent)] sm:inline-flex"
              >
                {localeCode === 'id' ? 'Lihat komunitas' : 'Open community'}
              </Link>
            </div>
            {profileActivityLoading ? (
              <p className="mt-4 rounded-[16px] bg-[color:var(--app-surface-muted)] px-4 py-4 text-sm font-semibold text-[color:var(--app-text-soft)]">
                {localeCode === 'id'
                  ? 'Memuat aktivitas komunitas...'
                  : 'Loading community activity...'}
              </p>
            ) : profileCommunityItems.length > 0 ? (
              <div className="mt-4 space-y-3">
                {profileCommunityItems.map(item => (
                  <Link
                    key={item.id}
                    href={item.href || '/community'}
                    className={`${profileRowClass} block transition sm:hover:border-[color:var(--app-accent-border)]`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                          {item.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                          {item.body}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[10px] font-black text-[color:var(--app-accent)]">
                        {item.kind === 'reel' ? 'Reels' : 'Diskusi'}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                      <span>{item.communityName}</span>
                      <span>-</span>
                      <span>
                        {formatShortDate(item.createdAt, localeCode) ||
                          (localeCode === 'id' ? 'Baru' : 'New')}
                      </span>
                      <span>-</span>
                      <span>
                        {item.stats.comments.toLocaleString(
                          localeCode === 'id' ? 'id-ID' : 'en-US',
                        )}{' '}
                        {localeCode === 'id' ? 'komentar' : 'comments'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[18px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-5 text-sm text-[color:var(--app-text-soft)]">
                {localeCode === 'id'
                  ? 'Belum ada postingan komunitas publik dari profil ini.'
                  : 'No public community posts from this profile yet.'}
              </div>
            )}
          </section>
        ) : null}

        {activeProfileTab === 'trust' ? (
          <section className={profileSectionClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  Trust
                </h2>
                <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                  {PROMO_ONLY_MODE
                    ? localeCode === 'id'
                      ? 'Sinyal profil, kontak, dan kelengkapan data publik.'
                      : 'Profile, contact, and public data readiness signals.'
                    : localeCode === 'id'
                      ? 'Sinyal keamanan dan kelayakan transaksi.'
                      : 'Safety and transaction readiness signals.'}
                </p>
              </div>
              <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1 text-sm font-black text-[color:var(--app-accent)]">
                {trustScoreLabel}
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {trustItems.map(item => (
                <div key={item.label} className={profileRowClass}>
                  <div className="flex items-center gap-2">
                    {item.ready ? (
                      <CheckCircle2 className="h-4 w-4 text-[color:var(--app-success)]" />
                    ) : (
                      <Clock3 className="h-4 w-4 text-[color:var(--app-text-soft)]" />
                    )}
                    <span className="text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {item.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.15rem)] z-[65] lg:hidden">
          <div className="mx-auto flex max-w-[520px] items-center gap-2 rounded-[22px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,transparent)] p-2 shadow-[0_20px_46px_-28px_rgba(15,23,42,0.48)] ring-1 ring-white/60 backdrop-blur-xl dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,var(--app-surface)_94%,transparent)] dark:ring-white/10">
            <div className="min-w-0 flex-1 px-1.5">
              <p className="truncate text-xs font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {detail.displayName}
              </p>
              <p className="truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                {localeCode === 'id'
                  ? 'Mulai ngobrol sebelum transaksi'
                  : 'Start a conversation first'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenChat()}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-[16px] bg-[color:var(--app-accent)] px-4 text-sm font-black text-[color:var(--app-text-inverse)] shadow-[0_14px_28px_-20px_rgba(22,163,74,0.7)]"
            >
              <MessageCircle className="h-4 w-4" />
              Chat
            </button>
          </div>
        </div>

        <Modal
          open={Boolean(socialModal)}
          onClose={() => setSocialModal(null)}
          title={
            socialModal === 'followers'
              ? localeCode === 'id'
                ? 'Pengikut'
                : 'Followers'
              : localeCode === 'id'
                ? 'Mengikuti'
                : 'Following'
          }
        >
          <div className="space-y-2">
            {socialModalUsers.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-5 text-center text-sm text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]">
                {localeCode === 'id'
                  ? 'Belum ada data koneksi.'
                  : 'No connection data yet.'}
              </div>
            ) : (
              socialModalUsers.map(item => (
                <div
                  key={item.id}
                  className="flex min-w-0 items-center gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 dark:border-[color:var(--app-border-strong)]"
                >
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
                    <Image
                      src={profileAvatarSrc(item.avatarUrl)}
                      alt={item.name}
                      fill
                      sizes="44px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        {item.name}
                      </p>
                      {item.verified ? (
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[color:var(--app-accent)]" />
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-[color:var(--app-text-soft)]">
                      {item.handle} · {item.badge}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSocialFollowToggle(item.id)}
                    className="inline-flex min-h-[36px] shrink-0 items-center rounded-full bg-[color:var(--app-accent-soft)] px-3 text-xs font-black text-[color:var(--app-accent)]"
                  >
                    {followedSocialIds.includes(item.id)
                      ? localeCode === 'id'
                        ? 'Diikuti'
                        : 'Following'
                      : 'Follow'}
                  </button>
                </div>
              ))
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
}
