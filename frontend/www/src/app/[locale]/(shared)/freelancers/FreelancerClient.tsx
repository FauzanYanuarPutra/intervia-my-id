'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FreelancerCard } from '@/components/ui-kit';
import { useAppBack } from '@/lib/navigation/useAppBack';
import {
  ChevronLeft,
  Filter,
  Loader2,
  RotateCcw,
  Search,
  TriangleAlert,
  UserSearch,
} from 'lucide-react';
import {
  asNumber,
  asString,
  ContentItem,
  extractContentItems,
  matchAnyFilter,
} from '@/lib/content/catalog';
import { normalizePriceUnit } from '@/lib/content/priceUnit';
import { profileAvatarSrc } from '@/lib/profile/avatar';
import {
  buildPublicProfileHref,
  buildPublicProfileHrefFromContent,
} from '@/lib/profile/publicProfileLink';

type DiscoverUser = {
  id: string;
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  location?: string | null;
  headline?: string | null;
  roles?: string[] | null;
  level?: string | null;
  rating?: number | null;
  completed_jobs?: number | null;
  hourly_rate?: number | null;
};

type FreelancerCardItem = {
  id: string;
  href: string;
  skills: string[];
  workMode: string;
  level?: string;
  rating?: string;
  user: {
    id: string;
    name: string;
    tagline: string;
    following: number;
    followers: number;
    projectsCompleted: number;
    rating: number;
    verified: boolean;
    premium: boolean;
    location: string;
    avatar: { src?: string; alt?: string };
    coverImage: { src?: string; alt?: string };
  };
  pricing: { rate: number; currency: string; period: 'hr' | 'day' | 'project' };
};

type Filters = {
  search: string;
  location: string;
  rating: string;
  minRate: string;
  maxRate: string;
  workMode: string;
  verifiedOnly: boolean;
  premiumOnly: boolean;
  sortBy: 'latest' | 'rating' | 'rate_low' | 'rate_high';
};

const PAGE_SIZE = 12;

function pseudoStatFromId(id: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const range = max - min + 1;
  return (hash % range) + min;
}

function roleToLabel(raw: string | null | undefined): string {
  const source = (raw || 'member').trim();
  if (!source) return 'Member';
  return source
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, token => token.toUpperCase());
}

function priceUnitToFreelancerPeriod(
  unit: unknown,
): 'hr' | 'day' | 'project' | undefined {
  const normalized = normalizePriceUnit(unit);
  if (normalized === 'hour') return 'hr';
  if (normalized === 'day') return 'day';
  if (normalized === 'project' || normalized === 'session') return 'project';
  return undefined;
}

function mapContentToFreelancer(item: ContentItem): FreelancerCardItem {
  const meta = item.metadata || {};
  const id = String(item.id);
  const sellerStats = item.seller_stats || {};

  const rating = asNumber(sellerStats.rating) || asNumber(item.rating) || 0;
  const hourlyRate =
    asNumber(meta.hourly_rate) ||
    asNumber(meta.rate) ||
    (Number.isFinite(item.price_cents)
      ? Math.floor((item.price_cents as number) / 100)
      : 0);
  const level = roleToLabel(
    asString(meta.level) ||
      asString(meta.profile_level) ||
      asString(meta.primary_role),
  );

  return {
    id,
    href:
      buildPublicProfileHrefFromContent(item) ||
      buildPublicProfileHref({
        id,
        full_name: item.title || asString(meta.full_name) || 'freelancer',
        username: asString(meta.username) || undefined,
        title: item.title || undefined,
      }),
    skills: (asString(meta.skills) || '')
      .split(/[,\n]/)
      .map(entry => entry.trim())
      .filter(Boolean)
      .slice(0, 5),
    workMode:
      asString(meta.work_mode) || asString(meta.delivery_mode) || 'remote',
    level,
    rating: rating > 0 ? rating.toFixed(1) : undefined,
    user: {
      id,
      name:
        item.title ||
        asString(meta.name) ||
        asString(meta.full_name) ||
        'Freelancer',
      tagline:
        asString(meta.tagline) ||
        item.summary ||
        asString(meta.profession) ||
        'Professional',
      following: asNumber(meta.following) || 0,
      followers: asNumber(meta.followers) || 0,
      projectsCompleted:
        asNumber(sellerStats.completed_transactions) ||
        asNumber(meta.projects_completed) ||
        asNumber(meta.completed_jobs) ||
        0,
      rating,
      verified: Boolean(meta.verified),
      premium: Boolean(meta.premium),
      location:
        asString(meta.location) ||
        asString(meta.city) ||
        asString(meta.region) ||
        'Remote',
      avatar: {
        src: profileAvatarSrc(
          item.cover_image ||
            asString(meta.avatar) ||
            asString(meta.avatar_url),
        ),
        alt: asString(meta.name) || 'Avatar',
      },
      coverImage: {
        src:
          asString(meta.cover_image) ||
          item.cover_image ||
          asString(meta.banner),
        alt: 'Cover',
      },
    },
    pricing: {
      rate: hourlyRate,
      currency: asString(item.currency) || asString(meta.currency) || 'IDR',
      period:
        priceUnitToFreelancerPeriod(item.price_unit) ||
        priceUnitToFreelancerPeriod(meta.price_unit) ||
        (asString(meta.rate_period) as 'hr' | 'day' | 'project' | undefined) ||
        (asString(meta.pricing_period) as
          | 'hr'
          | 'day'
          | 'project'
          | undefined) ||
        'hr',
    },
  };
}

