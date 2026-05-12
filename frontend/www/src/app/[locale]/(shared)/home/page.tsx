import Image from "next/image";
import Link from "next/link";
import {
  BadgePercent,
  Bell,
  Box,
  BriefcaseBusiness,
  ChevronRight,
  Coffee,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  Package,
  Play,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  TrendingUp,
  User,
  Users,
  WalletCards,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { LajukanReel, lajukanReels } from "../../_data/reels";

type PageProps = {
  params: Promise<{ locale: string }>;
};

type Tone =
  | "emerald"
  | "green"
  | "orange"
  | "blue"
  | "violet"
  | "amber"
  | "rose"
  | "slate";

type Product = {
  id: string;
  name: string;
  seller: string;
  price: string;
  unit: string;
  location: string;
  rating: string;
  reviews: string;
  badge?: string;
  tone: Tone;
  icon: LucideIcon;
  imageSrc: string;
  searchHref: string;
};

const products: Product[] = [
  {
    id: "ayam-segar",
    name: "Daging Ayam Segar",
    seller: "Ayam Berkah Sentosa",
    price: "Rp 28.000",
    unit: "/kg",
    location: "Jakarta Barat",
    rating: "4.8",
    reviews: "120",
    badge: "Terlaris",
    tone: "rose",
    icon: ShoppingBag,
    imageSrc: "/images/hero/produksi.png",
    searchHref: "/search?type=product&q=ayam%20frozen",
  },
  {
    id: "kopi-arabica",
    name: "Kopi Arabica Premium",
    seller: "Kopi Nusantara",
    price: "Rp 150.000",
    unit: "/250gr",
    location: "Bandung",
    rating: "4.9",
    reviews: "89",
    tone: "amber",
    icon: Coffee,
    imageSrc: "/images/hero/lajukan.png",
    searchHref: "/search?type=product&q=kopi%20arabica",
  },
  {
    id: "kemasan-box",
    name: "Kemasan Box Custom",
    seller: "Packindo",
    price: "Rp 2.500",
    unit: "/pcs",
    location: "Tangerang",
    rating: "4.7",
    reviews: "56",
    badge: "Promo",
    tone: "orange",
    icon: Box,
    imageSrc: "/images/ui-dashboard.png",
    searchHref: "/search?type=product&q=kemasan%20custom",
  },
  {
    id: "sewa-dapur",
    name: "Sewa Dapur Bersertifikat",
    seller: "DapurKita",
    price: "Rp 250.000",
    unit: "/hari",
    location: "Jakarta Selatan",
    rating: "4.8",
    reviews: "78",
    tone: "slate",
    icon: Store,
    imageSrc: "/images/hero/bisnis.png",
    searchHref: "/search?type=property&q=dapur%20usaha",
  },
];

const quickActions = [
  {
    label: "Supplier",
    href: "#supplier",
    icon: BriefcaseBusiness,
    tone: "emerald" as Tone,
  },
  {
    label: "Produk",
    href: "#produk",
    icon: Package,
    tone: "green" as Tone,
  },
  {
    label: "Jasa",
    href: "#jasa",
    icon: Wrench,
    tone: "violet" as Tone,
  },
  {
    label: "Lokasi",
    href: "#lokasi",
    icon: MapPin,
    tone: "orange" as Tone,
  },
  {
    label: "Request",
    href: "#request",
    icon: Plus,
    tone: "blue" as Tone,
  },
  {
    label: "Promo",
    href: "#promo",
    icon: BadgePercent,
    tone: "amber" as Tone,
  },
  {
    label: "Reels",
    href: "/reels",
    icon: Play,
    tone: "rose" as Tone,
  },
  {
    label: "Trend",
    href: "#trend",
    icon: TrendingUp,
    tone: "emerald" as Tone,
  },
];

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;

  return (
    <main className="h-[100svh] overflow-hidden bg-[#F6FAF8] text-slate-950">
      <MobileHome locale={locale} />
      <DesktopHome locale={locale} />
    </main>
  );
}

/* =========================
   MOBILE
========================= */

