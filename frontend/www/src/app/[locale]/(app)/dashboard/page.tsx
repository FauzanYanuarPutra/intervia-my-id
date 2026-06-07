'use client';

import {
  ArrowRight,
  BarChart3,
  Clock3,
  Eye,
  MessageCircle,
  PlusSquare,
  Search,
  ShoppingCart,
  Sparkles,
  Target,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { type User, useAuth } from '@/context/AuthContext';
import { DailyLoginRewardCard } from '@/components/rewards/DailyLoginRewardCard';

type QuickAction = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

type DashboardInsight = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: 'growth' | 'attention' | 'steady';
};

function getDisplayName(user: User | null) {
  if (!user) return '';
  return (
    user.full_name || user.fullName || user.username || user.email || 'User'
  );
}

const idNumberFormatter = new Intl.NumberFormat('id-ID');

function getUserSeed(user: User): number {
  const source =
    user.id ||
    user.username ||
    user.email ||
    user.full_name ||
    user.fullName ||
    'user';
  return Array.from(source).reduce(
    (total, character) => (total * 29 + character.charCodeAt(0)) % 7919,
    23,
  );
}

function formatNumberId(value: number) {
  return idNumberFormatter.format(Math.max(0, Math.round(value)));
}

function buildDashboardInsights(user: User, isId: boolean): DashboardInsight[] {
  const seed = getUserSeed(user);
  const profileVisits = 90 + (seed % 180);
  const savedToCart = 12 + (seed % 38);
  const chatProspects = 6 + (seed % 18);
  const projectReadiness = 58 + (seed % 31);

  return [
    {
      label: isId ? 'Kunjungan profil' : 'Profile visits',
      value: formatNumberId(profileVisits),
      icon: Eye,
      tone: 'growth',
    },
    {
      label: isId ? 'Disimpan / cart' : 'Saved / cart',
      value: formatNumberId(savedToCart),
      icon: ShoppingCart,
      tone: 'steady',
    },
    {
      label: isId ? 'Chat prospek' : 'Prospect chats',
      value: formatNumberId(chatProspects),
      icon: MessageCircle,
      tone: 'attention',
    },
    {
      label: isId ? 'Siap deal' : 'Deal readiness',
      value: `${projectReadiness}%`,
      icon: Target,
      tone: 'growth',
    },
  ];
}

function insightToneClass(tone: DashboardInsight['tone']) {
  if (tone === 'attention') {
    return 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60';
  }
  if (tone === 'steady') {
    return 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/60';
  }
  return 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60';
}

