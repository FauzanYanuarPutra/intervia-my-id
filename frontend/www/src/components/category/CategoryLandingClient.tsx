'use client';

import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { type FormEvent, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  ChevronRight,
  Headphones,
  LayoutGrid,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useNotificationInbox } from '@/context/NotificationInboxContext';
import {
  localContentImageForTopic,
  localHomeVisual,
} from '@/lib/media/localSeedMedia';
import { cn } from '@/lib/utils';

type Copy = {
  id: string;
  en: string;
};

type Tone = 'emerald' | 'rose' | 'sky' | 'violet' | 'amber';
type LeafCategoryId =
  | 'supplier'
  | 'location'
  | 'service'
  | 'product'
  | 'talent';
type CategoryId = 'all' | LeafCategoryId;

type CategoryDefinition = {
  id: LeafCategoryId;
  tone: Tone;
  icon: LucideIcon;
  label: Copy;
  summary: Copy;
  description: Copy;
  heroTitle: Copy;
  heroDescription: Copy;
  illustration: string;
  browseHref: string;
  searchQuery: string;
};

type TopicChip = {
  id: string;
  emoji: string;
  label: Copy;
  href: string;
};

type ShowcaseItem = {
  id: string;
  category: LeafCategoryId;
  title: string;
  location: string;
  rating: string;
  reviews: string;
  price: string;
  unit: string;
  image: string;
  href: string;
  description: Copy;
  verified?: boolean;
};

type BenefitItem = {
  id: string;
  title: Copy;
  description: Copy;
  icon: LucideIcon;
};

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: 'supplier',
    tone: 'emerald',
    icon: ShoppingBag,
    label: { id: 'Supplier', en: 'Suppliers' },
    summary: {
      id: 'Supplier siap buat usahamu',
      en: 'Find trusted suppliers for your business needs',
    },
    description: {
      id: 'Supplier stok, bahan baku, grosir.',
      en: 'Discover reliable suppliers for daily stock, raw materials, and wholesale sourcing.',
    },
    heroTitle: {
      id: 'Cari supplier cepat',
      en: 'Find the best suppliers for your business needs',
    },
    heroDescription: {
      id: 'Terpercaya, berkualitas, dan harga bersaing',
      en: 'Trusted quality with competitive pricing',
    },
    illustration: localHomeVisual('supplier'),
    browseHref: '/search?q=supplier%20bahan%20baku',
    searchQuery: 'supplier bahan baku',
  },
  {
    id: 'location',
    tone: 'rose',
    icon: MapPin,
    label: { id: 'Lokasi Usaha', en: 'Business Locations' },
    summary: {
      id: 'Lokasi usaha siap cek',
      en: 'Find strategic places for your business',
    },
    description: {
      id: 'Kios, booth, ruko, dapur.',
      en: 'Compare kiosks, booths, cloud kitchens, and other spaces that match your budget.',
    },
    heroTitle: {
      id: 'Cari lokasi usaha',
      en: 'Find the business location that fits you best',
    },
    heroDescription: {
      id: 'Cek area, traffic, budget.',
      en: 'Compare area, traffic, and budget faster',
    },
    illustration: localHomeVisual('location'),
    browseHref: '/search?type=property&q=lokasi%20usaha',
    searchQuery: 'lokasi usaha',
  },
  {
    id: 'service',
    tone: 'sky',
    icon: BriefcaseBusiness,
    label: { id: 'Jasa', en: 'Services' },
    summary: {
      id: 'Jasa biar operasional jalan',
      en: 'Pick services that keep operations moving',
    },
    description: {
      id: 'Desain, admin, legal, foto.',
      en: 'Find design, admin, legal, photography, and execution support in one place.',
    },
    heroTitle: {
      id: 'Pilih jasa operasional',
      en: 'Choose service partners for your operations',
    },
    heroDescription: {
      id: 'Dari desain, admin, hingga eksekusi lapangan',
      en: 'From design and admin to hands-on execution',
    },
    illustration: localContentImageForTopic('service', 'category-service'),
    browseHref: '/search?q=jasa%20usaha',
    searchQuery: 'jasa usaha',
  },
  {
    id: 'product',
    tone: 'violet',
    icon: Package,
    label: { id: 'Produk', en: 'Products' },
    summary: {
      id: 'Stok siap jual',
      en: 'Find ready-to-sell products with faster turnover',
    },
    description: {
      id: 'Produk, frozen food, grosir.',
      en: 'Explore products, frozen food, retail stock, and wholesale-ready items for resale.',
    },
    heroTitle: {
      id: 'Cari stok toko',
      en: 'Find ready-to-sell stock for your store',
    },
    heroDescription: {
      id: 'Cepat putar, margin aman.',
      en: 'Fast-moving items, safer margins, cleaner sourcing',
    },
    illustration: localContentImageForTopic('product', 'category-product'),
    browseHref: '/search?type=product&q=produk%20reseller',
    searchQuery: 'produk reseller',
  },
  {
    id: 'talent',
    tone: 'amber',
    icon: UserRound,
    label: { id: 'Talent', en: 'Talent' },
    summary: {
      id: 'Talent siap bantu',
      en: 'Find dependable talent to support your business team',
    },
    description: {
      id: 'Admin, konten, sales, operator.',
      en: 'Search for creators, admin staff, sales support, and other business-ready talent.',
    },
    heroTitle: {
      id: 'Cari talent cepat',
      en: 'Find talent that helps your business grow',
    },
    heroDescription: {
      id: 'Freelancer, admin, sales, dan partner kreatif',
      en: 'Freelancers, admins, sales support, and creative partners',
    },
    illustration: localContentImageForTopic('talent', 'category-talent'),
    browseHref: '/search?type=freelancer&q=talent%20usaha',
    searchQuery: 'talent usaha',
  },
];

