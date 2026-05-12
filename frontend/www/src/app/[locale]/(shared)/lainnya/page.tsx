import { Link } from '@/i18n/navigation';
import { UMKM_DISCOVERY_PATH, buildUsahaPath } from '@/lib/umkmSurface';
import {
  ArrowRight,
  ReceiptText,
  Search,
  ShieldCheck,
  Store,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

type PageProps = {
  params: Promise<{ locale: string }>;
};

function DecisionPathCard({
  eyebrow,
  title,
  hint,
  meta,
  href,
  cta,
  Icon,
  toneClass,
}: {
  eyebrow: string;
  title: string;
  hint: string;
  meta: string;
  href: string;
  cta: string;
  Icon: LucideIcon;
  toneClass: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-[24px] border border-[color:var(--app-border)]/80 bg-[color:var(--app-surface-strong)] px-3.5 py-3.5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_26px_48px_-32px_rgba(15,23,42,0.28)]"
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-100 ${toneClass}`}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
              {eyebrow}
            </p>
            <h2 className="mt-1.5 text-[0.98rem] font-black leading-tight text-[color:var(--app-text)]">
              {title}
            </h2>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] bg-white/88 text-[color:var(--app-text)] ring-1 ring-black/5 shadow-sm dark:bg-[color:var(--app-surface)]/88 dark:ring-white/10">
            <Icon className="h-4 w-4" />
          </span>
        </div>

        <p className="mt-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
          {hint}
        </p>

        <span className="mt-2.5 inline-flex min-h-[30px] items-center rounded-full border border-white/70 bg-white/88 px-3 py-1 text-[10px] font-semibold text-[color:var(--app-text)]">
          {meta}
        </span>

        <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--app-accent)] transition group-hover:translate-x-0.5">
          {cta}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function FinanceCard({
  href,
  title,
  hint,
  icon: Icon,
  tone,
}: {
  href: string;
  title: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className="ui-feed-tile rounded-[22px] border border-[color:var(--app-border)]/80 bg-[color:var(--app-surface-strong)] px-3 py-3 transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[var(--app-shadow)]"
    >
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-[16px] border ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2.5 text-[12px] font-semibold leading-tight text-[color:var(--app-text)]">
        {title}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
        {hint}
      </p>
    </Link>
  );
}

export default async function LainnyaPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  const financeRoutes = [
    {
      href: '/payments',
      title: isId ? 'Saldo & isi ulang' : 'Balance and top-up',
      hint: isId ? 'Cek saldo dan isi ulang.' : 'Check balance and top up.',
      icon: Wallet,
      tone:
        'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]',
    },
    {
      href: '/transactions',
      title: isId ? 'Transaksi' : 'Transactions',
      hint: isId ? 'Lihat order dan dana.' : 'Review orders and funds.',
      icon: ReceiptText,
      tone:
        'border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] text-[color:var(--app-info)]',
    },
    {
      href: '/support',
      title: isId ? 'Bantuan' : 'Support',
      hint: isId ? 'Kalau pembayaran bermasalah.' : 'When payments need help.',
      icon: ShieldCheck,
      tone:
        'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]',
    },
  ];

  const quickRoutes = [
    {
      href: '/search?type=product&q=supplier',
      label: isId ? 'Supplier' : 'Suppliers',
    },
    {
      href: UMKM_DISCOVERY_PATH,
      label: isId ? 'Peta' : 'Map',
    },
    {
      href: buildUsahaPath('home'),
      label: isId ? 'Kelola' : 'Manage',
    },
    {
      href: '/payments',
      label: isId ? 'Saldo' : 'Balance',
    },
  ];

  const featuredPaths = [
    {
      eyebrow: isId ? 'Cari kebutuhan' : 'Search',
      title: isId ? 'Supplier, stok, lokasi' : 'Suppliers, stock, locations',
      hint: isId ? 'Mulai dari supplier atau kebutuhan usaha.' : 'Start from suppliers or a business need.',
      meta: isId ? 'Cari cepat' : 'Search fast',
      href: '/search',
      cta: isId ? 'Buka pencarian' : 'Open search',
      icon: Search,
      toneClass: 'from-sky-500/18 via-sky-400/8 to-transparent',
    },
    {
      eyebrow: isId ? 'Kelola usaha' : 'Manage',
      title: isId ? 'Masuk ke usaha aktif' : 'Open the active business',
      hint: isId ? 'Produk, order, operasional, tim.' : 'Products, orders, operations, and team.',
      meta: isId ? 'Satu pintu' : 'One doorway',
      href: buildUsahaPath('home'),
      cta: isId ? 'Buka kelola usaha' : 'Open business control',
      icon: Store,
      toneClass: 'from-indigo-500/18 via-indigo-400/10 to-transparent',
    },
    {
      eyebrow: isId ? 'Pembayaran' : 'Finance',
      title: isId ? 'Saldo, transaksi, bantuan' : 'Balance, transactions, support',
      hint: isId ? 'Kalau uang sudah mulai jalan.' : 'When money starts moving.',
      meta: isId ? 'Keuangan' : 'Finance',
      href: '/payments',
      cta: isId ? 'Buka keuangan' : 'Open finance',
      icon: Wallet,
      toneClass: 'from-emerald-500/18 via-emerald-400/10 to-transparent',
    },
  ];

  return (
    <main className="page-shell overflow-x-hidden py-0 sm:py-6">
      <div className="ui-page-stack flex w-full flex-col gap-0 sm:mx-auto sm:max-w-[var(--app-max-width)] sm:gap-3">
        <section className="ui-feed-section relative overflow-hidden rounded-none border-x-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.99)_0%,rgba(239,246,255,0.97)_34%,rgba(238,242,255,0.96)_68%,rgba(236,253,245,0.94)_100%)] p-4 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.4)] sm:rounded-[28px] sm:border sm:border-[color:var(--app-border)] sm:p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)]">
            <div className="min-w-0">
              <p className="ui-page-eyebrow">{isId ? 'Lainnya' : 'More'}</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-[color:var(--app-text)] sm:text-[2rem]">
                {isId ? 'Buka yang dibutuhkan sekarang.' : 'Open what you need now.'}
              </h1>
              <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Cari supplier, kelola usaha, atau cek pembayaran.'
                  : 'Search supply, run the business, or check finance.'}
              </p>

              <div className="mt-3 flex flex-col gap-2 min-[420px]:flex-row">
                <Link
                  href="/search"
                  className="ui-button-primary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
                >
                  <Search className="h-4 w-4" />
                  {isId ? 'Cari kebutuhan' : 'Search needs'}
                </Link>
                <Link
                  href={buildUsahaPath('home')}
                  className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
                >
                  <Store className="h-4 w-4" />
                  {isId ? 'Kelola usaha' : 'Manage business'}
                </Link>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {quickRoutes.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-white/88 px-3 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]"
                  >
                    {item.label}
                    <ArrowRight className="h-3.5 w-3.5 opacity-70" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3 xl:grid-cols-1">
              {featuredPaths.map((item) => (
                <DecisionPathCard
                  key={item.title}
                  eyebrow={item.eyebrow}
                  title={item.title}
                  hint={item.hint}
                  meta={item.meta}
                  href={item.href}
                  cta={item.cta}
                  Icon={item.icon}
                  toneClass={item.toneClass}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="ui-panel ui-feed-section rounded-none border-x-0 p-4 sm:rounded-[28px] sm:border-x sm:p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[22px] border border-[color:var(--app-border)]/80 bg-[color:var(--app-surface-strong)] px-3 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] ui-accent-text">
                {isId ? 'Shortcut' : 'Shortcuts'}
              </p>
              <h2 className="mt-1.5 text-base font-black text-[color:var(--app-text)]">
                {isId
                  ? 'Empat tombol yang paling sering dipakai'
                  : 'The four most-used buttons'}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {quickRoutes.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-white px-3 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]"
                  >
                    {item.label}
                    <ArrowRight className="h-3.5 w-3.5 opacity-70" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-[22px] border border-[color:var(--app-border)]/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.94))] px-3 py-3 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.22)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                  {isId ? 'Keuangan' : 'Finance'}
                </p>
                <span className="text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                  {financeRoutes.length}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {financeRoutes.map((route) => (
                  <FinanceCard
                    key={route.href}
                    href={route.href}
                    title={route.title}
                    hint={route.hint}
                    icon={route.icon}
                    tone={route.tone}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
