import React from "react";
import {
  Bell,
  Briefcase,
  CalendarCheck,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Gift,
  Grid2X2,
  Heart,
  HelpCircle,
  Home,
  Image as ImageIcon,
  Lock,
  MapPin,
  Menu,
  MessageCircle,
  Package,
  Play,
  Plus,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Smile,
  Star,
  Store,
  User,
  Users,
  Video,
  XCircle,
} from "lucide-react";
import LajuloLogo from "@/components/logo/LajuloLogo";

const IS_AUTHENTICATED = true;

const products = [
  {
    name: "Daging Ayam Segar",
    seller: "Ayam Berkah Sentosa",
    price: "Rp 28.000",
    unit: "/kg",
    location: "Jakarta Barat",
    rating: "4.8",
    reviews: "120",
    badge: "Terpercaya",
    image:
      "https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=700&q=80",
  },
  {
    name: "Kopi Arabica Premium",
    seller: "Kopi Nusantara",
    price: "Rp 150.000",
    unit: "/250gr",
    location: "Bandung",
    rating: "4.9",
    reviews: "89",
    badge: "",
    image:
      "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=700&q=80",
  },
  {
    name: "Kemasan Box Custom",
    seller: "Packindo",
    price: "Rp 2.500",
    unit: "/pcs",
    location: "Tangerang",
    rating: "4.7",
    reviews: "56",
    badge: "Promo",
    image:
      "https://images.unsplash.com/photo-1605902711622-cfb43c4437d1?auto=format&fit=crop&w=700&q=80",
  },
  {
    name: "Sewa Dapur Bersertifikat",
    seller: "DapurKita",
    price: "Rp 250.000",
    unit: "/hari",
    location: "Jakarta Selatan",
    rating: "4.8",
    reviews: "78",
    badge: "",
    image:
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=700&q=80",
  },
  {
    name: "Desain Logo Brand",
    seller: "Studio Kreatif",
    price: "Rp 250.000",
    unit: "",
    location: "Online",
    rating: "4.9",
    reviews: "64",
    badge: "",
    image:
      "https://images.unsplash.com/photo-1634986666676-ec8fd927c23d?auto=format&fit=crop&w=700&q=80",
  },
];

const reels = [
  {
    tag: "Tips",
    title: "Cara Cari Supplier Terbaik untuk Usahamu",
    views: "9.8K",
    image:
      "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=500&q=80",
  },
  {
    tag: "Pemasaran",
    title: "Ide Konten Promosi Bikin Penjualan Meningkat",
    views: "8.1K",
    image:
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=500&q=80",
  },
  {
    tag: "Keuangan",
    title: "Kelola Keuangan Usaha Kecil Lebih Mudah",
    views: "6.2K",
    image:
      "https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=500&q=80",
  },
];

const activities = [
  [Briefcase, "Pesanan #INV-202505-001 telah dikonfirmasi", "1 jam lalu"],
  [User, "Penawaran baru dari Ayam Berkah Sentosa", "2 jam lalu"],
  [CircleDollarSign, "Pembayaran sebesar Rp 250.000 berhasil", "3 jam lalu"],
  [Store, "Jasa Desain Kreatif mengirim penawaran baru", "5 jam lalu"],
  [Package, "Pesanan #INV-202505-002 dalam pengiriman", "6 jam lalu"],
] as const;

const trends = [
  [Briefcase, "Minuman Kekinian", "Permintaan naik 23%"],
  [Send, "Jasa Digital Marketing", "Permintaan naik 18%"],
  [Package, "Frozen Food", "Permintaan naik 15%"],
  [Store, "Kemasan Ramah Lingkungan", "Permintaan naik 12%"],
] as const;

const suppliers = [
  ["CV. Makmur Jaya", "Jakarta Selatan", "Supplier Bahan Baku"],
  ["Nusantara Packindo", "Bandung", "Supplier Kemasan"],
  ["Dapur Kita Catering", "Surabaya", "Jasa Catering"],
  ["Kopi Nusantara", "Yogyakarta", "Supplier Minuman"],
] as const;

type Tone = "green" | "purple" | "orange" | "blue" | "slate";

type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

