'use client';

import { usePathname } from 'next/navigation';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import {
  UMKM_DISCOVERY_PATH,
  UMKM_OWNER_PATH,
  getUmkmSurfaceCopy,
} from '@/lib/umkmSurface';

function detectLocale(pathname: string): 'id' | 'en' {
  return pathname.startsWith('/id') ? 'id' : 'en';
}

type FooterLink = {
  href: string;
  label: string;
};

function FooterLinks({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <nav aria-label={title} className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {links.map(item => (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className="inline-flex min-h-[34px] items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-[12px] font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function Footer() {
  const pathname = usePathname();
  const locale = detectLocale(pathname || '');
  const isId = locale === 'id';
  const year = new Date().getFullYear();
  const surfaceCopy = getUmkmSurfaceCopy(locale);

  const mainLinks: FooterLink[] = [
    {
      href: '/search',
      label: isId ? 'Cari kebutuhan' : 'Search',
    },
    {
      href: '/create',
      label: isId ? 'Buat posting' : 'Create post',
    },
    {
      href: UMKM_DISCOVERY_PATH,
      label: surfaceCopy.discovery,
    },
    {
      href: '/community',
      label: isId ? 'Komunitas' : 'Community',
    },
    {
      href: UMKM_OWNER_PATH,
      label: surfaceCopy.owner,
    },
  ];

  const helpLinks: FooterLink[] = [
    {
      href: '/support',
      label: isId ? 'Bantuan' : 'Support',
    },
    {
      href: '/contact',
      label: isId ? 'Kontak' : 'Contact',
    },
    {
      href: '/privacy',
      label: isId ? 'Privasi' : 'Privacy',
    },
    {
      href: '/terms',
      label: isId ? 'Ketentuan' : 'Terms',
    },
    {
      href: '/refund-policy',
      label: isId ? 'Refund & retur' : 'Refunds',
    },
  ];

  return (
    <footer className="mt-8 border-t border-[color:color-mix(in_srgb,_var(--app-border)_82%,_transparent)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_74%,_transparent)] dark:text-[color:var(--app-text-soft)]">
      <div className="page-shell page-shell-inset py-5 sm:py-6 px-2">
        <div className="mx-auto grid max-w-[1120px] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-start">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
              {isId ? 'Lajukan UMKM' : 'Lajukan'}
            </p>
            <h2 className="mt-1 text-[1.1rem] font-bold leading-tight tracking-[-0.035em] text-[color:var(--app-text)]">
              {isId
                ? 'Cari, posting, dan kelola usaha tanpa ribet.'
                : 'Search, post, and manage business without friction.'}
            </h2>
            <p className="mt-2 max-w-xl text-[12px] leading-5 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Saat beta, pengguna terhubung lewat listing dan chat langsung. Pembayaran aman sedang disiapkan bertahap.'
                : 'During beta, users connect through listings and direct chat. Secure payments are being prepared gradually.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="https://wa.me/6282117148623"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[36px] items-center rounded-full bg-[color:var(--app-accent)] px-3.5 text-[12px] font-bold text-white shadow-[0_14px_28px_-22px_color-mix(in_srgb,var(--app-accent)_70%,transparent)]"
              >
                WhatsApp Lajukan
              </a>
              <Link
                href="/support"
                className="inline-flex min-h-[36px] items-center rounded-full border border-[color:var(--app-border)] bg-white px-3.5 text-[12px] font-bold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-white/5"
              >
                {isId ? 'Pusat bantuan' : 'Help center'}
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FooterLinks
              title={isId ? 'Menu utama' : 'Main menu'}
              links={mainLinks}
            />
            <FooterLinks
              title={isId ? 'Bantuan & legal' : 'Help and legal'}
              links={helpLinks}
            />
          </div>
        </div>

        <div className="mx-auto mt-5 flex max-w-[1120px] flex-col gap-1.5 border-t border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] pt-3 text-[11px] text-[color:var(--app-text-soft)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_72%,_transparent)] sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; {year} Lajukan.</span>
          <span>
            {isId
              ? 'Dibuat agar pengguna Indonesia cepat paham dan cepat jalan.'
              : 'Built for clear and fast business workflows.'}
          </span>
        </div>
      </div>
    </footer>
  );
}