const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORY_DEFINITIONS.map(item => [item.id, item]),
) as Record<LeafCategoryId, CategoryDefinition>;

const ALL_CATEGORY_TILE_LABEL: Copy = {
  id: 'Semua Kategori',
  en: 'All Categories',
};

const BENEFITS: BenefitItem[] = [
  {
    id: 'easy',
    title: { id: 'Gratis & Mudah', en: 'Free & Easy' },
    description: { id: 'Tanpa biaya apapun', en: 'No extra platform fee' },
    icon: UserRound,
  },
  {
    id: 'offers',
    title: { id: 'Banyak Penawaran', en: 'More Offers' },
    description: { id: 'Pilihan terbaik', en: 'Get better comparisons' },
    icon: ShoppingBag,
  },
  {
    id: 'verified',
    title: { id: 'Terverifikasi', en: 'Verified' },
    description: { id: 'Supplier tepercaya', en: 'From trusted partners' },
    icon: ShieldCheck,
  },
];

const ALL_CATEGORY_TOPICS: TopicChip[] = [
  {
    id: 'ayam',
    emoji: '🐔',
    label: { id: 'Ayam & Daging', en: 'Chicken & Meat' },
    href: '/search?q=supplier%20ayam',
  },
  {
    id: 'seafood',
    emoji: '🐟',
    label: { id: 'Ikan & Seafood', en: 'Seafood' },
    href: '/search?q=ikan%20seafood',
  },
  {
    id: 'vegetables',
    emoji: '🥬',
    label: { id: 'Sayuran', en: 'Vegetables' },
    href: '/search?q=sayuran',
  },
  {
    id: 'fruit',
    emoji: '🍎',
    label: { id: 'Buah-buahan', en: 'Fruits' },
    href: '/search?q=buah',
  },
  {
    id: 'dry',
    emoji: '📦',
    label: { id: 'Bahan Kering', en: 'Dry Goods' },
    href: '/search?q=bahan%20kering',
  },
  {
    id: 'drinks',
    emoji: '🥤',
    label: { id: 'Minuman', en: 'Drinks' },
    href: '/search?q=minuman',
  },
  {
    id: 'kitchen',
    emoji: '🍳',
    label: { id: 'Peralatan Dapur', en: 'Kitchen Tools' },
    href: '/search?q=peralatan%20dapur',
  },
  {
    id: 'packaging',
    emoji: '🧃',
    label: { id: 'Kemasan', en: 'Packaging' },
    href: '/search?q=kemasan',
  },
  {
    id: 'creative',
    emoji: '✏️',
    label: { id: 'Desain & Kreatif', en: 'Design & Creative' },
    href: '/search?q=desain%20kreatif',
  },
  {
    id: 'marketing',
    emoji: '📣',
    label: { id: 'Marketing', en: 'Marketing' },
    href: '/search?q=marketing',
  },
];

