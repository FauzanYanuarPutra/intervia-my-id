'use client';

import NextImage from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppBack } from '@/lib/navigation/useAppBack';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
  type TouchEvent,
  type UIEvent,
  type WheelEvent,
} from 'react';
import {
  ArrowLeft,
  Bookmark,
  Box,
  BriefcaseBusiness,
  Building2,
  Camera,
  Check,
  ChevronRight,
  Clapperboard,
  Compass,
  Download,
  Flag,
  Forward,
  Hash,
  Heart,
  Home,
  ImageIcon,
  Info,
  Link2,
  Loader2,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  MoreHorizontal,
  Music,
  Play,
  Plus,
  Radio,
  RefreshCcw,
  Search,
  Send,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store,
  Upload,
  User,
  UserPlus,
  Users,
  Video,
  Volume2,
  VolumeX,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  normalizePlayableReel,
  normalizePlayableReels,
  REELS_PAGE_SIZE,
  type LajukanReel,
  type ReelsPageResult,
} from '../../_data/reels';
import { profileAvatarSrc } from '@/lib/profile/avatar';
import { buildPublicProfileHref } from '@/lib/profile/publicProfileLink';
import {
  openNativeReelsStudio,
  requestNativePermissions,
} from '@/lib/nativeBridge';

type ReelsClientProps = {
  locale: string;
  initialIndex: number;
  initialItems: LajukanReel[];
  initialCursor: number | null;
  initialHasMore: boolean;
  initialSearchQuery: string;
  initialUploadOpen?: boolean;
};

const iconMap: Record<LajukanReel['iconKey'], LucideIcon> = {
  supplier: BriefcaseBusiness,
  marketing: Megaphone,
  finance: WalletCards,
  packaging: Box,
  frozen: ShoppingBag,
};

type ReelsSignal = 'watch' | 'share' | 'detail' | 'product';

type ReelUserAction = 'like' | 'save' | 'follow';

type ReelActionState = {
  liked: boolean;
  saved: boolean;
  followed: boolean;
  loading?: ReelUserAction | null;
};

type ReelComment = {
  id: string;
  reelId: string;
  parentCommentId?: string | null;
  authorUserId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  body: string;
  replyCount?: number;
  createdAt: string;
};

type ReelCommentsBucket = {
  items: ReelComment[];
  cursor: number | null;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

type UploadReelForm = {
  captureMode: NonNullable<LajukanReel['captureMode']>;
  filterPreset: NonNullable<LajukanReel['filterPreset']>;
  musicTrack: string;
  title: string;
  caption: string;
  tag: string;
  mediaUrl: string;
  hook: string;
  liveTitle: string;
  liveSchedule: string;
  productName: string;
  productPrice: string;
  productHref: string;
  storeName: string;
  storeCity: string;
};

type UploadReelStep = 'media' | 'edit' | 'post';

type ReelsFeedTab = 'fyp' | 'friends' | 'following';

type ReelsStudioMode = 'gallery' | 'photo' | 'video' | 'live';
type ReelsStudioPanel = 'filters' | 'effects' | 'music' | 'speed' | null;
type ReelsStudioSpeed = (typeof REELS_STUDIO_SPEEDS)[number];
type ReelsStudioDuration = (typeof REELS_STUDIO_DURATIONS)[number];
type ReelsStudioEffect =
  | 'none'
  | 'clean'
  | 'product'
  | 'focus'
  | 'scan'
  | 'grain';
type ReelsStudioFacingMode = 'environment' | 'user';

type PreferenceProfile = {
  terms: Record<string, number>;
  searches: string[];
  signals: number;
  updatedAt: number;
};

const PROFILE_STORAGE_KEY = 'lajukan.reels.preference.v1';
const SOUND_STORAGE_KEY = 'lajukan.reels.sound.v1';
const REELS_SNAP_LOCK_MS = 520;
const REELS_WHEEL_THRESHOLD = 42;
const REELS_TOUCH_THRESHOLD = 46;
const REELS_AUTO_SCROLL_MS = 11000;
const REELS_RENDER_WINDOW = 2;
const REEL_SLIDE_LOADED_STYLE: CSSProperties = {
  contentVisibility: 'visible',
};
const REEL_SLIDE_PLACEHOLDER_STYLE: CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: '100svh 430px',
};
const STOP_WORDS = new Set([
  'dan',
  'atau',
  'yang',
  'untuk',
  'dengan',
  'the',
  'and',
  'for',
  'a',
  'an',
  'to',
  'of',
  'di',
  'ke',
  'ini',
  'itu',
  'buat',
  'cara',
]);

const EMPTY_UPLOAD_FORM: UploadReelForm = {
  captureMode: 'camera',
  filterPreset: 'natural',
  musicTrack: 'Original sound',
  title: '',
  caption: '',
  tag: 'UMKM',
  mediaUrl: '',
  hook: '',
  liveTitle: '',
  liveSchedule: '',
  productName: '',
  productPrice: '',
  productHref: '',
  storeName: '',
  storeCity: '',
};

const REEL_CAPTURE_MODES: Array<{
  id: NonNullable<LajukanReel['captureMode']>;
  label: string;
  helper: string;
  icon: LucideIcon;
}> = [
    {
      id: 'camera',
      label: 'Kamera',
      helper: 'Rekam cepat',
      icon: Camera,
    },
    {
      id: 'upload',
      label: 'Galeri',
      helper: 'Pilih file',
      icon: Upload,
    },
    {
      id: 'live',
      label: 'Live',
      helper: 'Jadwal siaran',
      icon: Radio,
    },
  ];

const REELS_STUDIO_MODES: Array<{
  id: ReelsStudioMode;
  label: string;
  helper: string;
  icon: LucideIcon;
}> = [
    {
      id: 'gallery',
      label: 'Galeri',
      helper: 'Ambil file',
      icon: Upload,
    },
    {
      id: 'photo',
      label: 'Foto',
      helper: 'Jepret cepat',
      icon: Camera,
    },
    {
      id: 'video',
      label: 'Video',
      helper: 'Rekam',
      icon: Clapperboard,
    },
    {
      id: 'live',
      label: 'Live',
      helper: 'Siaran',
      icon: Radio,
    },
  ];

const REELS_MUSIC_TRACKS = [
  'Original sound',
  'Beat UMKM',
  'Soft promo',
  'Live shop',
  'Packing ASMR',
];

const REELS_STUDIO_SPEEDS = ['0,25x', '0,5x', '1x', '1,5x', '2x'] as const;
const REELS_STUDIO_DURATIONS = ['60s', '15s', '05s'] as const;
const REELS_CAPTURE_CANVAS_WIDTH = 720;
const REELS_CAPTURE_CANVAS_HEIGHT = 1280;
const REELS_CAPTURE_FPS = 30;

const REEL_FILTER_PRESETS: Array<{
  id: NonNullable<LajukanReel['filterPreset']>;
  label: string;
  helper: string;
  css: string;
  swatch: string;
}> = [
    {
      id: 'natural',
      label: 'Asli',
      helper: 'warna normal',
      css: 'none',
      swatch: 'bg-gradient-to-br from-slate-100 via-white to-emerald-100',
    },
    {
      id: 'fresh',
      label: 'Fresh',
      helper: 'produk lebih segar',
      css: 'saturate(1.12) contrast(1.04) brightness(1.03)',
      swatch: 'bg-gradient-to-br from-emerald-200 via-teal-100 to-white',
    },
    {
      id: 'warm',
      label: 'Warm',
      helper: 'kuliner hangat',
      css: 'sepia(0.08) saturate(1.14) contrast(1.02) brightness(1.02)',
      swatch: 'bg-gradient-to-br from-amber-200 via-orange-100 to-white',
    },
    {
      id: 'pop',
      label: 'Pop',
      helper: 'promo mencolok',
      css: 'saturate(1.28) contrast(1.08)',
      swatch: 'bg-gradient-to-br from-rose-200 via-fuchsia-100 to-sky-100',
    },
    {
      id: 'cinema',
      label: 'Cinema',
      helper: 'lebih dramatis',
      css: 'contrast(1.12) saturate(0.94) brightness(0.96)',
      swatch: 'bg-gradient-to-br from-slate-900 via-slate-500 to-amber-100',
    },
    {
      id: 'mono',
      label: 'Mono',
      helper: 'hitam putih',
      css: 'grayscale(1) contrast(1.1)',
      swatch: 'bg-gradient-to-br from-slate-950 via-slate-400 to-white',
    },
  ];

const REELS_STUDIO_EFFECTS: Array<{
  id: ReelsStudioEffect;
  label: string;
  helper: string;
  swatch: string;
}> = [
    {
      id: 'none',
      label: 'Original',
      helper: 'tanpa efek',
      swatch: 'bg-gradient-to-br from-white via-slate-100 to-slate-300',
    },
    {
      id: 'clean',
      label: 'Clean',
      helper: 'cahaya halus',
      swatch: 'bg-gradient-to-br from-white via-emerald-100 to-sky-100',
    },
    {
      id: 'product',
      label: 'Product',
      helper: 'produk pop',
      swatch: 'bg-gradient-to-br from-yellow-200 via-white to-rose-200',
    },
    {
      id: 'focus',
      label: 'Focus',
      helper: 'vignette',
      swatch: 'bg-gradient-to-br from-slate-950 via-slate-500 to-white',
    },
    {
      id: 'scan',
      label: 'Scan',
      helper: 'garis preview',
      swatch:
        'bg-[repeating-linear-gradient(180deg,#67e8f9_0_3px,#0f172a_3px_7px)]',
    },
    {
      id: 'grain',
      label: 'Grain',
      helper: 'tekstur halus',
      swatch:
        'bg-[radial-gradient(circle_at_30%_20%,#fef3c7,transparent_24%),radial-gradient(circle_at_70%_64%,#e879f9,transparent_22%),#111827]',
    },
  ];

const REELS_FEED_TABS: Array<{ id: ReelsFeedTab; label: string }> = [
  { id: 'fyp', label: 'FYP' },
  { id: 'friends', label: 'Teman' },
  { id: 'following', label: 'Diikuti' },
];

const SIGNAL_WEIGHT: Record<ReelsSignal | ReelUserAction, number> = {
  watch: 0.7,
  like: 4,
  share: 4.8,
  save: 5.5,
  follow: 5,
  detail: 2.4,
  product: 6,
};

const BACKEND_SIGNAL_EVENT: Record<ReelsSignal, string> = {
  watch: 'watch',
  share: 'share',
  detail: 'view',
  product: 'open_product',
};

const EMPTY_REEL_ACTION_STATE: ReelActionState = {
  liked: false,
  saved: false,
  followed: false,
  loading: null,
};

function getReelFilterCss(filterPreset?: string | null) {
  return (
    REEL_FILTER_PRESETS.find(item => item.id === filterPreset)?.css ?? 'none'
  );
}

function getReelMediaStyle(
  filterPreset?: string | null,
): CSSProperties | undefined {
  const filter = getReelFilterCss(filterPreset);
  return filter === 'none' ? undefined : { filter };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStudioEffect(value: unknown): value is ReelsStudioEffect {
  return (
    typeof value === 'string' &&
    REELS_STUDIO_EFFECTS.some(effect => effect.id === value)
  );
}

function getReelStudioEffect(reel: Pick<LajukanReel, 'metadata'>) {
  const metadata = reel.metadata;
  if (!isPlainRecord(metadata)) return 'none' as ReelsStudioEffect;

  const directEffect =
    metadata.cameraEffect || metadata.effect || metadata.studioEffect;
  if (isStudioEffect(directEffect)) return directEffect;

  const studio = metadata.studio;
  if (isPlainRecord(studio) && isStudioEffect(studio.effect)) {
    return studio.effect;
  }

  return 'none' as ReelsStudioEffect;
}

function getStudioDurationMs(duration: ReelsStudioDuration) {
  const seconds = Number.parseInt(duration.replace(/\D/g, ''), 10);
  return Math.max(Number.isFinite(seconds) ? seconds : 15, 5) * 1000;
}

function drawVideoCoverFrame(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  const sourceWidth = video.videoWidth || width;
  const sourceHeight = video.videoHeight || height;
  const targetRatio = width / height;
  const sourceRatio = sourceWidth / sourceHeight;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  context.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
}

function drawStudioCanvasEffect(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  effect: ReelsStudioEffect,
) {
  if (effect === 'none') return;

  context.save();
  if (effect === 'clean') {
    const glow = context.createRadialGradient(
      width * 0.5,
      height * 0.18,
      0,
      width * 0.5,
      height * 0.18,
      width * 0.78,
    );
    glow.addColorStop(0, 'rgba(255,255,255,0.22)');
    glow.addColorStop(0.55, 'rgba(16,185,129,0.08)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
  } else if (effect === 'product') {
    const warmth = context.createLinearGradient(0, 0, width, height);
    warmth.addColorStop(0, 'rgba(250,204,21,0.16)');
    warmth.addColorStop(0.52, 'rgba(255,255,255,0.03)');
    warmth.addColorStop(1, 'rgba(244,63,94,0.12)');
    context.fillStyle = warmth;
    context.fillRect(0, 0, width, height);
  } else if (effect === 'focus') {
    const vignette = context.createRadialGradient(
      width / 2,
      height * 0.47,
      width * 0.16,
      width / 2,
      height * 0.5,
      width * 0.76,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.62, 'rgba(0,0,0,0.08)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);
  } else if (effect === 'scan') {
    context.fillStyle = 'rgba(6,182,212,0.12)';
    for (let y = 0; y < height; y += 18) {
      context.fillRect(0, y, width, 2);
    }
  } else if (effect === 'grain') {
    context.fillStyle = 'rgba(255,255,255,0.025)';
    for (let i = 0; i < 280; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      context.fillRect(x, y, 1.2, 1.2);
    }
  }
  context.restore();
}

function getLiveLabel(reel: Pick<LajukanReel, 'liveStatus' | 'captureMode'>) {
  if (reel.liveStatus === 'live') return 'LIVE';
  if (reel.liveStatus === 'scheduled' || reel.captureMode === 'live') {
    return 'Live siap';
  }
  return null;
}

function toDatetimeLocalValue(value: Date) {
  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  const parsed = value ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime())
    ? parsed.toISOString()
    : undefined;
}

function normalizeReelActionState(
  value: Partial<ReelActionState> | null | undefined,
): ReelActionState {
  return {
    liked: Boolean(value?.liked),
    saved: Boolean(value?.saved),
    followed: Boolean(value?.followed),
    loading: value?.loading ?? null,
  };
}

function setActionValue(
  state: ReelActionState,
  action: ReelUserAction,
  active: boolean,
): ReelActionState {
  if (action === 'like') return { ...state, liked: active };
  if (action === 'save') return { ...state, saved: active };
  return { ...state, followed: active };
}

function readActionValue(state: ReelActionState, action: ReelUserAction) {
  if (action === 'like') return state.liked;
  if (action === 'save') return state.saved;
  return state.followed;
}

const compactMultipliers: Record<string, number> = {
  K: 1_000,
  M: 1_000_000,
  B: 1_000_000_000,
  T: 1_000_000_000_000,
};

function emptyProfile(): PreferenceProfile {
  return { terms: {}, searches: [], signals: 0, updatedAt: Date.now() };
}

function readProfile(): PreferenceProfile {
  if (typeof window === 'undefined') return emptyProfile();

  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as Partial<PreferenceProfile>;

    return {
      terms:
        parsed.terms && typeof parsed.terms === 'object' ? parsed.terms : {},
      searches: Array.isArray(parsed.searches)
        ? parsed.searches.slice(0, 12)
        : [],
      signals: Number.isFinite(parsed.signals) ? Number(parsed.signals) : 0,
      updatedAt: Number.isFinite(parsed.updatedAt)
        ? Number(parsed.updatedAt)
        : Date.now(),
    };
  } catch {
    return emptyProfile();
  }
}

function writeProfile(profile: PreferenceProfile) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch { }
}

function readInitialMuted() {
  if (typeof window === 'undefined') return true;

  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY) !== 'on';
  } catch {
    return true;
  }
}

function writeSoundPreference(muted: boolean) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, muted ? 'off' : 'on');
  } catch { }
}

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim();
}

function tokenize(value: string) {
  return normalizeToken(value)
    .split(/\s+/)
    .map(token => token.replace(/^-+|-+$/g, ''))
    .filter(token => token.length > 2 && !STOP_WORDS.has(token));
}

function reelTokens(reel: LajukanReel) {
  return [
    ...tokenize(reel.title),
    ...tokenize(reel.creator),
    ...tokenize(reel.caption),
    ...tokenize(reel.tag),
    ...tokenize(reel.productName || ''),
    ...tokenize(reel.productPrice || ''),
  ];
}

function boostProfile(
  profile: PreferenceProfile,
  tokens: string[],
  weight: number,
  search?: string,
) {
  const next: PreferenceProfile = {
    terms: { ...profile.terms },
    searches: [...profile.searches],
    signals: profile.signals + 1,
    updatedAt: Date.now(),
  };

  tokens.forEach(token => {
    next.terms[token] = Math.min((next.terms[token] || 0) + weight, 999);
  });

  const normalizedSearch = normalizeToken(search || '');
  if (normalizedSearch) {
    next.searches = [
      normalizedSearch,
      ...next.searches.filter(item => item !== normalizedSearch),
    ].slice(0, 12);
    tokenize(normalizedSearch).forEach(token => {
      next.terms[token] = Math.min(
        (next.terms[token] || 0) + weight * 1.4,
        999,
      );
    });
  }

  return next;
}

function scoreReel(reel: LajukanReel, profile: PreferenceProfile, query = '') {
  const tokens = reelTokens(reel);
  const queryTokens = tokenize(query);
  const preferenceScore = tokens.reduce(
    (total, token) => total + (profile.terms[token] || 0),
    0,
  );
  const queryScore = queryTokens.reduce(
    (total, token) => total + (tokens.includes(token) ? 80 : 0),
    0,
  );

  return preferenceScore + queryScore;
}

function topProfileTerms(profile: PreferenceProfile) {
  return Object.entries(profile.terms)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term]) => term);
}

function rankItems(items: LajukanReel[], profile: PreferenceProfile) {
  return [...items].sort(
    (a, b) => scoreReel(b, profile) - scoreReel(a, profile),
  );
}

function parseCompactMetric(value: string) {
  const match = value.trim().match(/^([\d.,]+)\s*([KMBT])?/i);
  if (!match) return 0;
  const amount = Number.parseFloat(match[1].replace(',', '.'));
  const suffix = (match[2] || '').toUpperCase();
  return Math.round(amount * (compactMultipliers[suffix] || 1));
}

function formatCompactMetric(value: number) {
  const suffixes = ['', 'K', 'M', 'B', 'T'];
  let scaled = Math.max(value, 0);
  let suffixIndex = 0;

  while (scaled >= 1000 && suffixIndex < suffixes.length - 1) {
    scaled /= 1000;
    suffixIndex += 1;
  }

  const formatted =
    scaled >= 100 || suffixIndex === 0
      ? Math.round(scaled).toString()
      : scaled >= 10
        ? scaled.toFixed(1)
        : scaled.toFixed(2);

  return `${formatted.replace(/\.0+$/, '')}${suffixes[suffixIndex]}`;
}

function metricCount(
  reel: LajukanReel,
  field: 'likes' | 'comments' | 'shares',
) {
  const numericKey = `${field}Count` as
    | 'likesCount'
    | 'commentsCount'
    | 'sharesCount';
  const numeric = reel[numericKey];
  return typeof numeric === 'number' && Number.isFinite(numeric)
    ? numeric
    : parseCompactMetric(reel[field]);
}

function buildReelShareUrl(locale: string, reel: LajukanReel | null) {
  const fallbackPath = `/${locale}/reels`;
  if (typeof window === 'undefined') return fallbackPath;

  const url = new URL(window.location.href);
  url.pathname = fallbackPath;

  if (!url.searchParams.get('video') && reel) {
    const fallbackVideo = reel.baseId || reel.id.split(':').at(-1) || '1';
    url.searchParams.set('video', fallbackVideo);
  }

  return url.toString();
}

function buildReelCreatorProfileHref(locale: string, reel: LajukanReel) {
  return localizedHref(
    locale,
    buildPublicProfileHref({
      id: reel.creatorUserId || undefined,
      full_name: reel.creator,
      title: reel.creator,
    }),
  );
}

function readReelMetadataText(reel: LajukanReel, ...keys: string[]): string {
  const metadata = reel.metadata;
  if (!metadata) return '';

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getReelCreatorAvatarSrc(reel: LajukanReel) {
  return profileAvatarSrc(
    readReelMetadataText(
      reel,
      'creator_avatar_url',
      'creatorAvatarUrl',
      'author_avatar_url',
      'authorAvatarUrl',
      'owner_avatar_url',
      'ownerAvatarUrl',
      'profile_image_url',
      'profileImageUrl',
      'avatar_url',
      'avatarUrl',
      'avatar',
    ),
  );
}

function ReelCreatorAvatar({
  reel,
  className,
  imageClassName,
  size = 48,
}: {
  reel: LajukanReel;
  className?: string;
  imageClassName?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        'relative block shrink-0 overflow-hidden rounded-full bg-white/12',
        className,
      )}
    >
      <NextImage
        src={getReelCreatorAvatarSrc(reel)}
        alt=""
        width={size}
        height={size}
        className={cn('h-full w-full object-cover', imageClassName)}
        unoptimized
      />
    </span>
  );
}

