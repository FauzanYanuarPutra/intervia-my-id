'use client';

import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  BriefcaseBusiness,
  Award,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clapperboard,
  CreditCard,
  Flame,
  Gift,
  Globe2,
  Heart,
  Home,
  ImageIcon,
  LayoutGrid,
  LockKeyhole,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Package,
  PlayCircle,
  Share2,
  ShieldCheck,
  ShoppingBag,
  SmilePlus,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  TrendingUp,
  Trophy,
  UserRound,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { HomeUmkmMapPreview } from '@/components/home/HomeUmkmMapPreview';
import { SearchInput } from '@/components/ui/SearchInput';
import { useAuth } from '@/context/AuthContext';
import { useChatInbox } from '@/context/ChatInboxContext';
import { Link, useRouter } from '@/i18n/navigation';
import {
  formatLajukanCountLabel,
  type LajukanSummary,
} from '@/lib/lajukan-marketplace';
import {
  extractContentItems,
  formatCurrencyFromCents,
  parseImages,
  type ContentItem,
} from '@/lib/content/catalog';
import { buildContentHref } from '@/lib/content/routes';
import { MarketplacePageFrame } from '@/components/layout/MarketplacePageFrame';
import type {
  CommunityFeedItem,
  CommunityFeedResponse,
} from '@/lib/community/types';
import { UMKM_DISCOVERY_PATH } from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';

type HomeContentSimpleProps = {
  locale: string;
};

type Tone =
  | 'emerald'
  | 'blue'
  | 'teal'
  | 'violet'
  | 'amber'
  | 'rose'
  | 'cyan'
  | 'lime'
  | 'orange';

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
  image?: string;
  href: string;
  badge?: string;
  badgeTone?: Tone;
  typeLabel: string;
  createHref: string;
};

type CommunityTab = 'for-you' | 'following' | 'community' | 'reels';

type CommunityPost = {
  id: string;
  tab: CommunityTab;
  community: string;
  author: string;
  time: string;
  title: string;
  body: string;
  image?: string;
  avatar?: string;
  tags: string[];
  likes: string;
  comments: string;
  shares: string;
};

