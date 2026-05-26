'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppBack } from '@/lib/navigation/useAppBack';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type TouchEvent,
  type UIEvent,
  type WheelEvent,
} from 'react';
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
  Play,
  Plus,
  Radio,
  RefreshCcw,
  Search,
  Send,
  ShoppingBag,
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
import {
  normalizePlayableReel,
  normalizePlayableReels,
  REELS_PAGE_SIZE,
  type LajukanReel,
  type ReelsPageResult,
} from '../../_data/reels';

type ReelsClientProps = {
  locale: string;
  initialIndex: number;
  initialItems: LajukanReel[];
  initialCursor: number | null;
  initialHasMore: boolean;
  initialSearchQuery: string;
};

const iconMap: Record<LajukanReel['iconKey'], LucideIcon> = {
  supplier: BriefcaseBusiness,
  marketing: Megaphone,
  finance: WalletCards,
  packaging: Box,
  frozen: ShoppingBag,
};

type ReelsSignal =
  | 'watch'
  | 'like'
  | 'comment'
  | 'share'
  | 'save'
  | 'detail'
  | 'product';

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
  title: string;
  caption: string;
  tag: string;
  mediaUrl: string;
  hook: string;
  productName: string;
  productPrice: string;
  productHref: string;
  storeName: string;
  storeCity: string;
};

type UploadReelStep = 'media' | 'edit' | 'post';

type ReelsFeedTab = 'fyp' | 'friends' | 'following';

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
  title: '',
  caption: '',
  tag: 'UMKM',
  mediaUrl: '',
  hook: '',
  productName: '',
  productPrice: '',
  productHref: '',
  storeName: '',
  storeCity: '',
};

const REELS_FEED_TABS: Array<{ id: ReelsFeedTab; label: string }> = [
  { id: 'fyp', label: 'FYP' },
  { id: 'friends', label: 'Teman' },
  { id: 'following', label: 'Diikuti' },
];

const SIGNAL_WEIGHT: Record<ReelsSignal, number> = {
  watch: 0.7,
  like: 4,
  comment: 3.2,
  share: 4.8,
  save: 5.5,
  detail: 2.4,
  product: 6,
};

const BACKEND_SIGNAL_EVENT: Record<ReelsSignal, string> = {
  watch: 'watch',
  like: 'like',
  comment: 'comment',
  share: 'share',
  save: 'view',
  detail: 'view',
  product: 'open_product',
};

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
  } catch {}
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
  } catch {}
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