function MobileHome({ locale }: { locale: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col lg:hidden">
      <MobileHeader locale={locale} />

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
          <Hero locale={locale} mobile />
          <QuickActions locale={locale} mobile />
          <RequestBox />
          <StatsStrip />
          <DiscoveryGuide locale={locale} mobile />
          <ProductSection locale={locale} mobile />
          <HomeReelsSection locale={locale} mobile />
          <PromoSection />
          <CommunitySection />
          <HelpFooter />
        </div>
      </main>

      <MobileBottomNav locale={locale} />
    </div>
  );
}

function MobileHeader({ locale }: { locale: string }) {
  return (
    <header className="shrink-0 border-b border-slate-100 bg-white/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] backdrop-blur">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <Logo />
          <div className="flex gap-2">
            <IconButton icon={MessageCircle} badge="3" label="Chat" />
            <IconButton icon={Bell} badge="5" label="Notifikasi" />
          </div>
        </div>

        <SearchBar locale={locale} className="mt-3" />
      </div>
    </header>
  );
}

function MobileBottomNav({ locale }: { locale: string }) {
  const items = [
    {
      label: "Home",
      href: `/${locale}`,
      icon: Home,
      active: true,
    },
    {
      label: "Cari",
      href: `/${locale}#supplier`,
      icon: Search,
    },
    {
      label: "Buat",
      href: `/${locale}#request`,
      icon: Plus,
      create: true,
    },
    {
      label: "Reels",
      href: `/${locale}/reels`,
      icon: Play,
    },
    {
      label: "Akun",
      href: `/${locale}#akun`,
      icon: User,
    },
  ];

  return (
    <nav className="shrink-0 border-t border-slate-100 bg-white pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
      <div className="mx-auto grid max-w-3xl grid-cols-5 px-4">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 text-[11px] font-black",
                item.active ? "text-emerald-700" : "text-slate-500",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-2xl",
                  item.active && "bg-emerald-100",
                  item.create &&
                    "-mt-5 h-14 w-14 rounded-full bg-emerald-700 text-white shadow-xl shadow-emerald-700/25",
                  !item.active && !item.create && "bg-slate-100",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* =========================
   DESKTOP
========================= */

function DesktopHome({ locale }: { locale: string }) {
  return (
    <div className="hidden h-full min-h-0 overflow-hidden lg:grid lg:grid-cols-[244px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_330px] 2xl:grid-cols-[272px_minmax(0,1fr)_360px]">
      <Sidebar locale={locale} />

      <section className="flex min-h-0 min-w-0 flex-col">
        <DesktopTopbar locale={locale} />

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1160px] space-y-4 px-4 py-4 2xl:px-5">
            <Hero locale={locale} />
            <QuickActions locale={locale} />

            <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
              <RequestBox />
              <StatsStrip desktop />
            </div>

            <DiscoveryGuide locale={locale} />
            <ProductSection locale={locale} />

            <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_410px]">
              <HomeReelsSection locale={locale} />
              <PromoSection />
            </div>

            <CommunitySection />
          </div>
        </main>
      </section>

      <RightPanel />
    </div>
  );
}

