'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Clapperboard,
  Bot,
  Briefcase,
  CircleDot,
  Database,
  FileText,
  GitBranch,
  MessageCircle,
  PlusSquare,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Zap,
  Users,
  Workflow,
} from 'lucide-react';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';

type OverviewPayload = {
  generated_at: string;
  overview: {
    active_transactions: number;
    unread_messages: number;
    active_leads: number;
    open_support_tickets: number;
    published_content: number;
    weekly_throughput: number;
  };
  flow_recommendations: Array<{
    id: string;
    status: string;
    title: string;
    description: string;
    steps: string[];
    href: string;
  }>;
  operating_system?: {
    health_score: number;
    focus_lane: {
      id: string;
      title: string;
      description: string;
      href: string;
    };
    system_relations: Array<{
      id: string;
      from: string;
      to: string;
      title: string;
      signal: string;
      automation: string;
      href: string;
      priority: 'critical' | 'high' | 'medium';
    }>;
    automation_queue: Array<{
      id: string;
      title: string;
      trigger: string;
      action: string;
      impact: string;
      href: string;
    }>;
    ai_copilot_actions: Array<{
      id: string;
      title: string;
      prompt: string;
      output: string;
      href: string;
    }>;
    retention_loops: Array<{
      id: string;
      title: string;
      loop: string;
      reward: string;
      metric: string;
    }>;
    trust_controls: Array<{
      id: string;
      title: string;
      guardrail: string;
      signal: string;
    }>;
    data_flows: Array<{
      id: string;
      source: string;
      enriches: string;
      usedBy: string;
    }>;
  };
};

type Tone = 'sky' | 'emerald' | 'amber' | 'rose' | 'slate';

type PriorityItem = {
  id: string;
  count: number;
  href: string;
  icon: typeof MessageCircle;
  tone: Tone;
  title: string;
  description: string;
};

type ShortcutItem = {
  id: string;
  href: string;
  icon: typeof MessageCircle;
  tone: Tone;
  title: string;
  description: string;
};

