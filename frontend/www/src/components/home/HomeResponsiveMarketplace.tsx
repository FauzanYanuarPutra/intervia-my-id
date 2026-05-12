'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clapperboard,
  CreditCard,
  Gift,
  Globe2,
  Heart,
  Home,
  ImageIcon,
  LayoutGrid,
  LockKeyhole,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Package,
  PlayCircle,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  SmilePlus,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import LajuloLogo from '@/components/logo/LajuloLogo';
import { useAuth } from '@/context/AuthContext';
import { useChatInbox } from '@/context/ChatInboxContext';
import { useNotificationInbox } from '@/context/NotificationInboxContext';
import { Link, useRouter } from '@/i18n/navigation';
import {
  formatLajukanCountLabel,
  type LajukanSummary,
} from '@/lib/lajukan-marketplace';
import { localAvatarForSeed } from '@/lib/media/localSeedMedia';
import { UMKM_DISCOVERY_PATH } from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';

type HomeContentSimpleProps = {
  locale: string;
};

type Tone = 'emerald' | 'blue' | 'violet' | 'amber' | 'rose';

type SidebarItem = {
  id: string;
  label: string;
  caption: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
  locked?: boolean;
};

type QuickCategory = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: Tone;
  countLabel: string;
};

type RecommendationItem = {
  id: string;
  title: string;
  vendor: string;
  location: string;
  rating: string;
  reviews: string;
  price: string;
  unit: string;
  image: string;
  href: string;
  badge?: string;
  badgeTone?: Tone;
};

type CommunityTab = 'for-you' | 'following' | 'community' | 'reels';

type CommunityPost = {
  id: string;
  tab: CommunityTab;
  community: string;
  author: string;
  time: string;
  body: string;
  image: string;
  avatar: string;
  likes: string;
  comments: string;
  shares: string;
};

type ReelItem = {
  id: string;
  category: string;
  title: string;
  views: string;
  image: string;
  href: string;
};

type HeroMetric = {
  id: string;
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone: Tone;
};

type LajukanSummaryResponse = {
  data?: LajukanSummary;
  error?: string;
};

const HERO_TAGS = ['Ayam Geprek', 'Kemasan', 'Desain Logo', 'Sewa Dapur'];

const RECOMMENDATION_ITEMS: RecommendationItem[] = [
  {
    id: 'fresh-chicken',
    title: 'Daging Ayam Segar',
    vendor: 'Ayam Berkah Sentosa',
    location: 'Jakarta Barat',
    rating: '4.8',
    reviews: '120',
    price: 'Rp 28.000',
    unit: '/kg',
    image: 'https://picsum.photos/seed/lajukan-fresh-chicken/900/700',
    href: '/search?q=daging%20ayam%20segar',
    badge: 'Terpercaya',
    badgeTone: 'emerald',
  },
  {
    id: 'coffee-beans',
    title: 'Kopi Arabica Premium',
    vendor: 'Kopi Nusantara',
    location: 'Bandung',
    rating: '4.9',
    reviews: '89',
    price: 'Rp 150.000',
    unit: '/250gr',
    image: 'https://picsum.photos/seed/lajukan-coffee-beans/900/700',
    href: '/search?q=kopi%20arabica%20premium',
  },
  {
    id: 'packaging-box',
    title: 'Kemasan Box Custom',
    vendor: 'Packindo',
    location: 'Tangerang',
    rating: '4.7',
    reviews: '56',
    price: 'Rp 2.500',
    unit: '/pcs',
    image: 'https://picsum.photos/seed/lajukan-packaging/900/700',
    href: '/search?q=kemasan%20box%20custom',
    badge: 'Promo',
    badgeTone: 'rose',
  },
  {
    id: 'certified-kitchen',
    title: 'Sewa Dapur Bersertifikat',
    vendor: 'DapurKita',
    location: 'Jakarta Selatan',
    rating: '4.8',
    reviews: '78',
    price: 'Rp 250.000',
    unit: '/hari',
    image: 'https://picsum.photos/seed/lajukan-certified-kitchen/900/700',
    href: '/search?q=sewa%20dapur%20bersertifikat',
  },
  {
    id: 'brand-logo',
    title: 'Desain Logo Brand',
    vendor: 'Studio Kreatif',
    location: 'Online',
    rating: '4.9',
    reviews: '64',
    price: 'Rp 250.000',
    unit: '',
    image: 'https://picsum.photos/seed/lajukan-brand-logo/900/700',
    href: '/search?q=desain%20logo%20brand',
  },
];

const COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: 'community-1',
    tab: 'for-you',
    community: 'Komunitas UMKM Indonesia',
    author: 'Aldo Mahendra',
    time: '2 jam yang lalu',
    body: 'Tips packaging yang menarik bisa tingkatkan nilai jual produk. Yuk diskusi di sini.',
    image: 'https://picsum.photos/seed/lajukan-community-packaging/1200/900',
    avatar: localAvatarForSeed('community-1'),
    likes: '128',
    comments: '24',
    shares: 'Bagikan',
  },
  {
    id: 'community-2',
    tab: 'following',
    community: 'Supplier Circle',
    author: 'Rani Putri',
    time: '4 jam yang lalu',
    body: 'Ada supplier kemasan baru yang responsif dan MOQ-nya kecil. Cocok untuk trial produk musiman.',
    image: 'https://picsum.photos/seed/lajukan-community-suppliers/1200/900',
    avatar: localAvatarForSeed('community-2'),
    likes: '94',
    comments: '17',
    shares: 'Bagikan',
  },
  {
    id: 'community-3',
    tab: 'community',
    community: 'Forum Operasional Bisnis',
    author: 'Nadia Rizki',
    time: '6 jam yang lalu',
    body: 'Template SOP gudang kecil ternyata lumayan bantu rapihin stok harian. Kalau mau, saya share versi sederhananya.',
    image: 'https://picsum.photos/seed/lajukan-community-operations/1200/900',
    avatar: localAvatarForSeed('community-3'),
    likes: '76',
    comments: '13',
    shares: 'Bagikan',
  },
  {
    id: 'community-4',
    tab: 'reels',
    community: 'Reels Bisnis',
    author: 'Dimas Wicaksono',
    time: '8 jam yang lalu',
    body: 'Konten reels supplier paling efektif ternyata yang langsung kasih konteks harga, MOQ, dan lead time di 3 detik pertama.',
    image: 'https://picsum.photos/seed/lajukan-community-reels/1200/900',
    avatar: localAvatarForSeed('community-4'),
    likes: '88',
    comments: '29',
    shares: 'Bagikan',
  },
];

