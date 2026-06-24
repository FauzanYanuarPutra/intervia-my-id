'use client';

import { LajukanImage as Image } from '@/components/common/LajukanImage';
import {
  MediaPreviewCarousel,
  type MediaPreviewItem,
} from '@/components/common/MediaPreviewCarousel';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  BriefcaseBusiness,
  Award,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clapperboard,
  CreditCard,
  Flame,
  Globe2,
  Heart,
  Home,
  LockKeyhole,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Package,
  PlayCircle,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  ThumbsUp,
  TrendingUp,
  Trophy,
  UserRound,
  Users,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { HomeUmkmMapPreview } from '@/components/home/HomeUmkmMapPreview';
import { Footer } from '@/components/layout/Footer';
import { DailyLoginRewardCard } from '@/components/rewards/DailyLoginRewardCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { useAuth } from '@/context/AuthContext';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { useChatInbox } from '@/context/ChatInboxContext';
import { Link, useRouter } from '@/i18n/navigation';
import {
  formatLajukanCountLabel,
  type LajukanSummary,
} from '@/lib/lajukan-marketplace';
import {
  createLajukanAvatarDataUrl,
  type LajukanAvatarStyle,
} from '@/lib/profile/avatar2d';
import {
  extractContentItems,
  formatCurrencyFromCents,
  resolveImageGallery,
  type ContentItem,
} from '@/lib/content/catalog';
import { resolveContentPriceUnitLabel } from '@/lib/content/priceUnit';
import { buildContentHref } from '@/lib/content/routes';
import { MarketplacePageFrame } from '@/components/layout/MarketplacePageFrame';
import type {
  CommunityFeedItem,
  CommunityFeedOverview,
  CommunityFeedResponse,
} from '@/lib/community/types';
import { CommunityComposer } from '@/components/community/CommunityFeedClient';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import { UMKM_DISCOVERY_PATH } from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';

type HomeContentSimpleProps = {
  locale: string;
};

const HOME_COMMUNITY_PAGE_SIZE = 6;

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
  images: string[];
  href: string;
  badge?: string;
  badgeTone?: Tone;
  typeLabel: string;
  createHref: string;
  entityType?: string;
  detailActionLabel?: string;
  secondaryActionLabel?: string;
  secondaryEventName?: string;
};

type CommunityTab = 'for-you' | 'following' | 'community';

type CommunityPost = {
  id: string;
  tab: CommunityTab;
  href?: string;
  kind: 'discussion' | 'reel';
  community: string;
  author: string;
  time: string;
  title: string;
  body: string;
  image?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaItems: MediaPreviewItem[];
  avatar?: string;
  tags: string[];
  likes: string;
  comments: string;
  shares: string;
  views: string;
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
const HOME_HERO_IMAGE = '/images/hero/lajukan-id-2.png';

type HomeAvatarProp =
  | 'crate'
  | 'cart'
  | 'tool'
  | 'pin'
  | 'laptop'
  | 'chat'
  | 'camera'
  | 'route';

type HomeAvatarScene = {
  id: string;
  labelId: string;
  labelEn: string;
  captionId: string;
  captionEn: string;
  tone: Tone;
  prop: HomeAvatarProp;
  spec: Partial<LajukanAvatarStyle>;
};

type HomeHeroAvatar = HomeAvatarScene & {
  desktopClassName: string;
  mobileClassName: string;
  sizeClassName: string;
};

function buildCommunityPostHref(post: CommunityPost): string {
  if (post.href) return post.href;
  const params = new URLSearchParams();
  params.set('tab', post.tab);
  const tag = post.tags[0];
  if (tag) params.set('tag', tag);
  return `/community?${params.toString()}`;
}

function buildCommunityTabHref(tab: CommunityTab): string {
  const params = new URLSearchParams();
  params.set('tab', tab);
  return `/community?${params.toString()}`;
}

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
      card: 'border-emerald-100',
      glow: 'bg-emerald-400/16',
      text: 'text-emerald-700',
    };
  }
  if (tone === 'lime') {
    return {
      icon: 'bg-lime-100 text-lime-700',
      soft: 'bg-lime-50 text-lime-700',
      surface: 'border-lime-100 bg-lime-50/70',
      card: 'border-lime-100',
      glow: 'bg-lime-400/16',
      text: 'text-lime-700',
    };
  }
  if (tone === 'orange') {
    return {
      icon: 'bg-orange-100 text-orange-700',
      soft: 'bg-orange-50 text-orange-700',
      surface: 'border-orange-100 bg-orange-50/70',
      card: 'border-orange-100',
      glow: 'bg-orange-400/16',
      text: 'text-orange-700',
    };
  }
  return {
    icon: 'bg-emerald-100 text-emerald-700',
    soft: 'bg-emerald-50 text-emerald-700',
    surface: 'border-emerald-100 bg-emerald-50/70',
    card: 'border-emerald-100',
    glow: 'bg-emerald-400/16',
    text: 'text-emerald-700',
  };
}

const HOME_AVATAR_SCENES: Record<string, HomeAvatarScene> = {
  supplier: {
    id: 'supplier',
    labelId: 'Supplier',
    labelEn: 'Supplier',
    captionId: 'Stok datang',
    captionEn: 'Supply ready',
    tone: 'emerald',
    prop: 'crate',
    spec: {
      skin: 'sawo',
      hair: 'wave',
      hairColor: 'espresso',
      headwear: 'cap',
      accessory: 'cap',
      outfit: 'apron',
      outfitColor: 'emerald',
      backItem: 'shield',
      handItem: 'package',
      aura: 'spark',
      background: 'mint',
      mood: 'determined',
      pose: 'ready',
      motion: 'full',
    },
  },
  product: {
    id: 'product',
    labelId: 'Seller',
    labelEn: 'Seller',
    captionId: 'Produk siap',
    captionEn: 'Products ready',
    tone: 'orange',
    prop: 'cart',
    spec: {
      body: 'small',
      skin: 'kuning',
      hair: 'crop',
      hairColor: 'black',
      outfit: 'tee',
      outfitColor: 'sky',
      wing: 'crystal',
      aura: 'energy',
      backItem: 'shield',
      handItem: 'package',
      background: 'neon',
      mood: 'smile',
      motion: 'full',
    },
  },
  service: {
    id: 'service',
    labelId: 'Jasa Pro',
    labelEn: 'Service Pro',
    captionId: 'Bantu beres',
    captionEn: 'Ops handled',
    tone: 'violet',
    prop: 'tool',
    spec: {
      body: 'sturdy',
      skin: 'tan',
      hair: 'crop',
      headwear: 'cap',
      accessory: 'cap',
      outfit: 'jacket',
      outfitColor: 'amber',
      handItem: 'wrench',
      aura: 'orbit',
      background: 'mint',
      mood: 'determined',
      pose: 'ready',
    },
  },
  location: {
    id: 'location',
    labelId: 'Tempat',
    labelEn: 'Place',
    captionId: 'Lokasi cocok',
    captionEn: 'Right spot',
    tone: 'rose',
    prop: 'pin',
    spec: {
      skin: 'porcelain',
      hair: 'long',
      hairColor: 'chestnut',
      outfit: 'batik',
      outfitColor: 'rose',
      backItem: 'shield',
      handItem: 'phone',
      aura: 'halo',
      background: 'rose',
      mood: 'smile',
    },
  },
  talent: {
    id: 'talent',
    labelId: 'Talent',
    labelEn: 'Talent',
    captionId: 'Siap bantu',
    captionEn: 'Ready to help',
    tone: 'cyan',
    prop: 'laptop',
    spec: {
      skin: 'deep',
      hair: 'curly',
      hairColor: 'black',
      eyewear: 'glasses',
      accessory: 'glasses',
      outfit: 'hoodie',
      outfitColor: 'violet',
      handItem: 'phone',
      aura: 'energy',
      background: 'slate',
      mood: 'cool',
    },
  },
  community: {
    id: 'community',
    labelId: 'Komunitas',
    labelEn: 'Community',
    captionId: 'Belajar bareng',
    captionEn: 'Learn together',
    tone: 'amber',
    prop: 'chat',
    spec: {
      skin: 'sawo',
      hair: 'bun',
      hairColor: 'auburn',
      headwear: 'hijab',
      accessory: 'hijab',
      outfit: 'batik',
      outfitColor: 'emerald',
      wing: 'leaf',
      aura: 'rainbow',
      handItem: 'coffee',
      background: 'sky',
      mood: 'wink',
      pose: 'wave',
    },
  },
  reels: {
    id: 'reels',
    labelId: 'Kreator',
    labelEn: 'Creator',
    captionId: 'Konten jalan',
    captionEn: 'Content moving',
    tone: 'lime',
    prop: 'camera',
    spec: {
      skin: 'kuning',
      hair: 'bun',
      hairColor: 'auburn',
      eyewear: 'shades',
      outfit: 'hoodie',
      outfitColor: 'rose',
      wing: 'flame',
      aura: 'rainbow',
      handItem: 'camera',
      background: 'neon',
      mood: 'wink',
      motion: 'full',
    },
  },
  map: {
    id: 'map',
    labelId: 'Kurir Lokal',
    labelEn: 'Local Courier',
    captionId: 'Rute dekat',
    captionEn: 'Nearby route',
    tone: 'blue',
    prop: 'route',
    spec: {
      skin: 'tan',
      hair: 'crop',
      headwear: 'helmet',
      outfit: 'driver',
      outfitColor: 'amber',
      backItem: 'jetpack',
      handItem: 'package',
      aura: 'energy',
      background: 'sky',
      mood: 'determined',
      pose: 'ready',
    },
  },
};

