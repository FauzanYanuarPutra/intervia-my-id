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
  type UIEvent,
} from 'react';
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll';
import {
  ArrowLeft,
  Bookmark,
  Box,
  BriefcaseBusiness,
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
  Volume2,
  VolumeX,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/system/feedback/ToastProvider';
import { prepareUploadFile } from '@/lib/media/prepareUploadMedia';
import {
  MEDIA_UPLOAD_RAW_MAX_BYTES,
  MEDIA_UPLOAD_RAW_MAX_MB,
} from '@/lib/media/uploadStandard';
import { getUserMediaErrorName } from '@/lib/mediaDevices';
import {
  DEFAULT_REELS_PERFORMANCE_PROFILE,
  buildReelsCameraConstraints,
  getReelsRecordingExtension,
  needsReelsCanvasPipeline,
  readReelsPerformanceProfile,
  selectReelsRecorderMimeType,
  type ReelsPerformanceProfile,
} from '@/lib/reels/performance';
import {
  boostReelPreferenceProfile as boostProfile,
  createEmptyReelPreferenceProfile as emptyProfile,
  formatCompactReelMetric as formatCompactMetric,
  getReelMetricCount as metricCount,
  getReelPreferenceTokens as reelTokens,
  getTopReelPreferenceTerms as topProfileTerms,
  rankReelsByPreference as rankItems,
  readReelPreferenceProfile as readProfile,
  readReelsMutedPreference as readInitialMuted,
  scoreReelPreference as scoreReel,
  tokenizeReelText as tokenize,
  writeReelPreferenceProfile as writeProfile,
  writeReelsMutedPreference as writeSoundPreference,
  type ReelPreferenceProfile as PreferenceProfile,
} from '@/lib/reels/preferences';
import {
  appendHrefQuery as appendQuery,
  buildLocalizedHref as localizedHref,
  formatReelCommentTime as formatCommentTime,
  isDirectReelVideoUrl as isDirectVideoMediaUrl,
  isReelImageUrl as isImageMediaUrl,
} from '@/lib/reels/presentation';
import { PROFILE_SOCIAL_STORAGE_KEY } from '@/components/profile/profile-hub/services/profileStorage.service';
import {
  mapDiscoverUserToSocialUser,
  mergeSocialUsers,
} from '@/components/profile/profile-hub/services/profileSocial.service';
import {
  normalizePlayableReel,
  normalizePlayableReels,
  REELS_PAGE_SIZE,
  isVideoReel,
  type LajukanReel,
  type ReelsPageResult,
} from '../../_data/reels';
import type { InboxNotification } from '@/context/NotificationInboxContext';
import type {
  DiscoverUser,
  SocialUser,
} from '@/components/profile/profile-hub/types/profileSocial';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import { buildPublicProfileHref } from '@/lib/profile/publicProfileLink';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
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

const iconMap: Partial<Record<LajukanReel['iconKey'] | string, LucideIcon>> = {
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
};

type UploadReelStep = 'media' | 'edit' | 'post';

type ReelsFeedTab = 'fyp' | 'friends' | 'following';

type ReelsStudioMode = 'gallery' | 'photo' | 'video' | 'link' | 'live';
type ReelsStudioPanel =
  | 'filters'
  | 'effects'
  | 'music'
  | 'speed'
  | 'link'
  | null;
type ReelsStudioSpeed = (typeof REELS_STUDIO_SPEEDS)[number];
type ReelsStudioDuration = (typeof REELS_STUDIO_DURATIONS)[number];
type ReelsStudioEffect =
  | 'none'
  | 'clean'
  | 'product'
  | 'focus'
  | 'scan'
  | 'dog'
  | 'grain';
type ReelsStudioFacingMode = 'environment' | 'user';

type ShareSheetRecipient = SocialUser & {
  source: 'creator' | 'following' | 'suggested';
  linked: boolean;
};

type NotificationData = Record<string, unknown>;

const REELS_SNAP_LOCK_MS = 520;
const REELS_AUTO_SCROLL_MS = 11000;
const REELS_FEED_REQUEST_TIMEOUT_MS = 8_000;
const REEL_SLIDE_LOADED_STYLE: CSSProperties = {
  contentVisibility: 'visible',
};
const REEL_SLIDE_PLACEHOLDER_STYLE: CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: '430px var(--app-visual-viewport-height)',
};
function normalizeRecipientName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function readNotificationData(
  notification: InboxNotification,
): NotificationData {
  const data = notification.data;
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as NotificationData)
    : {};
}

function readNotificationDataText(
  notification: InboxNotification,
  keys: string[],
): string {
  const data = readNotificationData(notification);
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return '';
}

function readNotificationEventName(notification: InboxNotification): string {
  const fromData = readNotificationDataText(notification, [
    'event_name',
    'action',
  ]);
  if (fromData) return fromData;

  const value = notification.event_type;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

function readNotificationEntityType(notification: InboxNotification): string {
  return readNotificationDataText(notification, ['entity_type', 'entityType']);
}

function readNotificationEntityId(notification: InboxNotification): string {
  return readNotificationDataText(notification, ['entity_id', 'entityId']);
}

function readNotificationTargetHref(notification: InboxNotification): string {
  return readNotificationDataText(notification, [
    'href',
    'target_href',
    'target_url',
    'content_url',
    'url',
    'action_url',
    'actionHref',
  ]);
}

function resolveNotificationReelId(notification: InboxNotification): string {
  const directEntityId = readNotificationEntityId(notification);
  if (directEntityId) return directEntityId;

  const directHref = readNotificationTargetHref(notification);
  if (!directHref) return '';

  try {
    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost';
    const parsed = new URL(directHref, base);
    const queryReel = parsed.searchParams.get('reel')?.trim();
    if (queryReel) return queryReel;
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts[0] === 'reels' && pathParts[1]?.trim()) {
      return pathParts[1].trim();
    }
    return '';
  } catch {
    const match = directHref.match(/[?&]reel=([^&#]+)/i);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]).trim();
      } catch {
        return match[1].trim();
      }
    }
    return '';
  }
}

function isReelCommentNotification(notification: InboxNotification): boolean {
  const eventName = readNotificationEventName(notification).toLowerCase();
  const entityType = readNotificationEntityType(notification).toLowerCase();
  const text = [
    notification.category,
    notification.event_type,
    notification.title,
    notification.message,
    eventName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (eventName === 'reels.commented' || eventName === 'reels.replied') {
    return true;
  }

  if (entityType === 'reel' || entityType === 'reels') {
    return (
      text.includes('comment') ||
      text.includes('reply') ||
      text.includes('reels.')
    );
  }

  return false;
}

function resolveCommunityDirectBaseUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_COMMUNITY_URL?.trim();
  if (!base) return null;
  return base.replace(/\/$/, '');
}

function buildCommunityReelCommentsUrl(
  reelId: string,
  cursor: number,
): string | null {
  const base = resolveCommunityDirectBaseUrl();
  if (!base) return null;

  try {
    const url = new URL(
      `/v1/reels/${encodeURIComponent(reelId)}/comments`,
      base.endsWith('/') ? base : `${base}/`,
    );
    url.searchParams.set('cursor', String(cursor));
    url.searchParams.set('limit', '20');
    return url.toString();
  } catch {
    return null;
  }
}

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
};

const REELS_VIDEO_EXTENSIONS = /\.(m4v|mov|mp4|webm)$/i;

function isPlayableReelsVideoFile(file: File) {
  return (
    file.type.startsWith('video/') || REELS_VIDEO_EXTENSIONS.test(file.name)
  );
}

function buildCleanReelTitleFromFile(file: File) {
  const cleaned = file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Video usaha';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1, 90);
}

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
    id: 'link',
    label: 'Link',
    helper: 'Video URL',
    icon: Link2,
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
    id: 'dog',
    label: 'Dog',
    helper: 'kuping + hidung',
    swatch:
      'bg-[radial-gradient(circle_at_30%_18%,#92400e_0_18%,transparent_19%),radial-gradient(circle_at_70%_18%,#92400e_0_18%,transparent_19%),radial-gradient(circle_at_50%_58%,#111827_0_16%,transparent_17%),#fef3c7]',
  },
  {
    id: 'grain',
    label: 'Grain',
    helper: 'tekstur halus',
    swatch:
      'bg-[radial-gradient(circle_at_30%_20%,#fef3c7,transparent_24%),radial-gradient(circle_at_70%_64%,#e879f9,transparent_22%),#111827]',
  },
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

type VideoFramePumpElement = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

function startVideoFramePump(
  video: HTMLVideoElement,
  fps: number,
  paintFrame: () => void,
): () => void {
  const targetFrameDuration = 1000 / Math.max(1, fps);
  const frameVideo = video as VideoFramePumpElement;

  if (frameVideo.requestVideoFrameCallback) {
    let stopped = false;
    let frameHandle = 0;
    let lastPaintedAt = 0;
    const tick = (now: number) => {
      if (stopped) return;
      if (now - lastPaintedAt >= targetFrameDuration - 2) {
        lastPaintedAt = now;
        paintFrame();
      }
      frameHandle = frameVideo.requestVideoFrameCallback!(tick);
    };
    frameHandle = frameVideo.requestVideoFrameCallback(tick);
    return () => {
      stopped = true;
      frameVideo.cancelVideoFrameCallback?.(frameHandle);
    };
  }

  const interval = window.setInterval(
    paintFrame,
    Math.max(Math.round(targetFrameDuration), 20),
  );
  return () => window.clearInterval(interval);
}

