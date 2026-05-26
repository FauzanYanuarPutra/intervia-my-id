'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { JobCard } from '@/components/ui-kit';
import { Header } from '@/components/layout/Header';
import { useAppBack } from '@/lib/navigation/useAppBack';
import {
  ChevronLeft,
  Filter,
  Loader2,
  RotateCcw,
  Search,
  TriangleAlert,
} from 'lucide-react';
import {
  asString,
  ContentItem,
  extractContentItems,
  formatIDRFromCents,
  matchAnyFilter,
} from '@/lib/content/catalog';

type JobCardItem = {
  id: string;
  slug: string;
  title: string;
  company: string;
  logo?: string;
  href: string;
  location: string;
  type: string;
  salary: string;
  level: string;
};

type Filters = {
  search: string;
  location: string;
  level: string;
};

const PAGE_SIZE = 12;

function mapContentToJob(item: ContentItem): JobCardItem {
  const meta = item.metadata || {};
  const id = String(item.id);
  const slug = item.slug || id;

  return {
    id,
    slug,
    title: item.title || item.summary || 'Untitled Job',
    company:
      asString(meta.company) ||
      asString(meta.company_name) ||
      asString(meta.organization) ||
      'Unknown Company',
    logo: item.cover_image || asString(meta.logo),
    href: `/jobs/${slug}`,
    location:
      asString(meta.location) || asString(meta.city) || asString(meta.region) || 'Remote',
    type:
      asString(meta.job_type) || asString(meta.employment_type) || asString(item.category) || 'Job',
    salary:
      formatIDRFromCents(item.price_cents) !== '-'
        ? formatIDRFromCents(item.price_cents)
        : asString(meta.salary_range) || 'Negotiable',
    level:
      asString(meta.level) || asString(meta.seniority) || asString(meta.experience_level) || 'Any',
  };
}