const HOME_HERO_AVATARS: HomeHeroAvatar[] = [
  {
    ...HOME_AVATAR_SCENES.supplier,
    desktopClassName: 'left-[4%] bottom-5',
    mobileClassName: 'left-[4%] bottom-7',
    sizeClassName: 'h-32 w-32 sm:h-36 sm:w-36',
  },
  {
    ...HOME_AVATAR_SCENES.product,
    desktopClassName: 'left-[32%] bottom-2',
    mobileClassName: 'left-[33%] bottom-4',
    sizeClassName: 'h-36 w-36 sm:h-40 sm:w-40',
  },
  {
    ...HOME_AVATAR_SCENES.map,
    desktopClassName: 'right-[4%] bottom-5',
    mobileClassName: 'right-[3%] bottom-8',
    sizeClassName: 'h-32 w-32 sm:h-36 sm:w-36',
  },
  {
    ...HOME_AVATAR_SCENES.reels,
    desktopClassName: 'right-[29%] top-4',
    mobileClassName: 'right-[23%] top-8',
    sizeClassName: 'h-24 w-24 sm:h-28 sm:w-28',
  },
];

const HOME_AVATAR_SRC_CACHE = new Map<string, string>();

function getHomeAvatarScene(id: string): HomeAvatarScene {
  return HOME_AVATAR_SCENES[id] || HOME_AVATAR_SCENES.supplier;
}

function homeSceneLabel(scene: HomeAvatarScene, isId: boolean): string {
  return isId ? scene.labelId : scene.labelEn;
}

function homeSceneCaption(scene: HomeAvatarScene, isId: boolean): string {
  return isId ? scene.captionId : scene.captionEn;
}

function homeAvatarDataUrl(scene: HomeAvatarScene, isId: boolean): string {
  const key = `${scene.id}:${isId ? 'id' : 'en'}`;
  const cached = HOME_AVATAR_SRC_CACHE.get(key);
  if (cached) return cached;
  const next = createLajukanAvatarDataUrl(
    scene.spec,
    homeSceneLabel(scene, isId),
  );
  HOME_AVATAR_SRC_CACHE.set(key, next);
  return next;
}

function normalizePathname(pathname: string): string {
  const withoutLocale = pathname.replace(/^\/(id|en)(?=\/|$)/, '');
  return withoutLocale === '' ? '/' : withoutLocale;
}

function resolveCountLabel(
  value: number | null | undefined,
  fallback: string,
): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? formatLajukanCountLabel(value)
    : fallback;
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
    return '/profile/edit?focus=talent';
  return '/create';
}

function mapContentToRecommendation(
  item: ContentItem,
  isId: boolean,
): RecommendationItem | null {
  if (!item.id || !item.title) return null;
  const images = resolveImageGallery(item);
  const image = images[0];
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
  const unit =
    resolveContentPriceUnitLabel(item, isId ? 'id' : 'en') ||
    metadataText(item, 'unit', 'rate_type', 'min_order_qty', 'lease_term');

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
    images,
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
  activeTab: CommunityTab,
): CommunityPost {
  const isReel = item.kind === 'reel';
  const mediaItems = buildCommunityMediaItems(item);
  const firstMedia = mediaItems[0];
  const mediaUrl =
    typeof firstMedia === 'string'
      ? firstMedia
      : firstMedia?.src || item.media?.src;
  const mediaType =
    typeof firstMedia === 'string'
      ? item.media?.type
      : firstMedia?.type || item.media?.type;
  return {
    id: item.id,
    tab: activeTab,
    href: item.href || undefined,
    kind: isReel ? 'reel' : 'discussion',
    community:
      item.group?.name ||
      item.communityName ||
      (isReel ? 'Reels Usaha' : isId ? 'Komunitas' : 'Community'),
    author: item.author?.name || (isId ? 'Member Lajukan' : 'Lajukan member'),
    time: formatCommunityTime(item.createdAt, isId),
    title:
      item.title ||
      (isReel
        ? isId
          ? 'Reels usaha'
          : 'Business reel'
        : isId
          ? 'Diskusi komunitas'
          : 'Community discussion'),
    body: item.body || '',
    image: mediaType === 'image' ? mediaUrl : undefined,
    mediaUrl,
    mediaType,
    mediaItems,
    avatar: profileAvatarSrc(
      item.author?.avatarUrl,
      readProfileAvatarStyle(item.author),
      item.author?.name,
    ),
    tags: item.tags
      .map(tag => tag.name || tag.slug)
      .filter(Boolean)
      .slice(0, 4),
    likes: formatCompactCount(item.stats?.reactions, '0'),
    comments: formatCompactCount(item.stats?.comments, '0'),
    shares: formatCompactCount(item.stats?.shares, '0'),
    views: formatCompactCount(item.stats?.views, '0'),
  };
}

