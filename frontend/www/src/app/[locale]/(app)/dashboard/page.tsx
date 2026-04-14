'use client';

import {
  ArrowRight,
  MessageCircle,
  PlusSquare,
  Search,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { type User, useAuth } from '@/context/AuthContext';

type QuickAction = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

function getDisplayName(user: User | null) {
  if (!user) return '';
  return user.full_name || user.fullName || user.username || user.email || 'User';
}

export default function DashboardPage() {
  const locale = useLocale();
  const isId = locale === 'id';
  const { user, loading } = useAuth();

  const quickActions: QuickAction[] = [
    {
      href: '/create?mode=quick',
      title: isId ? 'Posting cepat' : 'Quick post',
      description: isId
        ? 'Buat kebutuhan atau penawaran tanpa langkah tambahan.'
        : 'Create a need or offer without extra steps.',
      icon: PlusSquare,
    },
    {
      href: '/search',
      title: isId ? 'Cari' : 'Search',
      description: isId
        ? 'Cari supplier, jasa, atau talent yang paling dekat dulu.'
        : 'Start from the closest suppliers, services, or talent.',
      icon: Search,
    },
    {
      href: '/chat',
      title: isId ? 'Chat' : 'Chat',
      description: isId
        ? 'Balas pesan penting dan lanjutkan deal aktif.'
        : 'Reply to important messages and continue active deals.',
      icon: MessageCircle,
    },
    {
      href: '/profile',
      title: isId ? 'Profil' : 'Profile',
      description: isId
        ? 'Rapikan profil supaya orang lebih cepat percaya.'
        : 'Tidy your profile so people trust faster.',
      icon: UserRound,
    },
  ];

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <div className="rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-6 text-sm text-[color:var(--app-text-soft)]">
          {isId ? 'Memuat dashboard...' : 'Loading dashboard...'}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <div className="rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-6">
          <h1 className="text-2xl font-semibold text-[color:var(--app-text)]">
            {isId ? 'Dashboard' : 'Dashboard'}
          </h1>
          <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
            {isId
              ? 'Login dulu untuk membuka halaman ini.'
              : 'Please sign in to open this page.'}
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--app-text-inverse)]"
          >
            {isId ? 'Login' : 'Sign in'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const displayName = getDisplayName(user);
  const primaryAction = quickActions[0];
  const secondaryActions = quickActions.slice(1);
  const PrimaryIcon = primaryAction.icon;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6">
      <section className="rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
          {isId ? 'Dashboard ringkas' : 'Compact dashboard'}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--app-text)]">
          {isId ? `Halo, ${displayName}` : `Hi, ${displayName}`}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--app-text-soft)]">
          {isId
            ? 'Pilih satu aksi utama lalu lanjut. Yang lain tetap dekat kalau dibutuhkan.'
            : 'Pick one main action and continue. The rest stay close if needed.'}
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
          <Link
            href={primaryAction.href}
            className="rounded-[28px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] p-5 text-[color:var(--app-text-inverse)] shadow-[0_22px_48px_-28px_color-mix(in_srgb,var(--app-accent)_40%,transparent)]"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
              <PrimaryIcon className="h-5 w-5" />
            </span>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-white/80">
              {isId ? 'Aksi utama' : 'Primary action'}
            </p>
            <p className="mt-1 text-2xl font-black tracking-[-0.04em]">
              {primaryAction.title}
            </p>
            <p className="mt-2 max-w-md text-sm text-white/88">
              {primaryAction.description}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
              {isId ? 'Mulai sekarang' : 'Start now'}
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
              {isId ? 'Akun aktif' : 'Active account'}
            </p>
            <p className="mt-2 text-base font-semibold text-[color:var(--app-text)]">
              {displayName}
            </p>
            <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
              {user.email}
            </p>
            <Link
              href="/profile"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--app-accent)]"
            >
              {isId ? 'Buka profil' : 'Open profile'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {secondaryActions.map(action => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 transition hover:border-[color:var(--app-accent-border)]"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--app-surface-muted)] text-[color:var(--app-accent)]">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-[color:var(--app-text)]">
                {action.title}
              </p>
              <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                {action.description}
              </p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
