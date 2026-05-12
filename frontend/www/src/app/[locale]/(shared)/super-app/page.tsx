import { Link } from '@/i18n/navigation';
import {
  homePrimaryFocusItems,
  homeSecondaryFocusItems,
  serviceItems,
  type HomeFocusLinkItem,
  type LauncherItem,
} from '@/components/home/homeLauncherData';
import {
  ArrowRight,
  ClipboardList,
  LineChart,
  Package,
  QrCode,
  Search,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react';
import { UMKM_DISCOVERY_PATH, buildUsahaPath } from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{ locale: string }>;
};

function launcherLabel(item: LauncherItem, isId: boolean) {
  return isId ? item.labelId : item.labelEn;
}

function launcherHint(item: LauncherItem, isId: boolean) {
  return isId ? item.hintId : item.hintEn;
}

function focusLabel(item: HomeFocusLinkItem, isId: boolean) {
  return isId ? item.labelId : item.labelEn;
}

function focusHint(item: HomeFocusLinkItem, isId: boolean) {
  return isId ? item.hintId : item.hintEn;
}

export default async function SuperAppPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  const opsLoop = [
    {
      title: isId ? '1. Temukan pasokan' : '1. Find supply',
      desc: isId
        ? 'Cari supplier, distributor, bahan baku, dan stok reseller tanpa lompat-lompat channel.'
        : 'Find suppliers, distributors, raw materials, and resale stock without jumping across channels.',
      href: '/search?type=product&q=supplier',
      cta: isId ? 'Buka sourcing' : 'Open sourcing',
      icon: Search,
    },
    {
      title: isId ? '2. Siapkan storefront' : '2. Prepare storefront',
      desc: isId
        ? 'Bangun halaman usaha, katalog, QR, dan alur order yang siap dipakai.'
        : 'Build a business page, catalog, QR, and an order flow that is ready to use.',
      href: UMKM_DISCOVERY_PATH,
      cta: isId ? 'Buka peta usaha' : 'Open business map',
      icon: Store,
    },
    {
      title: isId ? '3. Jalankan operasional' : '3. Run operations',
      desc: isId
        ? 'Aktifkan paket jasa, freelancer, dan kebutuhan eksekusi yang paling sering bikin bottleneck.'
        : 'Activate service packs, freelancers, and execution help for operational bottlenecks.',
      href: '/search?type=service&q=paket%20jasa',
      cta: isId ? 'Cari bantuan' : 'Find support',
      icon: ClipboardList,
    },
    {
      title: isId ? '4. Kirim dan ulangi' : '4. Ship and repeat',
      desc: isId
        ? 'Pakai jalur kirim, pickup, dan monitoring order supaya bisnis bisa berulang tiap hari.'
        : 'Use delivery, pickup, and order monitoring so the business can repeat every day.',
      href: '/super-app/send',
      cta: isId ? 'Atur pengiriman' : 'Set shipment',
      icon: Truck,
    },
  ] as const;

  const todayActions = [
    {
      title: isId ? 'Cari distributor' : 'Find distributors',
      desc: isId ? 'Mulai dari grosir dan supplier partai.' : 'Start with wholesalers and bulk suppliers.',
      href: '/search?type=product&q=distributor',
      icon: Package,
    },
    {
      title: isId ? 'Kelola toko' : 'Manage store',
      desc: isId ? 'QR, katalog, meja, dan order.' : 'QR, catalog, tables, and orders.',
      href: buildUsahaPath('home'),
      icon: QrCode,
    },
    {
      title: isId ? 'Jalankan order' : 'Run orders',
      desc: isId ? 'Pickup, kirim, dan proof of delivery.' : 'Pickup, delivery, and proof of delivery.',
      href: '/super-app/send',
      icon: Truck,
    },
    {
      title: isId ? 'Pantau pertumbuhan' : 'Track growth',
      desc: isId ? 'Lihat repeat order dan ritme operasional.' : 'Watch repeat orders and operating rhythm.',
      href: buildUsahaPath('home'),
      icon: LineChart,
    },
  ] as const;

  return (
    <main className="page-shell py-4 sm:py-5">
      <div className="ui-page-stack mx-auto max-w-[1120px] space-y-4">
        <section className="ui-panel relative overflow-hidden rounded-none border-x-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.96)_34%,rgba(209,250,229,0.94)_72%,rgba(186,230,253,0.9)_100%)] p-4 sm:rounded-[32px] sm:border-x sm:p-6 dark:bg-[linear-gradient(135deg,#020617_0%,#06271d_36%,#0f3a2f_72%,#0f766e_100%)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-cyan-300/18 blur-3xl"
          />

          <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_360px]">
            <div>
              <p className="ui-kicker">
                <ShieldCheck className="h-3.5 w-3.5" />
                {isId ? 'Sistem operasional usaha' : 'Business operating system'}
              </p>
              <h1 className="mt-3 ui-display-2 max-w-[14ch] text-[color:var(--app-text)]">
                {isId
                  ? 'Kelola usaha dan operasional harian.'
                  : 'Run your business and daily operations.'}
              </h1>
              <p className="mt-3 max-w-[42rem] text-sm text-[color:var(--app-text-soft)] sm:text-[15px]">
                {isId
                  ? 'Masuk ke profil usaha, order, QR, dan ritme operasional harian dari satu tempat.'
                  : 'Open the business profile, orders, QR, and daily operations from one place.'}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={UMKM_DISCOVERY_PATH}
                  className="ui-button-primary inline-flex min-h-[46px] items-center gap-2 px-4 text-sm font-semibold"
                >
                  <Store className="h-4 w-4" />
                  {isId ? 'Buka peta usaha' : 'Open business map'}
                </Link>
                <Link
                  href="/search?type=product&q=supplier"
                  className="ui-button-secondary inline-flex min-h-[46px] items-center gap-2 px-4 text-sm font-semibold"
                >
                  <Search className="h-4 w-4" />
                  {isId ? 'Cari supply' : 'Find supply'}
                </Link>
              </div>
            </div>

            <aside className="ui-sheet p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {isId ? 'Cepat' : 'Quick start'}
              </p>
              <div className="mt-4 grid gap-2">
                {todayActions.slice(0, 3).map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="ui-feed-row flex items-center justify-between gap-3 rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3 transition hover:border-[color:var(--app-accent-border)] hover:shadow-[var(--app-shadow)]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                        <item.icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[color:var(--app-text)]">
                          {item.title}
                        </span>
                        <span className="block text-[11px] text-[color:var(--app-text-soft)]">
                          {item.desc}
                        </span>
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="ui-panel rounded-none border-x-0 p-4 sm:rounded-[28px] sm:border-x sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {isId ? 'Modul utama' : 'Core modules'}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[color:var(--app-text)]">
                {isId
                  ? 'Semua jalur yang paling sering dipakai pelaku usaha'
                  : 'The modules businesses use most often'}
              </h2>
            </div>
            <Link href="/community" className="text-[11px] font-semibold ui-accent-text">
              {isId ? 'Buka komunitas' : 'Open community'}
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
            {serviceItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="ui-feed-tile rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-4 text-center transition hover:border-[color:var(--app-accent-border)] hover:shadow-[var(--app-shadow)]"
              >
                <span
                  className={`mx-auto inline-flex h-12 w-12 items-center justify-center rounded-[18px] ${item.bgClass}`}
                >
                  {item.icon ? (
                    <item.icon className="h-5 w-5 text-[color:var(--app-text)]" />
                  ) : null}
                </span>
                <p className="mt-3 text-sm font-semibold text-[color:var(--app-text)]">
                  {launcherLabel(item, isId)}
                </p>
                <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                  {launcherHint(item, isId)}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.04fr)_minmax(300px,0.96fr)]">
          <div className="ui-panel rounded-none border-x-0 p-4 sm:rounded-[28px] sm:border-x sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
              {isId ? 'Loop operasional' : 'Operations loop'}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {opsLoop.map((item) => (
                <article
                  key={item.title}
                  className="ui-feed-tile rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                      <item.icon className="h-4.5 w-4.5" />
                    </span>
                    <h3 className="text-base font-semibold text-[color:var(--app-text)]">
                      {item.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[color:var(--app-text-soft)]">
                    {item.desc}
                  </p>
                  <Link href={item.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold ui-accent-text">
                    {item.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <aside className="ui-panel rounded-none border-x-0 p-4 sm:rounded-[28px] sm:border-x sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {isId ? 'Jalur cepat' : 'Fast lanes'}
              </p>
              <div className="mt-4 grid gap-2">
                {homePrimaryFocusItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="ui-feed-row rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3 transition hover:border-[color:var(--app-accent-border)]"
                  >
                    <p className="text-sm font-semibold text-[color:var(--app-text)]">
                      {launcherLabel(item, isId)}
                    </p>
                    <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                      {launcherHint(item, isId)}
                    </p>
                  </Link>
                ))}
              </div>
            </aside>

            <aside className="ui-panel rounded-none border-x-0 p-4 sm:rounded-[28px] sm:border-x sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {isId ? 'Niche yang lagi panas' : 'Niches gaining traction'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {homeSecondaryFocusItems.map((item) => (
                  <Link key={item.href} href={item.href} className="ui-inline-meta ui-border">
                    <span className="font-semibold text-[color:var(--app-text)]">
                      {focusLabel(item, isId)}
                    </span>
                    <span className="text-[color:var(--app-text-soft)]">
                      {focusHint(item, isId)}
                    </span>
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
