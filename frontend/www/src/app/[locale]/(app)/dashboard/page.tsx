'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Gauge,
  MapPin,
  MessageCircle,
  PlusSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { type User, useAuth } from '@/context/AuthContext';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';

type DashboardStats = {
  total_content: number;
  active_transactions: number;
  unread_messages: number;
  user_rating: number;
};

type QuickAction = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

type DashboardMetric = {
  id: string;
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: 'growth' | 'attention' | 'steady' | 'trust';
};

type PriorityAction = {
  id: string;
  href: string;
  title: string;
  description: string;
  label: string;
  icon: LucideIcon;
  tone: 'growth' | 'attention' | 'steady' | 'trust';
};

type ProfileCheck = {
  id: string;
  label: string;
  done: boolean;
};

const emptyStats: DashboardStats = {
  total_content: 0,
  active_transactions: 0,
  unread_messages: 0,
  user_rating: 0,
};

const idNumberFormatter = new Intl.NumberFormat('id-ID');

function getDisplayName(user: User | null) {
  if (!user) return '';
  return (
    user.full_name || user.fullName || user.username || user.email || 'User'
  );
}

function formatNumberId(value: number) {
  return idNumberFormatter.format(Math.max(0, Math.round(value)));
}

function toInt(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function toRating(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(5, parsed));
}

function normalizeStats(payload: unknown): DashboardStats {
  if (!payload || typeof payload !== 'object') return emptyStats;
  const record = payload as Record<string, unknown>;
  return {
    total_content: toInt(record.total_content),
    active_transactions: toInt(record.active_transactions),
    unread_messages: toInt(record.unread_messages),
    user_rating: toRating(record.user_rating),
  };
}

function buildProfileChecks(user: User, isId: boolean): ProfileCheck[] {
  const avatar = Boolean(
    user.avatarUrl || user.avatar_url || user.metadata?.avatar_url,
  );
  const displayName = Boolean(
    user.full_name || user.fullName || user.name || user.username,
  );
  const bio = typeof user.bio === 'string' && user.bio.trim().length >= 24;
  const location =
    typeof user.location === 'string' && user.location.trim().length >= 2;
  const contact = Boolean(user.phone || user.phoneVerified || user.email);

  return [
    {
      id: 'name',
      label: isId ? 'Nama jelas' : 'Clear name',
      done: displayName,
    },
    {
      id: 'avatar',
      label: isId ? 'Foto profil' : 'Profile photo',
      done: avatar,
    },
    {
      id: 'bio',
      label: isId ? 'Bio singkat' : 'Short bio',
      done: bio,
    },
    {
      id: 'location',
      label: isId ? 'Lokasi utama' : 'Main location',
      done: location,
    },
    {
      id: 'contact',
      label: isId ? 'Kontak aktif' : 'Active contact',
      done: contact,
    },
  ];
}

function getProfileScore(checks: ProfileCheck[]) {
  if (checks.length === 0) return 0;
  const done = checks.filter(item => item.done).length;
  return Math.round((done / checks.length) * 100);
}

function getListingScore(totalContent: number) {
  if (totalContent >= 8) return 100;
  if (totalContent >= 5) return 82;
  if (totalContent >= 3) return 64;
  if (totalContent >= 1) return 42;
  return 18;
}

function getResponseScore(unreadMessages: number) {
  if (unreadMessages === 0) return 100;
  if (unreadMessages <= 2) return 78;
  if (unreadMessages <= 5) return 58;
  return 34;
}

function getTrustScore(rating: number, profileScore: number) {
  if (rating > 0) return Math.round(rating * 14 + profileScore * 0.3);
  return Math.round(profileScore * 0.55);
}

function getLaunchScore(stats: DashboardStats, profileScore: number) {
  const listingScore = getListingScore(stats.total_content);
  const responseScore = getResponseScore(stats.unread_messages);
  const trustScore = getTrustScore(stats.user_rating, profileScore);
  return Math.round(
    listingScore * 0.36 +
      responseScore * 0.24 +
      profileScore * 0.24 +
      trustScore * 0.16,
  );
}