function getReelsCameraErrorMessage(error: unknown, locale: string): string {
  const isId = locale === 'id';
  const name = getUserMediaErrorName(error);

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return isId
      ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi.'
      : 'Camera permission was denied. Allow it in browser settings, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return isId
      ? 'Kamera tidak ditemukan di perangkat ini. Kamu masih bisa pilih video dari galeri.'
      : 'No camera was found. You can still choose a video from the gallery.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return isId
      ? 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.'
      : 'The camera is being used by another app. Close it and try again.';
  }
  return isId
    ? 'Kamera belum bisa dibuka. Coba lagi atau pilih video dari galeri.'
    : 'The camera could not be opened. Try again or choose a gallery video.';
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
  } else if (effect === 'dog') {
    context.fillStyle = 'rgba(120,53,15,0.92)';
    context.beginPath();
    context.ellipse(
      width * 0.3,
      height * 0.14,
      width * 0.09,
      height * 0.055,
      -0.62,
      0,
      Math.PI * 2,
    );
    context.ellipse(
      width * 0.7,
      height * 0.14,
      width * 0.09,
      height * 0.055,
      0.62,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.fillStyle = 'rgba(254,243,199,0.96)';
    context.beginPath();
    context.ellipse(
      width * 0.3,
      height * 0.145,
      width * 0.044,
      height * 0.026,
      -0.62,
      0,
      Math.PI * 2,
    );
    context.ellipse(
      width * 0.7,
      height * 0.145,
      width * 0.044,
      height * 0.026,
      0.62,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.fillStyle = 'rgba(17,24,39,0.92)';
    context.beginPath();
    context.ellipse(
      width * 0.5,
      height * 0.41,
      width * 0.045,
      height * 0.026,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.strokeStyle = 'rgba(17,24,39,0.6)';
    context.lineWidth = Math.max(2, width * 0.004);
    [-1, 1].forEach(side => {
      for (let offset = -1; offset <= 1; offset += 1) {
        context.beginPath();
        context.moveTo(
          width * 0.5 + side * width * 0.052,
          height * (0.425 + offset * 0.01),
        );
        context.lineTo(
          width * 0.5 + side * width * 0.17,
          height * (0.41 + offset * 0.026),
        );
        context.stroke();
      }
    });
    context.fillStyle = 'rgba(244,63,94,0.82)';
    context.beginPath();
    context.roundRect(
      width * 0.474,
      height * 0.443,
      width * 0.052,
      height * 0.05,
      width * 0.026,
    );
    context.fill();
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

function readReelMetadataNumber(reel: LajukanReel, ...keys: string[]): number {
  const metadata = reel.metadata;
  if (!metadata) return 0;

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, value);
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return Math.max(0, parsed);
    }
  }

  return 0;
}

function getReelCreatorStats(reel: LajukanReel) {
  return {
    followers: readReelMetadataNumber(
      reel,
      'creator_followers_count',
      'followers_count',
      'followersCount',
    ),
    following: readReelMetadataNumber(
      reel,
      'creator_following_count',
      'following_count',
      'followingCount',
    ),
    reels: readReelMetadataNumber(
      reel,
      'creator_reels_count',
      'reels_count',
      'reelsCount',
    ),
  };
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
    readProfileAvatarStyle(reel),
    reel.creator,
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
  const { notify } = useToast();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const rafRef = useRef<number | null>(null);
  const loadingRef = useRef(false);
  const firstScrollDoneRef = useRef(false);
  const scrollLockRef = useRef(false);
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
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PreferenceProfile>(() =>
    emptyProfile(),
  );

  const [activeIndex, setActiveIndex] = useState(safeInitialIndex);
  const [searchContextQuery, setSearchContextQuery] = useState(
    initialSearchQuery.trim(),
  );
  const [muted, setMuted] = useState(() => readInitialMuted());
  const [soundUnlocked, setSoundUnlocked] = useState(() => !readInitialMuted());
  const [pausedByUser, setPausedByUser] = useState(false);
  const [autoScroll] = useState(false);
  const [bufferingId, setBufferingId] = useState<string | null>(null);
  const [pageVisible, setPageVisible] = useState(true);
  const [performanceProfile, setPerformanceProfile] =
    useState<ReelsPerformanceProfile>(DEFAULT_REELS_PERFORMANCE_PROFILE);

  const [searchOpen, setSearchOpen] = useState(Boolean(initialSearchQuery));
  const [searchSeed, setSearchSeed] = useState(initialSearchQuery);
  const [detailReel, setDetailReel] = useState<LajukanReel | null>(null);
  const [productReel, setProductReel] = useState<LajukanReel | null>(null);
  const [commentsReel, setCommentsReel] = useState<LajukanReel | null>(null);
  const [shareReel, setShareReel] = useState<LajukanReel | null>(null);
  const [actionsReel, setActionsReel] = useState<LajukanReel | null>(null);
  const [creatorProfileReel, setCreatorProfileReel] =
    useState<LajukanReel | null>(null);
  const [commentsByReel, setCommentsByReel] = useState<
    Record<string, ReelCommentsBucket>
  >({});
  const commentsByReelRef = useRef<Record<string, ReelCommentsBucket>>({});
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

  useEffect(() => {
    commentsByReelRef.current = commentsByReel;
  }, [commentsByReel]);

  useEffect(() => {
    const updateProfile = () =>
      setPerformanceProfile(readReelsPerformanceProfile());
    const connection = (
      navigator as Navigator & {
        connection?: {
          addEventListener?: (type: string, listener: () => void) => void;
          removeEventListener?: (type: string, listener: () => void) => void;
        };
      }
    ).connection;

    updateProfile();
    window.addEventListener('resize', updateProfile, { passive: true });
    connection?.addEventListener?.('change', updateProfile);

    return () => {
      window.removeEventListener('resize', updateProfile);
      connection?.removeEventListener?.('change', updateProfile);
    };
  }, []);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () =>
      document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  const overlayOpen =
    searchOpen ||
    detailReel !== null ||
    productReel !== null ||
    commentsReel !== null ||
    shareReel !== null ||
    actionsReel !== null ||
    creatorProfileReel !== null ||
    uploadOpen ||
    authPrompt !== null;

  const playVideoWithPolicyFallback = useCallback(
    async (video: HTMLVideoElement) => {
      video.playsInline = true;
      if (video.readyState === HTMLMediaElement.HAVE_NOTHING) {
        video.load();
      }

      try {
        await video.play();
        return true;
      } catch {
        if (!video.muted) {
          video.muted = true;
          video.defaultMuted = true;
          video.volume = 0;
          setMuted(true);
          setSoundUnlocked(false);
          writeSoundPreference(true);

          try {
            await video.play();
            return true;
          } catch {
            return false;
          }
        }

        return false;
      }
    },
    [],
  );

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
    if (!isVideoReel(safeNextReel)) return;

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

      if (
        signal === 'detail' &&
        user?.id &&
        reel.creatorUserId &&
        reel.creatorUserId !== user.id
      ) {
        void trackLajukanEvent('reels.viewed', {
          entityType: 'reel',
          entityId: reel.id,
          page: `/reels?reel=${encodeURIComponent(reel.id)}`,
          properties: {
            target_user_id: reel.creatorUserId,
            target_username: reel.creator,
            target_name: reel.creator,
            target_href: `/reels?reel=${encodeURIComponent(reel.id)}`,
            entity_label: reel.title,
            actor_user_id: user.id,
            actor_username: user.username || '',
            actor_name: user.name || user.fullName || user.username || '',
            actor_avatar_url: user.avatarUrl || user.avatar_url || '',
            source: 'reels',
          },
        });
      }

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
    [
      authFetch,
      isAuthenticated,
      replaceReel,
      user?.avatarUrl,
      user?.avatar_url,
      user?.fullName,
      user?.id,
      user?.name,
      user?.username,
    ],
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
      } catch {}
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
        if (
          nextActive &&
          action === 'like' &&
          reel.creatorUserId &&
          user?.id &&
          reel.creatorUserId !== user.id
        ) {
          void trackLajukanEvent('reels.liked', {
            entityType: 'reel',
            entityId: reel.id,
            page: `/reels?reel=${encodeURIComponent(reel.id)}`,
            properties: {
              target_user_id: reel.creatorUserId,
              target_username: reel.creator,
              target_name: reel.creator,
              target_href: `/reels?reel=${encodeURIComponent(reel.id)}`,
              entity_label: reel.title,
              actor_user_id: user.id,
              actor_username: user.username || '',
              actor_name: user.name || user.fullName || user.username || '',
              actor_avatar_url: user.avatarUrl || user.avatar_url || '',
              source: 'reels',
            },
          });
        }
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
    [
      actionsByReel,
      authFetch,
      isAuthenticated,
      replaceReel,
      user?.avatarUrl,
      user?.avatar_url,
      user?.fullName,
      user?.id,
      user?.name,
      user?.username,
    ],
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
    const requestController = new AbortController();
    const requestTimeout = window.setTimeout(
      () => requestController.abort(),
      REELS_FEED_REQUEST_TIMEOUT_MS,
    );

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
        signal: requestController.signal,
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
      setLoadError(
        locale === 'id'
          ? 'Gagal memuat video. Coba lagi.'
          : 'Unable to load videos. Please retry.',
      );
    } finally {
      window.clearTimeout(requestTimeout);
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [cursor, hasMore, initialSearchQuery, locale, profile]);

  const loadComments = useCallback(async (reelId: string, reset = false) => {
    const current = commentsByReelRef.current[reelId];
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
      const requestOptions = {
        cache: 'no-store' as const,
        headers: { Accept: 'application/json' },
      };
      let response = await fetch(
        `/api/reels/${encodeURIComponent(reelId)}/comments?${params.toString()}`,
        requestOptions,
      );
      let payload = (await response.json().catch(() => ({}))) as {
        items?: ReelComment[];
        nextCursor?: number | null;
        hasMore?: boolean;
        error?: string;
      };

      if (!response.ok || !Array.isArray(payload.items)) {
        const fallbackUrl = buildCommunityReelCommentsUrl(reelId, cursorValue);
        if (fallbackUrl) {
          response = await fetch(fallbackUrl, requestOptions);
          payload = (await response.json().catch(() => ({}))) as {
            items?: ReelComment[];
            nextCursor?: number | null;
            hasMore?: boolean;
            error?: string;
          };
        }
      }

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
              error instanceof Error ? error.message : 'Gagal memuat komentar',
          },
        };
      });
    }
  }, []);

  const refreshReelFromServer = useCallback(
    async (reelId: string) => {
      const cleanReelId = String(reelId || '').trim();
      if (!cleanReelId) return;

      try {
        const response = await fetch(
          `/api/reels/${encodeURIComponent(cleanReelId)}`,
          { cache: 'no-store' },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          reel?: LajukanReel | null;
        };
        if (!response.ok || !payload.reel) return;
        replaceReel(payload.reel);
      } catch {
        // Ignore realtime refresh errors. The local UI stays usable.
      }
    },
    [replaceReel],
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

  const startChatWithUser = useCallback(
    async (
      peerUserId: string | null | undefined,
      reel: LajukanReel,
      sourceComment?: ReelComment | null,
    ) => {
      if (!isAuthenticated) {
        setAuthPrompt('Masuk dulu untuk chat pembuat reels ini.');
        return;
      }

      const targetUserId = peerUserId?.trim();
      if (!targetUserId) {
        setAuthPrompt(
          'Creator reels ini belum terhubung ke akun chat. Coba reels yang dibuat user login.',
        );
        return;
      }
      if (user?.id && targetUserId === user.id) {
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
            peer_user_id: targetUserId,
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

  const startChatFromReel = useCallback(
    (reel: LajukanReel, sourceComment?: ReelComment | null) =>
      void startChatWithUser(reel.creatorUserId, reel, sourceComment),
    [startChatWithUser],
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
      const requestBody = JSON.stringify({
        content: body,
        replyToPostId: replyTarget?.id,
      });
      const requestOptions: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      };

      let response = await authFetch(
        `/api/reels/${encodeURIComponent(commentsReel.id)}/comments`,
        requestOptions,
      );
      let payload = (await response.json().catch(() => ({}))) as {
        comment?: ReelComment;
        reel?: LajukanReel;
        error?: string;
      };

      if (!response.ok || !payload.comment) {
        const fallbackUrl = buildCommunityReelCommentsUrl(commentsReel.id, 0);
        if (fallbackUrl) {
          response = await authFetch(fallbackUrl, requestOptions);
          payload = (await response.json().catch(() => ({}))) as {
            comment?: ReelComment;
            reel?: LajukanReel;
            error?: string;
          };
        }
      }

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
      if (
        commentsReel.creatorUserId &&
        user?.id &&
        commentsReel.creatorUserId !== user.id
      ) {
        void trackLajukanEvent(
          Boolean(replyTarget?.id) ? 'reels.replied' : 'reels.commented',
          {
            entityType: 'reel',
            entityId: commentsReel.id,
            page: `/reels?reel=${encodeURIComponent(commentsReel.id)}`,
            properties: {
              target_user_id: commentsReel.creatorUserId,
              target_username: commentsReel.creator,
              target_name: commentsReel.creator,
              target_href: `/reels?reel=${encodeURIComponent(commentsReel.id)}`,
              entity_label: commentsReel.title,
              actor_user_id: user.id,
              actor_username: user.username || '',
              actor_name: user.name || user.fullName || user.username || '',
              actor_avatar_url: user.avatarUrl || user.avatar_url || '',
              source: 'reels',
            },
          },
        );
      }
      notify({
        title: locale === 'id' ? 'Komentar terkirim' : 'Comment posted',
        description:
          locale === 'id'
            ? 'Komentar kamu sudah masuk dan akan ikut update realtime.'
            : 'Your comment is live and will stay in sync in realtime.',
        variant: 'success',
      });
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
      notify({
        title: locale === 'id' ? 'Komentar gagal' : 'Comment failed',
        description:
          error instanceof Error
            ? error.message
            : locale === 'id'
              ? 'Coba lagi beberapa saat.'
              : 'Please try again in a moment.',
        variant: 'error',
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
    notify,
    locale,
    user?.avatarUrl,
    user?.avatar_url,
    user?.fullName,
    user?.id,
    user?.name,
    user?.username,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onMarketplaceNotification = (event: Event) => {
      const detail = (event as CustomEvent<InboxNotification>).detail;
      if (!detail || !isReelCommentNotification(detail)) return;

      const reelId = resolveNotificationReelId(detail);
      if (!reelId) return;

      void refreshReelFromServer(reelId);

      if (commentsReel?.id === reelId) {
        void loadComments(reelId, true);
      }
    };

    window.addEventListener(
      'marketplace:notification',
      onMarketplaceNotification as EventListener,
    );

    return () => {
      window.removeEventListener(
        'marketplace:notification',
        onMarketplaceNotification as EventListener,
      );
    };
  }, [commentsReel?.id, loadComments, refreshReelFromServer]);

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

  const handleReelCreated = useCallback(
    (reel: LajukanReel) => {
      if (!isVideoReel(reel)) {
        notify({
          title: locale === 'id' ? 'Reels butuh video' : 'Reels need video',
          description:
            locale === 'id'
              ? 'Upload tersimpan, tapi feed Reels hanya menampilkan video.'
              : 'The upload was saved, but the Reels feed only shows videos.',
          variant: 'info',
        });
        return;
      }

      setItems(current => [
        reel,
        ...current.filter(item => item.id !== reel.id),
      ]);
      setActiveIndex(0);
      setPausedByUser(false);
      setUploadOpen(false);
      window.requestAnimationFrame(() => {
        containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    },
    [locale, notify],
  );

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
    if (!activeReel || overlayOpen || !pageVisible) return;

    const timer = window.setTimeout(() => {
      recordSignal(activeReel, 'watch');
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [activeReel, overlayOpen, pageVisible, recordSignal]);

  useEffect(() => {
    if (
      !autoScroll ||
      overlayOpen ||
      pausedByUser ||
      !pageVisible ||
      items.length <= 1
    )
      return;

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
    pageVisible,
    pausedByUser,
    scrollToIndex,
  ]);

  useEffect(() => {
    setPausedByUser(false);
    setBufferingId(null);
    setPlaybackError(null);
  }, [activeIndex]);

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([reelId, video]) => {
      if (!video) return;

      video.muted = muted;
      video.volume = muted ? 0 : 1;

      const isActiveVideo = reelId === activeReelId;

      if (!pageVisible || overlayOpen || !isActiveVideo || pausedByUser) {
        video.pause();
        return;
      }

      if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        setBufferingId(reelId);
      }

      void playVideoWithPolicyFallback(video).then(played => {
        if (reelId !== activeReelId) return;
        if (played) {
          setBufferingId(current => (current === reelId ? null : current));
          setPlaybackError(null);
        } else if (video.error) {
          setBufferingId(current => (current === reelId ? null : current));
          setPlaybackError(
            locale === 'id'
              ? 'Video belum bisa diputar. Periksa koneksi lalu coba lagi.'
              : 'The video cannot play yet. Check your connection and retry.',
          );
        }
      });
    });
  }, [
    activeReelId,
    locale,
    muted,
    overlayOpen,
    pageVisible,
    pausedByUser,
    playVideoWithPolicyFallback,
  ]);

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
      setPausedByUser(false);
      void playVideoWithPolicyFallback(video);
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
      setPausedByUser(false);
      void playVideoWithPolicyFallback(video);
    }
  }

  function retryCurrentVideo() {
    if (!playbackError || !activeReel) {
      void loadMore();
      return;
    }

    const video = videoRefs.current[activeReel.id];
    setPlaybackError(null);
    setBufferingId(activeReel.id);
    setPausedByUser(false);
    video?.load();
    if (video) {
      void playVideoWithPolicyFallback(video).then(played => {
        setBufferingId(null);
        if (!played) {
          setPlaybackError(
            locale === 'id'
              ? 'Video belum bisa diputar. Periksa koneksi lalu coba lagi.'
              : 'The video cannot play yet. Check your connection and retry.',
          );
        }
      });
    }
  }

  const openSearchOverlay = (seed = activeSearchQuery) => {
    setSearchSeed(seed);
    setSearchOpen(true);
  };

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
    <main
      className="ui-layer-header fixed inset-x-0 top-[var(--app-viewport-offset-top)] isolate h-[var(--app-visual-viewport-height)] max-h-[var(--app-visual-viewport-height)] min-h-0 overflow-hidden bg-[#090909] text-white"
      data-reels-performance={performanceProfile.tier}
    >
      <div className="relative h-full min-h-0 w-full overflow-hidden bg-[#090909]">
        <div className="relative h-full min-h-0 min-w-0 overflow-hidden bg-[#090909]">
          <div className="relative mx-auto h-full min-h-0 w-full max-w-[520px] overflow-hidden bg-black shadow-[0_0_70px_rgba(0,0,0,0.38)] sm:border-x sm:border-white/10">
            <ReelsTopBar
              locale={locale}
              searchQuery={activeSearchQuery}
              onOpenSearch={() => openSearchOverlay(activeSearchQuery)}
              onOpenUpload={requestUpload}
            />

            <div
              ref={containerRef}
              onScroll={handleScroll}
              onKeyDown={handleReelsKeyDown}
              tabIndex={0}
              className="h-full min-h-0 max-h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth outline-none motion-reduce:scroll-auto [scrollbar-width:none] [touch-action:pan-y] [&::-webkit-scrollbar]:hidden"
            >
              {items.length > 0 ? (
                <>
                  {items.map((reel, index) => (
                    <ReelSlide
                      key={reel.id}
                      locale={locale}
                      reel={reel}
                      active={index === activeIndex && pageVisible}
                      shouldLoad={
                        Math.abs(index - activeIndex) <=
                        performanceProfile.renderWindow
                      }
                      performanceProfile={performanceProfile}
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
                        if (index === activeIndex) setPlaybackError(null);
                      }}
                      onError={() => {
                        if (index === activeIndex) setBufferingId(null);
                        if (index === activeIndex) {
                          setPlaybackError(
                            locale === 'id'
                              ? 'Video belum bisa diputar. Periksa koneksi lalu coba lagi.'
                              : 'The video cannot play yet. Check your connection and retry.',
                          );
                        }
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
              locale={locale}
              loading={loadingMore}
              error={playbackError || loadError}
              onRetry={retryCurrentVideo}
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
          onOpenCreatorProfile={reel => setCreatorProfileReel(reel)}
          onMessageCreator={reel => void startChatFromReel(reel)}
          chatBusyReelId={chatBusyReelId}
          onClose={() => setDetailReel(null)}
        />

        <CreatorProfileSheet
          locale={locale}
          reel={creatorProfileReel}
          actionState={
            creatorProfileReel
              ? actionsByReel[creatorProfileReel.id] || EMPTY_REEL_ACTION_STATE
              : EMPTY_REEL_ACTION_STATE
          }
          chatBusy={chatBusyReelId === creatorProfileReel?.id}
          onAction={(reel, action, active) =>
            void handleReelAction(reel, action, active)
          }
          onMessageCreator={reel => void startChatFromReel(reel)}
          onOpenComments={reel => openComments(reel)}
          onClose={() => setCreatorProfileReel(null)}
        />

        <CommentsSheet
          locale={locale}
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
          onMessageUser={(userId, reel) => void startChatWithUser(userId, reel)}
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
          performanceProfile={performanceProfile}
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
          <p className="truncate text-base font-bold">Lajukan</p>
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
          className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-white/72 transition hover:bg-white/8 hover:text-white"
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
                <span className="block truncate text-sm font-bold">
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
          className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-white/72 transition hover:bg-white/8 hover:text-white"
        >
          <MessageCircle className="h-5 w-5" />
          Komunitas
        </Link>

        <Link
          href={`/${locale}/manage/reels`}
          className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-white/72 transition hover:bg-white/8 hover:text-white"
        >
          <SlidersHorizontal className="h-5 w-5" />
          Manage Reels
        </Link>
      </nav>

      <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-2 text-sm font-bold">
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
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-400 px-4 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-400/15 transition active:scale-[0.98]"
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
              <p className="truncate text-sm font-bold">{displayName}</p>
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
  onOpenCreatorProfile,
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
  onOpenCreatorProfile: () => void;
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
            <p className="mt-4 text-sm font-bold">Reels siap diputar</p>
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
  const creatorStats = getReelCreatorStats(reel);
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
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-300">
              Sekarang diputar
            </p>
            <h2 className="mt-1 truncate text-lg font-bold">{reel.title}</h2>
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
          <div className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-bold ">
            {reel.tag}
          </div>
          {liveLabel && (
            <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg shadow-rose-950/20">
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
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/18 ">
              <Play className="h-5 w-5 fill-white" />
            </span>
          </button>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenCreatorProfile}
              className="shrink-0 rounded-full bg-white/14 p-0.5 ring-1 ring-white/18 transition active:scale-95"
              aria-label={`Lihat profil ${reel.creator}`}
            >
              <ReelCreatorAvatar reel={reel} className="h-10 w-10" size={40} />
            </button>
            <div className="min-w-0 flex-1">
              <Link
                href={profileHref}
                className="block truncate text-sm font-bold text-white underline-offset-4 transition hover:underline"
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
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-slate-950 transition active:scale-[0.98] disabled:opacity-60"
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
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition active:scale-[0.98] disabled:opacity-60',
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

          <div className="mt-3 grid grid-cols-3 gap-2">
            <CreatorStatCell
              label="Followers"
              value={formatCompactMetric(creatorStats.followers)}
            />
            <CreatorStatCell
              label="Following"
              value={formatCompactMetric(creatorStats.following)}
            />
            <CreatorStatCell
              label="Reels"
              value={formatCompactMetric(creatorStats.reels)}
            />
          </div>

          <p className="mt-3 line-clamp-4 text-sm font-medium leading-relaxed text-white/72">
            {reel.caption}
          </p>

          <button
            type="button"
            onClick={onOpenDetail}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white/80 transition hover:bg-white/14 hover:text-white"
          >
            Buka detail penuh
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-[18px] bg-white/[0.06] p-3 text-center ring-1 ring-white/10">
            <p className="text-sm font-bold">
              {formatCompactMetric(metricCount(reel, 'likes'))}
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-white/42">Like</p>
          </div>
          <div className="rounded-[18px] bg-white/[0.06] p-3 text-center ring-1 ring-white/10">
            <p className="text-sm font-bold">
              {formatCompactMetric(metricCount(reel, 'comments'))}
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-white/42">
              Komentar
            </p>
          </div>
          <div className="rounded-[18px] bg-white/[0.06] p-3 text-center ring-1 ring-white/10">
            <p className="text-sm font-bold">
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
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                  Produk terkait
                </p>
                <h3 className="mt-1 truncate text-sm font-bold">
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
                className="rounded-2xl bg-slate-950 px-3 py-2.5 text-xs font-bold text-white"
              >
                Detail
              </button>
              {productHref ? (
                <Link
                  href={productHref}
                  className="rounded-2xl bg-white px-3 py-2.5 text-center text-xs font-bold text-slate-950"
                >
                  Lihat produk
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onOpenProduct}
                  className="rounded-2xl bg-white px-3 py-2.5 text-xs font-bold text-slate-950"
                >
                  Lihat produk
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
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
                  'flex min-h-[48px] items-center justify-center gap-2 rounded-[18px] px-3 text-xs font-bold transition active:scale-[0.98]',
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
              <p className="text-sm font-bold">Komentar cepat</p>
              <p className="text-[11px] font-semibold text-white/42">
                {formatCompactMetric(metricCount(reel, 'comments'))} komentar
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenComments}
              className="rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-950"
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
                  <p className="truncate text-[11px] font-bold text-white/80">
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
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-[18px] bg-white text-xs font-bold text-slate-950"
          >
            <Camera className="h-4.5 w-4.5" />
            Buat
          </button>
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-[18px] bg-white/[0.07] text-xs font-bold text-white/78 ring-1 ring-white/10"
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
  searchQuery,
  onOpenSearch,
  onOpenUpload,
}: {
  locale: string;
  searchQuery: string;
  onOpenSearch: () => void;
  onOpenUpload: () => void;
}) {
  const router = useRouter();
  const isId = locale === 'id';
  const hasSearchContext = searchQuery.trim().length > 0;
  const handleBack = useAppBack(router, `/${locale}/home`);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-50 bg-gradient-to-b from-black/[0.78] via-black/[0.18] to-transparent px-2.5 pb-5 pt-[calc(env(safe-area-inset-top)+7px)] sm:px-3.5">
      <div className="pointer-events-auto grid h-10 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5">
        <button
          type="button"
          onClick={handleBack}
          aria-label={isId ? 'Kembali' : 'Back'}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.34] font-bold text-white ring-1 ring-white/[0.12] transition hover:bg-black/[0.52] active:scale-95"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>

        <div className="flex min-w-0 justify-center">
          {hasSearchContext ? (
            <button
              type="button"
              onClick={onOpenSearch}
              className="inline-flex h-9 min-w-0 max-w-full items-center gap-1.5 rounded-full bg-black/[0.34] px-3 text-left text-[11px] font-bold text-white/[0.92] ring-1 ring-white/[0.12] transition hover:bg-black/[0.52] active:scale-[0.98] sm:text-xs"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{searchQuery}</span>
            </button>
          ) : (
            <span className="inline-flex h-9 items-center border-b-2 border-white px-2 text-[13px] font-bold text-white">
              Reels
            </span>
          )}
        </div>

        <div className="flex h-10 shrink-0 items-center justify-end gap-1">
          <Link
            href={`/${locale}/manage/reels`}
            aria-label={isId ? 'Kelola Reels' : 'Manage Reels'}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/[0.34] text-white ring-1 ring-white/[0.12] transition hover:bg-black/[0.52] active:scale-95"
          >
            <SlidersHorizontal className="h-[17px] w-[17px]" />
          </Link>
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label={isId ? 'Cari Reels' : 'Search Reels'}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/[0.34] text-white ring-1 ring-white/[0.12] transition hover:bg-black/[0.52] active:scale-95"
          >
            <Search className="h-[17px] w-[17px]" />
          </button>
          <button
            type="button"
            onClick={onOpenUpload}
            aria-label={isId ? 'Buat Reels' : 'Create Reels'}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-slate-950 shadow-lg shadow-black/25 transition hover:bg-emerald-100 active:scale-95"
            data-testid="reels-create-button"
          >
            <Plus className="h-[18px] w-[18px] stroke-[2.8]" />
          </button>
        </div>
      </div>
    </header>
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
    <div className="flex h-[var(--app-visual-viewport-height)] max-h-[var(--app-visual-viewport-height)] min-h-[var(--app-visual-viewport-height)] snap-start snap-always items-center justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+4.5rem)] text-center">
      <div className="w-full max-w-[320px] rounded-[22px] border border-white/10 bg-white/[0.07] p-5 text-white shadow-[0_24px_58px_-36px_rgba(0,0,0,0.85)] ">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-950/20">
          <Clapperboard className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold leading-tight">
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
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-rose-500 px-4 text-sm font-bold text-white transition active:scale-[0.98]"
          >
            <Camera className="h-4.5 w-4.5" />
            {isId ? 'Buat Reels' : 'Create Reels'}
          </button>
          <button
            type="button"
            onClick={onSearch}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/12 bg-black/36 px-4 text-sm font-bold text-white transition active:scale-[0.98]"
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
    <article className="relative h-[var(--app-visual-viewport-height)] max-h-[var(--app-visual-viewport-height)] min-h-[var(--app-visual-viewport-height)] snap-start snap-always overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#f6f9f4_46%,#eef2ff_100%)] text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.6)_0%,rgba(255,255,255,0.16)_42%,rgba(255,255,255,0.38)_100%)]" />

      <div
        className="relative z-10 h-full overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-[calc(env(safe-area-inset-top)+76px)] [scrollbar-width:none] [touch-action:pan-y] [&::-webkit-scrollbar]:hidden"
        onWheel={event => event.stopPropagation()}
        onTouchStart={event => event.stopPropagation()}
        onTouchEnd={event => event.stopPropagation()}
      >
        <div className="mx-auto min-h-full w-full max-w-[380px] pb-8">
          <div className="flex items-start gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] bg-emerald-600 text-white shadow-xl shadow-emerald-950/18">
              <Check className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                {isId ? 'Feed selesai' : 'Feed complete'}
              </p>
              <h2 className="mt-1 text-[26px] font-bold leading-[1.05] tracking-[-0.03em] text-slate-950">
                {isId ? 'Kamu sudah sampai akhir' : 'You are all caught up'}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {isId
                  ? 'Lanjut dari sini: ulangi feed, cari topik lain, atau buat reels usaha baru.'
                  : 'Continue from here: restart the feed, search another topic, or create a new business reel.'}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.24)]">
              <p className="text-2xl font-bold text-slate-950">
                {totalCount.toLocaleString(locale)}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                {isId ? 'reels dimuat' : 'reels loaded'}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.24)]">
              <p className="text-2xl font-bold text-slate-950">
                {topicChips.length.toLocaleString(locale)}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                {isId ? 'topik lanjut' : 'next topics'}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.26)] transition hover:border-emerald-200 hover:text-emerald-700 active:scale-[0.98]"
            >
              <RefreshCcw className="h-4.5 w-4.5" />
              {isId ? 'Ulangi feed dari awal' : 'Restart feed'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSearch()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.22)] transition hover:border-emerald-200 hover:text-emerald-700 active:scale-[0.98]"
              >
                <Search className="h-4 w-4" />
                {isId ? 'Cari topik' : 'Search'}
              </button>
              <button
                type="button"
                onClick={onUpload}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] border border-emerald-200 bg-white px-3 text-xs font-bold text-slate-900 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.22)] transition hover:border-emerald-300 hover:text-emerald-700 active:scale-[0.98]"
              >
                <Camera className="h-4 w-4" />
                {isId ? 'Buat reels' : 'Create'}
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.24)]">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {isId ? 'Topik yang bisa dicari' : 'Topics to search'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {topicChips.map(topic => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => onSearch(topic)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.24)] transition hover:border-emerald-200 hover:text-emerald-700 active:scale-95"
                >
                  #{topic}
                </button>
              ))}
            </div>
          </div>

          <Link
            href={`/${locale}/home`}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 text-xs font-bold text-slate-900 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.26)] transition hover:border-emerald-200 hover:text-emerald-700 active:scale-[0.98]"
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

  if (effect === 'dog') {
    return (
      <div className="pointer-events-none absolute inset-0">
        <span className="absolute left-[21%] top-[8%] h-[12%] w-[18%] -rotate-[24deg] rounded-[55%_45%_58%_42%] bg-amber-900/92 shadow-[inset_0_-10px_18px_rgba(0,0,0,0.22),0_10px_24px_rgba(0,0,0,0.18)]">
          <span className="absolute left-1/2 top-1/2 h-[44%] w-[48%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/92" />
        </span>
        <span className="absolute right-[21%] top-[8%] h-[12%] w-[18%] rotate-[24deg] rounded-[45%_55%_42%_58%] bg-amber-900/92 shadow-[inset_0_-10px_18px_rgba(0,0,0,0.22),0_10px_24px_rgba(0,0,0,0.18)]">
          <span className="absolute left-1/2 top-1/2 h-[44%] w-[48%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/92" />
        </span>
        <span className="absolute left-1/2 top-[39%] h-[5.2%] w-[9%] -translate-x-1/2 rounded-[50%] bg-slate-950/90 shadow-[0_6px_14px_rgba(0,0,0,0.28)]" />
        <span className="absolute left-1/2 top-[44.5%] h-[5.8%] w-[5.2%] -translate-x-1/2 rounded-b-full rounded-t-[40%] bg-rose-500/82 shadow-[0_4px_10px_rgba(244,63,94,0.28)]" />
        <span className="absolute left-[30%] top-[42%] h-px w-[15%] -rotate-6 bg-slate-950/50" />
        <span className="absolute left-[30%] top-[44%] h-px w-[15%] bg-slate-950/46" />
        <span className="absolute right-[30%] top-[42%] h-px w-[15%] rotate-6 bg-slate-950/50" />
        <span className="absolute right-[30%] top-[44%] h-px w-[15%] bg-slate-950/46" />
      </div>
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
  performanceProfile,
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
  performanceProfile: ReelsPerformanceProfile;
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
  const mediaStyle = getReelMediaStyle(reel.filterPreset);
  const studioEffect = getReelStudioEffect(reel);
  const liveLabel = getLiveLabel(reel);
  const [mediaFit, setMediaFit] = useState<'cover' | 'contain'>('cover');

  if (!shouldLoad) {
    return (
      <article
        className="relative flex h-[var(--app-visual-viewport-height)] max-h-[var(--app-visual-viewport-height)] min-h-[var(--app-visual-viewport-height)] snap-start snap-always overflow-hidden bg-black px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:px-4 sm:pb-[calc(env(safe-area-inset-bottom)+14px)]"
        style={REEL_SLIDE_PLACEHOLDER_STYLE}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[#050505]" />
        <div className="relative z-10 mt-auto min-w-0 flex-1 pr-[58px] opacity-0 sm:pr-[70px]">
          <h1 className="line-clamp-2 text-[16px] font-bold leading-tight">
            {reel.title}
          </h1>
        </div>
      </article>
    );
  }

  return (
    <article
      className="relative flex h-[var(--app-visual-viewport-height)] max-h-[var(--app-visual-viewport-height)] min-h-[var(--app-visual-viewport-height)] snap-start snap-always overflow-hidden !bg-black !text-white px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:px-4 sm:pb-[calc(env(safe-area-inset-bottom)+14px)]"
      style={REEL_SLIDE_LOADED_STYLE}
    >
      <video
        ref={setVideoRef}
        src={reel.videoSrc}
        className={cn(
          'absolute inset-0 h-full w-full [backface-visibility:hidden]',
          mediaFit === 'contain'
            ? 'object-contain bg-black'
            : 'object-cover object-center',
          active && 'will-change-transform',
        )}
        style={mediaStyle}
        muted={muted}
        loop
        playsInline
        preload={
          active
            ? performanceProfile.activePreload
            : performanceProfile.adjacentPreload
        }
        autoPlay={active && !paused}
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noplaybackrate noremoteplayback"
        aria-hidden={!active}
        onLoadedMetadata={event => {
          const video = event.currentTarget;
          const aspect =
            video.videoWidth > 0 && video.videoHeight > 0
              ? video.videoWidth / video.videoHeight
              : 9 / 16;
          setMediaFit(aspect > 0.68 || aspect < 0.46 ? 'contain' : 'cover');
        }}
        onWaiting={onWaiting}
        onPlaying={onPlaying}
        onCanPlay={onPlaying}
        onError={onError}
      />
      <StudioEffectOverlay effect={studioEffect} />

      <button
        type="button"
        onClick={onTogglePlay}
        className="absolute inset-0 z-10"
        aria-label={
          paused
            ? locale === 'id'
              ? 'Putar video'
              : 'Play video'
            : locale === 'id'
              ? 'Jeda video'
              : 'Pause video'
        }
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/[0.88] via-black/[0.12] to-black/[0.24]" />

      {liveLabel && (
        <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+52px)] z-20 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-1 text-[10px] font-bold text-white shadow-lg shadow-rose-950/25 sm:left-4">
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
        onAction={onAction}
      />

      {buffering && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-black/[0.35] ">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      )}

      {paused && active && !buffering && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-white/20 ">
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
          className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+55px)] z-40 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/[0.48] px-2.5 text-[11px] font-bold text-white shadow-lg ring-1 ring-white/[0.14] transition active:scale-95"
        >
          <Volume2 className="h-3.5 w-3.5" />
          {locale === 'id' ? 'Nyalakan suara' : 'Turn on sound'}
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 z-20 min-w-0 px-3 pb-[calc(env(safe-area-inset-bottom)+13px)] pr-[62px] text-white sm:px-4 sm:pr-[68px]">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenDetail}
            className="min-w-0 truncate text-left text-[14px] font-bold drop-shadow"
          >
            @{reel.creator}
          </button>
          <span className="h-1 w-1 shrink-0 rounded-full bg-white/50" />
          <span className="min-w-0 truncate text-[10px] font-bold text-white/[0.72]">
            #{reel.tag.replace(/^#/, '')}
          </span>
          <button
            type="button"
            onClick={onOpenActions}
            className="ml-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/30 text-white ring-1 ring-white/10 transition active:scale-95"
            aria-label={locale === 'id' ? 'Aksi lainnya' : 'More actions'}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenDetail}
          className="mt-1 block max-w-full text-left"
        >
          <h1 className="line-clamp-1 text-[14px] font-bold leading-5 drop-shadow">
            {reel.title}
          </h1>
        </button>

        <div className="mt-0.5 text-[12px] font-medium leading-[18px] text-white/[0.88] drop-shadow sm:text-[13px]">
          <ExpandableCaption
            text={reel.caption}
            maxLength={76}
            locale={locale}
          />
        </div>

        {reel.productName ? (
          <button
            type="button"
            onClick={onOpenProduct}
            className="mt-2 inline-flex h-9 max-w-full items-center gap-2 rounded-lg bg-white/[0.94] px-2.5 text-left text-[11px] font-bold text-slate-950 shadow-lg ring-1 ring-white/70 transition active:scale-[0.98]"
          >
            <ShoppingBag className="h-4 w-4 shrink-0 text-emerald-700" />
            <span className="min-w-0 truncate">{reel.productName}</span>
            {reel.productPrice ? (
              <span className="shrink-0 text-[10px] text-slate-600">
                {reel.productPrice}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ExpandableCaption({
  text,
  maxLength = 90,
  locale,
}: {
  text: string;
  maxLength?: number;
  locale: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (text.length <= maxLength) {
    return <p>{text}</p>;
  }

  return (
    <p>
      {expanded ? text : `${text.slice(0, maxLength)}... `}

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="font-bold text-white"
      >
        {expanded
          ? locale === 'id'
            ? ' lebih sedikit'
            : ' less'
          : locale === 'id'
            ? ' lainnya'
            : ' more'}
      </button>
    </p>
  );
}

function ActionRail({
  locale,
  reel,
  actionState,
  onOpenComments,
  onOpenShare,
  onAction,
}: {
  locale: string;
  reel: LajukanReel;
  actionState: ReelActionState;
  onOpenComments: () => void;
  onOpenShare: () => void;
  onAction: (action: ReelUserAction, active?: boolean) => void;
}) {
  const isId = locale === 'id';
  const profileHref = buildReelCreatorProfileHref(locale, reel);
  const actions: Array<{
    key: string;
    label?: string;
    ariaLabel: string;
    icon: LucideIcon;
    active?: boolean;
    loading?: boolean;
    onClick: () => void;
  }> = [
    {
      key: 'like',
      label: formatCompactMetric(metricCount(reel, 'likes')),
      ariaLabel: isId ? 'Sukai Reels' : 'Like Reel',
      icon: Heart,
      active: actionState.liked,
      loading: actionState.loading === 'like',
      onClick: () => onAction('like'),
    },
    {
      key: 'comments',
      label: formatCompactMetric(metricCount(reel, 'comments')),
      ariaLabel: isId ? 'Buka komentar' : 'Open comments',
      icon: MessageCircle,
      onClick: onOpenComments,
    },
    {
      key: 'save',
      ariaLabel: actionState.saved
        ? isId
          ? 'Hapus dari tersimpan'
          : 'Remove from saved'
        : isId
          ? 'Simpan Reels'
          : 'Save Reel',
      icon: Bookmark,
      active: actionState.saved,
      loading: actionState.loading === 'save',
      onClick: () => onAction('save'),
    },
    {
      key: 'share',
      label: formatCompactMetric(metricCount(reel, 'shares')),
      ariaLabel: isId ? 'Bagikan Reels' : 'Share Reel',
      icon: Forward,
      onClick: onOpenShare,
    },
  ];

  return (
    <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+88px)] right-1.5 z-30 flex flex-col items-center gap-1.5 sm:right-2.5">
      <div className="relative mb-1.5 flex h-[50px] w-[50px] items-center justify-center">
        <Link
          href={profileHref}
          aria-label={
            isId
              ? `Lihat profil ${reel.creator}`
              : `View ${reel.creator}'s profile`
          }
          className="absolute inset-0 overflow-hidden rounded-full bg-white/10 p-[2px] shadow-lg shadow-black/[0.35] ring-2 ring-white/[0.55] transition active:scale-95"
        >
          <ReelCreatorAvatar
            reel={reel}
            className="h-full w-full rounded-full object-cover"
            size={50}
          />
        </Link>

        <button
          type="button"
          onClick={() => onAction('follow')}
          disabled={actionState.loading === 'follow'}
          aria-label={
            actionState.followed
              ? isId
                ? 'Berhenti mengikuti'
                : 'Unfollow creator'
              : isId
                ? 'Ikuti pembuat'
                : 'Follow creator'
          }
          className={cn(
            'absolute -bottom-1 left-1/2 z-20 flex !h-6 !max-h-6 !min-h-0 !w-6 !min-w-0 !max-w-6 -translate-x-1/2 items-center justify-center rounded-full p-0 !text-white shadow-lg shadow-black/45 transition active:scale-95 disabled:opacity-60',
            actionState.followed ? '!bg-emerald-500' : '!bg-[#ff2d55]',
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
            aria-label={action.ariaLabel}
            title={action.ariaLabel}
            className="flex max-w-[44px] flex-col items-center gap-0.5 transition active:scale-95"
            data-testid={`reels-action-${action.key}`}
          >
            <span
              className={cn(
                '!grid !h-10 !w-10 place-items-center rounded-full !bg-black/[0.32] !text-white shadow-md shadow-black/25 ring-1 ring-white/10 transition',
                action.key === 'like' && action.active && '!text-rose-500',
                action.key === 'save' && action.active && '!text-yellow-300',
              )}
            >
              {action.loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ActionIcon
                  className={cn(
                    '!h-[22px] !w-[22px] fill-none stroke-current stroke-[2.45]',
                    action.active && 'fill-current',
                  )}
                />
              )}
            </span>
            {action.label && (
              <span className="max-w-full truncate text-center text-[9px] font-bold leading-3 drop-shadow">
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
  const {
    ref: chipRailRef,
    onClickCapture,
    onPointerCancel,
    onPointerDown,
    onPointerLeave,
    onPointerMove,
    onPointerUp,
    onWheel,
  } = useHorizontalDragScroll<HTMLDivElement>();

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
      <header className="shrink-0 border-b border-white/10 bg-black/95 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+14px)] ">
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
            className="hidden rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950 sm:inline-flex"
          >
            Tutup
          </button>
        </div>

        <div
          ref={chipRailRef}
          onClickCapture={onClickCapture}
          onPointerCancel={onPointerCancel}
          onPointerDown={onPointerDown}
          onPointerLeave={onPointerLeave}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          className="mx-auto mt-3 flex w-full max-w-[1440px] gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none cursor-grab active:cursor-grabbing"
        >
          {chips.map(chip => {
            const active = query === chip || (!query && chip === 'Semua');

            return (
              <button
                key={chip}
                type="button"
                onClick={() => setQuery(chip === 'Semua' ? '' : chip)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-2 text-xs font-bold transition',
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
              <p className="text-xs font-bold uppercase tracking-wide text-white/45">
                {query ? 'Hasil pencarian' : 'Eksplor Reels'}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
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
              <p className="mt-5 text-xl font-bold">Belum ada video</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/55">
                Coba kata lain seperti supplier, packaging, kopi, frozen food,
                marketing, atau keuangan.
              </p>
            </div>
          )}

          <div className="py-8">
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat video...
              </div>
            )}

            {!loadingMore && hasMore && (
              <button
                type="button"
                onClick={onLoadMore}
                className="mx-auto flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950"
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
                className="mx-auto mt-3 flex rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-950"
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
  const Icon = iconMap[reel.iconKey] ?? Clapperboard;
  const mediaStyle = getReelMediaStyle(reel.filterPreset);
  const liveLabel = getLiveLabel(reel);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={event => {
        const video = event.currentTarget.querySelector('video');
        if (video instanceof HTMLVideoElement) {
          video.play().catch(() => {});
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
      <video
        src={reel.videoSrc}
        className="absolute inset-0 h-full w-full object-cover"
        style={mediaStyle}
        muted
        loop
        playsInline
        preload="metadata"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/12 to-black/25" />

      <div className="absolute left-2 top-2 flex max-w-[calc(100%-56px)] items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-white ">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{reel.tag}</span>
      </div>

      {reel.productName && (
        <div className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-yellow-400 text-slate-950 shadow-lg">
          <ShoppingBag className="h-4 w-4" />
        </div>
      )}
      {liveLabel && (
        <div className="absolute right-2 top-11 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-1 text-[10px] font-bold text-white shadow-lg">
          <Radio className="h-3 w-3" />
          {liveLabel}
        </div>
      )}

      <div className="absolute inset-0 grid place-items-center opacity-90 transition group-hover:scale-110">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-white/18 ">
          <Play className="h-4 w-4 fill-white text-white" />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="line-clamp-2 text-xs font-bold leading-tight text-white">
          {reel.title}
        </p>

        {reel.productName ? (
          <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-bold text-slate-950">
            <ShoppingBag className="h-3 w-3 shrink-0" />
            <span className="truncate">{reel.productName}</span>
          </div>
        ) : (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold text-white/80">
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
  onOpenCreatorProfile,
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
  onOpenCreatorProfile: (reel: LajukanReel) => void;
  onMessageCreator: (reel: LajukanReel) => void;
  chatBusyReelId: string | null;
  onClose: () => void;
}) {
  if (!reel) return null;

  const Icon = iconMap[reel.iconKey] ?? Clapperboard;
  const imageMedia = isImageMediaUrl(reel.videoSrc);
  const mediaStyle = getReelMediaStyle(reel.filterPreset);
  const liveLabel = getLiveLabel(reel);
  const profileHref = buildReelCreatorProfileHref(locale, reel);
  const creatorStats = getReelCreatorStats(reel);

  return (
    <div
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/68 p-0 text-white  lg:items-stretch lg:justify-end lg:bg-black/42 "
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup detail"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative flex max-h-[calc(var(--app-viewport-height)-1rem)] w-full flex-col overflow-hidden rounded-t-[30px] bg-[#080808] text-white shadow-2xl lg:h-full lg:max-h-none lg:w-[min(520px,42vw)] lg:min-w-[460px] lg:rounded-none lg:border-l lg:border-white/10">
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-white/24 lg:hidden" />
        <div className="relative min-h-[180px] max-h-[min(calc(var(--app-viewport-height)-20rem),340px)] overflow-hidden bg-black lg:min-h-[220px] lg:max-h-[260px]">
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

          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-xs font-bold ">
            <Icon className="h-4 w-4" />
            {reel.tag}
          </div>
          {liveLabel && (
            <div className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-2 text-xs font-bold text-white shadow-xl">
              <Radio className="h-3.5 w-3.5" />
              {liveLabel}
            </div>
          )}

          <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-white/15 ">
              <Play className="h-7 w-7 fill-white" />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#0c0f14] p-5 text-white sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">
                Detail Reels
              </p>
              <h2 className="mt-1 text-2xl font-bold leading-tight">
                {reel.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-white transition active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={profileHref}
              className="shrink-0 rounded-full bg-white/10 p-0.5 ring-1 ring-white/10 transition active:scale-95"
              aria-label={`Lihat profil ${reel.creator}`}
            >
              <ReelCreatorAvatar
                reel={reel}
                className="h-11 w-11 bg-white/10"
                size={44}
              />
            </Link>

            <div className="min-w-0 flex-1">
              <Link
                href={profileHref}
                className="block truncate text-sm font-bold text-white underline-offset-4 transition hover:underline"
              >
                {reel.creator}
              </Link>
              <p className="text-xs font-semibold text-white/55">
                {reel.tag} / Tips bisnis
              </p>
            </div>

            <Link
              href={profileHref}
              className="hidden items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white transition active:scale-[0.98] min-[430px]:inline-flex"
            >
              <User className="h-3.5 w-3.5" />
              Profil
            </Link>

            <button
              type="button"
              onClick={() => onOpenCreatorProfile(reel)}
              className="hidden items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white transition active:scale-[0.98] min-[430px]:inline-flex"
            >
              <Users className="h-3.5 w-3.5" />
              Sosial
            </button>

            <button
              type="button"
              onClick={() => onMessageCreator(reel)}
              disabled={chatBusyReelId === reel.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
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
                'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold disabled:opacity-60',
                actionState.followed
                  ? 'bg-emerald-500 text-white'
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

          <div className="mt-4 grid grid-cols-3 gap-2">
            <CreatorStatCell
              label="Followers"
              value={formatCompactMetric(creatorStats.followers)}
            />
            <CreatorStatCell
              label="Following"
              value={formatCompactMetric(creatorStats.following)}
            />
            <CreatorStatCell
              label="Reels"
              value={formatCompactMetric(creatorStats.reels)}
            />
          </div>

          <p className="mt-5 text-sm leading-relaxed text-white/72">
            {reel.caption}
          </p>

          {reel.productName && reel.productPrice && reel.productHref ? (
            <button
              type="button"
              onClick={() => onOpenProduct(reel)}
              className="mt-5 flex w-full items-center gap-3 rounded-[24px] border border-yellow-300/20 bg-yellow-400/10 p-4 text-left text-white shadow-lg shadow-yellow-400/10"
            >
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-yellow-400 text-slate-950">
                <ShoppingBag className="h-7 w-7" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-yellow-200">
                  Produk terkait
                </div>
                <p className="truncate text-base font-bold">
                  {reel.productName}
                </p>
                <p className="truncate text-sm font-bold text-white/64">
                  {reel.productPrice}
                </p>
              </div>

              <ChevronRight className="h-5 w-5 shrink-0" />
            </button>
          ) : (
            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/6 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Info className="h-5 w-5 text-emerald-300" />
                Konten informasi
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/55">
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
              className="rounded-2xl bg-white/10 px-3 py-3 text-sm font-bold text-white ring-1 ring-white/10"
            >
              Komentar
            </button>
            <button
              type="button"
              onClick={() => onAction(reel, 'save')}
              disabled={actionState.loading === 'save'}
              className="rounded-2xl bg-white/10 px-3 py-3 text-sm font-bold text-white ring-1 ring-white/10"
            >
              {actionState.saved ? 'Tersimpan' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={() => onOpenShare(reel)}
              className="rounded-2xl bg-emerald-500 px-3 py-3 text-sm font-bold text-white"
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
      <p className="text-sm font-bold">{value}</p>
      <p className="mt-0.5 text-[11px] font-bold text-slate-500">{label}</p>
    </div>
  );
}

function CreatorStatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/8 px-3 py-3 text-center ring-1 ring-white/10">
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold text-white/48">{label}</p>
    </div>
  );
}

function CreatorProfileSheet({
  locale,
  reel,
  actionState,
  chatBusy,
  onAction,
  onMessageCreator,
  onOpenComments,
  onClose,
}: {
  locale: string;
  reel: LajukanReel | null;
  actionState: ReelActionState;
  chatBusy: boolean;
  onAction: (
    reel: LajukanReel,
    action: ReelUserAction,
    active?: boolean,
  ) => void;
  onMessageCreator: (reel: LajukanReel) => void;
  onOpenComments: (reel: LajukanReel) => void;
  onClose: () => void;
}) {
  if (!reel) return null;

  const profileHref = buildReelCreatorProfileHref(locale, reel);
  const stats = getReelCreatorStats(reel);

  return (
    <div
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/62 text-white lg:items-center lg:justify-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup profil creator"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative w-full overflow-hidden rounded-t-[28px] bg-[#0b0f14] text-white shadow-2xl ring-1 ring-white/10 lg:max-w-[430px] lg:rounded-[24px]">
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-white/18 lg:hidden" />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ReelCreatorAvatar
                reel={reel}
                className="h-16 w-16 bg-white/10 ring-2 ring-white/20"
                size={64}
              />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{reel.creator}</h2>
                <p className="truncate text-xs font-semibold text-white/50">
                  {reel.tag} / Creator Lajukan
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10"
              aria-label="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <CreatorStatCell
              label="Followers"
              value={formatCompactMetric(stats.followers)}
            />
            <CreatorStatCell
              label="Following"
              value={formatCompactMetric(stats.following)}
            />
            <CreatorStatCell
              label="Reels"
              value={formatCompactMetric(stats.reels)}
            />
          </div>

          <p className="mt-4 line-clamp-3 text-sm font-medium leading-relaxed text-white/68">
            {reel.caption}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onAction(reel, 'follow')}
              disabled={actionState.loading === 'follow'}
              className={cn(
                'inline-flex h-11 items-center justify-center gap-2 rounded-2xl text-sm font-bold disabled:opacity-60',
                actionState.followed
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-white text-slate-950',
              )}
            >
              {actionState.loading === 'follow' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : actionState.followed ? (
                <Check className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {actionState.followed ? 'Diikuti' : 'Ikuti'}
            </button>
            <button
              type="button"
              onClick={() => onMessageCreator(reel)}
              disabled={chatBusy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-bold text-white disabled:opacity-60"
            >
              {chatBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquareText className="h-4 w-4" />
              )}
              Chat
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link
              href={profileHref}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-bold text-white ring-1 ring-white/10"
            >
              <User className="h-4 w-4" />
              Profil penuh
            </Link>
            <button
              type="button"
              onClick={() => onOpenComments(reel)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-bold text-white ring-1 ring-white/10"
            >
              <MessageCircle className="h-4 w-4" />
              Komentar
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ShareSheet({
  locale,
  reel,
  chatBusy,
  onMessageCreator,
  onMessageUser,
  onClose,
}: {
  locale: string;
  reel: LajukanReel | null;
  chatBusy: boolean;
  onMessageCreator: (reel: LajukanReel) => void;
  onMessageUser: (userId: string, reel: LajukanReel) => Promise<void> | void;
  onClose: () => void;
}) {
  const { authFetch, user } = useAuth();
  const isId = locale === 'id';
  const [copied, setCopied] = useState(false);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<ShareSheetRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [sendingRecipientId, setSendingRecipientId] = useState<string | null>(
    null,
  );
  const shareUrl = useMemo(
    () => buildReelShareUrl(locale, reel),
    [locale, reel],
  );
  const reelId = reel?.id ?? null;
  const reelCreator = reel?.creator ?? '';
  const reelCreatorUserId = reel?.creatorUserId ?? '';
  const followingStorageKey = `${PROFILE_SOCIAL_STORAGE_KEY}:${user?.id || 'me'}`;
  const recipientsRail = useHorizontalDragScroll<HTMLDivElement>();
  const primaryActionsRail = useHorizontalDragScroll<HTMLDivElement>();
  const utilityActionsRail = useHorizontalDragScroll<HTMLDivElement>();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCopied(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [reelId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(followingStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setFollowedIds(
        Array.isArray(parsed)
          ? parsed.map(item => String(item).trim()).filter(Boolean)
          : [],
      );
    } catch {
      setFollowedIds([]);
    }
  }, [followingStorageKey]);

  useEffect(() => {
    if (!reelId) {
      setRecipients([]);
      setRecipientsLoading(false);
      setSendingRecipientId(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const loadPublicUser = async (id: string): Promise<SocialUser | null> => {
      try {
        const response = await authFetch(
          `/api/users/public/${encodeURIComponent(id)}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!response.ok) return null;

        const payload = (await response
          .json()
          .catch(() => null)) as DiscoverUser | null;
        if (!payload) return null;

        const mapped = mapDiscoverUserToSocialUser(payload, isId);
        if (!mapped) return null;
        if (user?.id && mapped.id === user.id) return null;
        return mapped;
      } catch {
        return null;
      }
    };

    const loadDiscoverUsers = async (
      query?: string,
      limit = 8,
    ): Promise<SocialUser[]> => {
      try {
        const params = new URLSearchParams({
          limit: String(limit),
        });
        const trimmed = query?.trim();
        if (trimmed) {
          params.set('q', trimmed);
        }

        const response = await authFetch(
          `/api/users/discover?${params.toString()}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!response.ok) return [];

        const payload = (await response.json().catch(() => ({}))) as {
          data?: DiscoverUser[];
        };
        return (Array.isArray(payload.data) ? payload.data : [])
          .map(item => mapDiscoverUserToSocialUser(item, isId))
          .filter((item): item is SocialUser => Boolean(item))
          .filter(item => !user?.id || item.id !== user.id);
      } catch {
        return [];
      }
    };

    const loadRecipients = async () => {
      setRecipientsLoading(true);

      try {
        const normalizedCreator = normalizeRecipientName(reelCreator);
        const creatorUserId = reelCreatorUserId.trim();
        const currentUserId = user?.id?.trim() || '';
        const creatorIsSelf = Boolean(
          currentUserId && creatorUserId && creatorUserId === currentUserId,
        );
        const followedIdSet = new Set(followedIds);

        const [creatorById, creatorBySearch, followedUsers, suggestedUsers] =
          await Promise.all([
            creatorUserId
              ? loadPublicUser(creatorUserId)
              : Promise.resolve(null),
            normalizedCreator
              ? loadDiscoverUsers(reelCreator, 6)
              : Promise.resolve([]),
            Promise.all(followedIds.slice(0, 6).map(id => loadPublicUser(id))),
            loadDiscoverUsers(undefined, 8),
          ]);

        const creatorCandidate =
          creatorById ||
          (Array.isArray(creatorBySearch)
            ? creatorBySearch.find(candidate => {
                const candidateName = normalizeRecipientName(candidate.name);
                const candidateHandle = normalizeRecipientName(
                  candidate.handle,
                );
                return (
                  candidateName === normalizedCreator ||
                  candidateHandle === normalizedCreator
                );
              }) || null
            : null);

        const effectiveCreatorCandidate = creatorIsSelf
          ? null
          : creatorCandidate;
        const creatorRecipient: ShareSheetRecipient | null =
          effectiveCreatorCandidate
            ? {
                ...effectiveCreatorCandidate,
                source: 'creator',
                linked: true,
              }
            : null;

        const filteredFollowedUsers = followedUsers.filter(
          item =>
            item?.id !== effectiveCreatorCandidate?.id &&
            item?.id !== creatorRecipient?.id,
        );
        const filteredSuggestedUsers = suggestedUsers.filter(
          item =>
            item?.id !== effectiveCreatorCandidate?.id &&
            item.id !== creatorRecipient?.id &&
            !followedIdSet.has(item.id),
        );
        const validFollowedUsers = filteredFollowedUsers.filter(
          (user): user is SocialUser => user !== null,
        );

        const validSuggestedUsers = filteredSuggestedUsers.filter(
          (user): user is SocialUser => user !== null,
        );

        const restRecipients = mergeSocialUsers(
          validFollowedUsers,
          validSuggestedUsers,
        )
          .filter(item => item.id !== creatorRecipient?.id)
          .filter(item => {
            if (!creatorRecipient) return true;
            const creatorName = normalizeRecipientName(creatorRecipient.name);
            return (
              normalizeRecipientName(item.name) !== creatorName &&
              normalizeRecipientName(item.handle) !== creatorName
            );
          })
          .map<ShareSheetRecipient>(item => ({
            ...item,
            source: followedIdSet.has(item.id) ? 'following' : 'suggested',
            linked: true,
          }));

        const nextRecipients = creatorRecipient
          ? [creatorRecipient, ...restRecipients]
          : restRecipients;

        if (!cancelled) {
          setRecipients(nextRecipients.slice(0, 8));
        }
      } finally {
        if (!cancelled) {
          setRecipientsLoading(false);
        }
      }
    };

    void loadRecipients();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    authFetch,
    followedIds,
    isId,
    reelCreator,
    reelCreatorUserId,
    reelId,
    user?.id,
  ]);

  const copyLink = useCallback(async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard?.writeText(shareUrl);
    } catch {}

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [shareUrl]);

  const openExternal = useCallback((url: string) => {
    if (typeof window === 'undefined') return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const handleRecipientPress = useCallback(
    async (recipient: ShareSheetRecipient) => {
      if (!reel || sendingRecipientId) return;

      setSendingRecipientId(recipient.id);
      try {
        if (recipient.linked) {
          await Promise.resolve(onMessageUser(recipient.id, reel));
        } else {
          await Promise.resolve(onMessageCreator(reel));
        }
        onClose();
      } finally {
        setSendingRecipientId(null);
      }
    },
    [onClose, onMessageCreator, onMessageUser, reel, sendingRecipientId],
  );

  if (!reel) return null;

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(`${reel.title}\n${shareUrl}`);
  const recipientCaption = (recipient: ShareSheetRecipient) => {
    if (recipient.source === 'creator') {
      return recipient.linked
        ? isId
          ? 'Pembuat reel'
          : 'Creator'
        : isId
          ? 'Belum terhubung'
          : 'Not connected';
    }

    return recipient.source === 'following'
      ? isId
        ? 'Di-follow'
        : 'Following'
      : isId
        ? 'Rekomendasi Lajukan'
        : 'Suggested';
  };

  const recipientTone = (recipient: ShareSheetRecipient) => {
    if (recipient.source === 'creator') {
      return recipient.linked
        ? 'from-emerald-500 to-teal-400'
        : 'from-slate-900 to-slate-600';
    }

    if (recipient.source === 'following') {
      return 'from-emerald-600 to-teal-400';
    }

    return 'from-pink-500 to-orange-400';
  };

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
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/58 text-white  lg:items-stretch lg:justify-end lg:bg-black/42 lg:p-0 "
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup share"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative flex max-h-[calc(var(--app-viewport-height)-1rem)] w-full flex-col overflow-hidden rounded-t-[28px] bg-[#0b0f14] text-white shadow-2xl lg:h-full lg:max-h-none lg:w-[460px] lg:max-w-none lg:rounded-none lg:border-l lg:border-white/10 xl:w-[500px]">
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-white/18 lg:hidden" />
        <div className="flex items-center gap-3 px-4 pb-3 pt-4 sm:px-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-white">
            <Search className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 text-center">
            <h2 className="text-xl font-bold tracking-[-0.03em]">Send to</h2>
            <p className="truncate text-xs font-semibold text-white/60">
              {reel.title}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-white transition active:scale-95"
            aria-label="Tutup share"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] sm:px-5 sm:pb-5">
          <div
            ref={recipientsRail.ref}
            onClickCapture={recipientsRail.onClickCapture}
            onPointerCancel={recipientsRail.onPointerCancel}
            onPointerDown={recipientsRail.onPointerDown}
            onPointerLeave={recipientsRail.onPointerLeave}
            onPointerMove={recipientsRail.onPointerMove}
            onPointerUp={recipientsRail.onPointerUp}
            onWheel={recipientsRail.onWheel}
            className="flex gap-3 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none cursor-grab active:cursor-grabbing"
          >
            {recipientsLoading && recipients.length === 0
              ? Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={`recipient-skel-${index}`}
                    className="w-[76px] shrink-0 text-center"
                  >
                    <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/10 ring-1 ring-white/10">
                      <Loader2 className="h-5 w-5 animate-spin text-white/55" />
                    </span>
                    <span className="mt-2 block h-3 rounded-full bg-white/10" />
                    <span className="mt-1 block h-2.5 rounded-full bg-white/6" />
                  </div>
                ))
              : recipients.map(recipient => (
                  <button
                    key={recipient.id}
                    type="button"
                    disabled={chatBusy || sendingRecipientId === recipient.id}
                    onClick={() => void handleRecipientPress(recipient)}
                    className="w-[76px] shrink-0 text-center transition active:scale-95 disabled:opacity-60"
                  >
                    <span
                      className={cn(
                        'mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-lg ring-1 ring-black/5',
                        recipientTone(recipient),
                      )}
                    >
                      {sendingRecipientId === recipient.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : recipient.avatarUrl ? (
                        <NextImage
                          src={recipient.avatarUrl}
                          alt={recipient.name}
                          width={64}
                          height={64}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        recipient.name.slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <span className="mt-2 block truncate text-xs font-semibold text-white">
                      {recipient.name}
                    </span>
                    <span className="block truncate text-[10px] font-medium text-white/48">
                      {recipientCaption(recipient)}
                    </span>
                  </button>
                ))}
          </div>

          <div
            ref={primaryActionsRail.ref}
            onClickCapture={primaryActionsRail.onClickCapture}
            onPointerCancel={primaryActionsRail.onPointerCancel}
            onPointerDown={primaryActionsRail.onPointerDown}
            onPointerLeave={primaryActionsRail.onPointerLeave}
            onPointerMove={primaryActionsRail.onPointerMove}
            onPointerUp={primaryActionsRail.onPointerUp}
            onWheel={primaryActionsRail.onWheel}
            className="flex gap-4 overflow-x-auto border-t border-white/10 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none cursor-grab active:cursor-grabbing"
          >
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
                      'mx-auto grid h-14 w-14 place-items-center rounded-full text-lg font-bold shadow-lg',
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
                  <span className="mt-2 block text-xs font-semibold leading-tight text-white/78">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            ref={utilityActionsRail.ref}
            onClickCapture={utilityActionsRail.onClickCapture}
            onPointerCancel={utilityActionsRail.onPointerCancel}
            onPointerDown={utilityActionsRail.onPointerDown}
            onPointerLeave={utilityActionsRail.onPointerLeave}
            onPointerMove={utilityActionsRail.onPointerMove}
            onPointerUp={utilityActionsRail.onPointerUp}
            onWheel={utilityActionsRail.onWheel}
            className="flex gap-4 overflow-x-auto border-t border-white/10 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none cursor-grab active:cursor-grabbing"
          >
            {utilityActions.map(action => {
              const ActionIcon = action.icon;

              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="w-[76px] shrink-0 text-center transition active:scale-95"
                >
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/10 text-white">
                    <ActionIcon className="h-6 w-6" />
                  </span>
                  <span className="mt-2 block text-xs font-semibold leading-tight text-white/78">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>

          {copied && (
            <div className="mb-2 rounded-full bg-emerald-500 px-4 py-2 text-center text-xs font-bold text-white">
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
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/58 text-white  sm:items-end lg:items-stretch lg:justify-end lg:bg-black/42 lg:p-0 "
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup aksi reels"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative w-full overflow-hidden rounded-t-[26px] bg-[#0b0f14] text-white shadow-2xl lg:h-full lg:w-[420px] lg:rounded-none lg:border-l lg:border-white/10">
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-white/18 lg:hidden" />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">
              Aksi reels
            </p>
            <h2 className="truncate text-base font-bold">{reel.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 transition active:scale-95"
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
                  'flex min-h-[74px] flex-col items-center justify-center gap-2 rounded-[18px] px-2 text-xs font-bold transition active:scale-[0.98] disabled:opacity-60',
                  action.featured
                    ? 'bg-emerald-600 text-white shadow-[0_10px_22px_-18px_rgba(16,185,129,0.65)]'
                    : action.active
                      ? 'bg-rose-600 text-white shadow-[0_10px_22px_-18px_rgba(225,29,72,0.65)]'
                      : 'bg-zinc-800 text-white shadow-[0_10px_22px_-18px_rgba(0,0,0,0.68)]',
                )}
              >
                <ActionIcon
                  className={cn(
                    'h-5 w-5 fill-current stroke-current stroke-[2.5]',
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
  locale,
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
  locale: string;
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
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/62 text-white  lg:items-stretch lg:justify-end lg:bg-black/42 lg:p-0 "
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup komentar"
        onClick={onClose}
        className="absolute inset-0 z-0"
      />

      <section className="relative z-10 flex max-h-[calc(var(--app-viewport-height)-1rem)] w-full flex-col overflow-hidden rounded-t-[28px] bg-[#0b0f14] text-white shadow-2xl lg:h-full lg:max-h-none lg:w-[460px] lg:max-w-none lg:rounded-none lg:border-l lg:border-white/10 xl:w-[500px]">
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-white/18 lg:hidden" />
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">
              {formatCompactMetric(metricCount(reel, 'comments'))} komentar
            </p>
            <h2 className="truncate text-base !text-black font-bold">
              {reel.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onChatCreator(null)}
            disabled={chatBusy}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-60 !text-black"
          >
            {chatBusy ? (
              <Loader2 className="h-4 w-4 animate-spin !text-black" />
            ) : (
              <MessageSquareText className="h-4 w-4 !text-black" />
            )}
            Chat
          </button>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {bucket?.loading && comments.length === 0 ? (
            <div className="grid h-44 place-items-center text-sm font-bold text-white/55">
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
                        src={profileAvatarSrc(
                          comment.authorAvatarUrl,
                          readProfileAvatarStyle(comment),
                          comment.authorName,
                        )}
                        alt={comment.authorName}
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="rounded-2xl !text-black bg-white/8 px-3 py-2 ring-1 ring-white/10">
                          <p className="truncate text-xs font-bold text-white">
                            {comment.authorName}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/78">
                            {comment.body}
                          </p>
                        </div>
                        <div className="!text-black mt-1 flex items-center gap-3 px-2 text-[11px] font-bold text-white/42">
                          <span>
                            {formatCommentTime(comment.createdAt, locale)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onReply(comment)}
                            className="text-white/55 transition hover:text-emerald-300"
                          >
                            Balas
                          </button>
                          <button
                            type="button"
                            onClick={() => onChatCreator(comment)}
                            className="text-white/55 transition hover:text-emerald-300"
                          >
                            Chat creator
                          </button>
                        </div>
                      </div>
                    </div>

                    {replies.length > 0 && (
                      <div className="ml-11 space-y-2 border-l border-white/10 pl-3">
                        {replies.map(reply => (
                          <div key={reply.id} className="flex gap-2">
                            <img
                              src={profileAvatarSrc(
                                reply.authorAvatarUrl,
                                readProfileAvatarStyle(reply),
                                reply.authorName,
                              )}
                              alt={reply.authorName}
                              className="h-7 w-7 shrink-0 rounded-full object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="rounded-2xl bg-white/6 px-3 py-2 ring-1 ring-white/10">
                                <p className="truncate text-[11px] font-bold text-white">
                                  {reply.authorName}
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-white/75">
                                  {reply.body}
                                </p>
                              </div>
                              <p className="mt-1 px-2 text-[10px] font-semibold text-white/40">
                                {formatCommentTime(reply.createdAt, locale)}
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
                <MessageCircle className="mx-auto h-9 w-9 text-white/28" />
                <p className="mt-2 text-sm font-bold text-white">
                  Belum ada komentar
                </p>
                <p className="mt-1 text-xs font-medium text-white/50">
                  Jadilah yang pertama kasih insight.
                </p>
              </div>
            </div>
          )}

          {bucket?.error && (
            <div className="mt-3 rounded-2xl bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 ring-1 ring-rose-300/10">
              {bucket.error}
            </div>
          )}

          {bucket?.hasMore && comments.length > 0 && (
            <button
              type="button"
              onClick={() => onLoadMore(reel.id)}
              disabled={bucket.loading}
              className="mt-4 w-full rounded-full bg-white/10 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
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
          className="border-t border-white/10 bg-[#0b0f14] p-3"
        >
          {isAuthenticated ? (
            <div className="space-y-2">
              {replyTarget && (
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200">
                  <span className="min-w-0 truncate">
                    Membalas {replyTarget.authorName}
                  </span>
                  <button
                    type="button"
                    onClick={onCancelReply}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-white"
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
                  className="max-h-28 min-h-[42px] flex-1 resize-none rounded-[20px] bg-white/8 px-3 py-2.5 text-sm font-medium text-white outline-none ring-emerald-400/20 transition focus:ring-4 placeholder:text-white/35"
                />
                <button
                  type="submit"
                  disabled={submitting || !body.trim()}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-700/20 disabled:opacity-45"
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
                className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-3 text-left text-sm font-bold text-white/70"
              >
                Masuk untuk komentar
              </button>
              <Link
                href={loginHref}
                className="rounded-full bg-emerald-500 px-4 py-3 text-sm font-bold text-white"
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
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/62 text-white  lg:items-stretch lg:justify-end lg:bg-black/42 lg:p-0 "
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup produk"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative flex max-h-[calc(var(--app-viewport-height)-1rem)] w-full flex-col overflow-hidden rounded-t-[28px] bg-[#0b0f14] text-white shadow-2xl lg:h-full lg:max-h-none lg:w-[420px] lg:max-w-none lg:rounded-none lg:border-l lg:border-white/10 xl:w-[460px]">
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-white/18 lg:hidden" />
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-yellow-300">
              Produk terkait
            </p>
            <h2 className="mt-1 text-xl font-bold leading-tight">
              {reel.productName || 'Produk terkait'}
            </h2>
            <p className="mt-1 text-sm font-bold text-white/60">
              {reel.productPrice || 'Harga mengikuti detail produk'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex items-center gap-3 rounded-[24px] border border-yellow-300/20 bg-yellow-400/10 p-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-yellow-400 text-slate-950">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">
                {reel.creator}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-relaxed text-white/72">
                {reel.caption}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href={productHref}
              className="rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-bold text-white ring-1 ring-white/10"
            >
              Lihat produk
            </Link>

            {isAuthenticated ? (
              <Link
                href={checkoutHref}
                className="rounded-2xl bg-emerald-500 px-4 py-3 text-center text-sm font-bold text-white"
              >
                Mulai transaksi
              </Link>
            ) : (
              <button
                type="button"
                onClick={onRequireLogin}
                className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white"
              >
                Mulai transaksi
              </button>
            )}
          </div>

          <div className="mt-3 rounded-2xl bg-white/6 px-3 py-2 text-xs font-semibold leading-relaxed text-white/55 ring-1 ring-white/10">
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
  performanceProfile,
  onClose,
  onCreated,
}: {
  locale: string;
  open: boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  displayName: string;
  performanceProfile: ReelsPerformanceProfile;
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
  const recordingFrameCleanupRef = useRef<(() => void) | null>(null);
  const recordingOutputStreamRef = useRef<MediaStream | null>(null);
  const cameraRequestIdRef = useRef(0);
  const cameraOpeningRef = useRef(false);
  const autoCameraAttemptedRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraOpening, setCameraOpening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(
    null,
  );
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const hasMedia = Boolean(file || form.mediaUrl.trim());
  const studioPanelRail = useHorizontalDragScroll<HTMLDivElement>();
  const studioFilterRail = useHorizontalDragScroll<HTMLDivElement>();
  const studioMusicRail = useHorizontalDragScroll<HTMLDivElement>();

  const setField = useCallback(
    <K extends keyof UploadReelForm>(field: K, value: UploadReelForm[K]) => {
      setForm(current => ({ ...current, [field]: value }));
    },
    [],
  );

  const stopCamera = useCallback(() => {
    cameraRequestIdRef.current += 1;
    cameraOpeningRef.current = false;
    setCameraOpening(false);
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    recordingFrameCleanupRef.current?.();
    recordingFrameCleanupRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    if (
      recordingOutputStreamRef.current &&
      recordingOutputStreamRef.current !== cameraStreamRef.current
    ) {
      recordingOutputStreamRef.current
        .getVideoTracks()
        .forEach(track => track.stop());
    }
    recordingOutputStreamRef.current = null;
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
      if (cameraOpeningRef.current) return;
      setError(null);
      setCameraError(null);
      setForm(current => ({ ...current, captureMode: 'camera' }));

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          locale === 'id'
            ? 'Kamera belum didukung di browser ini. Pilih video dari galeri.'
            : 'This browser does not support camera access. Choose a gallery video.',
        );
        return;
      }

      if (openNativeReelsStudio('reels_upload')) {
        return;
      }

      requestNativePermissions(['camera', 'microphone']);
      stopCamera();
      const requestId = ++cameraRequestIdRef.current;
      cameraOpeningRef.current = true;
      setCameraOpening(true);

      try {
        const needsAudio = studioMode !== 'photo';
        const videoConstraints = buildReelsCameraConstraints(
          performanceProfile,
          facingMode,
        );
        const attempts: MediaStreamConstraints[] = [
          { audio: needsAudio, video: videoConstraints },
          { audio: false, video: videoConstraints },
          {
            audio: false,
            video: { facingMode: { ideal: facingMode } },
          },
        ];
        let stream: MediaStream | null = null;
        let lastError: unknown = null;

        for (const constraints of attempts) {
          if (stream) break;
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
          } catch (cameraRequestError) {
            lastError = cameraRequestError;
          }
        }

        if (!stream) throw lastError;
        if (requestId !== cameraRequestIdRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        cameraStreamRef.current = stream;
        setCameraFacingMode(facingMode);
        setCameraReady(true);
        if (needsAudio && stream.getAudioTracks().length === 0) {
          setCameraError(
            locale === 'id'
              ? 'Kamera aktif tanpa mikrofon. Rekaman tetap bisa dibuat tanpa suara.'
              : 'The camera is active without a microphone. You can still record without sound.',
          );
        }
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          await cameraVideoRef.current.play().catch(() => undefined);
        }
      } catch (cameraRequestError) {
        if (requestId === cameraRequestIdRef.current) {
          setCameraError(
            getReelsCameraErrorMessage(cameraRequestError, locale),
          );
        }
      } finally {
        if (requestId === cameraRequestIdRef.current) {
          cameraOpeningRef.current = false;
          setCameraOpening(false);
        }
      }
    },
    [cameraFacingMode, locale, performanceProfile, stopCamera, studioMode],
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

      if (mode === 'link') {
        stopCamera();
        setFile(null);
        setForm(current => ({
          ...current,
          captureMode: 'upload',
          title: current.title.trim() ? current.title : 'Video usaha',
          hook: current.hook.trim() ? current.hook : 'Lihat videonya',
        }));
        setStudioPanel('link');
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

    const width = performanceProfile.captureWidth;
    const height = performanceProfile.captureHeight;
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
        stopCamera();
      },
      'image/jpeg',
      performanceProfile.photoQuality,
    );
  }, [
    cameraReady,
    form.filterPreset,
    performanceProfile,
    setStudioMode,
    stopCamera,
    studioEffect,
  ]);

  const startCameraRecording = useCallback(() => {
    setError(null);
    setCameraError(null);
    setStudioPanel(null);
    setStudioMode('video');
    const stream = cameraStreamRef.current;
    if (!stream) {
      setCameraError(
        locale === 'id'
          ? 'Buka kamera dulu, baru rekam.'
          : 'Open the camera before recording.',
      );
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setCameraError(
        locale === 'id'
          ? 'Rekam langsung belum didukung. Pilih video dari galeri.'
          : 'Direct recording is not supported. Choose a gallery video.',
      );
      return;
    }

    const video = cameraVideoRef.current;
    let recorderStream: MediaStream = stream;
    let startProcessedFrames: (() => void) | null = null;

    if (video && needsReelsCanvasPipeline(form.filterPreset, studioEffect)) {
      const canvas = document.createElement('canvas');
      const width = performanceProfile.captureWidth;
      const height = performanceProfile.captureHeight;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
      });
      const canvasStream =
        context && typeof canvas.captureStream === 'function'
          ? canvas.captureStream(performanceProfile.captureFps)
          : null;

      if (context && canvasStream) {
        stream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
        recorderStream = canvasStream;

        const paintFrame = () => {
          const currentVideo = cameraVideoRef.current;
          if (!currentVideo || currentVideo.readyState < 2) return;
          context.clearRect(0, 0, width, height);
          context.filter = getReelFilterCss(form.filterPreset);
          drawVideoCoverFrame(context, currentVideo, width, height);
          context.filter = 'none';
          drawStudioCanvasEffect(context, width, height, studioEffect);
        };

        paintFrame();
        startProcessedFrames = () => {
          recordingFrameCleanupRef.current?.();
          recordingFrameCleanupRef.current = startVideoFramePump(
            video,
            performanceProfile.captureFps,
            paintFrame,
          );
        };
      }
    }

    const mimeType = selectReelsRecorderMimeType(
      performanceProfile.tier,
      type => MediaRecorder.isTypeSupported(type),
    );
    const recorderOptions = {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: performanceProfile.videoBitsPerSecond,
      audioBitsPerSecond: performanceProfile.audioBitsPerSecond,
    };
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(
        recorderStream,
        recorderOptions as MediaRecorderOptions,
      );
    } catch {
      recorder = mimeType
        ? new MediaRecorder(recorderStream, { mimeType })
        : new MediaRecorder(recorderStream);
    }

    recorderRef.current = recorder;
    recordingOutputStreamRef.current = recorderStream;
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
      recordingFrameCleanupRef.current?.();
      recordingFrameCleanupRef.current = null;
      const type = recorder.mimeType || 'video/webm';
      const blob = new Blob(recorderChunksRef.current, { type });
      if (blob.size > 0) {
        const extension = getReelsRecordingExtension(type);
        const recordedFile = new File(
          [blob],
          `lajukan-reels-${Date.now()}.${extension}`,
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
      stopCamera();
    };
    recorder.start(1000);
    startProcessedFrames?.();
    setRecording(true);
    setRecordingStartedAt(Date.now());
    setRecordingElapsedMs(0);
    recordingTimeoutRef.current = window.setTimeout(() => {
      const currentRecorder = recorderRef.current;
      if (currentRecorder && currentRecorder.state !== 'inactive') {
        currentRecorder.stop();
      }
    }, getStudioDurationMs(studioDuration));
  }, [
    form.filterPreset,
    locale,
    performanceProfile,
    setStudioMode,
    stopCamera,
    studioDuration,
    studioEffect,
  ]);

  const stopCameraRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      if (recordingTimeoutRef.current !== null) {
        window.clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      recordingFrameCleanupRef.current?.();
      recordingFrameCleanupRef.current = null;
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
    const interval = window.setInterval(updateElapsed, 500);
    return () => window.clearInterval(interval);
  }, [recording, recordingStartedAt]);

  useEffect(() => {
    if (!open) return;
    const handleVisibility = () => {
      if (!document.hidden || !cameraStreamRef.current) return;
      autoCameraAttemptedRef.current = true;
      stopCamera();
      setCameraError(
        locale === 'id'
          ? 'Kamera dijeda saat aplikasi tidak aktif. Ketuk tombol rekam untuk membukanya lagi.'
          : 'The camera was paused while the app was inactive. Tap record to reopen it.',
      );
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [locale, open, stopCamera]);

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
        detail.mode === 'link' ||
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
          mode === 'live'
            ? 'live'
            : mode === 'gallery' || mode === 'link'
              ? 'upload'
              : 'camera',
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
  const directVideoUrl = form.mediaUrl.trim();
  const isExternalVideoLink = Boolean(
    !file && directVideoUrl && isDirectVideoMediaUrl(directVideoUrl),
  );
  const selectedCaptureLabel = isExternalVideoLink
    ? 'Link video'
    : (selectedCaptureMode?.label ?? 'Kamera');
  const SelectedCaptureIcon = isExternalVideoLink
    ? Link2
    : (selectedCaptureMode?.icon ?? Camera);
  const activeStudioMode =
    REELS_STUDIO_MODES.find(mode => mode.id === studioMode) ||
    REELS_STUDIO_MODES[2];
  const ActiveStudioIcon = activeStudioMode.icon;
  const fieldLabelClass = 'text-xs font-bold text-slate-900 dark:text-white/84';
  const inputClass =
    'mt-1 h-10 w-full rounded-[13px] border border-slate-200 bg-white px-3 text-[13px] font-semibold !text-slate-950 outline-none placeholder:text-slate-400 focus:border-emerald-300/50 focus:bg-white dark:border-white/10 dark:bg-white/[0.08] dark:!text-white dark:placeholder:text-white/38 dark:focus:bg-white/[0.11]';
  const textareaClass =
    'mt-1 w-full resize-none rounded-[13px] border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold !text-slate-950 outline-none placeholder:text-slate-400 focus:border-emerald-300/50 focus:bg-white dark:border-white/10 dark:bg-white/[0.08] dark:!text-white dark:placeholder:text-white/38 dark:focus:bg-white/[0.11]';
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  };

  const handleFile = (nextFile: File | null) => {
    if (nextFile && nextFile.size > MEDIA_UPLOAD_RAW_MAX_BYTES) {
      setFile(null);
      setError(`Video terlalu besar. Maksimum ${MEDIA_UPLOAD_RAW_MAX_MB} MB.`);
      return;
    }
    if (nextFile && !isPlayableReelsVideoFile(nextFile)) {
      setFile(null);
      setError(
        'Reels saat ini hanya menerima video .mp4, .webm, .mov, atau .m4v.',
      );
      return;
    }
    setFile(nextFile);
    setError(null);
    setStudioPanel(null);
    if (nextFile && form.captureMode !== 'live') {
      setStudioMode('gallery');
      setField('captureMode', 'upload');
    }
    if (nextFile) {
      setField('mediaUrl', '');
    }
    if (nextFile && !form.title.trim()) {
      setField('title', buildCleanReelTitleFromFile(nextFile));
    }
    if (nextFile) {
      setStep('edit');
    }
  };

  const openLinkPanel = () => {
    stopCamera();
    setFile(null);
    setError(null);
    setStudioMode('link');
    setStudioPanel('link');
    setField('captureMode', 'upload');
  };

  const goNext = () => {
    setError(null);
    if (step === 'media') {
      if (!hasMedia) {
        setError(
          form.captureMode === 'live'
            ? 'Tambahkan poster atau teaser live dulu.'
            : 'Pilih video dulu sebelum lanjut.',
        );
        return;
      }
      if (!file && form.mediaUrl.trim()) {
        if (isImageMediaUrl(form.mediaUrl)) {
          setError(
            'Link gambar belum masuk feed reels. Pakai link video langsung.',
          );
          return;
        }
        if (!isDirectVideoMediaUrl(form.mediaUrl)) {
          setError(
            'Pakai direct link video HTTPS yang berakhir .mp4, .webm, .ogv, .mov, atau .m4v.',
          );
          return;
        }
      }
      setStep('edit');
      return;
    }
    if (step === 'edit') {
      setStep('post');
    }
  };

  const handleStudioCapture = () => {
    if (studioMode === 'link') {
      openLinkPanel();
      return;
    }
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

    const title =
      form.title.trim() ||
      form.hook.trim() ||
      (file ? buildCleanReelTitleFromFile(file) : 'Video usaha');
    const caption =
      form.caption.trim() || form.hook.trim() || `${title} dari ${displayName}`;
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
    if (file && !isPlayableReelsVideoFile(file)) {
      setError('Pilih file video .mp4, .webm, .mov, atau .m4v.');
      setStep('media');
      return;
    }
    if (!file && mediaUrl) {
      if (isImageMediaUrl(mediaUrl)) {
        setError(
          'Link gambar belum masuk feed reels. Pakai link video langsung.',
        );
        return;
      }
      if (!isDirectVideoMediaUrl(mediaUrl)) {
        setError(
          'Pakai direct link video HTTPS yang berakhir .mp4, .webm, .ogv, .mov, atau .m4v.',
        );
        return;
      }
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
        const optimizedFile = await prepareUploadFile(file);
        const data = new FormData();
        data.append('media', optimizedFile);
        const uploadResponse = await authFetch('/api/forum/upload-media', {
          method: 'POST',
          body: data,
        });
        const uploadPayload = (await uploadResponse
          .json()
          .catch(() => ({}))) as {
          urls?: string[];
          rejected?: Array<{ reason?: string }>;
          error?: string;
        };
        if (!uploadResponse.ok || !uploadPayload.urls?.[0]) {
          throw new Error(
            uploadPayload.error ||
              uploadPayload.rejected?.[0]?.reason ||
              'Upload media gagal',
          );
        }
        mediaUrl = uploadPayload.urls[0];
      }

      const mediaSource = file
        ? 'uploaded_file'
        : form.captureMode === 'live'
          ? 'live_teaser'
          : form.captureMode === 'camera'
            ? 'camera_capture'
            : isExternalVideoLink
              ? 'external_direct_video'
              : 'manual_media_url';
      const sourceKind =
        mediaSource === 'external_direct_video'
          ? 'direct_browser_playable_video'
          : mediaSource;

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
            mediaSource,
            sourceKind,
            external: mediaSource === 'external_direct_video',
            sourceUrl: mediaUrl,
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
      className="ui-layer-modal fixed inset-0 flex items-end bg-[color:color-mix(in_srgb,_var(--app-overlay)_86%,_transparent)] text-[color:var(--app-text)]  dark:bg-black/86 lg:items-center lg:justify-center lg:p-4"
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
          'relative flex h-[var(--app-visual-viewport-height)] max-h-[var(--app-visual-viewport-height)] w-full flex-col overflow-hidden bg-[color:var(--app-surface)] text-[color:var(--app-text)] shadow-2xl dark:bg-[#050505] dark:text-white',
          step === 'media'
            ? 'lg:max-w-[460px] lg:rounded-[32px] lg:ring-1 lg:ring-white/10'
            : 'lg:h-[calc(var(--app-visual-viewport-height)-2rem)] lg:max-w-[960px] lg:rounded-[30px] lg:ring-1 lg:ring-white/10',
        )}
      >
        <div
          className={cn(
            'mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-[color:var(--app-border)]/60 dark:bg-white/20 lg:hidden',
            step === 'media' && 'hidden',
          )}
        />
        <div
          className={cn(
            'items-center justify-between gap-3 border-b border-[color:var(--app-border)] px-3 py-2.5 sm:px-4 dark:border-white/10',
            step === 'media' ? 'hidden' : 'flex',
          )}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-accent)] dark:text-emerald-300">
              Reels
            </p>
            <h2 className="text-base font-bold">Kamera Reels</h2>
          </div>

          <div className="hidden items-center gap-1 rounded-full bg-[color:var(--app-surface-muted)] p-1 sm:flex dark:bg-white/10">
            {(['media', 'edit', 'post'] as UploadReelStep[]).map(
              (item, index) => (
                <span
                  key={item}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[11px] font-bold',
                    step === item
                      ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] shadow-sm dark:bg-white dark:text-slate-950'
                      : 'text-[color:var(--app-text-soft)] dark:text-white/58',
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
            className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] dark:bg-white/10 dark:text-white"
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
                  ? 'h-full w-full max-w-none sm:aspect-[9/16] sm:h-auto sm:max-h-[calc(var(--app-visual-viewport-height)-1.5rem)] sm:max-w-[420px] sm:self-center'
                  : 'w-full max-w-[340px]',
              )}
            >
              <div
                className={cn(
                  'relative overflow-hidden bg-[color:var(--app-surface-strong)] shadow-2xl ring-1 ring-[color:var(--app-border)] dark:bg-[#2d374b] dark:ring-white/10',
                  step === 'media'
                    ? 'h-full w-full rounded-none sm:rounded-[32px]'
                    : 'aspect-[9/16] max-h-[calc(var(--app-viewport-height)-128px)] rounded-[24px] lg:max-h-[calc(var(--app-viewport-height)-150px)]',
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
                      className="h-full w-full object-cover object-center"
                      style={previewMediaStyle}
                      muted
                      playsInline
                      autoPlay
                      aria-busy={cameraOpening}
                    />
                    {!cameraReady && (
                      <div className="absolute inset-0 grid place-items-center p-5 text-center text-white">
                        <div>
                          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-black/[0.34] ring-1 ring-white/[0.12]">
                            {cameraOpening ? (
                              <Loader2 className="h-7 w-7 animate-spin" />
                            ) : (
                              <Camera className="h-7 w-7" />
                            )}
                          </div>
                          <p className="mt-3 text-xs font-bold text-white/[0.84]">
                            {cameraOpening
                              ? locale === 'id'
                                ? 'Menyiapkan kamera...'
                                : 'Preparing camera...'
                              : locale === 'id'
                                ? 'Ketuk rekam untuk buka kamera'
                                : 'Tap record to open the camera'}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid h-full place-items-center p-6 text-center text-white">
                    <div>
                      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/[0.12]">
                        <Clapperboard className="h-8 w-8" />
                      </div>
                      <p className="mt-4 text-sm font-bold">Pilih media dulu</p>
                      <p className="mt-1 text-xs font-semibold text-white/[0.55]">
                        Reels tampil 9:16, video asli bisa langsung diputar.
                      </p>
                    </div>
                  </div>
                )}
                <StudioEffectOverlay effect={studioEffect} />

                {step !== 'media' && (form.hook || form.title) && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
                    <p className="text-[11px] font-bold text-yellow-300">
                      {form.tag}
                    </p>
                    <p className="mt-1 line-clamp-2 text-base font-bold leading-tight">
                      {form.hook || form.title}
                    </p>
                  </div>
                )}
                {step !== 'media' && (
                  <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1.5 text-[11px] font-bold text-white ">
                    <SelectedCaptureIcon className="h-3.5 w-3.5" />
                    {selectedCaptureLabel}
                  </div>
                )}
                {step !== 'media' && form.captureMode === 'live' && (
                  <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-xl">
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
                          className="grid h-10 w-10 place-items-center rounded-full bg-black/[0.38] text-white shadow-xl ring-1 ring-white/[0.12] transition active:scale-95"
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
                    <div className="mx-auto flex max-w-[240px] items-center justify-center rounded-full bg-black/[0.42] px-3 py-2 text-white shadow-2xl ring-1 ring-white/[0.12]">
                      <div className="flex items-center gap-2 text-[11px] font-bold">
                        <Camera className="h-4 w-4 text-emerald-200" />
                        <span>{selectedCaptureLabel}</span>
                        <span className="rounded-full bg-white/[0.12] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/[0.74]">
                          {locale === 'id' ? 'Mode cepat' : 'Quick mode'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {step === 'media' && (
                  <>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/[0.42] via-transparent to-black/[0.74]" />

                    <button
                      type="button"
                      onClick={onClose}
                      className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 grid h-10 w-10 place-items-center rounded-full bg-black/[0.34] text-white ring-1 ring-white/[0.12]"
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
                      className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-30 inline-flex max-w-[210px] -translate-x-1/2 items-center gap-2 rounded-full bg-black/[0.24] px-3 py-2 text-xs font-bold text-white ring-1 ring-white/10"
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
                        className="absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 grid h-10 w-10 place-items-center rounded-full bg-white text-slate-950 shadow-xl"
                        aria-label="Lanjut edit"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                    )}

                    <div className="absolute right-2 top-[calc(env(safe-area-inset-top)+4.75rem)] z-30 flex w-11 flex-col items-center gap-2 text-white">
                      {[
                        {
                          key: 'filters' as const,
                          label: 'Filter',
                          icon: SlidersHorizontal,
                          onClick: () =>
                            setStudioPanel(current =>
                              current === 'filters' ? null : 'filters',
                            ),
                          active: studioPanel === 'filters',
                        },
                        {
                          key: 'effects' as const,
                          label: 'Efek',
                          icon: Sparkles,
                          onClick: () =>
                            setStudioPanel(current =>
                              current === 'effects' ? null : 'effects',
                            ),
                          active: studioPanel === 'effects',
                        },
                        {
                          key: 'speed' as const,
                          label: studioSpeed,
                          icon: Clapperboard,
                          onClick: () =>
                            setStudioPanel(current =>
                              current === 'speed' ? null : 'speed',
                            ),
                          active: studioPanel === 'speed',
                        },
                        {
                          key: 'link' as const,
                          label: 'Link',
                          icon: Link2,
                          onClick: openLinkPanel,
                          active: studioPanel === 'link',
                        },
                        {
                          key: 'flip' as const,
                          label: 'Flip',
                          icon: RefreshCcw,
                          onClick: flipCamera,
                          active: false,
                        },
                      ].map(tool => {
                        const ToolIcon = tool.icon;
                        return (
                          <button
                            key={tool.key}
                            type="button"
                            onClick={tool.onClick}
                            className={cn(
                              'grid h-10 w-10 place-items-center rounded-full text-white shadow-lg ring-1 ring-white/[0.12] transition active:scale-95',
                              tool.active
                                ? 'bg-white text-slate-950'
                                : 'bg-black/[0.32]',
                            )}
                            aria-label={tool.label}
                            title={tool.label}
                          >
                            <ToolIcon className="h-4.5 w-4.5" />
                          </button>
                        );
                      })}
                    </div>

                    {cameraError && (
                      <div
                        className={cn(
                          'absolute inset-x-4 z-40 rounded-[16px] bg-amber-300/[0.18] px-3 py-2 text-center text-xs font-bold text-amber-50 ring-1 ring-amber-200/20',
                          studioPanel
                            ? 'bottom-[calc(env(safe-area-inset-bottom)+258px)]'
                            : 'bottom-[calc(env(safe-area-inset-bottom)+196px)]',
                        )}
                      >
                        {cameraError}
                      </div>
                    )}

                    <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+148px)] z-30 flex justify-center px-3">
                      {studioPanel ? (
                        <div className="w-full max-w-[340px] rounded-[24px] bg-black/[0.58] p-2 shadow-2xl ring-1 ring-white/[0.12]">
                          <div className="mb-2 flex items-center justify-between gap-2 px-1 text-white">
                            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/[0.64]">
                              {studioPanel === 'filters'
                                ? 'Filter'
                                : studioPanel === 'effects'
                                  ? 'Efek'
                                  : studioPanel === 'music'
                                    ? 'Audio'
                                    : studioPanel === 'link'
                                      ? 'Link video'
                                      : 'Speed'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setStudioPanel(null)}
                              className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white/70"
                              aria-label="Tutup panel"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {studioPanel === 'link' ? (
                            <div className="space-y-2">
                              <input
                                value={form.mediaUrl}
                                onChange={event => {
                                  setFile(null);
                                  setError(null);
                                  setStudioMode('link');
                                  setField('captureMode', 'upload');
                                  setField('mediaUrl', event.target.value);
                                }}
                                inputMode="url"
                                placeholder="https://.../video.mp4"
                                className="h-10 w-full rounded-[15px] border border-white/12 bg-white px-3 text-[12px] font-bold text-slate-950 outline-none placeholder:text-slate-400 focus:border-emerald-300"
                              />
                              <p className="px-1 text-[10px] font-semibold leading-4 text-white/[0.62]">
                                Pakai direct link video HTTPS: MP4, WebM, MOV,
                                atau M4V. Link YouTube/TikTok belum diputar
                                langsung.
                              </p>
                            </div>
                          ) : (
                            <div
                              ref={studioPanelRail.ref}
                              onClickCapture={studioPanelRail.onClickCapture}
                              onPointerCancel={studioPanelRail.onPointerCancel}
                              onPointerDown={studioPanelRail.onPointerDown}
                              onPointerLeave={studioPanelRail.onPointerLeave}
                              onPointerMove={studioPanelRail.onPointerMove}
                              onPointerUp={studioPanelRail.onPointerUp}
                              onWheel={studioPanelRail.onWheel}
                              className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none cursor-grab active:cursor-grabbing"
                            >
                              {studioPanel === 'filters'
                                ? REEL_FILTER_PRESETS.map(filter => {
                                    const active =
                                      form.filterPreset === filter.id;
                                    return (
                                      <button
                                        key={filter.id}
                                        type="button"
                                        onClick={() =>
                                          setField('filterPreset', filter.id)
                                        }
                                        className={cn(
                                          'flex min-w-[72px] shrink-0 flex-col items-center gap-1 rounded-[17px] px-2 py-2 text-[10px] font-bold transition active:scale-95',
                                          active
                                            ? 'bg-white text-slate-950'
                                            : 'bg-white/[0.09] text-white/[0.72]',
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            'h-9 w-9 rounded-full ring-1 ring-white/[0.18]',
                                            filter.swatch,
                                          )}
                                        />
                                        <span className="max-w-full truncate">
                                          {filter.label}
                                        </span>
                                      </button>
                                    );
                                  })
                                : studioPanel === 'effects'
                                  ? REELS_STUDIO_EFFECTS.map(effect => {
                                      const active = studioEffect === effect.id;
                                      return (
                                        <button
                                          key={effect.id}
                                          type="button"
                                          onClick={() =>
                                            setStudioEffect(effect.id)
                                          }
                                          className={cn(
                                            'flex min-w-[76px] shrink-0 flex-col items-center gap-1 rounded-[17px] px-2 py-2 text-[10px] font-bold transition active:scale-95',
                                            active
                                              ? 'bg-yellow-300 text-slate-950'
                                              : 'bg-white/[0.09] text-white/[0.72]',
                                          )}
                                        >
                                          <span
                                            className={cn(
                                              'h-9 w-9 rounded-full ring-1 ring-white/[0.18]',
                                              effect.swatch,
                                            )}
                                          />
                                          <span className="max-w-full truncate">
                                            {effect.label}
                                          </span>
                                        </button>
                                      );
                                    })
                                  : studioPanel === 'music'
                                    ? REELS_MUSIC_TRACKS.map(track => (
                                        <button
                                          key={track}
                                          type="button"
                                          onClick={() =>
                                            setField('musicTrack', track)
                                          }
                                          className={cn(
                                            'min-h-[40px] shrink-0 rounded-full px-3 text-[11px] font-bold transition active:scale-95',
                                            form.musicTrack === track
                                              ? 'bg-yellow-300 text-slate-950'
                                              : 'bg-white/[0.09] text-white/[0.72]',
                                          )}
                                        >
                                          {track}
                                        </button>
                                      ))
                                    : REELS_STUDIO_SPEEDS.map(speed => (
                                        <button
                                          key={speed}
                                          type="button"
                                          onClick={() => setStudioSpeed(speed)}
                                          className={cn(
                                            'grid h-11 w-14 shrink-0 place-items-center rounded-full text-[11px] font-bold transition active:scale-95',
                                            studioSpeed === speed
                                              ? 'bg-white text-slate-950'
                                              : 'bg-white/[0.09] text-white/[0.72]',
                                          )}
                                        >
                                          {speed}
                                        </button>
                                      ))}
                            </div>
                          )}
                        </div>
                      ) : recording ? (
                        <div className="w-[210px] overflow-hidden rounded-full bg-black/[0.52] px-3 py-2 text-[12px] font-bold text-white shadow-xl ring-1 ring-white/[0.12]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-rose-500" />
                              REC
                            </span>
                            <span>{recordingRemainingSeconds}s</span>
                          </div>
                          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/[0.16]">
                            <span
                              className="block h-full origin-left rounded-full bg-rose-500"
                              style={{
                                transform: `scaleX(${recordingProgress})`,
                              }}
                            />
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 rounded-full bg-black/[0.42] p-1 text-[12px] font-bold text-white/50 shadow-xl ring-1 ring-white/[0.12]">
                          {REELS_STUDIO_DURATIONS.map(duration => (
                            <button
                              key={duration}
                              type="button"
                              onClick={() => setStudioDuration(duration)}
                              className={cn(
                                'h-8 rounded-full px-3 transition',
                                studioDuration === duration
                                  ? 'bg-white text-slate-950'
                                  : 'text-white/[0.62]',
                              )}
                            >
                              {duration}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-[54px_minmax(76px,1fr)_54px_54px] items-end gap-2 text-white min-[390px]:inset-x-5 min-[390px]:grid-cols-[58px_minmax(82px,1fr)_58px_58px]">
                      <button
                        type="button"
                        onClick={() =>
                          setStudioPanel(current =>
                            current === 'effects' ? null : 'effects',
                          )
                        }
                        className="flex flex-col items-center gap-1 text-[11px] font-bold"
                      >
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-black/[0.32] ring-1 ring-white/[0.14]">
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
                        disabled={cameraOpening || submitting}
                        className={cn(
                          'mx-auto grid h-[76px] w-[76px] place-items-center rounded-full border-4 border-white shadow-2xl transition active:scale-95 disabled:cursor-wait disabled:opacity-70',
                          recording ? 'bg-rose-500' : 'bg-white/[0.12]',
                        )}
                        aria-label={
                          locale === 'id'
                            ? 'Ambil media Reels'
                            : 'Capture Reels media'
                        }
                      >
                        {cameraOpening ? (
                          <Loader2 className="h-7 w-7 animate-spin" />
                        ) : recording ? (
                          <span className="h-8 w-8 rounded-[8px] bg-white" />
                        ) : studioMode === 'photo' ? (
                          <Camera className="h-8 w-8" />
                        ) : studioMode === 'live' ? (
                          <Radio className="h-8 w-8" />
                        ) : (
                          <span className="h-14 w-14 rounded-full bg-rose-500 ring-4 ring-rose-400/35" />
                        )}
                      </button>

                      <label className="flex cursor-pointer flex-col items-center gap-1 text-[11px] font-bold">
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-black/[0.32] ring-1 ring-white/[0.14]">
                          <Upload className="h-5 w-5 text-orange-200" />
                        </span>
                        Upload
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                          onChange={event =>
                            handleFile(event.target.files?.[0] ?? null)
                          }
                          className="sr-only"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={openLinkPanel}
                        className="flex flex-col items-center gap-1 text-[11px] font-bold"
                      >
                        <span
                          className={cn(
                            'grid h-11 w-11 place-items-center rounded-xl ring-1 ring-white/[0.14]',
                            isExternalVideoLink
                              ? 'bg-emerald-300 text-slate-950'
                              : 'bg-white/[0.18] text-white',
                          )}
                        >
                          <Link2 className="h-5 w-5 text-inherit" />
                        </span>
                        Link
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div
              className={cn(
                'min-w-0 !text-slate-950 dark:!text-white',
                step === 'media' && 'hidden',
              )}
            >
              {step === 'media' && (
                <div className="space-y-3">
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.06] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                          {activeStudioMode.label}
                        </p>
                        <h3 className="truncate text-base font-bold">
                          {studioMode === 'gallery'
                            ? 'Pilih dari galeri'
                            : studioMode === 'photo'
                              ? 'Ambil foto produk'
                              : studioMode === 'link'
                                ? 'Tempel link video'
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
                      <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-bold text-white ring-1 ring-white/10 transition active:scale-[0.98]">
                        <Upload className="h-4 w-4" />
                        Galeri
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
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
                          if (studioMode === 'link') {
                            openLinkPanel();
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
                          recording ? 'bg-rose-500' : 'bg-white/[0.18]',
                        )}
                        aria-label="Ambil media reels"
                      >
                        {recording ? (
                          <span className="h-6 w-6 rounded-[6px] bg-white" />
                        ) : studioMode === 'photo' ? (
                          <Camera className="h-7 w-7" />
                        ) : studioMode === 'link' ? (
                          <Link2 className="h-7 w-7" />
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
                          studioMode === 'gallery' ||
                          studioMode === 'link' ||
                          studioMode === 'live'
                        }
                        className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-slate-950 transition active:scale-[0.98] disabled:bg-white/10 disabled:text-white/38"
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
                    <div className="flex items-center gap-2 text-xs font-bold text-white/82">
                      <SlidersHorizontal className="h-4 w-4 text-emerald-300" />
                      Filter
                    </div>
                    <div
                      ref={studioFilterRail.ref}
                      onClickCapture={studioFilterRail.onClickCapture}
                      onPointerCancel={studioFilterRail.onPointerCancel}
                      onPointerDown={studioFilterRail.onPointerDown}
                      onPointerLeave={studioFilterRail.onPointerLeave}
                      onPointerMove={studioFilterRail.onPointerMove}
                      onPointerUp={studioFilterRail.onPointerUp}
                      onWheel={studioFilterRail.onWheel}
                      className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none cursor-grab active:cursor-grabbing"
                    >
                      {REEL_FILTER_PRESETS.map(filter => {
                        const active = form.filterPreset === filter.id;
                        return (
                          <button
                            key={filter.id}
                            type="button"
                            onClick={() => setField('filterPreset', filter.id)}
                            className={cn(
                              'inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-2.5 text-[11px] font-bold ring-1 transition active:scale-95',
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
                    <div className="flex items-center gap-2 text-xs font-bold text-white/82">
                      <Music className="h-4 w-4 text-yellow-300" />
                      Musik
                    </div>
                    <div
                      ref={studioMusicRail.ref}
                      onClickCapture={studioMusicRail.onClickCapture}
                      onPointerCancel={studioMusicRail.onPointerCancel}
                      onPointerDown={studioMusicRail.onPointerDown}
                      onPointerLeave={studioMusicRail.onPointerLeave}
                      onPointerMove={studioMusicRail.onPointerMove}
                      onPointerUp={studioMusicRail.onPointerUp}
                      onWheel={studioMusicRail.onWheel}
                      className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none cursor-grab active:cursor-grabbing"
                    >
                      {REELS_MUSIC_TRACKS.map(track => (
                        <button
                          key={track}
                          type="button"
                          onClick={() => setField('musicTrack', track)}
                          className={cn(
                            'h-9 shrink-0 rounded-full px-3 text-[11px] font-bold ring-1 transition active:scale-95',
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
                    Media bisa dari kamera, file video perangkat, atau direct
                    link video yang bisa diputar browser.
                  </div>

                  {studioMode === 'live' && (
                    <div className="rounded-[18px] border border-rose-400/20 bg-rose-500/10 p-3 text-xs font-semibold leading-5 text-rose-50">
                      Pilih poster dari galeri, lalu isi judul dan jadwal live.
                    </div>
                  )}

                  <label className="hidden cursor-pointer rounded-[18px] border-2 border-dashed border-white/12 bg-white/[0.05] p-4 text-center transition hover:border-emerald-300">
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                      onChange={event =>
                        handleFile(event.target.files?.[0] ?? null)
                      }
                      className="sr-only"
                    />
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-sm font-bold text-[color:var(--app-text)]">
                      {form.captureMode === 'camera'
                        ? 'Atau pilih dari galeri'
                        : form.captureMode === 'live'
                          ? 'Pilih poster / teaser live'
                          : 'Pilih dari perangkat'}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[color:var(--app-text-soft)]">
                      MP4, WebM, MOV, JPG, PNG, WebP
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                      Video sampai 80 MB aman, jadi 16 MB harusnya lolos kalau
                      file-nya valid.
                    </p>
                  </label>

                  {file && (
                    <div className="rounded-2xl bg-white/[0.08] px-3 py-2 text-xs font-bold text-white/62">
                      Terpilih: {file.name} · {formatFileSize(file.size)}
                    </div>
                  )}
                </div>
              )}

              {step === 'edit' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                      Langkah 2
                    </p>
                    <h3 className="text-lg font-bold leading-tight">
                      Rapikan reels
                    </h3>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-white/52">
                      Media sudah dipilih, jadi fokusnya tinggal caption dan
                      kategori.
                    </p>
                  </div>

                  {file && (
                    <div className="rounded-[18px] border border-emerald-300/20 bg-emerald-500/10 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-200">
                            Media terpilih
                          </p>
                          <p className="truncate text-sm font-bold text-slate-950 dark:text-white">
                            {file.name}
                          </p>
                          <p className="text-xs font-semibold text-slate-500 dark:text-white/58">
                            {file.type || 'Media'} | {formatFileSize(file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setStep('media')}
                          className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-950"
                        >
                          Ganti
                        </button>
                      </div>
                    </div>
                  )}

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
                          'rounded-full px-3 py-2 text-xs font-bold',
                          form.tag === chip
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-white/64',
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
                    <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                      Posting
                    </p>
                    <h3 className="text-lg font-bold leading-tight">
                      Teks singkat
                    </h3>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-white/52">
                      Isi yang penting saja. Sisanya opsional.
                    </p>
                  </div>

                  {form.captureMode === 'live' && (
                    <div className="rounded-[18px] border border-rose-100 bg-rose-50/80 p-3">
                      <div className="flex items-center gap-2 text-rose-700">
                        <Radio className="h-4 w-4" />
                        <p className="text-xs font-bold uppercase tracking-wide">
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
                className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 dark:border-white/14 dark:bg-transparent dark:text-white"
              >
                Kembali
              </button>
            )}

            {step !== 'post' ? (
              <button
                type="button"
                onClick={goNext}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-700/20"
              >
                Lanjut
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 disabled:opacity-60"
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
    <div className="ui-layer-modal fixed inset-0 flex items-end bg-black/65 text-slate-950  sm:items-center sm:justify-center sm:p-5">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0"
      />
      <section className="relative w-full rounded-t-[28px] bg-white p-4 shadow-2xl sm:max-w-[420px] sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
              Perlu akun
            </p>
            <h2 className="mt-1 text-xl font-bold">Masuk dulu</h2>
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
            className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-bold text-slate-800"
          >
            Daftar
          </Link>
          <Link
            href={loginHref}
            className="rounded-2xl bg-emerald-700 px-4 py-3 text-center text-sm font-bold text-white"
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
  locale,
  loading,
  error,
  onRetry,
}: {
  locale: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (!loading && !error) return null;
  const isId = locale === 'id';

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+6rem)] z-40 flex justify-center px-3">
      <div className="pointer-events-auto flex min-h-10 min-w-0 max-w-full items-center gap-2 rounded-xl bg-black/[0.72] px-3 py-2 text-[11px] font-bold leading-4 text-white shadow-xl ring-1 ring-white/[0.14]">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            <span>{isId ? 'Memuat video...' : 'Loading videos...'}</span>
          </>
        ) : (
          <>
            <span className="min-w-0 line-clamp-2">{error}</span>
            <button
              type="button"
              onClick={onRetry}
              className="min-h-8 shrink-0 whitespace-nowrap rounded-lg bg-white px-2.5 text-[10px] font-bold text-slate-950 transition active:scale-95"
            >
              {isId ? 'Coba lagi' : 'Retry'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}
