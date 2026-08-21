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
  Eye,
  Flag,
  Forward,
  Hash,
  Heart,
  Home,
  Images,
  Info,
  Link2,
  Loader2,
  MapPin,
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
  buildLocalizedHref as localizedHref,
  formatReelCommentTime as formatCommentTime,
  isDirectReelVideoUrl as isDirectVideoMediaUrl,
  isReelImageUrl as isImageMediaUrl,
} from '@/lib/reels/presentation';
import { resolveCanonicalReelContentHref } from '@/lib/reels/conversionLinks';
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
  TRUST_REPORT_REASONS,
  markReelNotInterested,
  submitTrustReport,
  type TrustReportReason,
} from '@/lib/community/trustSafety';
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

type ReelsSignal = 'watch' | 'share' | 'detail' | 'product' | 'store';

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

type ReelVisibility = 'public' | 'followers' | 'private';

type UploadReelForm = {
  captureMode: NonNullable<LajukanReel['captureMode']>;
  filterPreset: NonNullable<LajukanReel['filterPreset']>;
  musicTrack: string;
  /** Internal compatibility fields. The publish UI derives these automatically. */
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
  contentGoal: ReelContentGoal;
  location: string;
  visibility: ReelVisibility;
  allowComments: boolean;
  shareToMainFeed: boolean;
  promotionalContent: boolean;
  aiGenerated: boolean;
  coverTimestampMs: number;
};

type UploadReelStep = 'media' | 'edit' | 'post';

type ReelContentGoal = 'discover' | 'product' | 'education' | 'promo' | 'process';