const REELS_ITEMS: ReelItem[] = [
  {
    id: 'reel-1',
    category: 'Tips',
    title: 'Cara Cari Supplier Terbaik untuk Usahamu',
    views: '9.8K',
    image: 'https://picsum.photos/seed/lajukan-reel-supplier/900/1400',
    href: '/reels',
  },
  {
    id: 'reel-2',
    category: 'Pemasaran',
    title: 'Ide Konten Promosi Bikin Penjualan Meningkat',
    views: '8.1K',
    image: 'https://picsum.photos/seed/lajukan-reel-promo/900/1400',
    href: '/reels',
  },
  {
    id: 'reel-3',
    category: 'Keuangan',
    title: 'Kelola Keuangan Usaha Kecil Lebih Mudah',
    views: '6.2K',
    image: 'https://picsum.photos/seed/lajukan-reel-finance/900/1400',
    href: '/reels',
  },
];

const COMPOSER_ACTIONS = [
  { id: 'photo', label: 'Foto/Video', icon: ImageIcon, tone: 'emerald' as Tone },
  { id: 'reels', label: 'Reels', icon: Clapperboard, tone: 'rose' as Tone },
  { id: 'polling', label: 'Polling', icon: BarChart3, tone: 'amber' as Tone },
  { id: 'feeling', label: 'Perasaan', icon: SmilePlus, tone: 'blue' as Tone },
];

function toneClassNames(tone: Tone) {
  if (tone === 'blue') {
    return {
      icon: 'bg-sky-100 text-sky-600',
      soft: 'bg-sky-50 text-sky-700',
      surface: 'border-sky-100 bg-sky-50/70',
    };
  }
  if (tone === 'violet') {
    return {
      icon: 'bg-violet-100 text-violet-600',
      soft: 'bg-violet-50 text-violet-700',
      surface: 'border-violet-100 bg-violet-50/70',
    };
  }
  if (tone === 'amber') {
    return {
      icon: 'bg-amber-100 text-amber-600',
      soft: 'bg-amber-50 text-amber-700',
      surface: 'border-amber-100 bg-amber-50/70',
    };
  }
  if (tone === 'rose') {
    return {
      icon: 'bg-rose-100 text-rose-600',
      soft: 'bg-rose-50 text-rose-700',
      surface: 'border-rose-100 bg-rose-50/70',
    };
  }
  return {
    icon: 'bg-emerald-100 text-emerald-700',
    soft: 'bg-emerald-50 text-emerald-700',
    surface: 'border-emerald-100 bg-emerald-50/70',
  };
}

function normalizePathname(pathname: string): string {
  const withoutLocale = pathname.replace(/^\/(id|en)(?=\/|$)/, '');
  return withoutLocale === '' ? '/' : withoutLocale;
}

function resolveCountLabel(
  value: number | null | undefined,
  fallback: string,
): string {
  return typeof value === 'number' ? formatLajukanCountLabel(value) : fallback;
}