export default function ReelsClient({
  locale,
  initialIndex,
  initialItems,
  initialCursor,
  initialHasMore,
  initialSearchQuery,
  initialUploadOpen = false,
}: ReelsClientProps) {
  const { user, isAuthenticated, authFetch, loading: authLoading } = useAuth();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const rafRef = useRef<number | null>(null);
  const loadingRef = useRef(false);
  const firstScrollDoneRef = useRef(false);
  const scrollLockRef = useRef(false);
  const wheelDeltaRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const normalizedInitialItems = useMemo(
    () => normalizePlayableReels(initialItems),
    [initialItems],
  );

  const safeInitialIndex = Math.min(
    Math.max(initialIndex, 0),
    Math.max(normalizedInitialItems.length - 1, 0),
  );

  const [items, setItems] = useState<LajukanReel[]>(normalizedInitialItems);
  const [cursor, setCursor] = useState<number | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PreferenceProfile>(() =>
    emptyProfile(),
  );

  const [activeIndex, setActiveIndex] = useState(safeInitialIndex);
  const [feedTab, setFeedTab] = useState<ReelsFeedTab>('fyp');
  const [searchContextQuery, setSearchContextQuery] = useState(
    initialSearchQuery.trim(),
  );
  const [muted, setMuted] = useState(() => readInitialMuted());
  const [soundUnlocked, setSoundUnlocked] = useState(() => !readInitialMuted());
  const [pausedByUser, setPausedByUser] = useState(false);
  const [autoScroll] = useState(false);
  const [bufferingId, setBufferingId] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(Boolean(initialSearchQuery));
  const [searchSeed, setSearchSeed] = useState(initialSearchQuery);
  const [detailReel, setDetailReel] = useState<LajukanReel | null>(null);
  const [productReel, setProductReel] = useState<LajukanReel | null>(null);
  const [commentsReel, setCommentsReel] = useState<LajukanReel | null>(null);
  const [shareReel, setShareReel] = useState<LajukanReel | null>(null);
  const [actionsReel, setActionsReel] = useState<LajukanReel | null>(null);
  const [commentsByReel, setCommentsByReel] = useState<
    Record<string, ReelCommentsBucket>
  >({});
  const [actionsByReel, setActionsByReel] = useState<
    Record<string, ReelActionState>
  >({});
  const [commentBody, setCommentBody] = useState('');
  const [replyTarget, setReplyTarget] = useState<ReelComment | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);
  const [chatBusyReelId, setChatBusyReelId] = useState<string | null>(null);
  const initialUploadHandledRef = useRef(false);

  const overlayOpen =
    searchOpen ||
    detailReel !== null ||
    productReel !== null ||
    commentsReel !== null ||
    shareReel !== null ||
    actionsReel !== null ||
    uploadOpen ||
    authPrompt !== null;

  const hasEndSlide = !hasMore && items.length > 0;
  const reelPageCount = items.length + (hasEndSlide ? 1 : 0);

  const activeReel = useMemo(() => {
    if (items.length === 0) return null;
    if (activeIndex >= items.length) return null;
    return items[activeIndex] || null;
  }, [activeIndex, items]);
  const activeReelId = activeReel?.id ?? null;

  const learnedTerms = useMemo(() => topProfileTerms(profile), [profile]);
  const activeSearchQuery = searchContextQuery.trim();

  const loginHref = useMemo(() => {
    const videoParam = activeReel?.id || String(Math.max(activeIndex + 1, 1));
    const callbackUrl = `/${locale}/reels?video=${encodeURIComponent(videoParam)}`;
    return `/${locale}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }, [activeIndex, activeReel?.id, locale]);

  const displayName =
    user?.fullName ||
    user?.full_name ||
    user?.name ||
    user?.username ||
    user?.email ||
    'Akun Lajukan';

  const replaceReel = useCallback((nextReel: LajukanReel) => {
    const safeNextReel = normalizePlayableReel(nextReel);

    setItems(current =>
      current.map(item => (item.id === safeNextReel.id ? safeNextReel : item)),
    );
    setDetailReel(current =>
      current?.id === safeNextReel.id ? safeNextReel : current,
    );
    setProductReel(current =>
      current?.id === safeNextReel.id ? safeNextReel : current,
    );
    setCommentsReel(current =>
      current?.id === safeNextReel.id ? safeNextReel : current,
    );
    setShareReel(current =>
      current?.id === safeNextReel.id ? safeNextReel : current,
    );
  }, []);

  const recordSearchIntent = useCallback((query: string) => {
    const tokens = tokenize(query);
    if (tokens.length === 0) return;

    setProfile(current => {
      const next = boostProfile(current, tokens, 1.1, query);
      writeProfile(next);
      return next;
    });
  }, []);

  const recordSignal = useCallback(
    (reel: LajukanReel, signal: ReelsSignal) => {
      setProfile(current => {
        const next = boostProfile(
          current,
          reelTokens(reel),
          SIGNAL_WEIGHT[signal],
        );
        writeProfile(next);
        return next;
      });

      const request = isAuthenticated ? authFetch : fetch;
      void request(`/api/reels/${encodeURIComponent(reel.id)}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: BACKEND_SIGNAL_EVENT[signal],
          metadata: { signal },
        }),
        keepalive: true,
      })
        .then(async response => {
          if (!response.ok) return;
          const payload = (await response.json().catch(() => null)) as {
            reel?: LajukanReel;
          } | null;
          if (payload?.reel) replaceReel(payload.reel);
        })
        .catch(() => undefined);
    },
    [authFetch, isAuthenticated, replaceReel],
  );

  const loadReelActionState = useCallback(
    async (reel: LajukanReel) => {
      if (!isAuthenticated) return;

      setActionsByReel(current => ({
        ...current,
        [reel.id]: {
          ...(current[reel.id] || EMPTY_REEL_ACTION_STATE),
          loading: current[reel.id]?.loading ?? null,
        },
      }));

      try {
        const response = await authFetch(
          `/api/reels/${encodeURIComponent(reel.id)}/me`,
          { cache: 'no-store' },
        );
        const payload = (await response
          .json()
          .catch(() => null)) as Partial<ReelActionState> | null;
        if (!response.ok || !payload) return;
        setActionsByReel(current => ({
          ...current,
          [reel.id]: normalizeReelActionState(payload),
        }));
      } catch { }
    },
    [authFetch, isAuthenticated],
  );

  const handleReelAction = useCallback(
    async (reel: LajukanReel, action: ReelUserAction, active?: boolean) => {
      if (!isAuthenticated) {
        const prompt =
          action === 'like'
            ? 'Masuk dulu untuk menyukai reels.'
            : action === 'save'
              ? 'Masuk dulu untuk menyimpan reels.'
              : 'Masuk dulu untuk mengikuti creator.';
        setAuthPrompt(prompt);
        return;
      }

      const previous = actionsByReel[reel.id] || normalizeReelActionState(null);
      const nextActive = active ?? !readActionValue(previous, action);
      const optimistic = setActionValue(previous, action, nextActive);

      setActionsByReel(current => ({
        ...current,
        [reel.id]: { ...optimistic, loading: action },
      }));

      if (nextActive) {
        setProfile(current => {
          const next = boostProfile(
            current,
            reelTokens(reel),
            SIGNAL_WEIGHT[action],
          );
          writeProfile(next);
          return next;
        });
      }

      try {
        const response = await authFetch(
          `/api/reels/${encodeURIComponent(reel.id)}/actions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, active: nextActive }),
          },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          actionState?: Partial<ReelActionState>;
          reel?: LajukanReel;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || 'Aksi reels gagal disimpan');
        }

        if (payload.reel) replaceReel(payload.reel);
        setActionsByReel(current => ({
          ...current,
          [reel.id]: normalizeReelActionState(payload.actionState),
        }));
      } catch (error) {
        setActionsByReel(current => ({
          ...current,
          [reel.id]: previous,
        }));
        setAuthPrompt(
          error instanceof Error ? error.message : 'Aksi reels gagal disimpan',
        );
      }
    },
    [actionsByReel, authFetch, isAuthenticated, replaceReel],
  );

  const openShareSheet = useCallback(
    (reel: LajukanReel) => {
      recordSignal(reel, 'share');
      setShareReel(reel);
    },
    [recordSignal],
  );

  useEffect(() => {
    const storedProfile = readProfile();
    setProfile(storedProfile);

    if (storedProfile.signals > 0 && safeInitialIndex === 0) {
      setItems(current => rankItems(current, storedProfile));
    }
  }, [safeInitialIndex]);

  useEffect(() => {
    if (!isAuthenticated) {
      setActionsByReel({});
      return;
    }
    if (activeReel) {
      void loadReelActionState(activeReel);
    }
  }, [activeReel, isAuthenticated, loadReelActionState]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || cursor === null) return;

    loadingRef.current = true;
    setLoadingMore(true);
    setLoadError(null);

    try {
      const params = new URLSearchParams({
        cursor: String(cursor),
        limit: String(REELS_PAGE_SIZE),
      });
      if (initialSearchQuery.trim()) {
        params.set('q', initialSearchQuery.trim());
      }

      const response = await fetch(`/api/reels?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to load reels');
      }

      const data = (await response.json()) as ReelsPageResult;

      setItems(prev => {
        const nextItems = normalizePlayableReels(data.items, prev.length);
        return [...prev, ...rankItems(nextItems, profile)];
      });

      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      setLoadError('Gagal memuat video. Coba lagi.');
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [cursor, hasMore, initialSearchQuery, profile]);

  const loadComments = useCallback(
    async (reelId: string, reset = false) => {
      const current = commentsByReel[reelId];
      if (current?.loading) return;
      if (!reset && current && !current.hasMore) return;

      const cursorValue = reset ? 0 : (current?.cursor ?? 0);

      setCommentsByReel(state => {
        const existing = state[reelId] ?? {
          items: [],
          cursor: null,
          hasMore: true,
          loading: false,
          error: null,
        };
        return {
          ...state,
          [reelId]: {
            ...existing,
            loading: true,
            error: null,
          },
        };
      });

      try {
        const params = new URLSearchParams({
          cursor: String(cursorValue),
          limit: '20',
        });
        const response = await fetch(
          `/api/reels/${encodeURIComponent(reelId)}/comments?${params.toString()}`,
          { cache: 'no-store' },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          items?: ReelComment[];
          nextCursor?: number | null;
          hasMore?: boolean;
          error?: string;
        };

        if (!response.ok || !Array.isArray(payload.items)) {
          throw new Error(payload.error || 'Gagal memuat komentar');
        }

        setCommentsByReel(state => {
          const existing = state[reelId] ?? {
            items: [],
            cursor: null,
            hasMore: true,
            loading: false,
            error: null,
          };
          return {
            ...state,
            [reelId]: {
              items: reset
                ? payload.items!
                : [...existing.items, ...payload.items!],
              cursor: payload.nextCursor ?? null,
              hasMore: Boolean(payload.hasMore),
              loading: false,
              error: null,
            },
          };
        });
      } catch (error) {
        setCommentsByReel(state => {
          const existing = state[reelId] ?? {
            items: [],
            cursor: null,
            hasMore: true,
            loading: false,
            error: null,
          };
          return {
            ...state,
            [reelId]: {
              ...existing,
              loading: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Gagal memuat komentar',
            },
          };
        });
      }
    },
    [commentsByReel],
  );

  const openComments = useCallback(
    (reel: LajukanReel) => {
      setCommentsReel(reel);
      setCommentBody('');
      setReplyTarget(null);
      if (!commentsByReel[reel.id]) {
        void loadComments(reel.id, true);
      }
    },
    [commentsByReel, loadComments],
  );

  const startChatFromReel = useCallback(
    async (reel: LajukanReel, sourceComment?: ReelComment | null) => {
      if (!isAuthenticated) {
        setAuthPrompt('Masuk dulu untuk chat pembuat reels ini.');
        return;
      }

      const creatorUserId = reel.creatorUserId?.trim();
      if (!creatorUserId) {
        setAuthPrompt(
          'Creator reels ini belum terhubung ke akun chat. Coba reels yang dibuat user login.',
        );
        return;
      }
      if (user?.id && creatorUserId === user.id) {
        setAuthPrompt(
          'Ini reels kamu sendiri, jadi tidak perlu buka DM ke diri sendiri.',
        );
        return;
      }

      setChatBusyReelId(reel.id);
      try {
        const roomResponse = await authFetch('/api/chat/create-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            peer_user_id: creatorUserId,
            lead: {
              source: 'reels',
              name: `Reels: ${reel.title}`,
              metadata: {
                reelId: reel.id,
                reelTitle: reel.title,
                mediaUrl: reel.videoSrc,
                productName: reel.productName,
                sourceCommentId: sourceComment?.id,
              },
            },
          }),
        });
        const roomPayload = (await roomResponse.json().catch(() => ({}))) as {
          room_id?: string;
          error?: string;
        };
        const roomId = roomPayload.room_id?.trim();
        if (!roomResponse.ok || !roomId) {
          throw new Error(roomPayload.error || 'Gagal membuka chat creator');
        }

        const intro = sourceComment
          ? `Aku balas komentar di reels "${reel.title}": ${sourceComment.body.slice(0, 180)}`
          : `Aku tertarik dari reels "${reel.title}". Bisa dibahas lebih lanjut?`;

        await authFetch(
          `/api/chat/rooms/${encodeURIComponent(roomId)}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: intro,
              type:
                reel.mediaType === 'image' || isImageMediaUrl(reel.videoSrc)
                  ? 'image'
                  : 'video',
              attachments: [reel.videoSrc],
            }),
          },
        ).catch(() => undefined);

        router.push(`/${locale}/chat/${encodeURIComponent(roomId)}`);
      } catch (error) {
        setAuthPrompt(
          error instanceof Error
            ? error.message
            : 'Gagal membuka chat creator.',
        );
      } finally {
        setChatBusyReelId(null);
      }
    },
    [authFetch, isAuthenticated, locale, router, user?.id],
  );

  const submitComment = useCallback(async () => {
    if (!commentsReel || commentSubmitting) return;
    if (!isAuthenticated) {
      setAuthPrompt('Masuk dulu untuk ikut komentar di reels ini.');
      return;
    }

    const body = commentBody.trim();
    if (!body) return;

    setCommentSubmitting(true);
    try {
      const response = await authFetch(
        `/api/reels/${encodeURIComponent(commentsReel.id)}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body, parentCommentId: replyTarget?.id }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        comment?: ReelComment;
        reel?: LajukanReel;
        error?: string;
      };

      if (!response.ok || !payload.comment) {
        throw new Error(payload.error || 'Komentar gagal dikirim');
      }

      setCommentsByReel(state => {
        const existing = state[commentsReel.id] ?? {
          items: [],
          cursor: null,
          hasMore: true,
          loading: false,
          error: null,
        };
        return {
          ...state,
          [commentsReel.id]: {
            ...existing,
            items: [payload.comment!, ...existing.items],
            error: null,
          },
        };
      });

      if (payload.reel) replaceReel(payload.reel);
      setCommentBody('');
      setReplyTarget(null);
    } catch (error) {
      setCommentsByReel(state => {
        const existing = state[commentsReel.id] ?? {
          items: [],
          cursor: null,
          hasMore: true,
          loading: false,
          error: null,
        };
        return {
          ...state,
          [commentsReel.id]: {
            ...existing,
            error:
              error instanceof Error ? error.message : 'Komentar gagal dikirim',
          },
        };
      });
    } finally {
      setCommentSubmitting(false);
    }
  }, [
    authFetch,
    commentBody,
    commentSubmitting,
    commentsReel,
    isAuthenticated,
    replaceReel,
    replyTarget?.id,
  ]);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const container = containerRef.current;
      if (!container) return;

      const nextIndex = Math.min(
        Math.max(index, 0),
        Math.max(reelPageCount - 1, 0),
      );

      container.scrollTo({
        top: nextIndex * container.clientHeight,
        behavior,
      });

      setActiveIndex(nextIndex);
      setPausedByUser(false);
    },
    [reelPageCount],
  );

  const snapToAdjacent = useCallback(
    (direction: -1 | 1) => {
      if (overlayOpen || scrollLockRef.current || reelPageCount === 0) return;

      const nextIndex = Math.min(
        Math.max(activeIndex + direction, 0),
        Math.max(reelPageCount - 1, 0),
      );

      if (nextIndex === activeIndex) return;

      scrollLockRef.current = true;
      scrollToIndex(nextIndex);

      window.setTimeout(() => {
        scrollLockRef.current = false;
      }, REELS_SNAP_LOCK_MS);
    },
    [activeIndex, overlayOpen, reelPageCount, scrollToIndex],
  );

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (overlayOpen) return;

      const delta =
        Math.abs(event.deltaY) >= Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;

      if (delta === 0) return;

      event.preventDefault();
      wheelDeltaRef.current += delta;

      if (Math.abs(wheelDeltaRef.current) < REELS_WHEEL_THRESHOLD) return;

      const direction = wheelDeltaRef.current > 0 ? 1 : -1;
      wheelDeltaRef.current = 0;
      snapToAdjacent(direction);
    },
    [overlayOpen, snapToAdjacent],
  );

  const handleTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (overlayOpen) return;
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    },
    [overlayOpen],
  );

  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (overlayOpen) return;

      const startY = touchStartYRef.current;
      touchStartYRef.current = null;

      if (startY === null) return;

      const endY = event.changedTouches[0]?.clientY ?? startY;
      const delta = startY - endY;

      if (Math.abs(delta) < REELS_TOUCH_THRESHOLD) return;

      snapToAdjacent(delta > 0 ? 1 : -1);
    },
    [overlayOpen, snapToAdjacent],
  );

  const handleReelsKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (overlayOpen) return;

      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault();
        snapToAdjacent(1);
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        snapToAdjacent(-1);
      }
    },
    [overlayOpen, snapToAdjacent],
  );

  const handleReelCreated = useCallback((reel: LajukanReel) => {
    setItems(current => [reel, ...current.filter(item => item.id !== reel.id)]);
    setActiveIndex(0);
    setPausedByUser(false);
    setUploadOpen(false);
    window.requestAnimationFrame(() => {
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, []);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      const container = containerRef.current;
      if (!container || reelPageCount === 0) return;

      const height = container.clientHeight || window.innerHeight;
      const rawIndex = Math.round(container.scrollTop / height);

      const nextIndex = Math.min(
        Math.max(rawIndex, 0),
        Math.max(reelPageCount - 1, 0),
      );

      setActiveIndex(prev => (prev === nextIndex ? prev : nextIndex));

      const distanceToBottom =
        container.scrollHeight - (container.scrollTop + height);

      if (distanceToBottom < height * 2) {
        void loadMore();
      }
    });
  }, [loadMore, reelPageCount]);

  useEffect(() => {
    if (firstScrollDoneRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    firstScrollDoneRef.current = true;

    const frame = requestAnimationFrame(() => {
      container.scrollTo({
        top: safeInitialIndex * container.clientHeight,
        behavior: 'auto',
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [safeInitialIndex]);

  useEffect(() => {
    if (activeIndex >= items.length - 3) {
      void loadMore();
    }
  }, [activeIndex, items.length, loadMore]);

  useEffect(() => {
    if (activeReel) {
      window.history.replaceState(
        null,
        '',
        `/${locale}/reels?video=${encodeURIComponent(activeReel.id)}`,
      );
    }
  }, [activeReel, locale]);

  useEffect(() => {
    if (!activeReel || overlayOpen) return;

    const timer = window.setTimeout(() => {
      recordSignal(activeReel, 'watch');
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [activeReel, overlayOpen, recordSignal]);

  useEffect(() => {
    if (!autoScroll || overlayOpen || pausedByUser || items.length <= 1) return;

    const timer = window.setTimeout(() => {
      const nextIndex = activeIndex >= items.length - 1 ? 0 : activeIndex + 1;
      scrollToIndex(nextIndex);
    }, REELS_AUTO_SCROLL_MS);

    return () => window.clearTimeout(timer);
  }, [
    activeIndex,
    autoScroll,
    items.length,
    overlayOpen,
    pausedByUser,
    scrollToIndex,
  ]);

  useEffect(() => {
    setPausedByUser(false);
    setBufferingId(null);
  }, [activeIndex]);

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([reelId, video]) => {
      if (!video) return;

      video.muted = muted;
      video.volume = muted ? 0 : 1;

      const isActiveVideo = reelId === activeReelId;

      if (overlayOpen || !isActiveVideo || pausedByUser) {
        video.pause();
        return;
      }

      video.play().catch(() => {
        if (!muted) {
          video.muted = true;
          video.volume = 0;
          setMuted(true);
          setSoundUnlocked(false);
          writeSoundPreference(true);
        }
      });
    });
  }, [activeReelId, muted, overlayOpen, pausedByUser]);

  useEffect(() => {
    const mountedVideoRefs = videoRefs.current;
    return () => {
      Object.values(mountedVideoRefs).forEach(video => {
        video?.pause();
      });
    };
  }, []);

  function toggleCurrentVideo() {
    if (!activeReel) return;

    const video = videoRefs.current[activeReel.id];
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => { });
      setPausedByUser(false);
    } else {
      video.pause();
      setPausedByUser(true);
    }
  }

  function toggleSound() {
    const nextMuted = !muted;

    setMuted(nextMuted);
    writeSoundPreference(nextMuted);

    if (!nextMuted) {
      setSoundUnlocked(true);
    }

    if (!activeReel) return;

    const video = videoRefs.current[activeReel.id];
    if (!video) return;

    video.muted = nextMuted;
    video.volume = nextMuted ? 0 : 1;

    if (!nextMuted) {
      video.play().catch(() => { });
      setPausedByUser(false);
    }
  }

  const openSearchOverlay = (seed = activeSearchQuery) => {
    setSearchSeed(seed);
    setSearchOpen(true);
  };

  const handleFeedTabChange = useCallback(
    (tab: ReelsFeedTab) => {
      setFeedTab(tab);
      setSearchContextQuery('');
      wheelDeltaRef.current = 0;

      if (tab !== feedTab) {
        scrollToIndex(0);
      }
    },
    [feedTab, scrollToIndex],
  );

  const requestUpload = useCallback(() => {
    if (!isAuthenticated) {
      setAuthPrompt('Masuk dulu untuk upload reels usaha.');
      return;
    }

    setUploadOpen(true);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!initialUploadOpen || initialUploadHandledRef.current || authLoading)
      return;
    initialUploadHandledRef.current = true;
    if (!isAuthenticated) {
      setAuthPrompt('Masuk dulu untuk upload reels usaha.');
      return;
    }
    setUploadOpen(true);
  }, [authLoading, initialUploadOpen, isAuthenticated]);

  return (
    <main className="h-[100svh] overflow-hidden bg-black text-white">
      <div className="relative h-full w-full overflow-hidden bg-[#050505]">
        <div className="relative h-full min-w-0 overflow-hidden bg-black lg:bg-[#050505]">
          <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(250,204,21,0.10),transparent_32%)] lg:block" />

          <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-black shadow-2xl sm:max-w-[460px] lg:my-3 lg:h-[calc(100svh-24px)] lg:max-w-[430px] lg:rounded-[32px] lg:ring-1 lg:ring-white/10">
            <ReelsTopBar
              locale={locale}
              feedTab={feedTab}
              searchQuery={activeSearchQuery}
              onFeedTabChange={handleFeedTabChange}
              onOpenSearch={() => openSearchOverlay(activeSearchQuery)}
            />

            <div
              ref={containerRef}
              onScroll={handleScroll}
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onKeyDown={handleReelsKeyDown}
              tabIndex={0}
              className="h-full snap-y snap-mandatory overflow-hidden scroll-smooth outline-none [scrollbar-width:none] [touch-action:none] [&::-webkit-scrollbar]:hidden"
            >
              {items.length > 0 ? (
                <>
                  {items.map((reel, index) => (
                    <ReelSlide
                      key={reel.id}
                      locale={locale}
                      reel={reel}
                      active={index === activeIndex}
                      shouldLoad={
                        Math.abs(index - activeIndex) <= REELS_RENDER_WINDOW
                      }
                      muted={muted}
                      soundUnlocked={soundUnlocked}
                      paused={pausedByUser && index === activeIndex}
                      buffering={
                        bufferingId === reel.id && index === activeIndex
                      }
                      actionState={
                        actionsByReel[reel.id] || EMPTY_REEL_ACTION_STATE
                      }
                      setVideoRef={node => {
                        if (node) {
                          videoRefs.current[reel.id] = node;
                        } else {
                          delete videoRefs.current[reel.id];
                        }
                      }}
                      onWaiting={() => {
                        if (index === activeIndex) setBufferingId(reel.id);
                      }}
                      onPlaying={() => {
                        if (bufferingId === reel.id) setBufferingId(null);
                      }}
                      onError={() => {
                        if (index === activeIndex) setBufferingId(null);
                        setLoadError('Video dari database tidak bisa diputar.');
                      }}
                      onTogglePlay={toggleCurrentVideo}
                      onToggleSound={toggleSound}
                      onOpenDetail={() => {
                        recordSignal(reel, 'detail');
                        setDetailReel(reel);
                      }}
                      onOpenComments={() => openComments(reel)}
                      onOpenProduct={() => {
                        recordSignal(reel, 'product');
                        setProductReel(reel);
                      }}
                      onOpenShare={() => openShareSheet(reel)}
                      onOpenActions={() => setActionsReel(reel)}
                      onAction={(action, active) =>
                        void handleReelAction(reel, action, active)
                      }
                    />
                  ))}
                  {hasEndSlide ? (
                    <ReelsEndSlide
                      locale={locale}
                      totalCount={items.length}
                      learnedTerms={learnedTerms}
                      onRestart={() => scrollToIndex(0)}
                      onSearch={(seed?: string) =>
                        openSearchOverlay(seed ?? '')
                      }
                      onUpload={requestUpload}
                    />
                  ) : null}
                </>
              ) : (
                <ReelsEmptyState
                  locale={locale}
                  onUpload={requestUpload}
                  onSearch={() => openSearchOverlay('')}
                />
              )}
            </div>

            <LoadingToast
              loading={loadingMore}
              error={loadError}
              onRetry={() => void loadMore()}
            />

            <ReelsCreateDock
              locale={locale}
              isAuthenticated={isAuthenticated}
              activeReelId={activeReelId}
              onOpenUpload={requestUpload}
            />
          </div>
        </div>

        <SearchOverlay
          key={searchSeed}
          open={searchOpen}
          items={items}
          hasMore={hasMore}
          loadingMore={loadingMore}
          loadError={loadError}
          profile={profile}
          initialQuery={searchSeed}
          learnedTerms={learnedTerms}
          onClose={() => setSearchOpen(false)}
          onLoadMore={() => void loadMore()}
          onSearchIntent={recordSearchIntent}
          onSignal={recordSignal}
          onSelect={(index, query) => {
            setSearchOpen(false);
            setSearchContextQuery(query.trim());
            scrollToIndex(index);
          }}
        />

        <DetailOverlay
          locale={locale}
          reel={detailReel}
          actionState={
            detailReel
              ? actionsByReel[detailReel.id] || EMPTY_REEL_ACTION_STATE
              : EMPTY_REEL_ACTION_STATE
          }
          onAction={(reel, action, active) =>
            void handleReelAction(reel, action, active)
          }
          onOpenComments={reel => openComments(reel)}
          onOpenProduct={reel => {
            recordSignal(reel, 'product');
            setProductReel(reel);
          }}
          onOpenShare={openShareSheet}
          onMessageCreator={reel => void startChatFromReel(reel)}
          chatBusyReelId={chatBusyReelId}
          onClose={() => setDetailReel(null)}
        />

        <CommentsSheet
          reel={commentsReel}
          bucket={commentsReel ? commentsByReel[commentsReel.id] : undefined}
          body={commentBody}
          isAuthenticated={isAuthenticated}
          submitting={commentSubmitting}
          loginHref={loginHref}
          replyTarget={replyTarget}
          chatBusy={chatBusyReelId === commentsReel?.id}
          onBodyChange={setCommentBody}
          onReply={comment => {
            if (!isAuthenticated) {
              setAuthPrompt('Masuk dulu untuk membalas komentar.');
              return;
            }
            setReplyTarget(comment);
            setCommentBody(current => current || `@${comment.authorName} `);
          }}
          onCancelReply={() => setReplyTarget(null)}
          onChatCreator={comment =>
            commentsReel
              ? void startChatFromReel(commentsReel, comment)
              : undefined
          }
          onClose={() => {
            setCommentsReel(null);
            setReplyTarget(null);
          }}
          onLoadMore={reelId => void loadComments(reelId)}
          onSubmit={() => void submitComment()}
          onRequireLogin={() =>
            setAuthPrompt('Masuk dulu untuk ikut komentar di reels ini.')
          }
        />

        <ProductSheet
          locale={locale}
          reel={productReel}
          isAuthenticated={isAuthenticated}
          onClose={() => setProductReel(null)}
          onRequireLogin={() =>
            setAuthPrompt('Masuk dulu untuk mulai transaksi dari reels.')
          }
        />

        <ShareSheet
          locale={locale}
          reel={shareReel}
          chatBusy={chatBusyReelId === shareReel?.id}
          onMessageCreator={reel => void startChatFromReel(reel)}
          onClose={() => setShareReel(null)}
        />

        <MoreActionsSheet
          reel={actionsReel}
          actionState={
            actionsReel
              ? actionsByReel[actionsReel.id] || EMPTY_REEL_ACTION_STATE
              : EMPTY_REEL_ACTION_STATE
          }
          chatBusy={chatBusyReelId === actionsReel?.id}
          onClose={() => setActionsReel(null)}
          onOpenDetail={reel => {
            setActionsReel(null);
            recordSignal(reel, 'detail');
            setDetailReel(reel);
          }}
          onOpenProduct={reel => {
            setActionsReel(null);
            recordSignal(reel, 'product');
            setProductReel(reel);
          }}
          onOpenComments={reel => {
            setActionsReel(null);
            openComments(reel);
          }}
          onOpenShare={reel => {
            setActionsReel(null);
            openShareSheet(reel);
          }}
          onMessageCreator={reel => void startChatFromReel(reel)}
          onAction={(reel, action, active) =>
            void handleReelAction(reel, action, active)
          }
        />

        <UploadReelSheet
          locale={locale}
          open={uploadOpen}
          authFetch={authFetch}
          displayName={displayName}
          onClose={() => setUploadOpen(false)}
          onCreated={handleReelCreated}
        />

        <AuthPromptSheet
          message={authPrompt}
          loginHref={loginHref}
          locale={locale}
          onClose={() => setAuthPrompt(null)}
        />
      </div>
    </main>
  );
}