function toneClass(tone: DashboardMetric['tone']) {
  if (tone === 'attention') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/28 dark:text-amber-200';
  }
  if (tone === 'steady') {
    return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700/60 dark:bg-sky-950/28 dark:text-sky-200';
  }
  if (tone === 'trust') {
    return 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-700/60 dark:bg-indigo-950/28 dark:text-indigo-200';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-950/28 dark:text-emerald-200';
}

function buildMetrics(
  stats: DashboardStats,
  profileScore: number,
  launchScore: number,
  isId: boolean,
): DashboardMetric[] {
  const metrics: DashboardMetric[] = [
    {
      id: 'content',
      label: isId ? 'Listing aktif' : 'Active listings',
      value: formatNumberId(stats.total_content),
      helper: isId
        ? stats.total_content > 0
          ? 'Data yang bisa ditemukan user.'
          : 'Mulai dari 1 posting cepat.'
        : stats.total_content > 0
          ? 'Discoverable user data.'
          : 'Start with one quick post.',
      icon: FileText,
      tone: stats.total_content > 0 ? 'growth' : 'attention',
    },
    {
      id: 'chat',
      label: isId ? 'Chat belum dibalas' : 'Unread chats',
      value: formatNumberId(stats.unread_messages),
      helper: isId
        ? stats.unread_messages > 0
          ? 'Balas cepat supaya prospek tidak dingin.'
          : 'Bagus, inbox sedang bersih.'
        : stats.unread_messages > 0
          ? 'Reply fast before prospects cool down.'
          : 'Good, inbox is clean.',
      icon: MessageCircle,
      tone: stats.unread_messages > 0 ? 'attention' : 'steady',
    },
    {
      id: 'profile',
      label: isId ? 'Kesiapan profil' : 'Profile readiness',
      value: `${profileScore}%`,
      helper: isId
        ? profileScore >= 80
          ? 'Cukup meyakinkan untuk dilihat orang.'
          : 'Lengkapi agar lebih dipercaya.'
        : profileScore >= 80
          ? 'Clear enough for visitors.'
          : 'Complete it to earn trust faster.',
      icon: ShieldCheck,
      tone: profileScore >= 80 ? 'trust' : 'attention',
    },
    {
      id: 'score',
      label: isId ? 'Skor promosi' : 'Promotion score',
      value: `${launchScore}%`,
      helper: isId
        ? 'Gabungan katalog, chat, profil, dan trust.'
        : 'Catalog, chat, profile, and trust combined.',
      icon: Gauge,
      tone: launchScore >= 70 ? 'growth' : 'steady',
    },
  ];

  if (!PROMO_ONLY_MODE) {
    metrics.splice(2, 0, {
      id: 'active-work',
      label: isId ? 'Proyek aktif' : 'Active projects',
      value: formatNumberId(stats.active_transactions),
      helper: isId
        ? 'Yang masih butuh keputusan.'
        : 'Work that still needs a decision.',
      icon: Clock3,
      tone: stats.active_transactions > 0 ? 'attention' : 'steady',
    });
  }

  return metrics.slice(0, 4);
}