function formatCompactCount(
  value: number | null | undefined,
  fallback: string,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}K`;
  return value.toString();
}

function getQuickCategories(
  isId: boolean,
  isAuthenticated: boolean,
  summary: LajukanSummary | null,
): QuickCategory[] {
  return [
    {
      id: 'supplier',
      label: isId ? 'Supplier' : 'Suppliers',
      description: isId ? 'Temukan supplier terpercaya' : 'Trusted suppliers',
      href: '/search?type=product&q=supplier',
      icon: ShoppingBag,
      tone: 'emerald',
      countLabel: resolveCountLabel(summary?.categories.supplier, '12.000+'),
    },
    {
      id: 'product',
      label: isId ? 'Produk' : 'Products',
      description: isId ? 'Temukan produk terbaik' : 'Best products',
      href: '/search?q=produk%20reseller',
      icon: Package,
      tone: 'blue',
      countLabel: resolveCountLabel(summary?.categories.product, '8.500+'),
    },
    {
      id: 'service',
      label: isId ? 'Jasa' : 'Services',
      description: isId ? 'Berbagai jasa untuk bisnismu' : 'Business services',
      href: '/search?type=service&q=jasa%20usaha',
      icon: BriefcaseBusiness,
      tone: 'violet',
      countLabel: resolveCountLabel(summary?.categories.service, '3.700+'),
    },
    {
      id: 'location',
      label: isId ? 'Lokasi' : 'Places',
      description: isId ? 'Temukan lokasi strategis' : 'Strategic places',
      href: '/search?type=property&q=lokasi%20usaha',
      icon: MapPin,
      tone: 'amber',
      countLabel: resolveCountLabel(summary?.categories.location, '5.200+'),
    },
    {
      id: 'talent',
      label: 'Talent',
      description: isId ? 'Temukan talent berkualitas' : 'Qualified talent',
      href: '/search?type=freelancer&q=talent',
      icon: UserRound,
      tone: 'blue',
      countLabel: resolveCountLabel(summary?.categories.talent, '2.100+'),
    },
    {
      id: 'request',
      label: isId ? 'Peluang Usaha' : 'Opportunities',
      description: isId ? 'Temukan peluang menjanjikan' : 'Promising opportunities',
      href: isAuthenticated ? '/my-projects' : '/register',
      icon: Plus,
      tone: 'emerald',
      countLabel: resolveCountLabel(summary?.requests.total, '1.200+'),
    },
  ];
}

function getHeroMetrics(isId: boolean, summary: LajukanSummary | null): HeroMetric[] {
  return [
    {
      id: 'verified',
      label: isId ? 'Supplier Terverifikasi' : 'Verified suppliers',
      value: `+${formatCompactCount(summary?.stores.verified, '2.5K')}`,
      note: isId ? 'Partner siap diajak kerja' : 'Partners ready to work',
      icon: ShieldCheck,
      tone: 'emerald',
    },
    {
      id: 'demand',
      label: isId ? 'Permintaan Meningkat' : 'Rising demand',
      value: '+28%',
      note: isId ? 'Minat naik minggu ini' : 'Demand is up this week',
      icon: TrendingUp,
      tone: 'amber',
    },
    {
      id: 'community',
      label: isId ? 'Komunitas Aktif' : 'Active community',
      value: `+${formatCompactCount(summary?.requests.active, '8K')}`,
      note: isId ? 'Diskusi dan peluang baru' : 'Discussions and new leads',
      icon: UserRound,
      tone: 'blue',
    },
  ];
}

function getCommunityTabs(isId: boolean) {
  return [
    { id: 'for-you' as CommunityTab, label: isId ? 'Untukmu' : 'For you' },
    { id: 'following' as CommunityTab, label: isId ? 'Mengikuti' : 'Following' },
    { id: 'community' as CommunityTab, label: isId ? 'Komunitas' : 'Community' },
    { id: 'reels' as CommunityTab, label: 'Reels' },
  ];
}

function SearchBar({
  query,
  onQueryChange,
  onSubmit,
  placeholder,
  buttonLabel,
  compact = false,
  className,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  placeholder: string;
  buttonLabel: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'flex items-center gap-2 rounded-[22px] border border-[color:var(--app-border)] bg-white p-2 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)]',
        compact ? 'min-h-[58px]' : 'min-h-[62px]',
        className,
      )}
    >
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-50 text-[color:var(--app-text-soft)]">
        <Search className="h-5 w-5" />
      </span>
      <input
        value={query}
        onChange={event => onQueryChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
      />
      <button
        type="submit"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)] shadow-[0_18px_30px_-18px_rgba(22,163,74,0.56)]',
          compact ? 'min-h-[44px] min-w-[96px]' : 'min-h-[46px] min-w-[108px]',
        )}
      >
        {buttonLabel}
      </button>
    </form>
  );
}

function SectionHeading({
  title,
  actionLabel,
  actionHref,
}: {
  title: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[1.18rem] font-black tracking-[-0.04em] text-[color:var(--app-text)] sm:text-[1.3rem]">
        {title}
      </h2>
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="text-sm font-semibold text-[color:var(--app-accent)]">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function MobileTopBar({
  notificationsHref,
  chatHref,
  totalUnread,
  unreadCount,
}: {
  notificationsHref: string;
  chatHref: string;
  totalUnread: number;
  unreadCount: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 lg:hidden">
      <Link
        href={UMKM_DISCOVERY_PATH}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] shadow-[0_16px_28px_-24px_rgba(15,23,42,0.18)]"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Link>
      <Link href="/home" className="inline-flex items-center justify-center">
        <span className="inline-flex max-w-[170px]">
          <LajuloLogo />
        </span>
      </Link>
      <div className="flex items-center gap-2">
        <Link
          href={chatHref}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] shadow-[0_16px_28px_-24px_rgba(15,23,42,0.18)]"
          aria-label="Chat"
        >
          <MessageCircle className="h-4.5 w-4.5" />
          {totalUnread > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          ) : null}
        </Link>
        <Link
          href={notificationsHref}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] shadow-[0_16px_28px_-24px_rgba(15,23,42,0.18)]"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Link>
      </div>
    </div>
  );
}

function DesktopTopBar({
  query,
  onQueryChange,
  onSubmit,
  placeholder,
  buttonLabel,
  helpLabel,
  helpHref,
  chatHref,
  notificationHref,
  accountHref,
  displayName,
  avatarSrc,
  isAuthenticated,
  loginLabel,
  registerLabel,
  totalUnread,
  unreadCount,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  placeholder: string;
  buttonLabel: string;
  helpLabel: string;
  helpHref: string;
  chatHref: string;
  notificationHref: string;
  accountHref: string;
  displayName: string;
  avatarSrc: string;
  isAuthenticated: boolean;
  loginLabel: string;
  registerLabel: string;
  totalUnread: number;
  unreadCount: number;
}) {
  return (
    <header className="hidden lg:block">
      <div className="rounded-[30px] border border-[color:var(--app-border)] bg-white/90 px-5 py-4 shadow-[0_20px_45px_-34px_rgba(15,23,42,0.16)] backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Link href="/home" className="inline-flex shrink-0 items-center">
            <span className="inline-flex max-w-[180px]">
              <LajuloLogo />
            </span>
          </Link>
          <div className="min-w-0 flex-1">
            <SearchBar
              query={query}
              onQueryChange={onQueryChange}
              onSubmit={onSubmit}
              placeholder={placeholder}
              buttonLabel={buttonLabel}
              compact
            />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Link
              href={helpHref}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-2 text-sm font-semibold text-[color:var(--app-text)]"
            >
              <CircleHelp className="h-4 w-4 text-[color:var(--app-text-soft)]" />
              {helpLabel}
            </Link>
            {isAuthenticated ? (
              <>
                <Link
                  href={chatHref}
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)]"
                  aria-label="Chat"
                >
                  <MessageCircle className="h-4.5 w-4.5" />
                  {totalUnread > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                  ) : null}
                </Link>
                <Link
                  href={notificationHref}
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)]"
                  aria-label="Notifications"
                >
                  <Bell className="h-4.5 w-4.5" />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null}
                </Link>
                <Link
                  href={accountHref}
                  className="inline-flex min-h-[46px] items-center gap-3 rounded-full border border-[color:var(--app-border)] bg-white px-2.5 pr-4"
                >
                  <Image
                    src={avatarSrc}
                    alt={displayName}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <span className="max-w-[132px] truncate text-sm font-semibold text-[color:var(--app-text)]">
                    {displayName}
                  </span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={accountHref}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-[color:var(--app-border)] bg-white px-5 text-sm font-semibold text-[color:var(--app-text)]"
                >
                  {loginLabel}
                </Link>
                <Link
                  href="/register"
                  className="inline-flex min-h-[44px] items-center rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-5 text-sm font-semibold text-[color:var(--app-text-inverse)]"
                >
                  {registerLabel}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function DesktopSidebar({
  pathname,
  items,
  inviteTitle,
  inviteDescription,
  inviteButton,
  inviteHref,
}: {
  pathname: string;
  items: { primary: SidebarItem[]; secondary: SidebarItem[] };
  inviteTitle: string;
  inviteDescription: string;
  inviteButton: string;
  inviteHref: string;
}) {
  const currentPath = normalizePathname(pathname);

  return (
    <aside className="hidden lg:block lg:min-h-0">
      <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1 overscroll-contain">
        <nav className="rounded-[30px] border border-[color:var(--app-border)] bg-white/90 p-3 shadow-[0_20px_45px_-34px_rgba(15,23,42,0.16)]">
          <div className="space-y-1.5">
            {items.primary.map(item => {
              const Icon = item.icon;
              const itemPath = item.href.split('?')[0];
              const active =
                itemPath === '/home'
                  ? currentPath === '/home' || currentPath === '/'
                  : currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[56px] items-start gap-3 rounded-[18px] px-3 py-3 transition',
                    active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]',
                      active ? 'bg-white text-emerald-600' : 'bg-slate-50 text-[color:var(--app-text-soft)]',
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {item.label}
                      {item.locked ? <LockKeyhole className="h-3.5 w-3.5 text-slate-400" /> : null}
                      {item.badge ? (
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                      {item.caption}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="my-3 h-px bg-[color:var(--app-border)]" />
          <div className="space-y-1.5">
            {items.secondary.map(item => {
              const Icon = item.icon;
              const itemPath = item.href.split('?')[0];
              const active =
                currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[54px] items-start gap-3 rounded-[18px] px-3 py-3 transition',
                    active
                      ? 'bg-slate-50 text-[color:var(--app-text)]'
                      : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]',
                  )}
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-slate-50 text-[color:var(--app-text-soft)]">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {item.label}
                      {item.locked ? <LockKeyhole className="h-3.5 w-3.5 text-slate-400" /> : null}
                      {item.badge ? (
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                      {item.caption}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="overflow-hidden rounded-[30px] border border-emerald-100 bg-[linear-gradient(180deg,#f4fff8_0%,#ffffff_62%,#eefbf4_100%)] p-5 shadow-[0_20px_45px_-34px_rgba(22,163,74,0.28)]">
          <h3 className="text-[1.02rem] font-black tracking-[-0.03em] text-[color:var(--app-text)]">
            {inviteTitle}
          </h3>
          <p className="mt-3 text-sm leading-6 text-[color:var(--app-text-soft)]">
            {inviteDescription}
          </p>
          <Link
            href={inviteHref}
            className="mt-5 inline-flex min-h-[46px] w-full items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)]"
          >
            {inviteButton}
          </Link>
        </div>
      </div>
    </aside>
  );
}

function MobileBottomNav({
  locale,
  pathname,
  isAuthenticated,
}: {
  locale: 'id' | 'en';
  pathname: string;
  isAuthenticated: boolean;
}) {
  const currentPath = normalizePathname(pathname);
  const items = [
    {
      key: 'home',
      label: locale === 'id' ? 'Beranda' : 'Home',
      href: '/home',
      icon: Home,
      active: currentPath === '/home' || currentPath === '/',
    },
    {
      key: 'explore',
      label: locale === 'id' ? 'Jelajah' : 'Explore',
      href: UMKM_DISCOVERY_PATH,
      icon: LayoutGrid,
      active:
        currentPath.startsWith('/umkm') ||
        currentPath.startsWith('/search') ||
        currentPath.startsWith('/marketplace'),
    },
    {
      key: 'create',
      label: locale === 'id' ? 'Buat' : 'Create',
      href: isAuthenticated ? '/create' : '/register',
      icon: Plus,
      active: currentPath.startsWith('/create') || currentPath.startsWith('/register'),
    },
    {
      key: 'transactions',
      label: locale === 'id' ? 'Transaksi' : 'Transactions',
      href: isAuthenticated ? '/transactions' : '/login',
      icon: ClipboardList,
      active:
        currentPath.startsWith('/transactions') ||
        currentPath.startsWith('/my-projects'),
    },
    {
      key: 'account',
      label: locale === 'id' ? 'Akun' : 'Account',
      href: isAuthenticated ? '/profile' : '/login',
      icon: UserRound,
      active:
        currentPath.startsWith('/profile') ||
        currentPath.startsWith('/settings') ||
        currentPath.startsWith('/login'),
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-3 lg:hidden"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      aria-label="Mobile primary navigation"
    >
      <div className="mx-auto max-w-md rounded-[30px] border border-[color:color-mix(in_srgb,var(--app-border)_84%,white_8%)] bg-white/96 px-2 pb-2 pt-1.5 shadow-[0_30px_52px_-28px_rgba(15,23,42,0.3)] backdrop-blur-xl">
        <ul className="grid grid-cols-5 items-end gap-1">
          {items.map(item => {
            const Icon = item.icon;
            const isCreate = item.key === 'create';

            return (
              <li key={item.key} className={cn('min-w-0', isCreate && 'relative -mt-3')}>
                <Link
                  href={item.href}
                  aria-current={item.active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-[22px] px-1 text-[10px] font-semibold transition',
                    item.active ? 'text-[color:var(--app-accent)]' : 'text-[color:var(--app-text-soft)]',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center justify-center transition',
                      isCreate
                        ? 'h-14 w-14 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] text-white shadow-[0_18px_30px_-18px_rgba(22,163,74,0.6)]'
                        : item.active
                          ? 'h-10 w-10 rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                          : 'h-10 w-10 rounded-full bg-slate-50 text-[color:var(--app-text-soft)]',
                    )}
                  >
                    <Icon className={cn(isCreate ? 'h-5 w-5' : 'h-4 w-4')} />
                  </span>
                  <span className={cn(isCreate && 'sr-only')}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

function HeroMetricCard({ item }: { item: HeroMetric }) {
  const Icon = item.icon;
  const tone = toneClassNames(item.tone);

  return (
    <div className="rounded-[22px] border border-[color:var(--app-border)] bg-white/95 p-4 shadow-[0_18px_32px_-28px_rgba(15,23,42,0.14)]">
      <div className="flex items-center gap-3">
        <span className={cn('inline-flex h-11 w-11 items-center justify-center rounded-[15px]', tone.icon)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[color:var(--app-text)]">{item.label}</p>
          <p className="mt-1 text-[1.05rem] font-black tracking-[-0.04em] text-[color:var(--app-text)]">{item.value}</p>
          <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">{item.note}</p>
        </div>
      </div>
    </div>
  );
}

function DesktopHeroSection({
  isId,
  summary,
  query,
  onQueryChange,
  onSubmit,
  placeholder,
  buttonLabel,
  primaryCtaHref,
}: {
  isId: boolean;
  summary: LajukanSummary | null;
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  placeholder: string;
  buttonLabel: string;
  primaryCtaHref: string;
}) {
  const metrics = getHeroMetrics(isId, summary);

  return (
    <section className="overflow-hidden rounded-[34px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_8%)] bg-[linear-gradient(145deg,#ffffff_0%,#f8fcff_48%,#eefbf2_100%)] p-6 shadow-[0_24px_55px_-38px_rgba(15,23,42,0.2)] xl:p-7">
      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="relative z-10">
          <h1 className="max-w-[14ch] text-[2.35rem] font-semibold leading-[1.04] tracking-[-0.06em] text-[color:var(--app-text)]">
            {isId ? 'Semua kebutuhan usahamu, ada di ' : 'Everything your business needs is on '}
            <span className="text-[color:var(--app-accent)]">Lajukan</span>
          </h1>
          <p className="mt-4 max-w-[37rem] text-[15px] leading-8 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Cari supplier, produk, jasa, lokasi, talent, dan peluang usaha terbaik. Nego langsung, transaksi aman, bisnis makin berkembang.'
              : 'Find suppliers, products, services, places, talent, and business opportunities in one flow.'}
          </p>
          <div className="mt-5 max-w-[38rem]">
            <SearchBar
              query={query}
              onQueryChange={onQueryChange}
              onSubmit={onSubmit}
              placeholder={placeholder}
              buttonLabel={buttonLabel}
            />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href={primaryCtaHref}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-5 text-sm font-semibold text-[color:var(--app-text-inverse)]"
            >
              {isId ? 'Daftar Gratis' : 'Join Free'}
            </Link>
            <Link
              href={UMKM_DISCOVERY_PATH}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[18px] border border-[color:var(--app-border)] bg-white px-5 text-sm font-semibold text-[color:var(--app-text)]"
            >
              {isId ? 'Jelajahi Platform' : 'Explore Platform'}
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[color:var(--app-text-soft)]">
              {isId ? 'Populer:' : 'Popular:'}
            </span>
            {HERO_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => onQueryChange(tag)}
                className="inline-flex items-center rounded-full border border-[color:var(--app-border)] bg-white px-3 py-1.5 text-[11px] font-medium text-[color:var(--app-text-soft)]"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="relative min-h-[360px] overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_top,#dcfce7,transparent_64%)]">
            <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04))]" />
            <Image src="/images/umkm/human.png" alt="Lajukan hero" fill priority className="object-contain object-bottom" />
          </div>
          <div className="grid content-start gap-4">
            {metrics.slice(0, 2).map(item => (
              <HeroMetricCard key={item.id} item={item} />
            ))}
            <Link
              href="/reels"
              className="group overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-slate-950 text-white shadow-[0_18px_32px_-24px_rgba(15,23,42,0.28)]"
            >
              <div className="relative h-32">
                <Image
                  src="https://picsum.photos/seed/lajukan-hero-tip/900/520"
                  alt="Tips nego dengan supplier"
                  fill
                  className="object-cover opacity-80 transition duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                <span className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-[color:var(--app-accent)]">
                  <PlayCircle className="h-6 w-6" />
                </span>
                <div className="absolute inset-x-4 bottom-4">
                  <p className="text-sm font-semibold">
                    {isId ? 'Tips Nego dengan Supplier' : 'Negotiation Tips with Suppliers'}
                  </p>
                  <p className="mt-1 text-xs text-white/80">
                    {isId ? 'Lihat video singkat' : 'Watch a short video'}
                  </p>
                </div>
              </div>
            </Link>
            <HeroMetricCard item={metrics[2]} />
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileHeroSection({ isId }: { isId: boolean }) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-[color:var(--app-border)] bg-[linear-gradient(145deg,#ffffff_0%,#f8fcff_52%,#eefbf2_100%)] p-5 shadow-[0_22px_45px_-34px_rgba(15,23,42,0.18)]">
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_0.9fr]">
        <div>
          <h1 className="max-w-[12ch] text-[1.95rem] font-semibold leading-[1.06] tracking-[-0.05em] text-[color:var(--app-text)]">
            {isId ? 'Semua kebutuhan usahamu, ada di ' : 'Everything your business needs is on '}
            <span className="text-[color:var(--app-accent)]">Lajukan</span>
          </h1>
          <p className="mt-4 text-[15px] leading-8 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Cari supplier, lokasi, jasa, dan talent terbaik untuk usahamu.'
              : 'Find suppliers, places, services, and talent for your business.'}
          </p>
        </div>
        <div className="relative min-h-[220px] rounded-[24px] bg-[radial-gradient(circle_at_top,#dcfce7,transparent_64%)]">
          <Image src="/images/umkm/human.png" alt="Lajukan hero" fill priority className="object-contain object-bottom" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <span
            key={index}
            className={cn('h-2.5 rounded-full', index === 0 ? 'w-6 bg-emerald-500' : 'w-2.5 bg-slate-200')}
          />
        ))}
      </div>
    </section>
  );
}

function QuickCategoriesSection({
  isId,
  isAuthenticated,
  summary,
  mobile = false,
}: {
  isId: boolean;
  isAuthenticated: boolean;
  summary: LajukanSummary | null;
  mobile?: boolean;
}) {
  const categories = getQuickCategories(isId, isAuthenticated, summary);

  if (mobile) {
    return (
      <section className="rounded-[28px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.14)]">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {categories.map(item => {
            const Icon = item.icon;
            const tone = toneClassNames(item.tone);

            return (
              <Link key={item.id} href={item.href} className="min-w-[92px] rounded-[20px] px-1 py-2 text-center">
                <span className={cn('mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border', tone.surface)}>
                  <Icon className="h-6 w-6" />
                </span>
                <span className="mt-3 block text-sm font-semibold text-[color:var(--app-text)]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[30px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)]">
      <div className="grid gap-3 xl:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-4">
          <p className="text-[1.02rem] font-black tracking-[-0.03em] text-[color:var(--app-text)]">
            {isId ? 'Jelajahi kategori' : 'Explore categories'}
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
            {isId ? 'Temukan yang kamu butuhkan dengan cepat.' : 'Find what you need faster.'}
          </p>
        </div>
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
          {categories.map(item => {
            const Icon = item.icon;
            const tone = toneClassNames(item.tone);

            return (
              <Link
                key={item.id}
                href={item.href}
                className="min-h-[148px] rounded-[22px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,#ffffff,#fbfffd)] p-3 text-center transition hover:-translate-y-0.5"
              >
                <span className={cn('mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border', tone.surface)}>
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-bold text-[color:var(--app-text)]">{item.label}</p>
                <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">{item.description}</p>
              </Link>
            );
          })}
          <Link
            href={UMKM_DISCOVERY_PATH}
            className="flex min-h-[148px] items-center justify-center rounded-[22px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] text-sm font-semibold text-[color:var(--app-text)] transition hover:-translate-y-0.5"
          >
            {isId ? 'Lihat Semua' : 'See all'}
          </Link>
        </div>
      </div>
    </section>
  );
}

function RecommendationCard({ item, mobile = false }: { item: RecommendationItem; mobile?: boolean }) {
  const badgeTone = toneClassNames(item.badgeTone || 'emerald');

  return (
    <article
      className={cn(
        'overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-white shadow-[0_18px_38px_-34px_rgba(15,23,42,0.16)]',
        mobile && 'min-w-[248px] snap-start',
      )}
    >
      <Link href={item.href} className="block">
        <div className="relative h-44 overflow-hidden">
          <Image src={item.image} alt={item.title} fill className="object-cover" />
          {item.badge ? (
            <span className={cn('absolute left-3 top-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold', badgeTone.soft)}>
              {item.badge}
            </span>
          ) : null}
          <span className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/92 text-[color:var(--app-text)] shadow-[0_12px_22px_-18px_rgba(15,23,42,0.22)]">
            <Heart className="h-4 w-4" />
          </span>
        </div>
        <div className="p-4">
          <h3 className="line-clamp-2 text-[1.02rem] font-bold tracking-[-0.03em] text-[color:var(--app-text)]">{item.title}</h3>
          <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">{item.vendor}</p>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-[color:var(--app-text-soft)]">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-amber-500">{item.rating}</span>
            <span>({item.reviews})</span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[1.25rem] font-black tracking-[-0.04em] text-[color:var(--app-accent)]">{item.price}</p>
              <p className="mt-0.5 text-sm text-[color:var(--app-text-soft)]">{item.unit || item.location}</p>
            </div>
            {item.unit ? <p className="text-sm text-[color:var(--app-text-soft)]">{item.location}</p> : null}
          </div>
        </div>
      </Link>
    </article>
  );
}

function RecommendationsSection({ isId, mobile = false }: { isId: boolean; mobile?: boolean }) {
  return (
    <section className="space-y-4">
      <SectionHeading
        title={isId ? 'Rekomendasi Produk & Supplier' : 'Recommended Products & Suppliers'}
        actionLabel={isId ? 'Lihat semua' : 'See all'}
        actionHref={UMKM_DISCOVERY_PATH}
      />
      {mobile ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
          {RECOMMENDATION_ITEMS.map(item => (
            <RecommendationCard key={item.id} item={item} mobile />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          {RECOMMENDATION_ITEMS.map(item => (
            <RecommendationCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function CommunityPanel({
  isId,
  activeTab,
  onTabChange,
  avatarSrc,
  mobile = false,
}: {
  isId: boolean;
  activeTab: CommunityTab;
  onTabChange: (tab: CommunityTab) => void;
  avatarSrc: string;
  mobile?: boolean;
}) {
  const tabs = getCommunityTabs(isId);
  const post = COMMUNITY_POSTS.find(item => item.tab === activeTab) || COMMUNITY_POSTS[0];

  return (
    <section className="rounded-[30px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)] sm:p-5">
      <SectionHeading
        title={isId ? 'Dari Komunitas' : 'From the Community'}
        actionLabel={isId ? 'Lihat semua' : 'See all'}
        actionHref="/community"
      />
      <div className="mt-4 flex items-center gap-6 overflow-x-auto border-b border-[color:var(--app-border)] pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative shrink-0 pb-2 text-sm font-semibold transition',
              activeTab === tab.id ? 'text-[color:var(--app-accent)]' : 'text-[color:var(--app-text-soft)]',
            )}
          >
            {tab.label}
            {activeTab === tab.id ? (
              <span className="absolute inset-x-0 -bottom-[9px] h-[3px] rounded-full bg-[color:var(--app-accent)]" />
            ) : null}
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-[24px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,#ffffff,#fbfffd)] p-4">
        <div className="flex items-center gap-3">
          <Image src={avatarSrc} alt="Profile" width={44} height={44} className="h-11 w-11 rounded-full object-cover" />
          <div className="flex min-h-[50px] flex-1 items-center rounded-full bg-slate-50 px-4 text-sm text-[color:var(--app-text-soft)]">
            {isId ? 'Apa yang sedang Anda pikirkan?' : 'What are you thinking about?'}
          </div>
        </div>
        <div className={cn('mt-4 grid gap-2', mobile ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 lg:grid-cols-4')}>
          {COMPOSER_ACTIONS.map(action => {
            const Icon = action.icon;
            const tone = toneClassNames(action.tone);

            return (
              <button
                key={action.id}
                type="button"
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[16px] border border-[color:var(--app-border)] bg-white px-3 text-sm font-medium text-[color:var(--app-text-soft)]"
              >
                <Icon className={cn('h-4.5 w-4.5', tone.soft)} />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
      <article className="mt-4 overflow-hidden rounded-[26px] border border-[color:var(--app-border)] bg-white shadow-[0_18px_34px_-32px_rgba(15,23,42,0.15)]">
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Image src={post.avatar} alt={post.author} width={52} height={52} className="h-12 w-12 rounded-full object-cover" />
              <div className="min-w-0">
                <p className="truncate text-[1.05rem] font-bold tracking-[-0.03em] text-[color:var(--app-text)]">{post.community}</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-[color:var(--app-text-soft)]">
                  {post.time}
                  <Globe2 className="h-3.5 w-3.5" />
                </p>
              </div>
            </div>
            <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--app-text-soft)]" aria-label="More options">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-4 text-[1.02rem] leading-8 text-[color:var(--app-text)]">{post.body}</p>
        </div>
        <div className="relative h-[220px] sm:h-[280px]">
          <Image src={post.image} alt={post.community} fill className="object-cover" />
        </div>
        <div className="flex flex-wrap items-center gap-5 px-5 py-4 text-sm text-[color:var(--app-text-soft)]">
          <span className="inline-flex items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-[color:var(--app-accent)]" />
            {post.likes}
          </span>
          <span className="inline-flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {post.comments}
          </span>
          <span className="inline-flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            {post.shares}
          </span>
        </div>
      </article>
      <div className="mt-4 flex items-center justify-end">
        <Link href="/community" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--app-accent)]">
          {isId ? 'Lihat semua diskusi' : 'See all discussions'}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function ReelsPanel({ isId, mobile = false }: { isId: boolean; mobile?: boolean }) {
  return (
    <section className="space-y-4">
      <SectionHeading
        title={isId ? 'Reels Inspirasi' : 'Inspiration Reels'}
        actionLabel={isId ? 'Lihat semua' : 'See all'}
        actionHref="/reels"
      />
      {mobile ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
          {REELS_ITEMS.map(item => (
            <Link
              key={item.id}
              href={item.href}
              className="group relative min-h-[270px] min-w-[205px] snap-start overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-slate-950 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.24)]"
            >
              <Image src={item.image} alt={item.title} fill className="object-cover transition duration-300 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                {item.category}
              </span>
              <div className="absolute inset-x-4 bottom-4">
                <p className="text-[1rem] font-semibold leading-6 text-white">{item.title}</p>
                <div className="mt-3 flex items-center justify-between text-sm text-white/80">
                  <span>{item.views}</span>
                  <PlayCircle className="h-5 w-5 text-white" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          {REELS_ITEMS.map(item => (
            <Link
              key={item.id}
              href={item.href}
              className="group relative min-h-[360px] overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-slate-950 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.24)]"
            >
              <Image src={item.image} alt={item.title} fill className="object-cover transition duration-300 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
              <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                {item.category}
              </span>
              <div className="absolute inset-x-4 bottom-4">
                <p className="text-[1.02rem] font-semibold leading-7 text-white">{item.title}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-white/80">
                  <span>{item.views}</span>
                  <PlayCircle className="h-5 w-5 text-white" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function RightRail({
  isId,
  isAuthenticated,
  summary,
  primaryCtaHref,
}: {
  isId: boolean;
  isAuthenticated: boolean;
  summary: LajukanSummary | null;
  primaryCtaHref: string;
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const pulseItems = [
    { id: 'verified', label: isId ? 'Supplier terverifikasi' : 'Verified suppliers', value: resolveCountLabel(summary?.stores.verified, '6') },
    { id: 'cities', label: isId ? 'Kota aktif' : 'Active cities', value: resolveCountLabel(summary?.stores.cities, '10') },
    { id: 'requests', label: isId ? 'Permintaan aktif' : 'Active requests', value: resolveCountLabel(summary?.requests.active, '2') },
  ];
  const benefitPoints = isId
    ? ['Akses semua fitur Lajukan', 'Nego langsung tanpa batas', 'Transaksi aman & terpercaya', 'Bangun jaringan bisnis luas']
    : ['Unlock every Lajukan feature', 'Negotiate directly with suppliers', 'Safer and trusted transactions', 'Build a wider business network'];
  const slideCount = 2;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide(current => (current + 1) % slideCount);
    }, 5200);

    return () => window.clearInterval(timer);
  }, [slideCount]);

  const goToSlide = (nextIndex: number) => {
    setActiveSlide((nextIndex + slideCount) % slideCount);
  };

  return (
    <aside className="hidden xl:block xl:min-h-0">
      <div className="flex h-full flex-col gap-4 overflow-y-auto pl-1 overscroll-contain">
        <section className="overflow-hidden rounded-[30px] border border-[color:var(--app-border)] bg-white shadow-[0_20px_45px_-34px_rgba(15,23,42,0.16)]">
          <div className="flex items-center justify-between border-b border-[color:var(--app-border)] px-5 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                {activeSlide === 0 ? (isId ? 'Marketplace Pulse' : 'Marketplace Pulse') : isId ? 'Growth Panel' : 'Growth Panel'}
              </p>
              <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                {activeSlide === 0
                  ? isId
                    ? 'Ringkasan pasar terkini'
                    : 'Current marketplace snapshot'
                  : isId
                    ? 'Dorong reach dan peluang baru'
                    : 'Push reach and unlock new opportunities'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToSlide(activeSlide - 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-text)]"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => goToSlide(activeSlide + 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-text)]"
                aria-label="Next slide"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className="flex w-full transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${activeSlide * 100}%)` }}
          >
            <div className="w-full shrink-0 p-5">
              <div className="space-y-3">
                {pulseItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-[18px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,#ffffff,#fbfffd)] px-4 py-3"
                  >
                    <span className="text-sm text-[color:var(--app-text-soft)]">{item.label}</span>
                    <span className="text-base font-black tracking-[-0.03em] text-[color:var(--app-text)]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full shrink-0 bg-[linear-gradient(180deg,#f4fff8_0%,#ffffff_62%,#eefbf4_100%)] p-5">
              <h2 className="text-[1.45rem] font-black tracking-[-0.05em] text-[color:var(--app-text)]">
                {isAuthenticated
                  ? isId
                    ? 'Naikkan jangkauan, dapatkan lebih banyak peluang'
                    : 'Increase reach and unlock more opportunities'
                  : isId
                    ? 'Gabung sekarang, dapatkan lebih banyak peluang'
                    : 'Join now and unlock more opportunities'}
              </h2>
              <ul className="mt-5 space-y-3">
                {benefitPoints.map(point => (
                  <li key={point} className="flex items-start gap-3 text-sm leading-6 text-[color:var(--app-text-soft)]">
                    <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <Link
                href={primaryCtaHref}
                className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)]"
              >
                {isAuthenticated ? (isId ? 'Buat Permintaan' : 'Create Request') : isId ? 'Daftar Gratis' : 'Join Free'}
              </Link>
              <div className="relative mt-6 flex h-40 items-center justify-center rounded-[28px] bg-[radial-gradient(circle_at_top,#ddffe9,transparent_64%)]">
                <div className="absolute h-24 w-24 rounded-full bg-emerald-100 blur-3xl" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-[28px] border border-emerald-200 bg-white shadow-[0_18px_32px_-24px_rgba(15,23,42,0.16)]">
                  <Gift className="h-12 w-12 text-emerald-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-[color:var(--app-border)] px-5 py-4">
            {Array.from({ length: slideCount }).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goToSlide(index)}
                className={cn(
                  'h-2.5 rounded-full transition',
                  activeSlide === index ? 'w-6 bg-emerald-500' : 'w-2.5 bg-slate-200',
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function HomeLoadingState() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eef9f1_0%,#f8fbff_34%,#f8fafc_100%)]">
      <div className="mx-auto max-w-[1640px] animate-pulse px-4 py-5">
        <div className="hidden h-20 rounded-[30px] bg-white/80 lg:block" />
        <div className="mt-5 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_290px]">
          <div className="hidden h-[620px] rounded-[30px] bg-white/80 lg:block" />
          <div className="space-y-5">
            <div className="h-[380px] rounded-[34px] bg-white/80" />
            <div className="h-[180px] rounded-[30px] bg-white/80" />
            <div className="h-[330px] rounded-[30px] bg-white/80" />
            <div className="h-[520px] rounded-[30px] bg-white/80" />
          </div>
          <div className="hidden h-[540px] rounded-[30px] bg-white/80 xl:block" />
        </div>
      </div>
    </div>
  );
}

export function HomeResponsiveMarketplace({ locale }: HomeContentSimpleProps) {
  const isId = (locale || 'id') === 'id';
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const { totalUnread } = useChatInbox();
  const { unreadCount } = useNotificationInbox();
  const [query, setQuery] = useState('');
  const [summary, setSummary] = useState<LajukanSummary | null>(null);
  const [activeTab, setActiveTab] = useState<CommunityTab>('for-you');

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      try {
        const response = await fetch('/api/lajukan/summary', {
          cache: 'no-store',
          credentials: 'include',
        });
        const payload = (await response.json().catch(() => ({}))) as LajukanSummaryResponse;

        if (active && response.ok && payload.data) {
          setSummary(payload.data);
        }
      } catch {
        if (!active) return;
      }
    };

    void loadSummary();

    return () => {
      active = false;
    };
  }, []);

  const text = isId
    ? {
        searchPlaceholder: 'Cari supplier, produk, jasa, lokasi, talent...',
        searchButton: 'Cari',
        help: 'Bantuan',
        login: 'Masuk',
        register: 'Daftar Gratis',
        inviteTitle: 'Siap kembangkan bisnismu?',
        inviteDescription:
          'Gabung di Lajukan dan dapatkan lebih banyak peluang untuk supplier, jasa, dan operasional usahamu.',
        inviteButton: 'Daftar Gratis',
      }
    : {
        searchPlaceholder: 'Search suppliers, products, services, places, talent...',
        searchButton: 'Search',
        help: 'Help',
        login: 'Login',
        register: 'Join Free',
        inviteTitle: 'Ready to grow your business?',
        inviteDescription:
          'Join Lajukan and unlock more supplier, service, and operating opportunities for your business.',
        inviteButton: 'Join Free',
      };

  const displayName =
    user?.fullName || user?.full_name || user?.username || 'Andi Pratama';
  const avatarSrc = user?.avatarUrl || user?.avatar_url || '/default-avatar.svg';
  const primaryCtaHref = isAuthenticated ? '/create' : '/register';
  const chatHref = isAuthenticated ? '/chat' : '/login';
  const notificationsHref = isAuthenticated ? '/notifications' : '/login';
  const accountHref = isAuthenticated ? '/profile' : '/login';

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : UMKM_DISCOVERY_PATH);
  };

  const desktopShellStyle = {
    height: 'calc(100svh - max(env(safe-area-inset-top), 1rem) - 2rem)',
  };

  const sidebarItems = isAuthenticated
    ? {
        primary: [
          { id: 'home', label: isId ? 'Beranda' : 'Home', caption: isId ? 'Ringkasan bisnis utama' : 'Main business overview', href: '/home', icon: Home },
          { id: 'explore', label: isId ? 'Jelajah' : 'Explore', caption: isId ? 'Supplier, produk, jasa' : 'Suppliers, products, services', href: UMKM_DISCOVERY_PATH, icon: LayoutGrid },
          { id: 'community', label: isId ? 'Komunitas' : 'Community', caption: isId ? 'Forum dan diskusi bisnis' : 'Forum and business discussion', href: '/community', icon: Sparkles },
          { id: 'reels', label: isId ? 'Reels Bisnis' : 'Business Reels', caption: isId ? 'Inspirasi singkat dan tips' : 'Short inspiration and tips', href: '/reels', icon: PlayCircle },
          { id: 'requests', label: isId ? 'Permintaan Saya' : 'My Requests', caption: isId ? 'Brief dan kebutuhan aktif' : 'Active briefs and needs', href: '/my-projects', icon: ClipboardList },
          { id: 'transactions', label: isId ? 'Transaksi' : 'Transactions', caption: isId ? 'Progress kerja sama & pembayaran' : 'Progress and payments', href: '/transactions', icon: CreditCard },
        ],
        secondary: [
          { id: 'chat', label: 'Chat', caption: isId ? 'Negosiasi dan follow-up' : 'Negotiation and follow-up', href: '/chat', icon: MessageCircle, badge: totalUnread > 0 ? (totalUnread > 99 ? '99+' : totalUnread) : undefined },
          { id: 'account', label: isId ? 'Akun Saya' : 'My Account', caption: isId ? 'Profil dan preferensi' : 'Profile and preferences', href: '/profile', icon: UserRound },
          { id: 'support', label: isId ? 'Bantuan' : 'Help', caption: isId ? 'Panduan dan support' : 'Guides and support', href: '/support', icon: CircleHelp },
        ],
      }
    : {
        primary: [
          { id: 'home', label: isId ? 'Beranda' : 'Home', caption: isId ? 'Ringkasan peluang terbaru' : 'Latest opportunity overview', href: '/home', icon: Home },
          { id: 'explore', label: isId ? 'Jelajah' : 'Explore', caption: isId ? 'Supplier, produk, jasa' : 'Suppliers, products, services', href: UMKM_DISCOVERY_PATH, icon: LayoutGrid },
          { id: 'supplier', label: isId ? 'Supplier' : 'Suppliers', caption: isId ? 'Temukan supplier terpercaya' : 'Trusted suppliers', href: '/search?type=product&q=supplier', icon: ShoppingBag },
          { id: 'service', label: isId ? 'Jasa' : 'Services', caption: isId ? 'Berbagai jasa untuk bisnismu' : 'Business services', href: '/search?type=service&q=jasa%20usaha', icon: BriefcaseBusiness },
          { id: 'location', label: isId ? 'Lokasi' : 'Places', caption: isId ? 'Temukan lokasi strategis' : 'Strategic places', href: '/search?type=property&q=lokasi%20usaha', icon: MapPin },
          { id: 'talent', label: 'Talent', caption: isId ? 'Temukan talent berkualitas' : 'Qualified talent', href: '/search?type=freelancer&q=talent', icon: UserRound },
          { id: 'opportunity', label: isId ? 'Peluang Usaha' : 'Business Opportunities', caption: isId ? 'Ide tumbuh dan ekspansi' : 'Growth and expansion ideas', href: '/learn', icon: TrendingUp },
        ],
        secondary: [
          { id: 'community', label: isId ? 'Komunitas' : 'Community', caption: isId ? 'Forum dan diskusi bisnis' : 'Forum and business discussion', href: '/community', icon: Sparkles },
          { id: 'reels', label: isId ? 'Reels Bisnis' : 'Business Reels', caption: isId ? 'Inspirasi singkat dan tips' : 'Short inspiration and tips', href: '/reels', icon: PlayCircle },
          { id: 'requests', label: isId ? 'Permintaan Saya' : 'My Requests', caption: isId ? 'Login untuk akses' : 'Login to access', href: '/login', icon: ClipboardList, locked: true },
          { id: 'transactions', label: isId ? 'Transaksi' : 'Transactions', caption: isId ? 'Login untuk akses' : 'Login to access', href: '/login', icon: CreditCard, locked: true },
        ],
      };

  if (authLoading) {
    return <HomeLoadingState />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eef9f1_0%,#f8fbff_34%,#f8fafc_100%)] pb-28 lg:pb-10">
      <div className="mx-auto max-w-[1640px] px-4 py-4 sm:px-5" style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}>
        <MobileTopBar notificationsHref={notificationsHref} chatHref={chatHref} totalUnread={totalUnread} unreadCount={unreadCount} />

        <div className="space-y-5 lg:hidden">
          <div className="mt-4">
            <SearchBar
              query={query}
              onQueryChange={setQuery}
              onSubmit={handleSearchSubmit}
              placeholder={text.searchPlaceholder}
              buttonLabel={text.searchButton}
              compact
            />
          </div>
          <QuickCategoriesSection isId={isId} isAuthenticated={isAuthenticated} summary={summary} mobile />
          <MobileHeroSection isId={isId} />
          <RecommendationsSection isId={isId} mobile />
          <CommunityPanel isId={isId} activeTab={activeTab} onTabChange={setActiveTab} avatarSrc={avatarSrc} mobile />
          <ReelsPanel isId={isId} mobile />
        </div>

        <div className="hidden lg:flex lg:flex-col" style={desktopShellStyle}>
          <DesktopTopBar
            query={query}
            onQueryChange={setQuery}
            onSubmit={handleSearchSubmit}
            placeholder={text.searchPlaceholder}
            buttonLabel={text.searchButton}
            helpLabel={text.help}
            helpHref="/support"
            chatHref={chatHref}
            notificationHref={notificationsHref}
            accountHref={accountHref}
            displayName={displayName}
            avatarSrc={avatarSrc}
            isAuthenticated={isAuthenticated}
            loginLabel={text.login}
            registerLabel={text.register}
            totalUnread={totalUnread}
            unreadCount={unreadCount}
          />

          <div className="mt-5 grid min-h-0 flex-1 gap-5 lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)_290px]">
            <DesktopSidebar
              pathname={pathname}
              items={sidebarItems}
              inviteTitle={text.inviteTitle}
              inviteDescription={text.inviteDescription}
              inviteButton={text.inviteButton}
              inviteHref={primaryCtaHref}
            />
            <main className="min-h-0 overflow-y-auto pr-1 overscroll-contain">
              <div className="space-y-5 pb-6">
                <DesktopHeroSection
                  isId={isId}
                  summary={summary}
                  query={query}
                  onQueryChange={setQuery}
                  onSubmit={handleSearchSubmit}
                  placeholder={text.searchPlaceholder}
                  buttonLabel={text.searchButton}
                  primaryCtaHref={primaryCtaHref}
                />
                <QuickCategoriesSection isId={isId} isAuthenticated={isAuthenticated} summary={summary} />
                <RecommendationsSection isId={isId} />
                <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
                  <CommunityPanel isId={isId} activeTab={activeTab} onTabChange={setActiveTab} avatarSrc={avatarSrc} />
                  <ReelsPanel isId={isId} />
                </div>
              </div>
            </main>
            <RightRail isId={isId} isAuthenticated={isAuthenticated} summary={summary} primaryCtaHref={primaryCtaHref} />
          </div>
        </div>
      </div>
      <MobileBottomNav locale={isId ? 'id' : 'en'} pathname={pathname} isAuthenticated={isAuthenticated} />
    </div>
  );
}
