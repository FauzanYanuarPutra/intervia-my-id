'use client';

import {
  Bell,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LifeBuoy,
  PlusCircle,
  ReceiptText,
  Search,
  Settings2,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { useAuth } from '@/context/AuthContext';
import { resolveLocaleFromPathname } from '@/lib/locale';
import { cn } from '@/lib/utils';

type OrientationAction = {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
};

type OrientationConfig = {
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
  panelClass?: string;
  iconWrapClass?: string;
  actions: OrientationAction[];
};

function normalizePathname(pathname: string) {
  const clean = pathname.replace(/^\/(id|en)(?=\/|$)/, '');
  return clean === '' ? '/' : clean;
}

function buildOrientationConfig(
  pathname: string,
  locale: 'id' | 'en',
  isAuthenticated: boolean,
): OrientationConfig | null {
  const cleanPath = normalizePathname(pathname);
  const isId = locale === 'id';
  const dashboardHref = isAuthenticated ? '/dashboard' : '/login';
  const createHref = isAuthenticated ? '/create' : '/register';

  if (
    cleanPath === '/' ||
    cleanPath.startsWith('/home') ||
    cleanPath.startsWith('/search') ||
    cleanPath.startsWith('/marketplace') ||
    cleanPath.startsWith('/jobs') ||
    cleanPath.startsWith('/freelancers') ||
    cleanPath.startsWith('/property') ||
    cleanPath.startsWith('/microgigs') ||
    cleanPath.startsWith('/lainnya') ||
    cleanPath.startsWith('/super-app')
  ) {
    return null;
  }

  if (
    cleanPath === '/create' ||
    cleanPath.endsWith('/create') ||
    cleanPath.startsWith('/company/create')
  ) {
      return {
        eyebrow: isId ? 'Mulai posting' : 'Start posting',
        title: isId ? 'Isi yang penting dulu.' : 'Answer the easiest part first.',
        body: isId
          ? 'Tidak perlu lengkap dari awal. Isi inti dulu, sisanya bisa menyusul.'
          : 'It does not need to be complete upfront. Fill the core, the rest can follow.',
        icon: PlusCircle,
      panelClass:
        'border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(255,247,237,0.98)_42%,rgba(254,243,199,0.92)_100%)] dark:border-amber-500/20 dark:bg-[linear-gradient(135deg,rgba(32,14,5,0.96)_0%,rgba(53,25,7,0.94)_46%,rgba(120,53,15,0.82)_100%)]',
      iconWrapClass:
        'bg-amber-100 text-amber-700 ring-1 ring-amber-200/80 dark:bg-amber-400/14 dark:text-amber-200 dark:ring-amber-400/20',
      actions: [
        {
          href: '/my-listings',
          label: isId ? 'Draft & postingan' : 'Drafts and posts',
          icon: FolderKanban,
          primary: true,
        },
        {
          href: '/support',
          label: isId ? 'Minta bantuan' : 'Get help',
          icon: LifeBuoy,
        },
      ],
    };
  }

  if (cleanPath.startsWith('/notifications')) {
      return {
        eyebrow: isId ? 'Notifikasi' : 'Notifications',
        title: isId ? 'Cek yang baru dulu.' : 'Check the important ones first.',
        body: isId
          ? 'Lihat update penting, lalu lanjut ke transaksi atau saldo.'
          : 'Read the latest updates, then continue into transactions or funds.',
      icon: Bell,
      panelClass:
        'border-violet-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(245,243,255,0.98)_42%,rgba(224,231,255,0.92)_100%)] dark:border-violet-500/20 dark:bg-[linear-gradient(135deg,rgba(16,10,37,0.96)_0%,rgba(24,18,61,0.94)_46%,rgba(67,56,202,0.72)_100%)]',
      iconWrapClass:
        'bg-violet-100 text-violet-700 ring-1 ring-violet-200/80 dark:bg-violet-400/14 dark:text-violet-200 dark:ring-violet-400/20',
      actions: [
        {
          href: '/transactions',
          label: isId ? 'Transaksi' : 'Transactions',
          icon: ReceiptText,
          primary: true,
        },
      ],
    };
  }

  if (cleanPath.startsWith('/payments')) {
    return null;
  }

  if (cleanPath.startsWith('/transactions')) {
      return {
        eyebrow: isId ? 'Transaksi' : 'Transactions',
        title: isId ? 'Lihat yang perlu ditindak dulu.' : 'See what needs action first.',
        body: isId
          ? 'Kalau ada yang macet, langsung buka saldo atau bantuan.'
          : 'If anything is blocked, move into balance or support.',
      icon: ReceiptText,
      panelClass:
        'border-sky-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(240,249,255,0.98)_42%,rgba(186,230,253,0.92)_100%)] dark:border-sky-500/20 dark:bg-[linear-gradient(135deg,rgba(4,20,31,0.96)_0%,rgba(8,37,54,0.94)_46%,rgba(3,105,161,0.72)_100%)]',
      iconWrapClass:
        'bg-sky-100 text-sky-700 ring-1 ring-sky-200/80 dark:bg-sky-400/14 dark:text-sky-200 dark:ring-sky-400/20',
      actions: [
        {
          href: '/payments',
          label: isId ? 'Buka saldo' : 'Open balance',
          icon: Wallet,
          primary: true,
        },
        {
          href: '/support',
          label: isId ? 'Bantuan' : 'Support',
          icon: LifeBuoy,
        },
      ],
    };
  }

  if (cleanPath.startsWith('/settings')) {
      return {
        eyebrow: isId ? 'Pengaturan' : 'Settings',
        title: isId ? 'Atur yang penting saja.' : 'Adjust only what matters.',
        body: isId
          ? 'Tampilan, aksesibilitas, dan data akun ada di sini.'
          : 'Appearance, accessibility, and account data live here.',
      icon: Settings2,
      panelClass:
        'border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(255,241,242,0.98)_42%,rgba(251,207,232,0.92)_100%)] dark:border-rose-500/20 dark:bg-[linear-gradient(135deg,rgba(34,6,18,0.96)_0%,rgba(62,12,34,0.94)_46%,rgba(190,24,93,0.68)_100%)]',
      iconWrapClass:
        'bg-rose-100 text-rose-700 ring-1 ring-rose-200/80 dark:bg-rose-400/14 dark:text-rose-200 dark:ring-rose-400/20',
      actions: [
        {
          href: '/profile',
          label: isId ? 'Profil' : 'Profile',
          icon: UserRound,
          primary: true,
        },
      ],
    };
  }

  if (cleanPath.startsWith('/profile')) {
      return {
        eyebrow: isId ? 'Profil' : 'Profile',
        title: isId ? 'Profil yang jelas bikin orang cepat percaya.' : 'Help people trust your business faster.',
        body: isId
          ? 'Foto, nama, lokasi, dan identitas yang jelas bikin orang lebih yakin.'
          : 'Clear photos, names, location, and identity make people feel safer.',
      icon: UserRound,
      panelClass:
        'border-cyan-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(240,249,255,0.98)_38%,rgba(207,250,254,0.92)_100%)] dark:border-cyan-500/20 dark:bg-[linear-gradient(135deg,rgba(5,22,28,0.96)_0%,rgba(9,41,52,0.94)_44%,rgba(8,145,178,0.68)_100%)]',
      iconWrapClass:
        'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200/80 dark:bg-cyan-400/14 dark:text-cyan-200 dark:ring-cyan-400/20',
      actions: [
        {
          href: dashboardHref,
          label: isId ? 'Dashboard' : 'Dashboard',
          icon: LayoutDashboard,
          primary: true,
        },
      ],
    };
  }

  if (cleanPath.startsWith('/content/')) {
      return {
        eyebrow: isId ? 'Detail postingan' : 'Post detail',
        title: isId ? 'Lihat inti infonya dulu.' : 'Scan fast, then continue to chat or transaction.',
        body: isId
          ? 'Yang penting harus langsung kelihatan tanpa baca panjang.'
          : 'The core should feel clear without forcing people to read too much.',
      icon: FileText,
      panelClass:
        'border-emerald-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.98)_42%,rgba(187,247,208,0.92)_100%)] dark:border-emerald-500/20 dark:bg-[linear-gradient(135deg,rgba(5,23,17,0.96)_0%,rgba(8,46,33,0.94)_46%,rgba(5,150,105,0.68)_100%)]',
      iconWrapClass:
        'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-400/14 dark:text-emerald-200 dark:ring-emerald-400/20',
      actions: [
        {
          href: '/search',
          label: isId ? 'Cari lagi' : 'Search again',
          icon: Search,
        },
      ],
    };
  }

  if (cleanPath.startsWith('/dashboard')) {
      return {
        eyebrow: isId ? 'Ringkasan usaha' : 'Business summary',
        title: isId ? 'Fokus ke yang paling dekat hasilnya.' : 'Focus on what is closest to results today.',
        body: isId
          ? 'Balas chat, cek transaksi, lalu lanjutkan yang hampir jadi.'
          : 'Reply to chats, check transactions, and continue the drafts that are almost done.',
      icon: LayoutDashboard,
      panelClass:
        'border-indigo-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(238,242,255,0.98)_42%,rgba(199,210,254,0.92)_100%)] dark:border-indigo-500/20 dark:bg-[linear-gradient(135deg,rgba(12,15,38,0.96)_0%,rgba(20,27,63,0.94)_46%,rgba(79,70,229,0.68)_100%)]',
      iconWrapClass:
        'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200/80 dark:bg-indigo-400/14 dark:text-indigo-200 dark:ring-indigo-400/20',
      actions: [
        {
          href: '/transactions',
          label: isId ? 'Transaksi' : 'Transactions',
          icon: ReceiptText,
          primary: true,
        },
        {
          href: '/payments',
          label: isId ? 'Saldo' : 'Balance',
          icon: Wallet,
        },
      ],
    };
  }

  if (cleanPath.startsWith('/support')) {
      return {
        eyebrow: isId ? 'Bantuan' : 'Support',
        title: isId ? 'Pilih masalah yang paling mirip dulu.' : 'Pick the closest problem first.',
        body: isId
          ? 'Kalau belum ketemu, kirim tiket singkat. Kami bantu lanjut.'
          : 'If you still cannot find it, send a short ticket and we will take it from there.',
      icon: LifeBuoy,
      panelClass:
        'border-fuchsia-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(250,245,255,0.98)_42%,rgba(233,213,255,0.92)_100%)] dark:border-fuchsia-500/20 dark:bg-[linear-gradient(135deg,rgba(24,7,32,0.96)_0%,rgba(49,12,67,0.94)_46%,rgba(162,28,175,0.68)_100%)]',
      iconWrapClass:
        'bg-fuchsia-100 text-fuchsia-700 ring-1 ring-fuchsia-200/80 dark:bg-fuchsia-400/14 dark:text-fuchsia-200 dark:ring-fuchsia-400/20',
      actions: [
        {
          href: '/search',
          label: isId ? 'Cari lagi' : 'Search again',
          icon: Search,
          primary: true,
        },
      ],
    };
  }

  return {
    eyebrow: isId ? 'Lajukan' : 'Lajukan',
    title: isId ? 'Masuk ke yang kamu butuhkan.' : 'Move straight into the core flow.',
    body: isId
      ? 'Cari kebutuhan, bikin posting, atau minta bantuan.'
      : 'Search needs, post an offer, or get help.',
    icon: Search,
    panelClass:
      'border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_94%,_transparent)] dark:border-[color:var(--app-border-strong)]',
    iconWrapClass:
      'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]',
    actions: [
      {
        href: '/search',
        label: isId ? 'Cari' : 'Search',
        icon: Search,
        primary: true,
      },
      {
        href: createHref,
        label: isId ? 'Posting kebutuhan' : 'Create brief',
        icon: PlusCircle,
      },
    ],
  };
}

export function RouteOrientationStrip() {
  const pathname = usePathname();
  const locale = resolveLocaleFromPathname(pathname);
  const { isAuthenticated } = useAuth();
  const config = buildOrientationConfig(pathname, locale, isAuthenticated);

  if (!config) {
    return null;
  }

  const Icon = config.icon;
  const visibleActions = config.actions.slice(0, 2);

  return (
    <section className="page-shell page-shell-inset hidden pt-3 lg:block">
      <div className="ui-route-strip rounded-[22px] px-4 py-3">
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="ui-route-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px]">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="ui-route-kicker text-[10px] font-black uppercase tracking-[0.18em]">
                {config.eyebrow}
              </p>
              <h2 className="mt-1 truncate text-sm font-bold leading-tight text-[color:var(--app-text)] xl:text-[15px]">
                {config.title}
              </h2>
            </div>
          </div>

          {visibleActions.length > 0 ? (
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              {visibleActions.map(action => {
                const ActionIcon = action.icon;
                return (
                  <Link
                    key={action.href + action.label}
                    href={action.href}
                    className={cn(
                      'inline-flex min-h-[38px] items-center justify-center gap-2 rounded-full px-3 text-center text-sm font-semibold transition',
                      action.primary ? 'ui-route-action-primary' : 'ui-route-action-secondary',
                    )}
                  >
                    <ActionIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