/* =========================
   TOP BAR
========================= */

function ReelsDesktopSidebar({
  locale,
  feedTab,
  learnedTerms,
  muted,
  displayName,
  onFeedTabChange,
  onToggleSound,
  onOpenSearch,
  onOpenUpload,
}: {
  locale: string;
  feedTab: ReelsFeedTab;
  learnedTerms: string[];
  muted: boolean;
  displayName: string;
  onFeedTabChange: (tab: ReelsFeedTab) => void;
  onToggleSound: () => void;
  onOpenSearch: (seed?: string) => void;
  onOpenUpload: () => void;
}) {
  const feedItems: Array<{
    id: ReelsFeedTab;
    label: string;
    helper: string;
    icon: LucideIcon;
  }> = [
      {
        id: 'fyp',
        label: 'Untukmu',
        helper: 'FYP bisnis yang paling relevan',
        icon: Compass,
      },
      {
        id: 'friends',
        label: 'Friend',
        helper: 'Aktivitas akun yang sering interaksi',
        icon: Users,
      },
      {
        id: 'following',
        label: 'Following',
        helper: 'Creator dan usaha yang kamu ikuti',
        icon: UserPlus,
      },
    ];
  const trendTerms =
    learnedTerms.length > 0
      ? learnedTerms.slice(0, 6)
      : ['supplier', 'packaging', 'kuliner', 'reseller', 'export', 'cashflow'];

  return (
    <aside className="hidden h-full min-h-0 flex-col border-r border-white/10 bg-[#080808] px-4 py-4 text-white lg:flex xl:px-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/${locale}/home`}
          className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-950"
          aria-label="Lajukan home"
          data-testid="reels-home-link"
        >
          <Store className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-base font-black">Lajukan</p>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/42">
            Reels
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpenSearch()}
        className="mt-5 flex h-12 items-center gap-3 rounded-full bg-white/10 px-4 text-left text-sm font-bold text-white/76 ring-1 ring-white/10 transition hover:bg-white/14"
        data-testid="reels-search-button"
      >
        <Search className="h-4.5 w-4.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          Cari reels, produk, supplier...
        </span>
      </button>

      <nav className="mt-5 space-y-1.5">
        <Link
          href={`/${locale}/home`}
          className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-black text-white/72 transition hover:bg-white/8 hover:text-white"
        >
          <Home className="h-5 w-5" />
          Beranda
        </Link>

        {feedItems.map(item => {
          const ItemIcon = item.icon;
          const active = feedTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFeedTabChange(item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition',
                active
                  ? 'bg-white text-slate-950'
                  : 'text-white/72 hover:bg-white/8 hover:text-white',
              )}
            >
              <span
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-full',
                  active ? 'bg-slate-950 text-white' : 'bg-white/10 text-white',
                )}
              >
                <ItemIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">
                  {item.label}
                </span>
                <span
                  className={cn(
                    'block truncate text-[11px] font-semibold',
                    active ? 'text-slate-500' : 'text-white/38',
                  )}
                >
                  {item.helper}
                </span>
              </span>
            </button>
          );
        })}

        <Link
          href={`/${locale}/community`}
          className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-black text-white/72 transition hover:bg-white/8 hover:text-white"
        >
          <MessageCircle className="h-5 w-5" />
          Komunitas
        </Link>
      </nav>

      <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-2 text-sm font-black">
          <Sparkles className="h-4 w-4 text-yellow-300" />
          Lagi relevan
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {trendTerms.map(term => (
            <button
              key={term}
              type="button"
              onClick={() => onOpenSearch(term)}
              className="rounded-full bg-white/8 px-3 py-1.5 text-[11px] font-bold text-white/70 transition hover:bg-white/14 hover:text-white"
            >
              #{term}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-5">
        <button
          type="button"
          onClick={onOpenUpload}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-400 px-4 text-sm font-black text-slate-950 shadow-lg shadow-emerald-400/15 transition active:scale-[0.98]"
          data-testid="reels-upload-button"
        >
          <Camera className="h-4.5 w-4.5" />
          Buat Reels
        </button>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{displayName}</p>
              <p className="truncate text-[11px] font-semibold text-white/40">
                Mode creator usaha
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleSound}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/8 text-white/75 transition hover:bg-white/14 hover:text-white"
              aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
            >
              {muted ? (
                <VolumeX className="h-4.5 w-4.5" />
              ) : (
                <Volume2 className="h-4.5 w-4.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ReelsDesktopInfoSidebar({
  locale,
  reel,
  actionState,
  commentsBucket,
  chatBusy,
  onOpenDetail,
  onOpenComments,
  onOpenProduct,
  onOpenShare,
  onMessageCreator,
  onSave,
  onFollow,
  onOpenUpload,
  onOpenSearch,
}: {
  locale: string;
  reel: LajukanReel | null;
  actionState: ReelActionState;
  commentsBucket?: ReelCommentsBucket;
  chatBusy: boolean;
  onOpenDetail: () => void;
  onOpenComments: () => void;
  onOpenProduct: () => void;
  onOpenShare: () => void;
  onMessageCreator: () => void;
  onSave: () => void;
  onFollow: () => void;
  onOpenUpload: () => void;
  onOpenSearch: () => void;
}) {
  if (!reel) {
    return (
      <aside className="hidden h-full min-h-0 flex-col border-l border-white/10 bg-[#080808] text-white lg:flex">
        <div className="grid min-h-0 flex-1 place-items-center px-5 text-center">
          <div>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/10">
              <Clapperboard className="h-7 w-7 text-white/60" />
            </div>
            <p className="mt-4 text-sm font-black">Reels siap diputar</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-white/45">
              Detail, komentar, produk, dan aksi creator tampil di panel ini.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  const imageMedia = isImageMediaUrl(reel.videoSrc);
  const mediaStyle = getReelMediaStyle(reel.filterPreset);
  const studioEffect = getReelStudioEffect(reel);
  const liveLabel = getLiveLabel(reel);
  const recentComments = commentsBucket?.items.slice(0, 2) ?? [];
  const productHref = reel.productHref
    ? localizedHref(locale, reel.productHref)
    : null;
  const profileHref = buildReelCreatorProfileHref(locale, reel);
  const actions: Array<{
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    featured?: boolean;
  }> = [
      { label: 'Detail', icon: Info, onClick: onOpenDetail },
      { label: 'Komentar', icon: MessageCircle, onClick: onOpenComments },
      { label: 'Share', icon: Forward, onClick: onOpenShare, featured: true },
      {
        label: actionState.saved ? 'Tersimpan' : 'Simpan',
        icon: Bookmark,
        onClick: onSave,
      },
    ];

  return (
    <aside className="hidden h-full min-h-0 flex-col border-l border-white/10 bg-[#080808] text-white lg:flex">
      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 overscroll-contain xl:px-5"
        data-auto-scrollbar
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-yellow-300">
              Sekarang diputar
            </p>
            <h2 className="mt-1 truncate text-lg font-black">{reel.title}</h2>
          </div>
          <button
            type="button"
            onClick={onOpenSearch}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white/78 transition hover:bg-white/14 hover:text-white"
            aria-label="Cari reels"
          >
            <Search className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="relative mt-4 aspect-[16/10] overflow-hidden rounded-[24px] bg-white/8 ring-1 ring-white/10">
          {imageMedia ? (
            <img
              src={reel.videoSrc}
              alt={reel.title}
              className="absolute inset-0 h-full w-full object-cover"
              style={mediaStyle}
            />
          ) : (
            <video
              src={reel.videoSrc}
              className="absolute inset-0 h-full w-full object-cover"
              style={mediaStyle}
              muted
              loop
              playsInline
              preload="none"
            />
          )}
          <StudioEffectOverlay effect={studioEffect} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/14 to-black/20" />
          <div className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-black backdrop-blur">
            {reel.tag}
          </div>
          {liveLabel && (
            <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1.5 text-[11px] font-black text-white shadow-lg shadow-rose-950/20">
              <Radio className="h-3.5 w-3.5" />
              {liveLabel}
            </div>
          )}
          <button
            type="button"
            onClick={onOpenDetail}
            className="absolute inset-0 grid place-items-center"
            aria-label="Lihat detail reels"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/18 backdrop-blur">
              <Play className="h-5 w-5 fill-white" />
            </span>
          </button>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
          <div className="flex items-center gap-3">
            <Link
              href={profileHref}
              className="shrink-0 rounded-full bg-white/14 p-0.5 ring-1 ring-white/18 transition active:scale-95"
              aria-label={`Lihat profil ${reel.creator}`}
            >
              <ReelCreatorAvatar reel={reel} className="h-10 w-10" size={40} />
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={profileHref}
                className="block truncate text-sm font-black text-white underline-offset-4 transition hover:underline"
              >
                {reel.creator}
              </Link>
              <p className="truncate text-[11px] font-semibold text-white/42">
                Creator bisnis dan supplier
              </p>
            </div>
            <button
              type="button"
              onClick={onMessageCreator}
              disabled={chatBusy}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-black text-slate-950 transition active:scale-[0.98] disabled:opacity-60"
            >
              {chatBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MessageSquareText className="h-3.5 w-3.5" />
              )}
              Chat
            </button>
            <button
              type="button"
              onClick={onFollow}
              disabled={actionState.loading === 'follow'}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-black transition active:scale-[0.98] disabled:opacity-60',
                actionState.followed
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-white/10 text-white ring-1 ring-white/10',
              )}
            >
              {actionState.loading === 'follow' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : actionState.followed ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              {actionState.followed ? 'Diikuti' : 'Ikuti'}
            </button>
          </div>

          <p className="mt-3 line-clamp-4 text-sm font-medium leading-relaxed text-white/72">
            {reel.caption}
          </p>

          <button
            type="button"
            onClick={onOpenDetail}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white/80 transition hover:bg-white/14 hover:text-white"
          >
            Buka detail penuh
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-[18px] bg-white/[0.06] p-3 text-center ring-1 ring-white/10">
            <p className="text-sm font-black">
              {formatCompactMetric(metricCount(reel, 'likes'))}
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-white/42">Like</p>
          </div>
          <div className="rounded-[18px] bg-white/[0.06] p-3 text-center ring-1 ring-white/10">
            <p className="text-sm font-black">
              {formatCompactMetric(metricCount(reel, 'comments'))}
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-white/42">
              Komentar
            </p>
          </div>
          <div className="rounded-[18px] bg-white/[0.06] p-3 text-center ring-1 ring-white/10">
            <p className="text-sm font-black">
              {formatCompactMetric(metricCount(reel, 'shares'))}
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-white/42">Share</p>
          </div>
        </div>

        {reel.productName && reel.productPrice ? (
          <div className="mt-3 rounded-[24px] border border-yellow-300/25 bg-yellow-400 p-4 text-slate-950 shadow-lg shadow-yellow-400/10">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-yellow-300">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-700">
                  Produk terkait
                </p>
                <h3 className="mt-1 truncate text-sm font-black">
                  {reel.productName}
                </h3>
                <p className="truncate text-xs font-bold text-slate-700">
                  {reel.productPrice}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onOpenProduct}
                className="rounded-2xl bg-slate-950 px-3 py-2.5 text-xs font-black text-white"
              >
                Detail
              </button>
              {productHref ? (
                <Link
                  href={productHref}
                  className="rounded-2xl bg-white px-3 py-2.5 text-center text-xs font-black text-slate-950"
                >
                  Lihat produk
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onOpenProduct}
                  className="rounded-2xl bg-white px-3 py-2.5 text-xs font-black text-slate-950"
                >
                  Lihat produk
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-center gap-2 text-sm font-black">
              <Info className="h-4.5 w-4.5 text-yellow-300" />
              Info bisnis
            </div>
            <p className="mt-1.5 text-xs font-semibold leading-relaxed text-white/48">
              Reels ini fokus edukasi, tips operasional, atau insight supplier.
            </p>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          {actions.map(action => {
            const ActionIcon = action.icon;

            return (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className={cn(
                  'flex min-h-[48px] items-center justify-center gap-2 rounded-[18px] px-3 text-xs font-black transition active:scale-[0.98]',
                  action.featured
                    ? 'bg-yellow-400 text-slate-950 shadow-lg shadow-yellow-400/10'
                    : 'bg-white/[0.07] text-white/78 ring-1 ring-white/10 hover:bg-white/12 hover:text-white',
                )}
              >
                <ActionIcon className="h-4.5 w-4.5" />
                {action.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">Komentar cepat</p>
              <p className="text-[11px] font-semibold text-white/42">
                {formatCompactMetric(metricCount(reel, 'comments'))} komentar
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenComments}
              className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-950"
            >
              Buka
            </button>
          </div>

          {commentsBucket?.loading && recentComments.length === 0 ? (
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/[0.06] px-3 py-2 text-xs font-bold text-white/55">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Memuat komentar...
            </div>
          ) : recentComments.length > 0 ? (
            <div className="mt-3 space-y-2">
              {recentComments.map(comment => (
                <div
                  key={comment.id}
                  className="rounded-2xl bg-white/[0.06] px-3 py-2"
                >
                  <p className="truncate text-[11px] font-black text-white/80">
                    {comment.authorName}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-white/50">
                    {comment.body}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenComments}
              className="mt-3 w-full rounded-2xl bg-white/[0.06] px-3 py-3 text-left text-xs font-semibold leading-relaxed text-white/50 ring-1 ring-white/10"
            >
              Belum ada komentar yang dimuat.
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 pb-2">
          <button
            type="button"
            onClick={onOpenUpload}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-[18px] bg-white text-xs font-black text-slate-950"
          >
            <Camera className="h-4.5 w-4.5" />
            Buat
          </button>
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-[18px] bg-white/[0.07] text-xs font-black text-white/78 ring-1 ring-white/10"
          >
            <Search className="h-4.5 w-4.5" />
            Cari
          </button>
        </div>
      </div>
    </aside>
  );
}

function ReelsTopBar({
  locale,
  feedTab,
  searchQuery,
  onFeedTabChange,
  onOpenSearch,
}: {
  locale: string;
  feedTab: ReelsFeedTab;
  searchQuery: string;
  onFeedTabChange: (tab: ReelsFeedTab) => void;
  onOpenSearch: () => void;
}) {
  const router = useRouter();
  const hasSearchContext = searchQuery.trim().length > 0;
  const handleBack = useAppBack(router, `/${locale}/home`);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-50 bg-gradient-to-b from-black/86 via-black/30 to-transparent px-3 pb-4 pt-[calc(env(safe-area-inset-top)+8px)] sm:px-4">
      <div className="pointer-events-auto grid min-h-10 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={handleBack}
          aria-label={locale === 'id' ? 'Kembali' : 'Back'}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black/45 font-black text-white backdrop-blur-xl transition active:scale-[0.96]"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>

        <div className="flex min-w-0 justify-center px-1">
          {hasSearchContext ? (
            <button
              type="button"
              onClick={onOpenSearch}
              className="inline-flex h-10 min-w-0 max-w-full items-center gap-2 rounded-full border border-white/14 bg-black/52 px-3 text-left text-xs font-black text-white/92 shadow-[0_18px_38px_-26px_rgba(0,0,0,0.9)] backdrop-blur-xl transition active:scale-[0.98] sm:px-4 sm:text-sm"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">{searchQuery}</span>
              <Sparkles className="hidden h-3.5 w-3.5 shrink-0 text-yellow-300 min-[390px]:block" />
            </button>
          ) : (
            <nav
              aria-label="Filter reels"
              className="inline-flex h-10 max-w-full items-center justify-center gap-0.5 rounded-full border border-white/16 bg-black/52 p-1 text-[12px] font-black shadow-[0_16px_34px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:text-sm"
            >
              {REELS_FEED_TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={event => {
                    event.stopPropagation();
                    onFeedTabChange(tab.id);
                  }}
                  aria-pressed={feedTab === tab.id}
                  className={cn(
                    'relative h-8 rounded-full px-2.5 text-white/62 transition active:scale-95 sm:px-3',
                    feedTab === tab.id &&
                    'bg-white text-slate-950 shadow-lg shadow-black/24',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          )}
        </div>

        <div className="flex h-10 shrink-0 items-start justify-end gap-1.5">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Cari reels"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/12 bg-black/45 text-white backdrop-blur-xl transition active:scale-[0.96]"
          >
            <Search className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

const REELS_LAST_CREATE_ACTION_KEY = 'lajukan:reels-last-create-action';

function buildReelsCreateHref(
  href: string,
  locale: string,
  isAuthenticated: boolean,
  activeReelId: string | null,
) {
  const localizedHref = `/${locale}${href}`;
  if (isAuthenticated) return localizedHref;

  const videoParam = activeReelId || '1';
  const fallback = `/${locale}/reels?video=${encodeURIComponent(videoParam)}`;
  return `/${locale}/login?callbackUrl=${encodeURIComponent(fallback)}`;
}

function ReelsCreateDock({
  locale,
  isAuthenticated,
  activeReelId,
  onOpenUpload,
}: {
  locale: string;
  isAuthenticated: boolean;
  activeReelId: string | null;
  onOpenUpload: () => void;
}) {
  const isId = locale === 'id';
  const [open, setOpen] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REELS_LAST_CREATE_ACTION_KEY);
  });
  const dragStartY = useRef<number | null>(null);

  const actions = useMemo(
    () => [
      {
        key: 'video',
        label: isId ? 'Upload Video' : 'Upload Video',
        icon: Video,
        onClick: () => {
          window.localStorage.setItem(REELS_LAST_CREATE_ACTION_KEY, 'video');
          setLastAction('video');
          setOpen(false);
          onOpenUpload();
        },
      },
      {
        key: 'photo',
        label: isId ? 'Upload Foto' : 'Upload Photo',
        href: '/create/jual/produk?media=photo',
        icon: ImageIcon,
      },
      {
        key: 'listing',
        label: isId ? 'Buat Listing' : 'Create Listing',
        href: '/create/jual/produk',
        icon: Store,
      },
      {
        key: 'service',
        label: isId ? 'Tawarkan Jasa' : 'Offer Service',
        href: '/create/jual/jasa',
        icon: BriefcaseBusiness,
      },
      {
        key: 'talent',
        label: isId ? 'Cari Talent' : 'Find Talent',
        href: '/create/butuh/lowongan',
        icon: Users,
      },
      {
        key: 'property',
        label: isId ? 'Tambah Properti' : 'Add Property',
        href: '/create/jual/properti',
        icon: Building2,
      },
    ],
    [isId, onOpenUpload],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const rememberAction = (key: string) => {
    window.localStorage.setItem(REELS_LAST_CREATE_ACTION_KEY, key);
    setLastAction(key);
    setOpen(false);
  };

  const handleSheetPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStartY.current = event.clientY;
  };

  const handleSheetPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const deltaY = event.clientY - dragStartY.current;
    dragStartY.current = null;
    if (deltaY > 58) setOpen(false);
  };

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-center pb-[calc(env(safe-area-inset-bottom)+14px)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto flex h-10 min-h-10 w-10 min-w-10 touch-manipulation items-center justify-center rounded-full bg-[#6cd698] text-white shadow-[0_18px_38px_-14px_rgba(16,185,129,0.82),0_8px_18px_-10px_rgba(0,0,0,0.72)] ring-4 ring-black/55 transition active:scale-95"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={isId ? 'Buat di Lajukan' : 'Create on Lajukan'}
          data-testid="reels-create-fab"
        >
          <Plus className="h-8 w-8 stroke-[3]" aria-hidden="true" />
        </button>
      </div>

      <div
        className={cn(
          'absolute inset-0 z-[70] bg-black/58 backdrop-blur-[3px] transition-opacity duration-200',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reels-create-sheet-title"
        className={cn(
          'absolute inset-x-0 bottom-0 z-[80] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-[115%]',
        )}
        onPointerDown={handleSheetPointerDown}
        onPointerUp={handleSheetPointerUp}
        onClick={event => event.stopPropagation()}
      >
        <div className="mx-auto max-w-[430px] rounded-t-[28px] border border-white/12 bg-[#080f0c] p-4 text-white shadow-[0_-22px_52px_-24px_rgba(0,0,0,0.86)]">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/24" />
          <div className="mb-3 px-1">
            <p id="reels-create-sheet-title" className="text-lg font-black">
              {isId ? 'Buat di Lajukan' : 'Create on Lajukan'}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-white/58">
              {isId ? 'Pilih yang ingin kamu bagikan' : 'Choose what you want to share'}
            </p>
          </div>

          <div className="grid gap-2">
            {actions.map(action => {
              // 1. Defensively handle the Icon component casing
              const RawIcon = action.icon;
              const Icon = typeof RawIcon === 'function' || (RawIcon && typeof RawIcon === 'object')
                ? (RawIcon as LucideIcon)
                : null;

              const selected = lastAction === action.key;

              const content = (
                <>
                  <span className="flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full bg-[#6cd698] text-white shadow-[0_10px_22px_-16px_rgba(0,0,0,0.8)]">
                    {/* Render safely only if it's a valid React component */}
                    {Icon ? <Icon className="h-5 w-5" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-black leading-tight">
                    {action.label}
                  </span>
                </>
              );

              const className = cn(
                'flex min-h-[56px] touch-manipulation items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left transition active:scale-[0.99]',
                selected
                  ? 'border-[#6cd698]/55 bg-[#6cd698]/16'
                  : 'border-white/10 bg-white/[0.06] hover:border-[#6cd698]/45 hover:bg-[#6cd698]/10',
              );

              if ('onClick' in action) {
                return (
                  <button
                    key={action.key}
                    type="button"
                    onClick={action.onClick}
                    className={className}
                    data-testid={`reels-create-action-${action.key}`}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <Link
                  key={action.key}
                  href={buildReelsCreateHref(
                    action.href,
                    locale,
                    isAuthenticated,
                    activeReelId,
                  )}
                  onClick={() => rememberAction(action.key)}
                  className={className}
                  data-testid={`reels-create-action-${action.key}`}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function ReelsEmptyState({
  locale,
  onUpload,
  onSearch,
}: {
  locale: string;
  onUpload: () => void;
  onSearch: () => void;
}) {
  const isId = locale === 'id';

  return (
    <div className="flex h-full snap-start items-center justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+6rem)] text-center">
      <div className="w-full max-w-[320px] rounded-[28px] border border-white/10 bg-white/[0.07] p-5 text-white shadow-[0_24px_58px_-36px_rgba(0,0,0,0.85)] backdrop-blur-xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-950/20">
          <Clapperboard className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-black leading-tight">
          {isId ? 'Belum ada reels untuk ditampilkan' : 'No reels to show yet'}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-white/62">
          {isId
            ? 'Coba cari topik lain atau buat reels usaha pertama dari kamera/galeri.'
            : 'Try another topic or create the first business reel from camera/gallery.'}
        </p>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={onUpload}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-rose-500 px-4 text-sm font-black text-white transition active:scale-[0.98]"
          >
            <Camera className="h-4.5 w-4.5" />
            {isId ? 'Buat Reels' : 'Create Reels'}
          </button>
          <button
            type="button"
            onClick={onSearch}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/12 bg-black/36 px-4 text-sm font-black text-white transition active:scale-[0.98]"
          >
            <Search className="h-4.5 w-4.5" />
            {isId ? 'Cari reels' : 'Search reels'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReelsEndSlide({
  locale,
  totalCount,
  learnedTerms,
  onRestart,
  onSearch,
  onUpload,
}: {
  locale: string;
  totalCount: number;
  learnedTerms: string[];
  onRestart: () => void;
  onSearch: (query?: string) => void;
  onUpload: () => void;
}) {
  const isId = locale === 'id';
  const topicChips =
    learnedTerms.length > 0
      ? learnedTerms.slice(0, 6)
      : ['supplier', 'kuliner', 'packaging', 'cashflow', 'reseller', 'promo'];

  return (
    <article className="relative h-full snap-start overflow-hidden bg-[#070707] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#101010_0%,#050505_42%,#0f172a_100%)]" />

      <div
        className="relative z-10 h-full overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-[calc(env(safe-area-inset-top)+76px)] [scrollbar-width:none] [touch-action:pan-y] [&::-webkit-scrollbar]:hidden"
        onWheel={event => event.stopPropagation()}
        onTouchStart={event => event.stopPropagation()}
        onTouchEnd={event => event.stopPropagation()}
      >
        <div className="mx-auto min-h-full w-full max-w-[380px] pb-8">
          <div className="flex items-start gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] bg-white text-slate-950 shadow-xl">
              <Check className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300">
                {isId ? 'Feed selesai' : 'Feed complete'}
              </p>
              <h2 className="mt-1 text-[26px] font-black leading-[1.05] tracking-[-0.03em]">
                {isId ? 'Kamu sudah sampai akhir' : 'You are all caught up'}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/62">
                {isId
                  ? 'Lanjut dari sini: ulangi feed, cari topik lain, atau buat reels usaha baru.'
                  : 'Continue from here: restart the feed, search another topic, or create a new business reel.'}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.07] p-3">
              <p className="text-2xl font-black">
                {totalCount.toLocaleString(locale)}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/46">
                {isId ? 'reels dimuat' : 'reels loaded'}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.07] p-3">
              <p className="text-2xl font-black">
                {topicChips.length.toLocaleString(locale)}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/46">
                {isId ? 'topik lanjut' : 'next topics'}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] bg-white px-4 text-sm font-black text-slate-950 transition active:scale-[0.98]"
            >
              <RefreshCcw className="h-4.5 w-4.5" />
              {isId ? 'Ulangi feed dari awal' : 'Restart feed'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSearch()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] border border-white/12 bg-white/[0.08] px-3 text-xs font-black text-white transition active:scale-[0.98]"
              >
                <Search className="h-4 w-4" />
                {isId ? 'Cari topik' : 'Search'}
              </button>
              <button
                type="button"
                onClick={onUpload}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] bg-rose-500 px-3 text-xs font-black text-white transition active:scale-[0.98]"
              >
                <Camera className="h-4 w-4" />
                {isId ? 'Buat reels' : 'Create'}
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
            <p className="text-xs font-black uppercase tracking-wide text-white/52">
              {isId ? 'Topik yang bisa dicari' : 'Topics to search'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {topicChips.map(topic => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => onSearch(topic)}
                  className="rounded-full bg-white/10 px-3 py-2 text-[11px] font-black text-white/76 ring-1 ring-white/10 transition active:scale-95"
                >
                  #{topic}
                </button>
              ))}
            </div>
          </div>

          <Link
            href={`/${locale}/home`}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[18px] bg-white/10 px-4 text-xs font-black text-white/72 ring-1 ring-white/10 transition active:scale-[0.98]"
          >
            <Home className="h-4 w-4" />
            {isId ? 'Kembali ke beranda' : 'Back to home'}
          </Link>
        </div>
      </div>
    </article>
  );
}

function StudioEffectOverlay({ effect }: { effect: ReelsStudioEffect }) {
  if (effect === 'none') return null;

  if (effect === 'clean') {
    return (
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(255,255,255,0.26),transparent_42%),linear-gradient(180deg,rgba(16,185,129,0.09),transparent_58%)] mix-blend-screen" />
    );
  }

  if (effect === 'product') {
    return (
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(250,204,21,0.18),transparent_42%,rgba(244,63,94,0.14))] mix-blend-soft-light" />
    );
  }

  if (effect === 'focus') {
    return (
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,transparent_36%,rgba(0,0,0,0.58)_100%)]" />
    );
  }

  if (effect === 'scan') {
    return (
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(103,232,249,0.28)_0_1px,transparent_1px_11px)] mix-blend-screen" />
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.12),transparent_10%),radial-gradient(circle_at_64%_42%,rgba(255,255,255,0.08),transparent_8%),radial-gradient(circle_at_82%_74%,rgba(255,255,255,0.10),transparent_9%)] opacity-75 mix-blend-soft-light" />
  );
}

/* =========================
   MAIN REEL
========================= */

function ReelSlide({
  locale,
  reel,
  active,
  shouldLoad,
  muted,
  soundUnlocked,
  paused,
  buffering,
  setVideoRef,
  onWaiting,
  onPlaying,
  onError,
  onTogglePlay,
  onToggleSound,
  actionState,
  onOpenDetail,
  onOpenComments,
  onOpenProduct,
  onOpenShare,
  onOpenActions,
  onAction,
}: {
  locale: string;
  reel: LajukanReel;
  active: boolean;
  shouldLoad: boolean;
  muted: boolean;
  soundUnlocked: boolean;
  paused: boolean;
  buffering: boolean;
  setVideoRef: (node: HTMLVideoElement | null) => void;
  onWaiting: () => void;
  onPlaying: () => void;
  onError: () => void;
  onTogglePlay: () => void;
  onToggleSound: () => void;
  actionState: ReelActionState;
  onOpenDetail: () => void;
  onOpenComments: () => void;
  onOpenProduct: () => void;
  onOpenShare: () => void;
  onOpenActions: () => void;
  onAction: (action: ReelUserAction, active?: boolean) => void;
}) {
  const Icon = iconMap[reel.iconKey];
  const imageMedia = isImageMediaUrl(reel.videoSrc);
  const mediaStyle = getReelMediaStyle(reel.filterPreset);
  const studioEffect = getReelStudioEffect(reel);
  const liveLabel = getLiveLabel(reel);

  if (!shouldLoad) {
    return (
      <article
        className="relative flex h-full snap-start overflow-hidden bg-black px-2.5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-[calc(env(safe-area-inset-top)+48px)] sm:px-4 sm:pb-[calc(env(safe-area-inset-bottom)+18px)] sm:pt-[calc(env(safe-area-inset-top)+58px)]"
        style={REEL_SLIDE_PLACEHOLDER_STYLE}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[#050505]" />
        <div className="relative z-10 mt-auto min-w-0 flex-1 pr-[58px] opacity-0 sm:pr-[70px]">
          <h1 className="line-clamp-2 text-[16px] font-black leading-tight">
            {reel.title}
          </h1>
        </div>
      </article>
    );
  }

  return (
    <article
      className="relative flex h-full snap-start overflow-hidden px-2.5 pb-[calc(env(safe-area-inset-bottom)+92px)] pt-[calc(env(safe-area-inset-top)+48px)] sm:px-4 sm:pb-[calc(env(safe-area-inset-bottom)+70px)] sm:pt-[calc(env(safe-area-inset-top)+58px)]"
      style={REEL_SLIDE_LOADED_STYLE}
    >
      {imageMedia ? (
        <img
          src={reel.videoSrc}
          alt={reel.title}
          className="absolute inset-0 h-full w-full object-cover"
          style={mediaStyle}
        />
      ) : (
        <video
          ref={setVideoRef}
          src={reel.videoSrc}
          className="absolute inset-0 h-full w-full object-cover"
          style={mediaStyle}
          muted={muted}
          loop
          playsInline
          preload={active ? 'auto' : 'metadata'}
          autoPlay={active && !paused}
          disablePictureInPicture
          onWaiting={onWaiting}
          onPlaying={onPlaying}
          onCanPlay={onPlaying}
          onError={onError}
        />
      )}
      <StudioEffectOverlay effect={studioEffect} />

      <button
        type="button"
        onClick={onTogglePlay}
        className="absolute inset-0 z-10"
        aria-label={paused ? 'Putar video' : 'Pause video'}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/16 to-black/36" />

      <div className="absolute left-2.5 top-[calc(env(safe-area-inset-top)+50px)] z-20 flex max-w-[calc(100%-84px)] items-center gap-1.5 rounded-full bg-black/32 px-2 py-1 text-[10px] font-black backdrop-blur sm:left-4 sm:top-[calc(env(safe-area-inset-top)+62px)] sm:max-w-[calc(100%-108px)] sm:px-2.5 sm:py-1.5 sm:text-[11px]">
        <Icon className="h-4 w-4" />
        <span className="truncate">{reel.tag}</span>
      </div>
      {liveLabel && (
        <div className="absolute right-2.5 top-[calc(env(safe-area-inset-top)+50px)] z-20 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-1 text-[10px] font-black text-white shadow-2xl shadow-rose-950/25 sm:right-4 sm:top-[calc(env(safe-area-inset-top)+62px)] sm:px-2.5 sm:py-1.5 sm:text-[11px]">
          <Radio className="h-3.5 w-3.5" />
          {liveLabel}
        </div>
      )}

      <ActionRail
        locale={locale}
        reel={reel}
        actionState={actionState}
        onOpenComments={onOpenComments}
        onOpenShare={onOpenShare}
        onOpenActions={onOpenActions}
        onAction={onAction}
      />

      {buffering && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-black/35 backdrop-blur">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      )}

      {paused && active && !buffering && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-white/20 backdrop-blur">
            <Play className="h-9 w-9 fill-white" />
          </div>
        </div>
      )}

      {active && muted && !soundUnlocked && !buffering && (
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            onToggleSound();
          }}
          className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+100px)] z-40 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-xs font-black text-slate-950 shadow-2xl backdrop-blur sm:top-[calc(env(safe-area-inset-top)+110px)] sm:gap-2 sm:px-4"
        >
          <Volume2 className="h-4 w-4" />
          Ketuk untuk suara
        </button>
      )}

      <div className="relative z-20 mt-auto min-w-0 flex-1 pr-[72px]">
        <div className="max-w-[78%] text-white">
          <button
            type="button"
            onClick={onOpenDetail}
            className="block text-left"
          >
            <h1 className="line-clamp-1 text-[15px] font-bold">
              @{reel.creator}
            </h1>
          </button>

          <div className="mt-1 text-[14px] leading-5">
            <ExpandableCaption
              text={reel.caption}
              maxLength={90}
            />
          </div>

          {reel.productName && (
            <button
              onClick={onOpenProduct}
              className="
                mt-2
                inline-flex
                items-center
                gap-2
                rounded-full
                bg-black/40
                px-3
                py-1.5
                text-xs
                font-semibold
                backdrop-blur-sm
              "
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              {reel.productName}
            </button>
          )}

        </div>
      </div>
    </article>
  );
}

function ExpandableCaption({
  text,
  maxLength = 90,
}: {
  text: string;
  maxLength?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (text.length <= maxLength) {
    return <p>{text}</p>;
  }

  return (
    <p>
      {expanded
        ? text
        : `${text.slice(0, maxLength)}... `}

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="font-bold text-white"
      >
        {expanded ? ' lebih sedikit' : ' lainnya'}
      </button>
    </p>
  );
}

/* =========================
   PRODUCT CART
========================= */

function ProductCartDock({
  reel,
  onOpenProduct,
}: {
  reel: LajukanReel;
  onOpenProduct: () => void;
}) {
  if (!reel.productName || !reel.productPrice || !reel.productHref) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onOpenProduct}
      className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-[18px] bg-white/94 px-1.5 py-1.5 text-left text-slate-950 shadow-xl shadow-black/20 ring-1 ring-white/70 transition active:scale-[0.98] sm:mt-2.5 sm:gap-2 sm:px-2"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[14px] bg-yellow-400 text-slate-950 sm:h-9 sm:w-9">
        <ShoppingBag className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-black sm:text-[12px]">
          {reel.productName}
        </span>
        <span className="block truncate text-[9px] font-bold text-slate-600 sm:text-[10px]">
          {reel.productPrice}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" />
    </button>
  );
}

function ActionRail({
  locale,
  reel,
  actionState,
  onOpenComments,
  onOpenShare,
  onOpenActions,
  onAction,
}: {
  locale: string;
  reel: LajukanReel;
  actionState: ReelActionState;
  onOpenComments: () => void;
  onOpenShare: () => void;
  onOpenActions: () => void;
  onAction: (action: ReelUserAction, active?: boolean) => void;
}) {
  const profileHref = buildReelCreatorProfileHref(locale, reel);
  const actions: Array<{
    key: string;
    label?: string;
    icon: LucideIcon;
    active?: boolean;
    loading?: boolean;
    onClick: () => void;
  }> = [
      {
        key: 'like',
        label: formatCompactMetric(metricCount(reel, 'likes')),
        icon: Heart,
        active: actionState.liked,
        loading: actionState.loading === 'like',
        onClick: () => onAction('like'),
      },
      {
        key: 'comments',
        label: formatCompactMetric(metricCount(reel, 'comments')),
        icon: MessageCircle,
        onClick: onOpenComments,
      },
      {
        key: 'share',
        label: formatCompactMetric(metricCount(reel, 'shares')),
        icon: Forward,
        onClick: onOpenShare,
      },
      {
        key: 'more',
        icon: MoreHorizontal,
        onClick: onOpenActions,
      },
    ];

  return (
    <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+148px)] right-1.5 z-30 flex flex-col items-center gap-2 sm:bottom-[calc(env(safe-area-inset-bottom)+166px)] sm:right-3">
      <div className="relative mb-2 flex h-16 w-16 items-center justify-center">
        <Link
          href={profileHref}
          aria-label={`Lihat profil ${reel.creator}`}
          className="
            absolute
            inset-0
            overflow-hidden
            rounded-full
            bg-white/10
            p-[2px]
            shadow-[0_12px_28px_-12px_rgba(0,0,0,0.7)]
            ring-2
            ring-white/25
            transition
            active:scale-95
          "
        >
          <ReelCreatorAvatar
            reel={reel}
            className="h-full w-full rounded-full object-cover"
            size={64}
          />
        </Link>

        <button
          type="button"
          onClick={() => onAction('follow')}
          disabled={actionState.loading === 'follow'}
          className={cn(
            `
            absolute
            left-1/2
            -bottom-1
            z-20

            !h-7
            !w-7

            !min-h-0
            !min-w-0

            !max-h-7
            !max-w-7

            aspect-square
            shrink-0

            -translate-x-1/2

            flex
            items-center
            justify-center

            rounded-full

            p-0

            text-white
            shadow-[0_8px_20px_-8px_rgba(0,0,0,0.9)]
            ring-2
            ring-black

            transition
            active:scale-95
            disabled:opacity-60
            `,
            actionState.followed
              ? 'bg-emerald-500'
              : 'bg-[#ff2d55]',
          )}
        >
          {actionState.loading === 'follow' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : actionState.followed ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Plus className="h-4 w-4 stroke-[3]" />
          )}
        </button>
      </div>

      {actions.map(action => {
        const ActionIcon = action.icon;

        return (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            disabled={action.loading}
            className="flex max-w-[48px] flex-col items-center gap-0.5 transition active:scale-95"
            data-testid={`reels-action-${action.key}`}
          >
            <span
              className={cn(
                'grid h-10 w-10 place-items-center rounded-full bg-black/34 text-white shadow-[0_14px_30px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md ring-1 ring-white/18 transition sm:h-11 sm:w-11',
                action.active && 'bg-white text-rose-600 ring-white',
              )}
            >
              {action.loading ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin sm:h-5 sm:w-5" />
              ) : (
                <ActionIcon
                  className={cn(
                    'h-4.5 w-4.5 sm:h-5 sm:w-5',
                    action.active && 'fill-current',
                  )}
                />
              )}
            </span>
            {action.label && (
              <span className="max-w-full truncate text-center text-[9px] font-black leading-3 drop-shadow sm:text-[10px]">
                {action.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* =========================
   SEARCH OVERLAY
========================= */

function SearchOverlay({
  open,
  items,
  hasMore,
  loadingMore,
  loadError,
  profile,
  initialQuery,
  learnedTerms,
  onClose,
  onLoadMore,
  onSearchIntent,
  onSignal,
  onSelect,
}: {
  open: boolean;
  items: LajukanReel[];
  hasMore: boolean;
  loadingMore: boolean;
  loadError: string | null;
  profile: PreferenceProfile;
  initialQuery: string;
  learnedTerms: string[];
  onClose: () => void;
  onLoadMore: () => void;
  onSearchIntent: (query: string) => void;
  onSignal: (reel: LajukanReel, signal: ReelsSignal) => void;
  onSelect: (index: number, query: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const mapped = items.map((item, index) => ({ item, index }));

    if (!q) return mapped;

    return mapped
      .filter(({ item }) => {
        const haystack = [
          item.title,
          item.creator,
          item.caption,
          item.tag,
          item.productName || '',
          item.productPrice || '',
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(q);
      })
      .sort(
        (a, b) =>
          scoreReel(b.item, profile, query) -
          scoreReel(a.item, profile, query) || a.index - b.index,
      );
  }, [items, profile, query]);

  const chips = useMemo(() => {
    return [
      'Semua',
      ...learnedTerms.slice(0, 4),
      'Supplier',
      'Packaging',
      'Kopi',
      'Keuangan',
      'Online Shop',
    ].filter((chip, index, source) => source.indexOf(chip) === index);
  }, [learnedTerms]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      setQuery(initialQuery);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [initialQuery, open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) return;

    const timer = window.setTimeout(() => onSearchIntent(trimmed), 450);
    return () => window.clearTimeout(timer);
  }, [onSearchIntent, open, query]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  function handleResultsScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const distanceToBottom =
      element.scrollHeight - (element.scrollTop + element.clientHeight);

    if (distanceToBottom < 900 && hasMore && !loadingMore) {
      onLoadMore();
    }
  }

  if (!open) return null;

  return (
    <section className="ui-layer-header fixed inset-0 flex min-h-0 flex-col bg-[#050505] text-white">
      <header className="shrink-0 border-b border-white/10 bg-black/95 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 transition active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/10 px-4 py-3 ring-1 ring-white/10">
            <Search className="h-4 w-4 shrink-0 text-white/60" />
            <input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Cari video, produk, supplier, packaging, kopi..."
              className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-white/45"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-white/60 transition hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="hidden rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 sm:inline-flex"
          >
            Tutup
          </button>
        </div>

        <div className="mx-auto mt-3 flex w-full max-w-[1440px] gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map(chip => {
            const active = query === chip || (!query && chip === 'Semua');

            return (
              <button
                key={chip}
                type="button"
                onClick={() => setQuery(chip === 'Semua' ? '' : chip)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-2 text-xs font-black transition',
                  active
                    ? 'bg-white text-slate-950'
                    : 'bg-white/10 text-white/75 hover:bg-white/15',
                )}
              >
                {chip}
              </button>
            );
          })}
        </div>

        <div className="mx-auto mt-3 flex w-full max-w-[1440px] items-center gap-2 rounded-2xl bg-white/[0.06] px-3 py-2 text-xs font-bold text-white/60 ring-1 ring-white/10">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-yellow-300" />
          <span className="truncate">
            AI For You memprioritaskan hasil dari keyword, watch time, like,
            simpan, share, dan produk yang kamu buka.
          </span>
        </div>
      </header>

      <div
        onScroll={handleResultsScroll}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-8 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-5"
      >
        <div className="mx-auto w-full max-w-[1440px]">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-white/45">
                {query ? 'Hasil pencarian' : 'Eksplor Reels'}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                {query ? `Cari: ${query}` : 'Cari video bisnis'}
              </h1>
            </div>

            <p className="hidden text-sm font-bold text-white/45 sm:block">
              {results.length} video dimuat
            </p>
          </div>

          {results.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {results.map(({ item, index }) => (
                <SearchVideoCard
                  key={item.id}
                  reel={item}
                  onClick={() => {
                    onSignal(item, 'watch');
                    onSelect(index, query);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] bg-white/10 p-8 text-center ring-1 ring-white/10">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/10">
                <Search className="h-8 w-8" />
              </div>
              <p className="mt-5 text-xl font-black">Belum ada video</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/55">
                Coba kata lain seperti supplier, packaging, kopi, frozen food,
                marketing, atau keuangan.
              </p>
            </div>
          )}

          <div className="py-8">
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 text-sm font-black text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat video...
              </div>
            )}

            {!loadingMore && hasMore && (
              <button
                type="button"
                onClick={onLoadMore}
                className="mx-auto flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950"
              >
                Muat video lainnya
              </button>
            )}

            {!loadingMore && !hasMore && results.length > 0 && (
              <p className="text-center text-xs font-bold text-white/40">
                Semua video sudah dimuat
              </p>
            )}

            {loadError && (
              <button
                type="button"
                onClick={onLoadMore}
                className="mx-auto mt-3 flex rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950"
              >
                Coba lagi
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchVideoCard({
  reel,
  onClick,
}: {
  reel: LajukanReel;
  onClick: () => void;
}) {
  const Icon = iconMap[reel.iconKey];
  const imageMedia = isImageMediaUrl(reel.videoSrc);
  const mediaStyle = getReelMediaStyle(reel.filterPreset);
  const liveLabel = getLiveLabel(reel);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={event => {
        const video = event.currentTarget.querySelector('video');
        if (video instanceof HTMLVideoElement) {
          video.play().catch(() => { });
        }
      }}
      onMouseLeave={event => {
        const video = event.currentTarget.querySelector('video');
        if (video instanceof HTMLVideoElement) {
          video.pause();
          video.currentTime = 0;
        }
      }}
      className="group relative aspect-[9/14] overflow-hidden rounded-2xl bg-white/10 text-left ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:ring-white/20 active:scale-[0.98]"
    >
      {imageMedia ? (
        <img
          src={reel.videoSrc}
          alt={reel.title}
          className="absolute inset-0 h-full w-full object-cover"
          style={mediaStyle}
        />
      ) : (
        <video
          src={reel.videoSrc}
          className="absolute inset-0 h-full w-full object-cover"
          style={mediaStyle}
          muted
          loop
          playsInline
          preload="none"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/12 to-black/25" />

      <div className="absolute left-2 top-2 flex max-w-[calc(100%-56px)] items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px] font-black text-white backdrop-blur">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{reel.tag}</span>
      </div>

      {reel.productName && (
        <div className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-yellow-400 text-slate-950 shadow-lg">
          <ShoppingBag className="h-4 w-4" />
        </div>
      )}
      {liveLabel && (
        <div className="absolute right-2 top-11 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-1 text-[10px] font-black text-white shadow-lg">
          <Radio className="h-3 w-3" />
          {liveLabel}
        </div>
      )}

      <div className="absolute inset-0 grid place-items-center opacity-90 transition group-hover:scale-110">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-white/18 backdrop-blur">
          <Play className="h-4 w-4 fill-white text-white" />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="line-clamp-2 text-xs font-black leading-tight text-white">
          {reel.title}
        </p>

        {reel.productName ? (
          <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-black text-slate-950">
            <ShoppingBag className="h-3 w-3 shrink-0" />
            <span className="truncate">{reel.productName}</span>
          </div>
        ) : (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-1 text-[10px] font-black text-white/80">
            <Info className="h-3 w-3" />
            Info bisnis
          </div>
        )}

        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-white/75">
          <Play className="h-3 w-3 fill-white" />
          {formatCompactMetric(metricCount(reel, 'likes'))}
        </div>
      </div>
    </button>
  );
}

/* =========================
   DETAIL OVERLAY
========================= */

function DetailOverlay({
  locale,
  reel,
  actionState,
  onAction,
  onOpenComments,
  onOpenProduct,
  onOpenShare,
  onMessageCreator,
  chatBusyReelId,
  onClose,
}: {
  locale: string;
  reel: LajukanReel | null;
  actionState: ReelActionState;
  onAction: (
    reel: LajukanReel,
    action: ReelUserAction,
    active?: boolean,
  ) => void;
  onOpenComments: (reel: LajukanReel) => void;
  onOpenProduct: (reel: LajukanReel) => void;
  onOpenShare: (reel: LajukanReel) => void;
  onMessageCreator: (reel: LajukanReel) => void;
  chatBusyReelId: string | null;
  onClose: () => void;
}) {
  if (!reel) return null;

  const Icon = iconMap[reel.iconKey];
  const imageMedia = isImageMediaUrl(reel.videoSrc);
  const mediaStyle = getReelMediaStyle(reel.filterPreset);
  const liveLabel = getLiveLabel(reel);
  const profileHref = buildReelCreatorProfileHref(locale, reel);

  return (
    <div
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/68 p-0 text-white backdrop-blur-md lg:items-stretch lg:justify-end lg:bg-black/42 lg:backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup detail"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-[30px] bg-[#080808] shadow-2xl lg:h-full lg:max-h-none lg:w-[min(520px,42vw)] lg:min-w-[460px] lg:rounded-none lg:border-l lg:border-white/10">
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-white/24 lg:hidden" />
        <div className="relative min-h-[30svh] max-h-[42svh] overflow-hidden bg-black lg:min-h-[220px] lg:max-h-[260px]">
          {imageMedia ? (
            <img
              src={reel.videoSrc}
              alt={reel.title}
              className="absolute inset-0 h-full w-full object-cover"
              style={mediaStyle}
            />
          ) : (
            <video
              src={reel.videoSrc}
              className="absolute inset-0 h-full w-full object-cover"
              style={mediaStyle}
              muted
              loop
              autoPlay
              playsInline
              preload="metadata"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/20" />

          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-xs font-black backdrop-blur">
            <Icon className="h-4 w-4" />
            {reel.tag}
          </div>
          {liveLabel && (
            <div className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-2 text-xs font-black text-white shadow-xl">
              <Radio className="h-3.5 w-3.5" />
              {liveLabel}
            </div>
          )}

          <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-white/15 backdrop-blur">
              <Play className="h-7 w-7 fill-white" />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-5 text-slate-950 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                Detail Reels
              </p>
              <h2 className="mt-1 text-2xl font-black leading-tight">
                {reel.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 transition active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={profileHref}
              className="shrink-0 rounded-full bg-slate-100 p-0.5 ring-1 ring-slate-200 transition active:scale-95"
              aria-label={`Lihat profil ${reel.creator}`}
            >
              <ReelCreatorAvatar
                reel={reel}
                className="h-11 w-11 bg-slate-200"
                size={44}
              />
            </Link>

            <div className="min-w-0 flex-1">
              <Link
                href={profileHref}
                className="block truncate text-sm font-black text-slate-950 underline-offset-4 transition hover:underline"
              >
                {reel.creator}
              </Link>
              <p className="text-xs font-semibold text-slate-500">
                {reel.tag} / Tips bisnis
              </p>
            </div>

            <Link
              href={profileHref}
              className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-800 transition active:scale-[0.98] min-[430px]:inline-flex"
            >
              <User className="h-3.5 w-3.5" />
              Profil
            </Link>

            <button
              type="button"
              onClick={() => onMessageCreator(reel)}
              disabled={chatBusyReelId === reel.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-60"
            >
              {chatBusyReelId === reel.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MessageSquareText className="h-3.5 w-3.5" />
              )}
              Chat
            </button>

            <button
              type="button"
              onClick={() => onAction(reel, 'follow')}
              disabled={actionState.loading === 'follow'}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black disabled:opacity-60',
                actionState.followed
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-950 text-white',
              )}
            >
              {actionState.loading === 'follow' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : actionState.followed ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              {actionState.followed ? 'Diikuti' : 'Ikuti'}
            </button>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-slate-700">
            {reel.caption}
          </p>

          {reel.productName && reel.productPrice && reel.productHref ? (
            <button
              type="button"
              onClick={() => onOpenProduct(reel)}
              className="mt-5 flex w-full items-center gap-3 rounded-[24px] bg-yellow-400 p-4 text-left text-slate-950 shadow-lg shadow-yellow-400/20"
            >
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-950 text-yellow-300">
                <ShoppingBag className="h-7 w-7" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 inline-flex rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-yellow-300">
                  Produk terkait
                </div>
                <p className="truncate text-base font-black">
                  {reel.productName}
                </p>
                <p className="truncate text-sm font-bold text-slate-700">
                  {reel.productPrice}
                </p>
              </div>

              <ChevronRight className="h-5 w-5 shrink-0" />
            </button>
          ) : (
            <div className="mt-5 rounded-[24px] bg-slate-100 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                <Info className="h-5 w-5 text-emerald-700" />
                Konten informasi
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Reels ini tidak terhubung ke produk. Isinya fokus edukasi, tips,
                atau insight bisnis.
              </p>
            </div>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <StatPill
              label="Like"
              value={formatCompactMetric(metricCount(reel, 'likes'))}
            />
            <StatPill
              label="Komentar"
              value={formatCompactMetric(metricCount(reel, 'comments'))}
            />
            <StatPill
              label="Share"
              value={formatCompactMetric(metricCount(reel, 'shares'))}
            />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onOpenComments(reel)}
              className="rounded-2xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-800"
            >
              Komentar
            </button>
            <button
              type="button"
              onClick={() => onAction(reel, 'save')}
              disabled={actionState.loading === 'save'}
              className="rounded-2xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-800"
            >
              {actionState.saved ? 'Tersimpan' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={() => onOpenShare(reel)}
              className="rounded-2xl bg-emerald-700 px-3 py-3 text-sm font-black text-white"
            >
              Bagikan
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-100 p-3 text-center">
      <p className="text-sm font-black">{value}</p>
      <p className="mt-0.5 text-[11px] font-bold text-slate-500">{label}</p>
    </div>
  );
}

function ShareSheet({
  locale,
  reel,
  chatBusy,
  onMessageCreator,
  onClose,
}: {
  locale: string;
  reel: LajukanReel | null;
  chatBusy: boolean;
  onMessageCreator: (reel: LajukanReel) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl = useMemo(
    () => buildReelShareUrl(locale, reel),
    [locale, reel],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCopied(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [reel?.id]);

  const copyLink = useCallback(async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard?.writeText(shareUrl);
    } catch { }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [shareUrl]);

  const openExternal = useCallback((url: string) => {
    if (typeof window === 'undefined') return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  if (!reel) return null;

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(`${reel.title}\n${shareUrl}`);
  const recipients = [
    {
      name: reel.creator,
      caption: 'Creator',
      tone: 'from-emerald-500 to-teal-400',
    },
    { name: 'Alysa', caption: 'Buyer', tone: 'from-slate-900 to-slate-600' },
    {
      name: 'Ceptrisna',
      caption: 'Review',
      tone: 'from-amber-700 to-yellow-400',
    },
    { name: 'NEX', caption: 'Partner', tone: 'from-emerald-600 to-teal-400' },
    { name: 'Jza', caption: 'Supplier', tone: 'from-zinc-950 to-zinc-500' },
    { name: 'Al', caption: 'UMKM', tone: 'from-pink-500 to-orange-400' },
  ];
  const primaryActions: Array<{
    label: string;
    icon?: LucideIcon;
    glyph?: string;
    className: string;
    onClick: () => void;
  }> = [
      {
        label: 'Repost',
        icon: RefreshCcw,
        className: 'bg-yellow-400 text-white',
        onClick: () => void copyLink(),
      },
      {
        label: 'WhatsApp',
        icon: MessageCircle,
        className: 'bg-[#25D366] text-white',
        onClick: () => openExternal(`https://wa.me/?text=${encodedText}`),
      },
      {
        label: copied ? 'Copied' : 'Copy link',
        icon: Link2,
        className: 'bg-emerald-600 text-white',
        onClick: () => void copyLink(),
      },
      {
        label: 'Status',
        icon: Plus,
        className: 'bg-emerald-500 text-white',
        onClick: () => void copyLink(),
      },
      {
        label: 'Facebook',
        glyph: 'f',
        className: 'bg-[#1877F2] text-white',
        onClick: () =>
          openExternal(
            `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
          ),
      },
      {
        label: 'Instagram',
        icon: Send,
        className:
          'bg-gradient-to-br from-emerald-600 via-lime-500 to-orange-400 text-white',
        onClick: () => void copyLink(),
      },
    ];
  const utilityActions: Array<{
    label: string;
    icon: LucideIcon;
    onClick: () => void;
  }> = [
      { label: 'Report', icon: Flag, onClick: onClose },
      { label: 'Not interested', icon: X, onClick: onClose },
      {
        label: 'Download',
        icon: Download,
        onClick: () => openExternal(reel.videoSrc),
      },
      { label: 'Add to Story', icon: Plus, onClick: () => void copyLink() },
      { label: 'Promote', icon: Megaphone, onClick: onClose },
      { label: 'Cast', icon: Radio, onClick: onClose },
    ];

  return (
    <div
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/58 text-slate-950 backdrop-blur-sm lg:items-stretch lg:justify-end lg:bg-black/42 lg:p-0 lg:backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup share"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative flex max-h-[82svh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl lg:h-full lg:max-h-none lg:w-[460px] lg:max-w-none lg:rounded-none lg:border-l lg:border-white/10 xl:w-[500px]">
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-slate-200 lg:hidden" />
        <div className="flex items-center gap-3 px-4 pb-3 pt-4 sm:px-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-900">
            <Search className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 text-center">
            <h2 className="text-xl font-black tracking-[-0.03em]">Send to</h2>
            <p className="truncate text-xs font-semibold text-slate-500">
              {reel.title}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 transition active:scale-95"
            aria-label="Tutup share"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] sm:px-5 sm:pb-5">
          <div className="flex gap-3 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {recipients.map((recipient, index) => (
              <button
                key={`${recipient.name}-${index}`}
                type="button"
                disabled={index === 0 && chatBusy}
                onClick={() => {
                  if (index === 0) {
                    onClose();
                    onMessageCreator(reel);
                    return;
                  }
                  void copyLink();
                }}
                className="w-[76px] shrink-0 text-center transition active:scale-95 disabled:opacity-60"
              >
                <span
                  className={cn(
                    'mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br text-sm font-black text-white shadow-lg ring-1 ring-black/5',
                    recipient.tone,
                  )}
                >
                  {index === 0 && chatBusy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    recipient.name.slice(0, 2).toUpperCase()
                  )}
                </span>
                <span className="mt-2 block truncate text-xs font-semibold text-slate-800">
                  {recipient.name}
                </span>
                <span className="block truncate text-[10px] font-medium text-slate-400">
                  {recipient.caption}
                </span>
              </button>
            ))}
          </div>

          <div className="flex gap-4 overflow-x-auto border-t border-slate-100 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {primaryActions.map(action => {
              const ActionIcon = action.icon;

              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="w-[76px] shrink-0 text-center transition active:scale-95"
                >
                  <span
                    className={cn(
                      'mx-auto grid h-14 w-14 place-items-center rounded-full text-lg font-black shadow-lg',
                      action.className,
                    )}
                  >
                    {ActionIcon ? (
                      <ActionIcon className="h-7 w-7" />
                    ) : (
                      <span className="text-3xl leading-none">
                        {action.glyph}
                      </span>
                    )}
                  </span>
                  <span className="mt-2 block text-xs font-semibold leading-tight text-slate-700">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-4 overflow-x-auto border-t border-slate-100 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {utilityActions.map(action => {
              const ActionIcon = action.icon;

              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="w-[76px] shrink-0 text-center transition active:scale-95"
                >
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-700">
                    <ActionIcon className="h-6 w-6" />
                  </span>
                  <span className="mt-2 block text-xs font-semibold leading-tight text-slate-700">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>

          {copied && (
            <div className="mb-2 rounded-full bg-slate-950 px-4 py-2 text-center text-xs font-black text-white">
              Link reels disalin
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* =========================
   COMMENTS / PRODUCT / UPLOAD
========================= */

function MoreActionsSheet({
  reel,
  actionState,
  chatBusy,
  onClose,
  onOpenDetail,
  onOpenProduct,
  onOpenComments,
  onOpenShare,
  onMessageCreator,
  onAction,
}: {
  reel: LajukanReel | null;
  actionState: ReelActionState;
  chatBusy: boolean;
  onClose: () => void;
  onOpenDetail: (reel: LajukanReel) => void;
  onOpenProduct: (reel: LajukanReel) => void;
  onOpenComments: (reel: LajukanReel) => void;
  onOpenShare: (reel: LajukanReel) => void;
  onMessageCreator: (reel: LajukanReel) => void;
  onAction: (
    reel: LajukanReel,
    action: ReelUserAction,
    active?: boolean,
  ) => void;
}) {
  if (!reel) return null;

  const actions: Array<{
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    active?: boolean;
    featured?: boolean;
    disabled?: boolean;
  }> = [
      {
        label: actionState.saved ? 'Tersimpan' : 'Simpan',
        icon: Bookmark,
        active: actionState.saved,
        disabled: actionState.loading === 'save',
        onClick: () => onAction(reel, 'save'),
      },
      {
        label: 'Detail',
        icon: Info,
        onClick: () => onOpenDetail(reel),
      },
      {
        label: 'Komentar',
        icon: MessageCircle,
        onClick: () => onOpenComments(reel),
      },
      {
        label: 'Share',
        icon: Forward,
        featured: true,
        onClick: () => onOpenShare(reel),
      },
      {
        label: actionState.followed ? 'Diikuti' : 'Ikuti',
        icon: actionState.followed ? Check : UserPlus,
        active: actionState.followed,
        disabled: actionState.loading === 'follow',
        onClick: () => onAction(reel, 'follow'),
      },
      {
        label: 'Chat',
        icon: chatBusy ? Loader2 : MessageSquareText,
        disabled: chatBusy,
        onClick: () => onMessageCreator(reel),
      },
    ];

  if (reel.productName) {
    actions.splice(2, 0, {
      label: 'Produk',
      icon: ShoppingBag,
      featured: true,
      onClick: () => onOpenProduct(reel),
    });
  }

  return (
    <div
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/58 text-slate-950 backdrop-blur-sm sm:items-end lg:items-stretch lg:justify-end lg:bg-black/42 lg:p-0 lg:backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup aksi reels"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative w-full overflow-hidden rounded-t-[26px] bg-white shadow-2xl lg:h-full lg:w-[420px] lg:rounded-none lg:border-l lg:border-white/10">
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-slate-200 lg:hidden" />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">
              Aksi reels
            </p>
            <h2 className="truncate text-base font-black">{reel.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 transition active:scale-95"
            aria-label="Tutup aksi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:grid-cols-4 lg:grid-cols-2 lg:pb-5">
          {actions.map(action => {
            const ActionIcon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                disabled={action.disabled}
                onClick={action.onClick}
                className={cn(
                  'flex min-h-[74px] flex-col items-center justify-center gap-2 rounded-[18px] px-2 text-xs font-black transition active:scale-[0.98] disabled:opacity-60',
                  action.featured
                    ? 'bg-slate-950 text-white'
                    : action.active
                      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                      : 'bg-slate-100 text-slate-800',
                )}
              >
                <ActionIcon
                  className={cn(
                    'h-5 w-5',
                    action.icon === Loader2 && chatBusy && 'animate-spin',
                  )}
                />
                <span className="max-w-full truncate">{action.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function CommentsSheet({
  reel,
  bucket,
  body,
  isAuthenticated,
  submitting,
  loginHref,
  replyTarget,
  chatBusy,
  onBodyChange,
  onReply,
  onCancelReply,
  onChatCreator,
  onClose,
  onLoadMore,
  onSubmit,
  onRequireLogin,
}: {
  reel: LajukanReel | null;
  bucket?: ReelCommentsBucket;
  body: string;
  isAuthenticated: boolean;
  submitting: boolean;
  loginHref: string;
  replyTarget: ReelComment | null;
  chatBusy: boolean;
  onBodyChange: (value: string) => void;
  onReply: (comment: ReelComment) => void;
  onCancelReply: () => void;
  onChatCreator: (comment?: ReelComment | null) => void;
  onClose: () => void;
  onLoadMore: (reelId: string) => void;
  onSubmit: () => void;
  onRequireLogin: () => void;
}) {
  if (!reel) return null;

  const comments = bucket?.items ?? [];
  const repliesByParent = new Map<string, ReelComment[]>();
  const roots: ReelComment[] = [];

  comments.forEach(comment => {
    const parentId = comment.parentCommentId || null;
    if (parentId) {
      const current = repliesByParent.get(parentId) ?? [];
      current.push(comment);
      repliesByParent.set(parentId, current);
    } else {
      roots.push(comment);
    }
  });

  roots.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  repliesByParent.forEach(items => {
    items.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  });

  return (
    <div
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/62 text-slate-950 backdrop-blur-sm lg:items-stretch lg:justify-end lg:bg-black/42 lg:p-0 lg:backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup komentar"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative flex max-h-[86svh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl lg:h-full lg:max-h-none lg:w-[460px] lg:max-w-none lg:rounded-none lg:border-l lg:border-white/10 xl:w-[500px]">
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-slate-200 lg:hidden" />
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">
              {formatCompactMetric(metricCount(reel, 'comments'))} komentar
            </p>
            <h2 className="truncate text-base font-black">{reel.title}</h2>
          </div>

          <button
            type="button"
            onClick={() => onChatCreator(null)}
            disabled={chatBusy}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-emerald-700 px-3 text-xs font-black text-white disabled:opacity-60"
          >
            {chatBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquareText className="h-4 w-4" />
            )}
            Chat
          </button>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {bucket?.loading && comments.length === 0 ? (
            <div className="grid h-44 place-items-center text-sm font-bold text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat komentar...
              </span>
            </div>
          ) : roots.length > 0 ? (
            <div className="space-y-4">
              {roots.map(comment => {
                const replies = repliesByParent.get(comment.id) ?? [];

                return (
                  <article key={comment.id} className="space-y-2">
                    <div className="flex gap-2.5">
                      <img
                        src={profileAvatarSrc(comment.authorAvatarUrl)}
                        alt={comment.authorName}
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="rounded-2xl bg-slate-100 px-3 py-2">
                          <p className="truncate text-xs font-black text-slate-900">
                            {comment.authorName}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                            {comment.body}
                          </p>
                        </div>
                        <div className="mt-1 flex items-center gap-3 px-2 text-[11px] font-bold text-slate-400">
                          <span>{formatCommentTime(comment.createdAt)}</span>
                          <button
                            type="button"
                            onClick={() => onReply(comment)}
                            className="text-slate-500 transition hover:text-emerald-700"
                          >
                            Balas
                          </button>
                          <button
                            type="button"
                            onClick={() => onChatCreator(comment)}
                            className="text-slate-500 transition hover:text-emerald-700"
                          >
                            Chat creator
                          </button>
                        </div>
                      </div>
                    </div>

                    {replies.length > 0 && (
                      <div className="ml-11 space-y-2 border-l border-slate-200 pl-3">
                        {replies.map(reply => (
                          <div key={reply.id} className="flex gap-2">
                            <img
                              src={profileAvatarSrc(reply.authorAvatarUrl)}
                              alt={reply.authorName}
                              className="h-7 w-7 shrink-0 rounded-full object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                                <p className="truncate text-[11px] font-black text-slate-900">
                                  {reply.authorName}
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
                                  {reply.body}
                                </p>
                              </div>
                              <p className="mt-1 px-2 text-[10px] font-semibold text-slate-400">
                                {formatCommentTime(reply.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="grid h-44 place-items-center text-center">
              <div>
                <MessageCircle className="mx-auto h-9 w-9 text-slate-300" />
                <p className="mt-2 text-sm font-black text-slate-700">
                  Belum ada komentar
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Jadilah yang pertama kasih insight.
                </p>
              </div>
            </div>
          )}

          {bucket?.error && (
            <div className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {bucket.error}
            </div>
          )}

          {bucket?.hasMore && comments.length > 0 && (
            <button
              type="button"
              onClick={() => onLoadMore(reel.id)}
              disabled={bucket.loading}
              className="mt-4 w-full rounded-full bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-700 disabled:opacity-60"
            >
              {bucket.loading ? 'Memuat...' : 'Lihat komentar lainnya'}
            </button>
          )}
        </div>

        <form
          onSubmit={event => {
            event.preventDefault();
            onSubmit();
          }}
          className="border-t border-slate-100 bg-white p-3"
        >
          {isAuthenticated ? (
            <div className="space-y-2">
              {replyTarget && (
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                  <span className="min-w-0 truncate">
                    Membalas {replyTarget.authorName}
                  </span>
                  <button
                    type="button"
                    onClick={onCancelReply}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-emerald-800"
                    aria-label="Batalkan balasan"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <textarea
                  value={body}
                  onChange={event => onBodyChange(event.target.value)}
                  placeholder={
                    replyTarget ? 'Tulis balasan...' : 'Tulis komentar...'
                  }
                  maxLength={520}
                  rows={1}
                  className="max-h-28 min-h-[42px] flex-1 resize-none rounded-[20px] bg-slate-100 px-3 py-2.5 text-sm font-medium outline-none ring-emerald-600/20 transition focus:ring-4"
                />
                <button
                  type="submit"
                  disabled={submitting || !body.trim()}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-700 text-white shadow-lg shadow-emerald-700/20 disabled:opacity-45"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRequireLogin}
                className="min-w-0 flex-1 rounded-full bg-slate-100 px-4 py-3 text-left text-sm font-bold text-slate-500"
              >
                Masuk untuk komentar
              </button>
              <Link
                href={loginHref}
                className="rounded-full bg-emerald-700 px-4 py-3 text-sm font-black text-white"
              >
                Masuk
              </Link>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}

function ProductSheet({
  locale,
  reel,
  isAuthenticated,
  onClose,
  onRequireLogin,
}: {
  locale: string;
  reel: LajukanReel | null;
  isAuthenticated: boolean;
  onClose: () => void;
  onRequireLogin: () => void;
}) {
  if (!reel) return null;

  const productHref = localizedHref(locale, reel.productHref || '/home');
  const checkoutHref = appendQuery(productHref, 'checkout', '1');

  return (
    <div
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/62 text-slate-950 backdrop-blur-sm lg:items-stretch lg:justify-end lg:bg-black/42 lg:p-0 lg:backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup produk"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative flex max-h-[84svh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl lg:h-full lg:max-h-none lg:w-[420px] lg:max-w-none lg:rounded-none lg:border-l lg:border-white/10 xl:w-[460px]">
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-slate-200 lg:hidden" />
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-yellow-700">
              Produk terkait
            </p>
            <h2 className="mt-1 text-xl font-black leading-tight">
              {reel.productName || 'Produk terkait'}
            </h2>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {reel.productPrice || 'Harga mengikuti detail produk'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex items-center gap-3 rounded-[24px] border border-yellow-200 bg-yellow-50 p-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-yellow-400 text-slate-950">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{reel.creator}</p>
              <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-relaxed text-slate-600">
                {reel.caption}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href={productHref}
              className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-black text-slate-800"
            >
              Lihat produk
            </Link>

            {isAuthenticated ? (
              <Link
                href={checkoutHref}
                className="rounded-2xl bg-emerald-700 px-4 py-3 text-center text-sm font-black text-white"
              >
                Mulai transaksi
              </Link>
            ) : (
              <button
                type="button"
                onClick={onRequireLogin}
                className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white"
              >
                Mulai transaksi
              </button>
            )}
          </div>

          <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-500">
            Produk dibuka dari reels. Detail stok, ongkir, dan pembayaran tetap
            diproses di halaman produk.
          </div>
        </div>
      </section>
    </div>
  );
}

function UploadReelSheet({
  locale,
  open,
  authFetch,
  displayName,
  onClose,
  onCreated,
}: {
  locale: string;
  open: boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  displayName: string;
  onClose: () => void;
  onCreated: (reel: LajukanReel) => void;
}) {
  const [form, setForm] = useState<UploadReelForm>(EMPTY_UPLOAD_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<UploadReelStep>('media');
  const [studioMode, setStudioMode] = useState<ReelsStudioMode>('video');
  const [studioPanel, setStudioPanel] = useState<ReelsStudioPanel>(null);
  const [studioSpeed, setStudioSpeed] = useState<ReelsStudioSpeed>('1x');
  const [studioDuration, setStudioDuration] =
    useState<ReelsStudioDuration>('15s');
  const [studioEffect, setStudioEffect] = useState<ReelsStudioEffect>('none');
  const [cameraFacingMode, setCameraFacingMode] =
    useState<ReelsStudioFacingMode>('environment');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const recordingAnimationRef = useRef<number | null>(null);
  const autoCameraAttemptedRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(
    null,
  );
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const hasMedia = Boolean(file || form.mediaUrl.trim());

  const setField = useCallback(
    <K extends keyof UploadReelForm>(field: K, value: UploadReelForm[K]) => {
      setForm(current => ({ ...current, [field]: value }));
    },
    [],
  );

  const stopCamera = useCallback(() => {
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (recordingAnimationRef.current !== null) {
      window.cancelAnimationFrame(recordingAnimationRef.current);
      recordingAnimationRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraReady(false);
    setRecording(false);
    setRecordingStartedAt(null);
    setRecordingElapsedMs(0);
  }, []);

  const openCamera = useCallback(
    async (facingMode = cameraFacingMode) => {
      setError(null);
      setCameraError(null);
      setForm(current => ({ ...current, captureMode: 'camera' }));

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Kamera belum didukung di browser ini.');
        return;
      }

      if (openNativeReelsStudio('reels_upload')) {
        return;
      }

      requestNativePermissions(['camera', 'microphone']);
      stopCamera();

      try {
        const videoConstraints: MediaTrackConstraints = {
          facingMode: { ideal: facingMode },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        };
        let stream: MediaStream;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: videoConstraints,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: videoConstraints,
          });
          setCameraError(
            'Kamera aktif tanpa mikrofon. Kamu tetap bisa rekam visual atau upload audio nanti.',
          );
        }

        cameraStreamRef.current = stream;
        setCameraFacingMode(facingMode);
        setCameraReady(true);
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          await cameraVideoRef.current.play().catch(() => undefined);
        }
      } catch {
        setCameraError(
          'Kamera belum bisa dibuka. Cek izin browser atau pakai galeri dulu.',
        );
      }
    },
    [cameraFacingMode, stopCamera],
  );

  const flipCamera = useCallback(() => {
    const nextFacingMode =
      cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextFacingMode);
    void openCamera(nextFacingMode);
  }, [cameraFacingMode, openCamera]);

  const selectStudioMode = useCallback(
    (mode: ReelsStudioMode) => {
      setStudioMode(mode);
      setStudioPanel(null);
      setError(null);
      setCameraError(null);

      if (mode === 'gallery') {
        stopCamera();
        setForm(current => ({ ...current, captureMode: 'upload' }));
        return;
      }

      if (mode === 'live') {
        stopCamera();
        setForm(current => ({
          ...current,
          captureMode: 'live',
          tag: current.tag === 'UMKM' ? 'Live UMKM' : current.tag,
          liveSchedule: current.liveSchedule
            ? current.liveSchedule
            : toDatetimeLocalValue(new Date(Date.now() + 60 * 60_000)),
        }));
        return;
      }

      setForm(current => ({
        ...current,
        captureMode: 'camera',
        title: current.title.trim()
          ? current.title
          : mode === 'photo'
            ? 'Foto usaha'
            : 'Rekaman usaha',
        hook: current.hook.trim()
          ? current.hook
          : mode === 'photo'
            ? 'Lihat detailnya'
            : 'Lihat prosesnya langsung',
      }));
    },
    [setStudioMode, stopCamera],
  );

  const captureCameraPhoto = useCallback(() => {
    setError(null);
    setCameraError(null);
    setStudioPanel(null);

    const video = cameraVideoRef.current;
    if (!video || !cameraStreamRef.current || !cameraReady) {
      setCameraError('Buka kamera dulu, baru ambil foto.');
      return;
    }

    const width = REELS_CAPTURE_CANVAS_WIDTH;
    const height = REELS_CAPTURE_CANVAS_HEIGHT;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Foto belum bisa dibuat di browser ini.');
      return;
    }

    context.filter = getReelFilterCss(form.filterPreset);
    drawVideoCoverFrame(context, video, width, height);
    context.filter = 'none';
    drawStudioCanvasEffect(context, width, height, studioEffect);
    canvas.toBlob(
      blob => {
        if (!blob) {
          setCameraError('Foto belum bisa dibuat. Coba sekali lagi.');
          return;
        }
        const photoFile = new File(
          [blob],
          `lajukan-reels-photo-${Date.now()}.jpg`,
          { type: 'image/jpeg' },
        );
        setStudioMode('photo');
        setFile(photoFile);
        setForm(current => ({
          ...current,
          captureMode: 'camera',
          mediaUrl: '',
          title: current.title.trim() ? current.title : 'Foto usaha',
          hook: current.hook.trim() ? current.hook : 'Lihat detailnya',
          caption: current.caption.trim()
            ? current.caption
            : current.hook.trim() || 'Foto usaha dari kamera Lajukan.',
        }));
        setStep('edit');
      },
      'image/jpeg',
      0.92,
    );
  }, [cameraReady, form.filterPreset, setStudioMode, studioEffect]);

  const startCameraRecording = useCallback(() => {
    setError(null);
    setCameraError(null);
    setStudioPanel(null);
    setStudioMode('video');
    const stream = cameraStreamRef.current;
    if (!stream) {
      setCameraError('Buka kamera dulu, baru rekam.');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setCameraError('Rekam langsung belum didukung di browser ini.');
      return;
    }

    const video = cameraVideoRef.current;
    let recorderStream: MediaStream = stream;

    if (video) {
      const canvas = document.createElement('canvas');
      canvas.width = REELS_CAPTURE_CANVAS_WIDTH;
      canvas.height = REELS_CAPTURE_CANVAS_HEIGHT;
      const context = canvas.getContext('2d');
      const canvasStream =
        context && typeof canvas.captureStream === 'function'
          ? canvas.captureStream(REELS_CAPTURE_FPS)
          : null;

      if (context && canvasStream) {
        stream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
        recorderStream = canvasStream;

        const paintFrame = () => {
          const currentVideo = cameraVideoRef.current;
          const currentRecorder = recorderRef.current;
          if (
            !currentVideo ||
            !currentRecorder ||
            currentRecorder.state === 'inactive'
          ) {
            recordingAnimationRef.current = null;
            return;
          }

          context.clearRect(
            0,
            0,
            REELS_CAPTURE_CANVAS_WIDTH,
            REELS_CAPTURE_CANVAS_HEIGHT,
          );
          context.filter = getReelFilterCss(form.filterPreset);
          drawVideoCoverFrame(
            context,
            currentVideo,
            REELS_CAPTURE_CANVAS_WIDTH,
            REELS_CAPTURE_CANVAS_HEIGHT,
          );
          context.filter = 'none';
          drawStudioCanvasEffect(
            context,
            REELS_CAPTURE_CANVAS_WIDTH,
            REELS_CAPTURE_CANVAS_HEIGHT,
            studioEffect,
          );
          recordingAnimationRef.current =
            window.requestAnimationFrame(paintFrame);
        };

        recordingAnimationRef.current =
          window.requestAnimationFrame(paintFrame);
      }
    }

    const mimeType = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ].find(type => MediaRecorder.isTypeSupported(type));
    const recorder = mimeType
      ? new MediaRecorder(recorderStream, { mimeType })
      : new MediaRecorder(recorderStream);

    recorderChunksRef.current = [];
    recorder.ondataavailable = event => {
      if (event.data.size > 0) {
        recorderChunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      if (recordingTimeoutRef.current !== null) {
        window.clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      if (recordingAnimationRef.current !== null) {
        window.cancelAnimationFrame(recordingAnimationRef.current);
        recordingAnimationRef.current = null;
      }
      const type = recorder.mimeType || 'video/webm';
      const blob = new Blob(recorderChunksRef.current, { type });
      if (blob.size > 0) {
        const recordedFile = new File(
          [blob],
          `lajukan-reels-${Date.now()}.webm`,
          { type },
        );
        setFile(recordedFile);
        setForm(current => ({
          ...current,
          mediaUrl: '',
          title: current.title.trim() ? current.title : 'Rekaman usaha',
          hook: current.hook.trim() ? current.hook : 'Lihat prosesnya langsung',
          caption: current.caption.trim()
            ? current.caption
            : current.hook.trim() ||
            'Rekaman singkat usaha dari kamera Lajukan.',
        }));
        setStep('edit');
      }
      setRecording(false);
      setRecordingStartedAt(null);
      setRecordingElapsedMs(0);
    };
    recorder.start(250);
    recorderRef.current = recorder;
    setRecording(true);
    setRecordingStartedAt(Date.now());
    setRecordingElapsedMs(0);
    recordingTimeoutRef.current = window.setTimeout(() => {
      const currentRecorder = recorderRef.current;
      if (currentRecorder && currentRecorder.state !== 'inactive') {
        currentRecorder.stop();
      }
    }, getStudioDurationMs(studioDuration));
  }, [form.filterPreset, setStudioMode, studioDuration, studioEffect]);

  const stopCameraRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      if (recordingTimeoutRef.current !== null) {
        window.clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      if (recordingAnimationRef.current !== null) {
        window.cancelAnimationFrame(recordingAnimationRef.current);
        recordingAnimationRef.current = null;
      }
      setRecording(false);
      setRecordingStartedAt(null);
      setRecordingElapsedMs(0);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setError(null);
      setFile(null);
      setStep('media');
      setStudioMode('video');
      setStudioPanel(null);
      setStudioSpeed('1x');
      setStudioDuration('15s');
      setStudioEffect('none');
      setCameraFacingMode('environment');
      setForm(EMPTY_UPLOAD_FORM);
      setCameraError(null);
      setRecordingStartedAt(null);
      setRecordingElapsedMs(0);
      autoCameraAttemptedRef.current = false;
      stopCamera();
    }
  }, [open, setStudioMode, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!recording || !recordingStartedAt) return;

    const updateElapsed = () =>
      setRecordingElapsedMs(Date.now() - recordingStartedAt);
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 200);
    return () => window.clearInterval(interval);
  }, [recording, recordingStartedAt]);

  useEffect(() => {
    if (form.captureMode !== 'camera') {
      stopCamera();
    }
  }, [form.captureMode, stopCamera]);

  useEffect(() => {
    if (
      !open ||
      step !== 'media' ||
      form.captureMode !== 'camera' ||
      hasMedia ||
      cameraReady ||
      cameraError ||
      autoCameraAttemptedRef.current
    ) {
      return;
    }

    autoCameraAttemptedRef.current = true;
    const timer = window.setTimeout(() => void openCamera(), 220);
    return () => window.clearTimeout(timer);
  }, [
    cameraError,
    cameraReady,
    form.captureMode,
    hasMedia,
    open,
    openCamera,
    step,
  ]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    const handleNativeCapture = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      if (!detail || typeof detail !== 'object') return;
      const path = typeof detail.path === 'string' ? detail.path : '';
      const mode: ReelsStudioMode =
        detail.mode === 'photo' ||
          detail.mode === 'video' ||
          detail.mode === 'gallery' ||
          detail.mode === 'live'
          ? detail.mode
          : 'video';
      const mediaType = detail.mediaType === 'image' ? 'image' : 'video';
      const filter =
        typeof detail.filter === 'string'
          ? detail.filter.toLowerCase()
          : form.filterPreset;
      const music =
        typeof detail.music === 'string' ? detail.music : form.musicTrack;
      const speed =
        typeof detail.speed === 'string' &&
          REELS_STUDIO_SPEEDS.includes(detail.speed as ReelsStudioSpeed)
          ? (detail.speed as ReelsStudioSpeed)
          : studioSpeed;
      const duration =
        typeof detail.duration === 'string' &&
          REELS_STUDIO_DURATIONS.includes(detail.duration as ReelsStudioDuration)
          ? (detail.duration as ReelsStudioDuration)
          : studioDuration;
      const effect = isStudioEffect(detail.effect)
        ? detail.effect
        : studioEffect;

      setStudioMode(mode === 'gallery' ? 'gallery' : mode);
      setStudioSpeed(speed);
      setStudioDuration(duration);
      setStudioEffect(effect);
      setForm(current => ({
        ...current,
        captureMode:
          mode === 'live' ? 'live' : mode === 'gallery' ? 'upload' : 'camera',
        mediaUrl: path || current.mediaUrl,
        filterPreset: REEL_FILTER_PRESETS.some(item => item.id === filter)
          ? (filter as UploadReelForm['filterPreset'])
          : current.filterPreset,
        musicTrack: music,
        title: current.title.trim()
          ? current.title
          : mediaType === 'image'
            ? 'Foto usaha'
            : 'Rekaman usaha',
      }));
      if (path) {
        setFile(null);
        setStep('edit');
      }
    };

    window.addEventListener(
      'lajukan-native-reels-capture',
      handleNativeCapture,
    );
    return () =>
      window.removeEventListener(
        'lajukan-native-reels-capture',
        handleNativeCapture,
      );
  }, [
    form.filterPreset,
    form.musicTrack,
    open,
    setStudioMode,
    studioDuration,
    studioEffect,
    studioSpeed,
  ]);

  if (!open) return null;

  const mediaPreviewSrc = previewUrl || form.mediaUrl.trim();
  const isImageMedia = file
    ? file.type.startsWith('image/')
    : isImageMediaUrl(mediaPreviewSrc);
  const previewMediaStyle = getReelMediaStyle(form.filterPreset);
  const activeStudioEffect =
    REELS_STUDIO_EFFECTS.find(effect => effect.id === studioEffect) ||
    REELS_STUDIO_EFFECTS[0];
  const recordingLimitMs = getStudioDurationMs(studioDuration);
  const recordingProgress = recording
    ? Math.min(recordingElapsedMs / recordingLimitMs, 1)
    : 0;
  const recordingRemainingSeconds = Math.max(
    Math.ceil((recordingLimitMs - recordingElapsedMs) / 1000),
    0,
  );
  const selectedCaptureMode = REEL_CAPTURE_MODES.find(
    mode => mode.id === form.captureMode,
  );
  const SelectedCaptureIcon = selectedCaptureMode?.icon ?? Camera;
  const activeStudioMode =
    REELS_STUDIO_MODES.find(mode => mode.id === studioMode) ||
    REELS_STUDIO_MODES[2];
  const ActiveStudioIcon = activeStudioMode.icon;
  const fieldLabelClass = 'text-xs font-black text-white/84';
  const inputClass =
    'mt-1 h-10 w-full rounded-[13px] border border-white/10 bg-white/[0.08] px-3 text-[13px] font-semibold text-white outline-none placeholder:text-white/38 focus:border-emerald-300/50 focus:bg-white/[0.11]';
  const textareaClass =
    'mt-1 w-full resize-none rounded-[13px] border border-white/10 bg-white/[0.08] px-3 py-2 text-[13px] font-semibold text-white outline-none placeholder:text-white/38 focus:border-emerald-300/50 focus:bg-white/[0.11]';

  const handleFile = (nextFile: File | null) => {
    setFile(nextFile);
    setError(null);
    setStudioPanel(null);
    if (nextFile && form.captureMode !== 'live') {
      setStudioMode('gallery');
      setField('captureMode', 'upload');
    }
    if (nextFile && !form.title.trim()) {
      const name = nextFile.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      setField('title', name.slice(0, 90));
    }
  };

  const goNext = () => {
    setError(null);
    if (step === 'media') {
      if (!hasMedia) {
        setError(
          form.captureMode === 'live'
            ? 'Tambahkan poster atau teaser live dulu.'
            : 'Pilih video/foto dulu sebelum lanjut.',
        );
        return;
      }
      setStep('edit');
      return;
    }
    if (step === 'edit') {
      setStep('post');
    }
  };

  const handleStudioCapture = () => {
    if (studioMode === 'gallery') {
      setStudioMode('video');
      setForm(current => ({ ...current, captureMode: 'camera' }));
      setStudioPanel(null);
      return;
    }
    if (studioMode === 'live') {
      setStep('post');
      return;
    }
    if (!cameraReady) {
      void openCamera();
      return;
    }
    if (studioMode === 'photo') {
      captureCameraPhoto();
      return;
    }
    if (recording) {
      stopCameraRecording();
    } else {
      startCameraRecording();
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const title = form.title.trim() || form.hook.trim() || 'Reels usaha';
    const caption =
      form.caption.trim() ||
      form.hook.trim() ||
      title ||
      'Reels usaha dari Lajukan';
    const tag = form.tag.trim();
    let mediaUrl = form.mediaUrl.trim();

    if (!caption || !tag) {
      setError('Caption dan kategori wajib diisi.');
      return;
    }
    if (!hasMedia) {
      setError('Pilih atau upload media dulu.');
      return;
    }
    if (form.captureMode === 'live' && !form.liveTitle.trim()) {
      setError('Judul live wajib diisi biar penonton langsung paham.');
      setStep('post');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (file) {
        const data = new FormData();
        data.append('media', file);
        const uploadResponse = await authFetch('/api/forum/upload-media', {
          method: 'POST',
          body: data,
        });
        const uploadPayload = (await uploadResponse
          .json()
          .catch(() => ({}))) as {
            urls?: string[];
            error?: string;
          };
        if (!uploadResponse.ok || !uploadPayload.urls?.[0]) {
          throw new Error(uploadPayload.error || 'Upload media gagal');
        }
        mediaUrl = uploadPayload.urls[0];
      }

      const productHref = form.productHref.trim();
      const response = await authFetch('/api/reels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          creator: displayName,
          caption,
          tag,
          mediaUrl,
          videoSrc: mediaUrl,
          sourceUrl: mediaUrl,
          mediaType: isImageMedia ? 'image' : 'video',
          productName: form.productName.trim() || undefined,
          productPrice: form.productPrice.trim() || undefined,
          productHref: productHref || undefined,
          storeName:
            form.storeName.trim() || form.productName.trim() || displayName,
          storeCity: form.storeCity.trim() || undefined,
          hook: (form.hook.trim() || caption).slice(0, 150),
          tone: 'emerald',
          iconKey: 'marketing',
          filterPreset: form.filterPreset,
          captureMode: form.captureMode,
          liveStatus: form.captureMode === 'live' ? 'scheduled' : 'none',
          liveTitle:
            form.captureMode === 'live'
              ? form.liveTitle.trim() || title
              : undefined,
          liveScheduledAt:
            form.captureMode === 'live'
              ? toIsoDateTime(form.liveSchedule)
              : undefined,
          metadata: {
            studio: {
              filterPreset: form.filterPreset,
              captureMode: form.captureMode,
              mode: studioMode,
              speed: studioSpeed,
              duration: studioDuration,
              effect: studioEffect,
              musicTrack: form.musicTrack,
              live: form.captureMode === 'live',
            },
            studioEffect,
          },
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        reel?: LajukanReel;
        error?: string;
      };

      if (!response.ok || !payload.reel) {
        throw new Error(payload.error || 'Reels gagal dibuat');
      }

      setForm(EMPTY_UPLOAD_FORM);
      setFile(null);
      setStep('media');
      setStudioMode('video');
      setStudioEffect('none');
      onCreated(payload.reel);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Reels gagal dibuat');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/86 text-[color:var(--app-text)] backdrop-blur-md lg:items-center lg:justify-center lg:p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup upload reels"
        onClick={onClose}
        className="absolute inset-0"
      />

      <form
        onSubmit={submit}
        data-lajukan-reels-studio="true"
        className={cn(
          'relative flex h-[100svh] max-h-[100svh] w-full flex-col overflow-hidden bg-[#050505] text-white shadow-2xl',
          step === 'media'
            ? 'lg:max-w-[460px] lg:rounded-[32px] lg:ring-1 lg:ring-white/10'
            : 'lg:h-[calc(100svh-2rem)] lg:max-w-[960px] lg:rounded-[30px] lg:ring-1 lg:ring-white/10',
        )}
      >
        <div
          className={cn(
            'mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-white/20 lg:hidden',
            step === 'media' && 'hidden',
          )}
        />
        <div
          className={cn(
            'items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 sm:px-4',
            step === 'media' ? 'hidden' : 'flex',
          )}
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
              Reels
            </p>
            <h2 className="text-base font-black">Kamera Reels</h2>
          </div>

          <div className="hidden items-center gap-1 rounded-full bg-white/10 p-1 sm:flex">
            {(['media', 'edit', 'post'] as UploadReelStep[]).map(
              (item, index) => (
                <span
                  key={item}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[11px] font-black',
                    step === item
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-white/58',
                  )}
                >
                  {index + 1}.{' '}
                  {item === 'media'
                    ? 'Media'
                    : item === 'edit'
                      ? 'Edit'
                      : 'Post'}
                </span>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1',
            step === 'media'
              ? 'overflow-hidden p-0 sm:grid sm:place-items-center sm:p-3'
              : 'overflow-y-auto p-2 sm:p-3',
          )}
        >
          <div
            className={cn(
              'min-h-0 gap-2.5',
              step === 'media'
                ? 'h-full w-full'
                : 'grid lg:grid-cols-[minmax(250px,360px)_minmax(0,1fr)] lg:gap-3',
            )}
          >
            <div
              className={cn(
                'mx-auto',
                step === 'media'
                  ? 'h-full w-full sm:aspect-[9/16] sm:h-[calc(100svh-1.5rem)] sm:max-h-[820px] sm:w-auto'
                  : 'w-full max-w-[340px]',
              )}
            >
              <div
                className={cn(
                  'relative overflow-hidden bg-[#2d374b] shadow-2xl ring-1 ring-white/10',
                  step === 'media'
                    ? 'h-full w-full rounded-none sm:aspect-[9/16] sm:rounded-[32px]'
                    : 'aspect-[9/16] max-h-[calc(100svh-128px)] rounded-[24px] lg:max-h-[calc(100svh-150px)]',
                )}
              >
                {mediaPreviewSrc ? (
                  isImageMedia ? (
                    <img
                      src={mediaPreviewSrc}
                      alt="Preview reels"
                      className="h-full w-full object-cover"
                      style={previewMediaStyle}
                    />
                  ) : (
                    <video
                      src={mediaPreviewSrc}
                      className="h-full w-full object-cover"
                      style={previewMediaStyle}
                      controls
                      playsInline
                      preload="metadata"
                    />
                  )
                ) : form.captureMode === 'camera' ? (
                  <>
                    <video
                      ref={cameraVideoRef}
                      className="h-full w-full object-cover"
                      style={previewMediaStyle}
                      muted
                      playsInline
                      autoPlay
                    />
                    {!cameraReady && (
                      <div className="absolute inset-0 grid place-items-center p-5 text-center text-white">
                        <div>
                          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/12">
                            <Camera className="h-8 w-8" />
                          </div>
                          {step !== 'media' && (
                            <>
                              <p className="mt-4 text-sm font-black">
                                Buka kamera Lajukan
                              </p>
                              <p className="mt-1 text-xs font-semibold leading-5 text-white/58">
                                Rekam video, ambil foto, tambah filter, lalu
                                post.
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid h-full place-items-center p-6 text-center text-white">
                    <div>
                      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/12">
                        <Clapperboard className="h-8 w-8" />
                      </div>
                      <p className="mt-4 text-sm font-black">
                        Pilih media dulu
                      </p>
                      <p className="mt-1 text-xs font-semibold text-white/55">
                        Reels tampil 9:16, video asli bisa langsung diputar.
                      </p>
                    </div>
                  </div>
                )}
                <StudioEffectOverlay effect={studioEffect} />

                {step !== 'media' && (form.hook || form.title) && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
                    <p className="text-[11px] font-black text-yellow-300">
                      {form.tag}
                    </p>
                    <p className="mt-1 line-clamp-2 text-base font-black leading-tight">
                      {form.hook || form.title}
                    </p>
                  </div>
                )}
                {step !== 'media' && (
                  <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1.5 text-[11px] font-black text-white backdrop-blur">
                    <SelectedCaptureIcon className="h-3.5 w-3.5" />
                    {selectedCaptureMode?.label ?? 'Kamera'}
                  </div>
                )}
                {step !== 'media' && form.captureMode === 'live' && (
                  <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-2.5 py-1.5 text-[11px] font-black text-white shadow-xl">
                    <Radio className="h-3.5 w-3.5" />
                    Live
                  </div>
                )}
                {step !== 'media' && (
                  <div className="absolute right-3 top-14 z-20 flex flex-col gap-2">
                    {[
                      {
                        label: 'Filter',
                        icon: Sparkles,
                        action: () => setStep('edit'),
                      },
                      {
                        label: form.musicTrack || 'Original',
                        icon: Volume2,
                        action: () =>
                          setField(
                            'musicTrack',
                            form.musicTrack === 'Original sound'
                              ? 'Suara toko'
                              : 'Original sound',
                          ),
                      },
                      {
                        label: 'Balik',
                        icon: RefreshCcw,
                        action: flipCamera,
                      },
                    ].map(tool => {
                      const ToolIcon = tool.icon;
                      return (
                        <button
                          key={tool.label}
                          type="button"
                          onClick={tool.action}
                          className="grid h-10 w-10 place-items-center rounded-full bg-black/38 text-white shadow-xl ring-1 ring-white/12 backdrop-blur transition active:scale-95"
                          aria-label={tool.label}
                        >
                          <ToolIcon className="h-4.5 w-4.5" />
                        </button>
                      );
                    })}
                  </div>
                )}
                {step !== 'media' && (
                  <div className="absolute inset-x-2 bottom-3 z-20">
                    <div className="mx-auto flex max-w-[240px] items-center justify-center rounded-full bg-black/42 px-3 py-2 text-white shadow-2xl ring-1 ring-white/12 backdrop-blur">
                      <div className="flex items-center gap-2 text-[11px] font-black">
                        <Camera className="h-4 w-4 text-emerald-200" />
                        <span>{selectedCaptureMode?.label ?? 'Kamera'}</span>
                        <span className="rounded-full bg-white/12 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/74">
                          {locale === 'id' ? 'Mode cepat' : 'Quick mode'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {step === 'media' && (
                  <>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/42 via-transparent to-black/74" />

                    <button
                      type="button"
                      onClick={onClose}
                      className="absolute left-3 top-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/34 text-white ring-1 ring-white/12 backdrop-blur"
                      aria-label="Tutup"
                    >
                      <X className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setStudioPanel(current =>
                          current === 'music' ? null : 'music',
                        )
                      }
                      className="absolute left-1/2 top-4 z-30 inline-flex max-w-[210px] -translate-x-1/2 items-center gap-2 rounded-full bg-black/24 px-3 py-2 text-xs font-black text-white ring-1 ring-white/10 backdrop-blur"
                    >
                      <Music className="h-4 w-4" />
                      <span className="truncate">
                        {form.musicTrack === 'Original sound'
                          ? 'Suara'
                          : form.musicTrack}
                      </span>
                    </button>

                    {hasMedia && (
                      <button
                        type="button"
                        onClick={goNext}
                        className="absolute right-3 top-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-white text-slate-950 shadow-xl"
                        aria-label="Lanjut edit"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                    )}

                    <div className="absolute right-2 top-[calc(env(safe-area-inset-top)+76px)] z-30 flex w-11 flex-col items-center gap-2 text-white">
                      <button
                        type="button"
                        onClick={flipCamera}
                        className="grid h-10 w-10 place-items-center rounded-full bg-black/32 text-white shadow-lg ring-1 ring-white/12 backdrop-blur transition active:scale-95"
                        aria-label="Flip"
                        title="Flip"
                      >
                        <RefreshCcw className="h-4.5 w-4.5" />
                      </button>
                    </div>

                    {cameraError && (
                      <div
                        className={cn(
                          'absolute inset-x-4 z-40 rounded-[16px] bg-amber-300/18 px-3 py-2 text-center text-xs font-bold text-amber-50 ring-1 ring-amber-200/20 backdrop-blur',
                          studioPanel ? 'bottom-[258px]' : 'bottom-[196px]',
                        )}
                      >
                        {cameraError}
                      </div>
                    )}

                    <div className="absolute inset-x-0 bottom-[148px] z-30 flex justify-center">
                      {recording ? (
                        <div className="w-[210px] overflow-hidden rounded-full bg-black/52 px-3 py-2 text-[12px] font-black text-white shadow-xl ring-1 ring-white/12 backdrop-blur">
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-rose-500" />
                              REC
                            </span>
                            <span>{recordingRemainingSeconds}s</span>
                          </div>
                          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/16">
                            <span
                              className="block h-full origin-left rounded-full bg-rose-500"
                              style={{
                                transform: `scaleX(${recordingProgress})`,
                              }}
                            />
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 rounded-full bg-black/42 p-1 text-[12px] font-black text-white/50 shadow-xl ring-1 ring-white/12 backdrop-blur">
                          {REELS_STUDIO_DURATIONS.map(duration => (
                            <button
                              key={duration}
                              type="button"
                              onClick={() => setStudioDuration(duration)}
                              className={cn(
                                'h-8 rounded-full px-3 transition',
                                studioDuration === duration
                                  ? 'bg-white text-slate-950'
                                  : 'text-white/62',
                              )}
                            >
                              {duration}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="absolute inset-x-5 bottom-[52px] z-30 grid grid-cols-[68px_minmax(88px,1fr)_68px] items-end gap-2 text-white">
                      <button
                        type="button"
                        onClick={() =>
                          setStudioPanel(current =>
                            current === 'effects' ? null : 'effects',
                          )
                        }
                        className="flex flex-col items-center gap-1 text-[11px] font-black"
                      >
                        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-white/18 ring-1 ring-white/18 backdrop-blur">
                          <Sparkles className="h-5 w-5 text-yellow-200" />
                        </span>
                        <span className="max-w-[64px] truncate">
                          {studioEffect === 'none'
                            ? 'Efek'
                            : activeStudioEffect.label}
                        </span>
                      </button>

                      <button
                        type="button"
                        data-lajukan-reels-camera="true"
                        onClick={handleStudioCapture}
                        className={cn(
                          'mx-auto grid h-[86px] w-[86px] place-items-center rounded-full border-[5px] border-white shadow-2xl transition active:scale-95',
                          recording ? 'bg-rose-500' : 'bg-white/12',
                        )}
                        aria-label="Ambil media reels"
                      >
                        {recording ? (
                          <span className="h-8 w-8 rounded-[8px] bg-white" />
                        ) : studioMode === 'photo' ? (
                          <Camera className="h-8 w-8" />
                        ) : studioMode === 'live' ? (
                          <Radio className="h-8 w-8" />
                        ) : (
                          <span className="h-[62px] w-[62px] rounded-full bg-rose-500 ring-4 ring-rose-400/35" />
                        )}
                      </button>

                      <label className="flex cursor-pointer flex-col items-center gap-1 text-[11px] font-black">
                        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-white/18 ring-1 ring-white/18 backdrop-blur">
                          <Upload className="h-5 w-5 text-orange-200" />
                        </span>
                        Galeri
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/x-m4v,image/*"
                          onChange={event =>
                            handleFile(event.target.files?.[0] ?? null)
                          }
                          className="sr-only"
                        />
                      </label>
                    </div>

                    <div className="absolute inset-x-7 bottom-3 z-30 flex items-center justify-center">
                      <span className="rounded-full bg-black/30 px-3 py-1.5 text-[11px] font-black text-white/72 ring-1 ring-white/10 backdrop-blur">
                        {locale === 'id'
                          ? 'Langsung rekam dari sini'
                          : 'Record straight from here'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div
              className={cn('min-w-0 text-white', step === 'media' && 'hidden')}
            >
              {step === 'media' && (
                <div className="space-y-3">
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.06] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wide text-emerald-300">
                          {activeStudioMode.label}
                        </p>
                        <h3 className="truncate text-base font-black">
                          {studioMode === 'gallery'
                            ? 'Pilih dari galeri'
                            : studioMode === 'photo'
                              ? 'Ambil foto produk'
                              : studioMode === 'live'
                                ? 'Siapkan live'
                                : 'Rekam video vertikal'}
                        </h3>
                      </div>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-950">
                        <ActiveStudioIcon className="h-4.5 w-4.5" />
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-black text-white ring-1 ring-white/10 transition active:scale-[0.98]">
                        <Upload className="h-4 w-4" />
                        Galeri
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/x-m4v,image/*"
                          onChange={event =>
                            handleFile(event.target.files?.[0] ?? null)
                          }
                          className="sr-only"
                        />
                      </label>

                      <button
                        type="button"
                        data-lajukan-reels-camera="true"
                        onClick={() => {
                          if (studioMode === 'gallery') {
                            selectStudioMode('video');
                            return;
                          }
                          if (studioMode === 'live') {
                            setStep('post');
                            return;
                          }
                          if (!cameraReady) {
                            void openCamera();
                            return;
                          }
                          if (studioMode === 'photo') {
                            captureCameraPhoto();
                            return;
                          }
                          if (recording) {
                            stopCameraRecording();
                          } else {
                            startCameraRecording();
                          }
                        }}
                        className={cn(
                          'grid h-16 w-16 place-items-center rounded-full border-4 border-white text-white shadow-2xl transition active:scale-95',
                          recording ? 'bg-rose-500' : 'bg-white/18',
                        )}
                        aria-label="Ambil media reels"
                      >
                        {recording ? (
                          <span className="h-6 w-6 rounded-[6px] bg-white" />
                        ) : studioMode === 'photo' ? (
                          <Camera className="h-7 w-7" />
                        ) : studioMode === 'live' ? (
                          <Radio className="h-7 w-7" />
                        ) : (
                          <span className="h-9 w-9 rounded-full bg-rose-500" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void openCamera()}
                        disabled={
                          studioMode === 'gallery' || studioMode === 'live'
                        }
                        className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-xs font-black text-slate-950 transition active:scale-[0.98] disabled:bg-white/10 disabled:text-white/38"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        {cameraReady ? 'Reset' : 'Kamera'}
                      </button>
                    </div>

                    {cameraError && (
                      <p className="mt-3 rounded-[13px] bg-amber-300/12 px-3 py-2 text-xs font-bold text-amber-100">
                        {cameraError}
                      </p>
                    )}
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-3">
                    <div className="flex items-center gap-2 text-xs font-black text-white/82">
                      <SlidersHorizontal className="h-4 w-4 text-emerald-300" />
                      Filter
                    </div>
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {REEL_FILTER_PRESETS.map(filter => {
                        const active = form.filterPreset === filter.id;
                        return (
                          <button
                            key={filter.id}
                            type="button"
                            onClick={() => setField('filterPreset', filter.id)}
                            className={cn(
                              'inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-2.5 text-[11px] font-black ring-1 transition active:scale-95',
                              active
                                ? 'bg-white text-slate-950 ring-white'
                                : 'bg-white/8 text-white/70 ring-white/10',
                            )}
                          >
                            <span
                              className={cn(
                                'h-5 w-5 rounded-full ring-1 ring-black/5',
                                filter.swatch,
                              )}
                            />
                            {filter.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-3">
                    <div className="flex items-center gap-2 text-xs font-black text-white/82">
                      <Music className="h-4 w-4 text-yellow-300" />
                      Musik
                    </div>
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {REELS_MUSIC_TRACKS.map(track => (
                        <button
                          key={track}
                          type="button"
                          onClick={() => setField('musicTrack', track)}
                          className={cn(
                            'h-9 shrink-0 rounded-full px-3 text-[11px] font-black ring-1 transition active:scale-95',
                            form.musicTrack === track
                              ? 'bg-yellow-300 text-slate-950 ring-yellow-200'
                              : 'bg-white/8 text-white/70 ring-white/10',
                          )}
                        >
                          {track}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-5 text-white/60">
                    Media diambil dari file yang dipilih atau hasil upload
                    internal. Kita tidak mendorong paste URL manual di flow ini.
                  </div>

                  {studioMode === 'live' && (
                    <div className="rounded-[18px] border border-rose-400/20 bg-rose-500/10 p-3 text-xs font-semibold leading-5 text-rose-50">
                      Pilih poster dari galeri, lalu isi judul dan jadwal live.
                    </div>
                  )}

                  <label className="hidden cursor-pointer rounded-[18px] border-2 border-dashed border-white/12 bg-white/[0.05] p-4 text-center transition hover:border-emerald-300">
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/x-m4v,image/*"
                      onChange={event =>
                        handleFile(event.target.files?.[0] ?? null)
                      }
                      className="sr-only"
                    />
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-sm font-black text-[color:var(--app-text)]">
                      {form.captureMode === 'camera'
                        ? 'Atau pilih dari galeri'
                        : form.captureMode === 'live'
                          ? 'Pilih poster / teaser live'
                          : 'Pilih dari perangkat'}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[color:var(--app-text-soft)]">
                      MP4, WebM, MOV, JPG, PNG, WebP
                    </p>
                  </label>

                  {file && (
                    <div className="rounded-2xl bg-white/[0.08] px-3 py-2 text-xs font-bold text-white/62">
                      Terpilih: {file.name}
                    </div>
                  )}
                </div>
              )}

              {step === 'edit' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wide text-emerald-300">
                      Langkah 2
                    </p>
                    <h3 className="text-lg font-black leading-tight">
                      Edit tampilan reels
                    </h3>
                    <p className="mt-1 text-xs font-semibold leading-5 text-white/52">
                      Buat hook pendek biar cepat paham.
                    </p>
                  </div>

                  <div>
                    <p className={fieldLabelClass}>Filter tampilan</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {REEL_FILTER_PRESETS.map(filter => {
                        const active = form.filterPreset === filter.id;
                        return (
                          <button
                            key={filter.id}
                            type="button"
                            onClick={() => setField('filterPreset', filter.id)}
                            className={cn(
                              'flex items-center gap-2 rounded-[15px] border px-2.5 py-2 text-left transition active:scale-[0.98]',
                              active
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100'
                                : 'border-white/10 bg-white/[0.08] text-white',
                            )}
                          >
                            <span
                              className={cn(
                                'h-8 w-8 shrink-0 rounded-[12px] ring-1 ring-black/5',
                                filter.swatch,
                              )}
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-black">
                                {filter.label}
                              </span>
                              <span className="block truncate text-[10px] font-semibold opacity-70">
                                {filter.helper}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className={fieldLabelClass}>Efek kamera gratis</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {REELS_STUDIO_EFFECTS.map(effect => {
                        const active = studioEffect === effect.id;
                        return (
                          <button
                            key={effect.id}
                            type="button"
                            onClick={() => setStudioEffect(effect.id)}
                            className={cn(
                              'flex items-center gap-2 rounded-[15px] border px-2.5 py-2 text-left transition active:scale-[0.98]',
                              active
                                ? 'border-yellow-200 bg-yellow-300 text-slate-950 ring-2 ring-yellow-100'
                                : 'border-white/10 bg-white/[0.08] text-white',
                            )}
                          >
                            <span
                              className={cn(
                                'h-8 w-8 shrink-0 rounded-[12px] ring-1 ring-black/5',
                                effect.swatch,
                              )}
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-black">
                                {effect.label}
                              </span>
                              <span className="block truncate text-[10px] font-semibold opacity-70">
                                {effect.helper}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="block">
                    <span
                      className={`${fieldLabelClass} inline-flex items-center gap-1`}
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Teks hook di video
                    </span>
                    <input
                      value={form.hook}
                      onChange={event => setField('hook', event.target.value)}
                      maxLength={150}
                      placeholder="Contoh: 3 cara packing aman untuk kirim luar kota"
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className={fieldLabelClass}>Judul reels</span>
                    <input
                      value={form.title}
                      onChange={event => setField('title', event.target.value)}
                      maxLength={120}
                      placeholder="Judul singkat untuk detail dan search"
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span
                      className={`${fieldLabelClass} inline-flex items-center gap-1`}
                    >
                      <Hash className="h-3.5 w-3.5" />
                      Kategori
                    </span>
                    <input
                      value={form.tag}
                      onChange={event => setField('tag', event.target.value)}
                      maxLength={48}
                      placeholder="UMKM, Supplier, Packaging, Coffee Shop..."
                      className={inputClass}
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {[
                      'UMKM',
                      'Supplier',
                      'Packaging',
                      'Kuliner',
                      'Promo',
                      'Behind the scene',
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setField('tag', chip)}
                        className={cn(
                          'rounded-full px-3 py-2 text-xs font-black',
                          form.tag === chip
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white/[0.08] text-white/64',
                        )}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'post' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wide text-emerald-300">
                      Langkah 3
                    </p>
                    <h3 className="text-lg font-black leading-tight">
                      Caption dan produk
                    </h3>
                    <p className="mt-1 text-xs font-semibold leading-5 text-white/52">
                      Tambahkan konteks usaha, produk, dan link transaksi kalau
                      ada.
                    </p>
                  </div>

                  {form.captureMode === 'live' && (
                    <div className="rounded-[18px] border border-rose-100 bg-rose-50/80 p-3">
                      <div className="flex items-center gap-2 text-rose-700">
                        <Radio className="h-4 w-4" />
                        <p className="text-xs font-black uppercase tracking-wide">
                          Setup live
                        </p>
                      </div>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <label>
                          <span className={fieldLabelClass}>Judul live</span>
                          <input
                            value={form.liveTitle}
                            onChange={event =>
                              setField('liveTitle', event.target.value)
                            }
                            maxLength={120}
                            placeholder="Contoh: Live stok baju lebaran jam 8"
                            className={inputClass}
                          />
                        </label>
                        <label>
                          <span className={fieldLabelClass}>Jadwal</span>
                          <input
                            type="datetime-local"
                            value={form.liveSchedule}
                            onChange={event =>
                              setField('liveSchedule', event.target.value)
                            }
                            className={inputClass}
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  <label className="block">
                    <span className={fieldLabelClass}>Caption</span>
                    <textarea
                      value={form.caption}
                      onChange={event =>
                        setField('caption', event.target.value)
                      }
                      maxLength={700}
                      rows={3}
                      placeholder="Ceritakan produk, proses, promo, atau tips singkat."
                      className={textareaClass}
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span
                        className={`${fieldLabelClass} inline-flex items-center gap-1`}
                      >
                        <Store className="h-3.5 w-3.5" />
                        Nama toko
                      </span>
                      <input
                        value={form.storeName}
                        onChange={event =>
                          setField('storeName', event.target.value)
                        }
                        maxLength={90}
                        placeholder={displayName}
                        className={inputClass}
                      />
                    </label>

                    <label>
                      <span className={fieldLabelClass}>Kota toko</span>
                      <input
                        value={form.storeCity}
                        onChange={event =>
                          setField('storeCity', event.target.value)
                        }
                        maxLength={64}
                        placeholder="Jakarta"
                        className={inputClass}
                      />
                    </label>

                    <label>
                      <span className={fieldLabelClass}>Nama produk</span>
                      <input
                        value={form.productName}
                        onChange={event =>
                          setField('productName', event.target.value)
                        }
                        maxLength={90}
                        placeholder="Opsional"
                        className={inputClass}
                      />
                    </label>

                    <label>
                      <span className={fieldLabelClass}>Harga</span>
                      <input
                        value={form.productPrice}
                        onChange={event =>
                          setField('productPrice', event.target.value)
                        }
                        maxLength={60}
                        placeholder="Rp 75.000"
                        className={inputClass}
                      />
                    </label>

                    <label className="sm:col-span-2">
                      <span className={fieldLabelClass}>Link produk</span>
                      <input
                        value={form.productHref}
                        onChange={event =>
                          setField('productHref', event.target.value)
                        }
                        placeholder="/id/content/... atau /home?product=..."
                        className={inputClass}
                      />
                    </label>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className={cn(
            'border-t border-white/10 p-3.5',
            step === 'media' && 'hidden',
          )}
        >
          <div className="flex items-center gap-2">
            {step !== 'media' && (
              <button
                type="button"
                onClick={() => setStep(step === 'post' ? 'edit' : 'media')}
                className="h-11 rounded-full border border-white/14 px-4 text-sm font-black text-white"
              >
                Kembali
              </button>
            )}

            {step !== 'post' ? (
              <button
                type="button"
                onClick={goNext}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-black text-white shadow-lg shadow-emerald-700/20"
              >
                Lanjut
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-black text-white shadow-lg shadow-emerald-700/20 disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting
                  ? 'Mengirim...'
                  : form.captureMode === 'live'
                    ? 'Jadwalkan live'
                    : 'Publish reels'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function AuthPromptSheet({
  message,
  loginHref,
  locale,
  onClose,
}: {
  message: string | null;
  loginHref: string;
  locale: string;
  onClose: () => void;
}) {
  if (!message) return null;

  return (
    <div className="ui-layer-modal fixed inset-0 flex items-end bg-black/65 text-slate-950 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0"
      />
      <section className="relative w-full rounded-t-[28px] bg-white p-4 shadow-2xl sm:max-w-[420px] sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">
              Perlu akun
            </p>
            <h2 className="mt-1 text-xl font-black">Masuk dulu</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
          {message}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href={`/${locale}/register`}
            className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-black text-slate-800"
          >
            Daftar
          </Link>
          <Link
            href={loginHref}
            className="rounded-2xl bg-emerald-700 px-4 py-3 text-center text-sm font-black text-white"
          >
            Masuk
          </Link>
        </div>
      </section>
    </div>
  );
}

/* =========================
   LOADING
========================= */

function LoadingToast({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (!loading && !error) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950 shadow-xl">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat reels...
          </>
        ) : (
          <>
            <span>{error}</span>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full bg-slate-950 px-3 py-1 text-white"
            >
              Coba
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* =========================
   UTILS
========================= */

function localizedHref(locale: string, href: string) {
  const value = href.trim() || '/home';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith(`/${locale}/`) || value === `/${locale}`) return value;
  if (value.startsWith('/')) return `/${locale}${value}`;
  return `/${locale}/${value}`;
}

function appendQuery(href: string, key: string, value: string) {
  if (/^https?:\/\//i.test(href)) {
    const url = new URL(href);
    url.searchParams.set(key, value);
    return url.toString();
  }

  const [path, hash = ''] = href.split('#');
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash ? `#${hash}` : ''
    }`;
}

function formatCommentTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Baru saja';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Baru saja';
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isImageMediaUrl(value: string) {
  const lower = value.split('?')[0]?.toLowerCase() || '';
  return /\.(avif|gif|jpe?g|png|webp)$/.test(lower);
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}