function mapDiscoverUserToFreelancer(user: DiscoverUser): FreelancerCardItem {
  const id = user.id;
  const name = user.full_name || user.username || user.email || 'Talent';
  const seedRating =
    typeof user.rating === 'number' && Number.isFinite(user.rating)
      ? user.rating
      : pseudoStatFromId(id, 42, 49) / 10; // 4.2 - 4.9
  const projects =
    typeof user.completed_jobs === 'number' &&
    Number.isFinite(user.completed_jobs)
      ? user.completed_jobs
      : pseudoStatFromId(id, 2, 18);
  const followers = pseudoStatFromId(id, 10, 180);
  const following = pseudoStatFromId(id, 3, 60);
  const rate =
    typeof user.hourly_rate === 'number' && Number.isFinite(user.hourly_rate)
      ? Math.max(0, Math.round(user.hourly_rate))
      : pseudoStatFromId(id, 120, 650) * 1000; // IDR
  const roleFromList =
    Array.isArray(user.roles) && user.roles.length > 0 ? user.roles[0] : null;
  const level = roleToLabel(user.level || roleFromList);
  const avatar = profileAvatarSrc(user.avatar_url);

  return {
    id,
    href: buildPublicProfileHref({
      id,
      username: user.username || undefined,
      full_name: user.full_name || name,
      title: name,
    }),
    skills: [],
    workMode: 'remote',
    level,
    rating: Number(seedRating).toFixed(1),
    user: {
      id,
      name,
      tagline: user.headline || user.email || 'Available for new projects',
      following,
      followers,
      projectsCompleted: projects,
      rating: Number(seedRating.toFixed(1)),
      verified: true,
      premium: projects > 10,
      location: user.location || 'Indonesia',
      avatar: { src: avatar, alt: name },
      coverImage: { src: avatar, alt: name },
    },
    pricing: {
      rate,
      currency: 'IDR',
      period: 'hr',
    },
  };
}