function Logo({ compact = false }: { compact?: boolean }) {
  return <LajuloLogo compact={compact} />;
}

function IconBadge({
  children,
  tone = "green",
  size = "md",
}: {
  children: React.ReactNode;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
}) {
  const tones: Record<Tone, string> = {
    green: "ui-success-bg ui-success-text ui-success-border",
    purple: "bg-[color:color-mix(in_srgb,#65a30d_16%,transparent)] text-lime-600 border-lime-500/20",
    orange: "ui-warning-bg ui-warning-text ui-warning-border",
    blue: "ui-info-bg ui-info-text ui-info-border",
    slate: "bg-[color:color-mix(in_srgb,var(--app-text)_8%,transparent)] text-[color:var(--app-text-soft)] border-[color:var(--app-border)]",
  };

  const sizes = {
    sm: "h-9 w-9",
    md: "h-12 w-12",
    lg: "h-14 w-14",
  };

  return (
    <div
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full border",
        sizes[size],
        tones[tone],
      )}
    >
      {children}
    </div>
  );
}

function SearchBar({ mobile = false }: { mobile?: boolean }) {
  return (
    <form className="flex min-w-0 flex-1 gap-2">
      <label
        className={cx(
          "ui-control flex min-w-0 flex-1 items-center gap-2 border px-3",
          mobile ? "h-12 rounded-2xl" : "h-11 rounded-2xl",
        )}
      >
        <Search className="h-5 w-5 shrink-0 text-[color:var(--app-text-soft)]" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
          placeholder="Cari supplier, produk, jasa, lokasi, talent..."
        />
      </label>
      <button
        className={cx(
          "ui-button-primary shrink-0 px-5 text-sm font-black",
          mobile ? "h-12" : "h-11 px-6",
        )}
      >
        Cari
      </button>
    </form>
  );
}

function SectionHeader({
  title,
  action = "Lihat semua",
}: {
  title: string;
  action?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="ui-title-1 text-[color:var(--app-text)]">{title}</h2>
      {action ? (
        <button className="text-xs font-bold text-[color:var(--app-accent)] transition hover:text-[color:var(--app-accent-strong)]">
          {action}
        </button>
      ) : null}
    </div>
  );
}

function ProductCard({
  product,
  compact = false,
}: {
  product: (typeof products)[number];
  compact?: boolean;
}) {
  return (
    <article
      className={cx(
        compact
          ? "w-[150px] min-w-[150px] max-w-[150px] sm:w-[190px] sm:min-w-[190px] sm:max-w-[190px]"
          : "w-[158px] min-w-[158px] max-w-[158px] sm:w-auto sm:min-w-0 sm:max-w-none",
        "ui-panel ui-card-hover overflow-hidden rounded-2xl transition hover:-translate-y-0.5",
      )}
    >
      <div className="relative h-28 overflow-hidden bg-[color:var(--app-skeleton)] sm:h-32 lg:h-28 xl:h-32">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
        {product.badge ? (
          <span
            className={cx(
              "absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-black shadow-sm backdrop-blur",
              product.badge === "Promo"
                ? "bg-[color:var(--app-danger)] text-[color:var(--app-text-inverse)]"
                : "bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]",
            )}
          >
            {product.badge}
          </span>
        ) : null}
        <button className="absolute right-2 top-2 rounded-full bg-black/25 p-1.5 text-white backdrop-blur transition hover:bg-black/35">
          <Heart className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 min-h-[36px] text-sm font-black leading-tight text-[color:var(--app-text)]">
          {product.name}
        </h3>
        <p className="truncate text-xs font-medium text-[color:var(--app-text-soft)]">
          {product.seller}
        </p>
        <div className="flex items-center gap-1 text-xs text-[color:var(--app-text-soft)]">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <span>{product.rating}</span>
          <span>({product.reviews})</span>
        </div>
        <div className="flex items-end gap-1">
          <span className="text-sm font-black text-[color:var(--app-accent)]">
            {product.price}
          </span>
          <span className="text-xs font-medium text-[color:var(--app-text-soft)]">
            {product.unit}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-[color:var(--app-text-soft)]">
          <MapPin className="h-3 w-3" />
          {product.location}
        </div>
      </div>
    </article>
  );
}