function buildPriorities(
  stats: DashboardStats,
  profileScore: number,
  isId: boolean,
): PriorityAction[] {
  const priorities: PriorityAction[] = [];

  if (stats.unread_messages > 0) {
    priorities.push({
      id: 'reply-chat',
      href: '/chat',
      title: isId ? 'Balas chat yang masuk' : 'Reply to incoming chats',
      description: isId
        ? `${stats.unread_messages} chat bisa jadi prospek hari ini.`
        : `${stats.unread_messages} chats can become leads today.`,
      label: isId ? 'Cepat' : 'Fast',
      icon: MessageCircle,
      tone: 'attention',
    });
  }

  if (stats.total_content === 0) {
    priorities.push({
      id: 'first-listing',
      href: '/create?mode=quick',
      title: isId ? 'Buat listing pertama' : 'Create your first listing',
      description: isId
        ? 'Isi judul, foto, lokasi, dan kontak dulu. Detail bisa menyusul.'
        : 'Add title, photo, location, and contact first. Details can follow.',
      label: isId ? 'Wajib' : 'Must do',
      icon: PlusSquare,
      tone: 'growth',
    });
  } else if (stats.total_content < 5) {
    priorities.push({
      id: 'more-listings',
      href: '/create?mode=quick',
      title: isId ? 'Tambah variasi listing' : 'Add more listing variety',
      description: isId
        ? 'Target awal 5 listing agar profil tidak terlihat kosong.'
        : 'Aim for 5 listings so your profile does not feel empty.',
      label: isId ? 'Tambah data' : 'Add data',
      icon: FileText,
      tone: 'growth',
    });
  }

  if (profileScore < 80) {
    priorities.push({
      id: 'complete-profile',
      href: '/profile',
      title: isId ? 'Rapikan profil publik' : 'Tidy public profile',
      description: isId
        ? 'Nama, foto, bio, lokasi, dan kontak bikin orang lebih yakin.'
        : 'Name, photo, bio, location, and contact build confidence.',
      label: isId ? 'Trust' : 'Trust',
      icon: UserRound,
      tone: 'trust',
    });
  }

  if (stats.user_rating <= 0 && stats.total_content > 0) {
    priorities.push({
      id: 'trust-proof',
      href: '/my-listings',
      title: isId ? 'Perkuat bukti usaha' : 'Strengthen proof',
      description: isId
        ? 'Tambah foto nyata, deskripsi jelas, dan contoh hasil kerja.'
        : 'Add real photos, clear descriptions, and work samples.',
      label: isId ? 'Bukti' : 'Proof',
      icon: Star,
      tone: 'steady',
    });
  }

  priorities.push({
    id: 'discover',
    href: '/search',
    title: isId ? 'Cek peluang sekitar' : 'Check nearby opportunities',
    description: isId
      ? 'Lihat supplier, jasa, talent, dan komunitas yang relevan.'
      : 'Find relevant suppliers, services, talent, and communities.',
    label: isId ? 'Riset' : 'Research',
    icon: Search,
    tone: 'steady',
  });

  return priorities.slice(0, 4);
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const Icon = metric.icon;
  return (
    <article className="min-w-0 rounded-[20px] border border-emerald-100/90 bg-white p-3 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] dark:border-emerald-400/14 dark:bg-slate-950/88 sm:p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border ${toneClass(metric.tone)}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
            {metric.label}
          </p>
          <p className="mt-1 text-2xl font-black leading-none text-[color:var(--app-text)]">
            {metric.value}
          </p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
            {metric.helper}
          </p>
        </div>
      </div>
    </article>
  );
}