function matchesFilters(item: FreelancerCardItem, filters: Filters): boolean {
  const query = filters.search.trim().toLowerCase();
  if (query) {
    const haystack =
      `${item.user.name} ${item.user.tagline} ${item.user.location}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  if (filters.location.trim()) {
    const match = item.user.location
      .toLowerCase()
      .includes(filters.location.trim().toLowerCase());
    if (!match) return false;
  }

  if (filters.rating.trim()) {
    const minRating = Number(filters.rating);
    if (Number.isFinite(minRating) && item.user.rating < minRating) {
      return false;
    }
  }

  const minRate = Number(filters.minRate);
  if (Number.isFinite(minRate) && minRate > 0 && item.pricing.rate < minRate) {
    return false;
  }

  const maxRate = Number(filters.maxRate);
  if (Number.isFinite(maxRate) && maxRate > 0 && item.pricing.rate > maxRate) {
    return false;
  }

  if (filters.workMode.trim()) {
    if (
      !item.workMode
        .toLowerCase()
        .includes(filters.workMode.trim().toLowerCase())
    ) {
      return false;
    }
  }

  if (filters.verifiedOnly && !item.user.verified) return false;
  if (filters.premiumOnly && !item.user.premium) return false;

  return true;
}

export default function FreelancerClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const autoLoadTargetRef = useRef<HTMLDivElement>(null);
  const autoLoadLockRef = useRef(false);
  const fallbackHomePath = pathname.startsWith('/en') ? '/en/home' : '/id/home';

  const initialFilters = useMemo<Filters>(
    () => ({
      search: searchParams.get('q') || '',
      location: searchParams.get('location') || '',
      rating: searchParams.get('rating') || '',
      minRate: searchParams.get('min_rate') || '',
      maxRate: searchParams.get('max_rate') || '',
      workMode: searchParams.get('work_mode') || '',
      verifiedOnly: searchParams.get('verified') === '1',
      premiumOnly: searchParams.get('premium') === '1',
      sortBy:
        (searchParams.get('sort') as Filters['sortBy']) === 'rating' ||
        (searchParams.get('sort') as Filters['sortBy']) === 'rate_low' ||
        (searchParams.get('sort') as Filters['sortBy']) === 'rate_high'
          ? (searchParams.get('sort') as Filters['sortBy'])
          : 'latest',
    }),
    [searchParams],
  );

  const [draftFilters, setDraftFilters] = useState<Filters>(initialFilters);
  const [filters, setFilters] = useState<Filters>(initialFilters);

  const [items, setItems] = useState<FreelancerCardItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const handleBack = useAppBack(router, fallbackHomePath);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (filters.search.trim()) params.set('q', filters.search.trim());
    else params.delete('q');
    if (filters.location.trim())
      params.set('location', filters.location.trim());
    else params.delete('location');
    if (filters.rating.trim()) params.set('rating', filters.rating.trim());
    else params.delete('rating');
    if (filters.minRate.trim()) params.set('min_rate', filters.minRate.trim());
    else params.delete('min_rate');
    if (filters.maxRate.trim()) params.set('max_rate', filters.maxRate.trim());
    else params.delete('max_rate');
    if (filters.workMode.trim())
      params.set('work_mode', filters.workMode.trim());
    else params.delete('work_mode');
    if (filters.verifiedOnly) params.set('verified', '1');
    else params.delete('verified');
    if (filters.premiumOnly) params.set('premium', '1');
    else params.delete('premium');
    if (filters.sortBy !== 'latest') params.set('sort', filters.sortBy);
    else params.delete('sort');

    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
    }
  }, [filters, pathname, router, searchParams]);

  const loadData = useCallback(
    async (reset: boolean) => {
      if (
        !reset &&
        (!hasMore || loadingInitial || loadingMore || autoLoadLockRef.current)
      )
        return;

      const currentPage = reset ? 1 : page;
      const offset = (currentPage - 1) * PAGE_SIZE;
      if (reset) {
        setLoadingInitial(true);
        setLoadError(null);
        autoLoadLockRef.current = false;
      } else {
        setLoadingMore(true);
        autoLoadLockRef.current = true;
      }

      try {
        const params = new URLSearchParams();
        params.set('type', 'freelancer');
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(offset));
        if (filters.search.trim()) params.set('q', filters.search.trim());
        if (filters.location.trim())
          params.set('location', filters.location.trim());
        if (filters.rating.trim()) params.set('rating', filters.rating.trim());

        const response = await fetch(`/api/content?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            (payload as { error?: string }).error ||
              `Failed to load freelancers (${response.status})`,
          );
        }

        const serverItems = extractContentItems(payload);
        const payloadHasMore =
          typeof (payload as { has_more?: unknown }).has_more === 'boolean'
            ? Boolean((payload as { has_more?: boolean }).has_more)
            : null;
        const contentItems = serverItems.filter(entry => {
          if (!matchAnyFilter(entry, filters.search)) return false;
          const typeText =
            `${entry.content_type || ''} ${entry.category || ''}`.toLowerCase();
          return (
            typeText.includes('freelancer') ||
            typeText.includes('talent') ||
            typeText.includes('service')
          );
        });

        let mapped = contentItems
          .map(mapContentToFreelancer)
          .filter(entry => matchesFilters(entry, filters));

        let nextHasMore = payloadHasMore ?? serverItems.length === PAGE_SIZE;

        if (mapped.length === 0) {
          const userParams = new URLSearchParams({ limit: String(PAGE_SIZE) });
          if (filters.search.trim()) userParams.set('q', filters.search.trim());

          const userRes = await fetch(
            `/api/users/discover?${userParams.toString()}`,
            {
              cache: 'no-store',
              credentials: 'include',
            },
          );
          const userPayload = (await userRes.json().catch(() => ({}))) as {
            data?: DiscoverUser[];
            error?: string;
          };

          if (!userRes.ok && userRes.status !== 401) {
            throw new Error(
              userPayload.error || `Failed to load users (${userRes.status})`,
            );
          }

          const users = Array.isArray(userPayload.data) ? userPayload.data : [];
          mapped = users
            .map(mapDiscoverUserToFreelancer)
            .filter(entry => matchesFilters(entry, filters));
          nextHasMore = false;
        }

        if (filters.sortBy === 'rating') {
          mapped = [...mapped].sort((a, b) => b.user.rating - a.user.rating);
        } else if (filters.sortBy === 'rate_low') {
          mapped = [...mapped].sort((a, b) => a.pricing.rate - b.pricing.rate);
        } else if (filters.sortBy === 'rate_high') {
          mapped = [...mapped].sort((a, b) => b.pricing.rate - a.pricing.rate);
        }

        setItems(prev => (reset ? mapped : [...prev, ...mapped]));
        setHasMore(nextHasMore);
        setPage(reset ? 2 : currentPage + 1);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load freelancer listings';
        setLoadError(message);
        if (reset) setItems([]);
      } finally {
        autoLoadLockRef.current = false;
        setLoadingInitial(false);
        setLoadingMore(false);
      }
    },
    [filters, hasMore, loadingInitial, loadingMore, page],
  );

  useEffect(() => {
    loadData(true);
  }, [filters, loadData]);

  const commitFilters = useCallback((nextDraft: Filters) => {
    const next: Filters = {
      search: nextDraft.search.trim(),
      location: nextDraft.location.trim(),
      rating: nextDraft.rating.trim(),
      minRate: nextDraft.minRate.trim(),
      maxRate: nextDraft.maxRate.trim(),
      workMode: nextDraft.workMode.trim(),
      verifiedOnly: nextDraft.verifiedOnly,
      premiumOnly: nextDraft.premiumOnly,
      sortBy: nextDraft.sortBy,
    };

    setFilters(prev =>
      prev.search === next.search &&
      prev.location === next.location &&
      prev.rating === next.rating &&
      prev.minRate === next.minRate &&
      prev.maxRate === next.maxRate &&
      prev.workMode === next.workMode &&
      prev.verifiedOnly === next.verifiedOnly &&
      prev.premiumOnly === next.premiumOnly &&
      prev.sortBy === next.sortBy
        ? prev
        : next,
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      commitFilters(draftFilters);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [commitFilters, draftFilters]);

  useEffect(() => {
    const target = autoLoadTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      entries => {
        if (
          entries[0]?.isIntersecting &&
          hasMore &&
          !loadingInitial &&
          !loadingMore
        ) {
          loadData(false);
        }
      },
      { threshold: 0.01, rootMargin: '600px 0px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadData, loadingInitial, loadingMore]);

  const resetFilters = () => {
    const empty: Filters = {
      search: '',
      location: '',
      rating: '',
      minRate: '',
      maxRate: '',
      workMode: '',
      verifiedOnly: false,
      premiumOnly: false,
      sortBy: 'latest',
    };
    setDraftFilters(empty);
    setFilters(empty);
  };

  const hasActiveFilters = Boolean(
    filters.search.trim() ||
    filters.location.trim() ||
    filters.rating.trim() ||
    filters.minRate.trim() ||
    filters.maxRate.trim() ||
    filters.workMode.trim() ||
    filters.verifiedOnly ||
    filters.premiumOnly ||
    filters.sortBy !== 'latest',
  );

  const topSkills = useMemo(() => {
    const pool = items.flatMap(item => item.skills).filter(Boolean);
    const counter = new Map<string, number>();
    for (const skill of pool) {
      counter.set(skill, (counter.get(skill) || 0) + 1);
    }
    return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [items]);

  return (
    <div className="min-h-screen bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_94%,_transparent)] backdrop-blur-xl lg:top-[calc(3.5rem+env(safe-area-inset-top))] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_92%,_transparent)]">
        <div className="mx-auto max-w-[1500px] space-y-2 px-2 py-2 sm:px-3">
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="flex flex-grow items-center gap-2">
              <button
                type="button"
                title="Back"
                aria-label="Back"
                onClick={handleBack}
                className="inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] transition-all active:scale-95 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
              >
                <ChevronLeft className="h-4.5 w-4.5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]" />
              </button>

              <div className="relative flex-grow">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
                <input
                  type="text"
                  placeholder="Search freelancer, skill, or tagline"
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] py-2.5 pl-11 pr-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                  value={draftFilters.search}
                  onChange={event =>
                    setDraftFilters(prev => ({
                      ...prev,
                      search: event.target.value,
                    }))
                  }
                  onKeyDown={event =>
                    event.key === 'Enter' && commitFilters(draftFilters)
                  }
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] md:max-w-md md:grid md:grid-cols-2 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
              <input
                type="text"
                placeholder="Location filter"
                value={draftFilters.location}
                onChange={event =>
                  setDraftFilters(prev => ({
                    ...prev,
                    location: event.target.value,
                  }))
                }
                onKeyDown={event =>
                  event.key === 'Enter' && commitFilters(draftFilters)
                }
                className="min-w-[150px] rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
              />
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                placeholder="Minimum rating (0-5)"
                value={draftFilters.rating}
                onChange={event =>
                  setDraftFilters(prev => ({
                    ...prev,
                    rating: event.target.value,
                  }))
                }
                onKeyDown={event =>
                  event.key === 'Enter' && commitFilters(draftFilters)
                }
                className="min-w-[180px] rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden">
            <input
              type="number"
              min={0}
              placeholder="Min rate"
              value={draftFilters.minRate}
              onChange={event =>
                setDraftFilters(prev => ({
                  ...prev,
                  minRate: event.target.value,
                }))
              }
              className="min-w-[132px] rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
            />
            <input
              type="number"
              min={0}
              placeholder="Max rate"
              value={draftFilters.maxRate}
              onChange={event =>
                setDraftFilters(prev => ({
                  ...prev,
                  maxRate: event.target.value,
                }))
              }
              className="min-w-[132px] rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
            />
            <select
              value={draftFilters.workMode}
              onChange={event =>
                setDraftFilters(prev => ({
                  ...prev,
                  workMode: event.target.value,
                }))
              }
              className="min-w-[150px] rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
            >
              <option value="">Any work mode</option>
              <option value="remote">Remote</option>
              <option value="onsite">On-site</option>
              <option value="hybrid">Hybrid</option>
            </select>
            <select
              value={draftFilters.sortBy}
              onChange={event =>
                setDraftFilters(prev => ({
                  ...prev,
                  sortBy: event.target.value as Filters['sortBy'],
                }))
              }
              className="min-w-[170px] rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
            >
              <option value="latest">Sort: Latest</option>
              <option value="rating">Sort: Rating</option>
              <option value="rate_low">Sort: Rate Low to High</option>
              <option value="rate_high">Sort: Rate High to Low</option>
            </select>
            <div className="flex min-w-[168px] items-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={draftFilters.verifiedOnly}
                  onChange={event =>
                    setDraftFilters(prev => ({
                      ...prev,
                      verifiedOnly: event.target.checked,
                    }))
                  }
                  className="accent-lajukan-600"
                />
                Verified
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={draftFilters.premiumOnly}
                  onChange={event =>
                    setDraftFilters(prev => ({
                      ...prev,
                      premiumOnly: event.target.checked,
                    }))
                  }
                  className="accent-lajukan-600"
                />
                Premium
              </label>
            </div>
          </div>

          <div className="flex min-h-[32px] flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[color:var(--app-text-soft)]">
              <Filter className="h-3 w-3" /> Filters:
            </span>

            {!hasActiveFilters ? (
              <span className="text-xs italic text-[color:var(--app-text-soft)]">
                None
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {filters.search ? (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    &quot;{filters.search}&quot;
                  </span>
                ) : null}
                {filters.location ? (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    {filters.location}
                  </span>
                ) : null}
                {filters.rating ? (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    Rating {filters.rating}+
                  </span>
                ) : null}
                {filters.workMode ? (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    {filters.workMode}
                  </span>
                ) : null}
                {filters.minRate ? (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    Min {filters.minRate}
                  </span>
                ) : null}
                {filters.maxRate ? (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    Max {filters.maxRate}
                  </span>
                ) : null}
                {filters.verifiedOnly ? (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    Verified
                  </span>
                ) : null}
                {filters.premiumOnly ? (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    Premium
                  </span>
                ) : null}
                <button
                  onClick={resetFilters}
                  className="ml-1 text-[10px] font-bold uppercase text-[color:var(--app-danger)] hover:underline"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          <p className="hidden text-[11px] font-semibold text-[color:var(--app-text-soft)] sm:block">
            Auto-apply filter aktif
          </p>
        </div>
      </header>

      <div className="h-[160px] md:h-[128px] lg:h-[calc(128px+3.5rem+env(safe-area-inset-top))]" />

      <main className="mx-auto max-w-[1500px] px-2 pb-5 sm:px-3">
        <section className="mb-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-xs dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <p className="font-semibold text-[color:var(--app-text)]">
              Loaded Talents
            </p>
            <p className="mt-1 text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {items.length}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-xs dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <p className="font-semibold text-[color:var(--app-text)]">
              Avg Rating
            </p>
            <p className="mt-1 text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {items.length > 0
                ? (
                    items.reduce((sum, item) => sum + item.user.rating, 0) /
                    items.length
                  ).toFixed(1)
                : '-'}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-xs dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <p className="font-semibold text-[color:var(--app-text)]">
              Verified Ratio
            </p>
            <p className="mt-1 text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {items.length > 0
                ? `${Math.round((items.filter(item => item.user.verified).length / items.length) * 100)}%`
                : '-'}
            </p>
          </div>
        </section>

        {topSkills.length > 0 && (
          <section className="mb-4 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <p className="text-xs font-semibold text-[color:var(--app-text)]">
              Top Skills in Results
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {topSkills.map(([skill, count]) => (
                <span
                  key={skill}
                  className="rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]"
                >
                  {skill} ({count})
                </span>
              ))}
            </div>
          </section>
        )}

        {loadError ? (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-[color:color-mix(in_srgb,_var(--app-warning-border)_70%,_transparent)] bg-[color:var(--app-warning-soft)] px-4 py-3 text-xs text-[color:var(--app-warning)]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p>{loadError}</p>
              <button
                onClick={() => loadData(true)}
                className="font-semibold underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {loadingInitial ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="ui-skeleton ui-skeleton-pulse h-64 rounded-2xl"
              />
            ))}
          </div>
        ) : items.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {items.map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: (index % PAGE_SIZE) * 0.03,
                    }}
                  >
                    <div className="space-y-2">
                      <FreelancerCard {...entry} />
                      <div className="flex flex-wrap items-center gap-1.5 px-1">
                        <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]">
                          {entry.workMode}
                        </span>
                        {entry.skills.slice(0, 2).map(skill => (
                          <span
                            key={`${entry.id}-${skill}`}
                            className="rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-accent)]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div
              ref={autoLoadTargetRef}
              className="flex min-h-[72px] w-full flex-col items-center justify-center py-5"
            >
              {loadingMore ? (
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--app-text)]">
                  <Loader2 className="h-4 w-4 animate-spin text-[color:var(--app-accent)]" />
                  Memuat data berikutnya...
                </div>
              ) : hasMore ? (
                <span className="text-xs italic text-[color:var(--app-text-soft)]">
                  Scroll untuk muat otomatis
                </span>
              ) : (
                <span className="text-xs italic text-[color:var(--app-text-soft)]">
                  All freelancers loaded
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <UserSearch className="mb-3 h-12 w-12 text-[color:var(--app-text-soft)]" />
            <h2 className="text-xl font-bold dark:text-[color:var(--app-text-inverse)]">
              No freelancer found
            </h2>
            <p className="mt-2 text-sm text-[color:var(--app-text)]">
              Try adjusting your filters or search keyword.
            </p>
            <button
              onClick={resetFilters}
              className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-[color:var(--app-accent)] px-5 py-2.5 font-bold text-[color:var(--app-text-inverse)] shadow-lg hover:bg-[color:var(--app-accent-strong)]"
            >
              <RotateCcw className="h-4 w-4" />
              Reset filters
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