type ReelStoreOption = {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  phone?: string | null;
};

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
const REELS_LIVE_ENABLED =
  process.env.NEXT_PUBLIC_REELS_LIVE_ENABLED === 'true';
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
    const queryReel =
      parsed.searchParams.get('video')?.trim() ||
      parsed.searchParams.get('reel')?.trim();
    if (queryReel) return queryReel;
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts[0] === 'reels' && pathParts[1]?.trim()) {
      return pathParts[1].trim();
    }
    return '';
  } catch {
    const match = directHref.match(/[?&](?:video|reel)=([^&#]+)/i);
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
  contentGoal: 'discover',
  location: '',
  visibility: 'public',
  allowComments: true,
  shareToMainFeed: true,
  promotionalContent: false,
  aiGenerated: false,
  coverTimestampMs: 0,
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

const REELS_MUSIC_TRACKS = [
  'Original sound',
  'Beat UMKM',
  'Soft promo',
  'Live shop',
  'Packing ASMR',
];

const REELS_STUDIO_SPEEDS = ['0,25x', '0,5x', '1x', '1,5x', '2x'] as const;
const REELS_STUDIO_DURATIONS = ['15s', '30s', '60s', '90s'] as const;

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
  store: 5.6,
};

const BACKEND_SIGNAL_EVENT: Record<ReelsSignal, string> = {
  watch: 'watch',
  share: 'share',
  detail: 'view',
  product: 'open_product',
  store: 'open_store',
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
  if (!REELS_LIVE_ENABLED) return null;
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

  if (reel) {
    const fallbackVideo = reel.baseId || reel.id.split(':').at(-1) || '1';
    url.searchParams.set('video', fallbackVideo);
    url.searchParams.delete('reel');
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

function readReelMetadataBoolean(
  reel: LajukanReel,
  ...keys: string[]
): boolean {
  const metadata = reel.metadata;
  if (!metadata) return false;

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'friend', 'mutual'].includes(normalized)) {
        return true;
      }
    }
  }

  return false;
}

function getReelCreatorKey(reel: LajukanReel): string {
  return String(reel.creatorUserId || reel.creator || '')
    .trim()
    .toLowerCase();
}

function isFriendOrMutualReel(reel: LajukanReel): boolean {
  const relationship = readReelMetadataText(
    reel,
    'relationship',
    'viewer_relationship',
    'social_relationship',
  ).toLowerCase();

  return (
    ['friend', 'friends', 'mutual', 'mutual_follow'].includes(relationship) ||
    readReelMetadataBoolean(
      reel,
      'is_friend',
      'friend',
      'mutual_follow',
      'mutualFollow',
      'viewer_mutual_follow',
    )
  );
}

function diversifyReelSequence(source: LajukanReel[]): LajukanReel[] {
  if (source.length < 3) return source;

  const remaining = [...source];
  const result: LajukanReel[] = [];

  while (remaining.length > 0) {
    const previous = result[result.length - 1];
    const previousCreator = previous ? getReelCreatorKey(previous) : '';
    const previousTag = previous?.tag?.trim().toLowerCase() || '';

    let candidateIndex = 0;
    if (previous) {
      const differentCreatorAndTopic = remaining.findIndex(candidate => {
        const candidateCreator = getReelCreatorKey(candidate);
        const candidateTag = candidate.tag?.trim().toLowerCase() || '';
        return (
          candidateCreator !== previousCreator &&
          (!previousTag || !candidateTag || candidateTag !== previousTag)
        );
      });
      const differentCreator = remaining.findIndex(
        candidate => getReelCreatorKey(candidate) !== previousCreator,
      );
      candidateIndex =
        differentCreatorAndTopic >= 0
          ? differentCreatorAndTopic
          : differentCreator >= 0
            ? differentCreator
            : 0;
    }

    const [candidate] = remaining.splice(candidateIndex, 1);
    if (candidate) result.push(candidate);
  }

  return result;
}

function getReelBusinessPresentation(reel: LajukanReel) {
  const raw = reel as unknown as Record<string, unknown>;
  const readRaw = (...keys: string[]) => {
    for (const key of keys) {
      const value = raw[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  };

  const name =
    readRaw('storeName', 'store_name', 'businessName', 'business_name') ||
    readReelMetadataText(reel, 'store_name', 'storeName', 'business_name');
  const href =
    readRaw('storefrontPath', 'storefront_path', 'storeHref', 'store_href') ||
    readReelMetadataText(
      reel,
      'storefront_path',
      'storefrontPath',
      'store_href',
    );
  const city =
    readRaw('storeCity', 'store_city') ||
    readReelMetadataText(reel, 'store_city', 'storeCity');
  const storeId =
    readRaw('storeId', 'store_id') ||
    readReelMetadataText(reel, 'linkedStoreId', 'linked_store_id', 'store_id');
  const explicit = Boolean(
    readReelMetadataText(reel, 'linkedStoreId', 'linked_store_id') ||
      (storeId && !storeId.toLowerCase().startsWith('store-')),
  );

  return { name, href, city, storeId, explicit };
}

function getReelMusicLabel(reel: LajukanReel): string {
  const direct = readReelMetadataText(
    reel,
    'musicTrack',
    'music_track',
    'audio_title',
    'sound_title',
  );
  if (direct) return direct;

  const metadata = reel.metadata;
  if (!metadata || typeof metadata !== 'object') return '';
  const studio = metadata.studio;
  if (!studio || typeof studio !== 'object' || Array.isArray(studio)) return '';
  const value = (studio as Record<string, unknown>).musicTrack;
  return typeof value === 'string' ? value.trim() : '';
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
  const initialReelId = normalizedInitialItems[safeInitialIndex]?.id || '';

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
  const [feedTab, setFeedTab] = useState<ReelsFeedTab>('fyp');
  const [followedCreatorIds, setFollowedCreatorIds] = useState<string[]>([]);
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
  const [whyReel, setWhyReel] = useState<LajukanReel | null>(null);
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


  const followingStorageKey = useMemo(
    () => `${PROFILE_SOCIAL_STORAGE_KEY}:${user?.id || 'me'}`,
    [user?.id],
  );

  const syncFollowedCreatorIds = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(followingStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setFollowedCreatorIds(
        Array.isArray(parsed)
          ? parsed.map(item => String(item).trim()).filter(Boolean)
          : [],
      );
    } catch {
      setFollowedCreatorIds([]);
    }
  }, [followingStorageKey]);

  useEffect(() => {
    syncFollowedCreatorIds();
    if (typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === followingStorageKey) {
        syncFollowedCreatorIds();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', syncFollowedCreatorIds);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', syncFollowedCreatorIds);
    };
  }, [followingStorageKey, syncFollowedCreatorIds]);

  const persistFollowedCreator = useCallback(
    (creatorUserId: string | null | undefined, active: boolean) => {
      const creatorId = String(creatorUserId || '').trim();
      if (!creatorId) return;

      setFollowedCreatorIds(current => {
        const nextSet = new Set(current);
        if (active) nextSet.add(creatorId);
        else nextSet.delete(creatorId);
        const next = Array.from(nextSet);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(followingStorageKey, JSON.stringify(next));
          } catch {
            // Best effort: server action remains the source of truth.
          }
        }
        return next;
      });
    },
    [followingStorageKey],
  );

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

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;
    const previousRootOverflow = root.style.overflow;
    const previousRootOverscroll = root.style.overscrollBehavior;

    // Reels owns the viewport while mounted. Lock both scrolling roots so
    // wheel/touch input cannot leak to the page behind the snap container.
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    root.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
      root.style.overflow = previousRootOverflow;
      root.style.overscrollBehavior = previousRootOverscroll;
    };
  }, []);

  const overlayOpen =
    searchOpen ||
    detailReel !== null ||
    productReel !== null ||
    commentsReel !== null ||
    shareReel !== null ||
    actionsReel !== null ||
    creatorProfileReel !== null ||
    whyReel !== null ||
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

  const followedCreatorSet = useMemo(
    () => new Set(followedCreatorIds.map(id => id.trim()).filter(Boolean)),
    [followedCreatorIds],
  );

  const fypItems = useMemo(() => diversifyReelSequence(items), [items]);
  const initialFypIndex = useMemo(() => {
    if (!initialReelId) return 0;
    const index = fypItems.findIndex(item => item.id === initialReelId);
    return index >= 0 ? index : 0;
  }, [fypItems, initialReelId]);

  const visibleItems = useMemo(() => {
    if (feedTab === 'fyp') return fypItems;

    if (feedTab === 'following') {
      return diversifyReelSequence(
        items.filter(reel => {
          const creatorId = String(reel.creatorUserId || '').trim();
          return (
            (creatorId && followedCreatorSet.has(creatorId)) ||
            Boolean(actionsByReel[reel.id]?.followed)
          );
        }),
      );
    }

    return diversifyReelSequence(items.filter(isFriendOrMutualReel));
  }, [actionsByReel, feedTab, followedCreatorSet, fypItems, items]);

  const hasEndSlide = !hasMore && visibleItems.length > 0;
  const reelPageCount = visibleItems.length + (hasEndSlide ? 1 : 0);

  const activeReel = useMemo(() => {
    if (visibleItems.length === 0) return null;
    if (activeIndex >= visibleItems.length) return null;
    return visibleItems[activeIndex] || null;
  }, [activeIndex, visibleItems]);
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

  const sendReelEvent = useCallback(
    (
      reel: LajukanReel,
      event: string,
      metadata: Record<string, unknown> = {},
    ) => {
      const request = isAuthenticated ? authFetch : fetch;
      void request(`/api/reels/${encodeURIComponent(reel.id)}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          metadata: {
            ...metadata,
            feed_tab: feedTab,
            source_query: activeSearchQuery || undefined,
            performance_tier: performanceProfile.tier,
          },
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
      activeSearchQuery,
      authFetch,
      feedTab,
      isAuthenticated,
      performanceProfile.tier,
      replaceReel,
    ],
  );

  const recordSignal = useCallback(
    (
      reel: LajukanReel,
      signal: ReelsSignal,
      metadata: Record<string, unknown> = {},
    ) => {
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
          page: `/reels?video=${encodeURIComponent(reel.id)}`,
          properties: {
            target_user_id: reel.creatorUserId,
            target_username: reel.creator,
            target_name: reel.creator,
            target_href: `/reels?video=${encodeURIComponent(reel.id)}`,
            entity_label: reel.title,
            actor_user_id: user.id,
            actor_username: user.username || '',
            actor_name: user.name || user.fullName || user.username || '',
            actor_avatar_url: user.avatarUrl || user.avatar_url || '',
            source: 'reels',
          },
        });
      }

      sendReelEvent(reel, BACKEND_SIGNAL_EVENT[signal], {
        signal,
        ...metadata,
      });
    },
    [
      sendReelEvent,
      user?.avatarUrl,
      user?.avatar_url,
      user?.fullName,
      user?.id,
      user?.name,
      user?.username,
    ],
  );

  const recordWatchObservation = useCallback(
    (
      reel: LajukanReel,
      observation: {
        watchMs: number;
        durationMs: number | null;
        completionRatio: number | null;
        outcome: 'skip' | 'engaged' | 'complete';
        muted: boolean;
      },
    ) => {
      const weight =
        observation.outcome === 'complete'
          ? 1.65
          : observation.outcome === 'engaged'
            ? 0.72
            : 0;

      if (weight > 0) {
        setProfile(current => {
          const next = boostProfile(current, reelTokens(reel), weight);
          writeProfile(next);
          return next;
        });
      }

      sendReelEvent(reel, 'watch', {
        signal: 'watch',
        watch_ms: Math.max(0, Math.round(observation.watchMs)),
        duration_ms:
          observation.durationMs == null
            ? undefined
            : Math.max(0, Math.round(observation.durationMs)),
        completion_ratio:
          observation.completionRatio == null
            ? undefined
            : Number(observation.completionRatio.toFixed(4)),
        outcome: observation.outcome,
        muted: observation.muted,
      });
    },
    [sendReelEvent],
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
        if (action === 'follow') {
          persistFollowedCreator(reel.creatorUserId, nextActive);
        }
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
          page: `/reels?video=${encodeURIComponent(reel.id)}`,
            properties: {
              target_user_id: reel.creatorUserId,
              target_username: reel.creator,
              target_name: reel.creator,
              target_href: `/reels?video=${encodeURIComponent(reel.id)}`,
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
      persistFollowedCreator,
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
      setShareReel(reel);
    },
    [],
  );

  const dismissNotInterestedReel = useCallback(
    (reelId: string) => {
      setItems(current => current.filter(item => item.id !== reelId));
      setActiveIndex(current =>
        Math.min(current, Math.max(items.length - 2, 0)),
      );
      setShareReel(current => (current?.id === reelId ? null : current));
      setActionsReel(current => (current?.id === reelId ? null : current));
      setDetailReel(current => (current?.id === reelId ? null : current));
    },
    [items.length],
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

  useEffect(() => {
    if (feedTab === 'fyp' || visibleItems.length >= 3 || !hasMore || loadingMore) {
      return;
    }
    void loadMore();
  }, [feedTab, hasMore, loadMore, loadingMore, visibleItems.length]);

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
      const response = await fetch(
        `/api/reels/${encodeURIComponent(reelId)}/comments?${params.toString()}`,
        requestOptions,
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

        void trackLajukanEvent('reels.chat_started', {
          entityType: 'reel',
          entityId: reel.id,
          properties: {
            target_user_id: targetUserId,
            source: sourceComment ? 'reels_comment' : 'reels',
            room_id: roomId,
          },
        });

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
      startChatWithUser(reel.creatorUserId, reel, sourceComment),
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

      const response = await authFetch(
        `/api/reels/${encodeURIComponent(commentsReel.id)}/comments`,
        requestOptions,
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
            page: `/reels?video=${encodeURIComponent(commentsReel.id)}`,
            properties: {
              target_user_id: commentsReel.creatorUserId,
              target_username: commentsReel.creator,
              target_name: commentsReel.creator,
              target_href: `/reels?video=${encodeURIComponent(commentsReel.id)}`,
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
    (index: number, behavior: ScrollBehavior = 'auto') => {
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
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,[contenteditable=\"true\"]')) {
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault();
        snapToAdjacent(1);
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        snapToAdjacent(-1);
        return;
      }

      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        toggleCurrentVideo();
        return;
      }

      if (event.key.toLowerCase() === 'm') {
        event.preventDefault();
        toggleSound();
        return;
      }

      if (event.key.toLowerCase() === 'l' && activeReel) {
        event.preventDefault();
        void handleReelAction(activeReel, 'like');
        return;
      }

      if (event.key.toLowerCase() === 'c' && activeReel) {
        event.preventDefault();
        openComments(activeReel);
      }
    },
    [activeReel, handleReelAction, openComments, overlayOpen, snapToAdjacent],
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
      setFeedTab('fyp');
      setActiveIndex(0);
      setPausedByUser(false);
      setUploadOpen(false);
      window.requestAnimationFrame(() => {
        containerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
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
      setActiveIndex(initialFypIndex);
      container.scrollTo({
        top: initialFypIndex * container.clientHeight,
        behavior: 'auto',
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [initialFypIndex]);

  useEffect(() => {
    if (activeIndex >= visibleItems.length - 3) {
      void loadMore();
    }
  }, [activeIndex, loadMore, visibleItems.length]);

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
    if (!activeReel || overlayOpen || !pageVisible || pausedByUser) return;

    const startedAt = performance.now();
    const startedMuted = muted;
    const reel = activeReel;

    return () => {
      const watchMs = Math.max(0, performance.now() - startedAt);
      if (watchMs < 350) return;

      const video = videoRefs.current[reel.id];
      const durationMs =
        video && Number.isFinite(video.duration) && video.duration > 0
          ? video.duration * 1000
          : null;
      const completionRatio =
        durationMs && durationMs > 0 ? Math.min(1, watchMs / durationMs) : null;
      const outcome: 'skip' | 'engaged' | 'complete' =
        completionRatio != null && completionRatio >= 0.9
          ? 'complete'
          : watchMs >= 2200
            ? 'engaged'
            : 'skip';

      recordWatchObservation(reel, {
        watchMs,
        durationMs,
        completionRatio,
        outcome,
        muted: startedMuted,
      });
    };
  }, [
    activeReel,
    muted,
    overlayOpen,
    pageVisible,
    pausedByUser,
    recordWatchObservation,
  ]);

  useEffect(() => {
    if (
      !autoScroll ||
      overlayOpen ||
      pausedByUser ||
      !pageVisible ||
      visibleItems.length <= 1
    )
      return;

    const timer = window.setTimeout(() => {
      const nextIndex =
        activeIndex >= visibleItems.length - 1 ? 0 : activeIndex + 1;
      scrollToIndex(nextIndex);
    }, REELS_AUTO_SCROLL_MS);

    return () => window.clearTimeout(timer);
  }, [
    activeIndex,
    autoScroll,
    visibleItems.length,
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

  const changeFeedTab = useCallback(
    (nextTab: ReelsFeedTab) => {
      if (nextTab !== 'fyp' && !isAuthenticated) {
        setAuthPrompt(
          locale === 'id'
            ? 'Masuk dulu untuk melihat Reels dari teman atau akun yang kamu ikuti.'
            : 'Sign in to see Reels from friends or accounts you follow.',
        );
        return;
      }

      setFeedTab(nextTab);
      setActiveIndex(0);
      setPausedByUser(false);
      setPlaybackError(null);
      window.requestAnimationFrame(() => {
        containerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      });
    },
    [isAuthenticated, locale],
  );

  const resetRecommendations = useCallback(() => {
    const next = emptyProfile();
    setProfile(next);
    writeProfile(next);
    setSearchContextQuery('');
    notify({
      title: locale === 'id' ? 'Rekomendasi direset' : 'Recommendations reset',
      description:
        locale === 'id'
          ? 'FYP akan belajar lagi dari tontonan dan interaksi berikutnya.'
          : 'For You will learn again from your next watches and interactions.',
      variant: 'success',
    });
  }, [locale, notify]);

  const openStoreFromReel = useCallback(
    (reel: LajukanReel) => {
      const business = getReelBusinessPresentation(reel);
      if (!business.href) {
        recordSignal(reel, 'detail', { source: 'store_cta_fallback' });
        setDetailReel(reel);
        return;
      }
      recordSignal(reel, 'store', {
        source: 'reel_business_cta',
        store_name: business.name || undefined,
      });
      const storeHref = localizedHref(locale, business.href);
      void trackLajukanEvent('reels.marketplace_clicked', {
        entityType: 'reel',
        entityId: reel.id,
        page: storeHref,
        properties: {
          source: 'reel_business_cta',
          target_type: 'store',
          target_href: storeHref,
        },
      });
      router.push(storeHref);
    },
    [locale, recordSignal, router],
  );

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
      className="ui-layer-header fixed inset-x-0 bottom-0 top-[var(--app-viewport-offset-top)] isolate min-h-0 w-full min-w-0 overflow-hidden overscroll-none bg-[#090909] text-white [touch-action:pan-y]"
      data-reels-performance={performanceProfile.tier}
    >
      <div className="relative h-full min-h-0 w-full overflow-hidden bg-[#090909]">
        <div className="relative mx-auto grid h-full min-h-0 w-full min-w-0 grid-cols-1 overflow-hidden bg-[#090909] sm:max-w-[560px] sm:justify-center xl:max-w-[1040px] xl:grid-cols-[220px_minmax(0,600px)] 2xl:max-w-[1380px] 2xl:grid-cols-[240px_minmax(0,620px)_360px]">
          <ReelsDesktopSidebar
            locale={locale}
            feedTab={feedTab}
            learnedTerms={learnedTerms}
            muted={muted}
            displayName={displayName}
            onFeedTabChange={changeFeedTab}
            onToggleSound={toggleSound}
            onOpenSearch={openSearchOverlay}
            onOpenUpload={requestUpload}
            onResetRecommendations={resetRecommendations}
          />

          <section className="relative h-full min-h-0 min-w-0 w-full overflow-hidden bg-black sm:border-x sm:border-white/10 lg:w-full">
            <ReelsTopBar
              locale={locale}
              searchQuery={activeSearchQuery}
              feedTab={feedTab}
              onFeedTabChange={changeFeedTab}
              onOpenSearch={() => openSearchOverlay(activeSearchQuery)}
              onOpenUpload={requestUpload}
            />

            <div
              ref={containerRef}
              onScroll={handleScroll}
              onKeyDown={handleReelsKeyDown}
              tabIndex={0}
              aria-label={
                locale === 'id'
                  ? 'Feed Reels Lajukan. Gunakan panah atas dan bawah untuk berpindah video.'
                  : 'Lajukan Reels feed. Use up and down arrows to move between videos.'
              }
              className="h-full min-h-0 max-h-full w-full min-w-0 snap-y snap-mandatory overflow-x-hidden overflow-y-auto overscroll-y-none outline-none [scroll-behavior:auto] [scrollbar-width:none] [touch-action:pan-y] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
            >
              {visibleItems.length > 0 ? (
                <>
                  {visibleItems.map((reel, index) => (
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
                      buffering={bufferingId === reel.id && index === activeIndex}
                      actionState={
                        actionsByReel[reel.id] || EMPTY_REEL_ACTION_STATE
                      }
                      setVideoRef={node => {
                        if (node) videoRefs.current[reel.id] = node;
                        else delete videoRefs.current[reel.id];
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
                      onOpenCreatorProfile={() => setCreatorProfileReel(reel)}
                      onOpenDetail={() => {
                        recordSignal(reel, 'detail');
                        setDetailReel(reel);
                      }}
                      onOpenComments={() => openComments(reel)}
                      onOpenProduct={() => {
                        recordSignal(reel, 'product');
                        setProductReel(reel);
                      }}
                      onOpenStore={() => openStoreFromReel(reel)}
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
                      totalCount={visibleItems.length}
                      learnedTerms={learnedTerms}
                      onRestart={() => scrollToIndex(0)}
                      onSearch={(seed?: string) => openSearchOverlay(seed ?? '')}
                      onUpload={requestUpload}
                    />
                  ) : null}
                </>
              ) : (
                <ReelsEmptyState
                  locale={locale}
                  feedTab={feedTab}
                  onGoFyp={() => changeFeedTab('fyp')}
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
          </section>

          <ReelsDesktopInfoSidebar
            locale={locale}
            reel={activeReel}
            actionState={
              activeReel
                ? actionsByReel[activeReel.id] || EMPTY_REEL_ACTION_STATE
                : EMPTY_REEL_ACTION_STATE
            }
            commentsBucket={
              activeReel ? commentsByReel[activeReel.id] : undefined
            }
            chatBusy={chatBusyReelId === activeReel?.id}
            onOpenDetail={() => {
              if (!activeReel) return;
              recordSignal(activeReel, 'detail');
              setDetailReel(activeReel);
            }}
            onOpenComments={() => activeReel && openComments(activeReel)}
            onOpenProduct={() => {
              if (!activeReel) return;
              recordSignal(activeReel, 'product');
              setProductReel(activeReel);
            }}
            onOpenStore={() => activeReel && openStoreFromReel(activeReel)}
            onOpenShare={() => activeReel && openShareSheet(activeReel)}
            onOpenCreatorProfile={() =>
              activeReel && setCreatorProfileReel(activeReel)
            }
            onMessageCreator={() =>
              activeReel ? void startChatFromReel(activeReel) : undefined
            }
            onSave={() =>
              activeReel ? void handleReelAction(activeReel, 'save') : undefined
            }
            onFollow={() =>
              activeReel ? void handleReelAction(activeReel, 'follow') : undefined
            }
            onOpenUpload={requestUpload}
            onOpenSearch={() => openSearchOverlay(activeSearchQuery)}
          />
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
          onResetRecommendations={resetRecommendations}
          onSelect={(reelId, query) => {
            setSearchOpen(false);
            setSearchContextQuery(query.trim());
            setFeedTab('fyp');
            const nextIndex = fypItems.findIndex(item => item.id === reelId);
            const resolvedIndex = Math.max(0, nextIndex);
            setActiveIndex(resolvedIndex);
            setPausedByUser(false);
            window.requestAnimationFrame(() => {
              const container = containerRef.current;
              if (!container) return;
              container.scrollTo({
                top: resolvedIndex * container.clientHeight,
                behavior: 'auto',
              });
            });
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
          chatBusy={chatBusyReelId === productReel?.id}
          onMessageCreator={reel => startChatFromReel(reel)}
          onOpenListing={(reel, href) => {
            void trackLajukanEvent('reels.marketplace_clicked', {
              entityType: 'reel',
              entityId: reel.id,
              page: href,
              properties: {
                source: 'reels_product_sheet',
                target_type: 'listing',
                target_href: href,
              },
            });
          }}
          onClose={() => setProductReel(null)}
        />

        <ShareSheet
          locale={locale}
          reel={shareReel}
          chatBusy={chatBusyReelId === shareReel?.id}
          onMessageCreator={reel => startChatFromReel(reel)}
          onMessageUser={(userId, reel) => startChatWithUser(userId, reel)}
          onShareCompleted={(reel, source) =>
            recordSignal(reel, 'share', { source })
          }
          onNotInterested={dismissNotInterestedReel}
          onRequireLogin={() => {
            setShareReel(null);
            setAuthPrompt(
              locale === 'id'
                ? 'Masuk dulu untuk melaporkan atau mengatur rekomendasi reels.'
                : 'Sign in to report or tune reel recommendations.',
            );
          }}
          onClose={() => setShareReel(null)}
        />

        <MoreActionsSheet
          locale={locale}
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
          onWhyRecommended={reel => {
            setActionsReel(null);
            setWhyReel(reel);
          }}
          onMessageCreator={reel => void startChatFromReel(reel)}
          onAction={(reel, action, active) =>
            void handleReelAction(reel, action, active)
          }
        />

        <WhyRecommendationSheet
          locale={locale}
          reel={whyReel}
          feedTab={feedTab}
          searchQuery={activeSearchQuery}
          learnedTerms={learnedTerms}
          onReset={resetRecommendations}
          onClose={() => setWhyReel(null)}
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
  onResetRecommendations,
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
  onResetRecommendations: () => void;
}) {
  const isId = locale === 'id';
  const feedItems: Array<{
    id: ReelsFeedTab;
    label: string;
    helper: string;
    icon: LucideIcon;
  }> = [
    {
      id: 'fyp',
      label: isId ? 'Untukmu' : 'For You',
      helper: isId ? 'Rekomendasi sesuai minat' : 'Recommendations for you',
      icon: Compass,
    },
    {
      id: 'following',
      label: isId ? 'Mengikuti' : 'Following',
      helper: isId ? 'Akun yang kamu ikuti' : 'Accounts you follow',
      icon: UserPlus,
    },
    {
      id: 'friends',
      label: isId ? 'Teman' : 'Friends',
      helper: isId ? 'Konten dari relasi mutual' : 'Content from mutuals',
      icon: Users,
    },
  ];
  const trendTerms =
    learnedTerms.length > 0
      ? learnedTerms.slice(0, 6)
      : ['supplier', 'packaging', 'kuliner', 'reseller', 'export', 'cashflow'];

  return (
    <aside className="hidden h-full min-h-0 flex-col border-r border-white/10 bg-[#080808] px-4 py-4 text-white xl:flex xl:px-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/${locale}/home`}
          className="grid h-11 w-11 place-items-center rounded-[14px] bg-white text-slate-950"
          aria-label="Lajukan home"
          data-testid="reels-home-link"
        >
          <Store className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-base font-bold">Lajukan</p>
          <p className="text-[11px] font-semibold text-white/42">
            {isId ? 'Video usaha & discovery' : 'Business video discovery'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpenSearch()}
        className="mt-5 flex min-h-11 items-center gap-3 rounded-[14px] bg-white/8 px-3.5 text-left text-sm font-semibold text-white/72 ring-1 ring-white/10 transition hover:bg-white/12 hover:text-white"
        data-testid="reels-search-button"
      >
        <Search className="h-4.5 w-4.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {isId ? 'Cari video, produk, supplier...' : 'Search videos, products, suppliers...'}
        </span>
      </button>

      <nav className="mt-4 space-y-1">
        {feedItems.map(item => {
          const ItemIcon = item.icon;
          const active = feedTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFeedTabChange(item.id)}
              aria-pressed={active}
              className={cn(
                'flex min-h-12 w-full items-center gap-3 rounded-[14px] px-3 text-left transition',
                active
                  ? 'bg-white text-slate-950'
                  : 'text-white/72 hover:bg-white/8 hover:text-white',
              )}
            >
              <span
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-full',
                  active ? 'bg-slate-950 text-white' : 'bg-white/8 text-white',
                )}
              >
                <ItemIcon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">
                  {item.label}
                </span>
                <span
                  className={cn(
                    'block truncate text-[11px] font-medium',
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
          className="flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-sm font-semibold text-white/68 transition hover:bg-white/8 hover:text-white"
        >
          <MessageCircle className="h-5 w-5" />
          {isId ? 'Komunitas' : 'Community'}
        </Link>
        <Link
          href={`/${locale}/manage/reels`}
          className="flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-sm font-semibold text-white/68 transition hover:bg-white/8 hover:text-white"
        >
          <SlidersHorizontal className="h-5 w-5" />
          {isId ? 'Kelola Reels' : 'Manage Reels'}
        </Link>
      </nav>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm font-bold">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-300" />
            <span className="truncate">{isId ? 'Minat yang dipelajari' : 'Learned interests'}</span>
          </div>
          {learnedTerms.length > 0 ? (
            <button
              type="button"
              onClick={onResetRecommendations}
              className="shrink-0 text-[11px] font-bold text-white/45 underline-offset-4 hover:text-white hover:underline"
            >
              {isId ? 'Reset' : 'Reset'}
            </button>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {trendTerms.map(term => (
            <button
              key={term}
              type="button"
              onClick={() => onOpenSearch(term)}
              className="rounded-full bg-white/7 px-2.5 py-1.5 text-[11px] font-semibold text-white/62 ring-1 ring-white/8 transition hover:bg-white/12 hover:text-white"
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
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-white px-4 text-sm font-bold text-slate-950 transition active:scale-[0.98]"
          data-testid="reels-upload-button"
        >
          <Camera className="h-4.5 w-4.5" />
          {isId ? 'Buat Reels' : 'Create Reel'}
        </button>

        <div className="flex items-center gap-3 rounded-[14px] bg-white/5 p-3 ring-1 ring-white/8">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/8">
            <User className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{displayName}</p>
            <p className="truncate text-[11px] font-medium text-white/40">
              {isId ? 'Creator Lajukan' : 'Lajukan creator'}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleSound}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/8 text-white/75 transition hover:bg-white/14 hover:text-white"
            aria-label={muted ? (isId ? 'Nyalakan suara' : 'Turn on sound') : isId ? 'Matikan suara' : 'Mute'}
          >
            {muted ? (
              <VolumeX className="h-4.5 w-4.5" />
            ) : (
              <Volume2 className="h-4.5 w-4.5" />
            )}
          </button>
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
  onOpenStore,
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
  onOpenStore: () => void;
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
      <aside className="hidden h-full min-h-0 flex-col border-l border-white/10 bg-[#080808] text-white 2xl:flex">
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

  const liveLabel = getLiveLabel(reel);
  const business = getReelBusinessPresentation(reel);
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
    <aside className="hidden h-full min-h-0 flex-col border-l border-white/10 bg-[#080808] text-white 2xl:flex">
      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 overscroll-contain xl:px-5"
        data-auto-scrollbar
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-300">
              {locale === 'id' ? 'Sekarang diputar' : 'Now playing'}
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

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-white/58">
          <span className="rounded-full bg-white/8 px-2.5 py-1 ring-1 ring-white/8">
            #{reel.tag.replace(/^#/, '')}
          </span>
          {liveLabel ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/16 px-2.5 py-1 text-rose-200 ring-1 ring-rose-400/20">
              <Radio className="h-3 w-3" />
              {liveLabel}
            </span>
          ) : null}
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
                {locale === 'id' ? 'Creator Lajukan' : 'Lajukan creator'}
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
          <div className="mt-3 rounded-[24px] border border-white/10 bg-white/[0.06] p-4 text-white">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-white">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-white/48">
                  Produk terkait
                </p>
                <h3 className="mt-1 truncate text-sm font-bold">
                  {reel.productName}
                </h3>
                <p className="truncate text-xs font-bold text-white/48">
                  {reel.productPrice}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onOpenProduct}
                className="rounded-[14px] bg-white px-3 py-2.5 text-xs font-bold text-slate-950"
              >
                Detail
              </button>
              {productHref ? (
                <Link
                  href={productHref}
                  className="rounded-[14px] bg-white/10 px-3 py-2.5 text-center text-xs font-bold text-white ring-1 ring-white/10"
                >
                  Lihat produk
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onOpenProduct}
                  className="rounded-[14px] bg-white/10 px-3 py-2.5 text-xs font-bold text-white ring-1 ring-white/10"
                >
                  Lihat produk
                </button>
              )}
            </div>
          </div>
        ) : business.explicit && business.name ? (
          <div className="mt-3 rounded-[18px] border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white/10">
                <Store className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-white/45">Usaha terkait</p>
                <p className="mt-0.5 truncate text-sm font-bold">{business.name}</p>
                {business.city ? (
                  <p className="mt-0.5 truncate text-xs font-medium text-white/45">{business.city}</p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenStore}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[12px] bg-white px-3 text-xs font-bold text-slate-950"
            >
              <Store className="h-4 w-4" />
              Lihat usaha
            </button>
          </div>
        ) : (
          <div className="mt-3 rounded-[18px] border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Info className="h-4.5 w-4.5 text-white/60" />
              Info Reels
            </div>
            <p className="mt-1.5 text-xs font-medium leading-relaxed text-white/48">
              Video ini belum dihubungkan ke profil usaha atau produk Lajukan.
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
                    ? 'bg-white text-slate-950'
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
              <p className="text-sm font-bold">{locale === 'id' ? 'Komentar terbaru' : 'Recent comments'}</p>
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
  feedTab,
  onFeedTabChange,
  onOpenSearch,
  onOpenUpload,
}: {
  locale: string;
  searchQuery: string;
  feedTab: ReelsFeedTab;
  onFeedTabChange: (tab: ReelsFeedTab) => void;
  onOpenSearch: () => void;
  onOpenUpload: () => void;
}) {
  const router = useRouter();
  const isId = locale === 'id';
  const hasSearchContext = searchQuery.trim().length > 0;
  const handleBack = useAppBack(router, `/${locale}/home`);
  const tabs: Array<{ id: ReelsFeedTab; idLabel: string; enLabel: string }> = [
    { id: 'following', idLabel: 'Mengikuti', enLabel: 'Following' },
    { id: 'fyp', idLabel: 'Untukmu', enLabel: 'For You' },
    { id: 'friends', idLabel: 'Teman', enLabel: 'Friends' },
  ];

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-50 bg-gradient-to-b from-black/85 via-black/35 to-transparent pb-6 pl-[calc(env(safe-area-inset-left)+10px)] pr-[calc(env(safe-area-inset-right)+10px)] pt-[calc(env(safe-area-inset-top)+6px)] sm:pl-[calc(env(safe-area-inset-left)+14px)] sm:pr-[calc(env(safe-area-inset-right)+14px)]">
      <div className="pointer-events-auto grid min-h-11 min-w-0 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-1.5">
        <button
          type="button"
          onClick={handleBack}
          aria-label={isId ? 'Kembali' : 'Back'}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/38 font-bold text-white ring-1 ring-white/12 transition hover:bg-black/55 active:scale-95"
        >
          <ArrowLeft className="h-[19px] w-[19px]" />
        </button>

        <div className="flex min-w-0 items-center justify-center">
          <div className="inline-flex max-w-full min-w-0 items-center rounded-full bg-black/34 p-1 ring-1 ring-white/10 xl:hidden">
            {tabs.map(tab => {
              const active = feedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onFeedTabChange(tab.id)}
                  aria-pressed={active}
                  className={cn(
                    'relative min-h-8 min-w-0 rounded-full px-1.5 text-[9px] font-bold transition min-[360px]:px-2 min-[360px]:text-[10px] min-[390px]:px-2.5 min-[390px]:text-[11px]',
                    active
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-white/70 hover:text-white',
                  )}
                >
                  {isId ? tab.idLabel : tab.enLabel}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onOpenSearch}
            className="hidden h-9 min-w-0 max-w-full items-center gap-1.5 rounded-full bg-black/34 px-3 text-left text-xs font-bold text-white/92 ring-1 ring-white/12 transition hover:bg-black/52 active:scale-[0.98] xl:inline-flex"
          >
            {hasSearchContext ? (
              <>
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{searchQuery}</span>
              </>
            ) : (
              <span>Reels</span>
            )}
          </button>
        </div>

        <div className="flex h-11 min-w-0 shrink-0 items-center justify-end gap-1">
          <Link
            href={`/${locale}/manage/reels`}
            aria-label={isId ? 'Kelola Reels' : 'Manage Reels'}
            className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-black/38 text-white ring-1 ring-white/12 transition hover:bg-black/55 active:scale-95 lg:grid xl:hidden"
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" />
          </Link>
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label={isId ? 'Cari Reels' : 'Search Reels'}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/38 text-white ring-1 ring-white/12 transition hover:bg-black/55 active:scale-95 max-[350px]:h-9 max-[350px]:w-9"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={onOpenUpload}
            aria-label={isId ? 'Buat Reels' : 'Create Reels'}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-950 shadow-lg shadow-black/25 transition hover:bg-emerald-100 active:scale-95 max-[350px]:h-9 max-[350px]:w-9"
            data-testid="reels-create-button"
          >
            <Plus className="h-[19px] w-[19px] stroke-[2.8]" />
          </button>
        </div>
      </div>

      {hasSearchContext ? (
        <div className="pointer-events-auto mt-1.5 flex justify-center lg:hidden">
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex max-w-[72vw] items-center gap-1.5 rounded-full bg-black/38 px-2.5 py-1 text-[10px] font-semibold text-white/76 ring-1 ring-white/10"
          >
            <Search className="h-3 w-3" />
            <span className="truncate">{searchQuery}</span>
          </button>
        </div>
      ) : null}
    </header>
  );
}

function ReelsEmptyState({
  locale,
  feedTab,
  onGoFyp,
  onUpload,
  onSearch,
}: {
  locale: string;
  feedTab: ReelsFeedTab;
  onGoFyp: () => void;
  onUpload: () => void;
  onSearch: () => void;
}) {
  const isId = locale === 'id';
  const contextual =
    feedTab === 'following'
      ? {
          Icon: UserPlus,
          title: isId
            ? 'Belum ada Reels dari akun yang kamu ikuti'
            : 'No Reels from accounts you follow yet',
          description: isId
            ? 'Ikuti creator, supplier, atau usaha yang relevan. Reels mereka akan terkumpul di sini.'
            : 'Follow relevant creators, suppliers, or businesses. Their Reels will collect here.',
        }
      : feedTab === 'friends'
        ? {
            Icon: Users,
            title: isId ? 'Belum ada aktivitas Teman' : 'No Friends activity yet',
            description: isId
              ? 'Tab Teman hanya menampilkan konten dari relasi mutual/teman yang tersedia di data sosial Lajukan.'
              : 'Friends only shows content from mutual/friend relationships available in Lajukan social data.',
          }
        : {
            Icon: Clapperboard,
            title: isId ? 'Belum ada Reels untuk ditampilkan' : 'No Reels to show yet',
            description: isId
              ? 'Coba cari topik lain atau buat Reels usaha pertama dari kamera atau galeri.'
              : 'Try another topic or create the first business Reel from camera or gallery.',
          };
  const EmptyIcon = contextual.Icon;

  return (
    <div className="flex h-full max-h-full min-h-full snap-start items-center justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+4.5rem)] text-center">
      <div className="w-full max-w-[340px] rounded-[22px] border border-white/10 bg-white/[0.07] p-5 text-white shadow-[0_24px_58px_-36px_rgba(0,0,0,0.85)]">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-white ring-1 ring-white/10">
          <EmptyIcon className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold leading-tight">
          {contextual.title}
        </h2>
        <p className="mt-2 text-sm font-medium leading-6 text-white/62">
          {contextual.description}
        </p>
        <div className="mt-4 grid gap-2">
          {feedTab !== 'fyp' ? (
            <button
              type="button"
              onClick={onGoFyp}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-white px-4 text-sm font-bold text-slate-950 transition active:scale-[0.98]"
            >
              <Compass className="h-4.5 w-4.5" />
              {isId ? 'Buka Untukmu' : 'Open For You'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onUpload}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-white px-4 text-sm font-bold text-slate-950 transition active:scale-[0.98]"
            >
              <Camera className="h-4.5 w-4.5" />
              {isId ? 'Buat Reels' : 'Create Reels'}
            </button>
          )}
          <button
            type="button"
            onClick={onSearch}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-white/12 bg-black/36 px-4 text-sm font-bold text-white transition active:scale-[0.98]"
          >
            <Search className="h-4.5 w-4.5" />
            {isId ? 'Cari Reels' : 'Search Reels'}
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
    <article className="relative h-full max-h-full min-h-full snap-start overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#f6f9f4_46%,#eef2ff_100%)] text-slate-900">
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
  onOpenCreatorProfile,
  onOpenDetail,
  onOpenComments,
  onOpenProduct,
  onOpenStore,
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
  onOpenCreatorProfile: () => void;
  onOpenDetail: () => void;
  onOpenComments: () => void;
  onOpenProduct: () => void;
  onOpenStore: () => void;
  onOpenShare: () => void;
  onOpenActions: () => void;
  onAction: (action: ReelUserAction, active?: boolean) => void;
}) {
  const mediaStyle = getReelMediaStyle(reel.filterPreset);
  const studioEffect = getReelStudioEffect(reel);
  const liveLabel = getLiveLabel(reel);
  const musicLabel = getReelMusicLabel(reel);
  const business = getReelBusinessPresentation(reel);
  const locationLabel =
    readReelMetadataText(reel, 'location', 'location_name', 'locationName') ||
    business.city;
  const disclosureLabel = readReelMetadataBoolean(
    reel,
    'promotionalContent',
    'promotional_content',
  )
    ? locale === 'id'
      ? 'Promosi'
      : 'Promotional'
    : readReelMetadataBoolean(reel, 'aiGenerated', 'ai_generated')
      ? locale === 'id'
        ? 'Dibuat dengan AI'
        : 'Made with AI'
      : '';
  const [mediaFit, setMediaFit] = useState<'cover' | 'contain'>('cover');
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [likeBurst, setLikeBurst] = useState(false);
  const lastTapAtRef = useRef(0);
  const tapTimerRef = useRef<number | null>(null);
  const likeBurstTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
      if (likeBurstTimerRef.current !== null) {
        window.clearTimeout(likeBurstTimerRef.current);
      }
    };
  }, []);

  const handleMediaTap = () => {
    const now = Date.now();
    const isDoubleTap = now - lastTapAtRef.current <= 290;

    if (isDoubleTap) {
      if (tapTimerRef.current !== null) {
        window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      lastTapAtRef.current = 0;
      onAction('like', true);
      setLikeBurst(true);
      if (likeBurstTimerRef.current !== null) {
        window.clearTimeout(likeBurstTimerRef.current);
      }
      likeBurstTimerRef.current = window.setTimeout(() => {
        setLikeBurst(false);
        likeBurstTimerRef.current = null;
      }, 650);
      return;
    }

    lastTapAtRef.current = now;
    tapTimerRef.current = window.setTimeout(() => {
      tapTimerRef.current = null;
      onTogglePlay();
    }, 235);
  };

  if (!shouldLoad) {
    return (
      <article
        className="relative flex h-full max-h-full min-h-full w-full min-w-0 snap-start overflow-hidden bg-black pb-[calc(env(safe-area-inset-bottom)+12px)] pl-[calc(env(safe-area-inset-left)+12px)] pr-[calc(env(safe-area-inset-right)+12px)] sm:pl-[calc(env(safe-area-inset-left)+16px)] sm:pr-[calc(env(safe-area-inset-right)+16px)]"
        style={REEL_SLIDE_PLACEHOLDER_STYLE}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[#050505]" />
        <div className="relative z-10 mt-auto min-w-0 flex-1 pr-[64px] opacity-0">
          <h1 className="line-clamp-2 text-[16px] font-bold leading-tight">
            {reel.title}
          </h1>
        </div>
      </article>
    );
  }

  return (
    <article
      className="relative flex h-full max-h-full min-h-full w-full min-w-0 snap-start overflow-hidden !bg-black !text-white pb-[calc(env(safe-area-inset-bottom)+12px)] pl-[calc(env(safe-area-inset-left)+12px)] pr-[calc(env(safe-area-inset-right)+12px)] sm:pl-[calc(env(safe-area-inset-left)+16px)] sm:pr-[calc(env(safe-area-inset-right)+16px)]"
      style={REEL_SLIDE_LOADED_STYLE}
      data-reel-id={reel.id}
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
          setPlaybackProgress(0);
        }}
        onTimeUpdate={event => {
          if (!active) return;
          const video = event.currentTarget;
          if (!Number.isFinite(video.duration) || video.duration <= 0) return;
          setPlaybackProgress(
            Math.min(100, Math.max(0, (video.currentTime / video.duration) * 100)),
          );
        }}
        onWaiting={onWaiting}
        onPlaying={onPlaying}
        onCanPlay={onPlaying}
        onError={onError}
      />
      <StudioEffectOverlay effect={studioEffect} />

      <button
        type="button"
        onClick={handleMediaTap}
        className="absolute inset-0 z-10 cursor-default"
        aria-label={
          paused
            ? locale === 'id'
              ? 'Putar video. Ketuk dua kali untuk suka.'
              : 'Play video. Double tap to like.'
            : locale === 'id'
              ? 'Jeda video. Ketuk dua kali untuk suka.'
              : 'Pause video. Double tap to like.'
        }
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/30" />

      {liveLabel ? (
        <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+58px)] z-20 inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg shadow-black/25 sm:left-4">
          <Radio className="h-3.5 w-3.5" />
          {liveLabel}
        </div>
      ) : null}

      <ActionRail
        locale={locale}
        reel={reel}
        actionState={actionState}
        onOpenComments={onOpenComments}
        onOpenShare={onOpenShare}
        onOpenActions={onOpenActions}
        onAction={onAction}
      />

      {likeBurst ? (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <Heart className="h-24 w-24 fill-white text-white drop-shadow-[0_10px_28px_rgba(0,0,0,0.38)] animate-[ping_650ms_ease-out_1]" />
        </div>
      ) : null}

      {buffering ? (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-black/40 ring-1 ring-white/10">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        </div>
      ) : null}

      {paused && active && !buffering ? (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-black/38 ring-1 ring-white/16">
            <Play className="h-7 w-7 fill-white" />
          </div>
        </div>
      ) : null}

      {active && muted && !soundUnlocked && !buffering ? (
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            onToggleSound();
          }}
          className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+58px)] z-40 inline-flex min-h-9 -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/52 px-3 text-[11px] font-bold text-white shadow-lg ring-1 ring-white/14 transition active:scale-95"
        >
          <Volume2 className="h-3.5 w-3.5" />
          {locale === 'id' ? 'Nyalakan suara' : 'Turn on sound'}
        </button>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-20 min-w-0 pb-[calc(env(safe-area-inset-bottom)+12px)] pl-[max(10px,env(safe-area-inset-left))] pr-[calc(env(safe-area-inset-right)+66px)] text-white min-[390px]:pl-[max(12px,env(safe-area-inset-left))] min-[390px]:pr-[calc(env(safe-area-inset-right)+72px)] sm:pl-[max(16px,env(safe-area-inset-left))] sm:pr-[calc(env(safe-area-inset-right)+80px)]">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenCreatorProfile}
            className="min-h-8 min-w-0 truncate text-left text-[14px] font-extrabold drop-shadow"
          >
            @{reel.creator}
          </button>
          {locationLabel ? (
            <>
              <span className="h-1 w-1 shrink-0 rounded-full bg-white/50" />
              <span className="inline-flex min-w-0 items-center gap-1 truncate text-[10px] font-semibold text-white/68">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{locationLabel}</span>
              </span>
            </>
          ) : null}
          {disclosureLabel ? (
            <>
              <span className="h-1 w-1 shrink-0 rounded-full bg-white/50" />
              <span className="shrink-0 rounded-full bg-white/12 px-1.5 py-0.5 text-[9px] font-bold text-white/72 ring-1 ring-white/10">
                {disclosureLabel}
              </span>
            </>
          ) : null}
        </div>

        <div className="mt-0.5 text-[12px] font-medium leading-[18px] text-white/92 drop-shadow sm:text-[13px]">
          <ExpandableCaption
            text={
              reel.caption.toLowerCase().includes(`#${reel.tag.replace(/^#/, '').toLowerCase()}`)
                ? reel.caption
                : `${reel.caption}${reel.caption.trim() ? ' ' : ''}#${reel.tag.replace(/^#/, '')}`
            }
            maxLength={112}
            locale={locale}
          />
        </div>

        {musicLabel ? (
          <div className="mt-1 flex max-w-[90%] items-center gap-1.5 text-[10px] font-semibold text-white/74">
            <Music className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{musicLabel}</span>
          </div>
        ) : null}

        {reel.productName ? (
          <button
            type="button"
            onClick={onOpenProduct}
            className="mt-2 inline-flex min-h-10 max-w-full items-center gap-2 rounded-[12px] bg-white/95 px-3 text-left text-[11px] font-bold text-slate-950 shadow-lg ring-1 ring-white/60 transition active:scale-[0.98]"
          >
            <ShoppingBag className="h-4 w-4 shrink-0 text-emerald-700" />
            <span className="min-w-0 truncate">{reel.productName}</span>
            {reel.productPrice ? (
              <span className="shrink-0 text-[10px] font-semibold text-slate-600">
                {reel.productPrice}
              </span>
            ) : null}
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          </button>
        ) : business.explicit && business.name ? (
          <button
            type="button"
            onClick={onOpenStore}
            className="mt-2 inline-flex min-h-10 max-w-full items-center gap-2 rounded-[12px] bg-black/46 px-3 text-left text-[11px] font-bold text-white ring-1 ring-white/18 transition active:scale-[0.98]"
          >
            <Store className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{business.name}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/56" />
          </button>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 h-[2px] bg-white/12">
        <div
          className="h-full bg-white transition-[width] duration-100 ease-linear"
          style={{ width: `${playbackProgress}%` }}
        />
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
            ? ' selengkapnya'
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
  const isId = locale === 'id';
  const profileHref = buildReelCreatorProfileHref(locale, reel);
  const commentsDisabled =
    reel.metadata?.allowComments === false ||
    reel.metadata?.allow_comments === false;
  const actions: Array<{
    key: string;
    label?: string;
    ariaLabel: string;
    icon: LucideIcon;
    active?: boolean;
    loading?: boolean;
    disabled?: boolean;
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
      ariaLabel: commentsDisabled
        ? isId
          ? 'Komentar dinonaktifkan'
          : 'Comments are disabled'
        : isId
          ? 'Buka komentar'
          : 'Open comments',
      icon: MessageCircle,
      disabled: commentsDisabled,
      onClick: commentsDisabled ? () => undefined : onOpenComments,
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
    {
      key: 'more',
      ariaLabel: isId ? 'Lainnya' : 'More',
      icon: MoreHorizontal,
      onClick: onOpenActions,
    },
  ];

  return (
    <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+82px)] right-[max(6px,env(safe-area-inset-right))] z-30 flex origin-bottom-right flex-col items-center gap-1.5 sm:right-[calc(env(safe-area-inset-right)+10px)] max-[370px]:scale-[0.9]">
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
            'absolute -bottom-1 left-1/2 z-20 flex !h-7 !max-h-7 !min-h-0 !w-7 !min-w-0 !max-w-7 -translate-x-1/2 items-center justify-center rounded-full p-0 !text-white shadow-lg shadow-black/45 transition active:scale-95 disabled:opacity-60',
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
            disabled={action.loading || action.disabled}
            aria-label={action.ariaLabel}
            title={action.ariaLabel}
            className="flex max-w-[48px] flex-col items-center gap-0.5 transition active:scale-95 disabled:opacity-45"
            data-testid={`reels-action-${action.key}`}
          >
            <span
              className={cn(
                '!grid !h-11 !w-11 place-items-center rounded-full !bg-black/[0.32] !text-white shadow-md shadow-black/25 ring-1 ring-white/10 transition',
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
  onResetRecommendations,
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
  onResetRecommendations: () => void;
  onSelect: (reelId: string, query: string) => void;
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
    <section className="ui-layer-header fixed inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#050505] text-white">
      <header className="shrink-0 border-b border-white/10 bg-black/95 pb-3 pl-[calc(env(safe-area-inset-left)+12px)] pr-[calc(env(safe-area-inset-right)+12px)] pt-[calc(env(safe-area-inset-top)+10px)] sm:pb-4 sm:pl-[calc(env(safe-area-inset-left)+16px)] sm:pr-[calc(env(safe-area-inset-right)+16px)]">
        <div className="mx-auto flex w-full min-w-0 max-w-[1440px] items-center gap-2 sm:gap-3">
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

        <div className="mx-auto mt-3 flex w-full max-w-[1440px] items-center gap-2 rounded-[14px] bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/60 ring-1 ring-white/10">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
          <span className="min-w-0 flex-1 truncate">
            Watch time, like, simpan, share, pencarian, dan buka produk membantu menyesuaikan Untukmu.
          </span>
          {learnedTerms.length > 0 ? (
            <button
              type="button"
              onClick={onResetRecommendations}
              className="shrink-0 font-bold text-white/72 underline-offset-4 hover:text-white hover:underline"
            >
              Reset
            </button>
          ) : null}
        </div>
      </header>

      <div
        onScroll={handleResultsScroll}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+24px)] pl-[calc(env(safe-area-inset-left)+10px)] pr-[calc(env(safe-area-inset-right)+10px)] pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:pl-[calc(env(safe-area-inset-left)+20px)] sm:pr-[calc(env(safe-area-inset-right)+20px)]"
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
            <div className="grid min-w-0 grid-cols-2 gap-2 min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {results.map(({ item, index }) => (
                <SearchVideoCard
                  key={item.id}
                  reel={item}
                  onClick={() => onSelect(item.id, query)}
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
      className="group relative min-w-0 aspect-[9/16] overflow-hidden rounded-[18px] bg-white/10 text-left ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:ring-white/20 active:scale-[0.98] sm:rounded-2xl"
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
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/68 p-0 text-white sm:items-center sm:justify-center sm:p-4 lg:items-stretch lg:justify-end lg:bg-black/42 lg:p-0"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup detail"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative flex max-h-[calc(100dvh-8px)] w-full min-w-0 flex-col overflow-hidden rounded-t-[30px] bg-[#080808] text-white shadow-2xl sm:max-h-[calc(100dvh-32px)] sm:max-w-[620px] sm:rounded-[28px] lg:h-full lg:max-h-none lg:w-[min(520px,42vw)] lg:min-w-[440px] lg:max-w-none lg:rounded-none lg:border-l lg:border-white/10">
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-white/24 lg:hidden" />
        <div className="relative h-[clamp(180px,34dvh,340px)] shrink-0 overflow-hidden bg-black lg:h-[260px]">
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
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/62 text-white sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup profil creator"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative max-h-[calc(100dvh-8px)] w-full min-w-0 overflow-y-auto rounded-t-[28px] bg-[#0b0f14] text-white shadow-2xl ring-1 ring-white/10 sm:max-h-[calc(100dvh-32px)] sm:max-w-[460px] sm:rounded-[24px]">
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
  onShareCompleted,
  onNotInterested,
  onRequireLogin,
  onClose,
}: {
  locale: string;
  reel: LajukanReel | null;
  chatBusy: boolean;
  onMessageCreator: (reel: LajukanReel) => Promise<void> | void;
  onMessageUser: (userId: string, reel: LajukanReel) => Promise<void> | void;
  onShareCompleted: (reel: LajukanReel, source: string) => void;
  onNotInterested: (reelId: string) => void;
  onRequireLogin: () => void;
  onClose: () => void;
}) {
  const { authFetch, isAuthenticated, user } = useAuth();
  const { notify } = useToast();
  const isId = locale === 'id';
  const [copied, setCopied] = useState(false);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<ShareSheetRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [sendingRecipientId, setSendingRecipientId] = useState<string | null>(
    null,
  );
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] =
    useState<TrustReportReason>('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [trustAction, setTrustAction] = useState<'report' | 'hide' | null>(null);
  const [trustError, setTrustError] = useState('');
  const [reportReceipt, setReportReceipt] = useState('');
  const sharedReelRef = useRef<string | null>(null);
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
      setReportOpen(false);
      setReportReason('spam');
      setReportDetails('');
      setTrustAction(null);
      setTrustError('');
      setReportReceipt('');
      sharedReelRef.current = null;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [reelId]);

  const markShareCompleted = useCallback(
    (source: string) => {
      if (!reel || sharedReelRef.current === reel.id) return;
      sharedReelRef.current = reel.id;
      onShareCompleted(reel, source);
    },
    [onShareCompleted, reel],
  );

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
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      notify({
        title: isId ? 'Link belum tersalin' : 'Link not copied',
        description: isId
          ? 'Izinkan akses clipboard lalu coba lagi.'
          : 'Allow clipboard access and try again.',
        variant: 'error',
      });
      return;
    }

    markShareCompleted('copy_link');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [isId, markShareCompleted, notify, shareUrl]);

  const submitReport = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!reel || trustAction) return;
      if (!isAuthenticated) {
        onRequireLogin();
        return;
      }

      setTrustAction('report');
      setTrustError('');
      try {
        const receipt = await submitTrustReport(authFetch, 'reel', reel.id, {
          reason: reportReason,
          details: reportDetails,
        });
        setReportReceipt(receipt.reportId);
        void trackLajukanEvent('report.submitted', {
          entityType: 'reel',
          entityId: reel.id,
          properties: {
            reason: reportReason,
            source: 'reels_share_sheet',
            receipt_id: receipt.reportId,
          },
        });
        notify({
          title: isId ? 'Laporan diterima' : 'Report received',
          description: `${isId ? 'Nomor laporan' : 'Report ID'}: ${receipt.reportId}`,
          variant: 'success',
        });
      } catch (error) {
        setTrustError(
          error instanceof Error
            ? error.message
            : isId
              ? 'Laporan belum terkirim. Coba lagi.'
              : 'The report was not sent. Try again.',
        );
      } finally {
        setTrustAction(null);
      }
    },
    [
      authFetch,
      isAuthenticated,
      isId,
      notify,
      onRequireLogin,
      reel,
      reportDetails,
      reportReason,
      trustAction,
    ],
  );

  const hideAsNotInterested = useCallback(async () => {
    if (!reel || trustAction) return;
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }

    setTrustAction('hide');
    setTrustError('');
    try {
      await markReelNotInterested(authFetch, reel.id);
      void trackLajukanEvent('reels.not_interested', {
        entityType: 'reel',
        entityId: reel.id,
        properties: { source: 'reels_share_sheet' },
      });
      notify({
        title: isId ? 'Reel disembunyikan' : 'Reel hidden',
        description: isId
          ? 'Rekomendasi berikutnya akan menyesuaikan.'
          : 'Future recommendations will adjust.',
        variant: 'success',
      });
      onNotInterested(reel.id);
    } catch (error) {
      setTrustError(
        error instanceof Error
          ? error.message
          : isId
            ? 'Preferensi belum tersimpan. Coba lagi.'
            : 'The preference was not saved. Try again.',
      );
      setTrustAction(null);
    }
  }, [
    authFetch,
    isAuthenticated,
    isId,
    notify,
    onNotInterested,
    onRequireLogin,
    reel,
    trustAction,
  ]);

  const reportReasonLabel = (reason: TrustReportReason) => {
    const labels: Record<TrustReportReason, [string, string]> = {
      spam: ['Spam', 'Spam'],
      scam: ['Penipuan', 'Scam or fraud'],
      harassment: ['Perundungan', 'Harassment'],
      hate: ['Ujaran kebencian', 'Hate speech'],
      sexual: ['Konten seksual', 'Sexual content'],
      violence: ['Kekerasan', 'Violence'],
      illegal: ['Barang/aktivitas ilegal', 'Illegal activity'],
      privacy: ['Pelanggaran privasi', 'Privacy violation'],
      other: ['Lainnya', 'Other'],
    };
    return labels[reason][isId ? 0 : 1];
  };

  const openExternal = useCallback(
    (url: string, shareSource?: string) => {
      if (typeof window === 'undefined') return;
      if (shareSource) markShareCompleted(shareSource);
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [markShareCompleted],
  );

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
        markShareCompleted('internal_message');
        onClose();
      } finally {
        setSendingRecipientId(null);
      }
    },
    [
      markShareCompleted,
      onClose,
      onMessageCreator,
      onMessageUser,
      reel,
      sendingRecipientId,
    ],
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
      label: 'WhatsApp',
      icon: MessageCircle,
      className: 'bg-[#25D366] text-white',
      onClick: () =>
        openExternal(`https://wa.me/?text=${encodedText}`, 'whatsapp'),
    },
    {
      label: copied
        ? isId
          ? 'Tersalin'
          : 'Copied'
        : isId
          ? 'Salin link'
          : 'Copy link',
      icon: Link2,
      className: 'bg-emerald-600 text-white',
      onClick: () => void copyLink(),
    },
    {
      label: 'Facebook',
      glyph: 'f',
      className: 'bg-[#1877F2] text-white',
      onClick: () =>
        openExternal(
          `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
          'facebook',
        ),
    },
  ];
  const utilityActions: Array<{
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    disabled?: boolean;
  }> = [
    {
      label: isId ? 'Laporkan' : 'Report',
      icon: Flag,
      onClick: () => {
        if (!isAuthenticated) {
          onRequireLogin();
          return;
        }
        setTrustError('');
        setReportReceipt('');
        setReportOpen(true);
      },
    },
    {
      label: isId ? 'Tidak tertarik' : 'Not interested',
      icon: X,
      onClick: () => void hideAsNotInterested(),
      disabled: trustAction === 'hide',
    },
    {
      label: isId ? 'Buka video' : 'Open video',
      icon: Download,
      onClick: () => openExternal(reel.videoSrc),
    },
  ];

  return (
    <div
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/58 text-white sm:items-center sm:justify-center sm:p-4 lg:items-stretch lg:justify-end lg:bg-black/42 lg:p-0"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup share"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative flex max-h-[calc(100dvh-8px)] w-full min-w-0 flex-col overflow-hidden rounded-t-[28px] bg-[#0b0f14] text-white shadow-2xl sm:max-h-[calc(100dvh-32px)] sm:max-w-[620px] sm:rounded-[28px] lg:h-full lg:max-h-none lg:w-[460px] lg:max-w-none lg:rounded-none lg:border-l lg:border-white/10 xl:w-[500px]">
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-white/18 lg:hidden" />
        <div className="flex items-center gap-3 px-4 pb-3 pt-4 sm:px-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-white">
            {reportOpen ? (
              <Flag className="h-5 w-5" />
            ) : (
              <Search className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1 text-center">
            <h2 className="text-xl font-bold tracking-[-0.03em]">
              {reportOpen
                ? isId
                  ? 'Laporkan reel'
                  : 'Report reel'
                : isId
                  ? 'Bagikan ke'
                  : 'Send to'}
            </h2>
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
          {reportOpen ? (
            <form onSubmit={submitReport} className="space-y-4 py-2">
              {reportReceipt ? (
                <div
                  role="status"
                  className="rounded-[22px] border border-emerald-400/25 bg-emerald-400/10 p-4 text-center"
                >
                  <Check className="mx-auto h-8 w-8 text-emerald-300" />
                  <p className="mt-2 text-sm font-bold text-white">
                    {isId ? 'Laporan diterima' : 'Report received'}
                  </p>
                  <p className="mt-1 break-all text-xs font-semibold text-white/60">
                    {isId ? 'Nomor laporan' : 'Report ID'}: {reportReceipt}
                  </p>
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    className="mt-4 min-h-11 rounded-full bg-white px-5 text-sm font-bold text-slate-950"
                  >
                    {isId ? 'Selesai' : 'Done'}
                  </button>
                </div>
              ) : (
                <>
                  <fieldset>
                    <legend className="text-sm font-bold text-white">
                      {isId ? 'Alasan laporan' : 'Report reason'}
                    </legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {TRUST_REPORT_REASONS.map(reason => (
                        <label
                          key={reason}
                          className={cn(
                            'flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border px-3 text-xs font-semibold',
                            reportReason === reason
                              ? 'border-emerald-400 bg-emerald-400/15 text-white'
                              : 'border-white/10 bg-white/5 text-white/70',
                          )}
                        >
                          <input
                            type="radio"
                            name="reel-report-reason"
                            value={reason}
                            checked={reportReason === reason}
                            onChange={() => setReportReason(reason)}
                            className="accent-emerald-500"
                          />
                          {reportReasonLabel(reason)}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className="block text-sm font-bold text-white">
                    {isId ? 'Keterangan (opsional)' : 'Details (optional)'}
                    <textarea
                      value={reportDetails}
                      onChange={event => setReportDetails(event.target.value)}
                      maxLength={1000}
                      rows={3}
                      className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-white outline-none placeholder:text-white/35 focus:border-emerald-400"
                      placeholder={
                        isId
                          ? 'Jelaskan singkat agar moderator bisa meninjau.'
                          : 'Add context to help moderators review it.'
                      }
                    />
                  </label>

                  {trustError ? (
                    <p
                      role="alert"
                      className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200"
                    >
                      {trustError}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setReportOpen(false)}
                      disabled={trustAction === 'report'}
                      className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {isId ? 'Batal' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={trustAction === 'report'}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-rose-500 px-4 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {trustAction === 'report' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Flag className="h-4 w-4" />
                      )}
                      {isId ? 'Kirim laporan' : 'Submit report'}
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : (
            <>
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
                  disabled={action.disabled}
                  className="w-[76px] shrink-0 text-center transition active:scale-95 disabled:cursor-wait disabled:opacity-50"
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
              {isId ? 'Link reels disalin' : 'Reel link copied'}
            </div>
          )}
            </>
          )}
          {!reportOpen && trustError ? (
            <p
              role="alert"
              className="mb-2 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200"
            >
              {trustError}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/* =========================
   COMMENTS / PRODUCT / UPLOAD
========================= */

function MoreActionsSheet({
  locale,
  reel,
  actionState,
  chatBusy,
  onClose,
  onOpenDetail,
  onOpenProduct,
  onOpenComments,
  onOpenShare,
  onWhyRecommended,
  onMessageCreator,
  onAction,
}: {
  locale: string;
  reel: LajukanReel | null;
  actionState: ReelActionState;
  chatBusy: boolean;
  onClose: () => void;
  onOpenDetail: (reel: LajukanReel) => void;
  onOpenProduct: (reel: LajukanReel) => void;
  onOpenComments: (reel: LajukanReel) => void;
  onOpenShare: (reel: LajukanReel) => void;
  onWhyRecommended: (reel: LajukanReel) => void;
  onMessageCreator: (reel: LajukanReel) => void;
  onAction: (
    reel: LajukanReel,
    action: ReelUserAction,
    active?: boolean,
  ) => void;
}) {
  if (!reel) return null;
  const isId = locale === 'id';

  const actions: Array<{
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    active?: boolean;
    featured?: boolean;
    disabled?: boolean;
  }> = [
    {
      label: actionState.saved ? (isId ? 'Tersimpan' : 'Saved') : isId ? 'Simpan' : 'Save',
      icon: Bookmark,
      active: actionState.saved,
      disabled: actionState.loading === 'save',
      onClick: () => onAction(reel, 'save'),
    },
    {
      label: isId ? 'Detail' : 'Details',
      icon: Info,
      onClick: () => onOpenDetail(reel),
    },
    {
      label: isId ? 'Komentar' : 'Comments',
      icon: MessageCircle,
      onClick: () => onOpenComments(reel),
    },
    {
      label: isId ? 'Bagikan' : 'Share',
      icon: Forward,
      featured: true,
      onClick: () => onOpenShare(reel),
    },
    {
      label: isId ? 'Kenapa ini?' : 'Why this?',
      icon: Sparkles,
      onClick: () => onWhyRecommended(reel),
    },
    {
      label: actionState.followed
        ? isId
          ? 'Diikuti'
          : 'Following'
        : isId
          ? 'Ikuti'
          : 'Follow',
      icon: actionState.followed ? Check : UserPlus,
      active: actionState.followed,
      disabled: actionState.loading === 'follow',
      onClick: () => onAction(reel, 'follow'),
    },
    {
      label: isId ? 'Chat' : 'Message',
      icon: chatBusy ? Loader2 : MessageSquareText,
      disabled: chatBusy,
      onClick: () => onMessageCreator(reel),
    },
  ];

  if (reel.productName) {
    actions.splice(2, 0, {
      label: isId ? 'Produk' : 'Product',
      icon: ShoppingBag,
      featured: true,
      onClick: () => onOpenProduct(reel),
    });
  }

  return (
    <div
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/58 text-white sm:items-center sm:justify-center sm:p-4 lg:items-stretch lg:justify-end lg:bg-black/42 lg:p-0"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label={isId ? 'Tutup aksi Reels' : 'Close Reel actions'}
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative max-h-[calc(100dvh-8px)] w-full min-w-0 overflow-y-auto rounded-t-[26px] bg-[#0b0f14] text-white shadow-2xl sm:max-h-[calc(100dvh-32px)] sm:max-w-[520px] sm:rounded-[24px] lg:h-full lg:max-h-none lg:w-[420px] lg:max-w-none lg:rounded-none lg:border-l lg:border-white/10">
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-white/18 lg:hidden" />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-white/48">
              {isId ? 'Aksi Reels' : 'Reel actions'}
            </p>
            <h2 className="truncate text-base font-bold">{reel.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 transition active:scale-95"
            aria-label={isId ? 'Tutup aksi' : 'Close actions'}
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
                  'flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-[16px] px-2 text-xs font-bold transition active:scale-[0.98] disabled:opacity-60',
                  action.featured
                    ? 'bg-white text-slate-950'
                    : action.active
                      ? 'bg-emerald-500/18 text-emerald-100 ring-1 ring-emerald-400/25'
                      : 'bg-white/8 text-white ring-1 ring-white/8',
                )}
              >
                <ActionIcon
                  className={cn(
                    'h-5 w-5 stroke-[2.3]',
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

function WhyRecommendationSheet({
  locale,
  reel,
  feedTab,
  searchQuery,
  learnedTerms,
  onReset,
  onClose,
}: {
  locale: string;
  reel: LajukanReel | null;
  feedTab: ReelsFeedTab;
  searchQuery: string;
  learnedTerms: string[];
  onReset: () => void;
  onClose: () => void;
}) {
  if (!reel) return null;
  const isId = locale === 'id';
  const reelTokensSet = new Set(reelTokens(reel));
  const matchingTerms = learnedTerms.filter(term => reelTokensSet.has(term)).slice(0, 3);
  const reasons = [
    feedTab === 'following'
      ? isId
        ? 'Kamu mengikuti creator atau usaha ini.'
        : 'You follow this creator or business.'
      : feedTab === 'friends'
        ? isId
          ? 'Konten ini berasal dari aktivitas relasi Teman/mutual.'
          : 'This content comes from Friends or mutual activity.'
        : null,
    searchQuery.trim()
      ? isId
        ? `Sesuai pencarian “${searchQuery.trim()}”.`
        : `Related to your search “${searchQuery.trim()}”.`
      : null,
    matchingTerms.length > 0
      ? isId
        ? `Topiknya mirip minatmu: ${matchingTerms.join(', ')}.`
        : `Its topic matches your interests: ${matchingTerms.join(', ')}.`
      : null,
    isId
      ? 'FYP juga menyelingi creator dan topik berbeda agar feed tidak terlalu berulang.'
      : 'For You also mixes creators and topics so the feed does not become repetitive.',
  ].filter((reason): reason is string => Boolean(reason));

  return (
    <div
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/62 text-white sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label={isId ? 'Tutup' : 'Close'} />
      <section className="relative max-h-[calc(100dvh-8px)] w-full min-w-0 overflow-y-auto rounded-t-[26px] bg-[#0b0f14] p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-white/10 sm:max-h-[calc(100dvh-32px)] sm:max-w-[460px] sm:rounded-[22px]">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/18 lg:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold">
              <Sparkles className="h-4.5 w-4.5 text-emerald-300" />
              {isId ? 'Kenapa Reels ini muncul?' : 'Why are you seeing this Reel?'}
            </div>
            <p className="mt-1 line-clamp-1 text-xs font-medium text-white/48">{reel.title}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/8" aria-label={isId ? 'Tutup' : 'Close'}>
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {reasons.map(reason => (
            <div key={reason} className="flex gap-2.5 rounded-[14px] bg-white/6 p-3 ring-1 ring-white/8">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <p className="text-xs font-medium leading-5 text-white/72">{reason}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-xs font-medium leading-5 text-white/48">
            {isId
              ? 'Suka, simpan, bagikan, ikuti, pencarian, waktu tonton, dan “Tidak tertarik” membantu menyesuaikan rekomendasi berikutnya.'
              : 'Likes, saves, shares, follows, searches, watch time, and Not interested help tune future recommendations.'}
          </p>
          <button
            type="button"
            onClick={() => {
              onReset();
              onClose();
            }}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-white/8 px-4 text-sm font-bold text-white ring-1 ring-white/10 transition active:scale-[0.98]"
          >
            <RefreshCcw className="h-4 w-4" />
            {isId ? 'Reset rekomendasi saya' : 'Reset my recommendations'}
          </button>
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
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/62 text-white sm:items-center sm:justify-center sm:p-4 lg:items-stretch lg:justify-end lg:bg-black/42 lg:p-0"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup komentar"
        onClick={onClose}
        className="absolute inset-0 z-0"
      />

      <section className="relative z-10 flex max-h-[calc(100dvh-8px)] w-full min-w-0 flex-col overflow-hidden rounded-t-[28px] bg-[#0b0f14] text-white shadow-2xl sm:max-h-[calc(100dvh-32px)] sm:max-w-[620px] sm:rounded-[28px] lg:h-full lg:max-h-none lg:w-[460px] lg:max-w-none lg:rounded-none lg:border-l lg:border-white/10 xl:w-[500px]">
  <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-white/18 lg:hidden" />

  <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">
        {formatCompactMetric(metricCount(reel, 'comments'))} komentar
      </p>

      <h2 className="truncate text-base font-bold text-white">
        {reel.title}
      </h2>
    </div>

    <button
      type="button"
      onClick={() => onChatCreator(null)}
      disabled={chatBusy}
      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-emerald-700 px-3 text-xs font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
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
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/15"
      aria-label="Tutup komentar"
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
                  <div className="rounded-2xl bg-white/8 px-3 py-2 ring-1 ring-white/10">
                    <p className="truncate text-xs font-bold text-white">
                      {comment.authorName}
                    </p>

                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/78">
                      {comment.body}
                    </p>
                  </div>

                  <div className="mt-1 flex items-center gap-3 px-2 text-[11px] font-bold text-white/42">
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
        className="mt-4 w-full rounded-full bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
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
    className="border-t border-white/10 bg-[#0b0f14] px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
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
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/15"
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
            className="max-h-28 min-h-[42px] flex-1 resize-none rounded-[20px] bg-white/8 px-3 py-2.5 text-sm font-medium text-white outline-none ring-emerald-400/20 transition placeholder:text-white/35 focus:ring-4"
          />

          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label={replyTarget ? 'Kirim balasan' : 'Kirim komentar'}
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
          className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-3 text-left text-sm font-bold text-white/70 transition hover:bg-white/15 hover:text-white"
        >
          Masuk untuk komentar
        </button>

        <Link
          href={loginHref}
          className="rounded-full bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-400"
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
  chatBusy,
  onMessageCreator,
  onOpenListing,
  onClose,
}: {
  locale: string;
  reel: LajukanReel | null;
  chatBusy: boolean;
  onMessageCreator: (reel: LajukanReel) => Promise<void> | void;
  onOpenListing: (reel: LajukanReel, href: string) => void;
  onClose: () => void;
}) {
  if (!reel) return null;

  const productHref = resolveCanonicalReelContentHref(
    reel.productHref,
    locale,
  );
  const isId = locale === 'id';

  return (
    <div
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/62 text-white sm:items-center sm:justify-center sm:p-4 lg:items-stretch lg:justify-end lg:bg-black/42 lg:p-0"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Tutup produk"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative flex max-h-[calc(100dvh-8px)] w-full min-w-0 flex-col overflow-hidden rounded-t-[28px] bg-[#0b0f14] text-white shadow-2xl sm:max-h-[calc(100dvh-32px)] sm:max-w-[560px] sm:rounded-[28px] lg:h-full lg:max-h-none lg:w-[420px] lg:max-w-none lg:rounded-none lg:border-l lg:border-white/10 xl:w-[460px]">
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

          <div
            className={cn(
              'mt-3 grid gap-2',
              productHref ? 'grid-cols-2' : 'grid-cols-1',
            )}
          >
            {productHref ? (
              <Link
                href={productHref}
                onClick={() => onOpenListing(reel, productHref)}
                className="rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-bold text-white ring-1 ring-white/10"
              >
                {isId ? 'Lihat listing' : 'View listing'}
              </Link>
            ) : null}

            <button
              type="button"
              disabled={chatBusy}
              onClick={() => void onMessageCreator(reel)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {chatBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isId ? 'Tanya penyedia' : 'Ask provider'}
            </button>
          </div>

          <div className="mt-3 rounded-2xl bg-white/6 px-3 py-2 text-xs font-semibold leading-relaxed text-white/55 ring-1 ring-white/10">
            {productHref
              ? isId
                ? 'Cek detail, ketersediaan, dan ketentuan langsung di listing Lajukan.'
                : 'Check details, availability, and terms on the Lajukan listing.'
              : isId
                ? 'Listing belum ditautkan. Hubungi penyedia untuk memastikan detail dan ketersediaan.'
                : 'No listing is linked yet. Ask the provider to confirm details and availability.'}
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
  const [storeOptions, setStoreOptions] = useState<ReelStoreOption[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [linkedStoreId, setLinkedStoreId] = useState('');
  const [previewDurationMs, setPreviewDurationMs] = useState(0);
  const postPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const selectedStore = useMemo(
    () => storeOptions.find(store => store.id === linkedStoreId) || null,
    [linkedStoreId, storeOptions],
  );
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
      if (mode === 'live' && !REELS_LIVE_ENABLED) {
        setError(
          locale === 'id'
            ? 'Live belum tersedia. Posting video dulu, ya.'
            : 'Live is not available yet. Post a video instead.',
        );
        return;
      }

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
      setLinkedStoreId('');
      setCameraError(null);
      setRecordingStartedAt(null);
      setRecordingElapsedMs(0);
      autoCameraAttemptedRef.current = false;
      stopCamera();
    }
  }, [open, setStudioMode, stopCamera]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let cancelled = false;
    setStoresLoading(true);

    void authFetch('/api/super-app/umkm/stores?mine=1&limit=80', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async response => {
        const payload = (await response.json().catch(() => ({}))) as {
          data?: { items?: Array<Record<string, unknown>> };
        };
        if (!response.ok || cancelled) return;
        const stores = (Array.isArray(payload.data?.items) ? payload.data!.items! : [])
          .map(item => ({
            id: typeof item.id === 'string' ? item.id.trim() : '',
            name: typeof item.name === 'string' ? item.name.trim() : '',
            slug: typeof item.slug === 'string' ? item.slug.trim() : '',
            city: typeof item.city === 'string' ? item.city.trim() : '',
            phone: typeof item.phone === 'string' ? item.phone.trim() : null,
          }))
          .filter(store => store.id && store.name);
        setStoreOptions(stores);
        setLinkedStoreId(current => current || (stores.length === 1 ? stores[0]!.id : ''));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setStoresLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authFetch, open]);

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
  const recordingLimitMs = getStudioDurationMs(studioDuration);
  const recordingProgress = recording
    ? Math.min(recordingElapsedMs / recordingLimitMs, 1)
    : 0;
  const recordingRemainingSeconds = Math.max(
    Math.ceil((recordingLimitMs - recordingElapsedMs) / 1000),
    0,
  );
  const directVideoUrl = form.mediaUrl.trim();
  const isExternalVideoLink = Boolean(
    !file && directVideoUrl && isDirectVideoMediaUrl(directVideoUrl),
  );
  const fieldLabelClass = 'text-xs font-bold text-slate-900 dark:text-white/84';
  const inputClass =
    'mt-1 h-10 w-full rounded-[13px] border border-slate-200 bg-white px-3 text-[13px] font-semibold !text-slate-950 outline-none placeholder:text-slate-400 focus:border-emerald-300/50 focus:bg-white dark:border-white/10 dark:bg-white/[0.08] dark:!text-white dark:placeholder:text-white/38 dark:focus:bg-white/[0.11]';
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

    const cleanCaption = form.caption.trim();
    const firstCaptionLine = cleanCaption
      .split(/\n+/)
      .map(line => line.trim())
      .find(Boolean) || '';
    const fallbackTitle = file
      ? buildCleanReelTitleFromFile(file)
      : form.captureMode === 'live'
        ? form.liveTitle.trim() || 'Live usaha'
        : 'Video usaha';
    const title =
      form.title.trim() ||
      firstCaptionLine.replace(/(^|\s)[#@][^\s]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) ||
      fallbackTitle;
    const caption = cleanCaption || title;
    const captionHashtag = cleanCaption.match(/(?:^|\s)#([A-Za-z0-9_]+)/)?.[1];
    const inferredContentGoal: ReelContentGoal =
      form.productName.trim() || form.productHref.trim()
        ? 'product'
        : form.promotionalContent
          ? 'promo'
          : form.contentGoal;
    const tag =
      form.tag.trim() ||
      captionHashtag ||
      (inferredContentGoal === 'product' ? 'Produk' : 'UMKM');
    let mediaUrl = form.mediaUrl.trim();
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
    if (form.captureMode === 'live' && !REELS_LIVE_ENABLED) {
      setError('Live belum tersedia. Pilih video untuk diposting.');
      setStep('media');
      return;
    }

    const productHref = form.productHref.trim()
      ? resolveCanonicalReelContentHref(form.productHref, locale)
      : null;
    if (form.productHref.trim() && !productHref) {
      setError(
        locale === 'id'
          ? 'Link produk harus menuju listing Lajukan dengan format /content/...'
          : 'Product links must point to a Lajukan listing using /content/...',
      );
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
          hook: (form.hook.trim() || firstCaptionLine || caption).slice(0, 150),
          productName: form.productName.trim() || undefined,
          productPrice: form.productPrice.trim() || undefined,
          productHref: productHref || undefined,
          storeId: selectedStore?.id || undefined,
          storeSlug: selectedStore?.slug || undefined,
          storeName: selectedStore?.name || undefined,
          storeCity: selectedStore?.city || undefined,
          tone: 'emerald',
          iconKey:
            inferredContentGoal === 'product' || inferredContentGoal === 'promo'
              ? 'supplier'
              : 'marketing',
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
            contentGoal: inferredContentGoal,
            location: form.location.trim() || selectedStore?.city || undefined,
            visibility: form.visibility,
            allowComments: form.allowComments,
            shareToMainFeed: form.shareToMainFeed,
            promotionalContent: form.promotionalContent,
            aiGenerated: form.aiGenerated,
            coverTimestampMs: form.coverTimestampMs,
            publishingPreferences: {
              visibility: form.visibility,
              allowComments: form.allowComments,
              shareToMainFeed: form.shareToMainFeed,
              promotionalContent: form.promotionalContent,
              aiGenerated: form.aiGenerated,
              coverTimestampMs: form.coverTimestampMs,
            },
            linkedStoreId: selectedStore?.id || undefined,
            linkedStoreName: selectedStore?.name || undefined,
            productLinked: Boolean(form.productName.trim() || productHref),
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

  const postingCaptionLength = form.caption.length;
  const coverPercent = previewDurationMs > 0
    ? Math.min(100, Math.max(0, (form.coverTimestampMs / previewDurationMs) * 100))
    : 0;

  const setCoverTimestamp = (value: number) => {
    const next = Math.max(0, Math.min(value, previewDurationMs || value));
    setField('coverTimestampMs', Math.round(next));
    if (postPreviewVideoRef.current && Number.isFinite(next)) {
      try {
        postPreviewVideoRef.current.currentTime = next / 1000;
      } catch {
        // Seeking is best-effort while metadata is still loading.
      }
    }
  };

  const appendCaptionToken = (token: '#' | '@') => {
    setField(
      'caption',
      `${form.caption}${form.caption && !form.caption.endsWith(' ') ? ' ' : ''}${token}`,
    );
  };

  const toggleRowClass =
    'flex min-h-12 w-full items-center justify-between gap-3 rounded-[16px] px-3.5 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/5';

  return (
    <div
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/80 text-slate-950 md:items-center md:justify-center md:p-4 dark:text-white"
      role="dialog"
      aria-modal="true"
      aria-label={locale === 'id' ? 'Buat Reels' : 'Create Reel'}
    >
      <button
        type="button"
        aria-label={locale === 'id' ? 'Tutup' : 'Close'}
        onClick={onClose}
        className="absolute inset-0"
      />

      <form
        onSubmit={submit}
        data-lajukan-reels-studio="true"
        className={cn(
          'relative flex h-[100dvh] max-h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-white shadow-2xl dark:bg-[#050505] md:h-[min(900px,calc(100dvh-2rem))] md:max-h-[calc(100dvh-2rem)]',
          step === 'media'
            ? 'md:max-w-[470px] md:rounded-[30px]'
            : 'md:max-w-[1000px] md:rounded-[28px]',
        )}
      >
        {step === 'media' ? (
          <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-black text-white">
            <div className="absolute inset-0">
              {mediaPreviewSrc ? (
                isImageMedia ? (
                  <img
                    src={mediaPreviewSrc}
                    alt="Preview Reels"
                    className="h-full w-full object-cover"
                    style={previewMediaStyle}
                  />
                ) : (
                  <video
                    src={mediaPreviewSrc}
                    className="h-full w-full object-cover"
                    style={previewMediaStyle}
                    muted
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                  />
                )
              ) : form.captureMode === 'camera' ? (
                <video
                  ref={cameraVideoRef}
                  className="h-full w-full object-cover"
                  style={previewMediaStyle}
                  muted
                  playsInline
                  autoPlay
                  aria-busy={cameraOpening}
                />
              ) : (
                <div className="grid h-full place-items-center bg-[#111] px-8 text-center">
                  <div>
                    <Clapperboard className="mx-auto h-10 w-10 text-white/55" />
                    <p className="mt-3 text-sm font-bold text-white/82">
                      {locale === 'id' ? 'Pilih video dari galeri' : 'Choose a video'}
                    </p>
                  </div>
                </div>
              )}
              <StudioEffectOverlay effect={studioEffect} />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/70" />
            </div>

            <div className="relative z-20 flex items-center justify-between gap-2 px-[max(12px,env(safe-area-inset-left))] pt-[max(10px,env(safe-area-inset-top))] pr-[max(12px,env(safe-area-inset-right))]">
              <button
                type="button"
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-full bg-black/40 ring-1 ring-white/15"
                aria-label={locale === 'id' ? 'Tutup' : 'Close'}
              >
                <X className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => setStudioPanel('music')}
                className="inline-flex min-h-9 min-w-0 max-w-[58vw] items-center gap-1.5 rounded-full bg-black/38 px-3 text-xs font-bold ring-1 ring-white/12"
              >
                <Music className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{form.musicTrack || 'Original sound'}</span>
              </button>

              {hasMedia ? (
                <button
                  type="button"
                  onClick={() => setStep('edit')}
                  className="min-h-10 rounded-full bg-white px-4 text-xs font-extrabold text-slate-950"
                >
                  {locale === 'id' ? 'Lanjut' : 'Next'}
                </button>
              ) : (
                <span className="h-10 w-10" aria-hidden="true" />
              )}
            </div>

            <div className="absolute right-[max(10px,env(safe-area-inset-right))] top-[calc(env(safe-area-inset-top)+66px)] z-20 flex flex-col items-center gap-2.5">
              {[
                {
                  label: locale === 'id' ? 'Balik' : 'Flip',
                  icon: RefreshCcw,
                  onClick: flipCamera,
                  hidden: studioMode === 'live',
                },
                {
                  label: 'Filter',
                  icon: Sparkles,
                  onClick: () => setStudioPanel('filters'),
                },
                {
                  label: locale === 'id' ? 'Efek' : 'Effects',
                  icon: SlidersHorizontal,
                  onClick: () => setStudioPanel('effects'),
                },
                {
                  label: 'Link',
                  icon: Link2,
                  onClick: openLinkPanel,
                },
              ].filter(tool => !tool.hidden).map(tool => {
                const ToolIcon = tool.icon;
                return (
                  <button
                    key={tool.label}
                    type="button"
                    onClick={tool.onClick}
                    className="flex w-[48px] flex-col items-center gap-1 text-[9px] font-bold text-white drop-shadow min-[390px]:w-[52px] min-[390px]:text-[10px]"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-black/42 ring-1 ring-white/12 min-[390px]:h-10 min-[390px]:w-10">
                      <ToolIcon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="max-w-full truncate">{tool.label}</span>
                  </button>
                );
              })}
            </div>

            {recording ? (
              <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+58px)] z-20">
                <div className="h-1 overflow-hidden rounded-full bg-white/24">
                  <div
                    className="h-full rounded-full bg-rose-500 transition-[width] duration-100"
                    style={{ width: `${recordingProgress * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-center text-[10px] font-bold text-white/78">
                  {recordingRemainingSeconds}s
                </p>
              </div>
            ) : null}

            {cameraError ? (
              <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+58px)] z-30 rounded-2xl bg-amber-950/88 px-3 py-2 text-xs font-semibold text-amber-100 ring-1 ring-amber-300/20">
                {cameraError}
              </div>
            ) : null}

            <div className="relative z-20 mt-auto pb-[max(14px,env(safe-area-inset-bottom))]">
              <div className="mb-3 flex justify-center gap-5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => selectStudioMode('video')}
                  className={cn('min-h-8 px-2', studioMode === 'video' ? 'text-white' : 'text-white/55')}
                >
                  Video
                </button>
                {REELS_LIVE_ENABLED ? (
                  <button
                    type="button"
                    onClick={() => selectStudioMode('live')}
                    className={cn('min-h-8 px-2', studioMode === 'live' ? 'text-rose-300' : 'text-white/55')}
                  >
                    Live
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 min-[390px]:px-7">
                <label className="justify-self-start cursor-pointer">
                  <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-[14px] bg-white/14 ring-1 ring-white/15">
                    <Images className="h-5 w-5" />
                  </span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                    onChange={event => handleFile(event.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleStudioCapture}
                  className={cn(
                    'grid h-[68px] w-[68px] place-items-center rounded-full border-4 border-white shadow-2xl transition active:scale-95 min-[390px]:h-[76px] min-[390px]:w-[76px] min-[390px]:border-[5px]',
                    recording ? 'bg-rose-500' : studioMode === 'live' ? 'bg-rose-500/85' : 'bg-white/18',
                  )}
                  aria-label={locale === 'id' ? 'Rekam video' : 'Record video'}
                >
                  {recording ? (
                    <span className="h-7 w-7 rounded-[7px] bg-white" />
                  ) : studioMode === 'live' ? (
                    <Radio className="h-7 w-7" />
                  ) : (
                    <span className="h-11 w-11 rounded-full bg-rose-500" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStudioPanel('speed')}
                  className="justify-self-end rounded-full bg-black/38 px-3 py-2 text-xs font-extrabold ring-1 ring-white/12"
                >
                  {studioSpeed}
                </button>
              </div>

              <div className="mt-3 flex justify-center gap-1.5">
                {REELS_STUDIO_DURATIONS.map(duration => (
                  <button
                    key={duration}
                    type="button"
                    onClick={() => setStudioDuration(duration)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-bold',
                      studioDuration === duration ? 'bg-white text-slate-950' : 'bg-black/35 text-white/70',
                    )}
                  >
                    {duration}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <>
            <header className="flex min-h-[58px] shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 dark:border-white/10 sm:px-4">
              <button
                type="button"
                onClick={() => setStep(step === 'post' ? 'edit' : 'media')}
                className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/8"
                aria-label={locale === 'id' ? 'Kembali' : 'Back'}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="min-w-0 flex-1 truncate text-center text-sm font-extrabold sm:text-base">
                {step === 'edit'
                  ? locale === 'id' ? 'Edit Reels' : 'Edit Reel'
                  : locale === 'id' ? 'Posting baru' : 'New post'}
              </h2>
              {step === 'edit' ? (
                <button
                  type="button"
                  onClick={() => setStep('post')}
                  className="min-h-10 rounded-full bg-emerald-700 px-4 text-xs font-extrabold text-white"
                >
                  {locale === 'id' ? 'Lanjut' : 'Next'}
                </button>
              ) : (
                <span className="h-10 w-10" aria-hidden="true" />
              )}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 dark:bg-[#0b0b0b]">
              {step === 'edit' ? (
                <div className="mx-auto grid min-h-full w-full max-w-[900px] gap-4 p-3 sm:p-4 md:grid-cols-[minmax(250px,340px)_minmax(0,1fr)] md:items-start">
                  <div className="mx-auto w-full max-w-[260px] md:max-w-[340px]">
                    <div className="relative aspect-[9/16] max-h-[46dvh] overflow-hidden rounded-[20px] bg-black shadow-xl sm:max-h-[52dvh] md:max-h-[calc(100dvh-8rem)] md:rounded-[22px]">
                      {mediaPreviewSrc ? (
                        isImageMedia ? (
                          <img src={mediaPreviewSrc} alt="Preview" className="h-full w-full object-cover" style={previewMediaStyle} />
                        ) : (
                          <video src={mediaPreviewSrc} className="h-full w-full object-cover" style={previewMediaStyle} controls playsInline preload="metadata" />
                        )
                      ) : null}
                      <StudioEffectOverlay effect={studioEffect} />
                      <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white">
                        {studioDuration} · {studioSpeed}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-[22px] bg-white p-3 shadow-sm ring-1 ring-slate-200 dark:bg-[#151515] dark:ring-white/10 sm:p-4">
                    <div>
                      <p className="text-sm font-extrabold">{locale === 'id' ? 'Edit cepat' : 'Quick edit'}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          { label: 'Audio', icon: Music, action: () => setStudioPanel('music') },
                          { label: 'Filter', icon: Sparkles, action: () => setStudioPanel('filters') },
                          { label: locale === 'id' ? 'Efek' : 'Effects', icon: SlidersHorizontal, action: () => setStudioPanel('effects') },
                          { label: locale === 'id' ? 'Kecepatan' : 'Speed', icon: Play, action: () => setStudioPanel('speed') },
                        ].map(item => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.label}
                              type="button"
                              onClick={item.action}
                              className="flex min-h-[74px] flex-col items-center justify-center gap-2 rounded-[16px] bg-slate-100 text-xs font-bold text-slate-800 transition active:scale-[0.98] dark:bg-white/8 dark:text-white"
                            >
                              <Icon className="h-5 w-5" />
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>


                    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-slate-200 px-3.5 text-sm font-bold dark:border-white/10">
                      <span className="inline-flex items-center gap-2"><Images className="h-4 w-4" />{locale === 'id' ? 'Ganti video' : 'Replace video'}</span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                        onChange={event => handleFile(event.target.files?.[0] ?? null)}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="mx-auto grid w-full max-w-[920px] gap-3 p-3 pb-4 sm:gap-4 sm:p-4 md:grid-cols-[170px_minmax(0,1fr)] md:items-start md:gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
                  <div className="mx-auto w-full max-w-[112px] sm:max-w-[140px] md:sticky md:top-4 md:max-w-[170px] lg:max-w-[210px]">
                    <div className="relative aspect-[9/16] overflow-hidden rounded-[18px] bg-black shadow-lg">
                      {mediaPreviewSrc ? (
                        isImageMedia ? (
                          <img src={mediaPreviewSrc} alt="Cover preview" className="h-full w-full object-cover" style={previewMediaStyle} />
                        ) : (
                          <video
                            ref={postPreviewVideoRef}
                            src={mediaPreviewSrc}
                            className="h-full w-full object-cover"
                            style={previewMediaStyle}
                            muted
                            playsInline
                            preload="metadata"
                            onLoadedMetadata={event => {
                              const duration = Number.isFinite(event.currentTarget.duration)
                                ? Math.max(0, event.currentTarget.duration * 1000)
                                : 0;
                              setPreviewDurationMs(duration);
                              if (form.coverTimestampMs > 0 && duration > 0) {
                                setCoverTimestamp(Math.min(form.coverTimestampMs, duration));
                              }
                            }}
                          />
                        )
                      ) : null}
                      <StudioEffectOverlay effect={studioEffect} />
                    </div>
                  </div>

                  <div className="min-w-0 space-y-3">
                    {REELS_LIVE_ENABLED && form.captureMode === 'live' ? (
                      <section className="rounded-[18px] bg-white p-3.5 ring-1 ring-slate-200 dark:bg-[#151515] dark:ring-white/10">
                        <label className="block">
                          <span className={fieldLabelClass}>{locale === 'id' ? 'Judul live' : 'Live title'}</span>
                          <input
                            value={form.liveTitle}
                            onChange={event => setField('liveTitle', event.target.value)}
                            maxLength={90}
                            placeholder={locale === 'id' ? 'Contoh: Packing pesanan sore ini' : 'Example: Packing orders live'}
                            className={inputClass}
                          />
                        </label>
                        <label className="mt-3 block">
                          <span className={fieldLabelClass}>{locale === 'id' ? 'Jadwal' : 'Schedule'}</span>
                          <input
                            type="datetime-local"
                            value={form.liveSchedule}
                            onChange={event => setField('liveSchedule', event.target.value)}
                            className={inputClass}
                          />
                        </label>
                      </section>
                    ) : null}

                    <section className="rounded-[18px] bg-white p-3.5 ring-1 ring-slate-200 dark:bg-[#151515] dark:ring-white/10 sm:p-4">
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-black text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
                          {displayName.trim().charAt(0).toUpperCase() || 'L'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-500 dark:text-white/55">{displayName}</p>
                          <textarea
                            value={form.caption}
                            onChange={event => setField('caption', event.target.value)}
                            maxLength={2200}
                            rows={5}
                            placeholder={locale === 'id' ? 'Tulis caption... #hashtag @akun' : 'Write a caption... #hashtag @account'}
                            className="mt-1 min-h-[120px] w-full resize-none bg-transparent text-[15px] font-medium leading-6 text-slate-950 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/35"
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex gap-1.5">
                              <button type="button" onClick={() => appendCaptionToken('#')} className="min-h-8 rounded-full bg-slate-100 px-3 text-xs font-bold text-slate-700 dark:bg-white/8 dark:text-white"># Hashtag</button>
                              <button type="button" onClick={() => appendCaptionToken('@')} className="min-h-8 rounded-full bg-slate-100 px-3 text-xs font-bold text-slate-700 dark:bg-white/8 dark:text-white">@ {locale === 'id' ? 'Sebut' : 'Mention'}</button>
                            </div>
                            <span className="text-[10px] font-semibold tabular-nums text-slate-400">{postingCaptionLength}/2200</span>
                          </div>
                        </div>
                      </div>
                    </section>

                    {!isImageMedia && previewDurationMs > 0 ? (
                      <section className="rounded-[18px] bg-white p-3.5 ring-1 ring-slate-200 dark:bg-[#151515] dark:ring-white/10">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold">{locale === 'id' ? 'Pilih sampul' : 'Choose cover'}</p>
                            <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-white/45">
                              {Math.round(form.coverTimestampMs / 100) / 10}s
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400">{Math.round(coverPercent)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(1, previewDurationMs)}
                          step={100}
                          value={Math.min(form.coverTimestampMs, previewDurationMs)}
                          onChange={event => setCoverTimestamp(Number(event.target.value))}
                          className="mt-3 w-full accent-emerald-600"
                          aria-label={locale === 'id' ? 'Waktu sampul video' : 'Video cover time'}
                        />
                      </section>
                    ) : null}

                    <section className="overflow-hidden rounded-[18px] bg-white ring-1 ring-slate-200 dark:bg-[#151515] dark:ring-white/10">
                      <details className="group border-b border-slate-100 dark:border-white/8">
                        <summary className={toggleRowClass}>
                          <span className="inline-flex min-w-0 items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-200"><ShoppingBag className="h-4 w-4" /></span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold">{locale === 'id' ? 'Tambahkan produk / usaha' : 'Add product / business'}</span>
                              <span className="block truncate text-[11px] font-medium text-slate-400">{selectedStore?.name || form.productName || (locale === 'id' ? 'Opsional' : 'Optional')}</span>
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" />
                        </summary>
                        <div className="space-y-3 border-t border-slate-100 p-3.5 dark:border-white/8">
                          <select value={linkedStoreId} onChange={event => setLinkedStoreId(event.target.value)} className={inputClass} disabled={storesLoading}>
                            <option value="">{storesLoading ? 'Memuat usaha...' : locale === 'id' ? 'Pilih usaha (opsional)' : 'Choose business (optional)'}</option>
                            {storeOptions.map(store => <option key={store.id} value={store.id}>{store.name}{store.city ? ` · ${store.city}` : ''}</option>)}
                          </select>
                          <input value={form.productName} onChange={event => setField('productName', event.target.value)} maxLength={90} placeholder={locale === 'id' ? 'Nama produk / layanan' : 'Product / service name'} className={inputClass} />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input value={form.productPrice} onChange={event => setField('productPrice', event.target.value)} maxLength={60} placeholder={locale === 'id' ? 'Harga, contoh Rp25.000' : 'Price'} className={inputClass} />
                            <input value={form.productHref} onChange={event => setField('productHref', event.target.value)} maxLength={500} placeholder={locale === 'id' ? 'Link listing (opsional)' : 'Listing link (optional)'} className={inputClass} />
                          </div>
                        </div>
                      </details>

                      <details className="group border-b border-slate-100 dark:border-white/8">
                        <summary className={toggleRowClass}>
                          <span className="inline-flex min-w-0 items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-700 dark:bg-sky-500/12 dark:text-sky-200"><MapPin className="h-4 w-4" /></span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold">{locale === 'id' ? 'Tambahkan lokasi' : 'Add location'}</span>
                              <span className="block truncate text-[11px] font-medium text-slate-400">{form.location || selectedStore?.city || (locale === 'id' ? 'Opsional' : 'Optional')}</span>
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" />
                        </summary>
                        <div className="border-t border-slate-100 p-3.5 dark:border-white/8">
                          <input value={form.location} onChange={event => setField('location', event.target.value)} maxLength={120} placeholder={locale === 'id' ? 'Contoh: Bandung' : 'Example: Bandung'} className={inputClass} />
                        </div>
                      </details>

                      <div className={toggleRowClass}>
                        <span className="inline-flex min-w-0 items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-700 dark:bg-violet-500/12 dark:text-violet-200"><Eye className="h-4 w-4" /></span>
                          <span className="text-sm font-bold">{locale === 'id' ? 'Siapa yang bisa melihat' : 'Who can view'}</span>
                        </span>
                        <select
                          value={form.visibility}
                          onChange={event => setField('visibility', event.target.value as ReelVisibility)}
                          className="max-w-[150px] bg-transparent text-right text-xs font-bold text-slate-600 outline-none dark:text-white/70"
                        >
                          <option value="public">{locale === 'id' ? 'Semua orang' : 'Everyone'}</option>
                          <option value="followers">{locale === 'id' ? 'Pengikut' : 'Followers'}</option>
                          <option value="private">{locale === 'id' ? 'Hanya saya' : 'Only me'}</option>
                        </select>
                      </div>

                      <details className="group border-t border-slate-100 dark:border-white/8">
                        <summary className={toggleRowClass}>
                          <span className="inline-flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700 dark:bg-white/8 dark:text-white"><SlidersHorizontal className="h-4 w-4" /></span>
                            <span className="text-sm font-bold">{locale === 'id' ? 'Opsi lainnya' : 'More options'}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 text-slate-400 transition group-open:rotate-90" />
                        </summary>
                        <div className="space-y-1 border-t border-slate-100 p-2 dark:border-white/8">
                          {[
                            { key: 'allowComments' as const, label: locale === 'id' ? 'Izinkan komentar' : 'Allow comments', value: form.allowComments },
                            { key: 'shareToMainFeed' as const, label: locale === 'id' ? 'Tampilkan juga di profil' : 'Also show on profile', value: form.shareToMainFeed },
                            { key: 'promotionalContent' as const, label: locale === 'id' ? 'Konten promosi / kerja sama' : 'Promotional / branded content', value: form.promotionalContent },
                            { key: 'aiGenerated' as const, label: locale === 'id' ? 'Dibuat atau diubah dengan AI' : 'Made or altered with AI', value: form.aiGenerated },
                          ].map(option => (
                            <label key={option.key} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-2.5 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/5">
                              <span>{option.label}</span>
                              <span
                                className={cn(
                                  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition',
                                  option.value ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-white/15',
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={option.value}
                                  onChange={event => setField(option.key, event.target.checked)}
                                  className="sr-only"
                                />
                                <span
                                  className={cn(
                                    'h-5 w-5 rounded-full bg-white shadow-sm transition',
                                    option.value && 'translate-x-5',
                                  )}
                                />
                              </span>
                            </label>
                          ))}
                        </div>
                      </details>
                    </section>

                    {error ? (
                      <div role="alert" className="rounded-[16px] bg-rose-50 px-3.5 py-3 text-xs font-bold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/20">
                        {error}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            {step === 'post' ? (
              <div className="relative z-30 shrink-0 border-t border-slate-200 bg-white/96 px-3 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur dark:border-white/10 dark:bg-[#090909]/96 sm:px-4">
                <div className="mx-auto flex max-w-[920px] items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('edit')}
                    className="h-11 rounded-full border border-slate-200 px-4 text-sm font-bold dark:border-white/14"
                  >
                    {locale === 'id' ? 'Kembali' : 'Back'}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !hasMedia}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-extrabold text-white shadow-lg shadow-emerald-700/20 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {submitting
                      ? locale === 'id' ? 'Memposting...' : 'Posting...'
                      : REELS_LIVE_ENABLED && form.captureMode === 'live'
                        ? locale === 'id' ? 'Jadwalkan live' : 'Schedule live'
                        : locale === 'id' ? 'Posting' : 'Post'}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}

        {studioPanel && step !== 'post' ? (
          <div className="absolute inset-x-0 bottom-0 z-50 max-h-[48dvh] overflow-y-auto rounded-t-[24px] bg-[#111] p-3 pb-[max(14px,env(safe-area-inset-bottom))] text-white shadow-2xl ring-1 ring-white/10 md:absolute md:left-auto md:right-3 md:bottom-3 md:w-[360px] md:rounded-[22px]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-extrabold">
                {studioPanel === 'filters' ? 'Filter' : studioPanel === 'effects' ? (locale === 'id' ? 'Efek' : 'Effects') : studioPanel === 'music' ? 'Audio' : studioPanel === 'speed' ? (locale === 'id' ? 'Kecepatan' : 'Speed') : 'Link video'}
              </p>
              <button type="button" onClick={() => setStudioPanel(null)} className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><X className="h-4 w-4" /></button>
            </div>

            {studioPanel === 'filters' ? (
              <div className="grid grid-cols-3 gap-2">
                {REEL_FILTER_PRESETS.map(filter => (
                  <button key={filter.id} type="button" onClick={() => { setField('filterPreset', filter.id); setStudioPanel(null); }} className={cn('rounded-[14px] p-2 text-[11px] font-bold', form.filterPreset === filter.id ? 'bg-white text-slate-950' : 'bg-white/8 text-white')}>
                    <span className={cn('mx-auto mb-2 block h-12 w-full rounded-[10px]', filter.swatch)} />{filter.label}
                  </button>
                ))}
              </div>
            ) : studioPanel === 'effects' ? (
              <div className="grid grid-cols-3 gap-2">
                {REELS_STUDIO_EFFECTS.map(effect => (
                  <button key={effect.id} type="button" onClick={() => { setStudioEffect(effect.id); setStudioPanel(null); }} className={cn('rounded-[14px] p-2 text-[11px] font-bold', studioEffect === effect.id ? 'bg-white text-slate-950' : 'bg-white/8 text-white')}>
                    <span className={cn('mx-auto mb-2 block h-12 w-full rounded-[10px]', effect.swatch)} />{effect.label}
                  </button>
                ))}
              </div>
            ) : studioPanel === 'music' ? (
              <div className="space-y-1.5">
                {REELS_MUSIC_TRACKS.map(track => (
                  <button key={track} type="button" onClick={() => { setField('musicTrack', track); setStudioPanel(null); }} className={cn('flex min-h-11 w-full items-center gap-3 rounded-[13px] px-3 text-left text-sm font-bold', form.musicTrack === track ? 'bg-white text-slate-950' : 'bg-white/8 text-white')}><Music className="h-4 w-4" />{track}</button>
                ))}
              </div>
            ) : studioPanel === 'speed' ? (
              <div className="grid grid-cols-5 gap-1.5">
                {REELS_STUDIO_SPEEDS.map(speed => (
                  <button key={speed} type="button" onClick={() => { setStudioSpeed(speed); setStudioPanel(null); }} className={cn('min-h-11 rounded-[13px] text-xs font-extrabold', studioSpeed === speed ? 'bg-white text-slate-950' : 'bg-white/8 text-white')}>{speed}</button>
                ))}
              </div>
            ) : (
              <div>
                <input value={form.mediaUrl} onChange={event => setField('mediaUrl', event.target.value)} placeholder="https://.../video.mp4" className="h-11 w-full rounded-[13px] border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white outline-none placeholder:text-white/35" />
                <button
                  type="button"
                  onClick={() => {
                    const url = form.mediaUrl.trim();
                    if (!isDirectVideoMediaUrl(url)) {
                      setError(locale === 'id' ? 'Gunakan link langsung video HTTPS (.mp4/.webm/.mov/.m4v).' : 'Use a direct HTTPS video URL.');
                      return;
                    }
                    setFile(null);
                    setField('captureMode', 'upload');
                    setStudioMode('link');
                    setStudioPanel(null);
                    setStep('edit');
                  }}
                  className="mt-2 h-11 w-full rounded-full bg-white text-sm font-extrabold text-slate-950"
                >
                  {locale === 'id' ? 'Gunakan video ini' : 'Use this video'}
                </button>
              </div>
            )}
          </div>
        ) : null}

        {error && step !== 'post' ? (
          <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-[60] rounded-[16px] bg-rose-600 px-3 py-2.5 text-xs font-bold text-white shadow-xl md:left-1/2 md:right-auto md:w-[420px] md:-translate-x-1/2">
            {error}
          </div>
        ) : null}
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
    <div className="ui-layer-modal fixed inset-0 flex items-end bg-black/65 text-slate-950 sm:items-center sm:justify-center sm:p-4">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0"
      />
      <section className="relative max-h-[calc(100dvh-8px)] w-full min-w-0 overflow-y-auto rounded-t-[28px] bg-white p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[calc(100dvh-32px)] sm:max-w-[420px] sm:rounded-[28px]">
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