function ReelCard({ reel }: { reel: (typeof reels)[number] }) {
  return (
    <article className="relative h-56 w-[132px] min-w-[132px] max-w-[132px] overflow-hidden rounded-2xl bg-slate-950 shadow-[var(--app-shadow-soft)] sm:w-[150px] sm:min-w-[150px] sm:max-w-[150px] lg:w-auto lg:min-w-0 lg:max-w-none">
      <img src={reel.image} alt={reel.title} className="h-full w-full object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
      <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-black text-[color:var(--app-accent)] backdrop-blur">
        {reel.tag}
      </span>
      <div className="absolute bottom-3 left-3 right-3">
        <h3 className="line-clamp-3 text-xs font-black leading-snug text-white">
          {reel.title}
        </h3>
        <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-white/90">
          <Play className="h-3 w-3 fill-white" />
          {reel.views}
        </div>
      </div>
    </article>
  );
}

function Sidebar({ isAuthenticated = IS_AUTHENTICATED }: { isAuthenticated?: boolean }) {
  const topMenus = [
    [Home, "Beranda", "", true, false],
    [XCircle, "Jelajah", "Supplier, produk, jasa", false, false],
    [Users, "Komunitas", "Forum & diskusi", false, false],
    [Video, "Reels Bisnis", "Inspirasi & tips", false, false],
    [ClipboardList, "Permintaan Saya", "", false, !isAuthenticated],
    [Briefcase, "Penawaran Masuk", "", false, !isAuthenticated],
    [CalendarCheck, "Transaksi", "", false, !isAuthenticated],
    [Heart, "Favorit", "", false, !isAuthenticated],
  ] as const;

  return (
    <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 border-r border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-5 backdrop-blur-xl lg:block xl:w-[270px]">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <button className="ui-shell-button h-10 w-10 rounded-xl p-0 text-[color:var(--app-text-soft)]">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <nav className="space-y-1">
        {topMenus.map(([Icon, label, desc, active, locked]) => (
          <button
            key={label}
            className={cx(
              "group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition",
              active
                ? "bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] shadow-[inset_0_0_0_1px_var(--app-accent-border)]"
                : "text-[color:var(--app-text-soft)] hover:bg-[color:color-mix(in_srgb,var(--app-surface-strong)_70%,transparent)] hover:text-[color:var(--app-text)]",
            )}
          >
            <Icon
              className={cx(
                "h-5 w-5 shrink-0",
                active ? "text-[color:var(--app-accent)]" : "text-[color:var(--app-text-soft)]",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-[color:var(--app-text)]">
                {label}
              </span>
              {desc ? (
                <span className="block truncate text-[11px] font-medium text-[color:var(--app-text-soft)]">
                  {desc}
                </span>
              ) : locked ? (
                <span className="block truncate text-[11px] font-medium text-[color:var(--app-text-soft)]">
                  Login untuk akses
                </span>
              ) : null}
            </span>
            {locked ? (
              <Lock className="h-3.5 w-3.5 text-[color:var(--app-text-soft)]" />
            ) : label === "Komunitas" ? (
              <span className="rounded-full bg-[color:var(--app-accent-soft)] px-2 py-1 text-[10px] font-black text-[color:var(--app-accent)]">
                12
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="ui-hero-panel mt-6 rounded-3xl p-4">
        <p className="text-sm font-black text-[color:var(--app-text)]">
          {isAuthenticated ? "Tingkatkan visibilitas usahamu" : "Gabung di Lajukan"}
        </p>
        <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--app-text-soft)]">
          {isAuthenticated
            ? "Promosikan bisnismu dan jangkau lebih banyak pelanggan."
            : "Daftar gratis dan temukan jutaan peluang untuk bisnismu."}
        </p>
        <button className="ui-button-primary mt-4 w-full px-4 py-3 text-sm font-black">
          {isAuthenticated ? "Mulai Promosi" : "Daftar Gratis"}
        </button>
      </div>
    </aside>
  );
}

function TopBar({ isAuthenticated = IS_AUTHENTICATED }: { isAuthenticated?: boolean }) {
  return (
    <header className="sticky top-0 z-30 hidden border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_86%,transparent)] px-5 py-4 backdrop-blur-xl lg:block">
      <div className="flex items-center gap-4">
        <button className="ui-shell-button hidden h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black xl:flex">
          <Grid2X2 className="h-4 w-4" />
          Kategori
          <ChevronDown className="h-4 w-4 text-[color:var(--app-text-soft)]" />
        </button>
        <div className="mx-auto w-full max-w-2xl">
          <SearchBar />
        </div>
        <button className="hidden items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black text-[color:var(--app-text)] transition hover:bg-[color:var(--app-accent-soft)] xl:flex">
          <HelpCircle className="h-5 w-5" />
          Bantuan
        </button>
        {isAuthenticated ? (
          <>
            <button className="relative flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black text-[color:var(--app-text)] transition hover:bg-[color:var(--app-accent-soft)]">
              <MessageCircle className="h-5 w-5" />
              <span className="hidden xl:inline">Chat</span>
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--app-danger)] px-1 text-[10px] font-black text-white">
                3
              </span>
            </button>
            <button className="relative flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black text-[color:var(--app-text)] transition hover:bg-[color:var(--app-accent-soft)]">
              <Bell className="h-5 w-5" />
              <span className="hidden xl:inline">Notifikasi</span>
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--app-danger)] px-1 text-[10px] font-black text-white">
                7
              </span>
            </button>
            <button className="flex items-center gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-[color:var(--app-accent-soft)]">
              <img
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80"
                alt="Andi Pratama"
                className="h-10 w-10 rounded-full object-cover ring-1 ring-[color:var(--app-border)]"
              />
              <span className="hidden text-left xl:block">
                <span className="block text-sm font-black text-[color:var(--app-text)]">
                  Andi Pratama
                </span>
                <span className="block text-xs font-medium text-[color:var(--app-text-soft)]">
                  Pengusaha
                </span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-[color:var(--app-text-soft)] xl:block" />
            </button>
          </>
        ) : (
          <>
            <button className="ui-button-secondary px-5 py-3 text-sm font-black">Masuk</button>
            <button className="ui-button-primary px-5 py-3 text-sm font-black">Daftar Gratis</button>
          </>
        )}
      </div>
    </header>
  );
}

function MobileHeader({ isAuthenticated = IS_AUTHENTICATED }: { isAuthenticated?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_88%,transparent)] px-4 pb-3 pt-4 backdrop-blur-xl lg:hidden">
      <div className="mb-4 flex items-center justify-between">
        <button className="-ml-2 rounded-xl p-2 text-[color:var(--app-text)]">
          <Menu className="h-6 w-6" />
        </button>
        <Logo compact />
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <button className="relative text-[color:var(--app-text)]">
                <MessageCircle className="h-6 w-6" />
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--app-danger)] px-1 text-[10px] font-black text-white">
                  3
                </span>
              </button>
              <button className="relative text-[color:var(--app-text)]">
                <Bell className="h-6 w-6" />
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--app-danger)] px-1 text-[10px] font-black text-white">
                  7
                </span>
              </button>
            </>
          ) : (
            <button className="ui-button-primary min-h-0 rounded-xl px-3 py-2 text-xs font-black">
              Daftar
            </button>
          )}
        </div>
      </div>
      <SearchBar mobile />
    </header>
  );
}

