import {
  homePrimaryFocusItems,
  homeSecondaryFocusItems,
  listingItems,
  serviceItems,
  type LauncherItem,
} from '@/components/home/homeLauncherData';
import { Link } from '@/i18n/navigation';
import { UMKM_DISCOVERY_PATH, UMKM_OWNER_PATH } from '@/lib/umkmSurface';
import {
  ArrowRight,
  ReceiptText,
  Search,
  ShieldCheck,
  Store,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';

type PageProps = {
  params: Promise<{ locale: string }>;
};

function MenuImage({
  src,
  alt = '',
  sizeClass = 'h-12 w-12',
  className,
  decorative = false,
}: {
  src: string;
  alt?: string;
  sizeClass?: string;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <span
      className={`relative inline-flex rounded-2xl ${sizeClass} ${
        className ?? ''
      }`.trim()}
      aria-hidden={decorative}
    >
      <Image
        src={src}
        alt={decorative ? '' : alt}
        width={160}
        height={160}
        quality={100}
        className="h-full w-full object-contain object-center"
        sizes="(max-width: 640px) 72px, 72px"
        loading="lazy"
      />
    </span>
  );
}

function CatalogCard({
  item,
  label,
  hint,
}: {
  item: LauncherItem;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={item.href}
      className="ui-panel-muted ui-feed-tile group relative flex min-h-[84px] flex-col items-start justify-between rounded-[22px] border border-[color:var(--app-border)]/80 bg-[color:var(--app-surface-strong)] px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[var(--app-shadow)]"
    >
      <span
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-[16px] ${item.bgClass}`}
      >
        {item.image ? (
          <MenuImage src={item.image} alt={label} decorative sizeClass="h-14 w-14" />
        ) : item.icon ? (
          <item.icon className="h-4 w-4 text-[color:var(--app-text)]" />
        ) : null}
      </span>

      <div className="mt-2.5 min-w-0">
        <span className="block text-[12px] font-semibold leading-tight text-[color:var(--app-text)]">
          {label}
        </span>
        <span className="mt-1 block text-[10px] leading-4 text-[color:var(--app-text-soft)]">
          {hint}
        </span>
      </div>

      <span className="absolute right-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--app-surface)] text-[color:var(--app-accent)] opacity-70 transition group-hover:opacity-100">
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

function DecisionPathCard({
  eyebrow,
  title,
  hint,
  meta,
  href,
  cta,
  Icon,
  toneClass,
  bullets,
}: {
  eyebrow: string;
  title: string;
  hint: string;
  meta: string;
  href: string;
  cta: string;
  Icon: LucideIcon;
  toneClass: string;
  bullets: string[];
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

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="inline-flex min-h-[30px] items-center rounded-full border border-white/70 bg-white/88 px-3 py-1 text-[10px] font-semibold text-[color:var(--app-text)]">
            {meta}
          </span>
          {bullets.slice(0, 2).map((item) => (
            <span
              key={item}
              className="inline-flex min-h-[30px] items-center rounded-full border border-[color:var(--app-border)]/80 bg-[color:var(--app-surface)]/88 px-3 py-1 text-[10px] font-semibold text-[color:var(--app-text-soft)]"
            >
              {item}
            </span>
          ))}
        </div>

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
  const focusItems = homePrimaryFocusItems;
  const nicheItems = homeSecondaryFocusItems;
  const supportItems = listingItems.filter((item) =>
    ['/search?type=service', '/search?type=freelancer'].includes(item.href),
  );
  const channelItems = serviceItems.filter((item) =>
    ['/super-app/mart', UMKM_DISCOVERY_PATH].includes(item.href),
  );

  const financeRoutes = [
    {
      href: '/payments',
      title: isId ? 'Saldo & isi ulang' : 'Balance and top-up',
      hint: isId ? 'Cek saldo aktif dan isi ulang lebih cepat' : 'Check live funds and top up quickly',
      icon: Wallet,
      tone:
        'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]',
    },
    {
      href: '/transactions',
      title: isId ? 'Transaksi' : 'Transactions',
      hint: isId ? 'Pantau order, escrow, dan dispute' : 'Track orders, escrow, and disputes',
      icon: ReceiptText,
      tone:
        'border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] text-[color:var(--app-info)]',
    },
    {
      href: '/support',
      title: isId ? 'Bantuan pembayaran' : 'Fund support',
      hint: isId ? 'Kalau ada masalah saat top up atau pembayaran' : 'When top-ups or payments need help',
      icon: ShieldCheck,
      tone:
        'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]',
    },
  ];

  const manageLauncherItem: LauncherItem = {
    href: UMKM_OWNER_PATH,
    labelId: 'Kelola usaha',
    labelEn: 'Manage business',
    hintId: 'Produk, order, tim',
    hintEn: 'Products, orders, team',
    icon: Store,
    bgClass:
      'bg-[linear-gradient(135deg,#c7d2fe_0%,#e0e7ff_52%,#f8fafc_100%)] ring-1 ring-white/70 shadow-inner',
  };

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
      href: UMKM_OWNER_PATH,
      label: isId ? 'Kelola' : 'Manage',
    },
    {
      href: '/payments',
      label: isId ? 'Saldo' : 'Balance',
    },
  ];

  const featuredPaths = [
    {
      eyebrow: isId ? 'Cari kebutuhan' : 'Source fast',
      title: isId ? 'Supplier, stok, lokasi' : 'Suppliers, stock, locations',
      hint: isId ? 'Barang, vendor, booth, atau ruko.' : 'Goods, vendors, booths, or spaces.',
      meta: `${focusItems.length} ${isId ? 'jalur utama' : 'main routes'}`,
      href: '/search',
      cta: isId ? 'Buka pencarian' : 'Open search',
      icon: Search,
      toneClass: 'from-sky-500/18 via-sky-400/8 to-transparent',
      bullets: [
        isId ? 'Supplier' : 'Suppliers',
        isId ? 'Lokasi' : 'Locations',
      ],
    },
    {
      eyebrow: isId ? 'Kelola usaha' : 'Run the business',
      title: isId ? 'Masuk ke peta atau dashboard usaha.' : 'Open the map or business dashboard.',
      hint: isId ? 'Produk, order, operasional, tim.' : 'Products, orders, operations, team.',
      meta: `${channelItems.length + 1} ${isId ? 'jalur pengelolaan toko' : 'operating routes'}`,
      href: UMKM_OWNER_PATH,
      cta: isId ? 'Buka kelola usaha' : 'Open business control',
      icon: Store,
      toneClass: 'from-indigo-500/18 via-indigo-400/10 to-transparent',
      bullets: [
        isId ? 'Peta usaha' : 'Business map',
        isId ? 'Kelola usaha' : 'Manage business',
      ],
    },
    {
      eyebrow: isId ? 'Pembayaran' : 'Finance',
      title: isId ? 'Saldo, transaksi, bantuan.' : 'Balance, transactions, support.',
      hint: isId ? 'Saat uang mulai bergerak.' : 'When money starts moving.',
      meta: `${financeRoutes.length} ${isId ? 'jalur keuangan' : 'finance routes'}`,
      href: '/payments',
      cta: isId ? 'Buka keuangan' : 'Open finance',
      icon: Wallet,
      toneClass: 'from-emerald-500/18 via-emerald-400/10 to-transparent',
      bullets: [
        isId ? 'Top up' : 'Top-up',
        isId ? 'Transaksi' : 'Transactions',
        isId ? 'Bantuan' : 'Support',
      ],
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
                {isId ? 'Buka yang paling dibutuhkan sekarang.' : 'Open what you need now.'}
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
                  href={UMKM_OWNER_PATH}
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

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex min-h-[30px] items-center rounded-full border border-[color:var(--app-border)] bg-white/82 px-3 py-1 text-[10px] font-semibold text-[color:var(--app-text)]">
                  {focusItems.length} {isId ? 'jalur cari' : 'search routes'}
                </span>
                <span className="inline-flex min-h-[30px] items-center rounded-full border border-[color:var(--app-border)] bg-white/82 px-3 py-1 text-[10px] font-semibold text-[color:var(--app-text)]">
                  {channelItems.length + 1} {isId ? 'jalur kelola' : 'manage routes'}
                </span>
                <span className="inline-flex min-h-[30px] items-center rounded-full border border-[color:var(--app-border)] bg-white/82 px-3 py-1 text-[10px] font-semibold text-[color:var(--app-text)]">
                  {financeRoutes.length} {isId ? 'jalur keuangan' : 'finance routes'}
                </span>
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
                  bullets={item.bullets}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="ui-panel ui-feed-section rounded-none border-x-0 p-4 sm:rounded-[28px] sm:border-x sm:p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] ui-accent-text">
                    {isId ? 'Cari kebutuhan' : 'Search'}
                  </p>
                  <h2 className="mt-1.5 text-base font-black text-[color:var(--app-text)]">
                    {isId ? 'Supplier, stok, lokasi' : 'Suppliers, stock, locations'}
                  </h2>
                </div>
                <span className="rounded-full bg-[color:var(--app-surface-strong)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                  {focusItems.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {focusItems.map((item) => (
                  <CatalogCard
                    key={item.href + item.labelId}
                    item={item}
                    label={isId ? item.labelId : item.labelEn}
                    hint={isId ? item.hintId : item.hintEn}
                  />
                ))}
              </div>

              <div className="rounded-[22px] border border-[color:var(--app-border)]/80 bg-[color:var(--app-surface-strong)] px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                    {isId ? 'Jalur lanjutan' : 'Next routes'}
                  </p>
                  <span className="text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                    {nicheItems.length}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {nicheItems.map((item) => (
                    <Link
                      key={item.href + item.labelId}
                      href={item.href}
                      className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-white px-3 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]"
                    >
                      <span>{isId ? item.labelId : item.labelEn}</span>
                      <ArrowRight className="h-3.5 w-3.5 opacity-70" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[22px] border border-[color:var(--app-border)]/80 bg-[color:var(--app-surface-strong)] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] ui-accent-text">
                      {isId ? 'Kelola usaha' : 'Manage'}
                    </p>
                    <h2 className="mt-1.5 text-base font-black text-[color:var(--app-text)]">
                      {isId ? 'Produk, order, operasional' : 'Products, orders, operations'}
                    </h2>
                  </div>
                  <span className="rounded-full bg-[color:var(--app-surface)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                    {channelItems.length + 1}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[manageLauncherItem, ...channelItems].map((item) => (
                    <CatalogCard
                      key={item.href + item.labelId}
                      item={item}
                      label={isId ? item.labelId : item.labelEn}
                      hint={isId ? item.hintId : item.hintEn}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
                <div className="rounded-[22px] border border-[color:var(--app-border)]/80 bg-[color:var(--app-surface-strong)] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                      {isId ? 'Jasa bantu' : 'Support'}
                    </p>
                    <span className="text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                      {supportItems.length}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {supportItems.map((item) => (
                      <CatalogCard
                        key={item.href + item.labelId}
                        item={item}
                        label={isId ? item.labelId : item.labelEn}
                        hint={isId ? item.hintId : item.hintEn}
                      />
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
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