function Sidebar({ locale }: { locale: string }) {
  const menus = [
    {
      label: "Beranda",
      icon: Home,
      href: `/${locale}`,
      active: true,
    },
    {
      label: "Jelajah",
      icon: Search,
      href: `/${locale}#supplier`,
    },
    {
      label: "Supplier",
      icon: BriefcaseBusiness,
      href: `/${locale}#supplier`,
    },
    {
      label: "Produk",
      icon: Package,
      href: `/${locale}#produk`,
    },
    {
      label: "Komunitas",
      icon: Users,
      href: `/${locale}#komunitas`,
      badge: "12",
    },
    {
      label: "Reels Bisnis",
      icon: Play,
      href: `/${locale}/reels`,
    },
    {
      label: "Transaksi",
      icon: WalletCards,
      href: `/${locale}#transaksi`,
    },
    {
      label: "Pengaturan",
      icon: User,
      href: `/${locale}#akun`,
    },
  ];

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-slate-100 bg-white">
      <div className="shrink-0 px-4 py-5">
        <Logo />
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
        {menus.map((menu) => {
          const Icon = menu.icon;

          return (
            <Link
              key={menu.label}
              href={menu.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-black transition",
                menu.active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full",
                  menu.active ? "bg-emerald-100" : "bg-slate-100",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate">{menu.label}</span>
              {menu.badge && (
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                  {menu.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 p-3">
        <div className="rounded-[24px] bg-gradient-to-br from-emerald-50 to-white p-4 ring-1 ring-emerald-100">
          <p className="text-sm font-black text-emerald-800">
            Cari supplier lebih cepat
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Buat request dan biarkan supplier kirim penawaran.
          </p>
          <Link
            href={`/${locale}#request`}
            className="mt-4 flex items-center justify-center rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white"
          >
            Buat Request
          </Link>
        </div>
      </div>
    </aside>
  );
}

function DesktopTopbar({ locale }: { locale: string }) {
  return (
    <header className="shrink-0 border-b border-slate-100 bg-white">
      <div className="flex h-[70px] items-center gap-3 px-4 2xl:px-5">
        <button className="hidden items-center gap-2 rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm font-black text-slate-700 xl:inline-flex">
          <MapPin className="h-4 w-4 text-emerald-700" />
          Jakarta
        </button>

        <SearchBar locale={locale} className="min-w-0 flex-1" />

        <IconButton icon={MessageCircle} label="Chat" />
        <IconButton icon={Bell} label="Notif" badge="3" />

        <Link
          href={`/${locale}#request`}
          className="hidden items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700 xl:inline-flex"
        >
          <Plus className="h-4 w-4" />
          Buat Baru
        </Link>

        <div className="hidden items-center gap-3 rounded-2xl bg-white px-3 py-2 ring-1 ring-slate-100 2xl:flex">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100">
            <User className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="text-sm font-black">Andi Pratama</p>
            <p className="text-xs font-semibold text-slate-500">Pengusaha</p>
          </div>
        </div>
      </div>
    </header>
  );
}

function RightPanel() {
  return (
    <aside className="hidden h-full min-h-0 overflow-y-auto border-l border-slate-100 bg-white p-4 xl:block">
      <div className="space-y-4">
        <Panel title="Aktivitas Terbaru">
          {[
            "Penawaran baru dari Ayam Berkah Sentosa",
            "Kemasan Box Custom sedang promo",
            "Supplier kopi aktif di Bandung",
            "3 request menunggu balasan",
          ].map((item) => (
            <div key={item} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold leading-snug text-slate-700">
                  {item}
                </p>
                <p className="mt-1 text-xs text-slate-400">Baru saja</p>
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="Tren UMKM">
          {[
            "Frozen Food",
            "Kemasan Custom",
            "Kopi Susu",
            "Digital Marketing",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"
            >
              <p className="text-sm font-black">{item}</p>
              <TrendingUp className="h-5 w-5 text-emerald-700" />
            </div>
          ))}
        </Panel>

        <section className="rounded-[26px] bg-slate-950 p-5 text-white">
          <p className="text-lg font-black">Lajukan PRO</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Prioritas pencarian, badge usaha, dan insight penjualan.
          </p>
          <button className="mt-5 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950">
            Coba PRO
          </button>
        </section>
      </div>
    </aside>
  );
}

/* =========================
   SECTIONS
========================= */

function Hero({ locale, mobile = false }: { locale: string; mobile?: boolean }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[30px] bg-gradient-to-br from-emerald-50 via-white to-emerald-50 ring-1 ring-emerald-100",
        mobile
          ? "p-5"
          : "grid min-h-[265px] grid-cols-[minmax(0,1fr)_380px] items-center gap-5 p-6 2xl:grid-cols-[minmax(0,1fr)_430px]",
      )}
    >
      <div className="relative z-10">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
          <ShieldCheck className="h-3.5 w-3.5" />
          Aman untuk UMKM Indonesia
        </div>

        <h1
          className={cn(
            "font-black leading-tight tracking-tight",
            mobile ? "text-[30px]" : "text-4xl 2xl:text-5xl",
          )}
        >
          Semua kebutuhan usahamu, ada di{" "}
          <span className="text-emerald-700">Lajukan</span>
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 2xl:text-base">
          Cari supplier, produk, jasa, lokasi, dan peluang usaha. Nego langsung,
          transaksi aman, bisnis makin jalan.
        </p>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link
            href={`/${locale}#supplier`}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-700/15"
          >
            Cari Supplier
            <Search className="h-4 w-4" />
          </Link>
          <Link
            href={`/${locale}#request`}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-800 ring-1 ring-slate-200"
          >
            Buat Request
            <Send className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {!mobile && (
        <div className="relative h-[220px] overflow-hidden rounded-[26px] bg-gradient-to-br from-emerald-100 via-white to-orange-50">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-200/50" />
          <div className="absolute bottom-0 left-[18%] h-[76%] w-[28%] rounded-t-[80px] bg-slate-900" />
          <div className="absolute bottom-0 left-[23%] h-[48%] w-[18%] rounded-t-[60px] bg-emerald-700" />
          <div className="absolute bottom-0 right-[22%] h-[72%] w-[25%] rounded-t-[80px] bg-orange-200" />
          <FloatingMini className="left-4 top-4" icon={ShieldCheck} label="Verified" />
          <FloatingMini className="right-4 bottom-4" icon={Users} label="320+ Online" />
        </div>
      )}
    </section>
  );
}

function QuickActions({
  locale,
  mobile = false,
}: {
  locale: string;
  mobile?: boolean;
}) {
  return (
    <section className="rounded-[26px] bg-white p-3 shadow-sm ring-1 ring-slate-100">
      {!mobile && (
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black">Akses Cepat</h2>
            <p className="text-xs font-semibold text-slate-500">
              Langsung ke kebutuhan utama bisnismu.
            </p>
          </div>
          <button className="text-sm font-black text-emerald-700">Semua</button>
        </div>
      )}

      <div className={cn("grid gap-2", mobile ? "grid-cols-4" : "grid-cols-8")}>
        {quickActions.map((item) => {
          const Icon = item.icon;
          const href = item.href.startsWith("/")
            ? `/${locale}${item.href}`
            : `/${locale}${item.href}`;

          return (
            <Link
              key={item.label}
              href={href}
              className="rounded-2xl p-2.5 text-center transition hover:bg-slate-50"
            >
              <IconBubble icon={Icon} tone={item.tone} />
              <p className="mt-2 text-xs font-black text-slate-800">
                {item.label}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function RequestBox() {
  return (
    <section
      id="request"
      className="rounded-[26px] bg-gradient-to-br from-emerald-50 via-white to-emerald-50 p-4 ring-1 ring-emerald-100"
    >
      <div className="flex gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-700 text-white">
          <Send className="h-6 w-6" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black">Butuh sesuatu cepat?</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Tulis kebutuhanmu, supplier akan kirim penawaran.
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500"
              placeholder="Contoh: kemasan kopi 500 pcs..."
            />
            <button className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white">
              Kirim
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsStrip({ desktop = false }: { desktop?: boolean }) {
  const stats = [
    {
      value: "1.240+",
      label: "Transaksi hari ini",
      icon: Users,
      tone: "emerald" as Tone,
    },
    {
      value: "98%",
      label: "Transaksi berhasil",
      icon: ShieldCheck,
      tone: "violet" as Tone,
    },
    {
      value: "320+",
      label: "Supplier online",
      icon: TrendingUp,
      tone: "amber" as Tone,
    },
  ];

  return (
    <section
      className={cn(
        "rounded-[26px] bg-white p-2.5 shadow-sm ring-1 ring-slate-100",
        desktop ? "grid grid-cols-3 gap-2 2xl:grid-cols-1" : "grid grid-cols-3 gap-2",
      )}
    >
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.label}
            className={cn(
              "rounded-2xl bg-slate-50 p-3",
              desktop && "2xl:flex 2xl:items-center 2xl:gap-3",
            )}
          >
            <div
              className={cn(
                "mx-auto grid h-9 w-9 place-items-center rounded-full 2xl:mx-0",
                toneBg(stat.tone),
              )}
            >
              <Icon className={cn("h-4 w-4", toneText(stat.tone))} />
            </div>
            <div className={desktop ? "mt-2 2xl:mt-0" : "mt-2 text-center"}>
              <p className="text-lg font-black text-emerald-700">
                {stat.value}
              </p>
              <p className="text-[11px] font-bold leading-tight text-slate-500">
                {stat.label}
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function ProductSection({
  locale,
  mobile = false,
}: {
  locale: string;
  mobile?: boolean;
}) {
  return (
    <section id="produk">
      <SectionHeader title="Rekomendasi Produk & Supplier" />

      <div
        className={cn(
          mobile
            ? "flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3",
        )}
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            locale={locale}
            mobile={mobile}
          />
        ))}
      </div>
    </section>
  );
}

function DiscoveryGuide({
  locale,
  mobile = false,
}: {
  locale: string;
  mobile?: boolean;
}) {
  const flows = [
    {
      title: "Cari supplier / produk",
      body: "Masuk ke Search, ketik kebutuhan, lalu sempitkan dengan kategori dan kota.",
      href: `/${locale}/search?type=product&q=supplier`,
      cta: "Buka Search",
      icon: Search,
      tone: "emerald" as Tone,
    },
    {
      title: "Lihat kumpulan reels",
      body: "Masuk ke feed reels untuk scroll video usaha, filter per toko, kota, atau produk.",
      href: `/${locale}/reels`,
      cta: "Lihat Reels",
      icon: Play,
      tone: "rose" as Tone,
    },
    {
      title: "Belum nemu? Buat request",
      body: "Tulis kebutuhan dan biarkan supplier yang datang kirim penawaran.",
      href: `/${locale}#request`,
      cta: "Buat Request",
      icon: Send,
      tone: "blue" as Tone,
    },
  ];

  return (
    <section className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3">
        <h2 className="text-lg font-black tracking-tight">
          Biar jelas, mau ngapain dulu?
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Search buat cari listing. Reels buat lihat bukti visual. Request buat
          kebutuhan yang belum ketemu.
        </p>
      </div>

      <div className={cn("grid gap-3", mobile ? "grid-cols-1" : "grid-cols-3")}>
        {flows.map((flow) => {
          const Icon = flow.icon;
          return (
            <Link
              key={flow.title}
              href={flow.href}
              className="rounded-[22px] bg-slate-50 p-4 transition hover:bg-slate-100"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1",
                    toneBg(flow.tone),
                  )}
                >
                  <Icon className={cn("h-5 w-5", toneText(flow.tone))} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black leading-snug">{flow.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {flow.body}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-700">
                    {flow.cta}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ProductCard({
  product,
  locale,
  mobile = false,
}: {
  product: Product;
  locale: string;
  mobile?: boolean;
}) {
  const Icon = product.icon;

  return (
    <article
      className={cn(
        "snap-start overflow-hidden rounded-[22px] bg-white shadow-sm ring-1 ring-slate-100",
        mobile && "min-w-[176px]",
      )}
    >
      <Link href={`/${locale}${product.searchHref}`} className="block">
        <div
          className={cn(
            "relative grid h-28 place-items-center overflow-hidden",
            toneSoftBg(product.tone),
          )}
        >
          <Image
            src={product.imageSrc}
            alt={product.name}
            fill
            className="object-cover"
            sizes={mobile ? "176px" : "(max-width: 1280px) 25vw, 18vw"}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/28 via-slate-950/8 to-transparent" />
          {product.badge && (
            <span
              className={cn(
                "absolute left-2.5 top-2.5 z-10 rounded-full px-2.5 py-1 text-[10px] font-black",
                product.badge === "Promo"
                  ? "bg-red-500 text-white"
                  : "bg-white text-emerald-700",
              )}
            >
              {product.badge}
            </span>
          )}

          <span className="absolute bottom-3 left-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/88 backdrop-blur">
            <Icon className={cn("h-5 w-5", toneText(product.tone))} />
          </span>

          <button className="absolute right-2.5 top-2.5 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-slate-500">
            <Heart className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3">
          <h3 className="min-h-9 text-sm font-black leading-tight">
            {product.name}
          </h3>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">
            {product.seller}
          </p>

          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-slate-500">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {product.rating} ({product.reviews})
          </div>

          <p className="mt-1 truncate text-xs font-semibold text-slate-500">
            {product.location}
          </p>

          <p className="mt-2 text-base font-black text-emerald-700">
            {product.price}
            <span className="ml-1 text-xs text-slate-500">{product.unit}</span>
          </p>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-500">
              Cari supplier sejenis
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700">
              Search
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function HomeReelsSection({
  locale,
  mobile = false,
}: {
  locale: string;
  mobile?: boolean;
}) {
  return (
    <section>
      <SectionHeader title="Reels Bisnis" href={`/${locale}/reels`} />

      <div
        className={cn(
          mobile
            ? "flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "grid grid-cols-3 gap-3",
        )}
      >
        {lajukanReels.slice(0, 3).map((reel: LajukanReel, index: number) => (
  <Link
    key={reel.id}
    href={`/${locale}/reels?q=${encodeURIComponent(reel.productName || reel.tag)}`}
    className={cn(
      "group relative snap-start overflow-hidden rounded-[24px] bg-slate-950 shadow-sm ring-1 ring-slate-100",
      mobile ? "h-60 min-w-[165px]" : "h-64",
    )}
  >
    <video
      src={reel.videoSrc}
      className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-300 group-hover:scale-105"
      muted
      loop
      autoPlay={index === 0}
      playsInline
      preload={index === 0 ? "auto" : "metadata"}
    />

    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />

    <div className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-emerald-700">
      {reel.tag}
    </div>

    {reel.productName && (
      <div className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-yellow-400 text-slate-950 shadow-lg">
        <ShoppingBag className="h-5 w-5" />
      </div>
    )}

    <div className="absolute inset-0 grid place-items-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-white/20 text-white backdrop-blur">
        <Play className="h-5 w-5 fill-white" />
      </div>
    </div>

    <div className="absolute inset-x-0 bottom-0 p-3 text-white">
      <p className="text-sm font-black leading-tight">{reel.title}</p>

      {reel.productName ? (
        <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-yellow-400 px-2.5 py-1 text-[11px] font-black text-slate-950">
          <ShoppingBag className="h-3.5 w-3.5" />
          <span className="truncate">{reel.productName}</span>
        </div>
      ) : (
        <p className="mt-1 line-clamp-1 text-xs font-semibold text-white/75">
          Konten edukasi bisnis
        </p>
      )}
    </div>
  </Link>
))}
      </div>
    </section>
  );
}

function PromoSection() {
  return (
    <section
      id="promo"
      className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-emerald-700 via-emerald-700 to-emerald-500 p-5 text-white"
    >
      <div className="relative z-10">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/15">
          <BadgePercent className="h-7 w-7" />
        </div>
        <p className="text-xl font-black">Promo Spesial Hari Ini</p>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-emerald-50">
          Diskon sampai 30% + gratis ongkir untuk kebutuhan bisnismu.
        </p>
        <button className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-emerald-700">
          Lihat Promo
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="absolute -bottom-14 -right-10 h-44 w-44 rounded-full bg-white/10" />
      <div className="absolute right-12 top-8 h-20 w-20 rounded-full bg-orange-300/30" />
    </section>
  );
}

function CommunitySection() {
  return (
    <section
      id="komunitas"
      className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-slate-100"
    >
      <SectionHeader title="Dari Komunitas" />

      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600">
          <Users className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-black">Komunitas UMKM Indonesia</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            2 jam lalu · Publik
          </p>

          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            Tips packaging yang menarik bisa tingkatkan nilai jual produk. Yuk
            diskusi dan saling kasih saran 👇
          </p>

          <div className="mt-3 grid h-32 place-items-center rounded-[22px] bg-gradient-to-br from-orange-100 via-white to-amber-100 text-orange-600">
            <Box className="h-12 w-12" />
          </div>

          <div className="mt-3 flex gap-5 text-sm font-bold text-slate-500">
            <span>👍 128</span>
            <span>💬 24</span>
            <span>Bagikan</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================
   SMALL COMPONENTS
========================= */

function Logo() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden="true">
        <path
          d="M24 3.75L41.5 13.8V34.2L24 44.25L6.5 34.2V13.8L24 3.75Z"
          fill="#047857"
        />
        <path
          d="M24 12.5L33.7 18.1V29.9L24 35.5L14.3 29.9V18.1L24 12.5Z"
          fill="white"
        />
        <path
          d="M24 19.25L29 22.15V27.85L24 30.75L19 27.85V22.15L24 19.25Z"
          fill="#047857"
        />
      </svg>
      <span className="text-2xl font-black tracking-tight">Lajukan</span>
    </div>
  );
}

function SearchBar({
  locale,
  className,
}: {
  locale: string;
  className?: string;
}) {
  return (
    <form
      action={`/${locale}/search`}
      className={cn(
        "flex min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200",
        className,
      )}
    >
      <input type="hidden" name="type" value="product" />
      <div className="grid w-11 shrink-0 place-items-center text-slate-400">
        <Search className="h-5 w-5" />
      </div>
      <input
        name="q"
        className="min-w-0 flex-1 bg-transparent py-3 text-sm font-semibold outline-none placeholder:text-slate-400"
        placeholder="Cari supplier, produk, jasa, lokasi..."
      />
      <button className="shrink-0 bg-emerald-700 px-5 text-sm font-black text-white">
        Cari
      </button>
    </form>
  );
}

function IconButton({
  icon: Icon,
  label,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-slate-600 ring-1 ring-slate-100"
    >
      <Icon className="h-5 w-5" />
      {badge && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function IconBubble({
  icon: Icon,
  tone,
}: {
  icon: LucideIcon;
  tone: Tone;
}) {
  return (
    <span
      className={cn(
        "mx-auto grid h-11 w-11 place-items-center rounded-full ring-1",
        toneBg(tone),
      )}
    >
      <Icon className={cn("h-5 w-5", toneText(tone))} />
    </span>
  );
}

function SectionHeader({
  title,
  href,
}: {
  title: string;
  href?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-black tracking-tight">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm font-black text-emerald-700"
        >
          Lihat semua
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <button className="text-sm font-black text-emerald-700">
          Lihat semua
        </button>
      )}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-black">{title}</h2>
        <button className="text-xs font-black text-emerald-700">
          Lihat semua
        </button>
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function FloatingMini({
  className,
  icon: Icon,
  label,
}: {
  className?: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div
      className={cn(
        "absolute flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-xs font-black text-slate-700 shadow-sm backdrop-blur",
        className,
      )}
    >
      <Icon className="h-4 w-4 text-emerald-700" />
      {label}
    </div>
  );
}

function HelpFooter() {
  return (
    <footer id="akun" className="pb-4">
      <div className="rounded-[26px] bg-white p-5 text-center shadow-sm ring-1 ring-slate-100">
        <div className="mb-3 flex justify-center">
          <Logo />
        </div>
        <p className="text-sm leading-relaxed text-slate-500">
          Cari supplier, produk, jasa, dan peluang usaha tanpa ribet.
        </p>
      </div>
    </footer>
  );
}

/* =========================
   STYLE HELPERS
========================= */

function toneBg(tone: Tone) {
  const map: Record<Tone, string> = {
    emerald: "bg-emerald-50 ring-emerald-100",
    green: "bg-green-50 ring-green-100",
    orange: "bg-orange-50 ring-orange-100",
    blue: "bg-blue-50 ring-blue-100",
    violet: "bg-violet-50 ring-violet-100",
    amber: "bg-amber-50 ring-amber-100",
    rose: "bg-rose-50 ring-rose-100",
    slate: "bg-slate-50 ring-slate-100",
  };

  return map[tone];
}

function toneSoftBg(tone: Tone) {
  const map: Record<Tone, string> = {
    emerald: "bg-gradient-to-br from-emerald-100 via-white to-emerald-50",
    green: "bg-gradient-to-br from-green-100 via-white to-green-50",
    orange: "bg-gradient-to-br from-orange-100 via-white to-orange-50",
    blue: "bg-gradient-to-br from-blue-100 via-white to-blue-50",
    violet: "bg-gradient-to-br from-violet-100 via-white to-violet-50",
    amber: "bg-gradient-to-br from-amber-100 via-white to-amber-50",
    rose: "bg-gradient-to-br from-rose-100 via-white to-rose-50",
    slate: "bg-gradient-to-br from-slate-200 via-white to-slate-50",
  };

  return map[tone];
}

function toneText(tone: Tone) {
  const map: Record<Tone, string> = {
    emerald: "text-emerald-700",
    green: "text-green-700",
    orange: "text-orange-600",
    blue: "text-blue-600",
    violet: "text-violet-700",
    amber: "text-amber-600",
    rose: "text-rose-600",
    slate: "text-slate-600",
  };

  return map[tone];
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