const CATEGORY_TOPICS: Record<LeafCategoryId, TopicChip[]> = {
  supplier: [
    {
      id: 'chicken',
      emoji: '🐔',
      label: { id: 'Ayam', en: 'Chicken' },
      href: '/search?q=supplier%20ayam',
    },
    {
      id: 'meat',
      emoji: '🥩',
      label: { id: 'Daging', en: 'Meat' },
      href: '/search?q=supplier%20daging',
    },
    {
      id: 'seafood',
      emoji: '🐟',
      label: { id: 'Ikan & Seafood', en: 'Seafood' },
      href: '/search?q=supplier%20seafood',
    },
    {
      id: 'vegetables',
      emoji: '🥬',
      label: { id: 'Sayuran', en: 'Vegetables' },
      href: '/search?q=supplier%20sayuran',
    },
    {
      id: 'fruit',
      emoji: '🍊',
      label: { id: 'Buah', en: 'Fruit' },
      href: '/search?q=supplier%20buah',
    },
    {
      id: 'dry',
      emoji: '📦',
      label: { id: 'Bahan Kering', en: 'Dry Goods' },
      href: '/search?q=bahan%20kering',
    },
  ],
  location: [
    {
      id: 'ruko',
      emoji: '🏬',
      label: { id: 'Ruko', en: 'Shophouse' },
      href: '/search?type=property&q=ruko',
    },
    {
      id: 'kios',
      emoji: '🛍️',
      label: { id: 'Kios', en: 'Kiosk' },
      href: '/search?type=property&q=kios',
    },
    {
      id: 'booth',
      emoji: '🧺',
      label: { id: 'Booth', en: 'Booth' },
      href: '/search?type=property&q=booth',
    },
    {
      id: 'cloud',
      emoji: '🍽️',
      label: { id: 'Cloud Kitchen', en: 'Cloud Kitchen' },
      href: '/search?type=property&q=cloud%20kitchen',
    },
    {
      id: 'warehouse',
      emoji: '🏭',
      label: { id: 'Gudang Kecil', en: 'Small Warehouse' },
      href: '/search?type=property&q=gudang',
    },
    {
      id: 'mall',
      emoji: '🏢',
      label: { id: 'Mall Area', en: 'Mall Area' },
      href: '/search?type=property&q=mall',
    },
  ],
  service: [
    {
      id: 'design',
      emoji: '🎨',
      label: { id: 'Desain', en: 'Design' },
      href: '/search?q=jasa%20desain',
    },
    {
      id: 'photo',
      emoji: '📷',
      label: { id: 'Foto Produk', en: 'Product Photo' },
      href: '/search?q=foto%20produk',
    },
    {
      id: 'admin',
      emoji: '🧾',
      label: { id: 'Admin', en: 'Admin' },
      href: '/search?q=jasa%20admin',
    },
    {
      id: 'legal',
      emoji: '⚖️',
      label: { id: 'Legal', en: 'Legal' },
      href: '/search?q=jasa%20legal',
    },
    {
      id: 'marketing',
      emoji: '📣',
      label: { id: 'Marketing', en: 'Marketing' },
      href: '/search?q=jasa%20marketing',
    },
    {
      id: 'delivery',
      emoji: '🛵',
      label: { id: 'Kurir', en: 'Courier' },
      href: '/search?q=jasa%20kurir',
    },
  ],
  product: [
    {
      id: 'frozen',
      emoji: '🧊',
      label: { id: 'Frozen Food', en: 'Frozen Food' },
      href: '/search?type=product&q=Frozen%20Food',
    },
    {
      id: 'drinks',
      emoji: '🥤',
      label: { id: 'Minuman', en: 'Drinks' },
      href: '/search?type=product&q=Minuman',
    },
    {
      id: 'snacks',
      emoji: '🍪',
      label: { id: 'Snack', en: 'Snacks' },
      href: '/search?type=product&q=Snack',
    },
    {
      id: 'staples',
      emoji: '🛒',
      label: { id: 'Sembako', en: 'Staples' },
      href: '/search?type=product&q=Sembako',
    },
    {
      id: 'packaging',
      emoji: '📦',
      label: { id: 'Kemasan', en: 'Packaging' },
      href: '/search?type=product&q=Kemasan',
    },
    {
      id: 'tools',
      emoji: '🍳',
      label: { id: 'Peralatan', en: 'Tools' },
      href: '/search?type=product&q=Peralatan',
    },
  ],
  talent: [
    {
      id: 'cashier',
      emoji: '💳',
      label: { id: 'Kasir', en: 'Cashier' },
      href: '/search?type=freelancer&q=kasir',
    },
    {
      id: 'admin',
      emoji: '🧾',
      label: { id: 'Admin Toko', en: 'Store Admin' },
      href: '/search?type=freelancer&q=admin%20toko',
    },
    {
      id: 'creator',
      emoji: '🎥',
      label: { id: 'Konten Kreator', en: 'Content Creator' },
      href: '/search?type=freelancer&q=konten%20kreator',
    },
    {
      id: 'sales',
      emoji: '🤝',
      label: { id: 'Sales', en: 'Sales' },
      href: '/search?type=freelancer&q=sales',
    },
    {
      id: 'ops',
      emoji: '📋',
      label: { id: 'Operasional', en: 'Operations' },
      href: '/search?type=freelancer&q=operasional',
    },
    {
      id: 'design',
      emoji: '✏️',
      label: { id: 'Desainer', en: 'Designer' },
      href: '/search?type=freelancer&q=desainer',
    },
  ],
};

const SHOWCASE_ITEMS: ShowcaseItem[] = [];

function pick(isId: boolean, copy: Copy): string {
  return isId ? copy.id : copy.en;
}

function canonicalizeDiscoveryHref(href: string): string {
  const [pathname, queryString = ''] = href.split('?');
  const params = new URLSearchParams(queryString);

  if (pathname === '/property') {
    const query = params.get('q') || params.get('category') || 'lokasi jualan';
    return `/search?type=property&q=${encodeURIComponent(query)}`;
  }

  if (pathname === '/marketplace') {
    const query = params.get('q') || params.get('category') || 'supplier';
    return `/search?type=product&q=${encodeURIComponent(query)}`;
  }

  if (pathname === '/freelancers') {
    const query = params.get('q') || 'umkm';
    return `/search?type=freelancer&q=${encodeURIComponent(query)}`;
  }

  return href;
}

