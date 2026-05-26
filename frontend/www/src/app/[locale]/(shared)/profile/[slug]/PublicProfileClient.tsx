'use client';

import { useEffect, useMemo, useState } from 'react';
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
  MessageSquareText,
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
import { normalizeProfileMediaUrl } from '@/lib/profile/profileMedia';
import { DetailMobileTopBar } from '@/components/layout/DetailMobileTopBar';

type PublicProfileClientProps = {
  locale: string;
  slug: string;
};

type PublicUserProfile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
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
    avatarUrl: normalizeProfileMediaUrl(profile.avatar_url) || '/default-avatar.svg',
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
    profile.transaction_eligible
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

export default function PublicProfileClient({
  locale,
  slug,
}: PublicProfileClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const localeCode = locale === 'id' ? 'id' : 'en';
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [listings, setListings] = useState<PublicListing[]>([]);
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

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);

      try {
        let nextProfile: PublicUserProfile | null = null;
        const directId = extractPublicProfileIdFromSlug(slug);

        if (directId) {
          nextProfile = await fetchProfileById(directId, controller.signal);
        }

        if (!nextProfile) {
          const searchTerm = decodePublicProfileSlug(slug)
            .replace(/--.+$/, '')
            .replace(/-/g, ' ')
            .trim();

          if (!searchTerm) {
            setNotFound(true);
            setProfile(null);
            setListings([]);
            return;
          }

          const discoverResponse = await fetch(
            `/api/users/discover?q=${encodeURIComponent(searchTerm)}&limit=24`,
            {
              cache: 'no-store',
              signal: controller.signal,
            },
          );

          const discoverPayload = (await discoverResponse
            .json()
            .catch(() => ({}))) as {
            data?: unknown[];
          };

          const candidate = (
            Array.isArray(discoverPayload.data) ? discoverPayload.data : []
          )
            .map(item => normalizePublicUserProfile(item))
            .filter((item): item is PublicUserProfile => Boolean(item))
            .find(item => matchesPublicProfileSlug(slug, item));

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
          `/api/content?owner_id=${encodeURIComponent(nextProfile.id)}&limit=9&status=active`,
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

  const detail = useMemo(
    () => (profile ? buildProfileDetail(profile, localeCode) : null),
    [localeCode, profile],
  );

  if (loading) return null;

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

  const avatarUrl =
    normalizeProfileMediaUrl(profile.avatar_url) || '/default-avatar.svg';
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
      label: localeCode === 'id' ? 'Job selesai' : 'Completed jobs',
      value:
        typeof profile.completed_jobs === 'number'
          ? profile.completed_jobs.toLocaleString(
              localeCode === 'id' ? 'id-ID' : 'en-US',
            )
          : '0',
      icon: Award,
    },
    {
      label: localeCode === 'id' ? 'Rate mulai' : 'Starting rate',
      value:
        typeof profile.hourly_rate === 'number' && profile.hourly_rate > 0
          ? formatIDRFromCents(profile.hourly_rate * 100)
          : localeCode === 'id'
            ? 'Negosiasi'
            : 'Negotiable',
      icon: Sparkles,
    },
    {
      label: localeCode === 'id' ? 'Listing aktif' : 'Active listings',
      value: listings.length.toLocaleString(
        localeCode === 'id' ? 'id-ID' : 'en-US',
      ),
      icon: BriefcaseBusiness,
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
  const profileShellClass =
    'mx-auto flex w-full max-w-[1700px] flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:px-[var(--app-page-x)]';
  const profileSectionClass =
    'rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3.5 py-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.32)] dark:border-[color:var(--app-border-strong)] sm:rounded-[22px] sm:p-4';
  const profileTileClass =
    'rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_14px_26px_-26px_rgba(15,23,42,0.26)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)] sm:rounded-[20px]';
  const profileRowClass =
    'rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3.5 py-3 shadow-none dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]';
  const profilePrimaryActionClass =
    'inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[14px] bg-[color:var(--app-accent)] px-4 py-2.5 text-sm font-bold text-[color:var(--app-text-inverse)] shadow-[0_18px_30px_-22px_rgba(22,163,74,0.55)] transition hover:bg-[color:var(--app-accent-strong)]';
  const profileSoftActionClass =
    'inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-white px-4 py-2.5 text-sm font-bold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)] dark:text-[color:var(--app-text-soft)]';
  const inviteHref = featuredListing
    ? buildPublicListingHref(featuredListing)
    : `/search?q=${encodeURIComponent(detail.displayName)}`;
  const chatHref = `/chat?draft=${encodeURIComponent(
    localeCode === 'id'
      ? `Halo ${detail.displayName}, saya tertarik dengan profil Anda.`
      : `Hi ${detail.displayName}, I am interested in your profile.`,
  )}`;
  const profileTabs: Array<{
    key: PublicProfileTab;
    label: string;
    icon: typeof Sparkles;
  }> = [
    { key: 'ringkas', label: localeCode === 'id' ? 'Ringkas' : 'Summary', icon: Sparkles },
    { key: 'etalase', label: localeCode === 'id' ? 'Etalase' : 'Showcase', icon: Store },
    { key: 'reels', label: 'Reels', icon: Clapperboard },
    { key: 'komunitas', label: localeCode === 'id' ? 'Komunitas' : 'Community', icon: Users },
    { key: 'trust', label: 'Trust', icon: ShieldCheck },
  ];
  const followerCount = Math.max(
    socialUsers.length + listings.length * 2 + (profile.identity_verified ? 8 : 3),
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
  const trustScore = [
    profile.identity_verified,
    profile.transaction_eligible,
    profile.email_verified,
    profile.phone_verified,
  ].filter(Boolean).length;

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

  const handleOpenChat = () => {
    if (!isAuthenticated) {
      router.push(
        `/login?callbackUrl=${encodeURIComponent(pathname || `/profile/${slug}`)}`,
      );
      return;
    }
    router.push(chatHref);
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
    <div className="lajukan-market-page lajukan-market-profile min-h-screen bg-[color:var(--app-surface-muted)] pb-6 pt-0 dark:bg-[color:var(--app-surface)] sm:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_24%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_22%),var(--app-surface-muted)] dark:sm:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_24%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_22%),var(--app-surface-strong)] lg:pb-6">
      <DetailMobileTopBar
        title={detail.displayName}
        eyebrow={localeCode === 'id' ? 'Profil publik' : 'Public profile'}
        backLabel={localeCode === 'id' ? 'Kembali' : 'Back'}
      />
      <div className={profileShellClass}>
        <section className="overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_24px_52px_-38px_rgba(15,23,42,0.42)] dark:border-[color:var(--app-border-strong)]">
          <div className="relative h-28 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--app-accent)_86%,white_14%)_0%,color-mix(in_srgb,var(--app-info)_82%,white_18%)_50%,color-mix(in_srgb,var(--app-warning)_70%,white_30%)_100%)] sm:h-36 lg:h-40">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.26),transparent_28%),radial-gradient(circle_at_82%_8%,rgba(255,255,255,0.2),transparent_20%)]" />
            <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[color:var(--app-surface-strong)] to-transparent" />
          </div>

          <div className="relative px-3.5 pb-4 sm:px-5">
            <div className="-mt-10 flex flex-col gap-3 sm:-mt-12 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 flex-1 items-end gap-3 sm:gap-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-[22px] border-[3px] border-[color:var(--app-surface-strong)] bg-[color:var(--app-surface-muted)] shadow-xl sm:h-24 sm:w-24">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="line-clamp-2 min-w-0 text-xl font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-2xl lg:text-[28px]">
                      {detail.displayName}
                    </h1>
                    <span className="inline-flex max-w-full items-center rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--app-text-soft)] dark:bg-[color:var(--app-surface)]">
                      <span className="truncate">
                        @{profile.username || profile.id.slice(0, 8)}
                      </span>
                    </span>
                    {profile.identity_verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-accent)]">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {localeCode === 'id' ? 'Verified' : 'Verified'}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:text-base">
                    {detail.headline}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2.5 text-xs text-[color:var(--app-text-soft)]">
                    {profile.location ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {profile.location}
                      </span>
                    ) : null}
                    {detail.roles.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {detail.roles.slice(0, 2).map(formatRole).join(' / ')}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-end">
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  className={isFollowing ? profileSoftActionClass : profilePrimaryActionClass}
                >
                  {isFollowing ? (
                    <UserMinus className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {isFollowing
                    ? localeCode === 'id'
                      ? 'Unfollow'
                      : 'Unfollow'
                    : localeCode === 'id'
                      ? 'Follow'
                      : 'Follow'}
                </button>
                <button
                  type="button"
                  onClick={handleOpenChat}
                  className={profileSoftActionClass}
                >
                  <MessageCircle className="h-4 w-4" />
                  Chat
                </button>
                <button
                  type="button"
                  onClick={handleShareProfile}
                  className={profileSoftActionClass}
                >
                  {shareMessage ? (
                    <Copy className="h-4 w-4" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                  {shareMessage || (localeCode === 'id' ? 'Bagikan' : 'Share')}
                </button>
              </div>
            </div>

            {detail.verificationBadges.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.verificationBadges.map(label => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
                    {label}
                  </span>
                ))}
              </div>
            ) : null}

            <p className="mt-3 max-w-4xl text-sm leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              {detail.summary}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setSocialModal('followers')}
                className={`${profileRowClass} text-left transition hover:border-[color:var(--app-accent-border)]`}
              >
                <span className="block text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {followerCount.toLocaleString(localeCode === 'id' ? 'id-ID' : 'en-US')}
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
                  {followingCount.toLocaleString(localeCode === 'id' ? 'id-ID' : 'en-US')}
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
                  {listings.length.toLocaleString(localeCode === 'id' ? 'id-ID' : 'en-US')}
                </span>
                <span className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  {localeCode === 'id' ? 'Etalase' : 'Showcase'}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setActiveProfileTab('trust')}
                className={`${profileRowClass} text-left transition hover:border-[color:var(--app-accent-border)]`}
              >
                <span className="block text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {trustScore}/4
                </span>
                <span className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  Trust
                </span>
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2.5 dark:border-[color:var(--app-border-strong)]">
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

            {detail.education.length > 0 || detail.certifications.length > 0 ? (
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
                      <span>{getProfileContentTabLabel(tab, localeCode)}</span>
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
                            normalizeContentMediaUrl(item.cover_image || '') ||
                            '/default-avatar.svg'
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
                            {typeof item.price_cents === 'number' &&
                            item.price_cents > 0
                              ? formatIDRFromCents(item.price_cents)
                              : localeCode === 'id'
                                ? 'Negosiasi'
                                : 'Negotiable'}
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
                  {localeCode === 'id' ? 'Etalase' : 'Showcase'}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                  {localeCode === 'id'
                    ? 'Listing aktif, jasa, produk, lokasi, dan peluang.'
                    : 'Active listings, services, products, places, and opportunities.'}
                </p>
              </div>
              <Link href={inviteHref} className={profilePrimaryActionClass}>
                <ExternalLink className="h-4 w-4" />
                {localeCode === 'id' ? 'Buka utama' : 'Open main'}
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
                      {tab === 'all' ? listings.length : listingGroups[tab].length}
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
                        {typeof item.price_cents === 'number' &&
                        item.price_cents > 0
                          ? formatIDRFromCents(item.price_cents)
                          : localeCode === 'id'
                            ? 'Negosiasi'
                            : 'Negotiable'}
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
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                <Clapperboard className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  Reels
                </h2>
                <p className="text-sm text-[color:var(--app-text-soft)]">
                  {localeCode === 'id'
                    ? 'Video usaha singkat dari profil ini akan tampil di sini.'
                    : 'Short business videos from this profile will appear here.'}
                </p>
              </div>
            </div>
            <Link href="/reels" className={`${profileSoftActionClass} mt-4`}>
              <Clapperboard className="h-4 w-4" />
              {localeCode === 'id' ? 'Buka Reels' : 'Open Reels'}
            </Link>
          </section>
        ) : null}

        {activeProfileTab === 'komunitas' ? (
          <section className={profileSectionClass}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                <Users className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {localeCode === 'id' ? 'Komunitas' : 'Community'}
                </h2>
                <p className="text-sm text-[color:var(--app-text-soft)]">
                  {localeCode === 'id'
                    ? 'Aktivitas grup dan diskusi publik akan tampil ringkas.'
                    : 'Group activity and public discussions will appear compactly.'}
                </p>
              </div>
            </div>
            <Link href="/community" className={`${profileSoftActionClass} mt-4`}>
              <MessageSquareText className="h-4 w-4" />
              {localeCode === 'id' ? 'Lihat komunitas' : 'Open community'}
            </Link>
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
                  {localeCode === 'id'
                    ? 'Sinyal keamanan dan kelayakan transaksi.'
                    : 'Safety and transaction readiness signals.'}
                </p>
              </div>
              <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1 text-sm font-black text-[color:var(--app-accent)]">
                {trustScore}/4
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                [localeCode === 'id' ? 'Identitas' : 'Identity', profile.identity_verified],
                [localeCode === 'id' ? 'Transaksi' : 'Transaction', profile.transaction_eligible],
                ['Email', profile.email_verified],
                [localeCode === 'id' ? 'Telepon' : 'Phone', profile.phone_verified],
              ].map(([label, ready]) => (
                <div key={String(label)} className={profileRowClass}>
                  <div className="flex items-center gap-2">
                    {ready ? (
                      <CheckCircle2 className="h-4 w-4 text-[color:var(--app-success)]" />
                    ) : (
                      <Clock3 className="h-4 w-4 text-[color:var(--app-text-soft)]" />
                    )}
                    <span className="text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {String(label)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

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
                      src={item.avatarUrl}
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