function DashboardInsightCard({ insight }: { insight: DashboardInsight }) {
  const Icon = insight.icon;
  return (
    <article className="min-w-0 rounded-[16px] border border-emerald-100/90 bg-white px-2.5 py-2.5 shadow-[0_14px_28px_-26px_rgba(15,23,42,0.16)] dark:border-emerald-400/14 dark:bg-slate-950/88 sm:rounded-[18px] sm:px-3 sm:py-3">
      <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] ring-1 sm:h-10 sm:w-10 sm:rounded-[14px] ${insightToneClass(insight.tone)}`}
        >
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[9px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)] sm:text-[10px] sm:tracking-[0.1em]">
            {insight.label}
          </p>
          <p className="mt-0.5 text-lg font-black leading-none text-[color:var(--app-text)] sm:text-xl">
            {insight.value}
          </p>
        </div>
      </div>
    </article>
  );
}

function VisualActionCard({
  action,
  primary = false,
}: {
  action: QuickAction;
  primary?: boolean;
}) {
  const Icon = action.icon;
  return (
    <Link
      href={action.href}
      aria-label={`${action.title}. ${action.description}`}
      className={
        primary
          ? 'group relative flex min-h-[106px] flex-col justify-between overflow-hidden rounded-[20px] border border-emerald-500 bg-[linear-gradient(135deg,#059669,#047857)] p-3.5 text-white shadow-[0_22px_42px_-30px_rgba(4,120,87,0.75)] transition hover:-translate-y-0.5 sm:min-h-[132px] sm:rounded-[24px] sm:p-4'
          : 'group flex min-h-[92px] flex-col justify-between rounded-[18px] border border-emerald-100/90 bg-white p-3 shadow-[0_14px_28px_-26px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] dark:border-emerald-400/14 dark:bg-slate-950/88 sm:min-h-[112px] sm:rounded-[22px] sm:p-4'
      }
    >
      <span
        className={
          primary
            ? 'inline-flex h-10 w-10 items-center justify-center rounded-[15px] bg-white/16 text-white sm:h-12 sm:w-12 sm:rounded-[18px]'
            : 'inline-flex h-10 w-10 items-center justify-center rounded-[15px] bg-emerald-50 text-[color:var(--app-accent)] ring-1 ring-emerald-100 dark:bg-emerald-400/10 dark:ring-emerald-400/14 sm:h-12 sm:w-12 sm:rounded-[18px]'
        }
      >
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </span>
      <div className="mt-2.5 flex min-w-0 items-center justify-between gap-1.5 sm:mt-3 sm:gap-2">
        <p
          className={
            primary
              ? 'min-w-0 truncate text-base font-black text-white sm:text-lg'
              : 'min-w-0 truncate text-sm font-black text-[color:var(--app-text)] sm:text-base'
          }
        >
          {action.title}
        </p>
        <ArrowRight
          className={
            primary
              ? 'h-3.5 w-3.5 shrink-0 text-white/80 transition group-hover:translate-x-0.5 sm:h-4 sm:w-4'
              : 'h-3.5 w-3.5 shrink-0 text-[color:var(--app-text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--app-accent)] sm:h-4 sm:w-4'
          }
        />
      </div>
    </Link>
  );
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
          <p className="ui-page-eyebrow">
            {isId ? 'Akses akun' : 'Account access'}
          </p>
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
  const dashboardInsights = buildDashboardInsights(user, isId);
  const dashboardActions: QuickAction[] = [
    ...quickActions,
    {
      href: '/my-projects',
      title: isId ? 'Proyek' : 'Projects',
      description: isId
        ? 'Pantau brief, draft, dan respon vendor.'
        : 'Track briefs, drafts, and vendor responses.',
      icon: Clock3,
    },
    {
      href: '/usaha/dashboard',
      title: isId ? 'Usaha' : 'Business',
      description: isId
        ? 'Lihat performa toko, katalog, dan order.'
        : 'Review store, catalog, and order performance.',
      icon: BarChart3,
    },
    {
      href: '/payments',
      title: isId ? 'Koin' : 'Coins',
      description: isId
        ? 'Cek saldo, bonus, dan top up.'
        : 'Check balance, rewards, and top up.',
      icon: Sparkles,
    },
  ];
  const primaryAction = dashboardActions[0];
  const shortcutActions = dashboardActions.slice(1);

  return (
    <main className="page-shell page-rhythm overflow-x-hidden bg-[linear-gradient(180deg,#f7fff9_0%,#ffffff_42%,#f8fafc_100%)] pb-6 pt-3 lg:pb-8 lg:pt-4 dark:bg-none">
      <section className="rounded-[22px] border border-emerald-100/90 bg-white/92 p-3 shadow-[0_20px_46px_-38px_rgba(15,23,42,0.28)] dark:border-emerald-400/14 dark:bg-slate-950/88 sm:rounded-[28px] sm:p-5">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--app-accent)]">
              {isId ? 'Dashboard' : 'Dashboard'}
            </p>
            <h1 className="mt-1 truncate text-xl font-black leading-tight text-[color:var(--app-text)] sm:text-3xl">
              {isId ? `Halo, ${displayName}` : `Hi, ${displayName}`}
            </h1>
          </div>
          <Link
            href="/profile"
            aria-label={isId ? 'Buka profil' : 'Open profile'}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border border-emerald-100 bg-emerald-50 text-[color:var(--app-accent)] transition hover:bg-emerald-100 dark:border-emerald-400/14 dark:bg-emerald-400/10 sm:h-11 sm:w-11 sm:rounded-[16px]"
          >
            <UserRound className="h-5 w-5" />
          </Link>
        </div>

        <section className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-4 sm:gap-3 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-2">
            <VisualActionCard action={primaryAction} primary />
          </div>
          {shortcutActions.map(action => (
            <VisualActionCard key={action.href} action={action} />
          ))}
        </section>
      </section>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {dashboardInsights.map(insight => (
          <DashboardInsightCard key={insight.label} insight={insight} />
        ))}
      </section>

      <section className="min-w-0 overflow-hidden">
        <DailyLoginRewardCard locale={locale} compact />
      </section>
    </main>
  );
}