function toInt(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function formatRelativeTime(iso: string, isId: boolean): string {
  if (!iso) return isId ? 'baru saja' : 'just now';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return isId ? 'baru saja' : 'just now';
  const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (minutes < 1) return isId ? 'baru saja' : 'just now';
  if (minutes < 60) return isId ? `${minutes} m lalu` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isId ? `${hours} j lalu` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return isId ? `${days} h lalu` : `${days}d ago`;
}

function toneClass(tone: Tone): string {
  if (tone === 'sky') {
    return 'border-teal-200 bg-teal-50 text-teal-700';
  }
  if (tone === 'emerald') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (tone === 'amber') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (tone === 'rose') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function relationPriorityClass(priority: 'critical' | 'high' | 'medium') {
  if (priority === 'critical') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (priority === 'high') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

export function BusinessOsCommandCenter() {
  const locale = useLocale();
  const isId = locale === 'id';
  const { user, loading: authLoading, authFetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<OverviewPayload | null>(null);

  const loadOverview = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      if (silent) setRefreshing(true);
      setError('');

      try {
        const res = await authFetch('/api/business-os/overview', {
          cache: 'no-store',
        });
        const data = (await res
          .json()
          .catch(() => null)) as OverviewPayload | null;

        if (!res.ok || !data) {
          throw new Error(
            isId
              ? 'Gagal memuat dashboard kerja'
              : 'Failed to load work dashboard',
          );
        }

        setPayload(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : isId
              ? 'Gagal memuat dashboard kerja'
              : 'Failed to load work dashboard',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authFetch, isId],
  );

  useEffect(() => {
    if (authLoading || !user?.id) return;
    void loadOverview();
  }, [authLoading, user?.id, loadOverview]);

  const displayName =
    user?.full_name ||
    user?.fullName ||
    user?.username ||
    user?.email ||
    'User';
  const dashboardAvatar = profileAvatarSrc(
    user?.avatarUrl || user?.avatar_url || user?.metadata?.avatar_url,
    readProfileAvatarStyle(user),
    displayName,
  );

  const unreadMessages = toInt(payload?.overview.unread_messages);
  const activeTransactions = PROMO_ONLY_MODE
    ? 0
    : toInt(payload?.overview.active_transactions);
  const activeLeads = toInt(payload?.overview.active_leads);
  const openSupportTickets = toInt(payload?.overview.open_support_tickets);
  const publishedContent = toInt(payload?.overview.published_content);
  const weeklyThroughput = toInt(payload?.overview.weekly_throughput);

  const priorityItems = useMemo<PriorityItem[]>(() => {
    const items: PriorityItem[] = [];

    if (unreadMessages > 0) {
      items.push({
        id: 'chat',
        count: unreadMessages,
        href: '/chat',
        icon: MessageCircle,
        tone: 'sky',
        title: isId ? 'Balas chat dulu' : 'Reply to chats first',
        description: isId
          ? `${unreadMessages} chat belum dibalas. Ini paling cepat jadi respon.`
          : `${unreadMessages} chats are waiting. This is the fastest response to unlock.`,
      });
    }

    if (!PROMO_ONLY_MODE && activeTransactions > 0) {
      items.push({
        id: 'transactions',
        count: activeTransactions,
        href: '/transactions',
        icon: Workflow,
        tone: 'amber',
        title: isId ? 'Pantau transaksi aktif' : 'Review active transactions',
        description: isId
          ? `${activeTransactions} transaksi masih jalan dan perlu dipantau.`
          : `${activeTransactions} transactions are still active and need attention.`,
      });
    }

    if (openSupportTickets > 0) {
      items.push({
        id: 'support',
        count: openSupportTickets,
        href: '/support',
        icon: ShieldCheck,
        tone: 'rose',
        title: isId ? 'Bereskan tiket bantuan' : 'Resolve support tickets',
        description: isId
          ? `${openSupportTickets} tiket masih terbuka. Jangan dibiarkan menumpuk.`
          : `${openSupportTickets} support tickets are still open.`,
      });
    }

    if (activeLeads > 0) {
      items.push({
        id: 'leads',
        count: activeLeads,
        href: '/search',
        icon: Briefcase,
        tone: 'emerald',
        title: isId
          ? 'Lanjutkan peluang aktif'
          : 'Continue active opportunities',
        description: isId
          ? `${activeLeads} peluang masih bisa ditutup jadi hasil.`
          : `${activeLeads} opportunities can still be pushed forward.`,
      });
    }

    return items.slice(0, 4);
  }, [
    activeLeads,
    activeTransactions,
    isId,
    openSupportTickets,
    unreadMessages,
  ]);

  const shortcuts = useMemo<ShortcutItem[]>(
    () => [
      {
        id: 'chat',
        href: '/chat',
        icon: MessageCircle,
        tone: 'sky',
        title: isId ? 'Chat' : 'Chat',
        description: isId
          ? 'Lihat pesan dan balas cepat.'
          : 'Open inbox and reply fast.',
      },
      ...(!PROMO_ONLY_MODE
        ? [
          {
            id: 'transactions',
            href: '/transactions',
            icon: Workflow,
            tone: 'amber' as Tone,
            title: isId ? 'Transaksi' : 'Transactions',
            description: isId
              ? 'Pantau order yang masih jalan.'
              : 'Review orders that are still moving.',
          },
        ]
        : []),
      {
        id: 'listings',
        href: '/my-listings',
        icon: FileText,
        tone: 'emerald',
        title: isId ? 'Postingan saya' : 'My listings',
        description: isId
          ? 'Cek yang tayang dan yang belum rapi.'
          : 'Check live listings and unfinished ones.',
      },
      {
        id: 'business',
        href: '/usaha',
        icon: Briefcase,
        tone: 'emerald',
        title: isId ? 'Kelola usaha' : 'Manage business',
        description: isId
          ? 'Edit profil, katalog, dan tim usaha.'
          : 'Edit profile, catalog, and team.',
      },
      {
        id: 'reels',
        href: '/reels',
        icon: Clapperboard,
        tone: 'sky',
        title: isId ? 'Kelola reels' : 'Manage reels',
        description: isId
          ? 'Upload, edit, dan pantau reels.'
          : 'Upload, edit, and review reels.',
      },
      {
        id: 'community',
        href: '/community',
        icon: Users,
        tone: 'slate',
        title: isId ? 'Kelola komunitas' : 'Manage community',
        description: isId
          ? 'Posting dan diskusi komunitas di satu tempat.'
          : 'Manage posts and discussions in one place.',
      },
      {
        id: 'create',
        href: '/create?mode=quick',
        icon: PlusSquare,
        tone: 'rose',
        title: isId ? 'Pasang cepat' : 'Quick post',
        description: isId
          ? 'Mulai dari judul, harga, dan lokasi.'
          : 'Start from title, price, and location.',
      },
      {
        id: 'search',
        href: '/search',
        icon: Search,
        tone: 'slate',
        title: isId ? 'Buka pencarian' : 'Open search',
        description: isId
          ? 'Cari stok, partner, atau jasa.'
          : 'Find stock, partners, or services.',
      },
    ],
    [isId],
  );

  const flowRecommendations = useMemo(
    () => (payload?.flow_recommendations || []).slice(0, 2),
    [payload?.flow_recommendations],
  );
  const operatingSystem = payload?.operating_system;
  const topRelations = useMemo(
    () =>
      (operatingSystem?.system_relations || [])
        .filter(item =>
          PROMO_ONLY_MODE ? !item.href.startsWith('/transactions') : true,
        )
        .slice(0, 3),
    [operatingSystem?.system_relations],
  );
  const topAutomations = useMemo(
    () =>
      (operatingSystem?.automation_queue || [])
        .filter(item =>
          PROMO_ONLY_MODE ? !item.href.startsWith('/transactions') : true,
        )
        .slice(0, 3),
    [operatingSystem?.automation_queue],
  );
  const topAiActions = useMemo(
    () =>
      (operatingSystem?.ai_copilot_actions || [])
        .filter(item =>
          PROMO_ONLY_MODE ? !item.href.startsWith('/transactions') : true,
        )
        .slice(0, 3),
    [operatingSystem?.ai_copilot_actions],
  );
  const topTrustControls = useMemo(
    () => (operatingSystem?.trust_controls || []).slice(0, 2),
    [operatingSystem?.trust_controls],
  );
  const topDataFlows = useMemo(
    () => (operatingSystem?.data_flows || []).slice(0, 2),
    [operatingSystem?.data_flows],
  );

  if (authLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 text-sm text-[color:var(--app-text-soft)]">
          {isId ? 'Memuat dashboard kerja...' : 'Loading work dashboard...'}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-6">
          <p className="text-sm text-[color:var(--app-text-soft)]">
            {isId
              ? 'Login dulu untuk membuka dashboard kerja.'
              : 'Please login first to open your work dashboard.'}
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex items-center rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--app-text-inverse)]"
          >
            {isId ? 'Login' : 'Login'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <section className="overflow-hidden rounded-[32px] border border-[color:var(--app-border)] bg-[linear-gradient(160deg,color-mix(in_srgb,var(--app-surface-strong)_96%,white_4%),color-mix(in_srgb,var(--app-accent-soft)_22%,var(--app-surface-strong)_78%))] p-5 shadow-[0_24px_54px_-36px_rgba(15,23,42,0.28)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex max-w-full items-center gap-3 rounded-[22px] border border-[color:var(--app-border)] bg-white/80 px-3 py-2 shadow-sm ">
              <Image
                src={dashboardAvatar}
                alt={displayName}
                width={40}
                height={40}
                className="h-10 w-10 rounded-2xl border border-[color:var(--app-accent-border)] object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--app-text)]">
                  {displayName}
                </p>
                <p className="truncate text-[12px] text-[color:var(--app-text-soft)]">
                  {user.email}
                </p>
              </div>
            </div>

            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--app-accent)]">
              {isId ? 'Dashboard kerja' : 'Work dashboard'}
            </p>
            <h1 className="mt-2 text-[1.9rem] font-bold leading-tight tracking-[-0.04em] text-[color:var(--app-text)] sm:text-[2.4rem]">
              {isId
                ? 'Buka yang perlu dikerjakan sekarang.'
                : 'Open what needs your attention now.'}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)]">
              {isId
                ? PROMO_ONLY_MODE
                  ? 'Dashboard ini dipadatkan untuk launch awal. Fokus ke chat, postingan, profil usaha, dan data yang bikin promosi makin kuat.'
                  : 'Dashboard ini sengaja dipadatkan. Fokus ke chat, transaksi, postingan, dan langkah berikutnya yang paling dekat hasilnya.'
                : PROMO_ONLY_MODE
                  ? 'This launch dashboard focuses on chats, listings, business profiles, and data that strengthens promotion.'
                  : 'This dashboard is intentionally compact. Focus on chats, transactions, listings, and the next action closest to results.'}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[color:var(--app-border)] bg-white/82 px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)]">
              <CircleDot className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
              {isId ? 'Update' : 'Updated'}{' '}
              {formatRelativeTime(payload?.generated_at || '', isId)}
            </span>
            <button
              type="button"
              onClick={() => void loadOverview(true)}
              className="inline-flex items-center rounded-full border border-[color:var(--app-border)] bg-white/82 px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)] hover:bg-white disabled:opacity-60"
              disabled={loading || refreshing}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              />
              {isId ? 'Muat ulang' : 'Refresh'}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-[24px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-4 py-3 text-sm text-[color:var(--app-danger)]">
          <AlertCircle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            id: 'stat-chat',
            label: isId ? 'Chat belum dibalas' : 'Unread chats',
            value: unreadMessages,
            icon: MessageCircle,
            tone: 'sky' as Tone,
          },
          ...(!PROMO_ONLY_MODE
            ? [
              {
                id: 'stat-transactions',
                label: isId ? 'Transaksi aktif' : 'Active transactions',
                value: activeTransactions,
                icon: Workflow,
                tone: 'amber' as Tone,
              },
            ]
            : []),
          {
            id: 'stat-content',
            label: isId ? 'Posting tayang' : 'Live listings',
            value: publishedContent,
            icon: FileText,
            tone: 'emerald' as Tone,
          },
          {
            id: 'stat-weekly',
            label: isId ? 'Aktivitas 7 hari' : '7-day activity',
            value: weeklyThroughput,
            icon: Briefcase,
            tone: 'slate' as Tone,
          },
        ].map(item => {
          const Icon = item.icon;
          return (
            <article
              key={item.id}
              className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.24)]"
            >
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${toneClass(item.tone)}`}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <p className="mt-3 text-[1.55rem] font-bold leading-none tracking-[-0.04em] text-[color:var(--app-text)]">
                {item.value}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                {item.label}
              </p>
            </article>
          );
        })}
      </section>

      {operatingSystem ? (
        <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
          <article className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_20px_46px_-36px_rgba(15,23,42,0.22)] sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
                  {isId ? 'Operating system' : 'Operating system'}
                </p>
                <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-[color:var(--app-text)]">
                  {operatingSystem.focus_lane.title}
                </h2>
                <p className="mt-2 text-[13px] leading-5 text-[color:var(--app-text-soft)]">
                  {operatingSystem.focus_lane.description}
                </p>
              </div>
              <div className="shrink-0 rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
                  {isId ? 'Skor' : 'Score'}
                </p>
                <p className="mt-1 text-3xl font-bold tracking-[-0.06em] text-[color:var(--app-text)]">
                  {operatingSystem.health_score}
                </p>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--app-accent),var(--app-accent-strong))]"
                style={{ width: `${operatingSystem.health_score}%` }}
              />
            </div>

            <Link
              href={operatingSystem.focus_lane.href}
              className="mt-4 inline-flex items-center rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-[12px] font-semibold text-[color:var(--app-text-inverse)]"
            >
              {isId ? 'Kerjakan fokus ini' : 'Work this focus'}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>

            <div className="mt-5 space-y-3">
              {topRelations.map(relation => (
                <Link
                  key={relation.id}
                  href={relation.href}
                  className="group block rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3.5 transition hover:border-[color:var(--app-accent-border)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${relationPriorityClass(relation.priority)}`}
                      >
                        <GitBranch className="h-3.5 w-3.5" />
                        {relation.from}
                        {' -> '}
                        {relation.to}
                      </span>
                      <h3 className="mt-2 text-sm font-bold text-[color:var(--app-text)]">
                        {relation.title}
                      </h3>
                      <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                        {relation.automation}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--app-text-soft)] transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          </article>

          <div className="grid gap-5">
            <article className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_20px_46px_-36px_rgba(15,23,42,0.22)] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
                    AI + automation
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                    {isId
                      ? 'Saran otomatis yang mengikat data lintas fitur.'
                      : 'Automated suggestions tied to cross-feature data.'}
                  </p>
                </div>
                <Zap className="h-5 w-5 shrink-0 text-[color:var(--app-accent)]" />
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  {topAiActions.map(action => (
                    <Link
                      key={action.id}
                      href={action.href}
                      className="block rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3"
                    >
                      <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
                        <Bot className="h-4 w-4 text-[color:var(--app-accent)]" />
                        {action.title}
                      </p>
                      <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                        {action.output}
                      </p>
                    </Link>
                  ))}
                </div>
                <div className="space-y-2">
                  {topAutomations.map(action => (
                    <Link
                      key={action.id}
                      href={action.href}
                      className="block rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3"
                    >
                      <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
                        <Workflow className="h-4 w-4 text-[color:var(--app-accent)]" />
                        {action.title}
                      </p>
                      <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                        {action.trigger}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </article>

            <section className="grid gap-5 lg:grid-cols-2">
              <article className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_20px_46px_-36px_rgba(15,23,42,0.22)] sm:p-5">
                <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
                  <ShieldCheck className="h-4 w-4 text-[color:var(--app-accent)]" />
                  {isId ? 'Trust guardrail' : 'Trust guardrail'}
                </p>
                <div className="mt-3 space-y-2">
                  {topTrustControls.map(item => (
                    <div
                      key={item.id}
                      className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3"
                    >
                      <p className="text-[13px] font-bold text-[color:var(--app-text)]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                        {item.guardrail}
                      </p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_20px_46px_-36px_rgba(15,23,42,0.22)] sm:p-5">
                <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
                  <Database className="h-4 w-4 text-[color:var(--app-accent)]" />
                  {isId ? 'Data flow' : 'Data flow'}
                </p>
                <div className="mt-3 space-y-2">
                  {topDataFlows.map(item => (
                    <div
                      key={item.id}
                      className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3"
                    >
                      <p className="text-[13px] font-bold text-[color:var(--app-text)]">
                        {item.source}
                      </p>
                      <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                        {item.usedBy}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            {operatingSystem.retention_loops.length > 0 ? (
              <article className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_20px_46px_-36px_rgba(15,23,42,0.22)] sm:p-5">
                <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
                  <RotateCcw className="h-4 w-4 text-[color:var(--app-accent)]" />
                  {isId ? 'Retention loop' : 'Retention loop'}
                </p>
                <div className="mt-3 grid gap-2 lg:grid-cols-3">
                  {operatingSystem.retention_loops.slice(0, 3).map(loop => (
                    <div
                      key={loop.id}
                      className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3"
                    >
                      <p className="text-[13px] font-bold text-[color:var(--app-text)]">
                        {loop.title}
                      </p>
                      <p className="mt-1 line-clamp-3 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                        {loop.loop}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_20px_46px_-36px_rgba(15,23,42,0.22)] sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
              {isId ? 'Perlu ditindak dulu' : 'Needs attention first'}
            </p>
            <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
              {isId
                ? 'Ambil yang paling cepat menghasilkan respon atau keputusan.'
                : 'Pick what leads to the fastest response or decision.'}
            </p>
          </div>
          <Link
            href="/my-listings"
            className="inline-flex items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-1.5 text-[12px] font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-strong)]"
          >
            {isId ? 'Lihat postingan' : 'View listings'}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </div>

        {priorityItems.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {priorityItems.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${toneClass(item.tone)}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {item.count}
                      </span>
                      <h2 className="mt-3 text-base font-bold leading-tight text-[color:var(--app-text)]">
                        {item.title}
                      </h2>
                      <p className="mt-1 text-[13px] leading-5 text-[color:var(--app-text-soft)]">
                        {item.description}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--app-text-soft)] transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-[24px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-5">
            <h2 className="text-base font-bold text-[color:var(--app-text)]">
              {isId ? 'Belum ada yang mendesak.' : 'Nothing urgent right now.'}
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Kalau mau mulai, pasang kebutuhan baru atau cari supplier yang paling relevan dulu.'
                : 'If you want to keep moving, post a new need or search for relevant suppliers first.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/create?mode=quick"
                className="inline-flex items-center rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-[12px] font-semibold text-[color:var(--app-text-inverse)]"
              >
                {isId ? 'Pasang cepat' : 'Quick post'}
              </Link>
              <Link
                href="/search"
                className="inline-flex items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-2 text-[12px] font-semibold text-[color:var(--app-text)]"
              >
                {isId ? 'Buka pencarian' : 'Open search'}
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_20px_46px_-36px_rgba(15,23,42,0.22)] sm:p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
              {isId ? 'Buka cepat' : 'Quick access'}
            </p>
            <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
              {isId
                ? 'Halaman inti yang paling sering dipakai balik lagi dari sini.'
                : 'Open the core pages you use most from here.'}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {shortcuts.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)]"
                >
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${toneClass(item.tone)}`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <h3 className="mt-3 text-sm font-bold text-[color:var(--app-text)]">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                    {item.description}
                  </p>
                  <span className="mt-3 inline-flex items-center text-[12px] font-semibold text-[color:var(--app-accent)]">
                    {isId ? 'Buka' : 'Open'}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </article>

        <article className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_20px_46px_-36px_rgba(15,23,42,0.22)] sm:p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
              {isId ? 'Langkah berikutnya' : 'Next steps'}
            </p>
            <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
              {isId
                ? 'Kalau bingung mau mulai dari mana, ambil jalur paling pendek ini.'
                : 'If you are unsure where to start, take one of these short paths.'}
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {flowRecommendations.length > 0 ? (
              flowRecommendations.map(flow => (
                <Link
                  key={flow.id}
                  href={flow.href}
                  className="group block rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                        {flow.status}
                      </p>
                      <h3 className="mt-1 text-sm font-bold text-[color:var(--app-text)]">
                        {flow.title}
                      </h3>
                      <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                        {flow.description}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--app-text-soft)] transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-[13px] leading-5 text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Belum ada jalur rekomendasi. Pakai shortcut di kiri untuk lanjut kerja.'
                  : 'No guided path yet. Use the shortcuts on the left to continue working.'}
              </div>
            )}
          </div>
        </article>
      </section>

      {loading ? (
        <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 text-sm text-[color:var(--app-text-soft)]">
          {isId ? 'Memuat data kerja...' : 'Loading work data...'}
        </div>
      ) : null}
    </div>
  );
}