type ReelItem = {
  id: string;
  category: string;
  title: string;
  views: string;
  mediaUrl?: string;
  mediaType?: string;
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

type GameQuest = {
  id: string;
  label: string;
  caption: string;
  href: string;
  xp: string;
  progress: number;
  icon: LucideIcon;
  tone: Tone;
};

type GameAchievement = {
  id: string;
  label: string;
  hint: string;
  unlocked: boolean;
  icon: LucideIcon;
};

type GameSnapshot = {
  level: number;
  rank: string;
  xp: number;
  xpGoal: number;
  xpPercent: number;
  streak: number;
  nextReward: string;
  quests: GameQuest[];
  achievements: GameAchievement[];
};

type LajukanSummaryResponse = {
  data?: LajukanSummary;
  error?: string;
};

type HomeWalletAccount = {
  id?: string;
  environment?: 'development' | 'live' | string;
  currency?: string | null;
  available_balance_cents?: number | null;
};

type HomeWalletBalancesResponse = {
  accounts?: HomeWalletAccount[];
  default_environment?: 'development' | 'live' | string;
  live_enabled?: boolean;
  error?: string;
};

const HERO_TAGS = ['Bahan Lokal', 'Siap Ekspor', 'Kemasan', 'Mesin UMKM'];
const HOME_HERO_IMAGE = '/images/hero/lajukan.png';

function buildCommunityPostHref(post: CommunityPost): string {
  const params = new URLSearchParams();
  params.set('tab', post.tab);
  const tag = post.tags[0];
  if (tag) params.set('tag', tag);
  return `/community?${params.toString()}`;
}

const COMPOSER_ACTIONS = [
  {
    id: 'photo',
    label: 'Foto/Video',
    href: '/community?compose=photo',
    icon: ImageIcon,
    tone: 'emerald' as Tone,
  },
  {
    id: 'reels',
    label: 'Reels',
    href: '/community?compose=reel',
    icon: Clapperboard,
    tone: 'rose' as Tone,
  },
  {
    id: 'polling',
    label: 'Polling',
    href: '/community?compose=poll',
    icon: BarChart3,
    tone: 'amber' as Tone,
  },
  {
    id: 'feeling',
    label: 'Perasaan',
    href: '/community?compose=feeling',
    icon: SmilePlus,
    tone: 'teal' as Tone,
  },
];

function toneClassNames(tone: Tone) {
  if (tone === 'blue' || tone === 'teal') {
    return {
      icon: 'bg-teal-100 text-teal-700',
      soft: 'bg-teal-50 text-teal-700',
      surface: 'border-teal-100 bg-teal-50/70',
      card: 'border-teal-100 bg-[linear-gradient(180deg,#ffffff,#f0fdfa)]',
      glow: 'bg-teal-400/16',
      text: 'text-teal-700',
    };
  }
  if (tone === 'violet') {
    return {
      icon: 'bg-lime-100 text-lime-800',
      soft: 'bg-lime-50 text-lime-800',
      surface: 'border-lime-100 bg-lime-50/70',
      card: 'border-lime-100 bg-[linear-gradient(180deg,#ffffff,#f7fee7)]',
      glow: 'bg-lime-400/16',
      text: 'text-lime-700',
    };
  }
  if (tone === 'amber') {
    return {
      icon: 'bg-amber-100 text-amber-600',
      soft: 'bg-amber-50 text-amber-700',
      surface: 'border-amber-100 bg-amber-50/70',
      card: 'border-amber-100 bg-[linear-gradient(180deg,#ffffff,#fff8e7)]',
      glow: 'bg-amber-400/18',
      text: 'text-amber-700',
    };
  }
  if (tone === 'rose') {
    return {
      icon: 'bg-rose-100 text-rose-600',
      soft: 'bg-rose-50 text-rose-700',
      surface: 'border-rose-100 bg-rose-50/70',
      card: 'border-rose-100 bg-[linear-gradient(180deg,#ffffff,#fff1f5)]',
      glow: 'bg-rose-400/16',
      text: 'text-rose-700',
    };
  }
  if (tone === 'cyan') {
    return {
      icon: 'bg-emerald-100 text-emerald-700',
      soft: 'bg-emerald-50 text-emerald-700',
      surface: 'border-emerald-100 bg-emerald-50/70',
      card: 'border-emerald-100 bg-[linear-gradient(180deg,#ffffff,#f0fdf4)]',
      glow: 'bg-emerald-400/16',
      text: 'text-emerald-700',
    };
  }
  if (tone === 'lime') {
    return {
      icon: 'bg-lime-100 text-lime-700',
      soft: 'bg-lime-50 text-lime-700',
      surface: 'border-lime-100 bg-lime-50/70',
      card: 'border-lime-100 bg-[linear-gradient(180deg,#ffffff,#f7fee7)]',
      glow: 'bg-lime-400/16',
      text: 'text-lime-700',
    };
  }
  if (tone === 'orange') {
    return {
      icon: 'bg-orange-100 text-orange-700',
      soft: 'bg-orange-50 text-orange-700',
      surface: 'border-orange-100 bg-orange-50/70',
      card: 'border-orange-100 bg-[linear-gradient(180deg,#ffffff,#fff7ed)]',
      glow: 'bg-orange-400/16',
      text: 'text-orange-700',
    };
  }
  return {
    icon: 'bg-emerald-100 text-emerald-700',
    soft: 'bg-emerald-50 text-emerald-700',
    surface: 'border-emerald-100 bg-emerald-50/70',
    card: 'border-emerald-100 bg-[linear-gradient(180deg,#ffffff,#effdf5)]',
    glow: 'bg-emerald-400/16',
    text: 'text-emerald-700',
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

function readText(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function metadataText(item: ContentItem, ...keys: string[]): string {
  const metadata = item.metadata || {};
  for (const key of keys) {
    const value = readText(metadata[key]);
    if (value) return value;
  }
  return '';
}

function labelForContentType(isId: boolean, type?: string | null): string {
  const normalized = (type || '').toLowerCase();
  if (normalized === 'product') return isId ? 'Produk' : 'Product';
  if (normalized === 'service') return isId ? 'Jasa' : 'Service';
  if (normalized === 'property') return isId ? 'Lokasi' : 'Place';
  if (normalized === 'tool_rental') return isId ? 'Sewa Alat' : 'Tool Rental';
  if (normalized === 'business_transfer')
    return isId ? 'Oper Usaha' : 'Business Transfer';
  if (normalized === 'freelancer' || normalized === 'job') return 'Talent';
  return isId ? 'Listing' : 'Listing';
}

function createHrefForContentType(type?: string | null): string {
  const normalized = (type || '').toLowerCase();
  if (normalized === 'product') return '/create/jual/produk';
  if (normalized === 'service') return '/create/jual/jasa';
  if (normalized === 'property') return '/create/jual/properti';
  if (normalized === 'tool_rental') return '/create/jual/sewa-alat';
  if (normalized === 'business_transfer') return '/create/jual/oper-usaha';
  if (normalized === 'freelancer' || normalized === 'job')
    return '/create/jual/talent';
  return '/create';
}

function mapContentToRecommendation(
  item: ContentItem,
  isId: boolean,
): RecommendationItem | null {
  if (!item.id || !item.title) return null;
  const image = parseImages(item)[0];
  const statsRating = item.seller_stats?.rating ?? item.rating;
  const statsReviews = item.seller_stats?.review_count ?? item.review_count;
  const type = item.content_type || item.category;
  const vendor =
    readText(item.owner_profile?.full_name) ||
    metadataText(item, 'brand', 'company', 'company_name', 'store_name');
  const location =
    readText(item.owner_profile?.location) ||
    metadataText(item, 'city', 'location', 'address');
  const price =
    typeof item.price_cents === 'number' && item.price_cents > 0
      ? formatCurrencyFromCents(item.price_cents, item.currency)
      : isId
        ? 'Tanya harga'
        : 'Ask price';
  const unit = metadataText(
    item,
    'unit',
    'rate_type',
    'min_order_qty',
    'lease_term',
  );

  return {
    id: item.id,
    title: item.title,
    vendor,
    location,
    rating:
      typeof statsRating === 'number' && Number.isFinite(statsRating)
        ? statsRating.toFixed(1)
        : '-',
    reviews:
      typeof statsReviews === 'number' && Number.isFinite(statsReviews)
        ? formatCompactCount(statsReviews, '0')
        : '0',
    price,
    unit,
    image,
    href: buildContentHref(item.id, item.title, item.slug),
    badge: item.promo_label || undefined,
    badgeTone: item.promo_label ? 'rose' : undefined,
    typeLabel: labelForContentType(isId, type),
    createHref: createHrefForContentType(type),
  };
}

function formatCommunityTime(value: string, isId: boolean): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return isId ? 'Baru saja' : 'Just now';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return isId ? 'Baru saja' : 'Just now';
  if (minutes < 60) return isId ? `${minutes} menit lalu` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isId ? `${hours} jam lalu` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return isId ? `${days} hari lalu` : `${days}d ago`;
}

function mapCommunityItemToPost(
  item: CommunityFeedItem,
  isId: boolean,
): CommunityPost {
  return {
    id: item.id,
    tab: item.kind === 'reel' ? 'reels' : 'community',
    community:
      item.group?.name ||
      item.communityName ||
      (isId ? 'Komunitas' : 'Community'),
    author: item.author?.name || (isId ? 'Member Lajukan' : 'Lajukan member'),
    time: formatCommunityTime(item.createdAt, isId),
    title: item.title || (isId ? 'Diskusi komunitas' : 'Community discussion'),
    body: item.body || '',
    image: item.media?.type === 'image' ? item.media.src : undefined,
    avatar: item.author?.avatarUrl || undefined,
    tags: item.tags
      .map(tag => tag.name || tag.slug)
      .filter(Boolean)
      .slice(0, 4),
    likes: formatCompactCount(item.stats?.reactions, '0'),
    comments: formatCompactCount(item.stats?.comments, '0'),
    shares: formatCompactCount(item.stats?.shares, '0'),
  };
}

type ReelsFeedItem = {
  id?: string;
  mediaUrl?: string;
  media_url?: string;
  mediaType?: string;
  media_type?: string;
  title?: string;
  caption?: string;
  hook?: string;
  store?: { name?: string; city?: string };
  stats?: { views?: number };
};

function mapReelFeedItem(item: ReelsFeedItem): ReelItem | null {
  const id = readText(item.id);
  if (!id) return null;
  const mediaUrl = readText(item.mediaUrl) || readText(item.media_url);
  const mediaType =
    readText(item.mediaType) || readText(item.media_type) || 'video';
  const category = readText(item.hook) || readText(item.store?.city) || 'Reels';

  return {
    id,
    category,
    title: readText(item.title) || readText(item.caption) || 'Reels Lajukan',
    views: formatCompactCount(readNumber(item.stats?.views), ''),
    mediaUrl,
    mediaType,
    href: `/reels?video=${encodeURIComponent(id)}`,
  };
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeWalletEnvironment(value: unknown): 'development' | 'live' {
  return String(value || '')
    .trim()
    .toLowerCase() === 'live'
    ? 'live'
    : 'development';
}

function pickHomeWalletAccount(
  payload: HomeWalletBalancesResponse | null,
): HomeWalletAccount | null {
  if (!payload?.accounts?.length) return null;
  const defaultEnvironment = normalizeWalletEnvironment(
    payload.default_environment,
  );
  return (
    payload.accounts.find(
      account =>
        normalizeWalletEnvironment(account.environment) === defaultEnvironment,
    ) ||
    payload.accounts.find(
      account =>
        normalizeWalletEnvironment(account.environment) === 'development',
    ) ||
    payload.accounts[0] ||
    null
  );
}

function buildGameSnapshot(
  isId: boolean,
  isAuthenticated: boolean,
  summary: LajukanSummary | null,
): GameSnapshot {
  const verifiedSuppliers = summary?.stores?.verified ?? 0;
  const activeRequests = summary?.requests?.active ?? 0;
  const activeCities = summary?.stores?.cities ?? 0;
  const marketSize = summary?.categories?.all ?? 0;
  const baseXp =
    420 +
    (isAuthenticated ? 260 : 0) +
    Math.min(verifiedSuppliers, 40) * 18 +
    Math.min(activeRequests, 30) * 22 +
    Math.min(activeCities, 80) * 8 +
    Math.min(Math.floor(marketSize / 100), 300);
  const xpGoal = 500;
  const level = Math.max(1, Math.floor(baseXp / xpGoal) + 1);
  const xp = baseXp % xpGoal;
  const xpPercent = clampProgress((xp / xpGoal) * 100);
  const rank =
    level >= 12
      ? isId
        ? 'Scale Up'
        : 'Scale Up'
      : level >= 7
        ? isId
          ? 'Builder'
          : 'Builder'
        : isId
          ? 'Starter'
          : 'Starter';
  const streak = Math.max(
    1,
    Math.min(14, (isAuthenticated ? 3 : 1) + Math.floor(activeRequests / 2)),
  );

  return {
    level,
    rank,
    xp,
    xpGoal,
    xpPercent,
    streak,
    nextReward: level >= 7 ? 'Boost +' : 'Badge +',
    quests: [
      {
        id: 'profile',
        label: isId ? 'Profil siap' : 'Ready profile',
        caption: isId ? 'Biar cepat dipercaya' : 'Earn more trust',
        href: isAuthenticated ? '/profile' : '/register',
        xp: '120 XP',
        progress: clampProgress(isAuthenticated ? 72 : 24),
        icon: UserRound,
        tone: 'emerald',
      },
      {
        id: 'listing',
        label: isId ? 'Posting listing' : 'Post listing',
        caption: isId ? 'Produk/jasa tampil' : 'Show products/services',
        href: isAuthenticated ? '/create' : '/register',
        xp: '180 XP',
        progress: clampProgress(
          isAuthenticated ? 54 + Math.min(activeRequests, 20) : 18,
        ),
        icon: Package,
        tone: 'orange',
      },
      {
        id: 'community',
        label: isId ? 'Ikut komunitas' : 'Join community',
        caption: isId ? 'Tanya, jawab, konek' : 'Ask, answer, connect',
        href: '/community',
        xp: '90 XP',
        progress: clampProgress(isAuthenticated ? 48 : 22),
        icon: Users,
        tone: 'teal',
      },
      {
        id: 'reels',
        label: isId ? 'Reels skill' : 'Skill reels',
        caption: isId ? 'Belajar cepat 30 detik' : 'Learn in 30 seconds',
        href: '/reels',
        xp: '80 XP',
        progress: clampProgress(verifiedSuppliers > 0 ? 46 : 30),
        icon: Clapperboard,
        tone: 'rose',
      },
    ],
    achievements: [
      {
        id: 'arena',
        label: isId ? 'Masuk Arena' : 'Arena In',
        hint: isId ? 'Login' : 'Login',
        unlocked: isAuthenticated,
        icon: Award,
      },
      {
        id: 'hunter',
        label: isId ? 'Hunter' : 'Hunter',
        hint: isId ? 'Cari peluang' : 'Find leads',
        unlocked: true,
        icon: Target,
      },
      {
        id: 'trust',
        label: isId ? 'Trust' : 'Trust',
        hint: isId ? 'Supplier siap' : 'Ready suppliers',
        unlocked: verifiedSuppliers > 0,
        icon: ShieldCheck,
      },
      {
        id: 'network',
        label: isId ? 'Network' : 'Network',
        hint: isId ? 'Komunitas' : 'Community',
        unlocked: isAuthenticated || activeCities > 0,
        icon: Users,
      },
    ],
  };
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
      description: isId ? 'Supplier siap respon' : 'Trusted suppliers',
      href: '/search?type=product&q=supplier',
      icon: ShoppingBag,
      tone: 'emerald',
      countLabel: resolveCountLabel(summary?.categories?.supplier, '12.000+'),
    },
    {
      id: 'product',
      label: isId ? 'Produk' : 'Products',
      description: isId ? 'Stok siap jual' : 'Best products',
      href: '/search?q=produk%20reseller',
      icon: Package,
      tone: 'orange',
      countLabel: resolveCountLabel(summary?.categories?.product, '8.500+'),
    },
    {
      id: 'service',
      label: isId ? 'Jasa' : 'Services',
      description: isId ? 'Jasa operasional' : 'Business services',
      href: '/search?type=service&q=jasa%20usaha',
      icon: BriefcaseBusiness,
      tone: 'violet',
      countLabel: resolveCountLabel(summary?.categories?.service, '3.700+'),
    },
    {
      id: 'location',
      label: isId ? 'Lokasi' : 'Places',
      description: isId ? 'Lokasi jualan' : 'Strategic places',
      href: '/search?type=property&q=lokasi%20usaha',
      icon: MapPin,
      tone: 'rose',
      countLabel: resolveCountLabel(summary?.categories?.location, '5.200+'),
    },
    {
      id: 'talent',
      label: 'Talent',
      description: isId ? 'Talent siap bantu' : 'Qualified talent',
      href: '/search?type=freelancer&q=talent',
      icon: UserRound,
      tone: 'cyan',
      countLabel: resolveCountLabel(summary?.categories?.talent, '2.100+'),
    },
    {
      id: 'request',
      label: isId ? 'Peluang Usaha' : 'Opportunities',
      description: isId ? 'Peluang aktif' : 'Promising opportunities',
      href: isAuthenticated ? '/my-projects' : '/register',
      icon: TrendingUp,
      tone: 'lime',
      countLabel: resolveCountLabel(summary?.requests?.total, '1.200+'),
    },
    {
      id: 'community',
      label: isId ? 'Komunitas' : 'Community',
      description: isId
        ? 'Diskusi dan belajar bareng'
        : 'Discuss and learn together',
      href: '/community',
      icon: MessageCircle,
      tone: 'amber',
      countLabel: resolveCountLabel(summary?.requests?.active, '800+'),
    },
  ];
}

function getHeroMetrics(
  isId: boolean,
  summary: LajukanSummary | null,
): HeroMetric[] {
  return [
    {
      id: 'verified',
      label: isId ? 'Supplier siap' : 'Verified suppliers',
      value: `+${formatCompactCount(summary?.stores?.verified, '2.5K')}`,
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
      value: `+${formatCompactCount(summary?.requests?.active, '8K')}`,
      note: isId ? 'Diskusi dan peluang baru' : 'Discussions and new leads',
      icon: UserRound,
      tone: 'blue',
    },
  ];
}

function getCommunityTabs(isId: boolean) {
  return [
    { id: 'for-you' as CommunityTab, label: isId ? 'Untukmu' : 'For you' },
    {
      id: 'following' as CommunityTab,
      label: isId ? 'Mengikuti' : 'Following',
    },
    {
      id: 'community' as CommunityTab,
      label: isId ? 'Komunitas' : 'Community',
    },
    { id: 'reels' as CommunityTab, label: 'Reels' },
  ];
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
      <h2 className="text-[1.02rem] font-black tracking-[-0.035em] text-[color:var(--app-text)] sm:text-[1.12rem]">
        {title}
      </h2>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="flex items-center justify-between text-xs font-semibold text-[color:var(--app-accent)]"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
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
    <aside className="hidden lg:block lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div
        className="flex h-full max-h-full min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pb-6 pr-1"
        data-auto-scrollbar
      >
        <nav className="shrink-0 rounded-[24px] p-3 shadow-[0_18px_36px_-32px_rgba(15,23,42,0.14)]">
          <div className="space-y-1">
            {items.primary.map(item => {
              const Icon = item.icon;
              const itemPath = item.href.split('?')[0];
              const active =
                itemPath === '/home'
                  ? currentPath === '/home' || currentPath === '/'
                  : currentPath === itemPath ||
                    currentPath.startsWith(`${itemPath}/`);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[46px] items-start gap-2.5 rounded-[14px] px-2.5 py-2 transition',
                    active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px]',
                      active
                        ? 'bg-white text-emerald-600'
                        : 'bg-slate-50 text-[color:var(--app-text-soft)]',
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      {item.label}
                      {item.locked ? (
                        <LockKeyhole className="h-3.5 w-3.5 text-slate-400" />
                      ) : null}
                      {item.badge ? (
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-[color:var(--app-text-soft)]">
                      {item.caption}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="my-2 h-px bg-[color:var(--app-border)]" />
          <div className="space-y-1">
            {items.secondary.map(item => {
              const Icon = item.icon;
              const itemPath = item.href.split('?')[0];
              const active =
                currentPath === itemPath ||
                currentPath.startsWith(`${itemPath}/`);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[44px] items-start gap-2.5 rounded-[14px] px-2.5 py-2 transition',
                    active
                      ? 'bg-slate-50 text-[color:var(--app-text)]'
                      : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]',
                  )}
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-slate-50 text-[color:var(--app-text-soft)]">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      {item.label}
                      {item.locked ? (
                        <LockKeyhole className="h-3.5 w-3.5 text-slate-400" />
                      ) : null}
                      {item.badge ? (
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-[color:var(--app-text-soft)]">
                      {item.caption}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="shrink-0 overflow-hidden rounded-[24px] border border-emerald-100 bg-[linear-gradient(180deg,#f4fff8_0%,#ffffff_62%,#eefbf4_100%)] p-3.5 shadow-[0_18px_36px_-32px_rgba(22,163,74,0.22)] m-3">
          <h3 className="text-[0.92rem] font-black tracking-[-0.03em] text-[color:var(--app-text)]">
            {inviteTitle}
          </h3>
          <p className="mt-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
            {inviteDescription}
          </p>
          <Link
            href={inviteHref}
            className="mt-3 inline-flex min-h-[38px] w-full items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-3 text-xs font-semibold text-[color:var(--app-text-inverse)]"
          >
            {inviteButton}
          </Link>
        </div>
      </div>
    </aside>
  );
}

function HeroVisualStage({
  metrics,
  compact = false,
  className,
}: {
  metrics: HeroMetric[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-[20px] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_38%,var(--app-surface-strong))] p-2 ring-1 ring-[color:color-mix(in_srgb,var(--app-accent-border)_44%,transparent)]',
        className,
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-[16px] bg-emerald-100',
          compact ? 'h-[124px]' : 'h-[176px] 2xl:h-[190px]',
        )}
      >
        <Image
          src={HOME_HERO_IMAGE}
          alt="Lajukan hero"
          fill
          loading="lazy"
          fetchPriority="low"
          quality={58}
          sizes={
            compact
              ? '(max-width: 1023px) 100vw, 240px'
              : '(max-width: 1535px) 268px, 292px'
          }
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,46,26,0.02),rgba(5,46,26,0.36))]" />
        <Link
          href="/reels"
          className="absolute bottom-2 right-2 inline-flex min-h-[28px] items-center gap-1.5 rounded-full bg-white/92 px-2.5 text-[10px] font-black text-[color:var(--app-accent)] shadow-[0_14px_24px_-18px_rgba(15,23,42,0.2)]"
        >
          <PlayCircle className="h-3.5 w-3.5" />
          Reels
        </Link>
      </div>
      <div className="mt-2 grid min-w-0 grid-cols-2 gap-1.5">
        {metrics.map((item, index) => {
          const Icon = item.icon;
          const tone = toneClassNames(item.tone);
          return (
            <div
              key={item.id}
              className={cn(
                'min-w-0 rounded-[13px] bg-[color:var(--app-surface-strong)] px-2 py-1.5 ring-1 ring-[color:var(--app-border)]',
                index === 2 ? 'col-span-2' : '',
              )}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[9px]',
                    tone.icon,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.78rem] font-black leading-4 text-[color:var(--app-text)]">
                    {item.value}
                  </p>
                  <p className="text-[9.5px] font-semibold leading-3 text-[color:var(--app-text-soft)]">
                    {item.label}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MobileHeroVisualBanner({
  isId,
  metrics,
  className,
}: {
  isId: boolean;
  metrics: HeroMetric[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        'relative h-[clamp(248px,66vw,338px)] w-full overflow-hidden rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_76%,white_16%)] bg-emerald-100 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.22)] sm:h-[clamp(268px,44vw,360px)]',
        className,
      )}
    >
      <Image
        src={HOME_HERO_IMAGE}
        alt={isId ? 'Visual Lajukan' : 'Lajukan visual'}
        fill
        loading="lazy"
        fetchPriority="low"
        quality={62}
        sizes="(max-width: 1279px) 100vw, 1px"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(5,46,26,0.08)_42%,rgba(5,46,26,0.48)_100%)]" />
      <Link
        href="/reels"
        className="absolute right-3 top-3 z-20 inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-white/[0.94] px-3 text-[11px] font-black text-[color:var(--app-accent)] shadow-[0_14px_24px_-18px_rgba(15,23,42,0.35)] backdrop-blur"
      >
        <PlayCircle className="h-4 w-4" />
        Reels
      </Link>
      <div className="pointer-events-none absolute inset-0">
        {metrics.slice(0, 3).map((item, index) => {
          const Icon = item.icon;
          const tone = toneClassNames(item.tone);
          const positionClass =
            index === 0
              ? 'left-3 top-3 max-w-[172px]'
              : index === 1
                ? 'left-3 bottom-3 max-w-[196px]'
                : 'right-3 top-[5.1rem] max-w-[176px]';
          return (
            <div
              key={item.id}
              className={cn(
                'absolute min-w-[132px] rounded-[15px] border border-white/70 bg-white/[0.92] px-2.5 py-2 shadow-[0_14px_24px_-20px_rgba(15,23,42,0.28)] backdrop-blur-md',
                positionClass,
              )}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[11px]',
                    tone.icon,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.84rem] font-black leading-4 text-[color:var(--app-text)]">
                    {item.value}
                  </p>
                  <p className="text-[10px] font-bold leading-3 text-[color:var(--app-text-soft)]">
                    {item.label}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DesktopHeroSection({
  isId,
  isAuthenticated,
  summary,
  primaryCtaHref,
  query,
  onQueryChange,
  onSubmit,
  placeholder,
  buttonLabel,
}: {
  isId: boolean;
  isAuthenticated: boolean;
  summary: LajukanSummary | null;
  primaryCtaHref: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (query: string) => void;
  placeholder: string;
  buttonLabel: string;
}) {
  const metrics = getHeroMetrics(isId, summary);

  return (
    <div>
      <section className="overflow-hidden rounded-[26px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_8%)] bg-[linear-gradient(145deg,#ffffff_0%,#f8fcff_48%,#eefbf2_100%)] p-4 shadow-[0_20px_42px_-36px_rgba(15,23,42,0.18)] xl:p-5">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_268px] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_292px]">
          <div className="relative z-10 min-w-0">
            <p className="mb-2 inline-flex rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)] ring-1 ring-emerald-100">
              {isAuthenticated
                ? isId
                  ? 'Workspace bisnismu'
                  : 'Your business workspace'
                : isId
                  ? 'Sourcing dan operasional'
                  : 'Sourcing and operations'}
            </p>
            <h1 className="max-w-[22ch] text-[1.78rem] font-semibold leading-[1.04] tracking-[-0.045em] text-[color:var(--app-text)] xl:text-[2rem]">
              {isAuthenticated
                ? isId
                  ? 'Lanjut di '
                  : 'Continue your business flow on '
                : isId
                  ? 'Cari kebutuhan usaha di '
                  : 'Everything your business needs is on '}
              <span className="text-[color:var(--app-accent)]">Lajukan</span>
            </h1>
            <p className="mt-3 max-w-[37rem] text-[13px] leading-6 text-[color:var(--app-text-soft)]">
              {isAuthenticated
                ? isId
                  ? 'Chat, transaksi, dan kebutuhan aktif.'
                  : 'Track offers, create new needs, and continue supplier chats from one compact page.'
                : isId
                  ? 'Cari. Pilih. Chat. Deal aman.'
                  : 'Find suppliers, products, services, places, talent, and business opportunities in one flow.'}
            </p>
          </div>
        </div>

        <div className="mt-3 grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-center">
          <SearchInput
            value={query}
            onValueChange={onQueryChange}
            onSearch={onSubmit}
            placeholder={placeholder}
            buttonLabel={buttonLabel}
            layout="row"
            variant="hero"
            ariaLabel={isId ? 'Cari kebutuhan usaha' : 'Search business needs'}
            inputAriaLabel={isId ? 'Kata kunci pencarian' : 'Search keyword'}
            testId="home-hero-search-form"
            inputTestId="home-hero-search-input"
          />
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <Link
              href={primaryCtaHref}
              className="inline-flex min-h-[40px] items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-xs font-semibold text-[color:var(--app-text-inverse)]"
            >
              {isAuthenticated
                ? isId
                  ? 'Buat Permintaan'
                  : 'Create Request'
                : isId
                  ? 'Daftar Gratis'
                  : 'Join Free'}
            </Link>
            <Link
              href={isAuthenticated ? '/dashboard' : UMKM_DISCOVERY_PATH}
              className="inline-flex min-h-[40px] items-center justify-center rounded-[14px] border border-[color:var(--app-border)] bg-white px-4 text-xs font-semibold text-[color:var(--app-text)]"
            >
              {isAuthenticated
                ? isId
                  ? 'Dashboard'
                  : 'Open Dashboard'
                : isId
                  ? 'Jelajah'
                  : 'Explore Platform'}
            </Link>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-[color:var(--app-text-soft)]">
            {isId ? 'Populer:' : 'Popular:'}
          </span>
          {HERO_TAGS.map(tag => (
            <Link
              key={tag}
              href={`/search?q=${encodeURIComponent(tag)}`}
              className="inline-flex min-h-0 items-center rounded-full border border-[color:var(--app-border)] bg-white px-2.5 py-1 text-[10px] font-medium text-[color:var(--app-text-soft)]"
            >
              {tag}
            </Link>
          ))}
        </div>
      </section>
      <MobileHeroVisualBanner
        isId={isId}
        metrics={metrics}
        className="mt-3 xl:hidden"
      />
      <HeroVisualStage metrics={metrics} className="mt-3 hidden xl:block" />
    </div>
  );
}

function MobileHeroSection({
  isId,
  isAuthenticated,
  summary,
}: {
  isId: boolean;
  isAuthenticated: boolean;
  summary: LajukanSummary | null;
}) {
  const metrics = getHeroMetrics(isId, summary);

  return (
    <div>
      <MobileHeroVisualBanner
        isId={isId}
        metrics={metrics}
        className="mb-2.5"
      />
      <section className="overflow-hidden rounded-[26px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_8%)] bg-[linear-gradient(145deg,#ffffff_0%,#f8fcff_48%,#eefbf2_100%)] p-4 shadow-[0_20px_42px_-36px_rgba(15,23,42,0.18)]">
        <div className="min-w-0">
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
            {isAuthenticated
              ? isId
                ? 'Workspace bisnismu'
                : 'Your workspace'
              : isId
                ? 'Mulai'
                : 'Start here'}
          </p>
          <h1 className="max-w-[18ch] text-[1.36rem] font-semibold leading-[1.05] tracking-[-0.04em] text-[color:var(--app-text)]">
            {isAuthenticated
              ? isId
                ? 'Lanjutkan bisnis di '
                : 'Continue on '
              : isId
                ? 'Semua kebutuhan usaha di '
                : 'Business essentials on '}
            <span className="text-[color:var(--app-accent)]">Lajukan</span>
          </h1>
          <p className="mt-1.5 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
            {isAuthenticated
              ? isId
                ? 'Chat, transaksi, peluang.'
                : 'Track chats, transactions, and new opportunities without wasted space.'
              : isId
                ? 'Cari supplier, lokasi, jasa, talent.'
                : 'Find suppliers, places, services, and talent for your business.'}
          </p>
        </div>
      </section>
    </div>
  );
}

function GameProgressCard({
  isId,
  isAuthenticated,
  summary,
  walletAmountLabel,
  walletModeLabel,
  walletLoading = false,
  compact = false,
}: {
  isId: boolean;
  isAuthenticated: boolean;
  summary: LajukanSummary | null;
  walletAmountLabel?: string | null;
  walletModeLabel?: string | null;
  walletLoading?: boolean;
  compact?: boolean;
}) {
  if (!isAuthenticated) {
    return (
      <section
        className={cn(
          'relative overflow-hidden rounded-[20px] border border-emerald-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f7fff9_58%,#ecfdf5_100%)] text-[color:var(--app-text)] shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] dark:border-emerald-900/70 dark:bg-[linear-gradient(135deg,#07120f_0%,#0b1b16_62%,#10251e_100%)] dark:text-white',
          compact ? 'p-2.5' : 'p-3',
        )}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-200/55 blur-3xl dark:bg-emerald-500/10" />
        <div className="relative flex min-w-0 items-start gap-2.5">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[linear-gradient(135deg,#059669,#047857)] text-white shadow-[0_14px_26px_-18px_rgba(4,120,87,0.85)]">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black leading-5 text-[color:var(--app-text)] dark:text-white">
              {isId ? 'Masuk untuk mulai level' : 'Login to start your level'}
            </p>
            <p className="mt-1 text-[12px] font-semibold leading-5 text-[color:var(--app-text-soft)] dark:text-white/64">
              {isId
                ? 'Cari tetap bisa. XP, streak, saldo, chat, dan transaksi baru tersimpan setelah login.'
                : 'Browsing stays open. XP, streak, wallet, chats, and deals are saved after login.'}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link
                href="/login"
                className="ui-pressable inline-flex min-h-9 items-center justify-center rounded-[12px] border border-emerald-200 bg-white px-3 text-[12px] font-black text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-400/20 dark:bg-white/[0.08] dark:text-emerald-100 dark:hover:bg-white/[0.12]"
              >
                {isId ? 'Masuk' : 'Login'}
              </Link>
              <Link
                href="/register"
                className="ui-pressable inline-flex min-h-9 items-center justify-center rounded-[12px] bg-[color:var(--app-accent)] px-3 text-[12px] font-black text-white shadow-[0_12px_22px_-17px_rgba(4,120,87,0.82)] transition hover:bg-[color:var(--app-accent-strong)]"
              >
                {isId ? 'Daftar' : 'Join'}
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const snapshot = buildGameSnapshot(isId, isAuthenticated, summary);
  const activeQuest =
    snapshot.quests.find(quest => quest.progress < 100) ?? snapshot.quests[0];
  const ActiveQuestIcon = activeQuest.icon;
  const amountLabel = walletAmountLabel || formatCurrencyFromCents(0, 'IDR');

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[20px] border border-emerald-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f7fff9_58%,#ecfdf5_100%)] text-[color:var(--app-text)] shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] dark:border-emerald-900/70 dark:bg-[linear-gradient(135deg,#07120f_0%,#0b1b16_62%,#10251e_100%)] dark:text-white',
        compact ? 'p-2.5' : 'p-3',
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-200/55 blur-3xl dark:bg-emerald-500/10" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/80 dark:bg-white/10" />
      <div className="relative">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center gap-1 rounded-[15px] bg-[linear-gradient(135deg,#059669,#047857)] text-white shadow-[0_14px_26px_-18px_rgba(4,120,87,0.85)]">
            <Trophy className="h-4 w-4 text-amber-200" />
            <span className="text-sm font-black leading-none text-white">
              {snapshot.level}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="truncate text-sm font-black leading-5 text-[color:var(--app-text)] dark:text-white">
                {isId ? 'Arena level' : 'Level arena'}
              </p>
              <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/12 dark:text-amber-100">
                {snapshot.rank}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-emerald-100 dark:bg-white/12">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#10b981,#34d399,#fbbf24)]"
                  style={{ width: `${snapshot.xpPercent}%` }}
                />
              </div>
              <span className="shrink-0 text-[10px] font-black text-emerald-700 dark:text-emerald-100">
                {snapshot.xp}/{snapshot.xpGoal}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-2 flex min-w-0 items-center gap-2 rounded-[15px] border border-emerald-100 bg-white/90 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-white/10 dark:bg-white/[0.08]">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-100">
            <CreditCard className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="text-[10px] font-black uppercase leading-3 text-[color:var(--app-text-soft)] dark:text-white/62">
                {isId ? 'Saldo' : 'Balance'}
              </p>
              {walletModeLabel ? (
                <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black leading-none text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-100">
                  {walletModeLabel}
                </span>
              ) : null}
            </div>
            {walletLoading ? (
              <span className="mt-1 block h-4 w-24 animate-pulse rounded-full bg-emerald-100 dark:bg-white/15" />
            ) : (
              <p className="truncate text-[0.92rem] font-black leading-5 text-[color:var(--app-text)] dark:text-white">
                {amountLabel}
              </p>
            )}
          </div>
          <Link
            href="/payments"
            className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-[12px] bg-[color:var(--app-accent)] px-3 text-[11px] font-black text-white shadow-[0_12px_22px_-17px_rgba(4,120,87,0.82)] transition hover:bg-[color:var(--app-accent-strong)]"
          >
            Top up
          </Link>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <div className="min-w-[92px] flex-1 basis-[calc(50%-0.1875rem)] rounded-[13px] border border-slate-200/75 bg-white/[0.88] px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.08]">
            <p className="flex items-center gap-1 text-[10px] font-black text-[color:var(--app-text)] dark:text-white">
              <Flame className="h-3 w-3 text-orange-500 dark:text-orange-200" />
              {snapshot.streak}x
            </p>
            <p className="truncate text-[10px] font-semibold text-[color:var(--app-text-soft)] dark:text-white/58">
              streak
            </p>
          </div>
          <div className="min-w-[92px] flex-1 basis-[calc(50%-0.1875rem)] rounded-[13px] border border-slate-200/75 bg-white/[0.88] px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.08]">
            <p className="flex items-center gap-1 text-[10px] font-black text-[color:var(--app-text)] dark:text-white">
              <Zap className="h-3 w-3 text-amber-500 dark:text-amber-200" />
              {snapshot.nextReward}
            </p>
            <p className="truncate text-[10px] font-semibold text-[color:var(--app-text-soft)] dark:text-white/58">
              reward
            </p>
          </div>
          <Link
            href={activeQuest.href}
            className="min-w-0 flex-[1_1_100%] rounded-[13px] border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-800 shadow-[0_12px_20px_-18px_rgba(15,23,42,0.35)] transition hover:bg-emerald-100 dark:border-emerald-400/20 dark:bg-emerald-400/12 dark:text-emerald-100 dark:hover:bg-emerald-400/18"
          >
            <p className="flex min-w-0 items-center gap-1 text-[10px] font-black">
              <ActiveQuestIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{activeQuest.label}</span>
            </p>
            <p className="truncate text-[10px] font-semibold text-emerald-700/75 dark:text-emerald-100/70">
              {activeQuest.xp}
            </p>
          </Link>
        </div>
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
  const exploreItems: QuickCategory[] = [
    ...categories,
    {
      id: 'all',
      label: isId ? 'Lihat Semua' : 'See all',
      description: isId ? 'Buka semua kategori' : 'Open every category',
      href: UMKM_DISCOVERY_PATH,
      icon: LayoutGrid,
      tone: 'blue',
      countLabel: isId ? 'Semua' : 'All',
    },
  ];

  if (mobile) {
    return (
      <section className="overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-white p-3.5 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.12)]">
        <div className="flex items-center gap-2.5 px-0.5 pb-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-emerald-100 bg-emerald-50 text-emerald-600">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[1.08rem] font-black tracking-[-0.035em] text-[color:var(--app-text)]">
              {isId ? 'Jelajahi kategori' : 'Explore categories'}
            </p>
            <p className="mt-0.5 text-xs font-semibold leading-4 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Cari kebutuhan usaha tanpa ribet.'
                : 'Find business needs fast.'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {exploreItems.map(item => {
            const tone = toneClassNames(item.tone);
            const isAll = item.id === 'all';
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-label={`${item.label}: ${item.description}`}
                className={cn(
                  'group relative flex min-h-[106px] flex-col items-center justify-center overflow-hidden rounded-[18px] border px-1.5 py-2 text-center transition active:scale-[0.98]',
                  isAll
                    ? 'border-[color:var(--app-accent-border)] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] text-white shadow-[0_16px_30px_-22px_rgba(22,163,74,0.56)]'
                    : tone.card,
                )}
              >
                <span
                  className={cn(
                    'absolute -right-5 -top-5 h-20 w-20 rounded-full blur-xl transition group-hover:scale-125',
                    isAll ? 'bg-white/28' : tone.glow,
                  )}
                />
                <span
                  className={cn(
                    'relative inline-flex h-11 w-11 items-center justify-center rounded-[15px] bg-white/88 shadow-[0_14px_24px_-20px_rgba(15,23,42,0.36)] ring-1 ring-white/70',
                    isAll
                      ? 'text-[color:var(--app-accent)]'
                      : [tone.surface, tone.text],
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={cn(
                    'relative mt-2 line-clamp-2 max-w-full text-[11.5px] font-black leading-[1.1]',
                    isAll ? 'text-white' : 'text-[color:var(--app-text)]',
                  )}
                >
                  {item.label}
                </span>
                <span
                  className={cn(
                    'relative mt-1 max-w-full truncate text-[9.5px] font-bold leading-3',
                    isAll
                      ? 'text-white/80'
                      : 'text-[color:var(--app-text-soft)]',
                  )}
                >
                  {item.countLabel}
                </span>
                {isAll ? (
                  <ChevronRight className="absolute bottom-2 right-2 h-3.5 w-3.5 text-white/86" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-white p-3.5 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
      <div>
        <div className="flex items-center gap-3 rounded-[20px] bg-[linear-gradient(135deg,#ffffff,#f8fbff_60%,#effdf5)] p-3.5">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-emerald-100 bg-emerald-50 text-emerald-600">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[1.12rem] font-black tracking-[-0.035em] text-[color:var(--app-text)]">
              {isId ? 'Jelajahi kategori' : 'Explore categories'}
            </p>
            <p className="mt-1 text-[13px] font-semibold leading-5 text-[color:var(--app-text-soft)]">
              {isId ? 'Cari cepat. Lanjut chat.' : 'Find what you need faster.'}
            </p>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-1">
          {exploreItems.map(item => {
            const tone = toneClassNames(item.tone);
            const isAll = item.id === 'all';
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-label={`${item.label}: ${item.description}`}
                className={cn(
                  'group relative min-h-[142px] overflow-hidden rounded-[18px] border p-2.5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.2)]',
                  isAll
                    ? 'border-[color:var(--app-accent-border)] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] text-white shadow-[0_18px_34px_-28px_rgba(22,163,74,0.38)]'
                    : tone.card,
                )}
              >
                <span
                  className={cn(
                    'absolute -right-7 -top-7 h-16 w-16 rounded-full blur-2xl transition group-hover:scale-125',
                    isAll ? 'bg-white/24' : tone.glow,
                  )}
                />
                <div className="relative flex h-full flex-col items-center text-center">
                  <span
                    className={cn(
                      'inline-flex h-14 w-14 items-center justify-center rounded-[17px] border bg-white/88 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.28)]',
                      isAll
                        ? 'border-white/35 text-[color:var(--app-accent)]'
                        : [tone.surface, tone.text],
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <p
                    className={cn(
                      'mt-2.5 w-full truncate text-[0.92rem] font-black leading-5 tracking-[-0.025em]',
                      isAll ? 'text-white' : 'text-[color:var(--app-text)]',
                    )}
                  >
                    {item.label}
                  </p>
                  <p
                    className={cn(
                      'mt-1 line-clamp-2 text-[12px] font-medium leading-4',
                      isAll
                        ? 'text-white/82'
                        : 'text-[color:var(--app-text-soft)]',
                    )}
                  >
                    {item.description}
                  </p>
                  <span
                    className={cn(
                      'mt-auto inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black',
                      isAll
                        ? 'bg-white/20 text-white'
                        : 'bg-white/76 text-[color:var(--app-text-soft)]',
                    )}
                  >
                    {item.countLabel}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RecommendationCard({
  item,
  isId,
  mobile = false,
}: {
  item: RecommendationItem;
  isId: boolean;
  mobile?: boolean;
}) {
  const badgeTone = toneClassNames(item.badgeTone || 'emerald');
  const favoriteHref = `/login?callbackUrl=${encodeURIComponent(item.href)}`;

  return (
    <article
      className={cn(
        'flex h-full shrink-0 snap-start flex-col overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-white shadow-[0_16px_30px_-28px_rgba(15,23,42,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.2)]',
        mobile
          ? 'w-[222px] min-w-[222px] max-w-[222px]'
          : 'w-[238px] min-w-[238px] max-w-[238px] sm:w-[248px] sm:min-w-[248px] sm:max-w-[248px] xl:w-[260px] xl:min-w-[260px] xl:max-w-[260px]',
      )}
      data-testid="home-recommendation-card"
    >
      <div className="relative h-32 overflow-hidden sm:h-36">
        <Link
          href={item.href}
          className="block h-full"
          aria-label={`${isId ? 'Buka detail' : 'Open detail'} ${item.title}`}
        >
          {item.image ? (
            <Image
              src={item.image}
              alt={item.title}
              fill
              className="object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center bg-[color:var(--app-surface-muted)] text-[color:var(--app-accent)]">
              <Package className="h-9 w-9" />
            </span>
          )}
        </Link>
        {item.badge ? (
          <span
            className={cn(
              'absolute left-3 top-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold',
              badgeTone.soft,
            )}
          >
            {item.badge}
          </span>
        ) : null}
        <span className="absolute bottom-2.5 left-3 inline-flex rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-black uppercase text-[color:var(--app-accent)] shadow-[0_12px_22px_-18px_rgba(15,23,42,0.22)]">
          {item.typeLabel}
        </span>
        <Link
          href={favoriteHref}
          className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/92 text-[color:var(--app-text)] shadow-[0_12px_22px_-18px_rgba(15,23,42,0.22)] transition hover:text-rose-500"
          aria-label={isId ? `Simpan ${item.title}` : `Save ${item.title}`}
        >
          <Heart className="h-4 w-4" />
        </Link>
      </div>
      <Link href={item.href} className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col p-3">
          <h3 className="line-clamp-3 min-h-[3.25rem] break-words text-[0.9rem] font-bold leading-[1.2] text-[color:var(--app-text)]">
            {item.title}
          </h3>
          {item.vendor ? (
            <p className="mt-1 truncate text-xs text-[color:var(--app-text-soft)]">
              {item.vendor}
            </p>
          ) : null}
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[color:var(--app-text-soft)]">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-amber-500">{item.rating}</span>
            <span>({item.reviews})</span>
          </div>
          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <div className="min-w-0">
              <p className="truncate text-[1rem] font-black tracking-[-0.04em] text-[color:var(--app-accent)]">
                {item.price}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-[color:var(--app-text-soft)]">
                {item.unit || item.location}
              </p>
            </div>
            {item.unit ? (
              <p className="min-w-0 max-w-[6.5rem] truncate text-right text-[11px] text-[color:var(--app-text-soft)]">
                {item.location}
              </p>
            ) : null}
          </div>
        </div>
      </Link>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-3 pb-3">
        <Link
          href={item.href}
          className="inline-flex min-h-[34px] items-center justify-center rounded-[12px] bg-[color:var(--app-surface-muted)] px-3 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]"
        >
          {isId ? 'Detail' : 'Detail'}
        </Link>
        <Link
          href={item.createHref}
          className="inline-flex min-h-[34px] items-center justify-center rounded-[12px] bg-[color:var(--app-accent)] px-3 text-[11px] font-semibold text-[color:var(--app-text-inverse)] transition hover:bg-[color:var(--app-accent-strong)]"
        >
          {isId ? 'Buat serupa' : 'Create similar'}
        </Link>
      </div>
    </article>
  );
}

function RecommendationsSection({
  isId,
  items,
  mobile = false,
}: {
  isId: boolean;
  items: RecommendationItem[];
  mobile?: boolean;
}) {
  return (
    <section className="space-y-3" data-testid="home-recommendations-section">
      <SectionHeading
        title={isId ? 'Rekomendasi untuk Usaha' : 'Recommended for Business'}
        actionLabel={isId ? 'Lihat semua' : 'See all'}
        actionHref={UMKM_DISCOVERY_PATH}
      />
      {items.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-[color:var(--app-border)] bg-white px-4 py-5 text-sm font-semibold text-[color:var(--app-text-soft)]">
          {isId
            ? 'Belum ada listing aktif dari database.'
            : 'No active database listings yet.'}
        </div>
      ) : null}
      {mobile ? (
        <div
          className="flex max-w-full snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 pr-1"
          data-auto-scrollbar
          data-testid="home-recommendations-rail"
        >
          {items.map(item => (
            <RecommendationCard key={item.id} item={item} isId={isId} mobile />
          ))}
        </div>
      ) : (
        <div
          className="flex max-w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-1"
          data-auto-scrollbar
          data-testid="home-recommendations-rail"
        >
          {items.map(item => (
            <RecommendationCard key={item.id} item={item} isId={isId} />
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
  posts,
  mobile = false,
}: {
  isId: boolean;
  activeTab: CommunityTab;
  onTabChange: (tab: CommunityTab) => void;
  avatarSrc: string;
  posts: CommunityPost[];
  mobile?: boolean;
}) {
  const router = useRouter();
  const tabs = getCommunityTabs(isId);
  const post = posts.find(item => item.tab === activeTab) || posts[0] || null;
  const communityPostHref = post ? buildCommunityPostHref(post) : '/community';
  const openCommunityPost = () => router.push(communityPostHref);

  return (
    <section className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-3.5 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)] sm:p-4">
      <SectionHeading
        title={isId ? 'Dari Komunitas' : 'From the Community'}
        actionLabel={isId ? 'Lihat semua' : 'See all'}
        actionHref="/community"
      />
      <div
        className="mt-3 flex items-center gap-4 overflow-x-auto border-b border-[color:var(--app-border)] pb-1.5"
        data-auto-scrollbar
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative shrink-0 pb-1.5 text-xs font-semibold transition',
              activeTab === tab.id
                ? 'text-[color:var(--app-accent)]'
                : 'text-[color:var(--app-text-soft)]',
            )}
          >
            {tab.label}
            {activeTab === tab.id ? (
              <span className="absolute inset-x-0 -bottom-[9px] h-[3px] rounded-full bg-[color:var(--app-accent)]" />
            ) : null}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-[20px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,#ffffff,#fbfffd)] p-3">
        <div className="flex items-center gap-2.5">
          <Image
            src={avatarSrc}
            alt="Profile"
            width={36}
            height={36}
            className="h-9 w-9 rounded-full object-cover"
          />
          <Link
            href="/community?compose=post"
            className="flex min-h-[40px] flex-1 items-center rounded-full bg-slate-50 px-3 text-xs text-[color:var(--app-text-soft)]"
          >
            {isId
              ? 'Apa yang sedang Anda pikirkan?'
              : 'What are you thinking about?'}
          </Link>
        </div>
        <div
          className={cn(
            'mt-3 grid gap-2',
            mobile
              ? 'grid-cols-2 sm:grid-cols-4'
              : 'grid-cols-2 lg:grid-cols-4',
          )}
        >
          {COMPOSER_ACTIONS.map(action => {
            const Icon = action.icon;
            const tone = toneClassNames(action.tone);

            return (
              <Link
                key={action.id}
                href={action.href}
                className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[13px] border border-[color:var(--app-border)] bg-white px-2.5 text-xs font-medium text-[color:var(--app-text-soft)]"
              >
                <Icon className={cn('h-4.5 w-4.5', tone.soft)} />
                {action.label}
              </Link>
            );
          })}
        </div>
      </div>
      {post ? (
        <article
          role="link"
          tabIndex={0}
          onClick={event => {
            const target = event.target as HTMLElement;
            if (target.closest('a,button')) return;
            openCommunityPost();
          }}
          onKeyDown={event => {
            if (event.key !== 'Enter') return;
            openCommunityPost();
          }}
          className="mt-3 cursor-pointer overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-white shadow-[0_16px_30px_-28px_rgba(15,23,42,0.13)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.18)]"
        >
          <div className="p-3.5 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {post.avatar ? (
                  <Image
                    src={post.avatar}
                    alt={post.author}
                    width={44}
                    height={44}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]">
                    <UserRound className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[0.95rem] font-bold tracking-[-0.03em] text-[color:var(--app-text)]">
                    {post.author}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-[color:var(--app-text-soft)]">
                    {post.community} - {post.time}
                    <Globe2 className="h-3.5 w-3.5" />
                  </p>
                </div>
              </div>
              <Link
                href={communityPostHref}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--app-text-soft)]"
                aria-label="Open community options"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Link>
            </div>
            <Link
              href={communityPostHref}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--app-accent)]"
            >
              <Users className="h-3.5 w-3.5" />
              {post.community}
            </Link>
            <h3 className="mt-3 text-[0.98rem] font-bold leading-5 text-[color:var(--app-text)]">
              {post.title}
            </h3>
            <p className="mt-2 line-clamp-3 text-sm leading-5 text-[color:var(--app-text)]">
              {post.body}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.map(tag => (
                <Link
                  key={tag}
                  href={`/community?tag=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold text-[color:var(--app-text-soft)]"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
          {post.image ? (
            <Link
              href={communityPostHref}
              className="relative block h-[140px] sm:h-[190px]"
            >
              <Image
                src={post.image}
                alt={post.community}
                fill
                className="object-cover"
              />
            </Link>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--app-border)] px-4 py-2.5 text-xs text-[color:var(--app-text-soft)]">
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-white">
                <ThumbsUp className="h-3.5 w-3.5" />
              </span>
              {post.likes}
            </span>
            <span>
              {post.comments} {isId ? 'komentar' : 'comments'} - {post.shares}{' '}
              {isId ? 'bagikan' : 'shares'}
            </span>
          </div>
          <div className="grid grid-cols-3 border-t border-[color:var(--app-border)] px-2 py-1.5 text-xs font-semibold text-[color:var(--app-text-soft)]">
            <Link
              href={communityPostHref}
              className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[12px] hover:bg-slate-50"
            >
              <ThumbsUp className="h-4 w-4" />
              {isId ? 'Suka' : 'Like'}
            </Link>
            <Link
              href={communityPostHref}
              className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[12px] hover:bg-slate-50"
            >
              <MessageCircle className="h-4 w-4" />
              {isId ? 'Komentar' : 'Comment'}
            </Link>
            <Link
              href={communityPostHref}
              className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[12px] hover:bg-slate-50"
            >
              <Share2 className="h-4 w-4" />
              {isId ? 'Bagikan' : 'Share'}
            </Link>
          </div>
        </article>
      ) : (
        <div className="mt-3 rounded-[20px] border border-dashed border-[color:var(--app-border)] bg-white px-4 py-5 text-sm font-semibold text-[color:var(--app-text-soft)]">
          {isId
            ? 'Belum ada posting komunitas dari database.'
            : 'No community database posts yet.'}
        </div>
      )}
      <div className="mt-4 flex items-center justify-end">
        <Link
          href={communityPostHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--app-accent)]"
        >
          {isId ? 'Lihat semua diskusi' : 'See all discussions'}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function ReelsPanel({
  isId,
  items,
  mobile = false,
}: {
  isId: boolean;
  items: ReelItem[];
  mobile?: boolean;
}) {
  return (
    <section className="space-y-3" data-testid="home-reels-section">
      <SectionHeading
        title={isId ? 'Reels Inspirasi' : 'Inspiration Reels'}
        actionLabel={isId ? 'Lihat semua' : 'See all'}
        actionHref="/reels"
      />
      {items.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-[color:var(--app-border)] bg-white px-4 py-5 text-sm font-semibold text-[color:var(--app-text-soft)]">
          {isId ? 'Belum ada reels dari database.' : 'No database reels yet.'}
        </div>
      ) : null}
      {mobile ? (
        <div
          className="flex max-w-full snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 pr-1"
          data-auto-scrollbar
          data-testid="home-reels-rail"
        >
          {items.map(item => (
            <Link
              key={item.id}
              href={item.href}
              className="group relative min-h-[220px] w-[174px] min-w-[174px] max-w-[174px] shrink-0 snap-start overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-slate-950 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.22)]"
              data-testid="home-reel-card"
            >
              {item.mediaUrl && item.mediaType !== 'image' ? (
                <video
                  src={item.mediaUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              ) : item.mediaUrl ? (
                <Image
                  src={item.mediaUrl}
                  alt={item.title}
                  fill
                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,#14532d,#020617)] text-white">
                  <PlayCircle className="h-10 w-10" />
                </span>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                {item.category}
              </span>
              <div className="absolute inset-x-4 bottom-4">
                <p className="line-clamp-3 text-sm font-semibold leading-5 text-white">
                  {item.title}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-white/80">
                  <span>{item.views}</span>
                  <PlayCircle className="h-5 w-5 text-white" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div
          className="flex max-w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-1"
          data-auto-scrollbar
          data-testid="home-reels-rail"
        >
          {items.map(item => (
            <Link
              key={item.id}
              href={item.href}
              className="group relative min-h-[250px] w-[172px] min-w-[172px] max-w-[172px] shrink-0 snap-start overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-slate-950 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.22)] xl:w-[186px] xl:min-w-[186px] xl:max-w-[186px]"
              data-testid="home-reel-card"
            >
              {item.mediaUrl && item.mediaType !== 'image' ? (
                <video
                  src={item.mediaUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              ) : item.mediaUrl ? (
                <Image
                  src={item.mediaUrl}
                  alt={item.title}
                  fill
                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,#14532d,#020617)] text-white">
                  <PlayCircle className="h-10 w-10" />
                </span>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
              <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                {item.category}
              </span>
              <div className="absolute inset-x-4 bottom-4">
                <p className="text-sm font-semibold leading-5 text-white">
                  {item.title}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-white/80">
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
  walletAmountLabel,
  walletModeLabel,
  walletLoading,
}: {
  isId: boolean;
  isAuthenticated: boolean;
  summary: LajukanSummary | null;
  primaryCtaHref: string;
  walletAmountLabel?: string | null;
  walletModeLabel?: string | null;
  walletLoading?: boolean;
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const pulseItems = [
    {
      id: 'verified',
      label: isId ? 'Supplier siap' : 'Verified suppliers',
      value: resolveCountLabel(summary?.stores?.verified, '6'),
      icon: ShieldCheck,
      tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60',
    },
    {
      id: 'cities',
      label: isId ? 'Kota aktif' : 'Active cities',
      value: resolveCountLabel(summary?.stores?.cities, '10'),
      icon: MapPin,
      tone: 'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900/60',
    },
    {
      id: 'requests',
      label: isId ? 'Permintaan aktif' : 'Active requests',
      value: resolveCountLabel(summary?.requests?.active, '2'),
      icon: ClipboardList,
      tone: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60',
    },
  ];
  const benefitPoints = isId
    ? ['Semua fitur', 'Nego langsung', 'Transaksi aman', 'Jaringan luas']
    : [
        'Unlock every Lajukan feature',
        'Negotiate directly with suppliers',
        'Safer and trusted transactions',
        'Build a wider business network',
      ];
  const slideCount = 2;

  useEffect(() => {
    let timer: number | null = null;

    const stopTimer = () => {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
    };

    const startTimer = () => {
      if (timer !== null || document.visibilityState === 'hidden') return;
      timer = window.setInterval(() => {
        setActiveSlide(current => (current + 1) % slideCount);
      }, 5200);
    };

    const syncTimer = () => {
      if (document.visibilityState === 'hidden') {
        stopTimer();
      } else {
        startTimer();
      }
    };

    startTimer();
    document.addEventListener('visibilitychange', syncTimer);

    return () => {
      document.removeEventListener('visibilitychange', syncTimer);
      stopTimer();
    };
  }, [slideCount]);

  const goToSlide = (nextIndex: number) => {
    setActiveSlide((nextIndex + slideCount) % slideCount);
  };

  return (
    <aside className="lajukan-home-right-rail hidden xl:block xl:min-h-0 xl:pt-2">
      <div
        className="lajukan-home-right-rail-scroll flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3 pl-4 overscroll-contain"
        data-auto-scrollbar
      >
        <GameProgressCard
          isId={isId}
          isAuthenticated={isAuthenticated}
          summary={summary}
          walletAmountLabel={walletAmountLabel}
          walletModeLabel={walletModeLabel}
          walletLoading={walletLoading}
          compact
        />
        <section className="lajukan-home-pulse-card flex max-h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-white shadow-[0_18px_36px_-32px_rgba(15,23,42,0.14)]">
          <div className="lajukan-home-pulse-header flex items-center justify-between border-b border-[color:var(--app-border)] px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]">
                {activeSlide === 0 ? (
                  <BarChart3 className="h-4 w-4" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                  {activeSlide === 0
                    ? isId
                      ? 'Pasar Hari Ini'
                      : 'Marketplace Pulse'
                    : isId
                      ? 'Panel Growth'
                      : 'Growth Panel'}
                </p>
                <p className="lajukan-home-pulse-header-subtitle mt-0.5 truncate text-xs text-[color:var(--app-text-soft)]">
                  {activeSlide === 0
                    ? isId
                      ? 'Ringkasan pasar terkini'
                      : 'Current marketplace snapshot'
                    : isId
                      ? 'Dorong reach dan peluang baru'
                      : 'Push reach and unlock new opportunities'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToSlide(activeSlide - 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-text)]"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => goToSlide(activeSlide + 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-text)]"
                aria-label="Next slide"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className="lajukan-home-pulse-track flex w-full transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${activeSlide * 100}%)` }}
          >
            <div className="lajukan-home-pulse-slide w-full shrink-0 p-4">
              <div className="lajukan-home-pulse-list space-y-2.5">
                {pulseItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className="lajukan-home-pulse-row flex items-center justify-between gap-3 rounded-[16px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,#ffffff,#fbfffd)] px-3 py-2.5"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1',
                            item.tone,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="truncate text-xs font-semibold text-[color:var(--app-text)]">
                          {item.label}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-black tracking-[-0.03em] text-[color:var(--app-text)]">
                        {item.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lajukan-home-pulse-slide lajukan-home-pulse-growth w-full shrink-0 bg-[linear-gradient(180deg,#f4fff8_0%,#ffffff_62%,#eefbf4_100%)] p-4">
              <h2 className="lajukan-home-pulse-title text-[1.18rem] font-black leading-tight tracking-[-0.045em] text-[color:var(--app-text)]">
                {isAuthenticated
                  ? isId
                    ? 'Naikkan jangkauan, dapatkan lebih banyak peluang'
                    : 'Increase reach and unlock more opportunities'
                  : isId
                    ? 'Gabung sekarang, dapatkan lebih banyak peluang'
                    : 'Join now and unlock more opportunities'}
              </h2>
              <ul className="lajukan-home-pulse-benefits mt-4 space-y-2.5">
                {benefitPoints.map(point => (
                  <li
                    key={point}
                    className="lajukan-home-pulse-benefit flex items-start gap-2.5 text-xs leading-5 text-[color:var(--app-text-soft)]"
                  >
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <ShieldCheck className="h-3 w-3" />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <Link
                href={primaryCtaHref}
                className="lajukan-home-pulse-cta mt-4 inline-flex min-h-[40px] w-full items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-xs font-semibold text-[color:var(--app-text-inverse)]"
              >
                {isAuthenticated
                  ? isId
                    ? 'Buat Permintaan'
                    : 'Create Request'
                  : isId
                    ? 'Daftar Gratis'
                    : 'Join Free'}
              </Link>
              <div className="lajukan-home-pulse-visual relative mt-4 flex h-32 items-center justify-center rounded-[22px] bg-[radial-gradient(circle_at_top,#ddffe9,transparent_64%)]">
                <div className="lajukan-home-pulse-visual-glow absolute h-20 w-20 rounded-full bg-emerald-100 blur-3xl" />
                <div className="lajukan-home-pulse-visual-icon relative flex h-20 w-20 items-center justify-center rounded-[22px] border border-emerald-200 bg-white shadow-[0_18px_32px_-24px_rgba(15,23,42,0.16)]">
                  <Gift className="lajukan-home-pulse-gift h-10 w-10 text-emerald-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="lajukan-home-pulse-dots flex items-center justify-center gap-2 border-t border-[color:var(--app-border)] px-4 py-3">
            {Array.from({ length: slideCount }).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goToSlide(index)}
                className={cn(
                  'h-2.5 rounded-full transition',
                  activeSlide === index
                    ? 'w-6 bg-emerald-500'
                    : 'w-2.5 bg-slate-200',
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
    <MarketplacePageFrame
      loading
      shellClassName="h-full max-w-[1480px] px-4 py-4"
    >
      <div
        className="mt-4 grid min-h-0 gap-4 lg:h-[calc(100%-5rem)] lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_260px] 2xl:grid-cols-[280px_minmax(0,1fr)_280px]"
        data-skeleton-route="true"
      >
        <div className="ui-skeleton ui-skeleton-pulse hidden h-[540px] rounded-[24px] lg:block" />
        <div className="min-h-0 space-y-4 overflow-hidden">
          <div className="ui-skeleton ui-skeleton-pulse h-[248px] rounded-[24px]" />
          <div className="ui-skeleton ui-skeleton-pulse h-[142px] rounded-[24px]" />
          <div className="ui-skeleton ui-skeleton-pulse h-[260px] rounded-[24px]" />
          <div className="ui-skeleton ui-skeleton-pulse h-[420px] rounded-[24px]" />
        </div>
        <div className="ui-skeleton ui-skeleton-pulse hidden h-[430px] rounded-[24px] xl:block" />
      </div>
    </MarketplacePageFrame>
  );
}

export function HomeResponsiveMarketplace({ locale }: HomeContentSimpleProps) {
  const isId = (locale || 'id') === 'id';
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, loading: authLoading, authFetch } = useAuth();
  const { totalUnread } = useChatInbox();
  const [query, setQuery] = useState('');
  const [summary, setSummary] = useState<LajukanSummary | null>(null);
  const [activeTab, setActiveTab] = useState<CommunityTab>('for-you');
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
    [],
  );
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [walletAmountLabel, setWalletAmountLabel] = useState(() =>
    formatCurrencyFromCents(0, 'IDR'),
  );
  const [walletModeLabel, setWalletModeLabel] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  useEffect(() => {
    let active = true;
    let idleId: number | null = null;
    let timeoutId: number | null = null;

    const loadSummary = async () => {
      try {
        const response = await fetch('/api/lajukan/summary', {
          cache: 'no-store',
          credentials: 'include',
        });
        const payload = (await response
          .json()
          .catch(() => ({}))) as LajukanSummaryResponse;

        if (active && response.ok && payload.data) {
          setSummary(payload.data);
        }
      } catch {
        if (!active) return;
      }
    };

    const startLoad = () => {
      void loadSummary();
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout?: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      idleId = idleWindow.requestIdleCallback(startLoad, { timeout: 1400 });
    } else {
      timeoutId = window.setTimeout(startLoad, 180);
    }

    return () => {
      active = false;
      if (idleId !== null) idleWindow.cancelIdleCallback?.(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadWalletBalance() {
      if (!user) {
        setWalletAmountLabel(formatCurrencyFromCents(0, 'IDR'));
        setWalletModeLabel(null);
        setWalletLoading(false);
        return;
      }

      setWalletLoading(true);
      try {
        const response = await authFetch('/api/wallet/balance', {
          cache: 'no-store',
        });
        const payload = (await response
          .json()
          .catch(() => ({}))) as HomeWalletBalancesResponse;
        if (!active) return;

        if (!response.ok) {
          setWalletAmountLabel(formatCurrencyFromCents(0, 'IDR'));
          setWalletModeLabel(null);
          return;
        }

        const account = pickHomeWalletAccount(payload);
        const environment = account?.environment ?? payload.default_environment;
        setWalletAmountLabel(
          formatCurrencyFromCents(
            account?.available_balance_cents ?? 0,
            account?.currency || 'IDR',
          ),
        );
        setWalletModeLabel(
          account || payload.default_environment
            ? normalizeWalletEnvironment(environment) === 'live'
              ? 'Live'
              : 'Dev'
            : null,
        );
      } catch {
        if (!active) return;
        setWalletAmountLabel(formatCurrencyFromCents(0, 'IDR'));
        setWalletModeLabel(null);
      } finally {
        if (active) setWalletLoading(false);
      }
    }

    void loadWalletBalance();

    return () => {
      active = false;
    };
  }, [authFetch, user]);

  useEffect(() => {
    let active = true;

    const loadHomeContent = async () => {
      try {
        const response = await fetch(
          '/api/content?limit=16&status=active&include_owner=1&database_only=1',
          {
            cache: 'no-store',
            credentials: 'include',
          },
        );
        const payload = await response.json().catch(() => null);
        if (!active || !response.ok) return;
        setRecommendations(
          extractContentItems(payload)
            .map(item => mapContentToRecommendation(item, isId))
            .filter((item): item is RecommendationItem => Boolean(item))
            .slice(0, 12),
        );
      } catch {
        if (active) setRecommendations([]);
      }
    };

    void loadHomeContent();

    return () => {
      active = false;
    };
  }, [isId]);

  useEffect(() => {
    let active = true;

    const loadCommunityPosts = async () => {
      try {
        const params = new URLSearchParams({
          tab: activeTab,
          limit: '6',
        });
        const response = await fetch(
          `/api/community/feed?${params.toString()}`,
          {
            cache: 'no-store',
            credentials: 'include',
          },
        );
        const payload = (await response
          .json()
          .catch(() => null)) as CommunityFeedResponse | null;
        if (!active || !response.ok) return;
        setCommunityPosts(
          (payload?.items || []).map(item =>
            mapCommunityItemToPost(item, isId),
          ),
        );
      } catch {
        if (active) setCommunityPosts([]);
      }
    };

    void loadCommunityPosts();

    return () => {
      active = false;
    };
  }, [activeTab, isId]);

  useEffect(() => {
    let active = true;

    const loadReels = async () => {
      try {
        const response = await fetch('/api/reels/feed?limit=8', {
          cache: 'no-store',
          credentials: 'include',
        });
        const payload = (await response.json().catch(() => null)) as {
          data?: ReelsFeedItem[];
        } | null;
        if (!active || !response.ok) return;
        setReels(
          (payload?.data || [])
            .map(mapReelFeedItem)
            .filter((item): item is ReelItem => Boolean(item)),
        );
      } catch {
        if (active) setReels([]);
      }
    };

    void loadReels();

    return () => {
      active = false;
    };
  }, []);

  const text = isId
    ? {
        help: 'Bantuan',
        login: 'Masuk',
        register: 'Daftar Gratis',
        inviteTitle: 'Siap jalan?',
        inviteDescription: 'Gabung, cari peluang, lanjut chat.',
        inviteButton: 'Daftar Gratis',
        searchPlaceholder: 'Cari supplier, jasa, lokasi...',
        searchButton: 'Cari',
      }
    : {
        help: 'Help',
        login: 'Login',
        register: 'Join Free',
        inviteTitle: 'Ready to grow your business?',
        inviteDescription:
          'Join Lajukan and unlock more supplier, service, and operating opportunities for your business.',
        inviteButton: 'Join Free',
        searchPlaceholder: 'Search suppliers, services, places...',
        searchButton: 'Search',
      };

  const avatarSrc =
    user?.avatarUrl || user?.avatar_url || '/default-avatar.svg';
  const primaryCtaHref = isAuthenticated ? '/create' : '/register';
  const handleSearchSubmit = (submittedQuery: string) => {
    const trimmedQuery = submittedQuery.trim();
    router.push(
      trimmedQuery
        ? `/search?q=${encodeURIComponent(trimmedQuery)}`
        : UMKM_DISCOVERY_PATH,
    );
  };

  const sidebarItems = isAuthenticated
    ? {
        primary: [
          {
            id: 'home',
            label: isId ? 'Beranda' : 'Home',
            caption: isId ? 'Ringkasan' : 'Main business overview',
            href: '/home',
            icon: Home,
          },
          {
            id: 'explore',
            label: isId ? 'Jelajah' : 'Explore',
            caption: isId
              ? 'Supplier, produk, jasa'
              : 'Suppliers, products, services',
            href: UMKM_DISCOVERY_PATH,
            icon: LayoutGrid,
          },
          {
            id: 'community',
            label: isId ? 'Komunitas' : 'Community',
            caption: isId ? 'Diskusi bisnis' : 'Forum and business discussion',
            href: '/community',
            icon: Sparkles,
          },
          {
            id: 'reels',
            label: isId ? 'Reels Bisnis' : 'Business Reels',
            caption: isId ? 'Tips singkat' : 'Short inspiration and tips',
            href: '/reels',
            icon: PlayCircle,
          },
          {
            id: 'requests',
            label: isId ? 'Permintaan' : 'My Requests',
            caption: isId ? 'Kebutuhan aktif' : 'Active briefs and needs',
            href: '/my-projects',
            icon: ClipboardList,
          },
          {
            id: 'transactions',
            label: isId ? 'Transaksi' : 'Transactions',
            caption: isId ? 'Status & bayar' : 'Progress and payments',
            href: '/transactions',
            icon: CreditCard,
          },
        ],
        secondary: [
          {
            id: 'chat',
            label: 'Chat',
            caption: isId ? 'Nego & follow-up' : 'Negotiation and follow-up',
            href: '/chat',
            icon: MessageCircle,
            badge:
              totalUnread > 0
                ? totalUnread > 99
                  ? '99+'
                  : totalUnread
                : undefined,
          },
          {
            id: 'account',
            label: isId ? 'Akun' : 'My Account',
            caption: isId ? 'Profil' : 'Profile and preferences',
            href: '/profile',
            icon: UserRound,
          },
          {
            id: 'support',
            label: isId ? 'Bantuan' : 'Help',
            caption: isId ? 'Support' : 'Guides and support',
            href: '/support',
            icon: CircleHelp,
          },
        ],
      }
    : {
        primary: [
          {
            id: 'home',
            label: isId ? 'Beranda' : 'Home',
            caption: isId ? 'Peluang terbaru' : 'Latest opportunity overview',
            href: '/home',
            icon: Home,
          },
          {
            id: 'explore',
            label: isId ? 'Jelajah' : 'Explore',
            caption: isId
              ? 'Supplier, produk, jasa'
              : 'Suppliers, products, services',
            href: UMKM_DISCOVERY_PATH,
            icon: LayoutGrid,
          },
          {
            id: 'supplier',
            label: isId ? 'Supplier' : 'Suppliers',
            caption: isId ? 'Siap respon' : 'Trusted suppliers',
            href: '/search?type=product&q=supplier',
            icon: ShoppingBag,
          },
          {
            id: 'service',
            label: isId ? 'Jasa' : 'Services',
            caption: isId ? 'Operasional' : 'Business services',
            href: '/search?type=service&q=jasa%20usaha',
            icon: BriefcaseBusiness,
          },
          {
            id: 'location',
            label: isId ? 'Lokasi' : 'Places',
            caption: isId ? 'Titik jual' : 'Strategic places',
            href: '/search?type=property&q=lokasi%20usaha',
            icon: MapPin,
          },
          {
            id: 'talent',
            label: 'Talent',
            caption: isId ? 'Siap bantu' : 'Qualified talent',
            href: '/search?type=freelancer&q=talent',
            icon: UserRound,
          },
          {
            id: 'opportunity',
            label: isId ? 'Peluang' : 'Business Opportunities',
            caption: isId ? 'Ide tumbuh' : 'Growth and expansion ideas',
            href: '/learn',
            icon: TrendingUp,
          },
        ],
        secondary: [
          {
            id: 'community',
            label: isId ? 'Komunitas' : 'Community',
            caption: isId ? 'Diskusi bisnis' : 'Forum and business discussion',
            href: '/community',
            icon: Sparkles,
          },
          {
            id: 'reels',
            label: isId ? 'Reels' : 'Business Reels',
            caption: isId ? 'Tips singkat' : 'Short inspiration and tips',
            href: '/reels',
            icon: PlayCircle,
          },
          {
            id: 'requests',
            label: isId ? 'Permintaan Saya' : 'My Requests',
            caption: isId ? 'Login untuk akses' : 'Login to access',
            href: '/login',
            icon: ClipboardList,
            locked: true,
          },
          {
            id: 'transactions',
            label: isId ? 'Transaksi' : 'Transactions',
            caption: isId ? 'Login untuk akses' : 'Login to access',
            href: '/login',
            icon: CreditCard,
            locked: true,
          },
        ],
      };

  if (authLoading) {
    return <HomeLoadingState />;
  }

  return (
    <MarketplacePageFrame>
      <div className="mx-auto w-full max-w-[720px] space-y-3.5 sm:space-y-4 lg:hidden">
        <MobileHeroSection
          isId={isId}
          isAuthenticated={isAuthenticated}
          summary={summary}
        />
        <GameProgressCard
          isId={isId}
          isAuthenticated={isAuthenticated}
          summary={summary}
          walletAmountLabel={walletAmountLabel}
          walletModeLabel={walletModeLabel}
          walletLoading={walletLoading}
          compact
        />
        <QuickCategoriesSection
          isId={isId}
          isAuthenticated={isAuthenticated}
          summary={summary}
          mobile
        />

        <HomeUmkmMapPreview locale={locale} />
        <RecommendationsSection isId={isId} items={recommendations} mobile />
        <CommunityPanel
          isId={isId}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          avatarSrc={avatarSrc}
          posts={communityPosts}
          mobile
        />
        <ReelsPanel isId={isId} items={reels} mobile />
      </div>

      <div className="lajukan-home-desktop-shell hidden min-h-0 min-w-0 lg:flex lg:flex-1 lg:flex-col">
        <div className="lajukan-home-desktop-grid relative z-0 mx-auto grid min-h-0 min-w-0 max-w-[1700px] flex-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_260px] 2xl:grid-cols-[280px_minmax(0,1fr)_280px]">
          <DesktopSidebar
            pathname={pathname}
            items={sidebarItems}
            inviteTitle={text.inviteTitle}
            inviteDescription={text.inviteDescription}
            inviteButton={text.inviteButton}
            inviteHref={primaryCtaHref}
          />
          <main
            className="min-h-0 min-w-0 overflow-y-auto pr-1 overscroll-contain pt-2"
            data-auto-scrollbar
          >
            <div className="space-y-4 pb-5">
              <DesktopHeroSection
                isId={isId}
                isAuthenticated={isAuthenticated}
                summary={summary}
                primaryCtaHref={primaryCtaHref}
                query={query}
                onQueryChange={setQuery}
                onSubmit={handleSearchSubmit}
                placeholder={text.searchPlaceholder}
                buttonLabel={text.searchButton}
              />
              <div className="xl:hidden">
                <GameProgressCard
                  isId={isId}
                  isAuthenticated={isAuthenticated}
                  summary={summary}
                  walletAmountLabel={walletAmountLabel}
                  walletModeLabel={walletModeLabel}
                  walletLoading={walletLoading}
                />
              </div>
              <QuickCategoriesSection
                isId={isId}
                isAuthenticated={isAuthenticated}
                summary={summary}
              />
              <HomeUmkmMapPreview locale={locale} />
              <RecommendationsSection isId={isId} items={recommendations} />
              <div className="grid gap-4">
                <ReelsPanel isId={isId} items={reels} />
                <CommunityPanel
                  isId={isId}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  avatarSrc={avatarSrc}
                  posts={communityPosts}
                />
              </div>
            </div>
          </main>
          <RightRail
            isId={isId}
            isAuthenticated={isAuthenticated}
            summary={summary}
            primaryCtaHref={primaryCtaHref}
            walletAmountLabel={walletAmountLabel}
            walletModeLabel={walletModeLabel}
            walletLoading={walletLoading}
          />
        </div>
      </div>
    </MarketplacePageFrame>
  );
}