export default function ReelsClient({
  locale,
  initialIndex,
  initialItems,
  initialCursor,
  initialHasMore,
  initialSearchQuery,
}: ReelsClientProps) {
  const { user, isAuthenticated, authFetch } = useAuth();
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
  const [autoScroll, setAutoScroll] = useState(false);
  const [bufferingId, setBufferingId] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(Boolean(initialSearchQuery));
  const [searchSeed, setSearchSeed] = useState(initialSearchQuery);
  const [detailReel, setDetailReel] = useState<LajukanReel | null>(null);
  const [productReel, setProductReel] = useState<LajukanReel | null>(null);
  const [commentsReel, setCommentsReel] = useState<LajukanReel | null>(null);
  const [shareReel, setShareReel] = useState<LajukanReel | null>(null);
  const [commentsByReel, setCommentsByReel] = useState<
    Record<string, ReelCommentsBucket>
  >({});
  const [commentBody, setCommentBody] = useState('');
  const [replyTarget, setReplyTarget] = useState<ReelComment | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);
  const [chatBusyReelId, setChatBusyReelId] = useState<string | null>(null);

  const overlayOpen =
    searchOpen ||
    detailReel !== null ||
    productReel !== null ||
    commentsReel !== null ||
    shareReel !== null ||
    uploadOpen ||
    authPrompt !== null;

  const activeReel = useMemo(() => {
    if (items.length === 0) return null;
    return items[Math.min(activeIndex, items.length - 1)] || null;
  }, [activeIndex, items]);

  const learnedTerms = useMemo(() => topProfileTerms(profile), [profile]);
  const activeSearchQuery = searchContextQuery.trim();

  const loginHref = useMemo(() => {
    const callbackUrl = `/${locale}/reels?video=${Math.max(activeIndex + 1, 1)}`;
    return `/${locale}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }, [activeIndex, locale]);

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

      void fetch(`/api/reels/${encodeURIComponent(reel.id)}/events`, {
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
    [replaceReel],
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
          'Creator reels seed belum terhubung ke akun chat. Coba reels yang dibuat user login.',
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
        Math.max(items.length - 1, 0),
      );

      container.scrollTo({
        top: nextIndex * container.clientHeight,
        behavior,
      });

      setActiveIndex(nextIndex);
      setPausedByUser(false);
    },
    [items.length],
  );

  const snapToAdjacent = useCallback(
    (direction: -1 | 1) => {
      if (overlayOpen || scrollLockRef.current || items.length === 0) return;

      const nextIndex = Math.min(
        Math.max(activeIndex + direction, 0),
        Math.max(items.length - 1, 0),
      );

      if (nextIndex === activeIndex) return;

      scrollLockRef.current = true;
      scrollToIndex(nextIndex);

      window.setTimeout(() => {
        scrollLockRef.current = false;
      }, REELS_SNAP_LOCK_MS);
    },
    [activeIndex, items.length, overlayOpen, scrollToIndex],
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
      if (!container || items.length === 0) return;

      const height = container.clientHeight || window.innerHeight;
      const rawIndex = Math.round(container.scrollTop / height);

      const nextIndex = Math.min(
        Math.max(rawIndex, 0),
        Math.max(items.length - 1, 0),
      );

      setActiveIndex(prev => (prev === nextIndex ? prev : nextIndex));

      const distanceToBottom =
        container.scrollHeight - (container.scrollTop + height);

      if (distanceToBottom < height * 2) {
        void loadMore();
      }
    });
  }, [items.length, loadMore]);

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
    if (activeIndex < items.length) {
      window.history.replaceState(
        null,
        '',
        `/${locale}/reels?video=${activeIndex + 1}`,
      );
    }
  }, [activeIndex, items.length, locale]);

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
    items.forEach((item, index) => {
      const video = videoRefs.current[item.id];
      if (!video) return;

      video.muted = muted;
      video.volume = muted ? 0 : 1;

      if (overlayOpen) {
        video.pause();
        return;
      }

      if (index === activeIndex && !pausedByUser) {
        video.play().catch(() => {
          if (!muted) {
            video.muted = true;
            video.volume = 0;
            setMuted(true);
            setSoundUnlocked(false);
            writeSoundPreference(true);
          }
        });
      } else {
        video.pause();
      }
    });
  }, [activeIndex, items, muted, overlayOpen, pausedByUser]);

  useEffect(() => {
    return () => {
      Object.values(videoRefs.current).forEach(video => {
        video?.pause();
      });
    };
  }, []);

  function toggleCurrentVideo() {
    if (!activeReel) return;

    const video = videoRefs.current[activeReel.id];
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
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
      video.play().catch(() => {});
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

  return (
    <main className="h-[100svh] overflow-hidden bg-black text-white">
      <div className="relative grid h-full w-full grid-cols-1 overflow-hidden bg-[#050505] lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="relative min-w-0 overflow-hidden bg-black lg:bg-[#050505]">
          <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(250,204,21,0.10),transparent_32%)] lg:block" />

          <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-black shadow-2xl sm:max-w-[460px] lg:my-3 lg:h-[calc(100svh-24px)] lg:max-w-[430px] lg:rounded-[32px] lg:ring-1 lg:ring-white/10">
            <ReelsTopBar
              locale={locale}
              muted={muted}
              autoScroll={autoScroll}
              feedTab={feedTab}
              searchQuery={activeSearchQuery}
              onToggleSound={toggleSound}
              onToggleAutoScroll={() => setAutoScroll(current => !current)}
              onFeedTabChange={handleFeedTabChange}
              onOpenSearch={() => openSearchOverlay(activeSearchQuery)}
              onOpenUpload={requestUpload}
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
                items.map((reel, index) => (
                  <ReelSlide
                    key={reel.id}
                    reel={reel}
                    active={index === activeIndex}
                    shouldLoad={Math.abs(index - activeIndex) <= 1}
                    muted={muted}
                    soundUnlocked={soundUnlocked}
                    paused={pausedByUser && index === activeIndex}
                    buffering={bufferingId === reel.id && index === activeIndex}
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
                    onSignal={signal => recordSignal(reel, signal)}
                  />
                ))
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

            {!hasMore &&
              activeIndex >= items.length - 1 &&
              items.length > 0 && (
                <EndMiniToast
                  onRestart={() => scrollToIndex(0)}
                  onSearch={() => openSearchOverlay('')}
                />
              )}
          </div>
        </div>

        <ReelsDesktopInfoSidebar
          locale={locale}
          reel={activeReel}
          commentsBucket={
            activeReel ? commentsByReel[activeReel.id] : undefined
          }
          chatBusy={chatBusyReelId === activeReel?.id}
          onOpenDetail={() => {
            if (!activeReel) return;
            recordSignal(activeReel, 'detail');
            setDetailReel(activeReel);
          }}
          onOpenComments={() => {
            if (!activeReel) return;
            openComments(activeReel);
          }}
          onOpenProduct={() => {
            if (!activeReel) return;
            recordSignal(activeReel, 'product');
            setProductReel(activeReel);
          }}
          onOpenShare={() => {
            if (!activeReel) return;
            openShareSheet(activeReel);
          }}
          onMessageCreator={() => {
            if (!activeReel) return;
            void startChatFromReel(activeReel);
          }}
          onSave={() => {
            if (!activeReel) return;
            recordSignal(activeReel, 'save');
          }}
          onOpenUpload={requestUpload}
          onOpenSearch={() => openSearchOverlay(activeSearchQuery)}
        />

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
          reel={detailReel}
          onSignal={(reel, signal) => recordSignal(reel, signal)}
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

        <UploadReelSheet
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
          <Upload className="h-4.5 w-4.5" />
          Upload Reels
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
  commentsBucket,
  chatBusy,
  onOpenDetail,
  onOpenComments,
  onOpenProduct,
  onOpenShare,
  onMessageCreator,
  onSave,
  onOpenUpload,
  onOpenSearch,
}: {
  locale: string;
  reel: LajukanReel | null;
  commentsBucket?: ReelCommentsBucket;
  chatBusy: boolean;
  onOpenDetail: () => void;
  onOpenComments: () => void;
  onOpenProduct: () => void;
  onOpenShare: () => void;
  onMessageCreator: () => void;
  onSave: () => void;
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
  const recentComments = commentsBucket?.items.slice(0, 2) ?? [];
  const productHref = reel.productHref
    ? localizedHref(locale, reel.productHref)
    : null;
  const actions: Array<{
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    featured?: boolean;
  }> = [
    { label: 'Detail', icon: Info, onClick: onOpenDetail },
    { label: 'Komentar', icon: MessageCircle, onClick: onOpenComments },
    { label: 'Share', icon: Forward, onClick: onOpenShare, featured: true },
    { label: 'Simpan', icon: Bookmark, onClick: onSave },
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
            />
          ) : (
            <video
              src={reel.videoSrc}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              loop
              playsInline
              preload="metadata"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/14 to-black/20" />
          <div className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-black backdrop-blur">
            {reel.tag}
          </div>
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
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{reel.creator}</p>
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
                Keranjang
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
            <Upload className="h-4.5 w-4.5" />
            Upload
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
  muted,
  autoScroll,
  feedTab,
  searchQuery,
  onToggleSound,
  onToggleAutoScroll,
  onFeedTabChange,
  onOpenSearch,
  onOpenUpload,
}: {
  locale: string;
  muted: boolean;
  autoScroll: boolean;
  feedTab: ReelsFeedTab;
  searchQuery: string;
  onToggleSound: () => void;
  onToggleAutoScroll: () => void;
  onFeedTabChange: (tab: ReelsFeedTab) => void;
  onOpenSearch: () => void;
  onOpenUpload: () => void;
}) {
  const router = useRouter();
  const hasSearchContext = searchQuery.trim().length > 0;
  const handleBack = useAppBack(router, `/${locale}/home`);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-50 bg-gradient-to-b from-black/86 via-black/36 to-transparent px-2.5 pb-4 pt-[calc(env(safe-area-inset-top)+7px)] sm:px-4 sm:pb-6">
      <div className="pointer-events-auto grid min-w-0 gap-2">
        <div className="grid min-h-9 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-1.5 sm:min-h-10 sm:gap-2">
          <button
            type="button"
            onClick={handleBack}
            aria-label={locale === 'id' ? 'Kembali' : 'Back'}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black/42 font-black text-white backdrop-blur-xl transition active:scale-[0.96] sm:h-10 sm:w-10"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>

          <div className="flex min-w-0 justify-center px-1">
            {hasSearchContext ? (
              <button
                type="button"
                onClick={onOpenSearch}
                className="inline-flex h-9 min-w-0 max-w-full items-center gap-2 rounded-full border border-white/14 bg-black/45 px-3 text-left text-xs font-bold text-white/90 backdrop-blur-xl transition active:scale-[0.98] sm:h-10 sm:px-4 sm:text-sm"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="truncate">Hasil: {searchQuery}</span>
                <Sparkles className="hidden h-3.5 w-3.5 shrink-0 text-yellow-300 min-[390px]:block" />
              </button>
            ) : (
              <span className="hidden min-h-9 items-center rounded-full border border-white/12 bg-black/30 px-3 text-xs font-black uppercase tracking-[0.12em] text-white/70 backdrop-blur-xl min-[380px]:inline-flex sm:min-h-10">
                Reels
              </span>
            )}
          </div>

          <div className="flex h-9 shrink-0 items-start justify-end gap-1.5 sm:h-10">
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Cari reels"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/12 bg-black/42 text-white backdrop-blur-xl transition active:scale-[0.96] sm:h-10 sm:w-10"
            >
              <Search className="h-4.5 w-4.5" />
            </button>

            <button
              type="button"
              onClick={onOpenUpload}
              aria-label={locale === 'id' ? 'Upload reels' : 'Upload reels'}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-300/40 bg-emerald-400 text-slate-950 shadow-[0_12px_22px_-16px_rgba(16,185,129,0.8)] backdrop-blur-xl transition active:scale-[0.96] sm:h-10 sm:w-10"
            >
              <Plus className="h-4.5 w-4.5" />
            </button>

            <button
              type="button"
              onClick={onToggleAutoScroll}
              aria-pressed={autoScroll}
              aria-label={
                autoScroll ? 'Matikan auto scroll' : 'Nyalakan auto scroll'
              }
              className={cn(
                'hidden h-9 w-9 shrink-0 place-items-center rounded-full border border-white/12 bg-black/42 text-white backdrop-blur-xl transition active:scale-[0.96] min-[420px]:grid sm:h-10 sm:w-10',
                autoScroll &&
                  'border-emerald-300/50 bg-emerald-400 text-slate-950',
              )}
            >
              <RefreshCcw
                className={cn('h-4.5 w-4.5', autoScroll && 'animate-spin')}
              />
            </button>

            <button
              type="button"
              onClick={onToggleSound}
              aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/12 bg-black/42 text-white backdrop-blur-xl transition active:scale-[0.96] sm:h-10 sm:w-10"
            >
              {muted ? (
                <VolumeX className="h-4.5 w-4.5" />
              ) : (
                <Volume2 className="h-4.5 w-4.5" />
              )}
            </button>
          </div>
        </div>

        {!hasSearchContext ? (
          <div className="flex min-w-0 justify-center">
            <nav
              aria-label="Filter reels"
              className="inline-flex h-9 max-w-full items-center justify-center gap-0.5 rounded-full border border-white/16 bg-black/48 p-1 text-[12px] font-black shadow-[0_16px_34px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:h-10 sm:text-sm"
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
                    'relative h-7 rounded-full px-2.5 text-white/62 transition active:scale-95 sm:h-8 sm:px-3',
                    feedTab === tab.id &&
                      'bg-white text-slate-950 shadow-lg shadow-black/24 after:absolute after:inset-x-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-emerald-400',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        ) : null}
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
    <div className="flex h-full snap-start items-center justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+6rem)] text-center">
      <div className="w-full max-w-[320px] rounded-[28px] border border-white/10 bg-white/[0.07] p-5 text-white shadow-[0_24px_58px_-36px_rgba(0,0,0,0.85)] backdrop-blur-xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400 text-slate-950">
          <Clapperboard className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-black leading-tight">
          {isId ? 'Belum ada reels di database' : 'No reels in database yet'}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-white/62">
          {isId
            ? 'Upload video usaha pertama, atau cek koneksi community service kalau data seed belum muncul.'
            : 'Upload the first business video, or check the community service connection if seed data is not visible.'}
        </p>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={onUpload}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-400 px-4 text-sm font-black text-slate-950 transition active:scale-[0.98]"
          >
            <Upload className="h-4.5 w-4.5" />
            {isId ? 'Upload Reels' : 'Upload Reels'}
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

/* =========================
   MAIN REEL
========================= */

function ReelSlide({
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
  onOpenDetail,
  onOpenComments,
  onOpenProduct,
  onOpenShare,
  onSignal,
}: {
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
  onOpenDetail: () => void;
  onOpenComments: () => void;
  onOpenProduct: () => void;
  onOpenShare: () => void;
  onSignal: (signal: ReelsSignal) => void;
}) {
  const Icon = iconMap[reel.iconKey];
  const imageMedia = isImageMediaUrl(reel.videoSrc);

  return (
    <article className="relative flex h-full snap-start overflow-hidden px-3 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-[calc(env(safe-area-inset-top)+58px)] sm:px-4 sm:pb-[calc(env(safe-area-inset-bottom)+24px)] sm:pt-[calc(env(safe-area-inset-top)+66px)]">
      {imageMedia ? (
        <img
          src={shouldLoad ? reel.videoSrc : undefined}
          alt={reel.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <video
          ref={setVideoRef}
          src={shouldLoad ? reel.videoSrc : undefined}
          className="absolute inset-0 h-full w-full object-cover"
          muted={muted}
          loop
          playsInline
          preload={shouldLoad ? 'metadata' : 'none'}
          disablePictureInPicture
          onWaiting={onWaiting}
          onPlaying={onPlaying}
          onError={onError}
        />
      )}

      <button
        type="button"
        onClick={onTogglePlay}
        className="absolute inset-0 z-10"
        aria-label={paused ? 'Putar video' : 'Pause video'}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/18 to-black/32" />

      <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+56px)] z-20 flex max-w-[calc(100%-92px)] items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1.5 text-[11px] font-black backdrop-blur sm:left-4 sm:top-[calc(env(safe-area-inset-top)+66px)] sm:max-w-[calc(100%-112px)] sm:gap-2 sm:px-3 sm:py-2 sm:text-xs">
        <Icon className="h-4 w-4" />
        <span className="truncate">{reel.tag}</span>
      </div>

      <ActionRail
        reel={reel}
        onOpenComments={onOpenComments}
        onOpenShare={onOpenShare}
        onSignal={onSignal}
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

      <div className="relative z-20 mt-auto min-w-0 flex-1 pr-[72px] sm:pr-[82px]">
        <CreatorRow reel={reel} />

        <button
          type="button"
          onClick={onOpenDetail}
          className="block text-left"
        >
          <h1 className="text-[19px] font-black leading-tight drop-shadow-sm sm:text-[22px]">
            {reel.title}
          </h1>
        </button>

        <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-relaxed text-white/90 drop-shadow-sm sm:mt-2 sm:line-clamp-3 sm:text-sm">
          {reel.caption}
        </p>

        <ProductCartDock reel={reel} onOpenProduct={onOpenProduct} />

        {!reel.productName && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1.5 text-[11px] font-black text-white backdrop-blur sm:mt-4 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs">
            <Info className="h-3.5 w-3.5" />
            Konten informasi bisnis
          </div>
        )}
      </div>
    </article>
  );
}

function CreatorRow({ reel }: { reel: LajukanReel }) {
  return (
    <div className="mb-2 flex items-center gap-2.5 sm:mb-3 sm:gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-white/15 ring-1 ring-white/20 sm:h-11 sm:w-11">
        <User className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[13px] font-black sm:text-sm">
          {reel.creator}
        </p>
        <p className="text-[11px] font-semibold text-white/70 sm:text-xs">
          Tips bisnis & supplier
        </p>
      </div>

      <button
        type="button"
        className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-950 sm:px-3 sm:py-1.5 sm:text-xs"
      >
        Ikuti
      </button>
    </div>
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
      className="mt-3 inline-flex max-w-[min(260px,calc(100vw-122px))] items-center gap-2 rounded-full bg-yellow-400 px-2 py-1.5 text-left text-slate-950 shadow-xl shadow-yellow-500/20 ring-1 ring-yellow-200 transition active:scale-[0.98] sm:mt-4 sm:max-w-[300px] sm:gap-2.5 sm:px-2.5 sm:py-2"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-950 text-yellow-300 sm:h-10 sm:w-10">
        <ShoppingBag className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-black sm:text-[13px]">
          1 item
        </span>
        <span className="block truncate text-[10px] font-bold text-slate-700 sm:text-[11px]">
          {reel.productPrice}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" />
    </button>
  );
}

function ActionRail({
  reel,
  onOpenComments,
  onOpenShare,
  onSignal,
}: {
  reel: LajukanReel;
  onOpenComments: () => void;
  onOpenShare: () => void;
  onSignal: (signal: ReelsSignal) => void;
}) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [followed, setFollowed] = useState(false);

  const actions: Array<{
    key: string;
    label: string;
    icon: LucideIcon;
    active?: boolean;
    onClick: () => void;
  }> = [
    {
      key: 'like',
      label: formatCompactMetric(metricCount(reel, 'likes') + (liked ? 1 : 0)),
      icon: Heart,
      active: liked,
      onClick: () => {
        setLiked(value => {
          const next = !value;
          if (next) onSignal('like');
          return next;
        });
      },
    },
    {
      key: 'comments',
      label: formatCompactMetric(metricCount(reel, 'comments')),
      icon: MessageCircle,
      onClick: onOpenComments,
    },
    {
      key: 'save',
      label: saved ? 'Tersimpan' : 'Simpan',
      icon: Bookmark,
      active: saved,
      onClick: () => {
        setSaved(value => !value);
        onSignal('save');
      },
    },
    {
      key: 'share',
      label: formatCompactMetric(metricCount(reel, 'shares')),
      icon: Forward,
      onClick: onOpenShare,
    },
  ];

  return (
    <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+132px)] right-2 z-30 flex flex-col items-center gap-2 sm:bottom-[calc(env(safe-area-inset-bottom)+146px)] sm:right-3 sm:gap-2.5">
      <button
        type="button"
        onClick={() => setFollowed(value => !value)}
        className="relative grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-white/30 to-white/10 p-0.5 shadow-xl ring-1 ring-white/20 transition active:scale-95 sm:h-12 sm:w-12"
        aria-label={followed ? 'Mengikuti kreator' : 'Ikuti kreator'}
      >
        <span className="grid h-full w-full place-items-center rounded-full bg-black/45 backdrop-blur">
          <User className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
        </span>
        <span
          className={cn(
            'absolute -bottom-1 grid h-4.5 w-4.5 place-items-center rounded-full text-[10px] font-black text-white ring-2 ring-black sm:h-5 sm:w-5',
            followed ? 'bg-emerald-500' : 'bg-rose-500',
          )}
        >
          {followed ? (
            <Check className="h-3 w-3" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
        </span>
      </button>

      {actions.map(action => {
        const ActionIcon = action.icon;

        return (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            className="flex max-w-[52px] flex-col items-center gap-0.5 transition active:scale-95"
            data-testid={`reels-action-${action.key}`}
          >
            <span
              className={cn(
                'grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/20 transition sm:h-11 sm:w-11',
                action.active && 'bg-white text-rose-600 ring-white',
              )}
            >
              <ActionIcon
                className={cn(
                  'h-5 w-5 sm:h-[22px] sm:w-[22px]',
                  action.active && 'fill-current',
                )}
              />
            </span>
            <span className="max-w-full truncate text-center text-[10px] font-black leading-3 drop-shadow sm:text-[11px]">
              {action.label}
            </span>
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
      {imageMedia ? (
        <img
          src={reel.videoSrc}
          alt={reel.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <video
          src={reel.videoSrc}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          loop
          playsInline
          preload="metadata"
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
  reel,
  onSignal,
  onOpenComments,
  onOpenProduct,
  onOpenShare,
  onMessageCreator,
  chatBusyReelId,
  onClose,
}: {
  reel: LajukanReel | null;
  onSignal: (reel: LajukanReel, signal: ReelsSignal) => void;
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
            />
          ) : (
            <video
              src={reel.videoSrc}
              className="absolute inset-0 h-full w-full object-cover"
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
            <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100">
              <User className="h-5 w-5 text-slate-500" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{reel.creator}</p>
              <p className="text-xs font-semibold text-slate-500">
                {reel.tag} · Tips bisnis
              </p>
            </div>

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
              className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
            >
              Ikuti
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
              onClick={() => onSignal(reel, 'save')}
              className="rounded-2xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-800"
            >
              Simpan
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
    } catch {}

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
                        src={comment.authorAvatarUrl || '/default-avatar.svg'}
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
                              src={
                                reply.authorAvatarUrl || '/default-avatar.svg'
                              }
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
              Keranjang reels
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
  open,
  authFetch,
  displayName,
  onClose,
  onCreated,
}: {
  open: boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  displayName: string;
  onClose: () => void;
  onCreated: (reel: LajukanReel) => void;
}) {
  const [form, setForm] = useState<UploadReelForm>(EMPTY_UPLOAD_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<UploadReelStep>('media');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setFile(null);
      setStep('media');
      setForm(EMPTY_UPLOAD_FORM);
    }
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!open) return null;

  const setField = (field: keyof UploadReelForm, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const mediaPreviewSrc = previewUrl || form.mediaUrl.trim();
  const hasMedia = Boolean(file || form.mediaUrl.trim());
  const isImageMedia = file
    ? file.type.startsWith('image/')
    : isImageMediaUrl(mediaPreviewSrc);
  const fieldLabelClass =
    'text-xs font-black text-[color:var(--app-text)]';
  const inputClass =
    'mt-1 h-11 w-full rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-[13px] font-semibold text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)] focus:border-[color:var(--app-accent-border)] focus:bg-[color:var(--app-surface-strong)]';
  const textareaClass =
    'mt-1 w-full resize-none rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-[13px] font-semibold text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)] focus:border-[color:var(--app-accent-border)] focus:bg-[color:var(--app-surface-strong)]';

  const handleFile = (nextFile: File | null) => {
    setFile(nextFile);
    setError(null);
    if (nextFile && !form.title.trim()) {
      const name = nextFile.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      setField('title', name.slice(0, 90));
    }
  };

  const goNext = () => {
    setError(null);
    if (step === 'media') {
      if (!hasMedia) {
        setError('Pilih video/foto dulu sebelum lanjut.');
        return;
      }
      setStep('edit');
      return;
    }
    if (step === 'edit') {
      setStep('post');
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const title = form.title.trim() || form.hook.trim() || 'Reels usaha';
    const caption = form.caption.trim() || form.hook.trim();
    const tag = form.tag.trim();
    let mediaUrl = form.mediaUrl.trim();

    if (!caption || !tag) {
      setError('Caption dan kategori wajib diisi.');
      return;
    }
    if (!hasMedia) {
      setError('Upload video/foto atau isi URL media dulu.');
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
      onCreated(payload.reel);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Reels gagal dibuat');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="ui-layer-modal fixed inset-0 flex items-end bg-black/72 text-[color:var(--app-text)] backdrop-blur-md lg:items-stretch lg:justify-end lg:bg-black/50 lg:p-0 lg:backdrop-blur-[2px]"
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
        className="relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-[26px] bg-[color:var(--app-surface-strong)] shadow-2xl lg:h-full lg:max-h-none lg:w-[680px] lg:rounded-none lg:border-l lg:border-[color:var(--app-border)] xl:w-[760px]"
      >
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-[color:var(--app-border)] lg:hidden" />
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] px-4 py-2.5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">
              Reels
            </p>
            <h2 className="text-base font-black">Buat video usaha</h2>
          </div>

          <div className="hidden items-center gap-1 rounded-full bg-slate-100 p-1 sm:flex">
            {(['media', 'edit', 'post'] as UploadReelStep[]).map(
              (item, index) => (
                <span
                  key={item}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[11px] font-black',
                    step === item
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500',
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
            className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--app-surface-muted)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
          <div className="grid gap-3 lg:grid-cols-[minmax(190px,250px)_minmax(0,1fr)]">
            <div className="mx-auto w-full max-w-[250px]">
              <div className="relative aspect-[9/16] max-h-[58svh] overflow-hidden rounded-[24px] bg-slate-950 shadow-2xl ring-1 ring-[color:var(--app-border)]">
                {mediaPreviewSrc ? (
                  isImageMedia ? (
                    <img
                      src={mediaPreviewSrc}
                      alt="Preview reels"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <video
                      src={mediaPreviewSrc}
                      className="h-full w-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  )
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

                {(form.hook || form.title) && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
                    <p className="text-[11px] font-black text-yellow-300">
                      {form.tag}
                    </p>
                    <p className="mt-1 line-clamp-2 text-base font-black leading-tight">
                      {form.hook || form.title}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0">
              {step === 'media' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">
                      Langkah 1
                    </p>
                    <h3 className="text-lg font-black leading-tight">
                      Pilih video atau foto
                    </h3>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                      Mulai dari media utama dulu, baru lanjut edit teks dan
                      detail post.
                    </p>
                  </div>

                  <label className="block cursor-pointer rounded-[18px] border-2 border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-center transition hover:border-emerald-300 hover:bg-emerald-50/40">
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
                      Pilih dari perangkat
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[color:var(--app-text-soft)]">
                      MP4, WebM, MOV, JPG, PNG, WebP
                    </p>
                  </label>

                  <label className="block">
                    <span className={fieldLabelClass}>
                      Atau tempel URL media
                    </span>
                    <input
                      value={form.mediaUrl}
                      onChange={event => {
                        setField('mediaUrl', event.target.value);
                        setError(null);
                      }}
                      placeholder="https://... atau /api/forum/media/..."
                      className={inputClass}
                    />
                  </label>

                  {file && (
                    <div className="rounded-2xl bg-[color:var(--app-surface-muted)] px-3 py-2 text-xs font-bold text-[color:var(--app-text-soft)]">
                      Terpilih: {file.name}
                    </div>
                  )}
                </div>
              )}

              {step === 'edit' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">
                      Langkah 2
                    </p>
                    <h3 className="text-lg font-black leading-tight">
                      Edit tampilan reels
                    </h3>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                      Buat hook pendek biar cepat paham.
                    </p>
                  </div>

                  <label className="block">
                    <span className={`${fieldLabelClass} inline-flex items-center gap-1`}>
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
                    <span className={fieldLabelClass}>
                      Judul reels
                    </span>
                    <input
                      value={form.title}
                      onChange={event => setField('title', event.target.value)}
                      maxLength={120}
                      placeholder="Judul singkat untuk detail dan search"
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className={`${fieldLabelClass} inline-flex items-center gap-1`}>
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
                            : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
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
                    <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">
                      Langkah 3
                    </p>
                    <h3 className="text-lg font-black leading-tight">
                      Caption dan produk
                    </h3>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                      Tambahkan konteks usaha, produk, dan link transaksi kalau
                      ada.
                    </p>
                  </div>

                  <label className="block">
                    <span className={fieldLabelClass}>
                      Caption
                    </span>
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
                      <span className={`${fieldLabelClass} inline-flex items-center gap-1`}>
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
                      <span className={fieldLabelClass}>
                        Kota toko
                      </span>
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
                      <span className={fieldLabelClass}>
                        Nama produk
                      </span>
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
                      <span className={fieldLabelClass}>
                        Harga
                      </span>
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
                      <span className={fieldLabelClass}>
                        Link produk
                      </span>
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

        <div className="border-t border-[color:var(--app-border)] p-3.5">
          <div className="flex items-center gap-2">
            {step !== 'media' && (
              <button
                type="button"
                onClick={() => setStep(step === 'post' ? 'edit' : 'media')}
                className="h-11 rounded-full border border-[color:var(--app-border)] px-4 text-sm font-black text-[color:var(--app-text)]"
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
                {submitting ? 'Mengirim...' : 'Publish reels'}
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

function EndMiniToast({
  onRestart,
  onSearch,
}: {
  onRestart: () => void;
  onSearch: () => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-black text-slate-950 shadow-xl backdrop-blur">
        <span>Semua reels sudah dimuat</span>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-3 py-1.5 text-white"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Ulang
        </button>
        <button
          type="button"
          onClick={onSearch}
          className="rounded-full bg-slate-100 px-3 py-1.5"
        >
          Cari
        </button>
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
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${
    hash ? `#${hash}` : ''
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
