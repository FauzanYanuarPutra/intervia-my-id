'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Earth,
  Lock,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { LajukanImage } from '@/components/common/LajukanImage';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/system/feedback/ToastProvider';
import { Link, useRouter } from '@/i18n/navigation';
import type { CommunityGroup } from '@/lib/community/types';
import { cn } from '@/lib/utils';

type Scope = 'all' | 'joined' | 'recommended';

type GroupsResponse = {
  data?: CommunityGroup[];
  error?: string;
};

function compactNumber(value: number | undefined) {
  const safe = Math.max(Number(value || 0), 0);
  if (safe >= 1_000_000) return `${(safe / 1_000_000).toFixed(1)}M`;
  if (safe >= 1_000) return `${(safe / 1_000).toFixed(1)}K`;
  return String(safe);
}

function avatarLetter(group: CommunityGroup) {
  return group.name.trim().slice(0, 1).toUpperCase() || 'G';
}

function privacyLabel(group: CommunityGroup, isId: boolean) {
  return group.privacy === 'public'
    ? isId
      ? 'Publik'
      : 'Public'
    : isId
      ? 'Privat'
      : 'Private';
}

export default function CommunityGroupDirectoryClient({
  isId,
}: {
  isId: boolean;
}) {
  const router = useRouter();
  const { isAuthenticated, authFetch } = useAuth();
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '60' });
      if (query.trim()) params.set('q', query.trim());
      if (scope !== 'all') params.set('scope', scope);

      const response = await fetch(
        `/api/community/groups?${params.toString()}`,
        {
          cache: 'no-store',
          credentials: 'include',
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as GroupsResponse;

      if (!response.ok) {
        throw new Error(payload.error || 'groups_unavailable');
      }

      setGroups(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [query, scope]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => void loadGroups(),
      query.trim() ? 240 : 0,
    );

    return () => window.clearTimeout(timer);
  }, [loadGroups, query]);

  const joinOrLeave = async (group: CommunityGroup) => {
    if (!isAuthenticated) {
      router.push(
        `/login?callbackUrl=${encodeURIComponent('/community/groups')}`,
      );
      return;
    }

    const joined = group.viewerMembershipStatus === 'active';

    if (group.viewerRole === 'owner') {
      router.push(
        `/community/groups/${encodeURIComponent(group.slug || group.id)}`,
      );
      return;
    }

    setBusyId(group.id);

    try {
      const response = await authFetch(
        `/api/community/groups/${encodeURIComponent(group.id)}/${joined ? 'leave' : 'join'}`,
        { method: 'POST' },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as GroupsResponse;

      if (!response.ok) {
        throw new Error(payload.error || 'group_action_failed');
      }

      await loadGroups();

      notify({
        title: joined
          ? isId
            ? 'Keluar dari grup'
            : 'Left group'
          : group.membershipPermission === 'approval'
            ? isId
              ? 'Permintaan join dikirim'
              : 'Join request sent'
            : isId
              ? 'Berhasil join grup'
              : 'Joined group',
        variant: 'success',
      });
    } catch (error) {
      notify({
        title: isId ? 'Aksi grup gagal' : 'Group action failed',
        description: error instanceof Error ? error.message : '',
        variant: 'error',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="lajukan-home-compact min-h-screen bg-[color:var(--app-surface-muted)] px-1 pb-8 pt-3 sm:px-2 lg:px-0 lg:pt-0">
      <div className="mx-auto w-full max-w-[1320px] space-y-3">
        <header className="rounded-[26px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_18px_42px_-36px_rgba(15,23,42,0.24)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                href="/community"
                className="text-[11px] font-bold text-[color:var(--app-accent)]"
              >
                ← {isId ? 'Kembali ke Komunitas' : 'Back to Community'}
              </Link>
              <h1 className="mt-2 text-2xl font-black tracking-[-0.045em] text-[color:var(--app-text)] sm:text-3xl">
                {isId ? 'Grup komunitas' : 'Community groups'}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Temukan komunitas berdasarkan topik, gabung, lalu ikut diskusi yang relevan.'
                  : 'Discover topic-based communities, join them, and take part in relevant discussions.'}
              </p>
            </div>

            <Link
              href="/community/groups/new"
              className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 text-sm font-bold text-white shadow-[0_16px_28px_-22px_rgba(16,185,129,0.85)]"
            >
              <Plus className="h-4 w-4" />
              {isId ? 'Buat grup' : 'Create group'}
            </Link>
          </div>

          <div className="mt-4 flex min-h-11 items-center gap-2 rounded-[15px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 focus-within:border-[color:var(--app-accent-border)] focus-within:bg-white">
            <Search className="h-4 w-4 text-[color:var(--app-text-soft)]" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={isId ? 'Cari grup...' : 'Search groups...'}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>

          <nav
            className="mt-3 flex gap-2 overflow-x-auto"
            aria-label={isId ? 'Filter grup' : 'Group filters'}
          >
            {(
              [
                ['all', isId ? 'Semua' : 'All'],
                ['joined', isId ? 'Sudah join' : 'Joined'],
                ['recommended', isId ? 'Disarankan' : 'Recommended'],
              ] as Array<[Scope, string]>
            ).map(([nextScope, label]) => (
              <button
                key={nextScope}
                type="button"
                onClick={() => setScope(nextScope)}
                className={cn(
                  'inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-xs font-bold transition',
                  scope === nextScope
                    ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
                    : 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)] hover:border-[color:var(--app-accent-border)]',
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        </header>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-72 animate-pulse rounded-[22px] border border-[color:var(--app-border)] bg-white"
              />
            ))}
          </div>
        ) : groups.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map(group => {
              const joined = group.viewerMembershipStatus === 'active';
              const pending = group.viewerMembershipStatus === 'pending';

              return (
                <article
                  key={group.id}
                  className="overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-white shadow-[0_16px_34px_-30px_rgba(15,23,42,0.24)]"
                >
                  <Link
                    href={
                      '/community/groups/' +
                      encodeURIComponent(group.slug || group.id)
                    }
                    className="group block"
                  >
                    <div className="relative aspect-[2.35/1] overflow-hidden bg-[linear-gradient(135deg,#ecfdf5,#eff6ff)]">
                      {group.coverUrl ? (
                        <LajukanImage
                          src={group.coverUrl}
                          alt=""
                          fill
                          sizes="(max-width: 768px) 100vw, 420px"
                          className="object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(16,185,129,.28),transparent_35%),radial-gradient(circle_at_85%_20%,rgba(59,130,246,.22),transparent_30%)]" />
                      )}

                      <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-text)] shadow-sm">
                        {group.privacy === 'public' ? (
                          <Earth className="h-3 w-3 text-[color:var(--app-accent)]" />
                        ) : (
                          <Lock className="h-3 w-3" />
                        )}
                        {privacyLabel(group, isId)}
                      </div>
                    </div>

                    <div className="relative px-3.5 pb-3.5">
                      <div className="-mt-8 grid h-16 w-16 place-items-center overflow-hidden rounded-[19px] border-[3px] border-white bg-[color:var(--app-accent-soft)] text-xl font-black text-[color:var(--app-accent)] shadow-[0_18px_28px_-24px_rgba(15,23,42,0.45)]">
                        {group.avatarUrl ? (
                          <LajukanImage
                            src={group.avatarUrl}
                            alt=""
                            width={64}
                            height={64}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          avatarLetter(group)
                        )}
                      </div>

                      <h2 className="mt-2 truncate text-base font-black text-[color:var(--app-text)]">
                        {group.name}
                      </h2>

                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                        <span>
                          {compactNumber(group.memberCount)}{' '}
                          {isId ? 'anggota' : 'members'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {compactNumber(group.postCount)}{' '}
                          {isId ? 'post' : 'posts'}
                        </span>
                      </div>

                      <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        {group.description}
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 border-t border-[color:var(--app-border)] px-3.5 py-3">
                    <Link
                      href={
                        '/community/groups/' +
                        encodeURIComponent(group.slug || group.id)
                      }
                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-[12px] border border-[color:var(--app-border)] bg-white text-xs font-bold text-[color:var(--app-text)]"
                    >
                      {isId ? 'Lihat grup' : 'View group'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => void joinOrLeave(group)}
                      disabled={busyId === group.id || pending}
                      className={cn(
                        'inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[12px] px-3 text-xs font-bold disabled:opacity-60',
                        joined
                          ? 'border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]'
                          : 'bg-[color:var(--app-accent)] text-white',
                      )}
                    >
                      {busyId === group.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : joined ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : (
                        <Users className="h-4 w-4" />
                      )}
                      {pending
                        ? 'Pending'
                        : joined
                          ? isId
                            ? 'Sudah join'
                            : 'Joined'
                          : isId
                            ? 'Gabung'
                            : 'Join'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <section className="rounded-[24px] border border-dashed border-emerald-200 bg-white p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-[color:var(--app-accent)]">
              <Users className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-black text-[color:var(--app-text)]">
              {isId ? 'Belum ada grup yang cocok' : 'No matching groups yet'}
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Coba kata kunci lain atau buat grup baru untuk topik usaha kamu.'
                : 'Try another search or create a new group for your business topic.'}
            </p>
            <Link
              href="/community/groups/new"
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 text-xs font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              {isId ? 'Buat grup' : 'Create group'}
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
