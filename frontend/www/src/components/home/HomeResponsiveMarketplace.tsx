'use client';

import {
  LajukanImage as Image,
  LajukanImage,
} from '@/components/common/LajukanImage';
import {
  MediaPreviewCarousel,
  type MediaPreviewItem,
} from '@/components/common/MediaPreviewCarousel';
import { ExploreListingCard } from '@/components/explore/cards/ExploreListingCard';
import { EmblaDesktopControls } from '@/components/common/EmblaDesktopControls';
import { useEmblaWheelGestures } from '@/components/common/useEmblaWheelGestures';
import { CompactSeeAllLink } from '@/components/common/CompactSectionAction';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
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
  ArrowRight,
  type LucideIcon,
  Search,
  SlidersHorizontal,
  Video,
  Play,
   ExternalLink,
} from 'lucide-react';
import {
  MagnifyingGlassIcon,
  CubeIcon,
  BuildingStorefrontIcon,
  BriefcaseIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  PlayCircleIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/solid';
import { HomeUmkmMapPreview } from '@/components/home/HomeUmkmMapPreview';
import { useViewerLocation } from '@/components/super-app/useViewerLocation';
import { DailyLoginRewardCard } from '@/components/rewards/DailyLoginRewardCard';
import { SearchInput } from '@/components/ui/SearchInput';
import {
  Skeleton,
  SkeletonAvatar,
  SkeletonStack,
} from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { useChatInbox } from '@/context/ChatInboxContext';
import { Link, useRouter } from '@/i18n/navigation';
import {
  formatLajukanCountLabel,
  type LajukanSummary,
} from '@/lib/lajukan-marketplace';
import { formatDistanceKm } from '@/lib/geo/distance';
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
import { resolveListingSide } from '@/lib/content/listingSide';
import {
  isExplicitlyNonTransactional,
  readPublicReference,
} from '@/lib/content/publicReference';
import {
  homeDesktopGridClassName,
  MarketplacePageFrame,
} from '@/components/layout/MarketplacePageFrame';
import { FeedColumnFooter } from '@/components/layout/FeedColumnFooter';
import type {
  CommunityFeedItem,
  CommunityFeedOverview,
  CommunityFeedResponse,
} from '@/lib/community/types';
import { CommunityComposer } from '@/components/community/CommunityFeedClient';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import { UMKM_DISCOVERY_PATH } from '@/lib/umkmSurface';
import {
  LAJUKAN_EXPLORE_CATEGORIES,
  buildExploreCategoryHref,
  type LajukanExploreCategoryId,
} from '@/lib/discovery/lajukanCategories';
import { cn } from '@/lib/utils';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';
import useEmblaCarousel from 'embla-carousel-react';

type HomeContentSimpleProps = {
  locale: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const HOME_COMMUNITY_PAGE_SIZE = 6;
const HOME_COMMUNITY_REQUEST_TIMEOUT_MS = 12000;
const HOME_CONTENT_REQUEST_TIMEOUT_MS = 8000;

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

export interface QuickCategory {
  id: string;
  label: string;
  description: string;
  href: string;
  image: string;
  tone: Tone;
  badge?: string;

  // UI Configuration
  flip?: boolean;
  scale?: number;
  rotate?: number;
  offsetX?: number;
  offsetY?: number;
  imageSize?: number;
}

type QuickCategoryUiConfig = Pick<
  QuickCategory,
  'tone' | 'flip' | 'scale' | 'rotate' | 'offsetX' | 'offsetY' | 'imageSize'
>;

type TrendingSearchItem = {
  label: string;
  href: string;
  score?: number;
  count?: number;
  source?: string;
};

let trendingSearchCache: TrendingSearchItem[] | null = null;
let trendingSearchRequest: Promise<TrendingSearchItem[]> | null = null;

type RecommendationItem = {
  id: string;
  title: string;
  summary: string;
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
  distanceKm?: number | null;
  distanceLabel?: string | null;
  contentType: string;
  verified: boolean;
  side: 'supply' | 'demand';
  imageAttribution?: string;
};

type PublicReferenceItem = {
  id: string;
  title: string;
  summary: string;
  location: string;
  image?: string;
  href: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceLicense: string;
  sourceLicenseUrl: string;
  imageAttribution: string;
};

type PublicReferenceApiItem = {
  id?: unknown;
  name?: unknown;
  city?: unknown;
  address?: unknown;
  description?: unknown;
  public_path?: unknown;
  metadata?: unknown;
};

type PublicReferenceApiResponse = {
  data?: {
    items?: PublicReferenceApiItem[];
  };
};

type CommunityTab = 'for-you' | 'following' | 'community';

type CommunityPost = {
  id: string;
  threadId: string;
  postId?: string;

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

  likes: number;
  comments: number;
  shares: number;
  views: number;

  viewerVote: -1 | 0 | 1;
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
const HOME_HERO_IMAGE = '/images/hero/logo-grow.webp';

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

type ReelsPanelProps = {
  isId: boolean;
  items: ReelItem[];
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

type ToneClassNames = {
  text: string;
  icon: string;
  soft: string;
  surface: string;
  card: string;
  glow: string;
};

function toneClassNames(tone: Tone) {
  const map: Record<Tone, ToneClassNames> = {
    emerald: {
      text: 'text-emerald-600',
      icon: 'bg-emerald-200 text-emerald-600',
      soft: 'bg-emerald-200 text-emerald-600',
      surface: 'bg-emerald-50/60 border-emerald-100',
      card: 'bg-gradient-to-b from-white to-emerald-50/40 border-emerald-100',
      glow: 'bg-emerald-400/10',
    },

    blue: {
      text: 'text-blue-600',
      icon: 'bg-blue-200 text-blue-600',
      soft: 'bg-blue-200 text-blue-600',
      surface: 'bg-blue-50/60 border-blue-100',
      card: 'bg-gradient-to-b from-white to-blue-50/40 border-blue-100',
      glow: 'bg-blue-400/10',
    },

    teal: {
      text: 'text-teal-600',
      icon: 'bg-teal-200 text-teal-600',
      soft: 'bg-teal-200 text-teal-600',
      surface: 'bg-teal-50/60 border-teal-100',
      card: 'bg-gradient-to-b from-white to-teal-50/40 border-teal-100',
      glow: 'bg-teal-400/10',
    },

    violet: {
      text: 'text-violet-600',
      icon: 'bg-violet-200 text-violet-600',
      soft: 'bg-violet-200 text-violet-600',
      surface: 'bg-violet-50/60 border-violet-100',
      card: 'bg-gradient-to-b from-white to-violet-50/40 border-violet-100',
      glow: 'bg-violet-400/10',
    },

    amber: {
      text: 'text-amber-600',
      icon: 'bg-amber-200 text-amber-600',
      soft: 'bg-amber-200 text-amber-600',
      surface: 'bg-amber-50/60 border-amber-100',
      card: 'bg-gradient-to-b from-white to-amber-50/40 border-amber-100',
      glow: 'bg-amber-400/10',
    },

    rose: {
      text: 'text-rose-600',
      icon: 'bg-rose-200 text-rose-600',
      soft: 'bg-rose-200 text-rose-600',
      surface: 'bg-rose-50/60 border-rose-100',
      card: 'bg-gradient-to-b from-white to-rose-50/40 border-rose-100',
      glow: 'bg-rose-400/10',
    },

    cyan: {
      text: 'text-cyan-600',
      icon: 'bg-cyan-200 text-cyan-600',
      soft: 'bg-cyan-200 text-cyan-600',
      surface: 'bg-cyan-50/60 border-cyan-100',
      card: 'bg-gradient-to-b from-white to-cyan-50/40 border-cyan-100',
      glow: 'bg-cyan-400/10',
    },

    lime: {
      text: 'text-lime-600',
      icon: 'bg-lime-200 text-lime-600',
      soft: 'bg-lime-200 text-lime-600',
      surface: 'bg-lime-50/60 border-lime-100',
      card: 'bg-gradient-to-b from-white to-lime-50/40 border-lime-100',
      glow: 'bg-lime-400/10',
    },

    orange: {
      text: 'text-orange-600',
      icon: 'bg-orange-200 text-orange-600',
      soft: 'bg-orange-200 text-orange-600',
      surface: 'bg-orange-50/60 border-orange-100',
      card: 'bg-gradient-to-b from-white to-orange-50/40 border-orange-100',
      glow: 'bg-orange-400/10',
    },
  };

  return map[tone] ?? map.emerald;
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

function contentImageAttribution(item: ContentItem): string {
  const directAttribution = metadataText(item, 'image_attribution');
  if (directAttribution) return directAttribution;
  const imageCredit = item.metadata?.image_credit;
  if (
    !imageCredit ||
    typeof imageCredit !== 'object' ||
    Array.isArray(imageCredit)
  ) {
    return '';
  }
  return readText((imageCredit as Record<string, unknown>).provider);
}

function readContentDistanceKm(
  item: ContentItem,
  allowViewerDistance: boolean,
): number | null {
  if (!allowViewerDistance) return null;
  const metadata = item.metadata || {};
  const viewerDistance = readNumber(metadata.viewer_distance_km);
  if (viewerDistance !== null && viewerDistance >= 0) return viewerDistance;
  const direct = readNumber(
    (item as ContentItem & { distance_km?: unknown }).distance_km,
  );
  return direct !== null && direct >= 0 ? direct : null;
}

function formatRecommendationDistance(
  distanceKm: number | null,
): string | null {
  return formatDistanceKm(distanceKm);
}

type MobilePlatformSnapshot = {
  isMobile: boolean;
  isIos: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
};

const DEFAULT_MOBILE_PLATFORM_SNAPSHOT: MobilePlatformSnapshot = {
  isMobile: false,
  isIos: false,
  isAndroid: false,
  isStandalone: false,
};

let cachedMobilePlatformSnapshot = DEFAULT_MOBILE_PLATFORM_SNAPSHOT;

function sameMobilePlatformSnapshot(
  left: MobilePlatformSnapshot,
  right: MobilePlatformSnapshot,
) {
  return (
    left.isMobile === right.isMobile &&
    left.isIos === right.isIos &&
    left.isAndroid === right.isAndroid &&
    left.isStandalone === right.isStandalone
  );
}

function stableMobilePlatformSnapshot(next: MobilePlatformSnapshot) {
  if (sameMobilePlatformSnapshot(cachedMobilePlatformSnapshot, next)) {
    return cachedMobilePlatformSnapshot;
  }
  cachedMobilePlatformSnapshot = next;
  return next;
}

function detectMobilePlatform(): MobilePlatformSnapshot {
  if (typeof window === 'undefined') {
    return DEFAULT_MOBILE_PLATFORM_SNAPSHOT;
  }

  const ua = window.navigator.userAgent || '';
  const platform = window.navigator.platform || '';
  const maxTouchPoints = window.navigator.maxTouchPoints || 0;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === 'MacIntel' && maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobile =
    isIos ||
    isAndroid ||
    window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
  const standaloneNavigator = window.navigator as Navigator & {
    standalone?: boolean;
  };
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    standaloneNavigator.standalone === true;

  return stableMobilePlatformSnapshot({
    isMobile,
    isIos,
    isAndroid,
    isStandalone,
  });
}

function getServerMobilePlatformSnapshot() {
  return DEFAULT_MOBILE_PLATFORM_SNAPSHOT;
}

function subscribeMobilePlatform(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('resize', callback);
  window.addEventListener('orientationchange', callback);
  return () => {
    window.removeEventListener('resize', callback);
    window.removeEventListener('orientationchange', callback);
  };
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
  allowViewerDistance = false,
): RecommendationItem | null {
  if (!item.id || !item.title) return null;
  const images = resolveImageGallery(item);
  const image = images[0];
  const statsRating = item.seller_stats?.rating ?? item.rating;
  const statsReviews = item.seller_stats?.review_count ?? item.review_count;
  const type = item.content_type || item.category;
  const side = resolveListingSide({
    type,
    metadata: item.metadata,
    title: item.title,
    summary: item.summary,
  });
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
  const distanceKm = readContentDistanceKm(item, allowViewerDistance);

  return {
    id: item.id,
    title: item.title,
    summary: readText(item.summary) || readText(item.body),
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
    distanceKm,
    distanceLabel: formatRecommendationDistance(distanceKm),
    contentType: type || 'listing',
    verified: item.owner_profile?.identity_verified === true,
    side,
    imageAttribution: contentImageAttribution(item) || undefined,
  };
}

function mapContentToPublicReference(
  item: ContentItem,
): PublicReferenceItem | null {
  if (!item.id || !item.title) return null;
  const reference = readPublicReference(item);
  if (!reference) return null;
  const images = resolveImageGallery(item);

  return {
    id: item.id,
    title: item.title,
    summary: readText(item.summary) || readText(item.body),
    location: metadataText(item, 'city', 'location', 'address'),
    image: images[0],
    href: buildContentHref(item.id, item.title, item.slug),
    sourceTitle: reference.sourceTitle,
    sourceUrl: reference.sourceUrl,
    sourceLicense: reference.sourceLicense,
    sourceLicenseUrl: reference.sourceLicenseUrl,
    imageAttribution:
      reference.imageAttribution || contentImageAttribution(item),
  };
}

function mapApiItemToPublicReference(
  item: PublicReferenceApiItem,
): PublicReferenceItem | null {
  const id = readText(item.id);
  const title = readText(item.name);
  const metadata =
    item.metadata &&
    typeof item.metadata === 'object' &&
    !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : {};
  if (!id || !title) return null;

  const contentItem: ContentItem = {
    id,
    title,
    summary: readText(item.description),
    cover_image: readText(metadata.cover_image),
    metadata,
  };
  const mapped = mapContentToPublicReference(contentItem);
  if (!mapped) return null;
  const publicPath = readText(item.public_path);

  return {
    ...mapped,
    id,
    location:
      readText(item.address) ||
      readText(item.city) ||
      metadataText(contentItem, 'location'),
    href: publicPath.startsWith('/content/') ? publicPath : mapped.href,
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
    threadId: item.threadId,
    postId: item.postId || undefined,

    tab: activeTab,
    href: item.href || undefined,
    kind: isReel ? 'reel' : 'discussion',

    community:
      item.group?.name ||
      item.communityName ||
      (isReel
        ? isId
          ? 'Reels Usaha'
          : 'Business Reels'
        : isId
          ? 'Komunitas'
          : 'Community'),

    author:
      item.author?.name ||
      (isId ? 'Member Lajukan' : 'Lajukan member'),

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

    tags: (item.tags || [])
      .map(tag => tag.name || tag.slug)
      .filter(Boolean)
      .slice(0, 4),

    likes: Math.max(0, item.stats?.reactions ?? 0),
    comments: Math.max(0, item.stats?.comments ?? 0),
    shares: Math.max(0, item.stats?.shares ?? 0),
    views: Math.max(0, item.stats?.views ?? 0),

    viewerVote:
      item.viewerVote === 1
        ? 1
        : item.viewerVote === -1
          ? -1
          : 0,
  };
}

function buildCommunityMediaItems(
  item: CommunityFeedItem,
): MediaPreviewItem[] {
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
    mediaItems.push({
      src: cleanSrc,
      type,
      alt,
    });
  };

  for (const media of item.mediaItems || []) {
    addMedia(media.src, media.type, media.alt);
  }

  if (item.media) {
    addMedia(
      item.media.src,
      item.media.type,
      item.media.alt,
    );
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

const QUICK_CATEGORY_UI: Record<
  LajukanExploreCategoryId | 'map',
  QuickCategoryUiConfig
> = {
  equipment: {
    tone: 'emerald',
    flip: true,
    scale: 1,
    rotate: -5,
    offsetX: -20,
    offsetY: -16,
    imageSize: 70,
  },
  supplies: {
    tone: 'orange',
    flip: true,
    scale: 1,
    rotate: -5,
    offsetX: -20,
    offsetY: -16,
    imageSize: 70,
  },
  service: {
    tone: 'violet',
    flip: true,
    scale: 1,
    rotate: -5,
    offsetX: -20,
    offsetY: -16,
    imageSize: 70,
  },
  property: {
    tone: 'rose',
    flip: false,
    scale: 1,
    rotate: 5,
    offsetX: -24,
    offsetY: -16,
    imageSize: 70,
  },
  opportunity: {
    tone: 'cyan',
    flip: false,
    scale: 1,
    rotate: 5,
    offsetX: -24,
    offsetY: -16,
    imageSize: 70,
  },
  community: {
    tone: 'amber',
    flip: false,
    scale: 1.2,
    rotate: 5,
    offsetX: -24,
    offsetY: -16,
    imageSize: 70,
  },
  video: {
    tone: 'lime',
    flip: false,
    scale: 1.2,
    rotate: 5,
    offsetX: -24,
    offsetY: -16,
    imageSize: 70,
  },
  map: {
    tone: 'blue',
    flip: false,
    scale: 1.12,
    rotate: 3,
    offsetX: -24,
    offsetY: -16,
    imageSize: 70,
  },
};

export function getQuickCategories(isId: boolean): QuickCategory[] {
  const categories = LAJUKAN_EXPLORE_CATEGORIES.map(category => ({
    id: category.id,
    label: isId ? category.labelId : category.labelEn,
    description: isId ? category.descriptionId : category.descriptionEn,
    href:
      category.id === 'community'
        ? '/community'
        : category.id === 'video'
          ? '/reels'
          : buildExploreCategoryHref(category),
    image: category.image,
    badge: isId ? category.badge.labelId : category.badge.labelEn,
    ...QUICK_CATEGORY_UI[category.id],
  }));

  return [
    ...categories.slice(0, 4),
    {
      id: 'business-map',
      label: isId ? 'Peta Usaha' : 'Business Map',
      description: isId
        ? 'Lihat usaha terdekat berdasarkan lokasi.'
        : 'Find nearby businesses by location.',
      href: `${UMKM_DISCOVERY_PATH}?view=map`,
      image: '/images/hero/menu/map-01.png',
      badge: isId ? 'Dekat' : 'Nearby',
      ...QUICK_CATEGORY_UI.map,
    },
    ...categories.slice(4),
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
      <h2 className="text-[1.02rem] font-bold tracking-[-0.035em] text-[color:var(--app-text)] sm:text-[1.12rem]">
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
  const primaryItems = items.primary.slice(0, 5);
  const secondaryItems = items.secondary.slice(0, 2);

  const isItemActive = (item: SidebarItem) => {
    const itemPath = item.href.split('?')[0];
    return itemPath === '/home'
      ? currentPath === '/home' || currentPath === '/'
      : currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
  };

  const renderSidebarItem = (item: SidebarItem, compact = false) => {
    const Icon = item.icon;
    const active = isItemActive(item);

    return (
      <Link
        key={item.id}
        href={item.href}
        title={item.caption}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-[14px] px-2.5 transition',
          compact ? 'min-h-[40px] py-1.5' : 'min-h-[44px] py-2',
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
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-xs font-semibold">{item.label}</span>
          {item.locked ? (
            <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          ) : null}
          {item.badge ? (
            <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {item.badge}
            </span>
          ) : null}
        </span>
      </Link>
    );
  };

  return (
    <aside className="hidden lg:block lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div
        className="flex h-full max-h-full min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pb-6 pr-1"
        data-auto-scrollbar
      >
        <nav className="shrink-0 rounded-[22px] p-2.5">
          <div className="space-y-1">
            {primaryItems.map(item => renderSidebarItem(item))}
          </div>
          {secondaryItems.length > 0 ? (
            <>
              <div className="my-2 h-px bg-[color:var(--app-border)]" />
              <div className="space-y-1">
                {secondaryItems.map(item => renderSidebarItem(item, true))}
              </div>
            </>
          ) : null}
        </nav>
        <div className="m-2 shrink-0 overflow-hidden rounded-[20px] border border-emerald-100 bg-emerald-50/70 p-3 shadow-[0_18px_36px_-32px_rgba(22,163,74,0.22)]">
          <h3 className="line-clamp-1 text-[0.85rem] font-bold tracking-[-0.03em] text-[color:var(--app-text)]">
            {inviteTitle}
          </h3>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[color:var(--app-text-soft)]">
            {inviteDescription}
          </p>
          <Link
            href={inviteHref}
            className="mt-2 inline-flex min-h-[36px] w-full items-center justify-center rounded-[13px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-3 text-xs font-semibold text-[color:var(--app-text-inverse)]"
          >
            {inviteButton}
          </Link>
        </div>
      </div>
    </aside>
  );
}

function MobileAppDownloadSection({ isId }: { isId: boolean }) {
  const platform = useSyncExternalStore(
    subscribeMobilePlatform,
    detectMobilePlatform,
    getServerMobilePlatformSnapshot,
  );
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      );
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (!platform.isMobile || platform.isStandalone || installed) return null;

  const platformLabel = platform.isIos
    ? 'iOS'
    : platform.isAndroid
      ? 'Android'
      : 'Mobile';
  const buttonLabel = installPrompt
    ? isId
      ? `Install untuk ${platformLabel}`
      : `Install for ${platformLabel}`
    : platform.isIos
      ? isId
        ? 'Tambah ke Home Screen'
        : 'Add to Home Screen'
      : isId
        ? `Download aman untuk ${platformLabel}`
        : `Safe download for ${platformLabel}`;
  const helpText = platform.isIos
    ? isId
      ? 'Di Safari, tekan tombol Share lalu pilih Add to Home Screen. Ini memasang Lajukan dari browser resmi, bukan file APK.'
      : 'In Safari, tap Share, then Add to Home Screen. This installs Lajukan from the official browser flow, not an APK file.'
    : installPrompt
      ? isId
        ? 'Browser akan menampilkan prompt install resmi. Tidak ada file APK atau file tambahan yang perlu diunduh.'
        : 'Your browser will show the official install prompt. No APK or extra file is downloaded.'
      : isId
        ? 'Kalau prompt belum muncul, buka menu browser lalu pilih Install app atau Add to Home Screen.'
        : 'If the prompt is not available yet, open the browser menu and choose Install app or Add to Home Screen.';

  async function handleInstall() {
    void trackLajukanEvent('home.mobile_install.clicked', {
      properties: {
        platform: platform.isIos
          ? 'ios'
          : platform.isAndroid
            ? 'android'
            : 'mobile',
        prompt_available: Boolean(installPrompt),
      },
    });

    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
    if (choice?.outcome === 'accepted') setInstalled(true);
  }

  return (
    <section className="lg:hidden">
      <article className="overflow-hidden rounded-[22px] border border-emerald-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_58%,#eff6ff_100%)] p-3.5 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.2)]">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100">
            <Globe2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-slate-950">
              {isId ? 'Buka Lajukan lebih cepat' : 'Open Lajukan faster'}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-600">
              {isId
                ? 'Pasang sebagai aplikasi mobile dari browser resmi. Lebih cepat dibuka, tetap aman.'
                : 'Install it as a mobile app from your browser. Faster to open, still safe.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleInstall()}
          className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-600 px-4 text-sm font-bold text-white shadow-[0_16px_28px_-20px_rgba(22,163,74,0.55)]"
        >
          {buttonLabel}
          <ArrowRight className="h-4 w-4" />
        </button>

        <div className="mt-2 flex items-center gap-2 text-[10.5px] font-semibold leading-4 text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span>
            {isId
              ? 'Install resmi via browser. Jangan unduh APK dari sumber tidak dikenal.'
              : 'Official browser install. Do not download APKs from unknown sources.'}
          </span>
        </div>

        {showHelp ? (
          <p className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold leading-5 text-slate-600">
            {helpText}
          </p>
        ) : null}
      </article>
    </section>
  );
}

function HeroVisualStage({
  isId,
  className,
  query,
  onQueryChange,
  onSubmit,
  onOpenFilters,
}: {
  isId: boolean;
  className?: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (submittedQuery: string) => void;
  onOpenFilters: () => void;
}) {
  const { user, isAuthenticated } = useAuth();

  const displayName =
    user?.username || user?.fullName || user?.full_name || 'Sobat Bisnis';

  return (
    <section
      className={`mx-auto w-full max-w-7xl px-0 py-4 ${className || ''}`}
    >
      <div
        className={`
          relative overflow-hidden rounded-3xl bg-emerald-50/70
          px-4 py-5 sm:px-6 sm:py-7
          ${isAuthenticated ? 'min-h-[125px]' : 'min-h-[155px]'}
        `}
      >
        <div className="relative z-10 grid grid-cols-3 items-center gap-3">
          {/* LEFT */}
          <div className="col-span-2 flex flex-col justify-center">
            {isAuthenticated ? (
              <>
                <h1 className="text-[clamp(1.25rem,3vw,2.25rem)] font-black leading-[0.95] tracking-[-0.05em] text-zinc-950">
                  Halo,{' '}
                  <span className="text-emerald-600">{displayName} 👋</span>
                </h1>

                <p className="mt-2 max-w-xl text-xs font-semibold leading-5 text-zinc-600 sm:text-sm sm:leading-6">
                  Cari supplier, bahan usaha, jasa, tempat jualan, dan peluang
                  baru untuk usahamu.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-[clamp(1.4rem,3.5vw,2.75rem)] font-black leading-[0.95] tracking-[-0.06em] text-zinc-950">
                  Cari Kebutuhan
                  <br />
                  <span className="text-emerald-600">Usaha Lokal 🚀</span>
                </h1>

                <p className="mt-2 max-w-xl text-xs font-semibold leading-5 text-zinc-600 sm:text-sm sm:leading-6">
                  Temukan supplier, bahan, mesin, jasa, tempat usaha, dan
                  peluang bisnis untuk UMKM Indonesia.
                </p>
              </>
            )}
          </div>

          {/* RIGHT IMAGE */}
          {!isAuthenticated && (
            <div className="relative col-span-1 h-[110px] sm:h-[140px] md:h-[170px]">
              <Image
                src={HOME_HERO_IMAGE}
                alt="Lajukan Hero"
                width={500}
                height={500}
                priority
                className="
                  pointer-events-none absolute right-[-20px] top-1/2
                  w-[150px] -translate-y-1/2 object-contain
                  sm:w-[210px] md:w-[260px]
                "
              />
            </div>
          )}
        </div>
      </div>

      {/* SEARCH */}
      <div className="-mt-5 px-2">
        <form
          role="search"
          aria-label={isId ? 'Cari kebutuhan usaha' : 'Search business needs'}
          onSubmit={event => {
            event.preventDefault();
            onSubmit(query);
          }}
          className="ui-search-form ui-field-shell relative z-20 flex h-12 items-center gap-2 rounded-2xl border bg-white px-3 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.28)]"
        >
          <Search className="h-4 w-4 shrink-0 text-emerald-600" />

          <input
            type="search"
            name="q"
            enterKeyHint="search"
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder={
              isAuthenticated
                ? 'Cari kebutuhan usaha hari ini...'
                : 'Cari supplier, bahan usaha, jasa, atau peluang...'
            }
            className="
              min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-700
              placeholder:text-zinc-400 focus:outline-none
            "
          />

          <button
            type="button"
            onClick={onOpenFilters}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100"
            aria-label="Filter pencarian"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </form>
      </div>
    </section>
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
            <p className="text-sm font-bold leading-5 text-[color:var(--app-text)] dark:text-white">
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
                className="ui-pressable inline-flex min-h-9 items-center justify-center rounded-[12px] border border-emerald-200 bg-white px-3 text-[12px] font-bold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-400/20 dark:bg-white/[0.08] dark:text-emerald-100 dark:hover:bg-white/[0.12]"
              >
                {isId ? 'Masuk' : 'Login'}
              </Link>
              <Link
                href="/register"
                className="ui-pressable inline-flex min-h-9 items-center justify-center rounded-[12px] bg-[color:var(--app-accent)] px-3 text-[12px] font-bold text-white shadow-[0_12px_22px_-17px_rgba(4,120,87,0.82)] transition hover:bg-[color:var(--app-accent-strong)]"
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
            <span className="text-base font-bold tracking-tight">
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
            <span className="shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-zinc-900 px-2 py-1 rounded-md border border-emerald-100/50 dark:border-zinc-800">
              +{activeQuest.xp} XP
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

const FALLBACK_TRENDING_SEARCHES: TrendingSearchItem[] = [
  'Supplier kemasan',
  'Supplier bahan baku',
  'Stok grosir reseller',
  'Jasa foto produk',
  'Jasa website UMKM',
  'Lokasi usaha',
  'Mesin usaha',
].map(label => ({
  label,
  href: `/explore?q=${encodeURIComponent(label)}`,
  source: 'fallback',
}));

function normalizeTrendingItem(value: unknown): TrendingSearchItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<TrendingSearchItem>;
  const label = typeof item.label === 'string' ? item.label.trim() : '';
  const href = typeof item.href === 'string' ? item.href.trim() : '';
  if (!label || !href) return null;
  return {
    label: label.slice(0, 80),
    href,
    score: typeof item.score === 'number' ? item.score : undefined,
    count: typeof item.count === 'number' ? item.count : undefined,
    source: typeof item.source === 'string' ? item.source : undefined,
  };
}

async function loadTrendingSearches() {
  if (trendingSearchCache) return trendingSearchCache;
  if (trendingSearchRequest) return trendingSearchRequest;

  trendingSearchRequest = fetch('/api/home/trending-searches', {
    cache: 'no-store',
  })
    .then(async response => {
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { items?: unknown[] };
      };
      const items = (payload.data?.items || [])
        .map(normalizeTrendingItem)
        .filter((item): item is TrendingSearchItem => Boolean(item))
        .slice(0, 10);
      trendingSearchCache =
        items.length > 0 ? items : FALLBACK_TRENDING_SEARCHES;
      return trendingSearchCache;
    })
    .catch(() => {
      trendingSearchCache = FALLBACK_TRENDING_SEARCHES;
      return trendingSearchCache;
    })
    .finally(() => {
      trendingSearchRequest = null;
    });

  return trendingSearchRequest;
}

export function TrendingSearchSection({ isId }: { isId: boolean }) {
  const [items, setItems] = useState<TrendingSearchItem[]>(
    trendingSearchCache || FALLBACK_TRENDING_SEARCHES,
  );

  useEffect(() => {
    let active = true;

    void loadTrendingSearches().then(nextItems => {
      if (active) {
        setItems(nextItems);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'keepSnaps',
    dragFree: true,
    skipSnaps: true,
  });

  useEmblaWheelGestures(emblaApi);

  if (items.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="trending-search-title"
      className="w-full py-1.5 sm:py-2"
    >
      {/* HEADER */}
      <div className="flex h-6 items-center px-1 sm:px-3 md:px-6">
        <div className="flex min-w-0 items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" />

          <h2
            id="trending-search-title"
            className="truncate text-[11px] font-bold leading-none tracking-tight text-[color:var(--app-text)] sm:text-xs"
          >
            {isId ? 'Banyak dicari' : 'Trending'}
          </h2>

          <span className="hidden text-[10px] font-medium text-zinc-400 sm:inline">
            {isId ? 'Geser untuk melihat' : 'Swipe to explore'}
          </span>
        </div>
      </div>

      {/* CAROUSEL */}
      <div
        ref={emblaRef}
        className="
          mt-1 cursor-grab overflow-hidden
          contain-paint active:cursor-grabbing
        "
      >
        <div
          className="
            flex touch-pan-y gap-1.5
            px-1 py-0.5
            sm:gap-2 sm:px-3
            md:px-6
            [backface-visibility:hidden]
            [will-change:transform]
          "
        >
          {items.map(item => (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              onClick={() => {
                void trackLajukanEvent(
                  'home.trending_search.clicked',
                  {
                    properties: {
                      query: item.label,
                      source:
                        item.source || 'home_trending_searches',
                      score: item.score,
                      count: item.count,
                    },
                  },
                );
              }}
              className="
                inline-flex h-7 max-w-[150px] shrink-0
                select-none items-center
                rounded-full
                border border-zinc-200/80
                bg-zinc-50/70
                px-2.5
                text-[10px] font-medium
                text-zinc-600
                transition-colors duration-150

                hover:border-emerald-200
                hover:bg-emerald-50
                hover:text-emerald-700

                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-emerald-500/20

                sm:h-8
                sm:max-w-[180px]
                sm:px-3
                sm:text-[11px]
              "
              style={{
                backfaceVisibility: 'hidden',
              }}
            >
              <span className="truncate">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuickCategoriesSection({ isId }: { isId: boolean }) {
  const categories = getQuickCategories(isId);

  return (
    <section className="rounded-2xl border border-zinc-100 bg-gradient-to-b from-white to-zinc-50 p-3 shadow-sm">
      <div className="grid grid-cols-4 gap-2">
        {categories.map(item => {
          const toneStyle = toneClassNames(item.tone);

          return (
            <Link
              key={item.id}
              href={item.href}
              aria-label={item.label}
              className="group flex flex-col items-center rounded-2xl p-2 transition-transform hover:-translate-y-0.5"
            >
              <div
                className={`
                  relative
                  flex
                  h-14
                  w-14
                  items-center
                  justify-center
                  rounded-xl
                  border
                  shadow-sm
                  ${toneStyle.surface}
                `}
              >
                {/* Badge Container */}
                {item.badge && (
                  <div className="absolute left-0 top-0 z-20">
                    <div className="whitespace-nowrap bg-black px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.05em] text-white">
                      {item.badge}
                    </div>
                  </div>
                )}

                <div
                  className="absolute aspect-square flex items-center justify-center"
                  style={{
                    width: item.imageSize ?? 70,
                    right: item.offsetX ?? -18,
                    bottom: item.offsetY ?? -14,
                    transform: `
                      scaleX(${item.flip ? -1 : 1})
                      scale(${item.scale ?? 1})
                      rotate(${item.rotate ?? 0}deg)
                    `,
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.label}
                    className="
                      h-full
                      w-full
                      object-contain
                      transition-transform
                      duration-300
                      group-hover:scale-105
                      select-none
                      pointer-events-none
                    "
                  />
                </div>
              </div>

              <span className="mt-2 text-center text-[11px] font-semibold leading-tight text-zinc-700">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function RecommendationsSection({
  isId,
  items,
}: {
  isId: boolean;
  items: RecommendationItem[];
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'keepSnaps',
    dragFree: true,
    skipSnaps: true,
  });

  useEmblaWheelGestures(emblaApi);

  return (
    <section
      className="w-full py-1.5 sm:py-2"
      data-testid="home-recommendations-section"
      aria-label={
        isId
          ? 'Rekomendasi penawaran untuk usahamu'
          : 'Recommended offers for your business'
      }
    >
      {/* HEADER */}
      <div className="flex h-6 items-center gap-1.5 px-1 sm:px-3 md:px-6">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600" />

        <h2 className="truncate text-[11px] font-bold leading-none tracking-tight text-[color:var(--app-text)] sm:text-xs">
          {isId ? 'Rekomendasi untuk usahamu' : 'Recommended for you'}
        </h2>

        <span className="hidden text-[9px] font-medium text-zinc-400 sm:inline">
          {isId ? 'Supplier, jasa & alat' : 'Suppliers, services & tools'}
        </span>
      </div>

      {/* EMPTY */}
      {items.length === 0 ? (
        <div className="mt-1 px-1 sm:px-3 md:px-6">
          <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-3 py-3 text-center text-[10px] font-medium text-zinc-500">
            {isId
              ? 'Belum ada rekomendasi saat ini.'
              : 'No recommendations right now.'}
          </p>
        </div>
      ) : (
        /* CAROUSEL */
        <div
          ref={emblaRef}
          className="mt-1 cursor-grab overflow-hidden contain-paint active:cursor-grabbing"
        >
          <div
            className="
              flex touch-pan-y gap-2
              px-1 py-0.5
              sm:px-3
              md:px-6
              [backface-visibility:hidden]
              [will-change:transform]
            "
          >
            {items.map(item => (
              <div
                key={item.id}
                className="
                  w-[42vw]
                  min-w-[150px]
                  max-w-[190px]
                  shrink-0 select-none
                  sm:w-[190px]
                  sm:max-w-[190px]
                  md:w-[200px]
                  md:max-w-[200px]
                "
                style={{ backfaceVisibility: 'hidden' }}
              >
                <RecommendationCard
                  item={item}
                  isId={isId}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function PublicReferencesSection({
  isId,
  items,
}: {
  isId: boolean;
  items: PublicReferenceItem[];
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'keepSnaps',
    dragFree: true,
    skipSnaps: true,
  });

  useEmblaWheelGestures(emblaApi);

  if (items.length === 0) return null;

  return (
    <section
      className="w-full py-1.5 sm:py-2"
      data-testid="home-public-references-section"
      aria-label={
        isId
          ? 'Referensi lokasi usaha dari data publik'
          : 'Business location references from public data'
      }
    >
      {/* HEADER */}
      <div className="flex h-6 items-center gap-1.5 px-1 sm:px-3 md:px-6">
        <Globe2 className="h-3.5 w-3.5 shrink-0 text-blue-600" />

        <h2 className="truncate text-[11px] font-bold leading-none tracking-tight text-[color:var(--app-text)] sm:text-xs">
          {isId ? 'Referensi usaha sekitar' : 'Nearby references'}
        </h2>

        <span className="hidden text-[9px] font-medium text-zinc-400 sm:inline">
          {isId ? 'Data publik' : 'Public data'}
        </span>
      </div>

      {/* CAROUSEL */}
      <div
        ref={emblaRef}
        className="mt-1 cursor-grab overflow-hidden contain-paint active:cursor-grabbing"
      >
        <div
          className="
            flex touch-pan-y items-start gap-2
            px-1 py-0.5
            sm:px-3
            md:px-6
            [backface-visibility:hidden]
            [will-change:transform]
          "
        >
          {items.map(item => (
            <article
              key={item.id}
              className="
                flex
                w-[min(68vw,240px)]
                shrink-0
                flex-col
                overflow-hidden
                rounded-xl
                border border-zinc-200/80
                bg-white
                transition-colors
                hover:border-zinc-300
                sm:w-[230px]
                md:w-[240px]
              "
              style={{ backfaceVisibility: 'hidden' }}
            >
              {/* MAIN */}
              <Link
                href={item.href}
                className="
                  group flex flex-1 flex-col
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-blue-500
                  focus-visible:ring-inset
                "
              >
                {/* IMAGE */}
                <div className="relative aspect-[16/8.5] w-full shrink-0 overflow-hidden bg-zinc-100">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="
                        (max-width: 480px) 68vw,
                        (max-width: 768px) 230px,
                        240px
                      "
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-400">
                      <Globe2 className="h-5 w-5" />
                    </div>
                  )}

                  <span
                    className="
                      absolute left-2 top-2
                      max-w-[calc(100%-16px)]
                      truncate rounded-full
                      bg-white/90 px-2 py-0.5
                      text-[8px] font-semibold
                      text-zinc-600
                      backdrop-blur
                    "
                  >
                    {isId ? 'Referensi publik' : 'Public reference'}
                  </span>
                </div>

                {/* CONTENT */}
                <div className="flex flex-1 flex-col px-2.5 py-2">
                  <h3
                    className="
                      line-clamp-1
                      text-[11px]
                      font-bold
                      leading-4
                      text-zinc-900
                      transition-colors
                      group-hover:text-blue-700
                    "
                  >
                    {item.title}
                  </h3>

                  {item.location ? (
                    <p className="mt-1 flex min-w-0 items-center gap-1 text-[9px] font-medium text-zinc-500">
                      <MapPin className="h-3 w-3 shrink-0 text-zinc-400" />

                      <span className="truncate">
                        {item.location}
                      </span>
                    </p>
                  ) : null}
                </div>
              </Link>

              {/* SOURCE */}
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${isId ? 'Buka sumber' : 'Open source'}: ${
                  item.sourceTitle
                }`}
                className="
                  group/source
                  mx-2.5
                  flex min-h-8
                  items-center
                  justify-between
                  gap-2
                  border-t border-zinc-100
                  py-1.5
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-blue-500
                "
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[8px] font-semibold text-zinc-500">
                    {item.sourceTitle}
                  </p>

                  {item.sourceLicense ? (
                    <p className="truncate text-[7px] text-zinc-400">
                      {item.sourceLicense}
                    </p>
                  ) : null}
                </div>

                <span className="inline-flex shrink-0 items-center gap-0.5 text-[8px] font-semibold text-blue-600">
                  {isId ? 'Sumber' : 'Source'}

                  <ExternalLink className="h-2.5 w-2.5" />
                </span>
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RecommendationCard({
  item,
  isId,
}: {
  item: RecommendationItem;
  isId: boolean;
}) {
  const image = item.image || item.images?.[0];
  const price =
    item.unit && item.unit !== 'item'
      ? `${item.price} / ${item.unit}`
      : item.price;

  return (
    <a
      href={item.href}
      data-testid="home-recommendation-card"
      className="
        group flex min-h-0 gap-3 rounded-2xl border border-zinc-200
        bg-white p-2.5 transition hover:border-zinc-300 hover:shadow-sm
      "
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
        {image ? (
          <img
            src={image}
            alt={item.title}
            className="size-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-zinc-400">
            {isId ? 'Tanpa foto' : 'No image'}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="truncate text-[11px] font-bold uppercase tracking-wide text-zinc-500">
            {item.typeLabel}
          </span>

          {item.verified && (
            <span
              className="size-1.5 shrink-0 rounded-full bg-emerald-500"
              title={isId ? 'Terverifikasi' : 'Verified'}
            />
          )}
        </div>

        <h3 className="line-clamp-2 text-sm font-extrabold leading-[1.25] text-zinc-900">
          {item.title}
        </h3>

        <div className="mt-1.5 flex items-end justify-between gap-2">
          <div className="min-w-0">
            {price && (
              <p className="truncate text-sm font-black text-emerald-700">
                {price}
              </p>
            )}

            {(item.distanceLabel || item.location) && (
              <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                {item.distanceLabel || item.location}
              </p>
            )}
          </div>

          {item.side && (
            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-600">
              {item.side}
            </span>
          )}
        </div>
      </div>
    </a>
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
  loadError = null,
  onLoadMore,
  onCreated,
  onToggleLike,
  onSubmitComment,
  onSharePost,
  onRequireAuth,
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
  loadError?: string | null;
  onLoadMore?: () => void;
  onCreated?: (item?: CommunityFeedItem) => void;
  onToggleLike: (
    postId: string,
    liked: boolean,
  ) => Promise<void> | void;
  onSubmitComment: (
    postId: string,
    body: string,
  ) => Promise<void> | void;
  onSharePost?: (postId: string) => Promise<void> | void;
  onRequireAuth?: () => void;
}) {
  const router = useRouter();

  const postOptionsRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const [postOptionsOpen, setPostOptionsOpen] = useState(false);
  const [postOptionsCopied, setPostOptionsCopied] = useState(false);

  const [shareFeedback, setShareFeedback] = useState<
    'shared' | 'copied' | null
  >(null);

  const [hiddenPostIds, setHiddenPostIds] = useState<Set<string>>(
    () => new Set(),
  );

  const [likeOverrides, setLikeOverrides] = useState<
    Record<string, boolean>
  >({});

  const [likeCountOverrides, setLikeCountOverrides] = useState<
    Record<string, number>
  >({});

  const [commentCountDeltas, setCommentCountDeltas] = useState<
    Record<string, number>
  >({});

  const [pendingLikeIds, setPendingLikeIds] = useState<Set<string>>(
    () => new Set(),
  );

  const [commentOpen, setCommentOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [interactionError, setInteractionError] = useState<
    string | null
  >(null);

  /* ================= DATA ================= */

  const tabs = getCommunityTabs(isId);

  const activeTabMeta =
    tabs.find(item => item.id === activeTab) || tabs[0]!;

  const visiblePosts = posts.filter(
    item => !hiddenPostIds.has(item.id),
  );

  const post =
    visiblePosts.find(item => item.tab === activeTab) ||
    visiblePosts[0] ||
    null;

  const communityPostHref = post
    ? buildCommunityPostHref(post)
    : buildCommunityTabHref(activeTab);

  const morePosts = post
    ? visiblePosts.filter(item => item.id !== post.id)
    : visiblePosts.slice(1);

  const postMediaItems = post?.mediaItems?.length
    ? post.mediaItems
    : post?.mediaUrl
      ? [
          {
            src: post.mediaUrl,
            type:
              post.mediaType === 'video'
                ? 'video'
                : 'image',
            alt: post.title,
          } satisfies MediaPreviewItem,
        ]
      : [];

  const postMediaUrl =
    postMediaItems.length > 0
      ? post?.mediaUrl || post?.image
      : null;

  const postIsVideo = post?.mediaType === 'video';

  const postInitiallyLiked = post?.viewerVote === 1;

  const postLiked = post
    ? (likeOverrides[post.id] ?? postInitiallyLiked)
    : false;

  const postLikeCount = post
    ? (likeCountOverrides[post.id] ?? post.likes)
    : 0;

  const postCommentCount = post
    ? post.comments +
      (commentCountDeltas[post.id] ?? 0)
    : 0;

  const postLikePending = post
    ? pendingLikeIds.has(post.id)
    : false;

  /* ================= HELPERS ================= */

  const buildAbsolutePostUrl = (
    targetPost: CommunityPost,
  ) => {
    const href = buildCommunityPostHref(targetPost);

    if (typeof window === 'undefined') {
      return href;
    }

    return `${window.location.origin}${
      href.startsWith('/') ? href : `/${href}`
    }`;
  };

  const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');

    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand('copy');

    textarea.remove();

    if (!copied) {
      throw new Error('Unable to copy link');
    }
  };

  const openCommunityPost = () => {
    if (!post) return;

    router.push(communityPostHref);
  };

  const requireAuthentication = () => {
    setInteractionError(
      isId
        ? 'Masuk terlebih dahulu untuk menggunakan fitur ini.'
        : 'Sign in first to use this feature.',
    );

    onRequireAuth?.();
  };

  const isInteractiveTarget = (
    target: EventTarget | null,
  ) =>
    target instanceof Element &&
    Boolean(
      target.closest(
        [
          'a',
          'button',
          'input',
          'textarea',
          'select',
          'label',
          'form',
          '[role="button"]',
          '[data-card-interactive="true"]',
        ].join(','),
      ),
    );

  /* ================= OPTIONS ================= */

  const copyPostLink = async () => {
    if (!post) return;

    try {
      await copyText(buildAbsolutePostUrl(post));

      setPostOptionsCopied(true);

      window.setTimeout(
        () => setPostOptionsCopied(false),
        1600,
      );
    } catch {
      setPostOptionsCopied(false);

      setInteractionError(
        isId
          ? 'Link belum berhasil disalin.'
          : 'The link could not be copied.',
      );
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

  /* ================= LIKE ================= */

  const toggleLike = async () => {
    if (!post || postLikePending) return;

    if (!isAuthenticated) {
      requireAuthentication();
      return;
    }

    setInteractionError(null);

    const previousLiked = postLiked;
    const previousCount = postLikeCount;

    const nextLiked = !previousLiked;

    const nextCount = Math.max(
      0,
      previousCount + (nextLiked ? 1 : -1),
    );

    setLikeOverrides(current => ({
      ...current,
      [post.id]: nextLiked,
    }));

    setLikeCountOverrides(current => ({
      ...current,
      [post.id]: nextCount,
    }));

    setPendingLikeIds(current => {
      const next = new Set(current);

      next.add(post.id);

      return next;
    });

    try {
      await onToggleLike(
        post.threadId,
        nextLiked,
      );
    } catch {
      setLikeOverrides(current => ({
        ...current,
        [post.id]: previousLiked,
      }));

      setLikeCountOverrides(current => ({
        ...current,
        [post.id]: previousCount,
      }));

      setInteractionError(
        isId
          ? 'Suka belum berhasil diperbarui. Coba lagi.'
          : 'The like could not be updated. Try again.',
      );
    } finally {
      setPendingLikeIds(current => {
        const next = new Set(current);

        next.delete(post.id);

        return next;
      });
    }
  };

  /* ================= COMMENT ================= */

  const openInlineComment = () => {
    if (!post) return;

    if (!isAuthenticated) {
      requireAuthentication();
      return;
    }

    setInteractionError(null);

    setCommentOpen(current => !current);

    if (!commentOpen) {
      window.requestAnimationFrame(() => {
        commentInputRef.current?.focus();
      });
    }
  };

  const submitInlineComment = async () => {
    if (!post || commentSubmitting) return;

    if (!isAuthenticated) {
      requireAuthentication();
      return;
    }

    const body = commentDraft.trim();

    if (!body) {
      commentInputRef.current?.focus();
      return;
    }

    setCommentSubmitting(true);
    setInteractionError(null);

    try {
      await onSubmitComment(
        post.threadId,
        body,
      );

      setCommentDraft('');

      setCommentCountDeltas(current => ({
        ...current,
        [post.id]:
          (current[post.id] ?? 0) + 1,
      }));

      window.requestAnimationFrame(() => {
        commentInputRef.current?.focus();
      });
    } catch {
      setInteractionError(
        isId
          ? 'Komentar belum berhasil dikirim. Coba lagi.'
          : 'The comment could not be posted. Try again.',
      );
    } finally {
      setCommentSubmitting(false);
    }
  };

  /* ================= SHARE ================= */

  const shareCurrentPost = async () => {
    if (!post) return;

    const url = buildAbsolutePostUrl(post);

    setInteractionError(null);
    setShareFeedback(null);

    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: post.body.slice(0, 140),
          url,
        });

        setShareFeedback('shared');
      } else {
        await copyText(url);

        setShareFeedback('copied');
      }

      await onSharePost?.(post.id);

      window.setTimeout(
        () => setShareFeedback(null),
        1800,
      );
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        return;
      }

      try {
        await copyText(url);

        setShareFeedback('copied');

        await onSharePost?.(post.id);

        window.setTimeout(
          () => setShareFeedback(null),
          1800,
        );
      } catch {
        setInteractionError(
          isId
            ? 'Posting belum berhasil dibagikan.'
            : 'The post could not be shared.',
        );
      }
    }
  };

  /* ================= RESET ================= */

  useEffect(() => {
    setPostOptionsOpen(false);
    setPostOptionsCopied(false);
    setShareFeedback(null);
    setCommentOpen(false);
    setCommentDraft('');
    setInteractionError(null);
  }, [activeTab, post?.id]);

  /* ================= OPTIONS OUTSIDE CLICK ================= */

  useEffect(() => {
    if (!postOptionsOpen) return;

    const handlePointerDown = (
      event: PointerEvent,
    ) => {
      const target = event.target as Node | null;

      if (
        !target ||
        postOptionsRef.current?.contains(target)
      ) {
        return;
      }

      setPostOptionsOpen(false);
    };

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        setPostOptionsOpen(false);
      }
    };

    document.addEventListener(
      'pointerdown',
      handlePointerDown,
    );

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown,
      );

      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [postOptionsOpen]);

  /* ================= TABS CAROUSEL ================= */

  const [emblaTabsRef, emblaTabsApi] =
    useEmblaCarousel({
      align: 'start',
      containScroll: 'keepSnaps',
      dragFree: true,
      skipSnaps: true,
    });

  useEmblaWheelGestures(emblaTabsApi);

  return (
    <section
      className="
        lajukan-home-community-panel
        relative z-[1] w-full
        py-1.5 sm:py-2
      "
      aria-label={
        isId
          ? 'Dari komunitas'
          : 'From community'
      }
    >
      {/* ================= HEADER ================= */}

      <div className="flex h-6 items-center gap-1.5 px-1 sm:px-3 md:px-6">
        <Users className="h-3.5 w-3.5 shrink-0 text-emerald-600" />

        <h2 className="truncate text-[11px] font-bold leading-none tracking-tight text-[color:var(--app-text)] sm:text-xs">
          {isId
            ? 'Dari Komunitas'
            : 'From Community'}
        </h2>

        <span className="hidden truncate text-[9px] font-medium text-zinc-400 sm:inline">
          {isId
            ? 'Diskusi pelaku usaha'
            : 'Business discussions'}
        </span>
      </div>

      {/* ================= TABS ================= */}

      <div
        ref={emblaTabsRef}
        className="
          mt-1 cursor-grab
          select-none overflow-hidden
          contain-paint
          active:cursor-grabbing
        "
      >
        <div
          role="tablist"
          aria-label={
            isId
              ? 'Kategori komunitas'
              : 'Community categories'
          }
          className="
            flex touch-pan-y gap-1.5
            px-1 py-0.5
            sm:px-3
            md:px-6
            [backface-visibility:hidden]
            [will-change:transform]
          "
        >
          {tabs.map(tab => {
            const Icon = tab.icon;

            const tone =
              toneClassNames(tab.tone);

            const active =
              activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setPostOptionsOpen(false);
                  setPostOptionsCopied(false);
                  onTabChange(tab.id);
                }}
                className={cn(
                  `
                    inline-flex h-7 shrink-0
                    items-center gap-1.5
                    rounded-full border
                    px-2.5
                    text-[10px] font-semibold
                    outline-none
                    transition-colors

                    focus-visible:ring-2
                    focus-visible:ring-zinc-400/30
                  `,
                  active
                    ? cn(
                        tone.surface,
                        tone.text,
                        'border-transparent',
                      )
                    : `
                        border-zinc-200/80
                        bg-zinc-50/70
                        text-zinc-600

                        hover:border-zinc-300
                        hover:bg-zinc-100
                        hover:text-zinc-800
                      `,
                )}
              >
                <Icon
                  className={cn(
                    'h-3 w-3 shrink-0',
                    !active &&
                      'text-zinc-400',
                  )}
                />

                <span className="whitespace-nowrap">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= COMPOSER ================= */}

      <div className="mt-1.5">
        <CommunityComposer
          isId={isId}
          userAvatar={avatarSrc}
          isAuthenticated={isAuthenticated}
          overview={overview}
          onCreated={
            onCreated ||
            (() => undefined)
          }
        />
      </div>

      {/* ================= PRIMARY POST ================= */}

      {post ? (
        <article
          tabIndex={0}
          aria-label={
            isId
              ? `Buka posting ${post.title}`
              : `Open post ${post.title}`
          }
          onClick={event => {
            if (
              isInteractiveTarget(
                event.target,
              )
            ) {
              return;
            }

            openCommunityPost();
          }}
          onKeyDown={event => {
            if (
              event.target !==
              event.currentTarget
            ) {
              return;
            }

            if (
              event.key !== 'Enter' &&
              event.key !== ' '
            ) {
              return;
            }

            event.preventDefault();

            openCommunityPost();
          }}
          className="
            mt-1.5 cursor-pointer
            overflow-hidden
            rounded-[18px]
            border border-[color:var(--app-border)]
            bg-white
            transition-colors

            hover:border-[color:var(--app-accent-border)]

            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-[color:var(--app-accent)]/30
          "
        >
          {/* ================= POST HEADER ================= */}

          <div className="p-3">
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <Image
                  src={profileAvatarSrc(
                    post.avatar,
                  )}
                  alt={post.author}
                  width={36}
                  height={36}
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />

                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold leading-4 tracking-[-0.02em] text-[color:var(--app-text)]">
                    {post.author}
                  </p>

                  <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] font-medium text-[color:var(--app-text-soft)]">
                    <span className="truncate">
                      {post.community}
                    </span>

                    <span
                      className="shrink-0"
                      aria-hidden="true"
                    >
                      ·
                    </span>

                    <span className="shrink-0">
                      {post.time}
                    </span>

                    <Globe2 className="h-3 w-3 shrink-0" />
                  </p>
                </div>
              </div>

              {/* OPTIONS */}

              <div
                ref={postOptionsRef}
                className="relative shrink-0"
              >
                <button
                  type="button"
                  onClick={() => {
                    setPostOptionsCopied(
                      false,
                    );

                    setPostOptionsOpen(
                      open => !open,
                    );
                  }}
                  className="
                    inline-flex h-8 w-8
                    items-center justify-center
                    rounded-full
                    text-[color:var(--app-text-soft)]
                    transition-colors

                    hover:bg-slate-50
                    hover:text-[color:var(--app-text)]
                  "
                  aria-label={
                    isId
                      ? 'Buka opsi posting'
                      : 'Open post options'
                  }
                  aria-expanded={
                    postOptionsOpen
                  }
                  aria-haspopup="menu"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>

                {postOptionsOpen ? (
                  <div
                    role="menu"
                    className="
                      absolute right-0 top-9 z-20
                      w-52 overflow-hidden
                      rounded-[14px]
                      border border-[color:var(--app-border)]
                      bg-white p-1
                      text-left
                      shadow-[0_20px_44px_-26px_rgba(15,23,42,0.28)]
                    "
                    onClick={event =>
                      event.stopPropagation()
                    }
                  >
                    <Link
                      href={
                        communityPostHref
                      }
                      role="menuitem"
                      className="
                        flex min-h-9
                        items-center
                        justify-between
                        gap-2 rounded-[10px]
                        px-2.5
                        text-[11px] font-bold
                        text-[color:var(--app-text)]

                        hover:bg-slate-50
                      "
                    >
                      {isId
                        ? 'Buka detail'
                        : 'Open detail'}

                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        void copyPostLink()
                      }
                      className="
                        flex min-h-9 w-full
                        items-center
                        justify-between
                        gap-2 rounded-[10px]
                        px-2.5
                        text-left
                        text-[11px] font-bold
                        text-[color:var(--app-text)]

                        hover:bg-slate-50
                      "
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
                      role="menuitem"
                      onClick={
                        hidePostFromHome
                      }
                      className="
                        flex min-h-9 w-full
                        items-center
                        justify-between
                        gap-2 rounded-[10px]
                        px-2.5
                        text-left
                        text-[11px] font-bold
                        text-[color:var(--app-text-soft)]

                        hover:bg-slate-50
                      "
                    >
                      {isId
                        ? 'Sembunyikan'
                        : 'Hide'}

                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* ================= POST TEXT ================= */}

            <h3 className="mt-2 line-clamp-2 text-[13px] font-bold leading-[18px] text-[color:var(--app-text)]">
              {post.title}
            </h3>

            {post.body ? (
              <p className="mt-1 line-clamp-2 text-[11px] leading-[17px] text-[color:var(--app-text-soft)]">
                {post.body}
              </p>
            ) : null}

            {/* TAGS */}

            {post.tags.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {post.tags
                  .slice(0, 3)
                  .map(tag => (
                    <Link
                      key={tag}
                      href={`/community?tag=${encodeURIComponent(
                        tag,
                      )}`}
                      className="
                        rounded-full
                        bg-slate-50
                        px-2 py-0.5
                        text-[9px] font-semibold
                        text-[color:var(--app-text-soft)]
                        transition-colors

                        hover:bg-slate-100
                        hover:text-[color:var(--app-text)]
                      "
                    >
                      #{tag}
                    </Link>
                  ))}

                {post.tags.length > 3 ? (
                  <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[9px] font-semibold text-zinc-400">
                    +{post.tags.length - 3}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* ================= MEDIA ================= */}

          {postMediaItems.length > 0 ? (
            <Link
              href={communityPostHref}
              className="
                relative block
                aspect-[4/3] w-full
                overflow-hidden bg-slate-100
                sm:aspect-[16/9]
              "
              aria-label={
                isId
                  ? 'Buka media posting'
                  : 'Open post media'
              }
            >
              {postIsVideo &&
              postMediaItems.length ===
                1 ? (
                <video
                  src={
                    postMediaUrl || ''
                  }
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              ) : (
                <MediaPreviewCarousel
                  items={
                    postMediaItems
                  }
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
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/16 text-white">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/45">
                    <PlayCircle className="h-6 w-6" />
                  </span>
                </span>
              ) : null}
            </Link>
          ) : null}

          {/* ================= ERROR ================= */}

          {interactionError ? (
            <p
              role="alert"
              className="
                border-t border-rose-100
                bg-rose-50
                px-3 py-1.5
                text-[10px] font-semibold
                text-rose-700
              "
            >
              {interactionError}
            </p>
          ) : null}

          {/* ================= ACTIONS ================= */}

          <div className="grid grid-cols-3 border-t border-[color:var(--app-border)] px-1.5 py-1 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
            {/* LIKE */}

            <button
              type="button"
              onClick={() =>
                void toggleLike()
              }
              disabled={postLikePending}
              aria-pressed={postLiked}
              aria-label={
                postLiked
                  ? isId
                    ? `Batalkan suka${
                        postLikeCount > 0
                          ? `, ${postLikeCount} suka`
                          : ''
                      }`
                    : `Unlike${
                        postLikeCount > 0
                          ? `, ${postLikeCount} likes`
                          : ''
                      }`
                  : isId
                    ? `Suka${
                        postLikeCount > 0
                          ? `, ${postLikeCount} suka`
                          : ''
                      }`
                    : `Like${
                        postLikeCount > 0
                          ? `, ${postLikeCount} likes`
                          : ''
                      }`
              }
              title={
                postLiked
                  ? isId
                    ? 'Kamu menyukai posting ini'
                    : 'You liked this post'
                  : isId
                    ? 'Suka'
                    : 'Like'
              }
              className={cn(
                `
                  inline-flex min-h-9
                  items-center justify-center
                  gap-1.5 rounded-[10px]
                  px-2
                  transition-colors

                  disabled:cursor-not-allowed
                  disabled:opacity-60
                `,
                postLiked
                  ? `
                      bg-emerald-50
                      text-emerald-700
                    `
                  : `
                      hover:bg-slate-50
                      hover:text-[color:var(--app-accent)]
                    `,
              )}
            >
              <ThumbsUp
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  postLiked &&
                    'fill-current',
                )}
              />

              {postLikeCount > 0 ? (
                <span className="tabular-nums">
                  {formatCompactCount(
                    postLikeCount,
                    '0',
                  )}
                </span>
              ) : null}
            </button>

            {/* COMMENT */}

            <button
              type="button"
              onClick={
                openInlineComment
              }
              aria-expanded={commentOpen}
              aria-label={
                isId
                  ? `Komentar${
                      postCommentCount >
                      0
                        ? `, ${postCommentCount} komentar`
                        : ''
                    }`
                  : `Comment${
                      postCommentCount >
                      0
                        ? `, ${postCommentCount} comments`
                        : ''
                    }`
              }
              title={
                isId
                  ? 'Komentar'
                  : 'Comment'
              }
              className={cn(
                `
                  inline-flex min-h-9
                  items-center justify-center
                  gap-1.5 rounded-[10px]
                  px-2
                  transition-colors

                  hover:bg-slate-50
                  hover:text-[color:var(--app-accent)]
                `,
                commentOpen &&
                  `
                    bg-[color:var(--app-accent-soft)]
                    text-[color:var(--app-accent)]
                  `,
              )}
            >
              <MessageCircle
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  commentOpen &&
                    'fill-current',
                )}
              />

              {postCommentCount >
              0 ? (
                <span className="tabular-nums">
                  {formatCompactCount(
                    postCommentCount,
                    '0',
                  )}
                </span>
              ) : null}
            </button>

            {/* SHARE */}

            <button
              type="button"
              onClick={() =>
                void shareCurrentPost()
              }
              aria-label={
                isId
                  ? `Bagikan${
                      post.shares > 0
                        ? `, ${post.shares} kali dibagikan`
                        : ''
                    }`
                  : `Share${
                      post.shares > 0
                        ? `, ${post.shares} shares`
                        : ''
                    }`
              }
              title={
                shareFeedback ===
                'copied'
                  ? isId
                    ? 'Link tersalin'
                    : 'Link copied'
                  : shareFeedback ===
                      'shared'
                    ? isId
                      ? 'Berhasil dibagikan'
                      : 'Shared successfully'
                    : isId
                      ? 'Bagikan'
                      : 'Share'
              }
              className={cn(
                `
                  inline-flex min-h-9
                  items-center justify-center
                  gap-1.5 rounded-[10px]
                  px-2
                  transition-colors

                  hover:bg-slate-50
                  hover:text-[color:var(--app-accent)]
                `,
                shareFeedback &&
                  `
                    bg-[color:var(--app-accent-soft)]
                    text-[color:var(--app-accent)]
                  `,
              )}
            >
              <Share2 className="h-3.5 w-3.5 shrink-0" />

              {post.shares > 0 ? (
                <span className="tabular-nums">
                  {formatCompactCount(
                    post.shares,
                    '0',
                  )}
                </span>
              ) : null}
            </button>
          </div>

          {/* ================= INLINE COMMENT ================= */}

          {commentOpen ? (
            <form
              data-card-interactive="true"
              className="
                flex items-center gap-2
                border-t border-[color:var(--app-border)]
                bg-slate-50/60
                px-2.5 py-2
                sm:px-3
              "
              onSubmit={event => {
                event.preventDefault();

                void submitInlineComment();
              }}
            >
              <Image
                src={avatarSrc}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 shrink-0 rounded-full object-cover"
              />

              <label
                className="sr-only"
                htmlFor={`comment-${post.id}`}
              >
                {isId
                  ? 'Tulis komentar'
                  : 'Write a comment'}
              </label>

              <input
                ref={commentInputRef}
                id={`comment-${post.id}`}
                value={commentDraft}
                onChange={event =>
                  setCommentDraft(
                    event.target.value,
                  )
                }
                disabled={
                  commentSubmitting
                }
                maxLength={1000}
                autoComplete="off"
                placeholder={
                  isId
                    ? 'Tulis komentar...'
                    : 'Write a comment...'
                }
                className="
                  min-h-9 min-w-0 flex-1
                  rounded-full
                  border border-[color:var(--app-border)]
                  bg-white
                  px-3
                  text-[11px]
                  text-[color:var(--app-text)]
                  outline-none
                  transition

                  placeholder:text-[color:var(--app-text-soft)]

                  focus:border-[color:var(--app-accent-border)]
                  focus:ring-2
                  focus:ring-[color:var(--app-accent)]/10

                  disabled:opacity-60
                "
              />

              <button
                type="submit"
                disabled={
                  commentSubmitting ||
                  !commentDraft.trim()
                }
                className="
                  inline-flex min-h-9
                  shrink-0 items-center
                  justify-center
                  rounded-full
                  bg-[color:var(--app-accent)]
                  px-3
                  text-[10px] font-bold
                  text-white
                  transition

                  hover:brightness-95

                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                {commentSubmitting
                  ? isId
                    ? 'Mengirim...'
                    : 'Sending...'
                  : isId
                    ? 'Kirim'
                    : 'Send'}
              </button>
            </form>
          ) : null}
        </article>
      ) : (
        /* ================= EMPTY ================= */

        <div
          className="
            mt-1.5
            rounded-xl
            border border-dashed
            border-[color:var(--app-border)]
            bg-[color:var(--app-surface-muted)]
            px-3 py-3
            text-center
            text-[10px] font-medium
            text-[color:var(--app-text-soft)]
          "
        >
          {activeTabMeta.emptyLabel}
        </div>
      )}

      {/* ================= MORE POSTS ================= */}

      {morePosts.length ? (
        <div className="mt-1.5 space-y-1.5">
          {morePosts.map(item => {
            const href =
              buildCommunityPostHref(item);

            const itemMediaItems =
              item.mediaItems?.length
                ? item.mediaItems
                : item.mediaUrl
                  ? [
                      {
                        src: item.mediaUrl,
                        type:
                          item.mediaType ===
                          'video'
                            ? 'video'
                            : 'image',
                        alt: item.title,
                      } satisfies MediaPreviewItem,
                    ]
                  : [];

            return (
              <Link
                key={item.id}
                href={href}
                className="
                  group flex min-w-0
                  items-start gap-2.5
                  rounded-[14px]
                  border border-[color:var(--app-border)]
                  bg-white
                  p-2.5
                  transition-colors

                  hover:border-[color:var(--app-accent-border)]
                  hover:bg-[color:var(--app-accent-soft)]/30
                "
              >
                <Image
                  src={profileAvatarSrc(
                    item.avatar,
                  )}
                  alt={item.author}
                  width={32}
                  height={32}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />

                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1 text-[9px] font-medium text-[color:var(--app-text-soft)]">
                    <span className="truncate">
                      {item.community}
                    </span>

                    <span className="shrink-0">
                      ·
                    </span>

                    <span className="shrink-0">
                      {item.time}
                    </span>
                  </span>

                  <span className="mt-0.5 line-clamp-1 block text-[11px] font-bold leading-4 text-[color:var(--app-text)]">
                    {item.title}
                  </span>

                  <span className="mt-0.5 line-clamp-1 block text-[10px] leading-4 text-[color:var(--app-text-soft)]">
                    {item.body}
                  </span>
                </span>

                {itemMediaItems.length >
                0 ? (
                  <span className="relative h-[54px] w-[72px] shrink-0 overflow-hidden rounded-[10px] bg-slate-100">
                    <MediaPreviewCarousel
                      items={
                        itemMediaItems
                      }
                      alt={item.title}
                      aspectClassName="h-full w-full"
                      className="h-full w-full bg-transparent"
                      mediaClassName="transition duration-300 group-hover:scale-[1.025]"
                      sizes="72px"
                      controls={false}
                      lightbox={false}
                      showCounter={false}
                      showDots={false}
                    />

                    {item.kind ===
                    'reel' ? (
                      <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/16 text-white">
                        <PlayCircle className="h-5 w-5" />
                      </span>
                    ) : itemMediaItems.length >
                      1 ? (
                      <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-black/60 px-1 py-0.5 text-[8px] font-bold text-white">
                        +
                        {itemMediaItems.length -
                          1}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <ChevronRight className="mt-2 h-3.5 w-3.5 shrink-0 text-[color:var(--app-text-soft)]" />
                )}
              </Link>
            );
          })}
        </div>
      ) : null}

      {/* ================= LOAD ERROR ================= */}

      {loadError ? (
        <p className="mt-1.5 rounded-xl bg-amber-50 px-2.5 py-1.5 text-center text-[10px] font-semibold text-amber-700 ring-1 ring-amber-100">
          {loadError}
        </p>
      ) : null}

      {/* ================= LOAD MORE ================= */}

      {hasMore ||
      loading ||
      loadError ? (
        <div className="mt-1.5 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={
              loading || !onLoadMore
            }
            className="
              inline-flex min-h-8
              items-center justify-center
              rounded-full
              border border-[color:var(--app-border)]
              bg-white
              px-3
              text-[10px] font-bold
              text-[color:var(--app-text)]
              transition-colors

              hover:bg-slate-50

              disabled:cursor-not-allowed
              disabled:opacity-55
            "
          >
            {loading
              ? activeTabMeta.loadingLabel
              : loadError
                ? isId
                  ? 'Coba lagi'
                  : 'Try again'
                : isId
                  ? 'Muat lagi'
                  : 'Load more'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function ReelsPanel({ isId, items }: ReelsPanelProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'keepSnaps',
    dragFree: true,
    skipSnaps: true,
  });

  useEmblaWheelGestures(emblaApi);

  return (
    <section
      className="w-full py-1.5 sm:py-2"
      aria-label={isId ? 'Reels inspirasi' : 'Inspiration reels'}
    >
      {/* HEADER */}
      <div className="flex h-6 items-center gap-1.5 px-1 sm:px-3 md:px-6">
        <Play className="h-3.5 w-3.5 shrink-0 fill-emerald-600 text-emerald-600" />

        <h2 className="truncate text-[11px] font-bold leading-none tracking-tight text-[color:var(--app-text)] sm:text-xs">
          {isId ? 'Reels Inspirasi' : 'Inspiration Reels'}
        </h2>

        <span className="hidden truncate text-[9px] font-medium text-zinc-400 sm:inline">
          {isId
            ? 'Ide & tips bisnis singkat'
            : 'Quick business ideas & tips'}
        </span>
      </div>

      {/* EMPTY */}
      {items.length === 0 ? (
        <div className="mt-1 px-1 sm:px-3 md:px-6">
          <div className="rounded-xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3 text-center text-[10px] font-medium text-[color:var(--app-text-soft)]">
            {isId
              ? 'Belum ada reels saat ini.'
              : 'No reels available right now.'}
          </div>
        </div>
      ) : (
        /* CAROUSEL */
        <div
          ref={emblaRef}
          className="mt-1 cursor-grab overflow-hidden contain-paint active:cursor-grabbing"
        >
          <div
            className="
              flex touch-pan-y gap-2
              px-1 py-0.5
              sm:gap-2.5 sm:px-3
              md:px-6
              [backface-visibility:hidden]
              [will-change:transform]
            "
          >
            {items.map(item => (
              <div
                key={item.id}
                className="
                  w-[128px]
                  shrink-0 select-none
                  sm:w-[140px]
                  md:w-[148px]
                "
                style={{
                  backfaceVisibility: 'hidden',
                }}
              >
                <ReelCard item={item} isId={isId} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ReelCard({ item, isId }: { item: ReelItem; isId: boolean }) {
  return (
    <Link
      href={item.href}
      className="group relative isolate block aspect-[9/16] w-full overflow-hidden rounded-[20px] border border-zinc-800 bg-zinc-950 shadow-[0_12px_24px_-16px_rgba(15,23,42,0.3)] transition-all duration-300 [backface-visibility:hidden] [transform:translateZ(0)] hover:-translate-y-1 hover:shadow-[0_16px_28px_-12px_rgba(15,23,42,0.4)]"
      data-testid="home-reel-card"
      data-lajukan-event="home.card_clicked"
      data-lajukan-surface="home_reels"
      data-lajukan-entity-type="reel"
      data-lajukan-entity-id={item.id}
      data-lajukan-label={item.title}
    >
      {/* BACKGROUND MEDIA */}
      {item.mediaUrl && item.mediaType !== 'image' ? (
        <video
          src={item.mediaUrl}
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 [backface-visibility:hidden] [transform:translateZ(0)] group-hover:scale-105"
        />
      ) : item.mediaUrl ? (
        <Image
          src={item.mediaUrl}
          alt={item.title}
          fill
          sizes="(max-width: 640px) 140px, 156px"
          className="object-cover transition-transform duration-500 [backface-visibility:hidden] [transform:translateZ(0)] group-hover:scale-105"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,#14532d,#020617)] text-white/40">
          <Video className="h-8 w-8" />
        </span>
      )}

      {/* GRADIENT OVERLAY (Gelap di bawah agar teks putih kontras & terbaca) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10 transition-opacity group-hover:via-black/40" />

      {/* BADGE KATEGORI (Kiri Atas) */}
      <span
        className="absolute left-2.5 top-2.5 max-w-[calc(100%-1.25rem)] truncate rounded-full bg-white/90  px-2 py-0.5 text-[9px] font-bold text-emerald-800 shadow-sm"
        title={item.category}
      >
        {item.category}
      </span>

      {/* DESKRIPSI & INFO TAYANGAN (Bagian Bawah) */}
      <div className="absolute inset-x-3 bottom-3 flex flex-col justify-end">
        {/* Judul dengan batasan baris */}
        <p className="line-clamp-2 text-[11px] sm:text-xs font-bold leading-snug text-white tracking-tight drop-shadow-sm">
          {item.title}
        </p>

        {/* Baris data tayangan & icon play */}
        <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-zinc-300/90">
          <span className="rounded bg-black/45 px-1 text-white">
            {item.views} {isId ? 'tayangan' : 'views'}
          </span>
          <PlayCircle className="h-4 w-4 text-white transition-transform group-hover:scale-110" />
        </div>
      </div>
    </Link>
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
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                {isId ? 'Hari ini' : 'Today'}
              </p>
              <h2 className="mt-1 line-clamp-2 text-[1rem] font-bold leading-tight tracking-[-0.035em] text-[color:var(--app-text)]">
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
                  <p className="mt-1 text-[15px] font-bold leading-none tracking-[-0.04em] text-[color:var(--app-text)]">
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
            className="mt-2 inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-[12px] font-bold text-[color:var(--app-text-inverse)] shadow-[0_16px_30px_-24px_color-mix(in_srgb,var(--app-accent)_50%,transparent)] transition hover:brightness-105"
          >
            <Package className="h-4 w-4" />
            {pulseCtaLabel}
          </Link>
        </section>
      </div>
    </aside>
  );
}

export function HomeLoadingState({ isId = true }: { isId?: boolean } = {}) {
  return (
    <MarketplacePageFrame loading>
      <div
        className={cn(homeDesktopGridClassName, 'max-lg:max-w-[720px]')}
        data-skeleton-route="true"
      >
        <aside className="hidden space-y-3 overflow-hidden rounded-[22px] p-2.5 lg:block lg:h-full lg:min-h-0">
          <div className="flex items-center gap-3">
            <SkeletonAvatar className="h-12 w-12" />
            <div className="min-w-0 flex-1">
              <Skeleton variant="line" className="h-4 w-28" />
              <Skeleton variant="line" className="mt-2 h-3 w-20" />
            </div>
          </div>
          <SkeletonStack lines={2} className="py-2" />
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 py-2">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton variant="line" className="h-4 flex-1" />
            </div>
          ))}
        </aside>
        <main className="min-h-0 min-w-0 space-y-3.5 sm:space-y-4 lg:overflow-y-auto lg:pr-1 lg:pt-2 lg:overscroll-contain">
          <section className="mx-auto w-full max-w-7xl px-3 py-4">
            <div className="relative min-h-[155px] overflow-hidden rounded-3xl bg-emerald-50/70 px-4 py-5 sm:px-6 sm:py-7">
              <div className="grid grid-cols-3 items-center gap-3">
                <div className="col-span-2 flex min-h-[110px] flex-col justify-center sm:min-h-[140px]">
                  <Skeleton
                    variant="line"
                    className="h-7 w-4/5 max-w-[360px] sm:h-9"
                  />
                  <Skeleton
                    variant="line"
                    className="mt-2 h-7 w-3/5 max-w-[280px] sm:h-9"
                  />
                  <SkeletonStack
                    lines={2}
                    className="mt-4 max-w-[500px]"
                    lineClassName="h-3"
                  />
                </div>
                <div className="relative col-span-1 h-[110px] sm:h-[140px]">
                  <Skeleton className="absolute right-0 top-1/2 h-[96px] w-[96px] -translate-y-1/2 rounded-[28px] sm:h-[124px] sm:w-[124px]" />
                </div>
              </div>
            </div>
            <div className="-mt-5 px-2">
              <div className="relative z-20 flex h-12 items-center gap-3 rounded-2xl border border-[color:var(--app-border)] bg-white px-3 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.28)]">
                <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
                <Skeleton variant="line" className="h-4 flex-1" />
                <Skeleton className="h-8 w-8 shrink-0 rounded-xl" />
              </div>
            </div>
          </section>
          <section className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton variant="line" className="h-5 w-36" />
              <Skeleton variant="chip" className="w-20" />
            </div>
            <div className="mt-4 flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="w-24 shrink-0 text-center">
                  <Skeleton className="mx-auto h-14 w-14 rounded-2xl" />
                  <Skeleton variant="line" className="mx-auto mt-2 w-16" />
                </div>
              ))}
            </div>
          </section>
          <section className="overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)]">
            <div className="flex items-start gap-3 p-4">
              <SkeletonAvatar />
              <div className="min-w-0 flex-1">
                <Skeleton variant="line" className="h-4 w-32" />
                <Skeleton variant="line" className="mt-2 h-3 w-20" />
              </div>
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
            <div className="px-4 pb-4">
              <Skeleton variant="line" className="h-5 w-4/5" />
              <SkeletonStack lines={2} className="mt-3" />
            </div>
            <Skeleton
              variant="media"
              className="w-full rounded-none sm:aspect-video"
            />
            <div className="grid grid-cols-3 gap-3 border-t border-[color:var(--app-border)] p-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} variant="line" className="mx-auto w-16" />
              ))}
            </div>
          </section>
          <section className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4">
            <Skeleton variant="line" className="h-5 w-44" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="flex gap-3 rounded-[18px] border border-[color:var(--app-border)] p-3"
                >
                  <Skeleton className="h-16 w-20 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <Skeleton variant="line" className="h-4 w-3/4" />
                    <SkeletonStack lines={2} className="mt-2" />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <FeedColumnFooter isId={isId} />
        </main>
        <aside className="hidden min-w-0 space-y-4 overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 xl:block xl:h-full xl:max-h-full xl:min-h-0 xl:pt-3">
          <Skeleton variant="line" className="h-5 w-36" />
          <SkeletonStack lines={3} />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-[18px]" />
            ))}
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
        </aside>
      </div>
    </MarketplacePageFrame>
  );
}

export function HomeResponsiveMarketplace({ locale }: HomeContentSimpleProps) {
  const isId = (locale || 'id') === 'id';
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, loading: authLoading, authFetch } = useAuth();
  const userId = typeof user?.id === 'string' ? user.id : null;
  const viewerLocationState = useViewerLocation({
    isId,
    autoRequest: false,
  });
  const { viewerLocation } = viewerLocationState;
  const { totalUnread } = useChatInbox();
  const [query, setQuery] = useState('');
  const [summary, setSummary] = useState<LajukanSummary | null>(null);
  const [activeTab, setActiveTab] = useState<CommunityTab>('for-you');
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
    [],
  );
  const [publicReferences, setPublicReferences] = useState<
    PublicReferenceItem[]
  >([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityOverview, setCommunityOverview] =
    useState<CommunityFeedOverview | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [communityHasMore, setCommunityHasMore] = useState(false);
  const [communityOffset, setCommunityOffset] = useState(0);
  const communityRequestSeqRef = useRef(0);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [walletAmountLabel, setWalletAmountLabel] = useState(() =>
    formatCurrencyFromCents(0, 'IDR'),
  );
  const [walletModeLabel, setWalletModeLabel] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const toggleCommunityPostLike = useCallback(
    async (threadId: string, _liked: boolean) => {
      const response = await authFetch(
        `/api/forum/threads/${encodeURIComponent(threadId)}/vote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            value: 1,
          }),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));

        throw new Error(
          payload?.error || 'Like request failed',
        );
      }
    },
    [authFetch],
  );

  const createCommunityComment = useCallback(
    async (threadId: string, body: string) => {
      const response = await authFetch(
        `/api/forum/threads/${encodeURIComponent(threadId)}/posts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: body,
          }),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));

        throw new Error(
          payload?.error || 'Comment request failed',
        );
      }
    },
    [authFetch],
  );

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

    const resetWalletBalance = () => {
      setWalletAmountLabel(formatCurrencyFromCents(0, 'IDR'));
      setWalletModeLabel(null);
      setWalletLoading(false);
    };

    async function loadWalletBalance() {
      if (authLoading || !isAuthenticated || !userId) {
        resetWalletBalance();
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
          resetWalletBalance();
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
        resetWalletBalance();
      } finally {
        if (active) setWalletLoading(false);
      }
    }

    void loadWalletBalance();

    return () => {
      active = false;
    };
  }, [authFetch, authLoading, isAuthenticated, userId]);

  const viewerLocationKey = viewerLocation
    ? `${viewerLocation.lat.toFixed(3)},${viewerLocation.lng.toFixed(3)}`
    : '';

  useEffect(() => {
    let active = true;
    const listingController = new AbortController();
    const referenceController = new AbortController();
    const listingTimeoutId = window.setTimeout(
      () => listingController.abort(),
      HOME_CONTENT_REQUEST_TIMEOUT_MS,
    );
    const referenceTimeoutId = window.setTimeout(
      () => referenceController.abort(),
      HOME_CONTENT_REQUEST_TIMEOUT_MS,
    );

    const addViewerLocation = (params: URLSearchParams) => {
      if (!viewerLocationKey) return;
      const [viewerLat, viewerLng] = viewerLocationKey.split(',');
      params.set('viewer_lat', viewerLat);
      params.set('viewer_lng', viewerLng);
    };

    const loadListings = async () => {
      const params = new URLSearchParams({
        limit: '12',
        status: 'active',
        side: 'supply',
        include_owner: '1',
        database_only: '1',
      });
      addViewerLocation(params);
      if (viewerLocationKey) {
        params.set('nearby', '1');
      }
      const response = await fetch(`/api/content?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
        signal: listingController.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error('content_supply_unavailable');
      return extractContentItems(payload);
    };

    const loadReferences = async () => {
      const params = new URLSearchParams({
        references_only: '1',
        limit: '12',
      });
      addViewerLocation(params);
      const response = await fetch(
        `/api/super-app/umkm/stores?${params.toString()}`,
        {
          cache: 'no-store',
          credentials: 'include',
          signal: referenceController.signal,
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as PublicReferenceApiResponse | null;
      if (!response.ok) throw new Error('public_references_unavailable');
      return Array.isArray(payload?.data?.items) ? payload.data.items : [];
    };

    const loadHomeListings = async () => {
      try {
        const listingItems = (await loadListings())
          .filter(item => !isExplicitlyNonTransactional(item))
          .map(item =>
            mapContentToRecommendation(
              item,
              isId,
              Boolean(viewerLocationKey),
            ),
          )
          .filter((item): item is RecommendationItem => Boolean(item))
          .filter(item => item.side === 'supply')
          .filter(
            (item, index, allItems) =>
              allItems.findIndex(candidate => candidate.id === item.id) ===
              index,
          )
          .slice(0, 12);
        if (!active) return;
        setRecommendations(listingItems);
      } catch {
        if (!active) return;
        setRecommendations([]);
      }
    };

    const loadHomeReferences = async () => {
      try {
        const referenceItems = (await loadReferences())
          .map(mapApiItemToPublicReference)
          .filter((item): item is PublicReferenceItem => Boolean(item))
          .filter(item => Boolean(item.sourceLicense))
          .filter(
            (item, index, allItems) =>
              allItems.findIndex(candidate => candidate.id === item.id) ===
              index,
          )
          .slice(0, 12);
        if (!active) return;
        setPublicReferences(referenceItems);
      } catch {
        if (!active) return;
        setPublicReferences([]);
      }
    };

    void loadHomeListings().finally(() =>
      window.clearTimeout(listingTimeoutId),
    );
    void loadHomeReferences().finally(() =>
      window.clearTimeout(referenceTimeoutId),
    );

    return () => {
      active = false;
      window.clearTimeout(listingTimeoutId);
      window.clearTimeout(referenceTimeoutId);
      listingController.abort();
      referenceController.abort();
    };
  }, [isId, viewerLocationKey]);

  const loadCommunityPostsPage = useCallback(
    async (offset = 0) => {
      const requestSeq = communityRequestSeqRef.current + 1;
      communityRequestSeqRef.current = requestSeq;
      setCommunityLoading(true);
      setCommunityError(null);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        HOME_COMMUNITY_REQUEST_TIMEOUT_MS,
      );
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
            signal: controller.signal,
          },
        );
        const payload = (await response
          .json()
          .catch(() => null)) as CommunityFeedResponse | null;
        if (communityRequestSeqRef.current !== requestSeq) return;
        if (!response.ok) {
          throw new Error(
            isId
              ? 'Diskusi komunitas belum bisa dimuat. Coba lagi sebentar.'
              : 'Community discussions could not be loaded. Please try again.',
          );
        }
        const discussionItems = (payload?.items || []).filter(
          item => item.kind !== 'reel',
        );
        const mapped = discussionItems.map(item =>
          mapCommunityItemToPost(item, isId, activeTab),
        );
        const rawNextCursor =
          typeof payload?.nextCursor === 'number' &&
          Number.isFinite(payload.nextCursor)
            ? payload.nextCursor
            : null;
        const responseItemCount = payload?.items?.length || 0;
        const fallbackNextCursor =
          offset + Math.max(responseItemCount, mapped.length);
        const nextCursor =
          rawNextCursor !== null && rawNextCursor > offset
            ? rawNextCursor
            : fallbackNextCursor;
        const cursorAdvanced = nextCursor > offset;
        setCommunityOverview(payload?.overview || null);
        setCommunityPosts(prev => {
          if (offset === 0) return mapped;
          const seen = new Set(prev.map(item => item.id));
          return [...prev, ...mapped.filter(item => !seen.has(item.id))];
        });
        setCommunityOffset(nextCursor);
        setCommunityHasMore(
          Boolean(payload?.hasMore) && cursorAdvanced && responseItemCount > 0,
        );
        setCommunityError(null);
      } catch (error) {
        if (communityRequestSeqRef.current !== requestSeq) return;
        if (offset === 0) setCommunityPosts([]);
        if (offset === 0) setCommunityOverview(null);
        if (offset === 0) setCommunityHasMore(false);
        const aborted =
          error instanceof DOMException && error.name === 'AbortError';
        setCommunityError(
          aborted
            ? isId
              ? 'Koneksi komunitas terlalu lama. Coba muat lagi.'
              : 'Community loading took too long. Try again.'
            : isId
              ? 'Diskusi komunitas gagal dimuat. Coba muat lagi.'
              : 'Community discussions failed to load. Try again.',
        );
      } finally {
        window.clearTimeout(timeoutId);
        if (communityRequestSeqRef.current === requestSeq) {
          setCommunityLoading(false);
        }
      }
    },
    [activeTab, isId],
  );

  useEffect(() => {
    setCommunityPosts([]);
    setCommunityOverview(null);
    setCommunityError(null);
    setCommunityOffset(0);
    setCommunityHasMore(false);
    void loadCommunityPostsPage(0);
  }, [loadCommunityPostsPage]);

  const loadMoreCommunityPosts = useCallback(() => {
    if (communityLoading) return;
    if (communityError) {
      void loadCommunityPostsPage(
        communityPosts.length > 0 ? communityOffset : 0,
      );
      return;
    }
    if (!communityHasMore) return;
    void loadCommunityPostsPage(communityOffset);
  }, [
    communityError,
    communityHasMore,
    communityLoading,
    communityOffset,
    communityPosts.length,
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
        ? `/explore?q=${encodeURIComponent(trimmedQuery)}`
        : UMKM_DISCOVERY_PATH,
    );
  };
  const openSearchFilters = useCallback(() => {
    const params = new URLSearchParams();
    const trimmedQuery = query.trim();
    if (trimmedQuery) params.set('q', trimmedQuery);
    params.set('filters', '1');
    void trackLajukanEvent('search.filters_opened', {
      properties: {
        query: trimmedQuery,
        source: 'home_hero',
      },
    });
    router.push(`/explore?${params.toString()}`);
  }, [query, router]);

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
            href: '/explore?type=product&q=supplier',
            icon: ShoppingBag,
          },
          {
            id: 'service',
            label: isId ? 'Jasa' : 'Services',
            caption: isId ? 'Operasional' : 'Business services',
            href: '/explore?type=service&q=jasa%20usaha',
            icon: BriefcaseBusiness,
          },
          {
            id: 'location',
            label: isId ? 'Lokasi' : 'Places',
            caption: isId ? 'Titik jual' : 'Strategic places',
            href: '/explore?type=property&q=lokasi%20usaha',
            icon: MapPin,
          },
          {
            id: 'talent',
            label: 'Talent',
            caption: isId ? 'Siap bantu' : 'Qualified talent',
            href: '/explore?type=freelancer&q=talent',
            icon: UserRound,
          },
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
    return <HomeLoadingState isId={isId} />;
  }

  return (
    <MarketplacePageFrame>
      <main className="mx-auto w-full max-w-[720px] space-y-3.5 sm:space-y-4 lg:hidden">
        <HeroVisualStage
          isId={isId}
          className="mb-3"
          query={query}
          onQueryChange={setQuery}
          onSubmit={handleSearchSubmit}
          onOpenFilters={openSearchFilters}
        />
        {/* <MobileAppDownloadSection isId={isId} /> */}
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
        <QuickCategoriesSection isId={isId} />
        <TrendingSearchSection isId={isId} />

        <HomeUmkmMapPreview
          locale={locale}
          viewerLocation={viewerLocationState.viewerLocation}
          locating={viewerLocationState.locating}
          locationError={viewerLocationState.locationError}
          locationEnabled={viewerLocationState.locationEnabled}
          locationPromptDismissed={viewerLocationState.locationPromptDismissed}
          requestViewerLocation={viewerLocationState.requestViewerLocation}
          dismissLocationPrompt={viewerLocationState.dismissLocationPrompt}
        />
        <PublicReferencesSection isId={isId} items={publicReferences} />
        {recommendations.length > 0 ? (
          <RecommendationsSection isId={isId} items={recommendations} />
        ) : null}
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
          loadError={communityError}
          onLoadMore={loadMoreCommunityPosts}
          onCreated={handleCommunityComposerCreated}
          onToggleLike={toggleCommunityPostLike}
          onSubmitComment={createCommunityComment}
          onRequireAuth={() => {
            const currentPath = pathname || '/home';

            router.push(
              `/login?callbackUrl=${encodeURIComponent(currentPath)}`,
            );
          }}
        />
        <FeedColumnFooter isId={isId} />
      </main>

      <div className="lajukan-home-desktop-shell hidden min-h-0 min-w-0 lg:flex lg:flex-1 lg:flex-col">
        <div className={homeDesktopGridClassName}>
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
              {/* <DesktopHeroSection
                isId={isId}
                isAuthenticated={isAuthenticated}
                summary={summary}
                primaryCtaHref={primaryCtaHref}
                query={query}
                onQueryChange={setQuery}
                onSubmit={handleSearchSubmit}
                placeholder={text.searchPlaceholder}
                buttonLabel={text.searchButton}
              /> */}
              <HeroVisualStage
                isId={isId}
                className="mb-3"
                query={query}
                onQueryChange={setQuery}
                onSubmit={handleSearchSubmit}
                onOpenFilters={openSearchFilters}
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
              <TrendingSearchSection isId={isId} />

              <HomeUmkmMapPreview
                locale={locale}
                viewerLocation={viewerLocationState.viewerLocation}
                locating={viewerLocationState.locating}
                locationError={viewerLocationState.locationError}
                locationEnabled={viewerLocationState.locationEnabled}
                locationPromptDismissed={
                  viewerLocationState.locationPromptDismissed
                }
                requestViewerLocation={
                  viewerLocationState.requestViewerLocation
                }
                dismissLocationPrompt={
                  viewerLocationState.dismissLocationPrompt
                }
              />
              <PublicReferencesSection isId={isId} items={publicReferences} />
              {recommendations.length > 0 ? (
                <RecommendationsSection isId={isId} items={recommendations} />
              ) : null}
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
                  loadError={communityError}
                  onLoadMore={loadMoreCommunityPosts}
                  onCreated={handleCommunityComposerCreated}
                  onToggleLike={toggleCommunityPostLike}
                  onSubmitComment={createCommunityComment}
                  onRequireAuth={() => {
                    const currentPath = pathname || '/home';

                    router.push(
                      `/login?callbackUrl=${encodeURIComponent(currentPath)}`,
                    );
                  }}
                />
              </div>
              <FeedColumnFooter isId={isId} />
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
