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
      title: isId ? 'Buat baru' : 'Create',
      description: isId
        ? 'Tulis kebutuhan atau tawaran.'
        : 'Create a need or offer without extra steps.',
      icon: PlusSquare,
    },
    {
      href: '/search',
      title: isId ? 'Cari' : 'Search',
      description: isId
        ? 'Supplier, jasa, talent.'
        : 'Start from the closest suppliers, services, or talent.',
      icon: Search,
    },
    {
      href: '/chat',
      title: isId ? 'Chat' : 'Chat',
      description: isId
        ? 'Balas yang penting.'
        : 'Reply to important messages and continue active deals.',
      icon: MessageCircle,
    },
    {
      href: '/profile',
      title: isId ? 'Profil' : 'Profile',
      description: isId
        ? 'Biar lebih dipercaya.'
        : 'Tidy your profile so people trust faster.',
      icon: UserRound,
    },
  ];

  if (loading) {
    return (
      <main className="page-shell py-4">
        <div className="ui-panel p-4 text-sm text-[color:var(--app-text-soft)]">
          {isId ? 'Memuat dashboard...' : 'Loading dashboard...'}
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-shell py-4">
        <div className="ui-panel p-4">
          <p className="ui-page-eyebrow">{isId ? 'Akses akun' : 'Account access'}</p>
          <h1 className="ui-page-title mt-2">
            {isId ? 'Dashboard' : 'Dashboard'}
          </h1>
          <p className="ui-page-copy mt-2">
            {isId
              ? 'Login dulu untuk membuka halaman ini.'
              : 'Please sign in to open this page.'}
          </p>
          <Link
            href="/login"
            className="ui-button-primary mt-4 inline-flex items-center gap-2 px-4"
          >
            {isId ? 'Login' : 'Sign in'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  const displayName = getDisplayName(user);
  const primaryAction = quickActions[0];
  const secondaryActions = quickActions.slice(1);
  const PrimaryIcon = primaryAction.icon;

  return (
    <main className="page-shell page-rhythm pb-6 pt-4 lg:pb-8">
      <section className="ui-panel ui-hero-panel p-4">
        <p className="ui-page-eyebrow">
          {isId ? 'Dashboard ringkas' : 'Compact dashboard'}
        </p>
        <h1 className="ui-page-title mt-2">
          {isId ? `Halo, ${displayName}` : `Hi, ${displayName}`}
        </h1>
        <p className="ui-page-copy mt-2">
          {isId
            ? 'Pilih aksi. Lanjut.'
            : 'Pick one action and continue. Key shortcuts stay nearby.'}
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.08fr)_260px]">
          <Link
            href={primaryAction.href}
            className="group overflow-hidden rounded-[20px] border border-[color:color-mix(in_srgb,var(--app-accent)_42%,transparent)] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] p-4 text-[color:var(--app-text-inverse)] shadow-[0_20px_36px_-28px_color-mix(in_srgb,var(--app-accent)_46%,transparent)]"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white/15">
                <PrimaryIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/78">
                  {isId ? 'Utama' : 'Primary'}
                </p>
                <p className="mt-1 text-[1.05rem] font-black tracking-[-0.025em]">
                  {primaryAction.title}
                </p>
                <p className="mt-1.5 max-w-md text-xs leading-5 text-white/86">
                  {primaryAction.description}
                </p>
              </div>
            </div>
            <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold transition group-hover:translate-x-0.5">
              {isId ? 'Gas' : 'Start'}
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>

          <div className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_92%,transparent)] p-3.5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
              {isId ? 'Akun aktif' : 'Active account'}
            </p>
            <p className="mt-2 truncate text-sm font-semibold text-[color:var(--app-text)]">
              {displayName}
            </p>
            <p className="mt-1 truncate text-xs text-[color:var(--app-text-soft)]">
              {user.email}
            </p>
            <Link
              href="/profile"
              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--app-accent)]"
            >
              {isId ? 'Buka profil' : 'Open profile'}
              <ArrowRight className="h-3.5 w-3.5" />
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
              className="ui-page-link-card p-3.5"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[13px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-3 text-sm font-semibold leading-tight text-[color:var(--app-text)]">
                {action.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                {action.description}
              </p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
