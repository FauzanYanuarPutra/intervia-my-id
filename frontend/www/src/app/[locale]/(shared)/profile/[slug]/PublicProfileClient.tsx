'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Link, useRouter } from '@/i18n/navigation';
import {
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  ExternalLink,
  GraduationCap,
  Languages,
  Link2,
  MapPin,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Star,
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

function normalizePublicUserProfile(payload: unknown): PublicUserProfile | null {
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

function collectLinks(root: ProfileRecord | null): Array<{ label: string; url: string }> {
  const links: Array<{ label: string; url: string }> = [];

  const register = (label: string, value: unknown) => {
    const url = normalizeExternalUrl(readString(value));
    if (!url) return;
    if (links.some(item => item.url.toLowerCase() === url.toLowerCase())) return;
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

  const links = [
    ...collectLinks(freelancer),
    ...collectLinks(provider),
  ].filter(
    (item, index, list) =>
      list.findIndex(entry => entry.url.toLowerCase() === item.url.toLowerCase()) === index,
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

function formatShortDate(value: string | undefined, localeCode: 'id' | 'en'): string {
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

async function fetchProfileById(id: string, signal: AbortSignal): Promise<PublicUserProfile | null> {
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
  const localeCode = locale === 'id' ? 'id' : 'en';
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeContentTab, setActiveContentTab] =
    useState<ProfileContentTab>('all');

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

          const discoverPayload = (await discoverResponse.json().catch(() => ({}))) as {
            data?: unknown[];
          };

          const candidate = (Array.isArray(discoverPayload.data) ? discoverPayload.data : [])
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
            (await fetchProfileById(candidate.id, controller.signal)) || candidate;
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
          full_name:
            nextProfile.full_name ||
            nextProfile.username ||
            'member',
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

  const detail = useMemo(
    () => (profile ? buildProfileDetail(profile, localeCode) : null),
    [localeCode, profile],
  );

  if (loading) return null;

  if (notFound) {
    return (
      <div className="min-h-screen bg-[color:var(--app-surface-muted)] px-4 py-6">
        <div className="page-shell">
          <div className="rounded-[2rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-8 text-center shadow-sm dark:border-[color:var(--app-border-strong)]">
            <h1 className="text-2xl font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {localeCode === 'id' ? 'Profil tidak ditemukan' : 'Profile not found'}
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
      <div className="min-h-screen bg-[color:var(--app-surface-muted)] px-4 py-6">
        <div className="page-shell">
          <div className="rounded-[2rem] border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] p-6 text-center">
            <h1 className="text-xl font-bold text-[color:var(--app-text)]">
              {localeCode === 'id' ? 'Gagal memuat profil' : 'Failed to load profile'}
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
          ? profile.completed_jobs.toLocaleString(localeCode === 'id' ? 'id-ID' : 'en-US')
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
      value: listings.length.toLocaleString(localeCode === 'id' ? 'id-ID' : 'en-US'),
      icon: BriefcaseBusiness,
    },
  ];

  const listingGroups = listings.reduce<Record<ProfileLeafTab, PublicListing[]>>(
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
      property: [],
      umkm: [],
    },
  );

  const availableTabs = ([
    'all',
    ...Object.entries(listingGroups)
      .filter(([, items]) => items.length > 0)
      .map(([key]) => key as ProfileLeafTab),
  ] as ProfileContentTab[]).filter(
    (tab, index, list) => list.indexOf(tab) === index,
  );

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
    'space-y-3 sm:space-y-4 sm:mx-auto sm:max-w-[var(--app-max-width)] sm:px-[var(--app-page-x)]';
  const profileSectionClass =
    'bg-[color:var(--app-surface-strong)] px-4 py-5 shadow-none sm:rounded-[1.8rem] sm:border sm:border-[color:var(--app-border)] sm:bg-[color:var(--app-surface-strong)] sm:p-5 sm:shadow-sm dark:sm:border-[color:var(--app-border-strong)]';
  const profileTileClass =
    'rounded-[1.35rem] bg-[color:var(--app-surface-muted)] p-4 shadow-none dark:bg-[color:var(--app-surface)] sm:rounded-[1.6rem] sm:border sm:border-[color:var(--app-border)] sm:bg-[color:var(--app-surface-strong)] sm:shadow-sm dark:sm:border-[color:var(--app-border-strong)]';
  const profileRowClass =
    'rounded-[1.2rem] bg-[color:var(--app-surface-muted)] px-4 py-3 shadow-none dark:bg-[color:var(--app-surface)] sm:border sm:border-[color:var(--app-border)] sm:bg-[color:var(--app-surface-muted)] dark:sm:border-[color:var(--app-border-strong)]';
  const profileOutlineActionClass =
    'inline-flex items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] px-4 py-2 text-sm font-semibold text-[color:var(--app-text)] dark:bg-[color:var(--app-surface)] dark:text-[color:var(--app-text-soft)] sm:border sm:border-[color:var(--app-border)] dark:sm:border-[color:var(--app-border-strong)]';

  return (
    <div className="min-h-screen bg-[color:var(--app-surface-muted)] py-0 dark:bg-[color:var(--app-surface)] sm:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_26%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_24%),var(--app-surface-muted)] dark:sm:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_26%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_24%),var(--app-surface-strong)] sm:py-6">
      <div className={profileShellClass}>
        <section className="overflow-hidden bg-[color:var(--app-surface-strong)] shadow-none sm:rounded-[2rem] sm:border sm:border-[color:var(--app-border)] sm:shadow-[0_24px_55px_-36px_rgba(15,23,42,0.58)] dark:sm:border-[color:var(--app-border-strong)]">
          <div className="relative h-44 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--app-accent)_86%,white_14%)_0%,color-mix(in_srgb,var(--app-info)_82%,white_18%)_50%,color-mix(in_srgb,var(--app-warning)_70%,white_30%)_100%)] sm:h-52">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.26),transparent_28%),radial-gradient(circle_at_82%_8%,rgba(255,255,255,0.2),transparent_20%)]" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[color:var(--app-surface-strong)] to-transparent" />
          </div>

          <div className="relative px-4 pb-5 sm:px-6">
            <div className="-mt-14 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 flex-1 items-end gap-4">
                <div className="relative h-24 w-24 overflow-hidden rounded-[1.8rem] border-4 border-[color:var(--app-surface-strong)] bg-[color:var(--app-surface-muted)] shadow-xl sm:h-28 sm:w-28">
                  <Image
                    src={avatarUrl}
                    alt={detail.displayName}
                    fill
                    sizes="112px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-3xl">
                      {detail.displayName}
                    </h1>
                    {profile.identity_verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-accent)]">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {localeCode === 'id' ? 'Verified' : 'Verified'}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:text-base">
                    {detail.headline}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[color:var(--app-text-soft)]">
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

              <div className="grid gap-2 sm:flex sm:flex-wrap">
                {featuredListing ? (
                  <Link
                    href={buildPublicListingHref(featuredListing)}
                    className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--app-text-inverse)] sm:w-auto"
                  >
                    {localeCode === 'id' ? 'Lihat listing utama' : 'Open main listing'}
                  </Link>
                ) : (
                  <Link
                    href={`/search?q=${encodeURIComponent(detail.displayName)}`}
                    className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--app-text-inverse)] sm:w-auto"
                  >
                    {localeCode === 'id' ? 'Cari yang terkait' : 'Search related'}
                  </Link>
                )}
                <Link
                  href="/search?type=freelancer"
                  className={`${profileOutlineActionClass} w-full transition hover:bg-[color:var(--app-surface-muted)] sm:w-auto`}
                >
                  {localeCode === 'id' ? 'Cari talent lain' : 'Find more talent'}
                </Link>
              </div>
            </div>

            {detail.verificationBadges.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
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

            <p className="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              {detail.summary}
            </p>
          </div>
        </section>

        <section className="bg-[color:var(--app-surface-strong)] px-4 py-4 sm:bg-transparent sm:px-0 sm:py-0">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.label} className={profileTileClass}>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                      {item.label}
                    </span>
                  </div>
                  <p className="mt-4 text-2xl font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="space-y-4">
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
                <div className="mt-4 space-y-3">
                  {detail.experience.slice(0, 6).map(item => (
                    <div key={item} className={`${profileRowClass} text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]`}>
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {(detail.education.length > 0 || detail.certifications.length > 0) ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {detail.education.length > 0 ? (
                  <section className={profileSectionClass}>
                    <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                      <GraduationCap className="h-4 w-4" />
                      {localeCode === 'id' ? 'Pendidikan' : 'Education'}
                    </h2>
                    <div className="mt-4 space-y-3">
                      {detail.education.slice(0, 5).map(item => (
                        <div key={item} className="text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
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
                    <div className="mt-4 space-y-3">
                      {detail.certifications.slice(0, 5).map(item => (
                        <div key={item} className="text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                          {item}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
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
                  {localeCode === 'id' ? 'Link profesional' : 'Professional links'}
                </h2>
                <div className="mt-4 space-y-2">
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
                    href={getProfileContentTabDefinition(resolvedActiveContentTab).browseHref}
                    className="text-[11px] font-semibold text-[color:var(--app-accent)]"
                  >
                    {localeCode === 'id' ? 'Lihat lebih banyak' : 'See more'}
                  </Link>
                ) : null}
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
                      <span>{getProfileContentTabLabel(tab, localeCode)}</span>
                      <span className="rounded-full bg-[color:var(--app-surface-strong)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-muted)] dark:text-[color:var(--app-text-soft)]">
                        {tab === 'all' ? listings.length : listingGroups[tab].length}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {activeListingItems.length === 0 ? (
                <p className="mt-4 text-sm text-[color:var(--app-text-soft)]">
                  {resolvedActiveContentTab === 'all'
                    ? localeCode === 'id'
                      ? 'Belum ada listing publik yang aktif.'
                      : 'No public active listings yet.'
                    : localeCode === 'id'
                      ? `${getProfileContentTabDefinition(resolvedActiveContentTab).labelId} belum tersedia di profil ini.`
                      : `${getProfileContentTabDefinition(resolvedActiveContentTab).labelEn} is not available on this profile yet.`}
                </p>
              ) : (
                <div className="mt-4 space-y-3">
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
                          {item.title || (localeCode === 'id' ? 'Listing tanpa judul' : 'Untitled listing')}
                        </p>
                        {item.summary ? (
                          <p className="mt-1 line-clamp-2 text-sm text-[color:var(--app-text-soft)]">
                            {item.summary}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--app-text-soft)]">
                          <span className="font-semibold text-[color:var(--app-accent)]">
                            {typeof item.price_cents === 'number' && item.price_cents > 0
                              ? formatIDRFromCents(item.price_cents)
                              : localeCode === 'id'
                                ? 'Negosiasi'
                                : 'Negotiable'}
                          </span>
                          <span>{getProfileContentTabLabel(normalizeProfileContentTab({
                            type: item.content_type,
                            category: item.category,
                            metadata: item.metadata || null,
                          }), localeCode)}</span>
                          {(item.updated_at || item.created_at) ? (
                            <span>
                              {formatShortDate(item.updated_at || item.created_at, localeCode)}
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
      </div>
    </div>
  );
}