function PriorityCard({ action }: { action: PriorityAction }) {
  const Icon = action.icon;
  return (
    <Link
      href={action.href}
      className="group flex min-w-0 items-start gap-3 rounded-[20px] border border-emerald-100/90 bg-white p-3 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] dark:border-emerald-400/14 dark:bg-slate-950/88 sm:p-4"
    >
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border ${toneClass(action.tone)}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-black text-[color:var(--app-text)]">
            {action.title}
          </p>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-[color:var(--app-accent)] ring-1 ring-emerald-100 dark:bg-emerald-400/10 dark:ring-emerald-400/14">
            {action.label}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
          {action.description}
        </p>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--app-text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--app-accent)]" />
    </Link>
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
          ? 'group relative flex min-h-[136px] flex-col justify-between overflow-hidden rounded-[24px] border border-emerald-500 bg-[linear-gradient(135deg,#047857,#059669_48%,#10b981)] p-4 text-white shadow-[0_24px_46px_-30px_rgba(4,120,87,0.75)] transition hover:-translate-y-0.5 sm:min-h-[150px] sm:p-5'
          : 'group flex min-h-[118px] flex-col justify-between rounded-[22px] border border-emerald-100/90 bg-white p-4 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] dark:border-emerald-400/14 dark:bg-slate-950/88'
      }
    >
      <span
        className={
          primary
            ? 'inline-flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/16 text-white'
            : 'inline-flex h-12 w-12 items-center justify-center rounded-[18px] bg-emerald-50 text-[color:var(--app-accent)] ring-1 ring-emerald-100 dark:bg-emerald-400/10 dark:ring-emerald-400/14'
        }
      >
        <Icon className="h-6 w-6" />
      </span>
      <div className="mt-3 min-w-0">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p
            className={
              primary
                ? 'min-w-0 truncate text-lg font-black text-white'
                : 'min-w-0 truncate text-base font-black text-[color:var(--app-text)]'
            }
          >
            {action.title}
          </p>
          <ArrowRight
            className={
              primary
                ? 'h-4 w-4 shrink-0 text-white/80 transition group-hover:translate-x-0.5'
                : 'h-4 w-4 shrink-0 text-[color:var(--app-text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--app-accent)]'
            }
          />
        </div>
        <p
          className={
            primary
              ? 'mt-1 line-clamp-2 text-xs font-medium leading-5 text-white/82'
              : 'mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]'
          }
        >
          {action.description}
        </p>
      </div>
    </Link>
  );
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const safeScore = Math.max(0, Math.min(100, score));
  const scoreStyle = { '--score': safeScore } as CSSProperties;
  return (
    <div
      className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full bg-[conic-gradient(#059669_calc(var(--score)*1%),#d1fae5_0)] p-2 [--score:0] dark:bg-[conic-gradient(#34d399_calc(var(--score)*1%),rgba(16,185,129,0.16)_0)] sm:h-32 sm:w-32"
      style={scoreStyle}
    >
      <div className="grid h-full w-full place-items-center rounded-full bg-white text-center dark:bg-slate-950">
        <div>
          <p className="text-3xl font-black leading-none text-[color:var(--app-text)]">
            {safeScore}
          </p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

function ChecklistPanel({
  checks,
  isId,
}: {
  checks: ProfileCheck[];
  isId: boolean;
}) {
  return (
    <section className="rounded-[24px] border border-emerald-100/90 bg-white p-4 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] dark:border-emerald-400/14 dark:bg-slate-950/88">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
            {isId ? 'Profil publik' : 'Public profile'}
          </p>
          <h2 className="mt-1 text-lg font-black text-[color:var(--app-text)]">
            {isId ? 'Yang bikin orang percaya' : 'What builds trust'}
          </h2>
        </div>
        <Link
          href="/profile"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-black text-[color:var(--app-accent)] dark:border-emerald-400/14 dark:bg-emerald-400/10"
        >
          {isId ? 'Edit' : 'Edit'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-4 grid gap-2">
        {checks.map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/70"
          >
            <span className="font-semibold text-[color:var(--app-text)]">
              {item.label}
            </span>
            {item.done ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                OK
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700 dark:bg-amber-400/12 dark:text-amber-200">
                <AlertCircle className="h-3.5 w-3.5" />
                {isId ? 'Isi' : 'Add'}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const locale = useLocale();
  const isId = locale === 'id';
  const { user, loading, authFetch } = useAuth();
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  const loadStats = useCallback(async () => {
    if (!user) return;
    setStatsLoading(true);
    setStatsError('');
    try {
      const response = await authFetch('/api/dashboard/stats', {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(isId ? 'Statistik belum bisa dimuat.' : 'Stats failed.');
      }
      setStats(normalizeStats(payload));
      setLastLoadedAt(new Date());
    } catch (error) {
      setStatsError(
        error instanceof Error
          ? error.message
          : isId
            ? 'Statistik belum bisa dimuat.'
            : 'Stats failed.',
      );
      setStats(emptyStats);
    } finally {
      setStatsLoading(false);
    }
  }, [authFetch, isId, user]);

  useEffect(() => {
    if (loading || !user) return;
    void loadStats();
  }, [loadStats, loading, user]);

  const displayName = getDisplayName(user);
  const profileChecks = useMemo(
    () => (user ? buildProfileChecks(user, isId) : []),
    [isId, user],
  );
  const profileScore = getProfileScore(profileChecks);
  const launchScore = getLaunchScore(stats, profileScore);
  const dashboardMetrics = buildMetrics(stats, profileScore, launchScore, isId);
  const priorities = buildPriorities(stats, profileScore, isId);

  const dashboardActions: QuickAction[] = [
    {
      href: '/create?mode=quick',
      title: isId ? 'Posting cepat' : 'Quick post',
      description: isId
        ? 'Tambah produk, jasa, kebutuhan, atau portofolio dalam 1 menit.'
        : 'Add a product, service, need, or portfolio in one minute.',
      icon: PlusSquare,
    },
    {
      href: '/chat',
      title: isId ? 'Chat' : 'Chat',
      description: isId
        ? 'Balas pertanyaan dan lanjutkan obrolan yang berpotensi.'
        : 'Reply to questions and continue promising conversations.',
      icon: MessageCircle,
    },
    {
      href: '/search',
      title: isId ? 'Cari peluang' : 'Find leads',
      description: isId
        ? 'Temukan supplier, jasa, talent, lokasi, dan komunitas.'
        : 'Find suppliers, services, talent, places, and communities.',
      icon: Search,
    },
    {
      href: '/my-listings',
      title: isId ? 'Listing saya' : 'My listings',
      description: isId
        ? 'Update foto, judul, lokasi, dan status ketersediaan.'
        : 'Update photos, titles, location, and availability.',
      icon: FileText,
    },
    {
      href: '/usaha/dashboard',
      title: isId ? 'Profil usaha' : 'Business profile',
      description: isId
        ? 'Rapikan katalog usaha, kontak, media, dan lokasi.'
        : 'Tidy catalog, contact, media, and location data.',
      icon: BarChart3,
    },
    {
      href: '/profile',
      title: isId ? 'Profil publik' : 'Public profile',
      description: isId
        ? 'Buat orang cepat paham kamu menawarkan apa.'
        : 'Help people quickly understand what you offer.',
      icon: UserRound,
    },
  ];

  const primaryAction = dashboardActions[0];
  const shortcutActions = dashboardActions.slice(1);

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

  return (
    <main className="page-shell page-rhythm overflow-x-hidden bg-[linear-gradient(180deg,#f7fff9_0%,#ffffff_42%,#f8fafc_100%)] pb-6 pt-3 lg:pb-8 lg:pt-4 dark:bg-none">
      <section className="relative overflow-hidden rounded-[28px] border border-emerald-100/90 bg-white/94 p-4 shadow-[0_24px_56px_-42px_rgba(15,23,42,0.32)] dark:border-emerald-400/14 dark:bg-slate-950/90 sm:p-5 lg:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-emerald-200/55 blur-3xl dark:bg-emerald-500/10" />
        <div className="pointer-events-none absolute -bottom-28 left-12 h-48 w-48 rounded-full bg-lime-100/70 blur-3xl dark:bg-lime-500/10" />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--app-accent)] ring-1 ring-emerald-100 dark:bg-emerald-400/10 dark:ring-emerald-400/14">
                <Sparkles className="h-3.5 w-3.5" />
                {PROMO_ONLY_MODE
                  ? isId
                    ? 'Mode promosi'
                    : 'Promotion mode'
                  : isId
                    ? 'Dashboard kerja'
                    : 'Work dashboard'}
              </span>
              {lastLoadedAt ? (
                <span className="text-xs font-semibold text-[color:var(--app-text-soft)]">
                  {isId ? 'Update' : 'Updated'}{' '}
                  {lastLoadedAt.toLocaleTimeString(isId ? 'id-ID' : 'en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight tracking-[-0.035em] text-[color:var(--app-text)] sm:text-4xl">
              {isId
                ? `Halo, ${displayName}. Ini yang perlu dicek hari ini.`
                : `Hi, ${displayName}. Here is what needs attention today.`}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)] sm:text-base">
              {isId
                ? 'Fokus awal Lajukan adalah data, listing, profil, dan chat. Dashboard ini nunjukin bagian mana yang paling cepat bikin kamu terlihat aktif dan dipercaya.'
                : 'Lajukan currently focuses on data, listings, profiles, and chat. This dashboard shows what makes you look active and trustworthy fastest.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadStats()}
                disabled={statsLoading}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-emerald-100 bg-white px-4 text-sm font-black text-[color:var(--app-text)] shadow-sm transition hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-400/14 dark:bg-slate-900 dark:hover:bg-emerald-400/10"
              >
                <RefreshCw
                  className={`h-4 w-4 ${statsLoading ? 'animate-spin' : ''}`}
                />
                {isId ? 'Refresh data' : 'Refresh data'}
              </button>
              <Link
                href="/create?mode=quick"
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[color:var(--app-accent-strong)] px-4 text-sm font-black text-white shadow-[0_16px_32px_-24px_rgba(4,120,87,0.85)] transition hover:-translate-y-0.5"
              >
                <PlusSquare className="h-4 w-4" />
                {isId ? 'Tambah listing' : 'Add listing'}
              </Link>
            </div>
            {statsError ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">
                {statsError}
              </div>
            ) : null}
          </div>
          <ScoreRing
            score={launchScore}
            label={isId ? 'siap' : 'ready'}
          />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {dashboardMetrics.map(metric => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section className="rounded-[24px] border border-emerald-100/90 bg-white p-4 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] dark:border-emerald-400/14 dark:bg-slate-950/88 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                {isId ? 'Prioritas harian' : 'Daily priorities'}
              </p>
              <h2 className="mt-1 text-lg font-black text-[color:var(--app-text)] sm:text-xl">
                {isId ? 'Mulai dari yang paling berdampak' : 'Start with the highest impact'}
              </h2>
            </div>
            <Target className="h-5 w-5 shrink-0 text-[color:var(--app-accent)]" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {priorities.map(action => (
              <PriorityCard key={action.id} action={action} />
            ))}
          </div>
        </section>

        <ChecklistPanel checks={profileChecks} isId={isId} />
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-[24px] border border-emerald-100/90 bg-white p-4 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] dark:border-emerald-400/14 dark:bg-slate-950/88 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                {isId ? 'Peta momentum' : 'Momentum map'}
              </p>
              <h2 className="mt-1 text-lg font-black text-[color:var(--app-text)]">
                {isId ? 'Sinyal yang perlu dijaga' : 'Signals to maintain'}
              </h2>
            </div>
            <TrendingUp className="h-5 w-5 shrink-0 text-[color:var(--app-accent)]" />
          </div>
          <div className="mt-4 space-y-3">
            {[
              {
                icon: Eye,
                label: isId ? 'Katalog terlihat' : 'Catalog visibility',
                value: getListingScore(stats.total_content),
                copy: isId
                  ? 'Makin banyak listing yang rapi, makin mudah ditemukan.'
                  : 'More tidy listings make you easier to discover.',
              },
              {
                icon: MessageCircle,
                label: isId ? 'Kecepatan respon' : 'Response speed',
                value: getResponseScore(stats.unread_messages),
                copy: isId
                  ? 'Inbox bersih bikin calon pembeli merasa diperhatikan.'
                  : 'A clean inbox makes prospects feel attended to.',
              },
              {
                icon: ShieldCheck,
                label: isId ? 'Kepercayaan awal' : 'Initial trust',
                value: getTrustScore(stats.user_rating, profileScore),
                copy: isId
                  ? 'Profil lengkap dan bukti nyata mengurangi keraguan.'
                  : 'Complete profile and proof reduce hesitation.',
              },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-emerald-50 text-[color:var(--app-accent)] ring-1 ring-emerald-100 dark:bg-emerald-400/10 dark:ring-emerald-400/14">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-black text-[color:var(--app-text)]">
                          {item.label}
                        </p>
                        <span className="text-sm font-black text-[color:var(--app-text)]">
                          {item.value}%
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-100 dark:bg-slate-950 dark:ring-slate-800">
                        <span
                          className="block h-full rounded-full bg-[color:var(--app-accent)]"
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        {item.copy}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[24px] border border-emerald-100/90 bg-white p-4 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] dark:border-emerald-400/14 dark:bg-slate-950/88 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                {isId ? 'Aksi cepat' : 'Quick actions'}
              </p>
              <h2 className="mt-1 text-lg font-black text-[color:var(--app-text)]">
                {isId ? 'Pilih sesuai kebutuhan' : 'Pick what you need'}
              </h2>
            </div>
            <MapPin className="h-5 w-5 shrink-0 text-[color:var(--app-accent)]" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <VisualActionCard action={primaryAction} primary />
            </div>
            {shortcutActions.map(action => (
              <VisualActionCard key={action.href} action={action} />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
