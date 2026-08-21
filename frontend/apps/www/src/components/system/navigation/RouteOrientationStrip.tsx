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
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
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
    cleanPath.startsWith('/explore') ||
    cleanPath.startsWith('/jobs') ||
    cleanPath.startsWith('/property') ||
    cleanPath.startsWith('/microgigs') ||
    cleanPath.startsWith('/lainnya') ||
    cleanPath.startsWith('/umkm') ||
    cleanPath.startsWith('/toko')
  ) {
    return null;
  }

  if (cleanPath === '/create' || cleanPath.endsWith('/create')) {
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
        ? PROMO_ONLY_MODE
          ? 'Lihat chat, komentar, dan update profil usaha yang perlu dibalas.'
          : 'Lihat update penting, lalu lanjut ke transaksi atau saldo.'
        : PROMO_ONLY_MODE
          ? 'Read chats, comments, and business profile updates that need a reply.'
          : 'Read the latest updates, then continue into transactions or funds.',
      icon: Bell,
      panelClass:
        'border-emerald-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.98)_42%,rgba(187,247,208,0.92)_100%)] dark:border-emerald-500/20 dark:bg-[linear-gradient(135deg,rgba(5,23,17,0.96)_0%,rgba(8,46,33,0.94)_46%,rgba(5,150,105,0.58)_100%)]',
      iconWrapClass:
        'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-400/14 dark:text-emerald-200 dark:ring-emerald-400/20',
      actions: PROMO_ONLY_MODE
        ? [
            {
              href: '/chat',
              label: isId ? 'Chat' : 'Chat',
              icon: Bell,
              primary: true,
            },
          ]
        : [
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
      title: isId
        ? 'Lihat yang perlu ditindak dulu.'
        : 'See what needs action first.',
      body: isId
        ? 'Kalau macet, buka saldo atau bantuan.'
        : 'If anything is blocked, move into balance or support.',
      icon: ReceiptText,
      panelClass:
        'border-teal-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(240,253,250,0.98)_42%,rgba(153,246,228,0.88)_100%)] dark:border-teal-500/20 dark:bg-[linear-gradient(135deg,rgba(4,25,24,0.96)_0%,rgba(9,48,44,0.94)_46%,rgba(15,118,110,0.58)_100%)]',
      iconWrapClass:
        'bg-teal-100 text-teal-700 ring-1 ring-teal-200/80 dark:bg-teal-400/14 dark:text-teal-200 dark:ring-teal-400/20',
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
      title: isId
        ? 'Profil yang jelas bikin orang cepat percaya.'
        : 'Help people trust your business faster.',
      body: isId
        ? 'Foto, nama, lokasi, dan identitas yang jelas bikin orang lebih yakin.'
        : 'Clear photos, names, location, and identity make people feel safer.',
      icon: UserRound,
      panelClass:
        'border-teal-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(240,253,250,0.98)_38%,rgba(204,251,241,0.92)_100%)] dark:border-teal-500/20 dark:bg-[linear-gradient(135deg,rgba(4,25,24,0.96)_0%,rgba(9,48,44,0.94)_44%,rgba(15,118,110,0.58)_100%)]',
      iconWrapClass:
        'bg-teal-100 text-teal-700 ring-1 ring-teal-200/80 dark:bg-teal-400/14 dark:text-teal-200 dark:ring-teal-400/20',
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
      title: isId
        ? 'Lihat inti infonya dulu.'
        : 'Scan fast, then continue to chat or transaction.',
      body: isId
        ? 'Yang penting langsung kelihatan.'
        : 'The core should feel clear without forcing people to read too much.',
      icon: FileText,
      panelClass:
        'border-emerald-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.98)_42%,rgba(187,247,208,0.92)_100%)] dark:border-emerald-500/20 dark:bg-[linear-gradient(135deg,rgba(5,23,17,0.96)_0%,rgba(8,46,33,0.94)_46%,rgba(5,150,105,0.68)_100%)]',
      iconWrapClass:
        'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-400/14 dark:text-emerald-200 dark:ring-emerald-400/20',
      actions: [
        {
          href: '/explore',
          label: isId ? 'Jelajahi lagi' : 'Explore again',
          icon: Search,
        },
      ],
    };
  }

  if (cleanPath.startsWith('/dashboard')) {
    return {
      eyebrow: isId ? 'Ringkasan usaha' : 'Business summary',
      title: isId
        ? 'Fokus ke yang paling dekat hasilnya.'
        : 'Focus on what is closest to results today.',
      body: isId
        ? PROMO_ONLY_MODE
          ? 'Balas chat, rapikan listing, lalu lanjutkan postingan yang hampir siap.'
          : 'Balas chat, cek transaksi, lalu lanjutkan yang hampir jadi.'
        : PROMO_ONLY_MODE
          ? 'Reply to chats, polish listings, and continue posts that are almost ready.'
          : 'Reply to chats, check transactions, and continue the drafts that are almost done.',
      icon: LayoutDashboard,
      panelClass:
        'border-emerald-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.98)_42%,rgba(187,247,208,0.92)_100%)] dark:border-emerald-500/20 dark:bg-[linear-gradient(135deg,rgba(5,23,17,0.96)_0%,rgba(8,46,33,0.94)_46%,rgba(5,150,105,0.58)_100%)]',
      iconWrapClass:
        'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-400/14 dark:text-emerald-200 dark:ring-emerald-400/20',
      actions: PROMO_ONLY_MODE
        ? [
            {
              href: '/chat',
              label: isId ? 'Chat' : 'Chat',
              icon: Bell,
              primary: true,
            },
            {
              href: '/my-listings',
              label: isId ? 'Postingan' : 'Listings',
              icon: FolderKanban,
            },
          ]
        : [
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
      title: isId
        ? 'Pilih masalah yang paling mirip dulu.'
        : 'Pick the closest problem first.',
      body: isId
        ? 'Kalau belum ketemu, kirim tiket singkat. Kami bantu lanjut.'
        : 'If you still cannot find it, send a short ticket and we will take it from there.',
      icon: LifeBuoy,
      panelClass:
        'border-lime-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(247,254,231,0.98)_42%,rgba(217,249,157,0.92)_100%)] dark:border-lime-500/20 dark:bg-[linear-gradient(135deg,rgba(20,29,8,0.96)_0%,rgba(36,52,13,0.94)_46%,rgba(77,124,15,0.58)_100%)]',
      iconWrapClass:
        'bg-lime-100 text-lime-800 ring-1 ring-lime-200/80 dark:bg-lime-400/14 dark:text-lime-200 dark:ring-lime-400/20',
      actions: [
        {
          href: '/explore',
          label: isId ? 'Jelajahi lagi' : 'Explore again',
          icon: Search,
          primary: true,
        },
      ],
    };
  }

  return {
    eyebrow: isId ? 'Lajukan' : 'Lajukan',
    title: isId
      ? 'Masuk ke yang kamu butuhkan.'
      : 'Move straight into the core flow.',
    body: isId
      ? 'Cari, posting, atau minta bantuan.'
      : 'Search needs, post an offer, or get help.',
    icon: Search,
    panelClass:
      'border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_94%,_transparent)] dark:border-[color:var(--app-border-strong)]',
    iconWrapClass:
      'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]',
    actions: [
      {
        href: '/explore',
        label: isId ? 'Jelajahi' : 'Explore',
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
              <p className="ui-route-kicker text-[10px] font-bold uppercase tracking-[0.18em]">
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
                      action.primary
                        ? 'ui-route-action-primary'
                        : 'ui-route-action-secondary',
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