function matchesFilters(item: JobCardItem, filters: Filters): boolean {
  const q = filters.search.trim().toLowerCase();
  if (q) {
    const haystack = `${item.title} ${item.company} ${item.location} ${item.type} ${item.level}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  if (filters.location.trim()) {
    const locationMatch = item.location
      .toLowerCase()
      .includes(filters.location.trim().toLowerCase());
    if (!locationMatch) return false;
  }

  if (filters.level.trim()) {
    const levelMatch = item.level.toLowerCase().includes(filters.level.trim().toLowerCase());
    if (!levelMatch) return false;
  }

  return true;
}

export default function JobsClient() {
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
      level: searchParams.get('level') || '',
    }),
    [searchParams],
  );

  const [draftFilters, setDraftFilters] = useState<Filters>(initialFilters);
  const [filters, setFilters] = useState<Filters>(initialFilters);

  const [items, setItems] = useState<JobCardItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleBack = useAppBack(router, fallbackHomePath);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (filters.search.trim()) params.set('q', filters.search.trim());
    else params.delete('q');
    if (filters.location.trim()) params.set('location', filters.location.trim());
    else params.delete('location');
    if (filters.level.trim()) params.set('level', filters.level.trim());
    else params.delete('level');

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    }
  }, [filters, pathname, router, searchParams]);

  const loadJobs = useCallback(
    async (reset: boolean) => {
      if (!reset && (!hasMore || loadingInitial || loadingMore || autoLoadLockRef.current)) return;

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
        params.set('type', 'job');
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(offset));
        if (filters.search.trim()) params.set('q', filters.search.trim());
        if (filters.location.trim()) params.set('location', filters.location.trim());
        if (filters.level.trim()) params.set('level', filters.level.trim());

        const response = await fetch(`/api/content?${params.toString()}`, {
          cache: 'no-store',
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            (payload as { error?: string }).error ||
              `Failed to load jobs (${response.status})`,
          );
        }

        const serverItems = extractContentItems(payload);
        const rawItems = serverItems.filter((entry) => {
          if (!matchAnyFilter(entry, filters.search)) return false;
          const typeText = `${entry.content_type || ''} ${entry.category || ''}`.toLowerCase();
          return typeText.includes('job') || typeText.includes('career') || typeText.includes('loker');
        });
        const mapped = rawItems.map(mapContentToJob).filter((entry) => matchesFilters(entry, filters));

        setItems((prev) => (reset ? mapped : [...prev, ...mapped]));
        setHasMore(serverItems.length === PAGE_SIZE);
        setPage(reset ? 2 : currentPage + 1);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to load job listings';
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
    loadJobs(true);
  }, [filters, loadJobs]);

  const commitFilters = useCallback((nextDraft: Filters) => {
    const next: Filters = {
      search: nextDraft.search.trim(),
      location: nextDraft.location.trim(),
      level: nextDraft.level.trim(),
    };
    setFilters((prev) =>
      prev.search === next.search &&
      prev.location === next.location &&
      prev.level === next.level
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
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingInitial && !loadingMore) {
          loadJobs(false);
        }
      },
      { threshold: 0.01, rootMargin: '600px 0px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadJobs, loadingInitial, loadingMore]);

  const resetFilters = () => {
    const empty = { search: '', location: '', level: '' };
    setDraftFilters(empty);
    setFilters(empty);
  };

  const hasActiveFilters = Boolean(
    filters.search.trim() || filters.location.trim() || filters.level.trim(),
  );

  return (
    <div className="min-h-screen bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
      <div className="hidden lg:block">
        <Header />
      </div>
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
                  placeholder="Search jobs, company, or keyword"
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] py-2.5 pl-11 pr-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                  value={draftFilters.search}
                  onChange={(event) =>
                    setDraftFilters((prev) => ({ ...prev, search: event.target.value }))
                  }
                  onKeyDown={(event) => event.key === 'Enter' && commitFilters(draftFilters)}
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] md:max-w-md md:grid md:grid-cols-2 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
              <input
                type="text"
                placeholder="Location filter"
                value={draftFilters.location}
                onChange={(event) =>
                  setDraftFilters((prev) => ({ ...prev, location: event.target.value }))
                }
                onKeyDown={(event) => event.key === 'Enter' && commitFilters(draftFilters)}
                className="min-w-[150px] rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
              />
              <input
                type="text"
                placeholder="Level filter (senior, mid, junior)"
                value={draftFilters.level}
                onChange={(event) =>
                  setDraftFilters((prev) => ({ ...prev, level: event.target.value }))
                }
                onKeyDown={(event) => event.key === 'Enter' && commitFilters(draftFilters)}
                className="min-w-[180px] rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] focus:border-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
              />
            </div>
          </div>

          <div className="flex min-h-[32px] flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[color:var(--app-text-soft)]">
              <Filter className="h-3 w-3" /> Filters:
            </span>

            {!hasActiveFilters ? (
              <span className="text-xs italic text-[color:var(--app-text-soft)]">None</span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {filters.search && (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    &quot;{filters.search}&quot;
                  </span>
                )}
                {filters.location && (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    {filters.location}
                  </span>
                )}
                {filters.level && (
                  <span className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    {filters.level}
                  </span>
                )}
                <button
                  onClick={resetFilters}
                  className="ml-1 text-[10px] font-bold uppercase text-[color:var(--app-danger)] hover:underline"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          <p className="hidden text-[11px] font-semibold text-[color:var(--app-text-soft)] sm:block">Auto-apply filter aktif</p>
        </div>
      </header>

      <div className="h-[126px] md:h-[112px] lg:h-[calc(112px+3.5rem+env(safe-area-inset-top))]" />

      <main className="mx-auto max-w-[1500px] px-2 pb-5 sm:px-3">
        {loadError ? (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-[color:color-mix(in_srgb,_var(--app-warning-border)_70%,_transparent)] bg-[color:var(--app-warning-soft)] px-4 py-3 text-xs text-[color:var(--app-warning)]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p>{loadError}</p>
              <button
                onClick={() => loadJobs(true)}
                className="font-semibold underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {loadingInitial ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <div
                key={index}
                className="ui-skeleton ui-skeleton-pulse h-48 rounded-2xl"
              />
            ))}
          </div>
        ) : items.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {items.map((job, index) => (
                  <motion.div
                    key={job.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: (index % PAGE_SIZE) * 0.03 }}
                  >
                    <JobCard {...job} />
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
                <span className="text-xs italic text-[color:var(--app-text-soft)]">Scroll untuk muat otomatis</span>
              ) : (
                <span className="text-xs italic text-[color:var(--app-text-soft)]">All job listings loaded</span>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <h2 className="text-xl font-bold dark:text-[color:var(--app-text-inverse)]">No jobs found</h2>
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
