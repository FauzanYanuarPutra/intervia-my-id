'use client';

import { usePathname } from 'next/navigation';
import {
  ArrowUpRight,
  ChevronRight,
  MessageCircle,
  Search,
} from 'lucide-react';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import LajukanLogo from '@/components/logo/LajuloLogo';
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
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
        {title}
      </p>
      <div className="mt-3 grid gap-1">
        {links.map(item => (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className="group -mx-2 inline-flex min-h-10 items-center justify-between gap-3 rounded-xl px-2 text-[13px] font-semibold text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent-border)]"
          >
            <span>{item.label}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
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

  const discoveryLinks: FooterLink[] = [
    {
      href: '/explore',
      label: isId ? 'Cari kebutuhan' : 'Search business needs',
    },
    {
      href: '/create?side=demand',
      label: isId ? 'Pasang kebutuhan' : 'Post a requirement',
    },
    {
      href: UMKM_DISCOVERY_PATH,
      label: surfaceCopy.discovery,
    },
    {
      href: '/community',
      label: isId ? 'Komunitas' : 'Community',
    },
  ];

  const businessLinks: FooterLink[] = [
    {
      href: '/create?side=supply',
      label: isId ? 'Tawarkan produk atau jasa' : 'Offer a product or service',
    },
    {
      href: UMKM_OWNER_PATH,
      label: surfaceCopy.owner,
    },
    {
      href: '/manage',
      label: isId ? 'Kelola konten' : 'Manage content',
    },
    {
      href: '/my-listings',
      label: isId ? 'Kelola postingan' : 'Manage posts',
    },
    {
      href: '/about',
      label: isId ? 'Tentang Lajukan' : 'About Lajukan',
    },
    {
      href: '/blog',
      label: isId ? 'Artikel usaha' : 'Business articles',
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
      href: '/trust',
      label: isId ? 'Keamanan & kepercayaan' : 'Safety and trust',
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
    <footer
      data-testid="site-footer"
      className="site-footer mt-8 shrink-0 overflow-hidden border-t border-[color:color-mix(in_srgb,_var(--app-border)_82%,_transparent)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_74%,_transparent)] dark:text-[color:var(--app-text-soft)]"
    >
      <div className="page-shell">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_repeat(3,minmax(0,0.72fr))] lg:gap-10">
          <div className="min-w-0 lg:pr-4">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/home"
                aria-label={isId ? 'Beranda Lajukan' : 'Lajukan home'}
                className="inline-flex rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent-border)]"
              >
                <LajukanLogo compact />
              </Link>
              <span className="inline-flex min-h-7 items-center rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent-strong)]">
                Beta
              </span>
            </div>
            <h2 className="mt-4 max-w-xl text-xl font-black leading-tight tracking-[-0.04em] text-[color:var(--app-text)] sm:text-2xl">
              {isId
                ? 'Cari kebutuhan usaha dan mitra yang tepat.'
                : 'Find the right business needs and partners.'}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Cari supplier, bahan, mesin, jasa, tempat usaha, dan peluang bisnis dalam satu alur yang jelas.'
                : 'Search suppliers, materials, equipment, services, business places, and opportunities in one clear flow.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                href="/explore"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[color:var(--app-accent)] px-4 text-[13px] font-black text-white shadow-[0_16px_30px_-22px_color-mix(in_srgb,var(--app-accent)_70%,transparent)] transition hover:-translate-y-0.5 hover:bg-[color:var(--app-accent-strong)]"
              >
                <Search className="h-4 w-4" />
                {isId ? 'Mulai mencari' : 'Start searching'}
              </Link>
              <Link
                href="/create?side=demand"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[color:var(--app-border)] bg-white px-4 text-[13px] font-black text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent-strong)] dark:border-[color:var(--app-border-strong)] dark:bg-white/5"
              >
                {isId ? 'Pasang kebutuhan' : 'Post a requirement'}
              </Link>
            </div>
          </div>

          <FooterLinks
            title={isId ? 'Temukan' : 'Discover'}
            links={discoveryLinks}
          />
          <FooterLinks
            title={isId ? 'Untuk usaha' : 'For business'}
            links={businessLinks}
          />
          <FooterLinks
            title={isId ? 'Bantuan & legal' : 'Help and legal'}
            links={helpLinks}
          />
        </div>

        <div className="mt-8 grid gap-4 border-t border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] pt-5 text-xs text-[color:var(--app-text-soft)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_72%,_transparent)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="max-w-3xl leading-5">
            {isId
              ? 'Saat ini transaksi dilakukan langsung dengan penyedia melalui chat. Fitur pembayaran dan perlindungan transaksi akan tersedia bertahap.'
              : 'Transactions currently happen directly with providers through chat. Payment and transaction protection will be introduced gradually.'}
          </div>
          <a
            href="https://wa.me/6282117148623"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl font-bold text-[color:var(--app-accent-strong)] transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent-border)]"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp Lajukan
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-[color:color-mix(in_srgb,_var(--app-border)_55%,_transparent)] pt-4 text-[11px] text-[color:var(--app-text-soft)] sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; {year} Lajukan Indonesia.</span>
          <span>
            {isId
              ? 'Jelas kebutuhannya, tepat mitranya.'
              : 'Clear needs, better-matched partners.'}
          </span>
        </div>
      </div>
    </footer>
  );
}