function toneStyles(tone: Tone) {
  if (tone === 'rose') {
    return {
      active: 'border-rose-500 bg-rose-50 text-rose-700',
      idle: 'border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50/70',
      icon: 'bg-rose-100 text-rose-600',
      badge: 'bg-rose-50 text-rose-700',
      hero: 'from-white via-rose-50 to-orange-50',
      shadow: 'shadow-[0_24px_40px_-30px_rgba(244,63,94,0.42)]',
      accentText: 'text-rose-600',
    };
  }
  if (tone === 'sky') {
    return {
      active: 'border-teal-500 bg-teal-50 text-teal-700',
      idle: 'border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50/70',
      icon: 'bg-teal-100 text-teal-700',
      badge: 'bg-teal-50 text-teal-700',
      hero: 'from-white via-teal-50 to-emerald-50',
      shadow: 'shadow-[0_24px_40px_-30px_rgba(13,148,136,0.35)]',
      accentText: 'text-teal-700',
    };
  }
  if (tone === 'violet') {
    return {
      active: 'border-lime-500 bg-lime-50 text-lime-800',
      idle: 'border-slate-200 bg-white text-slate-700 hover:border-lime-200 hover:bg-lime-50/70',
      icon: 'bg-lime-100 text-lime-800',
      badge: 'bg-lime-50 text-lime-800',
      hero: 'from-white via-lime-50 to-emerald-50',
      shadow: 'shadow-[0_24px_40px_-30px_rgba(101,163,13,0.35)]',
      accentText: 'text-lime-700',
    };
  }
  if (tone === 'amber') {
    return {
      active: 'border-amber-500 bg-amber-50 text-amber-700',
      idle: 'border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50/70',
      icon: 'bg-amber-100 text-amber-600',
      badge: 'bg-amber-50 text-amber-700',
      hero: 'from-white via-amber-50 to-orange-50',
      shadow: 'shadow-[0_24px_40px_-30px_rgba(245,158,11,0.35)]',
      accentText: 'text-amber-600',
    };
  }
  return {
    active: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    idle: 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/70',
    icon: 'bg-emerald-100 text-emerald-700',
    badge: 'bg-emerald-50 text-emerald-700',
    hero: 'from-white via-emerald-50 to-lime-50',
    shadow: 'shadow-[0_24px_40px_-30px_rgba(22,163,74,0.35)]',
    accentText: 'text-emerald-600',
  };
}

function getPrimaryAction(
  category: LeafCategoryId,
  requestHref: string,
  isId: boolean,
): { href: string; label: string } {
  if (category === 'location') {
    return {
      href: '/search?type=property&q=lokasi%20jualan',
      label: isId ? 'Cari Lokasi' : 'Find Location',
    };
  }
  if (category === 'product') {
    return {
      href: '/search?type=product&q=supplier',
      label: isId ? 'Lihat Produk' : 'View Products',
    };
  }
  if (category === 'talent') {
    return {
      href: '/search?type=freelancer&q=umkm',
      label: isId ? 'Cari Talent' : 'Find Talent',
    };
  }
  return {
    href: requestHref,
    label: isId ? 'Buat Permintaan' : 'Create Request',
  };
}

function getShowcaseItems(category: CategoryId): ShowcaseItem[] {
  void category;
  return [];
}

function getTopicLabel(category: LeafCategoryId, isId: boolean): string {
  const label = pick(isId, CATEGORY_BY_ID[category].label);
  return isId ? `Kategori ${label}` : `${label} Categories`;
}

type CategoryLandingClientProps = {
  isId: boolean;
  initialQuery?: string;
};