function Hero({ isAuthenticated = IS_AUTHENTICATED }: { isAuthenticated?: boolean }) {
  return (
    <section className="px-4 pt-5 lg:px-0 lg:pt-0">
      <div className="ui-hero-panel overflow-hidden rounded-[28px] p-5 shadow-[var(--app-shadow)] ring-1 ring-[color:var(--app-border)] sm:p-7 lg:p-8">
        <div className="grid items-center gap-5 md:grid-cols-[1fr_260px] lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_420px]">
          <div>
            <p className="mb-3 text-sm font-black text-[color:var(--app-text)]">
              {isAuthenticated ? "Selamat pagi, Andi 👋" : "Platform #1 untuk semua kebutuhan usahamu"}
            </p>
            <h1 className="max-w-xl text-3xl font-black leading-tight tracking-tight text-[color:var(--app-text)] sm:text-4xl lg:text-[42px]">
              {isAuthenticated ? "Siap kembangkan" : "Semua kebutuhan usahamu,"} {" "}
              <span className="text-[color:var(--app-accent)]">
                {isAuthenticated ? "bisnismu hari ini?" : "ada di Lajukan"}
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-sm font-medium leading-6 text-[color:var(--app-text-soft)] sm:text-base">
              {isAuthenticated
                ? "Cari peluang. Perluas jaringan."
                : "Cari supplier, produk, jasa, lokasi, talent, dan peluang usaha terbaik. Nego langsung, transaksi aman, bisnis makin berkembang."}
            </p>
            <div className="mt-5 hidden max-w-lg md:block">
              <SearchBar />
            </div>
            {!isAuthenticated ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <button className="ui-button-primary px-5 py-3 text-sm font-black">Daftar Gratis</button>
                <button className="ui-button-secondary px-5 py-3 text-sm font-black">Jelajahi Platform</button>
              </div>
            ) : null}
          </div>

          <div className="relative flex min-h-[210px] items-end justify-center lg:min-h-[260px]">
            <div className="absolute inset-8 rounded-[40px] bg-[color:var(--app-accent-soft)] blur-3xl" />
            <img
              src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=700&q=80"
              alt="Pelaku usaha Lajukan"
              className="relative h-[220px] w-full rounded-[28px] object-cover object-center shadow-[var(--app-shadow-soft)] ring-1 ring-[color:var(--app-border)] sm:h-[260px] lg:h-[300px]"
            />
            <div className="ui-panel absolute right-3 top-3 hidden rounded-2xl p-3 backdrop-blur sm:block">
              <p className="text-xs font-black text-[color:var(--app-text)]">Supplier Terverifikasi</p>
              <p className="mt-1 text-xs font-bold text-[color:var(--app-accent)]">+2.5K</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickActions({ isAuthenticated = IS_AUTHENTICATED }: { isAuthenticated?: boolean }) {
  const actions = isAuthenticated
    ? [
        [Briefcase, "Buat Permintaan", "Cari supplier, jasa, atau produk", "green"],
        [Store, "Jelajahi", "Peluang aktif", "purple"],
        [ClipboardList, "Lihat Penawaran", "Penawaran baru menunggumu", "orange"],
        [MessageCircle, "Mulai Nego", "Chat & nego dengan supplier", "blue"],
      ]
    : [
        [Briefcase, "Supplier", "Supplier siap", "green"],
        [Package, "Produk", "Stok siap", "green"],
        [Store, "Jasa", "Berbagai jasa untuk bisnismu", "purple"],
        [MapPin, "Lokasi", "Lokasi jualan", "orange"],
        [User, "Talent", "Talent siap", "blue"],
        [Plus, "Permintaan", "Buat permintaan", "green"],
      ] as const;

  return (
    <section className="px-4 pt-4 lg:px-0">
      <div className="ui-panel grid grid-flow-col auto-cols-[86px] gap-3 overflow-x-auto rounded-3xl p-4 [scrollbar-width:none] sm:auto-cols-fr sm:grid-flow-row sm:grid-cols-3 lg:grid-cols-6 lg:gap-0 lg:p-0 [&::-webkit-scrollbar]:hidden">
        {actions.map(([Icon, title, desc, tone]) => (
          <button
            key={String(title)}
            className="flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition hover:bg-[color:var(--app-accent-soft)] lg:rounded-none lg:border-r lg:border-[color:var(--app-border)] lg:last:border-r-0"
          >
            <IconBadge tone={tone as Tone}>
              <Icon className="h-5 w-5" />
            </IconBadge>
            <span className="text-xs font-black text-[color:var(--app-text)]">{title as string}</span>
            <span className="hidden max-w-[120px] text-[11px] font-medium leading-4 text-[color:var(--app-text-soft)] sm:block">
              {desc as string}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function StatsStrip() {
  return (
    <section className="hidden px-4 pt-4 lg:block lg:px-0">
      <div className="ui-panel grid grid-cols-5 rounded-3xl p-4">
        {[
          [ClipboardList, "12", "Permintaan Saya"],
          [Briefcase, "5", "Penawaran Masuk"],
          [CalendarCheck, "8", "Transaksi Berjalan"],
          [CheckCircle2, "24", "Pesanan Selesai"],
          [CircleDollarSign, "Rp 24.560.000", "Total Pengeluaran"],
        ].map(([Icon, value, label]) => (
          <div key={String(label)} className="flex items-center gap-3 border-r border-[color:var(--app-border)] px-4 last:border-r-0">
            <IconBadge size="sm">
              <Icon className="h-4 w-4" />
            </IconBadge>
            <div>
              <p className="text-lg font-black text-[color:var(--app-text)]">{value as string}</p>
              <p className="text-xs font-medium text-[color:var(--app-text-soft)]">{label as string}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductSection() {
  return (
    <section className="px-4 pt-5 lg:px-0">
      <SectionHeader title="Rekomendasi Produk & Supplier" />
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 [&::-webkit-scrollbar]:hidden">
        {products.map((product) => (
          <ProductCard key={product.name} product={product} compact />
        ))}
      </div>
    </section>
  );
}

function Composer() {
  return (
    <section className="px-4 pt-5 lg:px-0">
      <div className="flex border-b border-[color:var(--app-border)]">
        {["Untukmu", "Mengikuti", "Komunitas", "Reels"].map((tab, index) => (
          <button
            key={tab}
            className={cx(
              "flex-1 pb-3 text-sm font-black",
              index === 0
                ? "border-b-2 border-[color:var(--app-accent)] text-[color:var(--app-accent)]"
                : "text-[color:var(--app-text-soft)]",
            )}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="ui-panel mt-4 rounded-3xl p-4">
        <div className="mb-3 flex items-center gap-3">
          <img
            src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80"
            alt="Andi"
            className="h-10 w-10 rounded-full object-cover ring-1 ring-[color:var(--app-border)]"
          />
          <div className="flex h-11 flex-1 items-center rounded-full bg-[color:var(--app-skeleton)] px-4 text-sm font-medium text-[color:var(--app-text-soft)]">
            Apa yang sedang Anda pikirkan?
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-[11px] font-bold text-[color:var(--app-text-soft)]">
          <button className="flex items-center justify-center gap-1">
            <ImageIcon className="h-4 w-4 text-[color:var(--app-accent)]" />Foto
          </button>
          <button className="flex items-center justify-center gap-1">
            <Video className="h-4 w-4 text-[color:var(--app-danger)]" />Reels
          </button>
          <button className="flex items-center justify-center gap-1">
            <ChartNoAxesColumnIncreasing className="h-4 w-4 text-[color:var(--app-warning)]" />Polling
          </button>
          <button className="flex items-center justify-center gap-1">
            <Smile className="h-4 w-4 text-[color:var(--app-info)]" />Perasaan
          </button>
        </div>
      </div>
    </section>
  );
}

function CommunityPost() {
  return (
    <article className="ui-panel rounded-3xl p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <img
            src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=120&q=80"
            alt="Komunitas UMKM"
            className="h-11 w-11 rounded-full object-cover ring-1 ring-[color:var(--app-border)]"
          />
          <div>
            <p className="text-sm font-black text-[color:var(--app-text)]">Komunitas UMKM Indonesia</p>
            <p className="text-xs font-medium text-[color:var(--app-text-soft)]">2 jam yang lalu · 🌐</p>
          </div>
        </div>
        <button className="text-[color:var(--app-text-soft)]">•••</button>
      </div>
      <p className="text-sm font-medium leading-6 text-[color:var(--app-text)]">
        Tips packaging yang menarik bisa tingkatkan nilai jual produk! Yuk diskusi di sini! 👇
      </p>
      <img
        src="https://images.unsplash.com/photo-1605902711622-cfb43c4437d1?auto=format&fit=crop&w=800&q=80"
        alt="Packaging"
        className="mt-3 h-40 w-full rounded-2xl object-cover ring-1 ring-[color:var(--app-border)]"
      />
      <div className="mt-3 flex items-center justify-between border-t border-[color:var(--app-border)] pt-3 text-xs font-bold text-[color:var(--app-text-soft)]">
        <span>👍 128</span>
        <span>💬 24</span>
        <span className="flex items-center gap-1">
          <Share2 className="h-4 w-4" />Bagikan
        </span>
      </div>
    </article>
  );
}

function ReelsSection() {
  return (
    <section>
      <SectionHeader title="Reels Inspirasi" />
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] lg:grid lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
        {reels.map((reel) => (
          <ReelCard key={reel.title} reel={reel} />
        ))}
      </div>
    </section>
  );
}

function ActivityList() {
  return (
    <div className="ui-panel rounded-3xl p-4">
      <SectionHeader title="Aktivitas Terbaru" />
      <div className="space-y-2">
        {activities.map(([Icon, title, time]) => (
          <div key={String(title)} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-[color:var(--app-accent-soft)]">
            <IconBadge size="sm">
              <Icon className="h-4 w-4" />
            </IconBadge>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold leading-5 text-[color:var(--app-text)]">{title}</p>
              <p className="text-[11px] font-medium text-[color:var(--app-text-soft)]">{time}</p>
            </div>
            <span className="h-2 w-2 rounded-full bg-[color:var(--app-info)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendList() {
  return (
    <div className="ui-panel rounded-3xl p-4">
      <SectionHeader title="Tren & Peluang Usaha" />
      <div className="space-y-2">
        {trends.map(([Icon, title, desc], index) => (
          <div key={String(title)} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-[color:var(--app-accent-soft)]">
            <IconBadge size="sm" tone={index === 0 ? "purple" : index === 1 ? "blue" : index === 2 ? "orange" : "green"}>
              <Icon className="h-4 w-4" />
            </IconBadge>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-[color:var(--app-text)]">{title}</p>
              <p className="text-xs font-medium text-[color:var(--app-accent)]">{desc}</p>
            </div>
            <ChartNoAxesColumnIncreasing className="h-7 w-7 text-[color:var(--app-accent)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RightRail({ isAuthenticated = IS_AUTHENTICATED }: { isAuthenticated?: boolean }) {
  return (
    <aside className="hidden w-[320px] shrink-0 space-y-4 xl:block">
      <div className="sticky top-24 space-y-4">
        {isAuthenticated ? <ActivityList /> : null}
        <TrendList />
        <div className="ui-contrast-panel overflow-hidden rounded-3xl p-5 shadow-[var(--app-shadow)]">
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black leading-tight text-[color:var(--app-text)]">
                {isAuthenticated ? "Undang teman, dapatkan bonus!" : "Gabung sekarang, dapatkan peluang lebih banyak!"}
              </h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--app-text-soft)]">
                {isAuthenticated
                  ? "Ajak teman bergabung di Lajukan dan dapatkan bonus menarik."
                  : "Akses semua fitur, mulai nego, dan bangun jaringan bisnis."}
              </p>
              <button className="ui-button-primary mt-4 px-5 py-3 text-sm font-black">
                {isAuthenticated ? "Undang Teman" : "Daftar Gratis"}
              </button>
            </div>
            <Gift className="h-20 w-20 shrink-0 text-[color:var(--app-accent)]" />
          </div>
        </div>
      </div>
    </aside>
  );
}

function BottomNav({ isAuthenticated = IS_AUTHENTICATED }: { isAuthenticated?: boolean }) {
  const navItems = [
    [Home, "Beranda", true],
    [Grid2X2, "Jelajah", false],
    [Plus, "Buat", false],
    [isAuthenticated ? ClipboardList : Users, isAuthenticated ? "Transaksi" : "Komunitas", false],
    [User, "Akun", false],
  ] as const;

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 grid w-full max-w-[430px] -translate-x-1/2 grid-cols-5 rounded-t-[28px] border-x-0 border-t border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_90%,transparent)] px-3 pb-5 pt-3 shadow-[var(--app-shadow-sheet)] backdrop-blur-xl lg:hidden">
      {navItems.map(([Icon, label, active], index) => (
        <button key={String(label)} className="flex flex-col items-center gap-1 text-[11px] font-bold">
          <span
            className={cx(
              index === 2
                ? "-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] shadow-lg shadow-emerald-600/25"
                : active
                  ? "text-[color:var(--app-accent)]"
                  : "text-[color:var(--app-text-soft)]",
            )}
          >
            <Icon className={index === 2 ? "h-7 w-7" : "h-6 w-6"} />
          </span>
          <span className={active ? "text-[color:var(--app-accent)]" : "text-[color:var(--app-text-soft)]"}>
            {label as string}
          </span>
        </button>
      ))}
    </nav>
  );
}

function MobileLongSections({ isAuthenticated = IS_AUTHENTICATED }: { isAuthenticated?: boolean }) {
  return (
    <div className="space-y-5 px-4 pt-5 xl:hidden">
      {isAuthenticated ? <ActivityList /> : null}
      <TrendList />

      <div className="ui-panel rounded-3xl p-5">
        <SectionHeader title="Cara Kerja Lajukan" />
        <div className="space-y-3">
          {[
            ["Cari", "Supplier, produk, jasa"],
            ["Hubungi & Nego", "Chat langsung, negosiasi mudah"],
            ["Transaksi Aman", "Pembayaran aman dan terproteksi"],
            ["Kembangkan", "Tumbuh bareng Lajukan"],
          ].map(([title, desc], index) => (
            <div key={title} className="flex items-center gap-4 rounded-2xl bg-[color:var(--app-surface-muted)] p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-base font-black text-[color:var(--app-accent)]">
                {index + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-[color:var(--app-text)]">{title}</p>
                <p className="text-xs font-medium leading-5 text-[color:var(--app-text-soft)]">{desc}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-[color:var(--app-accent)]" />
            </div>
          ))}
        </div>
      </div>

      <div className="ui-panel rounded-3xl p-5">
        <SectionHeader title="Supplier Terbaru Bergabung" />
        <div className="space-y-3">
          {suppliers.map(([name, city, type]) => (
            <div key={name} className="flex items-center gap-3">
              <IconBadge size="sm" tone="orange">
                <Package className="h-4 w-4" />
              </IconBadge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-[color:var(--app-text)]">{name}</p>
                <p className="text-xs font-medium text-[color:var(--app-text-soft)]">{city}</p>
                <p className="text-[11px] font-medium text-[color:var(--app-text-soft)]">{type}</p>
              </div>
              <button className="ui-button-secondary min-h-0 rounded-xl px-4 py-2 text-xs font-black text-[color:var(--app-accent)]">
                Ikuti
              </button>
            </div>
          ))}
        </div>
      </div>

      <footer className="pb-4 pt-2">
        <Logo />
        <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--app-text-soft)]">
          Platform terpercaya untuk semua kebutuhan bisnis Anda. Cari, negosiasi, dan kembangkan bisnismu bersama kami.
        </p>
        <p className="mt-6 text-center text-xs font-medium text-[color:var(--app-text-soft)]">
          © 2026 Lajukan. Semua hak dilindungi.
        </p>
      </footer>
    </div>
  );
}

export default function LajukanResponsiveHome() {
  const isAuthenticated = IS_AUTHENTICATED;

  return (
    <main className="app-shell max-h-[100svh] min-h-screen bg-[color:var(--app-surface-muted)] font-sans text-[color:var(--app-text)] antialiased dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]">
      <div className="flex min-h-screen">
        <Sidebar isAuthenticated={isAuthenticated} />

        <div className="min-w-0 flex-1 pb-6 lg:pb-0">
          <MobileHeader isAuthenticated={isAuthenticated} />
          <TopBar isAuthenticated={isAuthenticated} />

          <div className="mx-auto flex max-w-[1500px] gap-5 lg:p-5 xl:gap-6">
            <div className="min-w-0 flex-1">
              <Hero isAuthenticated={isAuthenticated} />
              <QuickActions isAuthenticated={isAuthenticated} />
              {isAuthenticated ? <StatsStrip /> : null}
              <ProductSection />

              <div className="g">
                <ReelsSection />

                <div className="space-y-5">
                  {isAuthenticated ? <Composer /> : null}
                  <CommunityPost />
                </div>
              </div>

              <MobileLongSections isAuthenticated={isAuthenticated} />
            </div>

            <RightRail isAuthenticated={isAuthenticated} />
          </div>
        </div>
      </div>

      <BottomNav isAuthenticated={isAuthenticated} />
    </main>
  );
}