function buildCommunityMediaItems(item: CommunityFeedItem): MediaPreviewItem[] {
  const seen = new Set<string>();
  const mediaItems: MediaPreviewItem[] = [];

  const addMedia = (
    src: string | null | undefined,
    type: 'image' | 'video' = 'image',
    alt = item.title || item.communityName || 'Community media',
  ) => {
    const cleanSrc = String(src || '').trim();
    if (!cleanSrc) return;
    const key = cleanSrc.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    mediaItems.push({ src: cleanSrc, type, alt });
  };

  for (const media of item.mediaItems || []) {
    addMedia(media.src, media.type, media.alt);
  }
  if (item.media) {
    addMedia(item.media.src, item.media.type, item.media.alt);
  }
  for (const imageUrl of item.imageUrls || []) {
    addMedia(imageUrl, 'image');
  }

  return mediaItems;
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

function getQuickCategories(isId: boolean): QuickCategory[] {
  return [
    {
      id: 'supplier',
      label: isId ? 'Supplier' : 'Suppliers',
      description: isId ? 'Supplier siap respon' : 'Trusted suppliers',
      href: '/search?type=product&q=supplier',
      icon: ShoppingBag,
      tone: 'emerald',
    },
    {
      id: 'product',
      label: isId ? 'Produk' : 'Products',
      description: isId ? 'Stok siap jual' : 'Best products',
      href: '/search?q=produk%20reseller',
      icon: Package,
      tone: 'orange',
    },
    {
      id: 'service',
      label: isId ? 'Jasa' : 'Services',
      description: isId ? 'Jasa operasional' : 'Business services',
      href: '/search?type=service&q=jasa%20usaha',
      icon: BriefcaseBusiness,
      tone: 'violet',
    },
    {
      id: 'location',
      label: isId ? 'Lokasi' : 'Places',
      description: isId ? 'Lokasi jualan' : 'Strategic places',
      href: '/search?type=property&q=lokasi%20usaha',
      icon: MapPin,
      tone: 'rose',
    },
    {
      id: 'talent',
      label: 'Talent',
      description: isId ? 'Talent siap bantu' : 'Qualified talent',
      href: '/search?type=freelancer&q=talent',
      icon: UserRound,
      tone: 'cyan',
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
    },
    {
      id: 'reels',
      label: 'Reels',
      description: isId ? 'Video usaha' : 'Business videos',
      href: '/reels',
      icon: Clapperboard,
      tone: 'lime',
    },
    {
      id: 'map',
      label: isId ? 'Peta Usaha' : 'Business Map',
      description: isId ? 'Usaha sekitar' : 'Nearby businesses',
      href: UMKM_DISCOVERY_PATH,
      icon: Globe2,
      tone: 'blue',
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
      value: formatCompactCount(summary?.stores?.verified, '0'),
      note: isId ? 'Partner siap diajak kerja' : 'Partners ready to work',
      icon: ShieldCheck,
      tone: 'emerald',
    },
    {
      id: 'demand',
      label: isId ? 'Permintaan aktif' : 'Active requests',
      value: formatCompactCount(summary?.requests?.active, '0'),
      note: isId ? 'Diambil dari data platform' : 'From platform data',
      icon: TrendingUp,
      tone: 'amber',
    },
    {
      id: 'community',
      label: isId ? 'Komunitas Aktif' : 'Active community',
      value: formatCompactCount(summary?.requests?.active, '0'),
      note: isId ? 'Diskusi dan peluang baru' : 'Discussions and new leads',
      icon: UserRound,
      tone: 'blue',
    },
  ];
}

function HomeAvatarSprite({
  scene,
  isId,
  sizes,
  className,
  decorative = false,
}: {
  scene: HomeAvatarScene;
  isId: boolean;
  sizes: string;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <Image
      src={homeAvatarDataUrl(scene, isId)}
      alt={decorative ? '' : homeSceneLabel(scene, isId)}
      fill
      unoptimized
      loading="lazy"
      fetchPriority="low"
      sizes={sizes}
      className={cn(
        'object-contain drop-shadow-[0_18px_18px_rgba(15,23,42,0.2)]',
        className,
      )}
    />
  );
}

function HomeCategoryHeaderBadge({ isId }: { isId: boolean }) {
  const supplier = HOME_AVATAR_SCENES.supplier;
  const reels = HOME_AVATAR_SCENES.reels;

  return (
    <span className="relative inline-flex h-11 w-11 shrink-0 items-end justify-center overflow-hidden rounded-[16px] border border-emerald-100 bg-[radial-gradient(circle_at_50%_20%,#dcfce7,#f0fdfa_62%,#ffffff)]">
      <span className="absolute bottom-0 h-4 w-10 rounded-t-full bg-emerald-200/50" />
      <span className="relative -mr-2 h-9 w-9">
        <HomeAvatarSprite
          scene={supplier}
          isId={isId}
          decorative
          sizes="44px"
        />
      </span>
      <span className="relative -ml-3 h-8 w-8">
        <HomeAvatarSprite scene={reels} isId={isId} decorative sizes="36px" />
      </span>
    </span>
  );
}

function renderHomeAvatarProp(prop: HomeAvatarProp) {
  if (prop === 'crate') {
    return (
      <>
        <span className="absolute bottom-1 left-1 h-3.5 w-4 rounded-[4px] border border-amber-700/20 bg-amber-300 shadow-sm" />
        <span className="absolute bottom-3 left-3 h-3 w-4 rounded-[4px] border border-orange-800/20 bg-orange-300 shadow-sm" />
      </>
    );
  }
  if (prop === 'cart') {
    return (
      <>
        <span className="absolute bottom-2 left-1.5 h-3.5 w-6 rounded-[5px] border border-orange-700/20 bg-orange-300" />
        <span className="absolute bottom-1 left-3 h-1.5 w-1.5 rounded-full bg-slate-700" />
        <span className="absolute bottom-1 right-2 h-1.5 w-1.5 rounded-full bg-slate-700" />
      </>
    );
  }
  if (prop === 'tool') {
    return (
      <span className="absolute bottom-1.5 left-2 h-2 w-7 -rotate-45 rounded-full bg-slate-500 shadow-sm">
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-slate-500 bg-transparent" />
      </span>
    );
  }
  if (prop === 'pin' || prop === 'route') {
    return (
      <span className="absolute bottom-1 left-3 h-6 w-6 rotate-[-45deg] rounded-full rounded-bl-[4px] bg-rose-500 shadow-sm">
        <span className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full bg-white" />
      </span>
    );
  }
  if (prop === 'laptop') {
    return (
      <span className="absolute bottom-1 left-1 h-4 w-8 rounded-[5px] border border-cyan-700/20 bg-cyan-300 shadow-sm" />
    );
  }
  if (prop === 'chat') {
    return (
      <span className="absolute bottom-2 left-2 h-5 w-7 rounded-[8px] rounded-bl-[3px] bg-amber-300 shadow-sm" />
    );
  }
  return (
    <span className="absolute bottom-1 left-2 h-5 w-6 rounded-[6px] bg-slate-800 shadow-sm" />
  );
}

function HomeCategoryAvatar({
  item,
  isId,
  mobile = false,
}: {
  item: QuickCategory;
  isId: boolean;
  mobile?: boolean;
}) {
  const scene = getHomeAvatarScene(item.id);
  const tone = toneClassNames(scene.tone);

  return (
    <span
      className={cn(
        'relative isolate inline-flex items-end justify-center overflow-hidden rounded-[18px] border bg-white/88 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.28)]',
        mobile ? 'h-14 w-14' : 'h-[4.5rem] w-[4.5rem]',
        tone.surface,
      )}
    >
      <span
        className={cn(
          'absolute -right-3 -top-3 h-10 w-10 rounded-full blur-xl',
          tone.glow,
        )}
      />
      <span className="absolute inset-x-2 bottom-1 h-4 rounded-full bg-white/60" />
      <span
        className={cn(
          'relative z-10',
          mobile ? 'h-[3.8rem] w-[3.8rem]' : 'h-[4.7rem] w-[4.7rem]',
        )}
      >
        <HomeAvatarSprite
          scene={scene}
          isId={isId}
          decorative
          sizes={mobile ? '56px' : '72px'}
        />
      </span>
      <span className="absolute bottom-0 right-0 z-20 h-8 w-9 motion-safe:animate-pulse">
        {renderHomeAvatarProp(scene.prop)}
      </span>
    </span>
  );
}

function HomeHeroCollaborationScene({
  isId,
  compact = false,
}: {
  isId: boolean;
  compact?: boolean;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_48%_20%,#ecfeff_0%,#d1fae5_36%,#86efac_72%,#22c55e_120%)]">
      <span className="absolute inset-x-6 bottom-0 h-[38%] rounded-t-[999px] bg-[linear-gradient(180deg,#bbf7d0,#86efac)] opacity-90" />
      <span className="absolute left-[12%] top-[45%] h-1 w-[74%] -rotate-6 rounded-full bg-white/60 shadow-[0_0_18px_rgba(255,255,255,0.6)]" />
      <span className="absolute left-[19%] top-[39%] h-3 w-3 rounded-full bg-white/80" />
      <span className="absolute right-[20%] top-[31%] h-3 w-3 rounded-full bg-emerald-100/90" />
      <span className="absolute left-4 top-4 rounded-full bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 shadow-sm">
        {isId ? 'Tim UMKM hidup' : 'Live SME team'}
      </span>
      <span className="absolute bottom-8 left-[23%] h-8 w-12 rounded-[10px] border border-amber-700/15 bg-amber-300/90 shadow-sm motion-safe:animate-bounce" />
      <span className="absolute bottom-12 right-[19%] h-10 w-14 rounded-[12px] border border-orange-700/15 bg-orange-300/90 shadow-sm" />
      {HOME_HERO_AVATARS.map((avatar, index) => (
        <span
          key={avatar.id}
          className={cn(
            'absolute z-10',
            compact ? avatar.mobileClassName : avatar.desktopClassName,
            avatar.sizeClassName,
            compact && index === 3 ? 'hidden min-[430px]:block' : '',
          )}
        >
          <HomeAvatarSprite
            scene={avatar}
            isId={isId}
            sizes={compact ? '144px' : '160px'}
          />
          <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/88 px-2 py-0.5 text-[9px] font-black text-emerald-700 shadow-sm backdrop-blur">
            {homeSceneCaption(avatar, isId)}
          </span>
        </span>
      ))}
      <span className="absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-1 rounded-full bg-white/86 px-3 py-1.5 text-[10px] font-black text-emerald-800 shadow-sm backdrop-blur sm:inline-flex">
        <span>{isId ? 'Supplier' : 'Supplier'}</span>
        <ChevronRight className="h-3 w-3" />
        <span>Chat</span>
        <ChevronRight className="h-3 w-3" />
        <span>{isId ? 'Kirim' : 'Deliver'}</span>
      </span>
    </div>
  );
}

type CommunityTabItem = {
  id: CommunityTab;
  label: string;
  caption: string;
  actionLabel: string;
  emptyLabel: string;
  loadingLabel: string;
  icon: LucideIcon;
  tone: Tone;
};

function getCommunityTabs(isId: boolean): CommunityTabItem[] {
  return [
    {
      id: 'for-you',
      label: isId ? 'Untukmu' : 'For you',
      caption: isId ? 'Rekomendasi & tren' : 'Recommended trends',
      actionLabel: isId ? 'Buka Untukmu' : 'Open For you',
      emptyLabel: isId
        ? 'Belum ada rekomendasi komunitas.'
        : 'No recommended community posts yet.',
      loadingLabel: isId
        ? 'Memuat rekomendasi...'
        : 'Loading recommendations...',
      icon: Sparkles,
      tone: 'emerald',
    },
    {
      id: 'following',
      label: isId ? 'Diikuti' : 'Following',
      caption: isId ? 'Dari akun/topik pilihan' : 'From followed signals',
      actionLabel: isId ? 'Buka Diikuti' : 'Open Following',
      emptyLabel: isId
        ? 'Belum ada update dari yang diikuti.'
        : 'No following updates yet.',
      loadingLabel: isId ? 'Memuat update...' : 'Loading updates...',
      icon: Heart,
      tone: 'rose',
    },
    {
      id: 'community',
      label: isId ? 'Grup' : 'Groups',
      caption: isId ? 'Diskusi ruang UMKM' : 'Business group rooms',
      actionLabel: isId ? 'Buka Grup' : 'Open Groups',
      emptyLabel: isId
        ? 'Belum ada diskusi grup dari database.'
        : 'No group discussions from the database yet.',
      loadingLabel: isId
        ? 'Memuat diskusi grup...'
        : 'Loading group discussions...',
      icon: Users,
      tone: 'teal',
    },
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
  isId,
  metrics,
  compact = false,
  className,
}: {
  isId: boolean;
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
          compact ? 'aspect-[3/2]' : 'aspect-[3/2]',
        )}
      >
        <Image
          src={HOME_HERO_IMAGE}
          alt="Lajukan hero"
          fill
          loading="lazy"
          fetchPriority="low"
          quality={1000}
          sizes="100vw"
          className="object-cover object-center"
        />

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,46,26,0.02),rgba(5,46,26,0.24))]" />

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
        'relative aspect-[3/2] w-full overflow-hidden rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_76%,white_16%)] bg-emerald-100 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.22)]',
        className,
      )}
    >
      <Image
        src={HOME_HERO_IMAGE}
        alt={isId ? 'Visual Lajukan' : 'Lajukan visual'}
        fill
        loading="lazy"
        fetchPriority="low"
        quality={1000}
        sizes="100vw"
        className="object-cover object-center"
      />
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

  if (!isAuthenticated) {
    return (
      <div>
        <HeroVisualStage
          isId={isId}
          metrics={metrics}
          className="mb-3"
        />
        <section className="overflow-hidden rounded-[26px] border border-emerald-200/70 bg-[linear-gradient(145deg,#ffffff_0%,#f8fcff_46%,#ecfff2_100%)] p-4 shadow-[0_20px_42px_-36px_rgba(15,23,42,0.18)] xl:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_296px] xl:items-start">
            <div className="relative z-10 min-w-0">
              <p className="mb-2 inline-flex rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)] ring-1 ring-emerald-100">
                {isId ? 'Sebelum login' : 'Before login'}
              </p>
              <h1 className="max-w-[23ch] text-[1.78rem] font-semibold leading-[1.04] tracking-[-0.045em] text-[color:var(--app-text)] xl:text-[2rem]">
                {isId
                  ? 'Masuk dulu, lalu simpan peluang yang paling pas'
                  : 'Log in first, then save the opportunities that matter most'}
                <span className="text-[color:var(--app-accent)]"> Lajukan</span>
              </h1>
              <p className="mt-3 max-w-[39rem] text-[13px] leading-6 text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Lihat listing, komunitas, dan reels bisnis yang relevan. Setelah login, favorit, chat, dan riwayat pencarian akan tetap mengikuti Anda.'
                  : 'Browse suppliers, services, communities, and business reels. After login, favorites, chats, and search history stay with you everywhere.'}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)] ring-1 ring-emerald-100">
                  <Heart className="h-3.5 w-3.5 text-rose-500" />
                  {isId ? 'Simpan favorit' : 'Save favorites'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)] ring-1 ring-emerald-100">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  {isId ? 'Lebih rapi' : 'Stay organized'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)] ring-1 ring-emerald-100">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  {isId ? 'Lanjut cepat' : 'Continue fast'}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link
                  href="/login"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-[14px] border border-[color:var(--app-border)] bg-white px-4 text-xs font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]"
                >
                  {isId ? 'Masuk' : 'Login'}
                </Link>
                <Link
                  href="/register"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-xs font-semibold text-[color:var(--app-text-inverse)]"
                >
                  {isId ? 'Daftar Sekarang' : 'Register Now'}
                </Link>
              </div>

              <p className="mt-3 text-xs leading-5 text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Gratis untuk mulai. Masuk sekarang biar peluang yang Anda suka tidak hilang.'
                  : 'Free to start. Log in now so the opportunities you like do not slip away.'}
              </p>
            </div>

            {/* <div className="rounded-[24px] border border-white/80 bg-white/80 p-4 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.22)] backdrop-blur">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#059669,#047857)] text-white shadow-[0_14px_26px_-18px_rgba(4,120,87,0.85)]">
                  <Sparkles className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-sm font-black leading-5 text-[color:var(--app-text)]">
                    {isId ? 'Kenapa login dulu?' : 'Why log in first?'}
                  </p>
                  <p className="text-[11px] leading-4 text-[color:var(--app-text-soft)]">
                    {isId
                      ? 'Biar setiap interaksi jadi lebih personal.'
                      : 'So every interaction feels more personal.'}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {[
                  {
                    icon: Heart,
                    title: isId ? 'Favorit tersimpan' : 'Favorites stay saved',
                    description: isId
                      ? 'Listing yang Anda suka lebih mudah dibuka lagi.'
                      : 'The listings you like are easier to revisit.',
                  },
                  {
                    icon: MessageCircle,
                    title: isId ? 'Chat tetap nyambung' : 'Chats keep flowing',
                    description: isId
                      ? 'Lanjut dari percakapan terakhir tanpa mulai ulang.'
                      : 'Continue from the last conversation without starting over.',
                  },
                  {
                    icon: Target,
                    title: isId ? 'Lebih cepat ambil keputusan' : 'Decide faster',
                    description: isId
                      ? 'Rekomendasi yang tampil jadi lebih relevan buat Anda.'
                      : 'The recommendations you see become more relevant to you.',
                  },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="flex gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3"
                    >
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold leading-5 text-[color:var(--app-text)]">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-4 text-[color:var(--app-text-soft)]">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div> */}
          </div>

          {/* <div className="mt-4 grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-center">
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
                {isId ? 'Daftar Sekarang' : 'Register Now'}
              </Link>
              <Link
                href={UMKM_DISCOVERY_PATH}
                className="inline-flex min-h-[40px] items-center justify-center rounded-[14px] border border-[color:var(--app-border)] bg-white px-4 text-xs font-semibold text-[color:var(--app-text)]"
              >
                {isId ? 'Jelajah dulu' : 'Browse first'}
              </Link>
            </div>
          </div> */}
        </section>
      </div>
    );
  }

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
                  ? 'Daftar Sekarang'
                  : 'Register Now'}
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
      <HeroVisualStage
        isId={isId}
        metrics={metrics}
        className="mt-3 hidden xl:block"
      />
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

  if (!isAuthenticated) {
    return (
      <div>
        <MobileHeroVisualBanner
          isId={isId}
          metrics={metrics}
          className="mb-2.5"
        />
        <section className="overflow-hidden rounded-[26px] border border-emerald-200/70 bg-[linear-gradient(145deg,#ffffff_0%,#f8fcff_46%,#ecfff2_100%)] p-4 shadow-[0_20px_42px_-36px_rgba(15,23,42,0.18)]">
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
            {isId ? 'Sebelum login' : 'Before login'}
          </p>
          <h1 className="max-w-[18ch] text-[1.36rem] font-semibold leading-[1.05] tracking-[-0.04em] text-[color:var(--app-text)]">
            {isId
              ? 'Masuk dulu, biar peluang terbaik tidak lewat begitu saja'
              : 'Log in first so the best opportunities do not pass by'}
            <span className="text-[color:var(--app-accent)]"> Lajukan</span>
          </h1>
          <p className="mt-2 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Lihat listing, komunitas, dan reels bisnis yang relevan. Login supaya favorit, chat, dan riwayat pencarian ikut tersimpan.'
              : 'Browse suppliers, services, communities, and business reels. Log in so favorites, chats, and search history stay with you.'}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)] ring-1 ring-emerald-100">
              <Heart className="h-3.5 w-3.5 text-rose-500" />
              {isId ? 'Simpan favorit' : 'Save favorites'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)] ring-1 ring-emerald-100">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              {isId ? 'Lebih rapi' : 'Stay organized'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)] ring-1 ring-emerald-100">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              {isId ? 'Lanjut cepat' : 'Continue fast'}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
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
              {isId ? 'Daftar Sekarang' : 'Register Now'}
            </Link>
          </div>
        </section>
      </div>
    );
  }

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
  if (PROMO_ONLY_MODE) {
    return null;
  }

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
                {isId ? 'Daftar Sekarang' : 'Register Now'}
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
        'lajukan-game-progress-card relative overflow-hidden rounded-2xl border border-slate-100 bg-white text-[color:var(--app-text)] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all dark:border-zinc-800/80 dark:bg-zinc-950 dark:text-zinc-50',
        compact ? 'lajukan-game-progress-card-compact p-3' : 'p-4',
      )}
    >
      {/* Ambient Background Glow (Lebih Smooth) */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/10 blur-2xl dark:bg-emerald-500/5" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-amber-400/10 blur-2xl dark:bg-amber-500/5" />

      <div className="relative space-y-3.5">
        {/* SECTION 1: LEVEL & RANK HEADER */}
        <div className="flex min-w-0 items-center gap-3">
          {/* Badge Level dengan Efek 3D Clean */}
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
            <span className="text-base font-black tracking-tight">
              {snapshot.level}
            </span>
            <div className="absolute -bottom-1 -right-1 rounded-md bg-amber-400 p-0.5 shadow-sm">
              <Trophy className="h-3 w-3 text-emerald-950" />
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                {isId ? 'Arena Level' : 'Level Arena'}
              </p>
              <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-600/10 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20">
                {snapshot.rank}
              </span>
            </div>

            {/* Progress Bar Minimalis & Modern */}
            <div className="flex items-center gap-2">
              {/* Diubah dari h-2 menjadi h-2.5 */}
              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 p-0 m-0 relative">
                <div
                  className="absolute left-0 top-0 bottom-0 h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-500 ease-out p-0 m-0"
                  style={{ width: `${snapshot.xpPercent}%` }}
                />
              </div>
              <span className="shrink-0 font-mono text-[10px] font-bold leading-none text-zinc-500 dark:text-zinc-400">
                {snapshot.xp}/{snapshot.xpGoal}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: INTEGRATED WALLET CARD */}
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-2.5 dark:border-zinc-900 dark:bg-zinc-900/40">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CreditCard className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {isId ? 'Saldo' : 'Balance'}
                </p>
                {walletModeLabel && (
                  <span className="rounded bg-zinc-200/60 px-1 py-0.2 text-[9px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {walletModeLabel}
                  </span>
                )}
              </div>
              {walletLoading ? (
                <div className="mt-1 h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              ) : (
                <p className="truncate text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-200">
                  {amountLabel}
                </p>
              )}
            </div>
          </div>

          <Link
            href="/payments"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-zinc-900 px-3.5 text-xs font-bold text-white transition-all hover:bg-zinc-800 active:scale-95 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Top up
          </Link>
        </div>

        {/* SECTION 3: QUICK STATS & QUEST */}
        <div className="grid grid-cols-2 gap-2">
          {/* Streak Card */}
          <div className="rounded-xl border border-zinc-100 bg-white p-2 shadow-sm dark:border-zinc-900 dark:bg-zinc-900/20">
            <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
              Streak
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-sm font-bold text-orange-600 dark:text-orange-400">
              <Flame className="h-3.5 w-3.5 fill-orange-500/10" />
              {snapshot.streak}x
            </p>
          </div>

          {/* Reward Card */}
          <div className="rounded-xl border border-zinc-100 bg-white p-2 shadow-sm dark:border-zinc-900 dark:bg-zinc-900/20">
            <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
              Next Reward
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-sm font-bold text-amber-600 dark:text-amber-500">
              <Zap className="h-3.5 w-3.5 fill-amber-500/10" />
              {snapshot.nextReward}
            </p>
          </div>

          {/* Active Quest Full Width Action Card */}
          <Link
            href={activeQuest.href}
            className="group col-span-2 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/40 p-2.5 transition-all hover:bg-emerald-50 dark:border-emerald-500/10 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/10"
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white shadow-sm group-hover:scale-105 transition-transform">
                <ActiveQuestIcon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-emerald-950 dark:text-emerald-300">
                  {activeQuest.label}
                </p>
                <p className="text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/70">
                  Active Quest
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-black text-emerald-600 dark:text-emerald-400 bg-white dark:bg-zinc-900 px-2 py-1 rounded-md border border-emerald-100/50 dark:border-zinc-800">
              +{activeQuest.xp} XP
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function QuickCategoriesSection({
  isId,
  mobile = false,
}: {
  isId: boolean;
  mobile?: boolean;
}) {
  const categories = getQuickCategories(isId);

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
          {categories.map(item => {
            const tone = toneClassNames(item.tone);
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-label={`${item.label}: ${item.description}`}
                className={cn(
                  'group relative flex min-h-[106px] flex-col items-center justify-center overflow-hidden rounded-[18px] px-1.5 py-2 text-center transition active:scale-[0.98]',
                )}
              >
                <span
                  className="absolute -right-5 -top-5 hidden h-20 w-20 rounded-full blur-xl transition group-hover:scale-125"
                />
                <span
                  className={cn(
                    'relative inline-flex h-12 w-12 items-center justify-center rounded-[15px] bg-white/88 shadow-[0_14px_24px_-20px_rgba(15,23,42,0.36)] ring-1 ring-white/70',
                    tone.surface,
                    tone.text,
                  )}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span className="relative mt-2 line-clamp-2 max-w-full text-[11.5px] font-black leading-[1.1] text-[color:var(--app-text)]">
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
          {categories.map(item => {
            const tone = toneClassNames(item.tone);
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-label={`${item.label}: ${item.description}`}
                className={cn(
                  'group relative min-h-[142px] overflow-hidden rounded-[18px] p-2.5 transition hover:-translate-y-0.5 ',
                )}
              >
                <span
                  className={cn(
                    'absolute -right-7 -top-7 h-16 w-16 rounded-full blur-2xl transition group-hover:scale-125',
                    tone.glow,
                  )}
                />
                <div className="relative flex h-full flex-col items-center text-center">
                  <span
                    className={cn(
                      'inline-flex h-14 w-14 items-center justify-center rounded-[17px] border bg-white/88 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.28)]',
                      tone.surface,
                      tone.text,
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <p className="mt-2.5 w-full truncate text-[0.92rem] font-black leading-5 tracking-[-0.025em] text-[color:var(--app-text)]">
                    {item.label}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-4 text-[color:var(--app-text-soft)]">
                    {item.description}
                  </p>
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
  const entityType = item.entityType || 'listing';

  return (
    <article
      className={cn(
        'flex h-full shrink-0 snap-start flex-col overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-white shadow-[0_16px_30px_-28px_rgba(15,23,42,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.2)]',
        mobile
          ? 'w-[190px] min-w-[190px]'
          : 'w-[220px] min-w-[220px]'
      )}
      data-testid="home-recommendation-card"
    >
      {/* IMAGE */}
      <div className="relative aspect-square overflow-hidden">
        <Link
          href={item.href}
          className="block h-full"
        >
          {item.images.length > 0 ? (
            <MediaPreviewCarousel
              items={item.images}
              alt={item.title}
              aspectClassName="h-full w-full"
              className="h-full w-full"
              controls={false}
              lightbox={false}
              showDots={item.images.length > 1}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]">
              <Package className="h-8 w-8" />
            </div>
          )}
        </Link>

        {/* BADGE */}
        {item.badge && (
          <span className={cn('absolute left-2 top-2 rounded-full px-2 py-1 text-[9px] font-bold', badgeTone.soft)}>
            {item.badge}
          </span>
        )}

        <span className="flex justify-center items-center absolute bottom-2 left-2 rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase text-[color:var(--app-accent)]">
          {item.typeLabel}
        </span>
      </div>

      {/* CONTENT */}
      <Link href={item.href} className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col p-2.5">

          {/* TITLE (FIXED HEIGHT 2 LINES STABLE) */}
          <h3 className="line-clamp-2 h-[2rem] text-[13px] font-bold leading-snug text-[color:var(--app-text)]">
            {item.title}
          </h3>

          {/* VENDOR (FIXED SLOT) */}
          <div className="mt-1 h-[14px]">
            {item.vendor && (
              <p className="truncate text-[10px] text-[color:var(--app-text-soft)]">
                {item.vendor}
              </p>
            )}
          </div>

          {/* PRICE BLOCK (FIXED HEIGHT SLOT) */}
          <div className="mt-auto pt-2">
            <div className="flex items-end justify-between gap-2">

              <div className="min-w-0">
                <p className="truncate text-[14px] font-black text-[color:var(--app-accent)]">
                  {item.price}
                </p>

                <p className="truncate text-[10px] text-[color:var(--app-text-soft)]">
                  {item.unit || ' '}
                </p>
              </div>

              <p className="max-w-[80px] truncate text-right text-[10px] text-[color:var(--app-text-soft)]">
                {item.location}
              </p>

            </div>
          </div>
        </div>
      </Link>

      {/* CTA (OUTSIDE FLOW → NO HEIGHT IMPACT) */}
      {/* <div className="grid grid-cols-[1fr_auto] gap-2 px-2.5 pb-2.5">
        <Link
          href={item.href}
          className="rounded-[10px] bg-[color:var(--app-surface-muted)] px-3 py-2 text-[10px] font-semibold text-[color:var(--app-text)] hover:text-[color:var(--app-accent)]"
        >
          {item.detailActionLabel || 'Detail'}
        </Link>

        <Link
          href={item.createHref}
          className="rounded-[10px] bg-[color:var(--app-accent)] px-3 py-2 text-[10px] font-semibold text-[color:var(--app-text-inverse)]"
        >
          {item.secondaryActionLabel || 'Create similar'}
        </Link>
      </div> */}
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
      <div>
        <SectionHeading
          title={isId ? 'Rekomendasi untuk Usaha' : 'Recommended for Business'}
          actionLabel={isId ? 'Lihat semua' : 'See all'}
          actionHref={UMKM_DISCOVERY_PATH}
        />
        <p className="mt-1 text-xs font-semibold leading-4 text-[color:var(--app-text-soft)]">
          {isId
            ? 'Geser untuk lihat supplier, jasa, lokasi, dan peluang usaha.'
            : 'Swipe through suppliers, services, locations, and business opportunities.'}
        </p>
      </div>
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
  isAuthenticated,
  activeTab,
  onTabChange,
  avatarSrc,
  overview,
  posts,
  loading = false,
  hasMore = false,
  onLoadMore,
  onCreated,
}: {
  isId: boolean;
  isAuthenticated: boolean;
  activeTab: CommunityTab;
  onTabChange: (tab: CommunityTab) => void;
  avatarSrc: string;
  overview: CommunityFeedOverview | null;
  posts: CommunityPost[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onCreated?: (item?: CommunityFeedItem) => void;
}) {
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [postOptionsOpen, setPostOptionsOpen] = useState(false);
  const [postOptionsCopied, setPostOptionsCopied] = useState(false);
  const [hiddenPostIds, setHiddenPostIds] = useState<Set<string>>(
    () => new Set(),
  );
  const tabs = getCommunityTabs(isId);
  const activeTabMeta = tabs.find(item => item.id === activeTab) || tabs[0]!;
  const ActiveTabIcon = activeTabMeta.icon;
  const activeTone = toneClassNames(activeTabMeta.tone);
  const visiblePosts = posts.filter(item => !hiddenPostIds.has(item.id));
  const post =
    visiblePosts.find(item => item.tab === activeTab) ||
    visiblePosts[0] ||
    null;
  const communityPostHref = post
    ? buildCommunityPostHref(post)
    : buildCommunityTabHref(activeTab);
  const openCommunityPost = () => router.push(communityPostHref);
  const activeTabHref = buildCommunityTabHref(activeTab);
  const morePosts = post
    ? visiblePosts.filter(item => item.id !== post.id)
    : visiblePosts.slice(1);
  const postMediaItems = post?.mediaItems?.length
    ? post.mediaItems
    : post?.mediaUrl
      ? [
        {
          src: post.mediaUrl,
          type: post.mediaType === 'video' ? 'video' : 'image',
          alt: post.title,
        } satisfies MediaPreviewItem,
      ]
      : [];
  const postMediaUrl =
    postMediaItems.length > 0 ? post?.mediaUrl || post?.image : null;
  const postIsVideo = post?.mediaType === 'video';
  const postStatsLabel = post
    ? post.kind === 'reel'
      ? `${post.views} ${isId ? 'tayangan' : 'views'} - ${post.comments} ${isId ? 'komentar' : 'comments'
      }`
      : `${post.comments} ${isId ? 'komentar' : 'comments'} - ${post.shares
      } ${isId ? 'bagikan' : 'shares'}`
    : '';

  const copyPostLink = async () => {
    if (!post) return;
    const href = buildCommunityPostHref(post);
    const url =
      typeof window === 'undefined'
        ? href
        : `${window.location.origin}${href.startsWith('/') ? href : `/${href}`}`;
    try {
      await navigator.clipboard?.writeText(url);
      setPostOptionsCopied(true);
      window.setTimeout(() => setPostOptionsCopied(false), 1600);
    } catch {
      setPostOptionsCopied(false);
    }
  };

  const hidePostFromHome = () => {
    if (!post) return;
    setHiddenPostIds(current => {
      const next = new Set(current);
      next.add(post.id);
      return next;
    });
    setPostOptionsOpen(false);
  };

  useEffect(() => {
    if (!hasMore || loading || !onLoadMore) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: '220px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, posts.length]);

  return (
    <section className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-1.5 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)] sm:p-2">
      <SectionHeading
        title={isId ? 'Dari Komunitas' : 'From the Community'}
        actionLabel={activeTabMeta.actionLabel}
        actionHref={activeTabHref}
      />
      <div className="mt-3 grid grid-cols-3 gap-2" data-auto-scrollbar>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const tone = toneClassNames(tab.tone);
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setPostOptionsOpen(false);
                setPostOptionsCopied(false);
                onTabChange(tab.id);
              }}
              className={cn(
                'flex min-h-[58px] min-w-0 flex-col justify-center rounded-[16px] border px-3 text-left transition',
                active
                  ? cn(tone.surface, tone.text, 'border-current shadow-sm')
                  : 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)] hover:border-[color:var(--app-accent-border)] hover:bg-slate-50',
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-black">
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    active ? tone.text : 'text-[color:var(--app-text-soft)]',
                  )}
                />
                <span className="truncate">{tab.label}</span>
              </span>
              <span className="mt-0.5 line-clamp-1 text-[10px] font-semibold leading-3 opacity-80">
                {tab.caption}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3">
        <CommunityComposer
          isId={isId}
          userAvatar={avatarSrc}
          isAuthenticated={isAuthenticated}
          overview={overview}
          onCreated={onCreated || (() => undefined)}
        />
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
                <Image
                  src={profileAvatarSrc(post.avatar)}
                  alt={post.author}
                  width={44}
                  height={44}
                  className="h-10 w-10 rounded-full object-cover"
                />
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
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setPostOptionsCopied(false);
                    setPostOptionsOpen(open => !open);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--app-text-soft)] transition hover:bg-slate-50 hover:text-[color:var(--app-text)]"
                  aria-label={isId ? 'Buka opsi posting' : 'Open post options'}
                  aria-expanded={postOptionsOpen}
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
                {postOptionsOpen ? (
                  <div
                    className="absolute right-0 top-10 z-20 w-56 overflow-hidden rounded-[16px] border border-[color:var(--app-border)] bg-white p-1.5 text-left shadow-[0_20px_44px_-26px_rgba(15,23,42,0.28)]"
                    onClick={event => event.stopPropagation()}
                  >
                    <Link
                      href={communityPostHref}
                      className="flex min-h-[38px] items-center justify-between gap-2 rounded-[12px] px-3 text-xs font-bold text-[color:var(--app-text)] hover:bg-slate-50"
                    >
                      {isId ? 'Buka detail posting' : 'Open post detail'}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => void copyPostLink()}
                      className="flex min-h-[38px] w-full items-center justify-between gap-2 rounded-[12px] px-3 text-left text-xs font-bold text-[color:var(--app-text)] hover:bg-slate-50"
                    >
                      {postOptionsCopied
                        ? isId
                          ? 'Link tersalin'
                          : 'Link copied'
                        : isId
                          ? 'Salin link'
                          : 'Copy link'}
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={hidePostFromHome}
                      className="flex min-h-[38px] w-full items-center justify-between gap-2 rounded-[12px] px-3 text-left text-xs font-bold text-[color:var(--app-text-soft)] hover:bg-slate-50"
                    >
                      {isId ? 'Sembunyikan di home' : 'Hide from home'}
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={activeTabHref}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black',
                  activeTone.soft,
                )}
              >
                <ActiveTabIcon className="h-3.5 w-3.5" />
                {activeTabMeta.label}
              </Link>
              <Link
                href={communityPostHref}
                className="inline-flex min-w-0 items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-[color:var(--app-text-soft)]"
              >
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{post.community}</span>
              </Link>
            </div>
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
          {postMediaItems.length > 0 ? (
            <Link
              href={communityPostHref}
              className="relative block overflow-hidden rounded-3xl aspect-[4/5] bg-slate-100"
            >
              {postIsVideo && postMediaItems.length === 1 ? (
                <video
                  src={postMediaUrl || ''}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              ) : (
                <MediaPreviewCarousel
                  items={postMediaItems}
                  alt={post.community}
                  aspectClassName="h-full w-full"
                  className="h-full w-full bg-transparent"
                  sizes="(max-width: 640px) 100vw, 720px"
                  controls={false}
                  lightbox={false}
                  showCounter={false}
                  showDots={false}
                />
              )}

              {post.kind === 'reel' ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/18 text-white">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/45">
                    <PlayCircle className="h-7 w-7" />
                  </span>
                </span>
              ) : null}
            </Link>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--app-border)] px-4 py-2.5 text-xs text-[color:var(--app-text-soft)]">
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-white">
                <ThumbsUp className="h-3.5 w-3.5" />
              </span>
              {post.likes}
            </span>
            <span>{postStatsLabel}</span>
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
          {activeTabMeta.emptyLabel}
        </div>
      )}
      {morePosts.length ? (
        <div className="mt-3 space-y-2">
          {morePosts.map(item => {
            const href = buildCommunityPostHref(item);
            const itemMediaItems = item.mediaItems?.length
              ? item.mediaItems
              : item.mediaUrl
                ? [
                  {
                    src: item.mediaUrl,
                    type: item.mediaType === 'video' ? 'video' : 'image',
                    alt: item.title,
                  } satisfies MediaPreviewItem,
                ]
                : [];
            return (
              <Link
                key={item.id}
                href={href}
                className="group flex min-w-0 items-start gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-white p-3 transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)]/40"
              >
                <Image
                  src={profileAvatarSrc(item.avatar)}
                  alt={item.author}
                  width={38}
                  height={38}
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                    <span className="truncate">{item.community}</span>
                    <span className="shrink-0">-</span>
                    <span className="shrink-0">{item.time}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-1 block text-sm font-black text-[color:var(--app-text)]">
                    {item.title}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-4 text-[color:var(--app-text-soft)]">
                    {item.body}
                  </span>
                </span>
                {itemMediaItems.length > 0 ? (
                  <span className="relative h-16 w-[86px] shrink-0 overflow-hidden rounded-[14px] bg-slate-100">
                    <MediaPreviewCarousel
                      items={itemMediaItems}
                      alt={item.title}
                      aspectClassName="h-full w-full"
                      className="h-full w-full bg-transparent"
                      mediaClassName="transition duration-300 group-hover:scale-[1.03]"
                      sizes="86px"
                      controls={false}
                      lightbox={false}
                      showCounter={false}
                      showDots={false}
                    />
                    {item.kind === 'reel' ? (
                      <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/16 text-white">
                        <PlayCircle className="h-7 w-7 drop-shadow" />
                      </span>
                    ) : itemMediaItems.length > 1 ? (
                      <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-black/58 px-1.5 py-0.5 text-[10px] font-black text-white">
                        +{itemMediaItems.length - 1}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
                )}
              </Link>
            );
          })}
        </div>
      ) : null}
      {hasMore || loading ? (
        <div ref={sentinelRef} className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white px-4 text-xs font-bold text-[color:var(--app-text)] disabled:opacity-55"
          >
            {loading
              ? activeTabMeta.loadingLabel
              : isId
                ? 'Muat lagi'
                : 'Load more'}
          </button>
        </div>
      ) : null}
      <div className="mt-4 flex items-center justify-end">
        <Link
          href={activeTabHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--app-accent)]"
        >
          {activeTabMeta.actionLabel}
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
              className="group relative aspect-[9/16] w-[174px] shrink-0 snap-start overflow-hidden rounded-[20px]"
              data-testid="home-reel-card"
              data-lajukan-event="home.card_clicked"
              data-lajukan-surface="home_reels"
              data-lajukan-entity-type="reel"
              data-lajukan-entity-id={item.id}
              data-lajukan-label={item.title}
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
              <span
                className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-emerald-700"
                title={item.category}
              >
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
              className="group relative aspect-[9/16] min-h-[250px] w-[172px] min-w-[172px] max-w-[172px] shrink-0 snap-start overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-slate-950 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.22)] xl:w-[186px] xl:min-w-[186px] xl:max-w-[186px]"
              data-testid="home-reel-card"
              data-lajukan-event="home.card_clicked"
              data-lajukan-surface="home_reels"
              data-lajukan-entity-type="reel"
              data-lajukan-entity-id={item.id}
              data-lajukan-label={item.title}
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
              <span
                className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-emerald-700"
                title={item.category}
              >
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
  locale,
  isAuthenticated,
  summary,
  primaryCtaHref,
  walletAmountLabel,
  walletModeLabel,
  walletLoading,
}: {
  isId: boolean;
  locale: string;
  isAuthenticated: boolean;
  summary: LajukanSummary | null;
  primaryCtaHref: string;
  walletAmountLabel?: string | null;
  walletModeLabel?: string | null;
  walletLoading?: boolean;
}) {
  const pulseItems = [
    {
      id: 'verified',
      label: isId ? 'Supplier siap' : 'Verified suppliers',
      value: resolveCountLabel(summary?.stores?.verified, '0'),
      icon: ShieldCheck,
      tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60',
    },
    {
      id: 'cities',
      label: isId ? 'Kota aktif' : 'Active cities',
      value: resolveCountLabel(summary?.stores?.cities, '0'),
      icon: MapPin,
      tone: 'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900/60',
    },
    {
      id: 'requests',
      label: isId ? 'Permintaan aktif' : 'Active requests',
      value: resolveCountLabel(summary?.requests?.active, '0'),
      icon: ClipboardList,
      tone: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60',
    },
  ];
  const pulseCtaLabel = isAuthenticated
    ? isId
      ? 'Posting sekarang'
      : 'Post now'
    : isId
      ? 'Mulai gratis'
      : 'Start free';
  const pulseHelperText = isId
    ? 'Upload listing, update info, lalu lanjut chat.'
    : 'Upload listings, keep them fresh, then continue in chat.';

  return (
    <aside className="lajukan-home-right-rail hidden min-w-0 xl:flex xl:h-full xl:max-h-full xl:min-h-0 xl:flex-col xl:overflow-hidden xl:pt-2">
      <div
        className="lajukan-home-right-rail-scroll flex h-full max-h-full min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden px-2.5 py-3 overscroll-contain"
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
        <DailyLoginRewardCard locale={locale} compact />
        <section className="lajukan-home-pulse-card flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fffb_100%)] p-3 shadow-[0_18px_36px_-32px_rgba(15,23,42,0.14)] dark:bg-[color:var(--app-surface)]">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                {isId ? 'Hari ini' : 'Today'}
              </p>
              <h2 className="mt-1 line-clamp-2 text-[1rem] font-black leading-tight tracking-[-0.035em] text-[color:var(--app-text)]">
                {isId
                  ? 'Lihat peluang, lalu lanjut chat.'
                  : 'Find opportunities, then continue in chat.'}
              </h2>
            </div>
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]">
              <BarChart3 className="h-4.5 w-4.5" />
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {pulseItems.map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="min-w-0 rounded-[15px] border border-[color:var(--app-border)] bg-white/86 px-2 py-2 text-center shadow-[0_10px_22px_-24px_rgba(15,23,42,0.16)] dark:bg-slate-950/42"
                >
                  <span
                    className={cn(
                      'mx-auto inline-flex h-7 w-7 items-center justify-center rounded-[11px] ring-1',
                      item.tone,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <p className="mt-1 text-[15px] font-black leading-none tracking-[-0.04em] text-[color:var(--app-text)]">
                    {item.value}
                  </p>
                  <p className="mt-1 truncate text-[10px] font-semibold leading-tight text-[color:var(--app-text-soft)]">
                    {item.label}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="mt-3 rounded-[15px] bg-[color:var(--app-accent-soft)] px-3 py-2 text-[11.5px] font-semibold leading-4 text-[color:var(--app-accent)]">
            {pulseHelperText}
          </p>

          <Link
            href={primaryCtaHref}
            className="mt-2 inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-[12px] font-black text-[color:var(--app-text-inverse)] shadow-[0_16px_30px_-24px_color-mix(in_srgb,var(--app-accent)_50%,transparent)] transition hover:brightness-105"
          >
            <Package className="h-4 w-4" />
            {pulseCtaLabel}
          </Link>
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
        className="mt-4 grid min-h-0 gap-4 lg:h-[calc(100%-5rem)] lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_288px] 2xl:grid-cols-[280px_minmax(0,1fr)_320px]"
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
  const [communityOverview, setCommunityOverview] =
    useState<CommunityFeedOverview | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityHasMore, setCommunityHasMore] = useState(false);
  const [communityOffset, setCommunityOffset] = useState(0);
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
        if (!response.ok) {
          if (active) setRecommendations([]);
          return;
        }
        const listingItems = extractContentItems(payload)
          .map(item => mapContentToRecommendation(item, isId))
          .filter((item): item is RecommendationItem => Boolean(item));
        if (!active) return;
        setRecommendations(
          listingItems.filter(
            (item, index, allItems) =>
              allItems.findIndex(candidate => candidate.id === item.id) === index,
          ).slice(0, 12),
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

  const loadCommunityPostsPage = useCallback(
    async (offset = 0) => {
      setCommunityLoading(true);
      try {
        const params = new URLSearchParams({
          tab: activeTab,
          limit: String(HOME_COMMUNITY_PAGE_SIZE),
          cursor: String(offset),
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
        if (!response.ok) return;
        const discussionItems = (payload?.items || []).filter(
          item => item.kind !== 'reel',
        );
        const mapped = discussionItems.map(item =>
          mapCommunityItemToPost(item, isId, activeTab),
        );
        setCommunityOverview(payload?.overview || null);
        setCommunityPosts(prev => {
          if (offset === 0) return mapped;
          const seen = new Set(prev.map(item => item.id));
          return [...prev, ...mapped.filter(item => !seen.has(item.id))];
        });
        setCommunityOffset(payload?.nextCursor ?? offset + mapped.length);
        setCommunityHasMore(Boolean(payload?.hasMore));
      } catch {
        if (offset === 0) setCommunityPosts([]);
        if (offset === 0) setCommunityOverview(null);
        setCommunityHasMore(false);
      } finally {
        setCommunityLoading(false);
      }
    },
    [activeTab, isId],
  );

  useEffect(() => {
    setCommunityPosts([]);
    setCommunityOverview(null);
    setCommunityOffset(0);
    setCommunityHasMore(false);
    void loadCommunityPostsPage(0);
  }, [loadCommunityPostsPage]);

  const loadMoreCommunityPosts = useCallback(() => {
    if (communityLoading || !communityHasMore) return;
    void loadCommunityPostsPage(communityOffset);
  }, [
    communityHasMore,
    communityLoading,
    communityOffset,
    loadCommunityPostsPage,
  ]);

  const handleCommunityComposerCreated = useCallback(
    (createdItem?: CommunityFeedItem) => {
      if (!createdItem) {
        void loadCommunityPostsPage(0);
        return;
      }

      if (createdItem.kind === 'reel') {
        void loadCommunityPostsPage(0);
        return;
      }

      const nextPost = mapCommunityItemToPost(createdItem, isId, activeTab);
      setCommunityPosts(current => [
        nextPost,
        ...current.filter(item => item.id !== nextPost.id),
      ]);
      setCommunityOverview(current =>
        current
          ? {
            ...current,
            stats: {
              ...current.stats,
              totalThreads: current.stats.totalThreads + 1,
              totalPosts: current.stats.totalPosts + 1,
            },
          }
          : current,
      );
    },
    [activeTab, isId, loadCommunityPostsPage],
  );

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
      register: 'Daftar Sekarang',
      inviteTitle: 'Masuk dulu, peluangnya ikut nempel',
      inviteDescription:
        'Login untuk simpan favorit, lanjut chat, dan dapat rekomendasi yang makin relevan.',
      inviteButton: 'Daftar Sekarang',
      searchPlaceholder: 'Cari supplier, jasa, lokasi...',
      searchButton: 'Cari',
    }
    : {
      help: 'Help',
      login: 'Login',
      register: 'Register Now',
      inviteTitle: 'Log in first, then the best leads follow you',
      inviteDescription:
        'Save favorites, continue chats, and get recommendations that feel more personal.',
      inviteButton: 'Register Now',
      searchPlaceholder: 'Search suppliers, services, places...',
      searchButton: 'Search',
    };

  const avatarSrc = profileAvatarSrc(
    user?.avatarUrl || user?.avatar_url,
    readProfileAvatarStyle(user),
    user?.fullName || user?.full_name || user?.email,
  );
  const primaryCtaHref = isAuthenticated ? '/create' : '/register';
  const handleSearchSubmit = (submittedQuery: string) => {
    const trimmedQuery = submittedQuery.trim();
    void trackLajukanEvent('search.submitted', {
      properties: {
        query: trimmedQuery,
        source: 'home_hero',
      },
    });
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
          label: isId ? 'Peta Usaha' : 'Business Map',
          caption: isId ? 'Usaha sekitar' : 'Nearby businesses',
          href: UMKM_DISCOVERY_PATH,
          icon: MapPin,
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
        ...(!PROMO_ONLY_MODE
          ? [
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
          ]
          : []),
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
          label: isId ? 'Peta Usaha' : 'Business Map',
          caption: isId ? 'Usaha sekitar' : 'Nearby businesses',
          href: UMKM_DISCOVERY_PATH,
          icon: MapPin,
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
        }
        // {
        //   id: 'opportunity',
        //   label: isId ? 'Peluang' : 'Business Opportunities',
        //   caption: isId ? 'Ide tumbuh' : 'Growth and expansion ideas',
        //   href: '/learn',
        //   icon: TrendingUp,
        // },
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
        ...(!PROMO_ONLY_MODE
          ? [
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
          ]
          : []),
      ],
    };

  if (authLoading) {
    return <HomeLoadingState />;
  }

  return (
    <MarketplacePageFrame>
      <main className="mx-auto w-full max-w-[720px] space-y-3.5 sm:space-y-4 lg:hidden">
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
        <DailyLoginRewardCard locale={locale} compact />
        <QuickCategoriesSection isId={isId} mobile />

        <HomeUmkmMapPreview locale={locale} />
        <RecommendationsSection isId={isId} items={recommendations} mobile />
        <ReelsPanel isId={isId} items={reels} mobile />
        <CommunityPanel
          isId={isId}
          isAuthenticated={isAuthenticated}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          avatarSrc={avatarSrc}
          overview={communityOverview}
          posts={communityPosts}
          loading={communityLoading}
          hasMore={communityHasMore}
          onLoadMore={loadMoreCommunityPosts}
          onCreated={handleCommunityComposerCreated}
        />
        <Footer />
      </main>

      <div className="lajukan-home-desktop-shell hidden min-h-0 min-w-0 lg:flex lg:flex-1 lg:flex-col">
        <div className="lajukan-home-desktop-grid relative z-0 mx-auto grid min-h-0 min-w-0 max-w-[1700px] flex-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_288px] 2xl:grid-cols-[280px_minmax(0,1fr)_320px]">
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
                <div className="mt-4">
                  <DailyLoginRewardCard locale={locale} />
                </div>
              </div>
              <QuickCategoriesSection isId={isId} />
              <HomeUmkmMapPreview locale={locale} />
              <RecommendationsSection isId={isId} items={recommendations} />
              <div className="grid gap-4">
                <ReelsPanel isId={isId} items={reels} />
                <CommunityPanel
                  isId={isId}
                  isAuthenticated={isAuthenticated}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  avatarSrc={avatarSrc}
                  overview={communityOverview}
                  posts={communityPosts}
                  loading={communityLoading}
                  hasMore={communityHasMore}
                  onLoadMore={loadMoreCommunityPosts}
                  onCreated={handleCommunityComposerCreated}
                />
              </div>
              <Footer />
            </div>
          </main>
          <RightRail
            isId={isId}
            locale={locale}
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