export function CategoryLandingClient({
  isId,
  initialQuery = '',
}: CategoryLandingClientProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { unreadCount } = useNotificationInbox();
  const [searchValue, setSearchValue] = useState(initialQuery);
  const [desktopCategory, setDesktopCategory] = useState<CategoryId>('all');
  const [mobileCategory, setMobileCategory] =
    useState<LeafCategoryId>('supplier');

  const requestHref = isAuthenticated ? '/create' : '/register';

  const desktopCategoryConfig =
    desktopCategory === 'all' ? null : CATEGORY_BY_ID[desktopCategory];
  const resolvedDesktopConfig =
    desktopCategoryConfig ?? CATEGORY_DEFINITIONS[0];
  const desktopTone = toneStyles(desktopCategoryConfig?.tone || 'emerald');
  const mobileCategoryConfig = CATEGORY_BY_ID[mobileCategory];
  const mobileTone = toneStyles(mobileCategoryConfig.tone);

  const desktopShowcase = useMemo(
    () => getShowcaseItems(desktopCategory),
    [desktopCategory],
  );
  const mobileShowcase = useMemo(
    () => getShowcaseItems(mobileCategory),
    [mobileCategory],
  );
  const desktopTopics = useMemo(
    () =>
      desktopCategory === 'all'
        ? ALL_CATEGORY_TOPICS
        : CATEGORY_TOPICS[desktopCategory],
    [desktopCategory],
  );
  const mobileTopics = CATEGORY_TOPICS[mobileCategory];

  const desktopAction =
    desktopCategory === 'all'
      ? {
        href: requestHref,
        label: isId ? 'Buat Permintaan Sekarang' : 'Create Request Now',
      }
      : getPrimaryAction(desktopCategory, requestHref, isId);
  const mobileAction = getPrimaryAction(mobileCategory, requestHref, isId);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchValue.trim();
    router.push(
      trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search',
    );
  };

  const desktopBannerTitle =
    desktopCategory === 'all'
      ? isId
        ? 'Belum menemukan yang cocok?'
        : 'Still not seeing the right fit?'
      : pick(isId, resolvedDesktopConfig.heroTitle);
  const desktopBannerDescription =
    desktopCategory === 'all'
      ? isId
        ? 'Tulis kebutuhan. Supplier bisa masuk.'
        : 'Post a specific request and get offers from trusted business partners.'
      : pick(isId, resolvedDesktopConfig.heroDescription);
  const desktopBannerIllustration =
    desktopCategory === 'all'
      ? localHomeVisual('support')
      : resolvedDesktopConfig.illustration;

  return (
    <main className="lajukan-market-page lajukan-market-category page-shell max-lg:!px-1 overflow-x-hidden pb-5 pt-2 sm:pt-4 lg:pb-8">
      <div className="mx-auto w-full max-w-[1500px] px-2 sm:px-4 lg:px-6">
        <div className="lg:hidden">
          <section
            className="ui-layer-local-topbar fixed inset-x-0 top-0 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)] px-2 pb-1.5 shadow-[0_12px_26px_-24px_rgba(15,23,42,0.26)]  sm:px-3"
            style={{ paddingTop: 'max(env(safe-area-inset-top), 0.3rem)' }}
          >
            <div className="mx-auto flex max-w-[720px] items-center gap-2">
              <form
                onSubmit={handleSearchSubmit}
                className="ui-navbar-search-field flex-1"
              >
                <Search className="ui-navbar-search-icon" />
                <input
                  type="search"
                  value={searchValue}
                  onChange={event => setSearchValue(event.target.value)}
                  placeholder={
                    isId
                      ? 'Cari supplier, jasa, lokasi...'
                      : 'Search suppliers, locations, services, products, talent...'
                  }
                  className="ui-navbar-search-input"
                />
              </form>
              <Link
                href="/notifications"
                className="relative inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.24)]"
                aria-label={isId ? 'Buka notifikasi' : 'Open notifications'}
              >
                <Bell className="h-4.5 w-4.5" />
                {unreadCount > 0 ? (
                  <span className="absolute right-0.5 top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </Link>
            </div>
          </section>
          <div
            aria-hidden="true"
            className="h-[calc(3.55rem+env(safe-area-inset-top))]"
          />

          <div className="space-y-3">
            <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {CATEGORY_DEFINITIONS.map(item => {
                const Icon = item.icon;
                const tone = toneStyles(item.tone);
                const active = mobileCategory === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMobileCategory(item.id)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 rounded-[15px] border px-2.5 py-1.5 text-left text-xs font-semibold transition',
                      active ? tone.active : tone.idle,
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex h-7 w-7 items-center justify-center rounded-[10px]',
                        tone.icon,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span>{pick(isId, item.label)}</span>
                  </button>
                );
              })}
            </div>

            <article
              className={cn(
                'relative min-h-[148px] overflow-hidden rounded-[22px] border border-slate-200 bg-gradient-to-br p-4',
                mobileTone.hero,
                mobileTone.shadow,
              )}
            >
              <div className="max-w-[68%] space-y-2">
                <h2 className="text-[1.45rem] font-bold leading-[1.04] tracking-[-0.04em] text-slate-950">
                  {pick(isId, mobileCategoryConfig.heroTitle)}
                </h2>
                <p className="line-clamp-2 text-xs leading-5 text-slate-600">
                  {pick(isId, mobileCategoryConfig.heroDescription)}
                </p>
                <Link
                  href={canonicalizeDiscoveryHref(mobileAction.href)}
                  className="inline-flex min-h-[38px] items-center justify-center rounded-[14px] bg-emerald-600 px-4 text-xs font-semibold text-white shadow-[0_14px_26px_-20px_rgba(22,163,74,0.55)]"
                >
                  {mobileAction.label}
                </Link>
              </div>

              <div className="pointer-events-none absolute bottom-0 right-0 flex w-[38%] items-end justify-end">
                <Image
                  src={mobileCategoryConfig.illustration}
                  alt={pick(isId, mobileCategoryConfig.label)}
                  width={240}
                  height={200}
                  className="h-auto w-full max-w-[170px] object-contain"
                  priority={mobileCategory === 'supplier'}
                />
              </div>
            </article>

            <SectionHeader
              title={
                isId
                  ? `${pick(true, mobileCategoryConfig.label)} Populer`
                  : `Popular ${pick(false, mobileCategoryConfig.label)}`
              }
              actionHref={mobileCategoryConfig.browseHref}
              actionLabel={isId ? 'Lihat Semua' : 'View All'}
              mobile
            />

            {mobileShowcase.length > 0 ? (
              <div className="-mx-2 flex gap-2.5 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {mobileShowcase.map(item => (
                  <MobileShowcaseCard key={item.id} item={item} isId={isId} />
                ))}
              </div>
            ) : (
              <CategoryEmptyShowcase
                isId={isId}
                href={mobileCategoryConfig.browseHref}
              />
            )}

            <SectionHeader
              title={getTopicLabel(mobileCategory, isId)}
              actionHref={mobileCategoryConfig.browseHref}
              actionLabel={isId ? 'Lihat Semua' : 'View All'}
              mobile
            />

            <div className="grid grid-cols-3 gap-2">
              {mobileTopics.map(topic => (
                <Link
                  key={topic.id}
                  href={canonicalizeDiscoveryHref(topic.href)}
                  className="rounded-[16px] border border-slate-200 bg-white px-2 py-2.5 text-center shadow-[0_14px_26px_-24px_rgba(15,23,42,0.18)]"
                >
                  <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-slate-50 text-xl">
                    {topic.emoji}
                  </span>
                  <span className="mt-2 block truncate text-xs font-semibold text-slate-900">
                    {pick(isId, topic.label)}
                  </span>
                </Link>
              ))}
            </div>

            <SectionHeader
              title={isId ? 'Rekomendasi untukmu' : 'Recommendations for you'}
              actionHref={mobileCategoryConfig.browseHref}
              actionLabel={isId ? 'Lihat Semua' : 'View All'}
              mobile
            />

            {mobileShowcase.length > 0 ? (
              <div className="space-y-2">
                {mobileShowcase.slice(0, 3).map(item => (
                  <MobileRecommendationRow
                    key={`${item.id}-row`}
                    item={item}
                    isId={isId}
                  />
                ))}
              </div>
            ) : (
              <CategoryEmptyShowcase
                isId={isId}
                href={mobileCategoryConfig.browseHref}
                compact
              />
            )}
          </div>
        </div>

        <section className="hidden lg:block">
          <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
              <nav className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_24px_44px_-34px_rgba(15,23,42,0.2)]">
                <div className="space-y-2">
                  <SidebarCategoryButton
                    active={desktopCategory === 'all'}
                    label={pick(isId, ALL_CATEGORY_TILE_LABEL)}
                    icon={LayoutGrid}
                    tone="emerald"
                    onClick={() => setDesktopCategory('all')}
                  />
                  {CATEGORY_DEFINITIONS.map(item => (
                    <SidebarCategoryButton
                      key={item.id}
                      active={desktopCategory === item.id}
                      label={pick(isId, item.label)}
                      icon={item.icon}
                      tone={item.tone}
                      onClick={() => setDesktopCategory(item.id)}
                    />
                  ))}
                </div>
              </nav>

              <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_44px_-34px_rgba(15,23,42,0.2)]">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Headphones className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-lg font-bold tracking-[-0.04em] text-slate-950">
                  {isId ? 'Butuh bantuan?' : 'Need help?'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {isId
                    ? 'Tim kami siap membantu menemukan kategori dan partner bisnis yang paling cocok.'
                    : 'Our team can help you find the right category and business partner.'}
                </p>
                <Link
                  href="/support"
                  className="mt-5 inline-flex min-h-[46px] items-center justify-center rounded-[16px] bg-emerald-600 px-4 text-sm font-semibold text-white"
                >
                  {isId ? 'Chat dengan Kami' : 'Chat with Us'}
                </Link>
              </article>
            </aside>

            <div className="space-y-7">
              <nav className="flex items-center gap-2 text-sm text-slate-500">
                <Link href="/home" className="transition hover:text-slate-900">
                  {isId ? 'Beranda' : 'Home'}
                </Link>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-slate-700">
                  {isId ? 'Kategori' : 'Categories'}
                </span>
              </nav>

              <div className="flex flex-col gap-5 rounded-[36px] border border-slate-200 bg-white p-6 shadow-[0_24px_44px_-34px_rgba(15,23,42,0.2)] xl:p-7">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div className="max-w-3xl">
                    <h1 className="text-[3.2rem] font-bold leading-[0.92] tracking-[-0.08em] text-slate-950">
                      {isId ? 'Kategori' : 'Categories'}
                    </h1>
                    <p className="mt-3 text-base leading-7 text-slate-600">
                      {isId
                        ? 'Cari yang dibutuhkan. Lanjut chat.'
                        : 'Find the business categories you need to keep your operation moving.'}
                    </p>
                  </div>

                  <form
                    onSubmit={handleSearchSubmit}
                    className="flex w-full max-w-[560px] items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <Search className="h-5 w-5 text-slate-400" />
                    <input
                      type="search"
                      value={searchValue}
                      onChange={event => setSearchValue(event.target.value)}
                      placeholder={
                        isId
                          ? 'Cari supplier, jasa, lokasi...'
                          : 'Search suppliers, locations, services, products, talent...'
                      }
                      className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                    />
                    <button
                      type="submit"
                      className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-[16px] bg-emerald-600 px-4 text-sm font-semibold text-white"
                    >
                      {isId ? 'Cari' : 'Search'}
                    </button>
                  </form>
                </div>

                <div className="grid gap-4 xl:grid-cols-5">
                  {CATEGORY_DEFINITIONS.map(item => (
                    <DesktopCategoryCard
                      key={item.id}
                      category={item}
                      active={desktopCategory === item.id}
                      isId={isId}
                      onClick={() => setDesktopCategory(item.id)}
                    />
                  ))}
                </div>
              </div>

              <article
                className={cn(
                  'grid gap-6 overflow-hidden rounded-[36px] border border-slate-200 bg-gradient-to-r p-6 shadow-[0_24px_44px_-34px_rgba(15,23,42,0.2)] xl:grid-cols-[minmax(0,1fr)_260px_minmax(0,0.95fr)] xl:items-center xl:p-7',
                  desktopCategoryConfig
                    ? desktopTone.hero
                    : 'from-white via-emerald-50 to-teal-50',
                )}
              >
                <div>
                  <h2 className="text-[2.2rem] font-bold leading-[1] tracking-[-0.06em] text-slate-950">
                    {desktopBannerTitle}
                  </h2>
                  <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
                    {desktopBannerDescription}
                  </p>
                  <Link
                    href={canonicalizeDiscoveryHref(desktopAction.href)}
                    className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-[16px] bg-emerald-600 px-5 text-sm font-semibold text-white"
                  >
                    {desktopAction.label}
                  </Link>
                </div>

                <div className="mx-auto flex w-full max-w-[240px] justify-center">
                  <Image
                    src={desktopBannerIllustration}
                    alt={
                      desktopCategoryConfig
                        ? pick(isId, desktopCategoryConfig.label)
                        : 'Support illustration'
                    }
                    width={260}
                    height={220}
                    className="h-auto w-full object-contain"
                  />
                </div>

                <div className="grid gap-4">
                  {BENEFITS.map(item => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-4 rounded-[24px] border border-white/70 bg-white/80 px-4 py-4 "
                      >
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-950">
                            {pick(isId, item.title)}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {pick(isId, item.description)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>

              <div className="space-y-4">
                <SectionHeader
                  title={
                    desktopCategory === 'all'
                      ? isId
                        ? 'Kategori Populer'
                        : 'Popular Categories'
                      : getTopicLabel(desktopCategory, isId)
                  }
                  actionHref={
                    desktopCategory === 'all'
                      ? '/search'
                      : CATEGORY_BY_ID[desktopCategory].browseHref
                  }
                  actionLabel={isId ? 'Lihat Semua' : 'View All'}
                />

                <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
                  {desktopTopics.map(topic => (
                    <Link
                      key={topic.id}
                      href={canonicalizeDiscoveryHref(topic.href)}
                      className="rounded-[24px] border border-slate-200 bg-white px-4 py-5 text-center shadow-[0_20px_36px_-34px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_28px_50px_-36px_rgba(22,163,74,0.28)]"
                    >
                      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-[1.7rem]">
                        {topic.emoji}
                      </span>
                      <span className="mt-4 block text-sm font-semibold text-slate-900">
                        {pick(isId, topic.label)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <SectionHeader
                  title={
                    isId ? 'Rekomendasi Untukmu' : 'Recommendations For You'
                  }
                  actionHref={
                    desktopCategory === 'all'
                      ? '/search'
                      : CATEGORY_BY_ID[desktopCategory].browseHref
                  }
                  actionLabel={isId ? 'Lihat Semua' : 'View All'}
                />

                {desktopShowcase.length > 0 ? (
                  <div className="grid gap-5 xl:grid-cols-5">
                    {desktopShowcase.map(item => (
                      <DesktopShowcaseCard
                        key={item.id}
                        item={item}
                        isId={isId}
                      />
                    ))}
                  </div>
                ) : (
                  <CategoryEmptyShowcase
                    isId={isId}
                    href={
                      desktopCategory === 'all'
                        ? '/search'
                        : CATEGORY_BY_ID[desktopCategory].browseHref
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeader({
  title,
  actionHref,
  actionLabel,
  mobile = false,
}: {
  title: string;
  actionHref: string;
  actionLabel: string;
  mobile?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2
        className={cn(
          'font-bold tracking-[-0.04em] text-slate-950',
          mobile ? 'text-[1.2rem]' : 'text-[2rem]',
        )}
      >
        {title}
      </h2>
      <Link
        href={canonicalizeDiscoveryHref(actionHref)}
        className={cn(
          'shrink-0 font-semibold text-emerald-600 transition hover:text-emerald-700',
          mobile ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs' : 'text-sm',
        )}
      >
        {actionLabel}
      </Link>
    </div>
  );
}

function CategoryEmptyShowcase({
  isId,
  href,
  compact = false,
}: {
  isId: boolean;
  href: string;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        'rounded-[24px] border border-dashed border-slate-200 bg-white px-4 text-center shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)]',
        compact ? 'py-4' : 'py-6',
      )}
    >
      <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-[15px] bg-emerald-50 text-emerald-600">
        <Search className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-bold text-slate-950">
        {isId ? 'Belum ada listing aktif' : 'No active listings yet'}
      </p>
      <p className="mx-auto mt-1 max-w-md text-xs font-semibold leading-5 text-slate-500">
        {isId
          ? 'Kami tidak menampilkan contoh palsu. Cari data real atau buat permintaan baru.'
          : 'We do not show fake examples. Search live data or create a request.'}
      </p>
      <Link
        href={canonicalizeDiscoveryHref(href)}
        className="mt-4 inline-flex min-h-10 items-center justify-center rounded-[14px] bg-emerald-600 px-4 text-xs font-bold text-white"
      >
        {isId ? 'Cari data real' : 'Search real data'}
      </Link>
    </section>
  );
}

function SidebarCategoryButton({
  active,
  label,
  icon: Icon,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
  tone: Tone;
  onClick: () => void;
}) {
  const palette = toneStyles(tone);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left text-sm font-semibold transition',
        active ? palette.active : palette.idle,
      )}
    >
      <span
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-2xl',
          palette.icon,
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span>{label}</span>
    </button>
  );
}

function DesktopCategoryCard({
  category,
  active,
  isId,
  onClick,
}: {
  category: CategoryDefinition;
  active: boolean;
  isId: boolean;
  onClick: () => void;
}) {
  const palette = toneStyles(category.tone);
  const Icon = category.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-[28px] border bg-white p-5 text-left shadow-[0_20px_36px_-34px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_46px_-36px_rgba(15,23,42,0.22)]',
        active ? palette.active : 'border-slate-200',
      )}
    >
      <span
        className={cn(
          'inline-flex h-12 w-12 items-center justify-center rounded-2xl',
          palette.icon,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-[1.35rem] font-bold tracking-[-0.04em] text-slate-950">
        {pick(isId, category.label)}
      </h3>
      <p className="mt-2 max-w-[15rem] text-sm leading-6 text-slate-600">
        {pick(isId, category.summary)}
      </p>
      <span
        className={cn(
          'mt-5 inline-flex items-center gap-2 text-sm font-semibold',
          palette.accentText,
        )}
      >
        {isId ? 'Jelajahi' : 'Explore'}
        <ArrowRight className="h-4 w-4" />
      </span>

      <div className="pointer-events-none absolute bottom-3 right-3 w-[42%] max-w-[120px]">
        <Image
          src={category.illustration}
          alt={pick(isId, category.label)}
          width={140}
          height={120}
          className="h-auto w-full object-contain"
        />
      </div>
    </button>
  );
}

function DesktopShowcaseCard({
  item,
  isId,
}: {
  item: ShowcaseItem;
  isId: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_36px_-34px_rgba(15,23,42,0.22)]">
      <div className="relative aspect-[1.08/0.78] overflow-hidden">
        <Image
          src={item.image}
          alt={item.title}
          fill
          className="object-cover transition duration-500 group-hover:scale-[1.02]"
          sizes="(min-width: 1280px) 18vw, 40vw"
        />
        {item.verified ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-emerald-700 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified
          </span>
        ) : null}
        <span className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-slate-600 shadow-sm">
          <Bookmark className="h-4.5 w-4.5" />
        </span>
      </div>
      <div className="space-y-3 p-4">
        <h3 className="text-[1.15rem] font-bold leading-[1.2] tracking-[-0.04em] text-slate-950">
          {item.title}
        </h3>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <MapPin className="h-4 w-4" />
          <span>{item.location}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="font-semibold text-slate-700">{item.rating}</span>
          <span>
            {isId ? `(${item.reviews} ulasan)` : `(${item.reviews} reviews)`}
          </span>
        </div>
        <p className="min-h-[66px] text-sm leading-6 text-slate-600">
          {pick(isId, item.description)}
        </p>
        <p className="text-sm text-slate-500">
          {isId ? 'Mulai dari ' : 'Starting at '}
          <span className="text-[1.1rem] font-bold tracking-[-0.03em] text-emerald-600">
            {item.price}
          </span>
          <span className="text-slate-500">{item.unit}</span>
        </p>
        <Link
          href={canonicalizeDiscoveryHref(item.href)}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[16px] border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          {isId ? 'Lihat Detail' : 'View Details'}
        </Link>
      </div>
    </article>
  );
}

function MobileShowcaseCard({
  item,
  isId,
}: {
  item: ShowcaseItem;
  isId: boolean;
}) {
  return (
    <article className="w-[calc(50vw-0.875rem)] min-w-[166px] max-w-[214px] shrink-0 overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_16px_28px_-26px_rgba(15,23,42,0.22)]">
      <div className="relative aspect-[1.08/0.82] overflow-hidden">
        <Image
          src={item.image}
          alt={item.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, 214px"
        />
        {item.verified ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/92 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700 shadow-sm">
            <ShieldCheck className="h-3 w-3" />
            Verified
          </span>
        ) : null}
        <span className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/92 text-slate-600 shadow-sm">
          <Bookmark className="h-4 w-4" />
        </span>
      </div>
      <div className="space-y-1.5 p-2.5">
        <h3 className="line-clamp-2 text-sm font-bold leading-[1.2] tracking-[-0.03em] text-slate-950">
          {item.title}
        </h3>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{item.location}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <span className="font-semibold text-slate-700">{item.rating}</span>
          <span className="truncate">
            {isId ? `(${item.reviews} ulasan)` : `(${item.reviews} reviews)`}
          </span>
        </div>
        <p className="truncate text-[11px] text-slate-500">
          {isId ? 'Mulai dari ' : 'Starting at '}
          <span className="text-sm font-bold tracking-[-0.02em] text-emerald-600">
            {item.price}
          </span>
          <span>{item.unit}</span>
        </p>
      </div>
    </article>
  );
}

function MobileRecommendationRow({
  item,
  isId,
}: {
  item: ShowcaseItem;
  isId: boolean;
}) {
  return (
    <article className="flex gap-2.5 rounded-[18px] border border-slate-200 bg-white p-2 shadow-[0_16px_28px_-26px_rgba(15,23,42,0.2)]">
      <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[15px]">
        <Image
          src={item.image}
          alt={item.title}
          fill
          className="object-cover"
          sizes="92px"
        />
        {item.verified ? (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-white/92 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 shadow-sm">
            <ShieldCheck className="h-3 w-3" />
            Verified
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold tracking-[-0.03em] text-slate-950">
            {item.title}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.location}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-slate-700">{item.rating}</span>
            <span className="truncate">
              {isId ? `(${item.reviews} ulasan)` : `(${item.reviews} reviews)`}
            </span>
          </div>
          <p className="mt-1 line-clamp-1 text-[11px] leading-4 text-slate-600">
            {pick(isId, item.description)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500">
            {isId ? 'Mulai dari ' : 'Starting at '}
            <span className="text-sm font-bold tracking-[-0.02em] text-emerald-600">
              {item.price}
            </span>
            <span>{item.unit}</span>
          </p>
        </div>
        <Link
          href={canonicalizeDiscoveryHref(item.href)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600"
          aria-label={isId ? 'Simpan rekomendasi' : 'Save recommendation'}
        >
          <Bookmark className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
