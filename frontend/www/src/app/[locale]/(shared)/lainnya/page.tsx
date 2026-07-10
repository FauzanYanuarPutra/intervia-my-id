import { Link } from '@/i18n/navigation';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { UMKM_DISCOVERY_PATH, buildUsahaPath } from '@/lib/umkmSurface';
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Clapperboard,
  GraduationCap,
  Handshake,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
  Users,
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
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
              {eyebrow}
            </p>
            <h2 className="mt-1.5 text-[0.98rem] font-bold leading-tight text-[color:var(--app-text)]">
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
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-[16px] border ${tone}`}
      >
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

function DirectoryCard({
  href,
  title,
  hint,
  cta,
  icon: Icon,
  tone,
}: {
  href: string;
  title: string;
  hint: string;
  cta: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[22px] border border-[color:var(--app-border)]/80 bg-[color:var(--app-surface-strong)] p-3 transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[var(--app-shadow)]"
    >
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border ${tone}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="line-clamp-2 text-[13px] font-bold leading-tight text-[color:var(--app-text)]">
            {title}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[color:var(--app-text-soft)]">
            {hint}
          </p>
        </div>
      </div>
      <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--app-accent)] transition group-hover:translate-x-0.5">
        {cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

export default async function LainnyaPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  const financeRoutes = PROMO_ONLY_MODE
    ? []
    : [
      {
        href: '/payments',
        title: isId ? 'Saldo & isi ulang' : 'Balance and top-up',
        hint: isId ? 'Cek saldo dan isi ulang.' : 'Check balance and top up.',
        icon: Wallet,
        tone: 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]',
      },
      {
        href: '/transactions',
        title: isId ? 'Transaksi' : 'Transactions',
        hint: isId ? 'Lihat order dan dana.' : 'Review orders and funds.',
        icon: ReceiptText,
        tone: 'border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] text-[color:var(--app-info)]',
      },
      {
        href: '/support',
        title: isId ? 'Bantuan' : 'Support',
        hint: isId
          ? 'Kalau pembayaran bermasalah.'
          : 'When payments need help.',
        icon: ShieldCheck,
        tone: 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]',
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
    ...(!PROMO_ONLY_MODE
      ? [
        {
          href: '/payments',
          label: isId ? 'Saldo' : 'Balance',
        },
      ]
      : []),
  ];

  const valueRoutes = [
    {
      href: '/learn',
      title: isId ? 'Learn' : 'Learn',
      hint: isId
        ? 'Video, bacaan, dan course dari creator.'
        : 'Videos, readings, and creator courses.',
      icon: BookOpen,
      cta: isId ? 'Buka' : 'Open',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40',
    },
    {
      href: '/education',
      title: isId ? 'Education' : 'Education',
      hint: isId
        ? 'Jalur belajar, trust, dan operasional.'
        : 'Learning paths, trust, and operations.',
      icon: GraduationCap,
      cta: isId ? 'Buka' : 'Open',
      tone: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40',
    },
    {
      href: '/community',
      title: isId ? 'Komunitas' : 'Community',
      hint: isId
        ? 'Grup, diskusi, dan posting usaha.'
        : 'Groups, discussions, and business posts.',
      icon: Users,
      cta: isId ? 'Buka' : 'Open',
      tone: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40',
    },
    {
      href: '/reels',
      title: 'Reels',
      hint: isId
        ? 'Video singkat bisnis dan produk.'
        : 'Short business and product videos.',
      icon: Clapperboard,
      cta: isId ? 'Buka' : 'Open',
      tone: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40',
    },
    {
      href: '/microgigs',
      title: 'Microgigs',
      hint: isId
        ? 'Tugas cepat dengan scope jelas.'
        : 'Quick tasks with clear scope.',
      icon: Handshake,
      cta: isId ? 'Buka' : 'Open',
      tone: 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40',
    },
    {
      href: '/crm',
      title: 'CRM',
      hint: isId
        ? 'Follow-up lead dan aktivitas usaha.'
        : 'Lead follow-up and business activities.',
      icon: Sparkles,
      cta: isId ? 'Buka' : 'Open',
      tone: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40',
    },
  ];

  const canonicalSearchRoutes = [
    {
      href: '/search?type=job&q=lowongan',
      title: isId ? 'Loker' : 'Jobs',
      hint: isId
        ? 'Lowongan, kurir, admin, dan operator.'
        : 'Jobs, couriers, admins, and operators.',
      icon: BriefcaseBusiness,
      cta: isId ? 'Cari' : 'Search',
      tone: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900',
    },
    {
      href: '/search?type=freelancer&q=umkm',
      title: 'Talent',
      hint: isId
        ? 'Freelancer dan profil skill.'
        : 'Freelancers and skill profiles.',
      icon: UserRound,
      cta: isId ? 'Cari' : 'Search',
      tone: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40',
    },
    {
      href: '/search?type=property&q=lokasi%20jualan',
      title: isId ? 'Lokasi' : 'Locations',
      hint: isId
        ? 'Ruko, booth, dapur, gudang.'
        : 'Shops, booths, kitchens, warehouses.',
      icon: Building2,
      cta: isId ? 'Cari' : 'Search',
      tone: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40',
    },
    {
      href: '/search?type=product&q=supplier',
      title: 'Marketplace',
      hint: isId
        ? 'Supplier dan produk siap pilih.'
        : 'Suppliers and ready-to-browse products.',
      icon: Store,
      cta: isId ? 'Cari' : 'Search',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40',
    },
  ];

  const featuredPaths = [
    {
      eyebrow: isId ? 'Cari kebutuhan' : 'Search',
      title: isId ? 'Supplier, stok, lokasi' : 'Suppliers, stock, locations',
      hint: isId
        ? 'Mulai dari supplier atau kebutuhan usaha.'
        : 'Start from suppliers or a business need.',
      meta: isId ? 'Cari cepat' : 'Search fast',
      href: '/search',
      cta: isId ? 'Cari' : 'Open search',
      icon: Search,
      toneClass: 'from-emerald-500/18 via-emerald-400/8 to-transparent',
    },
    {
      eyebrow: isId ? 'Kelola usaha' : 'Manage',
      title: isId ? 'Masuk ke usaha aktif' : 'Open the active business',
      hint: isId
        ? PROMO_ONLY_MODE
          ? 'Produk, katalog, chat, tim.'
          : 'Produk, order, operasional, tim.'
        : PROMO_ONLY_MODE
          ? 'Products, catalogs, chats, and team.'
          : 'Products, orders, operations, and team.',
      meta: isId ? 'Satu pintu' : 'One doorway',
      href: buildUsahaPath('home'),
      cta: isId ? 'Kelola' : 'Open business control',
      icon: Store,
      toneClass: 'from-teal-500/18 via-teal-400/10 to-transparent',
    },
    ...(!PROMO_ONLY_MODE
      ? [
        {
          eyebrow: isId ? 'Pembayaran' : 'Finance',
          title: isId
            ? 'Saldo, transaksi, bantuan'
            : 'Balance, transactions, support',
          hint: isId
            ? 'Kalau uang sudah mulai jalan.'
            : 'When money starts moving.',
          meta: isId ? 'Keuangan' : 'Finance',
          href: '/payments',
          cta: isId ? 'Keuangan' : 'Open finance',
          icon: Wallet,
          toneClass:
            'from-emerald-500/18 via-emerald-400/10 to-transparent',
        },
      ]
      : []),
  ];

  return (
    <main className="page-shell overflow-x-hidden py-0 sm:py-6">
      <div className="ui-page-stack flex w-full flex-col gap-0 sm:mx-auto sm:max-w-[var(--app-max-width)] sm:gap-3">
        <section className="ui-feed-section relative overflow-hidden rounded-none border-x-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.99)_0%,rgba(239,246,255,0.97)_34%,rgba(238,242,255,0.96)_68%,rgba(236,253,245,0.94)_100%)] p-4 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.4)] sm:rounded-[28px] sm:border sm:border-[color:var(--app-border)] sm:p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)]">
            <div className="min-w-0">
              <p className="ui-page-eyebrow">{isId ? 'Lainnya' : 'More'}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-[2rem]">
                {isId ? 'Mau ke mana?' : 'Open what you need now.'}
              </h1>
              <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[color:var(--app-text-soft)]">
                {isId
                  ? PROMO_ONLY_MODE
                    ? 'Cari supplier, posting katalog, atau kelola usaha.'
                    : 'Cari supplier, kelola usaha, atau cek pembayaran.'
                  : PROMO_ONLY_MODE
                    ? 'Search supply, post catalogs, or run the business.'
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
                {quickRoutes.map(item => (
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
              {featuredPaths.map(item => (
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
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] ui-accent-text">
                {isId ? 'Shortcut' : 'Shortcuts'}
              </p>
              <h2 className="mt-1.5 text-base font-bold text-[color:var(--app-text)]">
                {isId ? 'Yang sering dipakai' : 'The four most-used buttons'}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {quickRoutes.map(item => (
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

            {!PROMO_ONLY_MODE ? (
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
                  {financeRoutes.map(route => (
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
            ) : null}
          </div>
        </section>

        <section className="ui-panel ui-feed-section rounded-none border-x-0 p-4 sm:rounded-[28px] sm:border-x sm:p-4">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] ui-accent-text">
              {isId ? 'Halaman bernilai' : 'Useful pages'}
            </p>
            <h2 className="text-base font-bold text-[color:var(--app-text)]">
              {isId
                ? 'Yang disimpan karena membantu user'
                : 'Kept because they help users'}
            </h2>
            <p className="max-w-2xl text-[12px] leading-5 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Halaman ini bukan jalur utama, tapi tetap berguna untuk belajar, komunitas, konten, dan operasional.'
                : 'These are not the main route, but they still help with learning, community, content, and operations.'}
            </p>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {valueRoutes.map(route => (
              <DirectoryCard key={route.href} {...route} />
            ))}
          </div>
        </section>

        <section className="ui-panel ui-feed-section rounded-none border-x-0 p-4 sm:rounded-[28px] sm:border-x sm:p-4">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] ui-accent-text">
              {isId ? 'Jalur kanonis' : 'Canonical routes'}
            </p>
            <h2 className="text-base font-bold text-[color:var(--app-text)]">
              {isId
                ? 'Halaman lama diarahkan ke pencarian'
                : 'Older pages now point to search'}
            </h2>
            <p className="max-w-2xl text-[12px] leading-5 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Loker, talent, lokasi, dan marketplace sekarang masuk ke hasil pencarian yang sama agar tidak ada halaman kosong/duplikat.'
                : 'Jobs, talent, locations, and marketplace now land in search so duplicate empty pages do not linger.'}
            </p>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {canonicalSearchRoutes.map(route => (
              <DirectoryCard key={route.href} {...route} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
