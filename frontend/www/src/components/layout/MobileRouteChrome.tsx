'use client';

import { ChevronLeft, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

import ClientBottomNav from '@/components/layout/ClientBottomNav';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { useAppBack } from '@/lib/navigation/useAppBack';

type LocaleCode = 'id' | 'en';

export type MobileRouteChromeConfig = {
  showTopBar: boolean;
  showBottomNav: boolean;
  title: string;
  eyebrow?: string;
};

// function titleForRoute(
//   pathname: string,
//   locale: LocaleCode,
// ): Pick<MobileRouteChromeConfig, 'title' | 'eyebrow'> {
//   const isId = locale === 'id';

//   if (pathname.startsWith('/about')) {
//     return { title: isId ? 'Tentang' : 'About', eyebrow: 'Lajukan' };
//   }
//   if (pathname.startsWith('/contact')) {
//     return {
//       title: isId ? 'Kontak' : 'Contact',
//       eyebrow: isId ? 'Bantuan' : 'Support',
//     };
//   }
//   if (pathname.startsWith('/support')) {
//     return {
//       title: isId ? 'Bantuan' : 'Support',
//       eyebrow: isId ? 'Pusat bantuan' : 'Help center',
//     };
//   }
//   if (pathname.startsWith('/kategori')) {
//     return {
//       title: isId ? 'Kategori' : 'Categories',
//       eyebrow: isId ? 'Jelajah' : 'Explore',
//     };
//   }
//   if (pathname.startsWith('/community')) {
//     return {
//       title: isId ? 'Komunitas' : 'Community',
//       eyebrow: isId ? 'Diskusi' : 'Forum',
//     };
//   }
//   if (pathname.startsWith('/trust')) {
//     return {
//       title: 'Trust Center',
//       eyebrow: isId ? 'Aman & aturan' : 'Safety',
//     };
//   }
//   if (pathname.startsWith('/privacy')) {
//     return { title: isId ? 'Privasi' : 'Privacy', eyebrow: 'Data' };
//   }
//   if (pathname.startsWith('/terms')) {
//     return {
//       title: isId ? 'Syarat' : 'Terms',
//       eyebrow: isId ? 'Aturan pakai' : 'Legal',
//     };
//   }
//   if (pathname.startsWith('/cookie-policy')) {
//     return {
//       title: isId ? 'Cookie' : 'Cookies',
//       eyebrow: isId ? 'Preferensi' : 'Preferences',
//     };
//   }
//   if (pathname.startsWith('/education')) {
//     return {
//       title: isId ? 'Edukasi' : 'Education',
//       eyebrow: isId ? 'Panduan' : 'Guide',
//     };
//   }
//   if (pathname.startsWith('/learn')) {
//     return {
//       title: isId ? 'Belajar' : 'Learn',
//       eyebrow: isId ? 'Operasional' : 'Operations',
//     };
//   }
//   if (pathname.startsWith('/lainnya')) {
//     return { title: isId ? 'Lainnya' : 'More', eyebrow: 'Menu' };
//   }
//   if (pathname.startsWith('/dashboard')) {
//     return { title: 'Dashboard', eyebrow: isId ? 'Akun' : 'Account' };
//   }
//   if (pathname.startsWith('/notifications')) {
//     return {
//       title: isId ? 'Notifikasi' : 'Notifications',
//       eyebrow: isId ? 'Update' : 'Updates',
//     };
//   }
//   if (pathname.startsWith('/chat')) {
//     return {
//       title: 'Chat',
//       eyebrow: isId ? 'Pesan' : 'Messages',
//     };
//   }
//   if (pathname.startsWith('/settings')) {
//     return {
//       title: isId ? 'Pengaturan' : 'Settings',
//       eyebrow: isId ? 'Akun' : 'Account',
//     };
//   }
//   if (pathname.startsWith('/my-listings')) {
//     return {
//       title: isId ? 'Postingan Saya' : 'My Listings',
//       eyebrow: isId ? 'Akun' : 'Account',
//     };
//   }
//   if (pathname.startsWith('/my-projects')) {
//     return {
//       title: isId ? 'Proyek Saya' : 'My Projects',
//       eyebrow: isId ? 'Aktivitas' : 'Activity',
//     };
//   }
//   if (pathname.startsWith('/transactions')) {
//     return {
//       title: isId ? 'Transaksi' : 'Transactions',
//       eyebrow: isId ? 'Aktivitas' : 'Activity',
//     };
//   }
//   if (pathname.startsWith('/payments')) {
//     return {
//       title: isId ? 'Saldo' : 'Balance',
//       eyebrow: isId ? 'Pembayaran' : 'Payments',
//     };
//   }
//   if (pathname.startsWith('/profile/edit')) {
//     return {
//       title: isId ? 'Edit Profil' : 'Edit Profile',
//       eyebrow: isId ? 'Akun' : 'Account',
//     };
//   }
//   if (pathname === '/profile') {
//     return {
//       title: isId ? 'Profil' : 'Profile',
//       eyebrow: isId ? 'Akun' : 'Account',
//     };
//   }
//   if (pathname.startsWith('/microgigs')) {
//     return {
//       title: 'Microgigs',
//       eyebrow: isId ? 'Jasa cepat' : 'Quick services',
//     };
//   }
//   if (pathname.startsWith('/crm')) {
//     return { title: 'CRM', eyebrow: isId ? 'Operasional' : 'Operations' };
//   }
//   if (pathname === '/jobs') {
//     return {
//       title: isId ? 'Pekerjaan' : 'Jobs',
//       eyebrow: isId ? 'Jelajah' : 'Explore',
//     };
//   }
//   if (pathname === '/property') {
//     return {
//       title: isId ? 'Properti' : 'Property',
//       eyebrow: isId ? 'Jelajah' : 'Explore',
//     };
//   }
//   if (pathname === '/freelancers') {
//     return { title: 'Freelancers', eyebrow: 'Talent' };
//   }

//   return { title: isId ? 'Lajukan' : 'Lajukan' };
// }


function MobileRouteTopBar({
  title,
  eyebrow,
  locale,
}: {
  title: string;
  eyebrow?: string;
  locale: string;
}) {
  const router = useRouter();
  const isId = locale === 'id';
  const handleBack = useAppBack(router, `/${isId ? 'id' : 'en'}/home`);

  return (
    <header className="lajukan-mobile-topbar ui-layer-mobile-topbar fixed inset-x-0 top-0 border-x-0 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)] px-2 pb-1 pt-[calc(env(safe-area-inset-top)+0.25rem)] shadow-[0_10px_24px_-24px_rgba(15,23,42,0.22)] backdrop-blur-xl lg:hidden dark:border-[color:var(--app-border-strong)]">
      <div className="mx-auto grid min-h-[36px] max-w-[720px] grid-cols-[38px_minmax(0,1fr)_38px] items-center gap-1.5">
        <button
          type="button"
          onClick={handleBack}
          className="ui-pressable inline-flex h-[38px] min-h-[38px] w-[38px] min-w-[38px] items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] shadow-sm active:scale-95 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950 dark:text-white"
          aria-label={isId ? 'Kembali' : 'Back'}
        >
          <ChevronLeft className="h-4.5 w-4.5" />
        </button>

        <div className="min-w-0 text-center">
          {eyebrow ? (
            <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
              {eyebrow}
            </p>
          ) : null}
          <p className="truncate text-sm font-black text-[color:var(--app-text)] dark:text-white">
            {title}
          </p>
        </div>

        <Link
          href="/home"
          className="ui-pressable inline-flex h-[38px] min-h-[38px] w-[38px] min-w-[38px] items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] shadow-sm active:scale-95 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950 dark:text-white"
          aria-label={isId ? 'Ke beranda' : 'Go home'}
        >
          <Home className="h-4.5 w-4.5" />
        </Link>
      </div>
    </header>
  );
}

export function MobileRouteChrome({
  config,
  locale,
}: {
  config: MobileRouteChromeConfig;
  locale: string;
}) {
  return (
    <>
      {config.showTopBar ? (
        <>
          <MobileRouteTopBar
            title={config.title}
            eyebrow={config.eyebrow}
            locale={locale}
          />
          <div className='h-10'></div>
        </>
      ) : null}

      {config.showBottomNav ? <ClientBottomNav /> : null}
    </>
  );
}
