'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { MapPinned, ShieldCheck, Store, Wallet } from 'lucide-react';
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

function FooterGroup({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
        {title}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {links.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex min-h-[34px] items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2.5 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Footer() {
  const pathname = usePathname();
  const locale = detectLocale(pathname || '');
  const year = new Date().getFullYear();
  const surfaceCopy = getUmkmSurfaceCopy(locale);

  const text = useMemo(
    () => ({
      brand: 'Lajukan',
      brandBadge: locale === 'id' ? 'Lajukan UMKM' : 'Lajukan',
      tagline:
        locale === 'id'
          ? 'Cari supplier, jasa, dan peluang usaha tanpa ribet.'
          : 'Find suppliers, services, and business opportunities without extra friction.',
      summary:
        locale === 'id'
          ? 'Buka, pilih aksi, lanjut jalan.'
          : 'Open once and move straight into search, posting, or daily business work.',
      ctaSearch: locale === 'id' ? 'Buka pencarian' : 'Open search',
      ctaCreate: locale === 'id' ? 'Posting cepat' : 'Post fast',
      ecosystem: locale === 'id' ? 'Cari & belanja' : 'Core ecosystem',
      growth: locale === 'id' ? 'Jual & tumbuh' : 'Growth paths',
      trust: locale === 'id' ? 'Bantuan & aman' : 'Trust and support',
      copyright:
        locale === 'id' ? 'Hak cipta dilindungi.' : 'All rights reserved.',
    }),
    [locale],
  );

  const ecosystemLinks: FooterLink[] = [
    {
      href: '/search?type=product&side=supply',
      label: locale === 'id' ? 'Supplier' : 'Suppliers',
    },
    {
      href: '/search?type=service&side=supply',
      label: locale === 'id' ? 'Jasa' : 'Services',
    },
    {
      href: '/search?type=freelancer&side=supply',
      label: locale === 'id' ? 'Talent' : 'Talent',
    },
    {
      href: '/create',
      label: locale === 'id' ? 'Posting kebutuhan' : 'Post a need',
    },
    {
      href: UMKM_DISCOVERY_PATH,
      label: surfaceCopy.discovery,
    },
  ];

  const growthLinks: FooterLink[] = [
    {
      href: '/create',
      label: locale === 'id' ? 'Posting kebutuhan' : 'Post a need',
    },
    {
      href: '/community',
      label: locale === 'id' ? 'Komunitas' : 'Community',
    },
    {
      href: '/learn',
      label: 'Learn',
    },
    {
      href: '/education',
      label: 'Education',
    },
    {
      href: '/payments',
      label: locale === 'id' ? 'Pembayaran' : 'Payments',
    },
    {
      href: UMKM_OWNER_PATH,
      label: surfaceCopy.owner,
    },
    {
      href: '/support',
      label: locale === 'id' ? 'Bantuan cepat' : 'Fast support',
    },
  ];

  const legalLinks: FooterLink[] = [
    { href: '/support', label: locale === 'id' ? 'Bantuan' : 'Support' },
    {
      href: '/trust',
      label: locale === 'id' ? 'Trust center' : 'Trust center',
    },
    { href: '/privacy', label: locale === 'id' ? 'Privasi' : 'Privacy' },
    { href: '/terms', label: locale === 'id' ? 'Ketentuan' : 'Terms' },
  ];

  const trustSignals = [
    {
      icon: ShieldCheck,
      label: locale === 'id' ? 'Verifikasi mitra' : 'Partner verification',
    },
    {
      icon: Wallet,
      label: locale === 'id' ? 'Pembayaran & escrow' : 'Payments and escrow',
    },
    {
      icon: MapPinned,
      label: locale === 'id' ? 'Peta usaha aktif' : 'Active business maps',
    },
    {
      icon: Store,
      label:
        locale === 'id' ? 'QR & order storefront' : 'QR and storefront orders',
    },
  ];

  return (
    <footer className="mt-10 border-t border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_74%,_transparent)] text-[color:var(--app-text)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_72%,_transparent)] dark:text-[color:var(--app-text-soft)]">
      <div className="page-shell page-shell-inset py-6 sm:py-8">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-4">
          <section className="overflow-hidden rounded-[26px] border border-[color:color-mix(in_srgb,_var(--app-border)_84%,_transparent)] bg-[linear-gradient(140deg,rgba(255,255,255,0.98),rgba(239,246,255,0.86)_48%,rgba(255,247,237,0.88))] p-4 shadow-[0_24px_54px_-40px_rgba(15,23,42,0.24)] dark:border-[color:var(--app-border-strong)] dark:bg-[linear-gradient(145deg,rgba(8,17,34,0.98),rgba(14,28,56,0.92)_54%,rgba(49,46,129,0.2))] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                  {text.brandBadge}
                </p>
                <p className="mt-1.5 text-[1.15rem] font-black leading-tight tracking-[-0.04em] text-[color:var(--app-text)] sm:text-[1.45rem]">
                  {text.tagline}
                </p>
                <p className="mt-2 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                  {text.summary}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Link
                  href="/search"
                  className="ui-button-secondary inline-flex items-center rounded-full px-3.5 text-sm font-semibold"
                >
                  {text.ctaSearch}
                </Link>
                <Link
                  href="/create"
                  className="ui-button-primary inline-flex items-center rounded-full px-3.5 text-sm font-semibold"
                >
                  {text.ctaCreate}
                </Link>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {trustSignals.map(signal => (
                <span
                  key={signal.label}
                  className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2.5 text-[10px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
                >
                  <signal.icon className="h-3 w-3 text-[color:var(--app-accent)]" />
                  {signal.label}
                </span>
              ))}
            </div>
          </section>

          <section className="grid gap-3 lg:grid-cols-3">
            <div className="ui-panel rounded-[22px] p-3.5 sm:p-4">
              <FooterGroup title={text.ecosystem} links={ecosystemLinks} />
            </div>

            <div className="ui-panel rounded-[22px] p-3.5 sm:p-4">
              <FooterGroup title={text.growth} links={growthLinks} />
            </div>

            <div className="ui-panel rounded-[22px] p-3.5 sm:p-4">
              <FooterGroup title={text.trust} links={legalLinks} />
            </div>
          </section>

          <div className="flex flex-col gap-1.5 border-t border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] pt-3.5 text-[11px] text-[color:var(--app-text-soft)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_70%,_transparent)] sm:flex-row sm:items-center sm:justify-between">
            <span>
              &copy; {year} {text.brand}. {text.copyright}
            </span>
            <span>
              {locale === 'id'
                ? 'Dirancang untuk pengguna Indonesia yang maunya cepat paham dan cepat jalan.'
                : 'Designed for business users who need clarity fast.'}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
