'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildLoginPath } from '@/lib/authRoutes';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';
import { ContextActions } from '@/components/system/navigation/ContextActions';
import { EmptyState } from '@/components/system/feedback/EmptyState';
import {
  MyListingsListSkeleton,
  MyListingsSkeleton,
} from '@/components/system/feedback/RouteSkeletons';
import {
  PHONE_VERIFICATION_SETTINGS_PATH,
  readPhoneVerifiedStatus,
} from '@/lib/identityVerification';

type ListingStatus = 'draft' | 'active' | 'archived';

type ListingItem = {
  id: string;
  slug?: string | null;
  title?: string | null;
  summary?: string | null;
  content_type?: string | null;
  type?: string | null;
  content_status?: string | null;
  status?: string | null;
  updated_at?: string;
  created_at?: string;
  metadata?: Record<string, unknown> | null;
};

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

export default function MyListingsPage() {
  const locale = useLocale() || 'id';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, authFetch } = useAuth();
  const phoneVerified = readPhoneVerifiedStatus(user);
  const currentSearch = searchParams?.toString() || '';

  const [activeStatus, setActiveStatus] = useState<ListingStatus>('draft');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<ListingItem[]>([]);
  const createHref = phoneVerified
    ? '/create'
    : PHONE_VERIFICATION_SETTINGS_PATH;
  const createLabel =
    locale === 'id'
      ? phoneVerified
        ? 'Posting baru'
        : 'Verifikasi Nomor'
      : phoneVerified
        ? 'Post new'
        : 'Verify Phone';

  const statusTabs = useMemo(
    () => [
      { id: 'draft' as const, label: locale === 'id' ? 'Draft' : 'Draft' },
      { id: 'active' as const, label: locale === 'id' ? 'Aktif' : 'Active' },
      {
        id: 'archived' as const,
        label: locale === 'id' ? 'Arsip' : 'Archived',
      },
    ],
    [locale],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(buildLoginPath(locale, pathname, currentSearch));
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
  }, [activeStatus, authFetch, authLoading, currentSearch, locale, pathname, router, user]);

  if (authLoading) {
    return <MyListingsSkeleton />;
  }

  return (
    <div className="min-h-[100svh] bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
      <div className="mx-auto w-full max-w-5xl px-0 py-5 sm:px-4 sm:py-6">
        <div className="rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] dark:bg-[color:var(--app-surface-strong)] sm:rounded-2xl sm:border-x sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {locale === 'id' ? 'Draft & postingan' : 'Drafts and posts'}
              </h1>
              <p className="mt-1 text-xs text-[color:var(--app-text)]">
                {locale === 'id'
                  ? 'Lanjutkan draft, cek yang sudah tayang, lalu posting lagi kalau perlu.'
                  : 'Continue unfinished drafts, check live posts, and keep moving.'}
              </p>
            </div>
            <ContextActions
              primaryAction={{
                id: 'new',
                label: createLabel,
                href: createHref,
              }}
              secondaryActions={[
                {
                  id: 'transactions',
                  label: locale === 'id' ? 'Lihat transaksi' : 'Open transactions',
                  href: '/transactions',
                },
                {
                  id: 'support',
                  label: locale === 'id' ? 'Minta bantuan' : 'Get help',
                  href: '/support',
                },
              ]}
            />
          </div>

          {!phoneVerified && (
            <div className="mt-4 rounded-2xl border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-3 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--app-warning)]">
                    {locale === 'id'
                      ? 'Verifikasi nomor dulu sebelum posting baru'
                      : 'Verify your phone before creating a new listing'}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--app-text)]">
                    {locale === 'id'
                      ? 'Draft lama tetap aman. Jalur posting baru dibuka lagi setelah nomor aktif terverifikasi.'
                      : 'You can still view older drafts, but the new listing flow is gated until an active phone number is verified.'}
                  </p>
                </div>
                <Link
                  href={PHONE_VERIFICATION_SETTINGS_PATH}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[color:var(--app-warning)] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)]"
                >
                  {locale === 'id' ? 'Buka verifikasi' : 'Open verification'}
                </Link>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {statusTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveStatus(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  activeStatus === tab.id
                    ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                    : 'border-[color:var(--app-border)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-xs text-[color:var(--app-danger)]">
              {error}
            </div>
          )}

          {loading ? (
            <MyListingsListSkeleton count={3} />
          ) : items.length === 0 ? (
            <EmptyState
              className="mt-6"
              title={
                !phoneVerified
                  ? locale === 'id'
                    ? 'Verifikasi nomor untuk mulai posting'
                    : 'Verify your phone to start creating listings'
                  : locale === 'id'
                    ? 'Belum ada postingan di status ini'
                    : 'No listings found for this status'
              }
              description={
                !phoneVerified
                  ? locale === 'id'
                    ? 'Setelah nomor aktif diverifikasi, tombol posting baru terbuka normal. Draft lama tetap bisa dicek dari sini.'
                    : 'After your active phone number is verified, posting a new offer becomes available again. Older drafts can still be reviewed here.'
                  : locale === 'id'
                    ? 'Mulai posting baru atau pindah tab untuk cek yang lain.'
                    : 'Start a new post or switch tabs to see the others.'
              }
              action={
                <Link
                  href={createHref}
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-[color:var(--app-accent-strong)] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                >
                  {createLabel}
                </Link>
              }
            />
          ) : (
            <div className="mt-4 space-y-3">
              {items.map(item => {
                const id = parseId(item.id);
                const typeLabel = (
                  item.type ||
                  item.content_type ||
                  'listing'
                ).toUpperCase();
                const itemStatus = (
                  item.content_status ||
                  item.status ||
                  activeStatus
                ).toUpperCase();
                const progress = readProgress(item);

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                          {item.title ||
                            (locale === 'id' ? 'Tanpa judul' : 'Untitled')}
                        </h2>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-text)]">
                            {typeLabel}
                          </span>
                          <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-text)]">
                            {itemStatus}
                          </span>
                          <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                            {formatDate(item.updated_at || item.created_at)}
                          </span>
                        </div>
                        {summarizeText(item.summary) && (
                          <p className="mt-2 text-xs text-[color:var(--app-text-soft)]">
                            {summarizeText(item.summary)}
                          </p>
                        )}
                      </div>
                      <div className="flex w-full flex-col gap-2 min-[420px]:flex-row sm:w-auto">
                        {activeStatus === 'draft' ? (
                          <Link
                            href={`/create?draft=${id}`}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[color:var(--app-warning)] px-3 text-xs font-semibold text-[color:var(--app-text-inverse)]"
                          >
                            {locale === 'id'
                              ? 'Lanjutkan'
                              : 'Continue Draft'}
                          </Link>
                        ) : (
                          <>
                            <Link
                              href={`/create?draft=${id}`}
                              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[color:var(--app-border)] px-3 text-xs font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]"
                            >
                              {locale === 'id' ? 'Edit' : 'Edit'}
                            </Link>
                            <Link
                              href={`/content/${id}`}
                              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[color:var(--app-accent-strong)] px-3 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                            >
                              {locale === 'id' ? 'Lihat hasil' : 'View result'}
                            </Link>
                          </>
                        )}
                      </div>
                    </div>

                    {activeStatus === 'draft' && (
                      <div className="mt-2">
                        <div className="h-2 rounded-full bg-[color:var(--app-surface)] overflow-hidden">
                          <div
                            className="h-full bg-[color:var(--app-warning)]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-[color:var(--app-text)]">
                          {locale === 'id'
                            ? 'Sudah sampai'
                            : 'Current progress'}
                          : {progress}%
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
