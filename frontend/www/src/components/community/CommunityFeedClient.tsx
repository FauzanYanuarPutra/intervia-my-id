'use client';

import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { MediaPreviewCarousel } from '@/components/common/MediaPreviewCarousel';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  BarChart3,
  ChevronRight,
  Crown,
  Earth,
  Expand,
  ImageIcon,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  PlayCircle,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  UserCog,
  Users,
  Upload,
  X,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/system/feedback/ToastProvider';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import {
  isPreviewableContentMediaUrl,
  normalizeContentMediaUrl,
} from '@/lib/content/catalog';
import { cn } from '@/lib/utils';
import type {
  CommunityFeedItem,
  CommunityFeedMedia,
  CommunityFeedCategory,
  CommunityFeedOverview,
  CommunityFeedResponse,
  CommunityFeedTag,
  CommunityFeedTab,
  CommunitySearchKind,
  CommunitySearchResponse,
  CommunityGroup,
  CommunityGroupMember,
  CommunityGroupMembersResponse,
} from '@/lib/community/types';

type CommunityFeedClientProps = {
  isId: boolean;
};

type ComposeMode = 'post' | 'photo' | 'poll' | 'feeling';

type ForumThreadDetail = {
  id: string;
  title: string;
  createdAt: string;
  views: number;
  replyCount: number;
  voteScore?: number;
  viewerVote?: -1 | 0 | 1;
  author: CommunityFeedItem['author'] | null;
  category: CommunityFeedCategory | null;
  tags: CommunityFeedTag[];
  imageUrls?: string[];
};

type ForumPostDetail = {
  id: string;
  threadId: string;
  author: CommunityFeedItem['author'] | null;
  content: string;
  createdAt: string;
  updatedAt?: string | null;
  replyToPostId?: string | null;
  imageUrls?: string[];
  likeCount: number;
  voteScore?: number;
  viewerVote?: -1 | 0 | 1;
};

type ForumPostsResponse = {
  data?: ForumPostDetail[];
};

type CreatedPostPayload = {
  post?: ForumPostDetail;
  error?: string;
};

type CreatedThreadPayload = {
  thread?: {
    id: string;
    title: string;
    createdAt: string;
    lastActivityAt?: string;
    views?: number;
    replyCount?: number;
    likeCount?: number;
    bookmarkCount?: number;
    voteScore?: number;
    viewerVote?: -1 | 0 | 1;
    isPinned?: boolean;
    isSolved?: boolean;
    imageUrls?: string[];
    author?: CommunityFeedItem['author'] | null;
    category?: CommunityFeedCategory | null;
    tags?: CommunityFeedTag[];
  };
  post?: {
    id: string;
    content: string;
    createdAt: string;
    imageUrls?: string[];
  };
};

type ParsedPoll = {
  question: string;
  body: string;
  options: string[];
};

type PollOptionVoteStat = {
  optionIndex: number;
  votes: number;
  viewerVoted?: boolean;
};

type PollVoteResponse = {
  threadId: string;
  totalVotes: number;
  viewerOptionIndex?: number | null;
  options: PollOptionVoteStat[];
  error?: string;
};

const COMMUNITY_MODAL_SHELL_CLASS =
  'ui-layer-modal fixed inset-0 z-[10000] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4';

const COMMUNITY_MODAL_SURFACE_CLASS =
  'flex h-full w-full flex-col overflow-hidden shadow-[0_30px_80px_-40px_rgba(15,23,42,0.42)] sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-[24px]';

const TABS: Array<{
  id: CommunityFeedTab;
  labelId: string;
  labelEn: string;
  captionId: string;
  captionEn: string;
  icon: typeof Users;
}> = [
  {
    id: 'for-you',
    labelId: 'Diskusi',
    labelEn: 'Discussions',
    captionId: 'Pertanyaan, jawaban, dan update usaha',
    captionEn: 'Business questions, answers, and updates',
    icon: MessageCircle,
  },
  {
    id: 'community',
    labelId: 'Grup',
    labelEn: 'Groups',
    captionId: 'Ruang diskusi per topik',
    captionEn: 'Topic-based discussion rooms',
    icon: Users,
  },
];

const SEARCH_TABS: Array<{
  id: CommunitySearchKind;
  labelId: string;
  labelEn: string;
  icon: typeof Search;
}> = [
  { id: 'all', labelId: 'Semua', labelEn: 'All', icon: Search },
  { id: 'posts', labelId: 'Postingan', labelEn: 'Posts', icon: MessageCircle },
  { id: 'people', labelId: 'Orang', labelEn: 'People', icon: UserCog },
  { id: 'groups', labelId: 'Grup', labelEn: 'Groups', icon: Users },
];

function resolveCommunityMediaSrc(value?: string | null): string {
  const clean = normalizeContentMediaUrl(String(value || '').trim());
  if (!clean) return '';
  if (isCommunityPlaceholderMedia(clean)) return '';
  if (!isPreviewableContentMediaUrl(clean)) return '';
  return clean;
}

function isCommunityPlaceholderMedia(value?: string | null): boolean {
  const clean = String(value || '')
    .trim()
    .toLowerCase();
  if (!clean) return true;
  return (
    clean.startsWith('/images/company/') ||
    clean.includes('/images/company/') ||
    clean.includes('placeholder') ||
    clean.includes('no-image') ||
    clean.includes('image-not-available') ||
    clean.includes('default_image')
  );
}

function firstCommunityMediaUrl(
  ...sources: Array<Array<string | null | undefined> | undefined>
) {
  for (const source of sources) {
    for (const value of source || []) {
      const resolved = resolveCommunityMediaSrc(value);
      if (resolved) return resolved;
    }
  }
  return '';
}

function normalizeCommunityMediaItems(
  items: Array<CommunityFeedMedia | string | null | undefined>,
  fallbackAlt: string,
): CommunityFeedMedia[] {
  const seen = new Set<string>();
  const result: CommunityFeedMedia[] = [];

  items.forEach(item => {
    const raw = typeof item === 'string' ? item : item?.src;
    const src = resolveCommunityMediaSrc(raw);
    if (!src) return;
    const key = src.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push({
      type: isVideoMedia(src)
        ? 'video'
        : typeof item === 'string'
          ? 'image'
          : item?.type || 'image',
      src,
      alt: typeof item === 'string' ? fallbackAlt : item?.alt || fallbackAlt,
      sourceUrl: typeof item === 'string' ? undefined : item?.sourceUrl,
    });
  });

  return result;
}

function getFeedMediaItems(item: CommunityFeedItem): CommunityFeedMedia[] {
  const directItems = normalizeCommunityMediaItems(
    item.mediaItems || [],
    item.title,
  );
  if (directItems.length > 0) return directItems;

  const imageItems = normalizeCommunityMediaItems(
    item.imageUrls || [],
    item.title,
  );
  if (imageItems.length > 0) return imageItems;

  return normalizeCommunityMediaItems([item.media], item.title);
}

function readCommunitySearchKind(value: string | null): CommunitySearchKind {
  const next = (value || '').toLowerCase();
  if (next === 'posts' || next === 'post' || next === 'postingan')
    return 'posts';
  if (next === 'people' || next === 'users' || next === 'orang')
    return 'people';
  if (next === 'reels' || next === 'reel' || next === 'video') return 'posts';
  if (
    next === 'marketplace' ||
    next === 'market' ||
    next === 'produk' ||
    next === 'jasa'
  )
    return 'marketplace';
  if (next === 'groups' || next === 'group' || next === 'grup') return 'groups';
  return 'all';
}

function readCommunityFeedTab(value: string | null): CommunityFeedTab {
  const next = (value || '').toLowerCase();
  if (next === 'community' || next === 'communities' || next === 'komunitas')
    return 'community';
  return 'for-you';
}

function searchCountFor(
  counts: CommunitySearchResponse['counts'] | undefined,
  kind: CommunitySearchKind,
) {
  return counts?.[kind] || 0;
}

function compactNumber(value: number | undefined) {
  const safe = Math.max(Number(value || 0), 0);
  if (safe >= 1_000_000)
    return `${(safe / 1_000_000).toFixed(safe >= 10_000_000 ? 0 : 1)}M`;
  if (safe >= 1_000)
    return `${(safe / 1_000).toFixed(safe >= 10_000 ? 0 : 1)}K`;
  return safe.toString();
}

function communityDiscussionItems(items?: CommunityFeedItem[]) {
  return (items || []).filter(item => item.kind !== 'reel');
}

function pollVoteUrl(threadId: string) {
  return `/api/forum/threads/${encodeURIComponent(threadId)}/poll-vote`;
}

function parseCommunityPoll(
  title: string,
  body: string,
  tags: CommunityFeedTag[] = [],
): ParsedPoll | null {
  const source = String(body || '').replace(/\r\n/g, '\n');
  const hasPollTag = tags.some(tag =>
    /poll|polling|survey|jajak|voting/i.test(`${tag.slug} ${tag.name}`),
  );
  const lines = source.split('\n');
  const markerIndex = lines.findIndex(line =>
    /^\s*(polling|poll|jajak pendapat)\s*:?\s*$/i.test(line),
  );

  if (markerIndex < 0 && !hasPollTag) return null;

  const optionLines =
    markerIndex >= 0 ? lines.slice(markerIndex + 1) : lines.slice(1);
  const options = optionLines
    .map(line =>
      line
        .trim()
        .replace(/^[-*•]\s*/, '')
        .replace(/^\d+[\).]\s*/, '')
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 8)
    .map(option => option.replace(/^(?:[-*]|\u2022)\s*/, '').trim());

  if (options.length < 2) return null;

  const cleanBody =
    markerIndex >= 0
      ? lines.slice(0, markerIndex).join('\n').trim()
      : lines[0]?.trim() || '';

  return {
    question: cleanBody || title,
    body: cleanBody,
    options,
  };
}

function sanitizeCommunitySearchResults(
  payload: Partial<CommunitySearchResponse>,
): CommunitySearchResponse {
  const posts = communityDiscussionItems(payload.posts);
  const people = Array.isArray(payload.people) ? payload.people : [];
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  const counts = payload.counts;
  const reelCount = Math.max(Number(counts?.reels || 0), 0);
  const marketplaceCount = Math.max(Number(counts?.marketplace || 0), 0);
  const allCount =
    counts?.all != null
      ? Math.max(Number(counts.all) - reelCount, 0)
      : posts.length + people.length + groups.length + marketplaceCount;

  return {
    query: String(payload.query || ''),
    kind: readCommunitySearchKind(String(payload.kind || 'all')),
    posts,
    groups,
    people,
    reels: [],
    counts: {
      all: allCount,
      posts: Math.max(Number(counts?.posts ?? posts.length), 0),
      people: Math.max(Number(counts?.people ?? people.length), 0),
      reels: 0,
      marketplace: marketplaceCount,
      groups: Math.max(Number(counts?.groups ?? groups.length), 0),
    },
  };
}

function isVideoMedia(src: string) {
  return /\.(mp4|webm|mov|m4v|ogv|ogg|3gp)([?#].*)?$/i.test(src);
}

function timeAgo(value: string, isId: boolean) {
  const diff = Date.now() - new Date(value).getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (!Number.isFinite(diff) || diff < minute)
    return isId ? 'Baru saja' : 'Just now';
  if (diff < hour) {
    const amount = Math.max(1, Math.floor(diff / minute));
    return isId ? `${amount} menit yang lalu` : `${amount}m ago`;
  }
  if (diff < day) {
    const amount = Math.max(1, Math.floor(diff / hour));
    return isId ? `${amount} jam yang lalu` : `${amount}h ago`;
  }

  const amount = Math.max(1, Math.floor(diff / day));
  return isId ? `${amount} hari yang lalu` : `${amount}d ago`;
}

function groupRoleLabel(
  role: CommunityGroupMember['role'] | CommunityGroup['viewerRole'],
  isId: boolean,
) {
  if (role === 'owner') return isId ? 'Admin' : 'Admin';
  if (role === 'moderator') return isId ? 'Moderator' : 'Moderator';
  return isId ? 'Member' : 'Member';
}

function groupPrivacyLabel(group: CommunityGroup, isId: boolean) {
  if (group.privacy === 'hidden') return isId ? 'Tersembunyi' : 'Hidden';
  if (group.privacy === 'private') return isId ? 'Privat' : 'Private';
  return isId ? 'Publik' : 'Public';
}

function groupJoinLabel(group: CommunityGroup, isId: boolean) {
  if (group.membershipPermission === 'approval')
    return isId ? 'Perlu approval' : 'Approval required';
  if (group.membershipPermission === 'invite')
    return isId ? 'Undangan saja' : 'Invite only';
  return isId ? 'Langsung join' : 'Open join';
}

function groupPostLabel(group: CommunityGroup, isId: boolean) {
  if (group.postingPermission === 'moderator')
    return isId ? 'Hanya admin/moderator' : 'Admins/moderators only';
  if (group.postingPermission === 'member')
    return isId ? 'Member aktif' : 'Active members';
  return isId ? 'Semua orang' : 'Everyone';
}

function composeErrorMessage(error: unknown, isId: boolean) {
  const message = String(error || '').trim();
  if (!message) {
    return isId
      ? 'Coba cek isi postingan lalu kirim lagi.'
      : 'Review the post and try again.';
  }
  if (/ensure forum user/i.test(message)) {
    return isId
      ? 'Akun komunitas kamu sedang disiapkan. Coba kirim ulang sebentar lagi.'
      : 'Your community account is being prepared. Please try again shortly.';
  }
  if (/join this group before posting/i.test(message)) {
    return isId
      ? 'Join grup ini dulu sebelum posting di dalamnya.'
      : 'Join this group before posting there.';
  }
  if (/forbidden|unauthorized/i.test(message)) {
    return isId
      ? 'Kamu belum punya akses untuk aksi ini.'
      : 'You do not have access to do this yet.';
  }
  if (/title and content are required|invalid category/i.test(message)) {
    return isId ? 'Tulis isi postingan dulu.' : 'Write the post content first.';
  }
  return message;
}

function communityGroupHref(
  groupOrSlug: Pick<CommunityGroup, 'slug'> | string,
) {
  const slug = typeof groupOrSlug === 'string' ? groupOrSlug : groupOrSlug.slug;
  return `/community/groups/${encodeURIComponent(slug)}`;
}

function buildLoginHref(pathname: string | null, search: string) {
  const current = `${pathname || '/community'}${search ? `?${search}` : ''}`;
  return `/login?callbackUrl=${encodeURIComponent(current)}`;
}

export function readCommunityAvatar(user: ReturnType<typeof useAuth>['user']) {
  return profileAvatarSrc(
    user?.avatarUrl || user?.avatar_url || user?.metadata?.avatar_url,
    readProfileAvatarStyle(user),
    user?.fullName || user?.full_name || user?.username || user?.email,
  );
}

function createdThreadToFeedItem(
  payload: CreatedThreadPayload,
  overview: CommunityFeedOverview | null,
  selectedGroupId: string,
  fallbackAuthor: CommunityFeedItem['author'],
): CommunityFeedItem | null {
  const thread = payload.thread;
  const post = payload.post;
  if (!thread?.id) return null;

  const category = thread.category || null;
  const group =
    overview?.groups?.find(item => item.id === selectedGroupId) ||
    overview?.groups?.find(item => item.categoryId === category?.id) ||
    null;
  const mediaSrc = firstCommunityMediaUrl(thread.imageUrls, post?.imageUrls);
  const mediaItems = normalizeCommunityMediaItems(
    [...(thread.imageUrls || []), ...(post?.imageUrls || [])],
    thread.title,
  );

  return {
    id: `discussion-${thread.id}`,
    kind: 'discussion',
    threadId: thread.id,
    postId: post?.id,
    href: `/community?thread=${encodeURIComponent(thread.id)}`,
    title: thread.title,
    body: post?.content || thread.title,
    communityName: group?.name || category?.name || 'Komunitas Lajukan',
    createdAt: thread.createdAt || post?.createdAt || new Date().toISOString(),
    author: thread.author || fallbackAuthor,
    category,
    group,
    tags: thread.tags || [],
    media: mediaSrc
      ? {
          type: isVideoMedia(mediaSrc) ? 'video' : 'image',
          src: mediaSrc,
          alt: thread.title,
        }
      : null,
    mediaItems,
    imageUrls: mediaItems.map(item => item.src),
    stats: {
      reactions: Math.max(thread.voteScore || thread.likeCount || 0, 0),
      comments: thread.replyCount || 0,
      shares: thread.bookmarkCount || 0,
      views: thread.views || 0,
    },
    viewerVote: thread.viewerVote || 0,
    isPinned: Boolean(thread.isPinned),
    isSolved: Boolean(thread.isSolved),
  };
}

export function CommunityFeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4"
        >
          <div className="flex gap-3">
            <div className="ui-skeleton ui-skeleton-pulse h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="ui-skeleton ui-skeleton-pulse h-3 w-1/2 rounded-full" />
              <div className="ui-skeleton ui-skeleton-pulse h-3 w-1/3 rounded-full" />
              <div className="ui-skeleton ui-skeleton-pulse h-32 rounded-[18px]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommunityImageFrame({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveCommunityMediaSrc(src);

  if (!resolvedSrc || failed) {
    return (
      <div
        className={cn(
          'grid place-items-center bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_48%,#eff6ff_100%)] text-center',
          className,
        )}
      >
        <div className="px-6">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-[color:var(--app-accent)] shadow-[0_16px_32px_-28px_rgba(15,23,42,0.2)]">
            <ImageIcon className="h-5 w-5" />
          </span>
          <p className="mt-3 line-clamp-2 text-sm font-black text-[color:var(--app-text)]">
            {alt}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <Image
        src={resolvedSrc}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, 720px"
        className="object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function CommunityVideoFrame({
  src,
  alt,
  isId,
  variant = 'feed',
  className,
}: {
  src?: string | null;
  alt: string;
  isId: boolean;
  variant?: 'feed' | 'tile' | 'thumb';
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveCommunityMediaSrc(src);
  const isFeed = variant === 'feed';
  const isThumb = variant === 'thumb';

  if (!resolvedSrc || failed) {
    return (
      <div
        className={cn(
          'grid place-items-center bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_48%,#eef2ff_100%)] text-center',
          isFeed ? 'min-h-[220px]' : 'h-full w-full',
          className,
        )}
      >
        <div className="px-5">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-[color:var(--app-accent)] shadow-sm ring-1 ring-emerald-100">
            <PlayCircle className="h-5 w-5" />
          </span>
          <p className="mt-2 line-clamp-2 text-xs font-black text-[color:var(--app-text)]">
            {isId
              ? 'Preview video belum tersedia'
              : 'Video preview unavailable'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-slate-950',
        isFeed
          ? 'border-y border-slate-900/5 px-2 py-2 sm:px-4'
          : 'h-full w-full rounded-[18px]',
        className,
      )}
    >
      {isFeed ? (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(16,185,129,0.24),transparent_34%),radial-gradient(circle_at_76%_78%,rgba(59,130,246,0.22),transparent_32%),linear-gradient(135deg,#020617,#08111f)]"
          aria-hidden="true"
        />
      ) : null}
      <div
        className={cn(
          'relative z-10 overflow-hidden bg-black shadow-[0_18px_44px_-30px_rgba(2,6,23,0.8)]',
          isFeed
            ? 'mx-auto aspect-[4/5] max-h-[540px] w-full max-w-[430px] rounded-[22px] sm:aspect-[9/16]'
            : 'h-full w-full',
        )}
      >
        <video
          src={resolvedSrc}
          className={cn(
            'h-full w-full bg-black',
            isFeed ? 'object-cover object-left' : 'object-contain',
          )}
          controls={!isThumb}
          muted={isThumb}
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
        />
        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/62 px-2.5 py-1 text-[11px] font-black text-white backdrop-blur-md">
          <PlayCircle className="h-3.5 w-3.5" />
          {isThumb ? 'Video' : isId ? 'Putar video' : 'Play video'}
        </span>
      </div>
    </div>
  );
}

function CommunityMediaTile({
  item,
  title,
  isId,
  index,
  total,
  extraCount,
  onOpen,
  className,
  imageFit = 'cover',
}: {
  item: CommunityFeedMedia;
  title: string;
  isId: boolean;
  index: number;
  total: number;
  extraCount?: number;
  onOpen: () => void;
  className?: string;
  imageFit?: 'cover' | 'contain';
}) {
  const isVideo = item.type === 'video' || isVideoMedia(item.src);
  const label =
    total > 1
      ? isId
        ? `Buka media ${index + 1} dari ${total}`
        : `Open media ${index + 1} of ${total}`
      : isId
        ? 'Buka preview media'
        : 'Open media preview';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group/media relative block h-full min-h-0 w-full overflow-hidden bg-slate-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] dark:bg-slate-950',
        className,
      )}
      aria-label={label}
    >
      {isVideo ? (
        <>
          <video
            src={item.src}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full bg-slate-950 object-cover"
          />
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/62 px-2 py-1 text-[10px] font-black text-white backdrop-blur-md">
            <PlayCircle className="h-3.5 w-3.5" />
            Video
          </span>
        </>
      ) : (
        <Image
          src={item.src}
          alt={item.alt || title}
          fill
          sizes="(max-width: 640px) 100vw, 720px"
          className={cn(
            'transition duration-500 group-hover/media:scale-[1.025]',
            imageFit === 'contain' ? 'object-contain' : 'object-cover',
          )}
        />
      )}

      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/24 via-transparent to-transparent opacity-80" />
      <span className="pointer-events-none absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/44 text-white opacity-0 backdrop-blur transition group-hover/media:opacity-100">
        <Expand className="h-4 w-4" />
      </span>

      {extraCount && extraCount > 0 ? (
        <span className="absolute inset-0 grid place-items-center bg-black/54 text-xl font-black text-white backdrop-blur-[1px] sm:text-2xl">
          +{extraCount}
        </span>
      ) : null}
    </button>
  );
}

function CommunityMediaGalleryPreview({
  mediaItems,
  title,
  isId,
  variant = 'feed',
}: {
  mediaItems: Array<CommunityFeedMedia | string | null | undefined>;
  title: string;
  isId: boolean;
  variant?: 'feed' | 'detail';
}) {
  const items = useMemo(
    () => normalizeCommunityMediaItems(mediaItems, title),
    [mediaItems, title],
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  const isDetail = variant === 'detail';
  const visibleItems = items.slice(0, 3);
  const extraCount = Math.max(0, items.length - visibleItems.length);
  const shellClass = cn(
    'relative overflow-hidden bg-slate-100 dark:bg-slate-950',
    isDetail
      ? 'rounded-[22px] ring-1 ring-slate-900/5'
      : 'border-y border-slate-900/5',
  );
  const frameClass =
    items.length === 1
      ? cn(
          'relative w-full',
          isDetail
            ? 'aspect-[4/3] sm:aspect-[16/10] lg:aspect-[16/9]'
            : 'aspect-[4/3] sm:aspect-[16/9]',
        )
      : cn(
          'grid w-full gap-1 bg-slate-200 p-1 dark:bg-slate-900',
          'aspect-[4/3] sm:aspect-[16/9]',
          items.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2',
        );

  return (
    <>
      <div className={shellClass}>
        <div className={frameClass}>
          {visibleItems.map((item, index) => (
            <CommunityMediaTile
              key={`${item.src}-${index}`}
              item={item}
              title={title}
              isId={isId}
              index={index}
              total={items.length}
              extraCount={
                index === visibleItems.length - 1 ? extraCount : undefined
              }
              onOpen={() => setLightboxIndex(index)}
              className={cn(
                items.length === 1 && 'absolute inset-0',
                items.length >= 3 && index === 0 && 'row-span-2',
                items.length >= 3 && index > 0 && 'min-h-0',
                items.length > 1 && 'rounded-[14px]',
              )}
              imageFit={isDetail && items.length === 1 ? 'contain' : 'cover'}
            />
          ))}
        </div>

        {items.length > 1 ? (
          <span className="absolute left-3 top-3 rounded-full bg-black/62 px-2.5 py-1 text-[11px] font-black text-white shadow-sm backdrop-blur-md">
            {items.length} {isId ? 'media' : 'media'}
          </span>
        ) : null}
      </div>

      {lightboxIndex != null ? (
        <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/95 p-3 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-4 top-4 z-[10060] inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label={isId ? 'Tutup preview' : 'Close preview'}
          >
            <X className="h-6 w-6" />
          </button>

          <div className="h-[86svh] w-full max-w-6xl">
            <MediaPreviewCarousel
              items={items}
              alt={title}
              aspectClassName="h-full w-full"
              className="rounded-[24px] bg-black"
              viewportClassName="rounded-[24px]"
              sizes="100vw"
              controls
              lightbox={false}
              showCounter
              showDots
              objectFit="contain"
              initialIndex={lightboxIndex}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function CommunityMediaPreview({
  media,
  mediaItems,
  title,
  isId,
}: {
  media?: CommunityFeedMedia | null;
  mediaItems?: CommunityFeedMedia[];
  title: string;
  isId: boolean;
}) {
  const galleryItems =
    mediaItems && mediaItems.length > 0 ? mediaItems : [media];
  if (galleryItems.filter(Boolean).length > 1) {
    return (
      <CommunityMediaGalleryPreview
        mediaItems={galleryItems}
        title={title}
        isId={isId}
      />
    );
  }

  if (!media) return null;

  if (media.type === 'video') {
    return (
      <CommunityVideoFrame
        src={media.src}
        alt={media.alt || title}
        isId={isId}
        variant="feed"
      />
    );
  }

  return (
    <CommunityMediaGalleryPreview
      mediaItems={galleryItems}
      title={title}
      isId={isId}
    />
  );
}

function CommunityPoll({
  threadId,
  poll,
  isId,
  loginHref,
}: {
  threadId: string;
  poll: ParsedPoll;
  isId: boolean;
  loginHref: string;
}) {
  const { isAuthenticated, authFetch } = useAuth();
  const router = useRouter();
  const { notify } = useToast();
  const [stats, setStats] = useState<PollVoteResponse | null>(null);
  const [votingIndex, setVotingIndex] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    fetch(pollVoteUrl(threadId), {
      cache: 'no-store',
      credentials: 'include',
    })
      .then(response => response.json())
      .then((payload: PollVoteResponse) => {
        if (!alive || payload?.error) return;
        setStats(payload);
      })
      .catch(() => {
        if (alive) setStats(null);
      });

    return () => {
      alive = false;
    };
  }, [threadId, poll.options.length]);

  const voteMap = useMemo(() => {
    return new Map(
      (stats?.options || []).map(option => [option.optionIndex, option]),
    );
  }, [stats?.options]);
  const selectedIndex =
    typeof stats?.viewerOptionIndex === 'number'
      ? stats.viewerOptionIndex
      : null;
  const totalVotes = Math.max(Number(stats?.totalVotes || 0), 0);
  const pollHint = isAuthenticated
    ? selectedIndex == null
      ? isId
        ? 'Pilih satu jawaban. Kamu bisa ubah pilihan nanti.'
        : 'Pick one answer. You can change it later.'
      : isId
        ? 'Pilihan kamu sudah tersimpan.'
        : 'Your vote has been saved.'
    : isId
      ? 'Login untuk ikut vote. Hasil tetap bisa kamu lihat.'
      : 'Sign in to vote. You can still see the results.';

  const handleVote = async (optionIndex: number) => {
    if (!isAuthenticated) {
      notify({
        title: isId ? 'Login dulu untuk vote' : 'Sign in to vote',
        description: isId
          ? 'Biar satu akun cuma punya satu suara di polling ini.'
          : 'This keeps every poll limited to one vote per account.',
        variant: 'error',
      });
      router.push(loginHref);
      return;
    }

    setVotingIndex(optionIndex);
    const response = await authFetch(pollVoteUrl(threadId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionIndex, optionCount: poll.options.length }),
    });
    const payload = (await response
      .json()
      .catch(() => ({}))) as PollVoteResponse;
    setVotingIndex(null);

    if (!response.ok) {
      notify({
        title: isId ? 'Vote belum tersimpan' : 'Vote was not saved',
        description: payload.error || '',
        variant: 'error',
      });
      return;
    }

    setStats(payload);
    notify({
      title: isId ? 'Vote tersimpan' : 'Vote saved',
      variant: 'success',
    });
  };

  return (
    <section className="mt-3 rounded-[22px] border border-emerald-100 bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_58%,#eff6ff_100%)] p-3 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--app-accent)] ring-1 ring-emerald-100">
            <BarChart3 className="h-3.5 w-3.5" />
            {isId ? 'Polling' : 'Poll'}
          </p>
          <h3 className="mt-2 line-clamp-2 text-sm font-black leading-5 text-[color:var(--app-text)]">
            {poll.question}
          </h3>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-[color:var(--app-text-soft)]">
            {pollHint}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-[color:var(--app-text-soft)] ring-1 ring-[color:var(--app-border)]">
          {totalVotes > 0
            ? `${compactNumber(totalVotes)} ${isId ? 'suara' : 'votes'}`
            : isId
              ? 'Belum ada suara'
              : 'No votes yet'}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {poll.options.map((option, index) => {
          const stat = voteMap.get(index);
          const votes = Math.max(Number(stat?.votes || 0), 0);
          const percent = totalVotes
            ? Math.round((votes / totalVotes) * 100)
            : 0;
          const selected = selectedIndex === index;
          const voting = votingIndex === index;
          const actionLabel = !isAuthenticated
            ? isId
              ? 'Login'
              : 'Sign in'
            : totalVotes === 0
              ? isId
                ? 'Pilih'
                : 'Vote'
              : `${percent}%`;

          return (
            <button
              key={`${option}-${index}`}
              type="button"
              onClick={() => void handleVote(index)}
              disabled={votingIndex !== null}
              className={cn(
                'group relative w-full overflow-hidden rounded-[16px] border bg-white p-3 text-left transition hover:border-[color:var(--app-accent-border)] disabled:cursor-wait',
                selected
                  ? 'border-[color:var(--app-accent)] shadow-[0_14px_26px_-24px_rgba(4,120,87,0.72)]'
                  : 'border-[color:var(--app-border)]',
              )}
            >
              <span
                className={cn(
                  'absolute inset-y-0 left-0 bg-emerald-100/75 transition-all',
                  selected && 'bg-emerald-200/80',
                )}
                style={{ width: `${percent}%` }}
                aria-hidden="true"
              />
              <span className="relative flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm font-black leading-5 text-[color:var(--app-text)]">
                    {option}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                    {votes > 0
                      ? `${compactNumber(votes)} ${isId ? 'orang memilih' : 'people voted'}`
                      : isId
                        ? 'Belum dipilih'
                        : 'No votes yet'}
                  </span>
                </span>
                <span
                  className={cn(
                    'inline-flex h-9 min-w-12 shrink-0 items-center justify-center rounded-full px-2 text-xs font-black',
                    selected
                      ? 'bg-[color:var(--app-accent)] text-white'
                      : 'bg-slate-50 text-[color:var(--app-text-soft)]',
                  )}
                >
                  {voting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : selected ? (
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4" />
                      {totalVotes > 0 ? `${percent}%` : ''}
                    </span>
                  ) : (
                    actionLabel
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold leading-5 text-[color:var(--app-text-soft)]">
        <span>
          {isAuthenticated
            ? isId
              ? 'Satu akun hanya dihitung satu suara.'
              : 'One account counts as one vote.'
            : isId
              ? 'Vote butuh akun agar tidak dobel.'
              : 'Voting requires an account to avoid duplicates.'}
        </span>
        {!isAuthenticated ? (
          <button
            type="button"
            onClick={() => router.push(loginHref)}
            className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[color:var(--app-accent)] ring-1 ring-emerald-100"
          >
            {isId ? 'Masuk untuk vote' : 'Sign in to vote'}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function CommunityComposer({
  isId,
  userAvatar,
  isAuthenticated,
  overview,
  lockedGroup,
  onCreated,
}: {
  isId: boolean;
  userAvatar: string;
  isAuthenticated: boolean;
  overview: CommunityFeedOverview | null;
  lockedGroup?: CommunityGroup | null;
  onCreated: (item?: CommunityFeedItem) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { authFetch, user } = useAuth();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ComposeMode>('post');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [feeling, setFeeling] = useState(isId ? 'Optimis' : 'Optimistic');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingMedia, setDraggingMedia] = useState(false);
  const loginHref = buildLoginHref(pathname, searchParams.toString());
  const fallbackAuthor: CommunityFeedItem['author'] = {
    id: user?.id || user?.sub || 'viewer',
    name:
      user?.fullName ||
      user?.full_name ||
      user?.username ||
      user?.email ||
      (isId ? 'Saya' : 'Me'),
    title: isId ? 'Anggota komunitas' : 'Community member',
    avatarUrl: userAvatar,
    reputation: 0,
  };

  useEffect(() => {
    const requestedMode = searchParams.get('compose');
    if (!requestedMode) return;
    if (requestedMode === 'reel' || requestedMode === 'video') {
      router.replace('/reels?upload=1');
      return;
    }
    if (!['post', 'photo', 'poll', 'feeling'].includes(requestedMode)) return;
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      setMode(requestedMode as ComposeMode);
      setOpen(true);
    });
    return () => {
      alive = false;
    };
  }, [router, searchParams]);

  const openComposer = (nextMode: ComposeMode) => {
    setMode(nextMode);
    setOpen(true);
  };

  const closeComposer = () => {
    setOpen(false);
    if (!searchParams.has('compose')) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete('compose');
    const queryString = params.toString();
    const currentPath = (pathname || '/community').replace(
      /^\/(id|en)(?=\/|$)/,
      '',
    );
    router.replace(queryString ? `${currentPath}?${queryString}` : currentPath);
  };
  const defaultFeedCategory =
    overview?.categories?.find(item => item.slug === 'fyp') ||
    overview?.categories?.find(
      item =>
        !(overview?.groups || []).some(group => group.categoryId === item.id),
    ) ||
    overview?.categories?.[0] ||
    null;
  const selectedGroupId = lockedGroup?.id || '';
  const selectedCategorySlug =
    lockedGroup?.categoryId || defaultFeedCategory?.slug || 'fyp';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated) {
      router.push(loginHref);
      return;
    }

    const cleanPollOptions = pollOptions
      .map(option => option.trim())
      .filter(Boolean)
      .slice(0, 6);
    const cleanBody = body.trim();
    const content =
      mode === 'poll' && cleanPollOptions.length >= 2
        ? `${cleanBody}\n\nPolling:\n${cleanPollOptions.map(option => `- ${option}`).join('\n')}`
        : mode === 'feeling'
          ? `${isId ? 'Perasaan' : 'Feeling'}: ${feeling}\n\n${cleanBody}`
          : cleanBody;
    const cleanTitle =
      title.trim() ||
      cleanBody.split(/\s+/).slice(0, 12).join(' ').slice(0, 110) ||
      (isId ? 'Diskusi komunitas baru' : 'New community discussion');

    if (!cleanBody) return;
    if (lockedGroup && !lockedGroup.viewerCanPost) {
      notify({
        title: isId ? 'Belum bisa posting' : 'Cannot post yet',
        description:
          lockedGroup.viewerMembershipStatus === 'pending'
            ? isId
              ? 'Permintaan join kamu masih menunggu approval.'
              : 'Your join request is still waiting for approval.'
            : isId
              ? 'Join grup ini dulu sebelum posting.'
              : 'Join this group before posting.',
        variant: 'error',
      });
      return;
    }

    setSaving(true);
    const selectedTags = [
      mode === 'poll'
        ? overview?.trendingTags?.find(tag =>
            /poll|survey|event|support/i.test(`${tag.slug} ${tag.name}`),
          )?.slug || 'polling'
        : mode === 'feeling'
          ? overview?.trendingTags?.find(tag =>
              /growth|support|community/i.test(`${tag.slug} ${tag.name}`),
            )?.slug || 'perasaan'
          : mode === 'photo'
            ? overview?.trendingTags?.find(tag =>
                /market|produk|supply/i.test(`${tag.slug} ${tag.name}`),
              )?.slug
            : overview?.trendingTags?.[0]?.slug,
    ].filter((item): item is string => Boolean(item));

    const response = await authFetch('/api/forum/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: cleanTitle,
        content,
        group: selectedGroupId || undefined,
        category: selectedCategorySlug,
        tags: selectedTags,
        mediaUrls,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      notify({
        title: isId ? 'Posting gagal' : 'Post failed',
        description: composeErrorMessage(payload.error, isId),
        variant: 'error',
      });
      return;
    }

    notify({
      title: isId ? 'Posting terkirim' : 'Post published',
      variant: 'success',
    });
    setTitle('');
    setBody('');
    setMediaUrls([]);
    setPollOptions(['', '']);
    closeComposer();
    const createdItem = createdThreadToFeedItem(
      payload as CreatedThreadPayload,
      overview,
      selectedGroupId,
      fallbackAuthor,
    );
    onCreated(createdItem || undefined);
  };

  const handleMediaUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!isAuthenticated) {
      router.push(loginHref);
      return;
    }

    const formData = new FormData();
    Array.from(files)
      .slice(0, 6)
      .forEach(file => formData.append('media', file));

    setUploading(true);
    const response = await authFetch('/api/forum/upload-media', {
      method: 'POST',
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    setUploading(false);

    if (!response.ok || !Array.isArray(payload.urls)) {
      notify({
        title: isId ? 'Upload media gagal' : 'Media upload failed',
        description: payload.error || '',
        variant: 'error',
      });
      return;
    }

    const uploadedUrls = payload.urls
      .map((url: unknown) =>
        typeof url === 'string' ? resolveCommunityMediaSrc(url) : '',
      )
      .filter(Boolean);
    setMediaUrls(current => [...current, ...uploadedUrls].slice(0, 6));
  };

  const handleMediaDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDraggingMedia(false);
    void handleMediaUpload(event.dataTransfer.files);
  };

  const actions = [
    {
      id: 'post' as const,
      href: '#composer',
      label: isId ? 'Posting' : 'Post',
      icon: MessageCircle,
      tone: 'text-sky-700 bg-sky-50',
    },
    {
      id: 'photo' as const,
      href: '#composer',
      label: isId ? 'Foto' : 'Photo',
      icon: ImageIcon,
      tone: 'text-emerald-700 bg-emerald-50',
    },
    {
      id: 'poll' as const,
      href: '#composer',
      label: isId ? 'Polling' : 'Poll',
      icon: BarChart3,
      tone: 'text-amber-700 bg-amber-50',
    },
    {
      id: 'feeling' as const,
      href: '#composer',
      label: isId ? 'Perasaan' : 'Feeling',
      icon: Sparkles,
      tone: 'text-teal-700 bg-teal-50',
    },
  ];

  return (
    <section
      id="composer"
      className="rounded-[22px] border border-[color:var(--app-border)] bg-white p-3 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)] sm:p-3.5"
    >
      <div className="flex items-center gap-2.5">
        <Image
          alt="Profile"
          width={36}
          height={36}
          className="h-9 w-9 rounded-full object-cover"
          src={userAvatar}
        />
        <button
          type="button"
          onClick={() => openComposer('post')}
          className="flex min-h-11 flex-1 items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-left text-xs font-semibold text-[color:var(--app-text-soft)]"
        >
          {isId
            ? 'Tanya atau bagikan update usaha...'
            : 'Ask or share a business update...'}
        </button>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {actions.map(action => {
          const Icon = action.icon;

          return (
            <button
              key={action.id}
              type="button"
              onClick={() => openComposer(action.id)}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[13px] border border-[color:var(--app-border)] bg-white px-2.5 text-xs font-semibold text-[color:var(--app-text-soft)]"
            >
              <Icon
                className={cn('h-4.5 w-4.5 rounded-md p-0.5', action.tone)}
              />
              {action.label}
            </button>
          );
        })}
      </div>

      {open ? (
        <div
          className={COMMUNITY_MODAL_SHELL_CLASS}
          role="dialog"
          aria-modal="true"
          data-testid="community-compose-modal"
        >
          <form
            onSubmit={handleSubmit}
            className={cn(
              COMMUNITY_MODAL_SURFACE_CLASS,
              'bg-[color:var(--app-surface-strong)] sm:max-w-xl',
            )}
            data-testid="community-compose-surface"
          >
            <header className="flex min-h-[54px] items-center justify-between border-b border-[color:var(--app-border)] px-4">
              <h2 className="text-sm font-black text-[color:var(--app-text)]">
                {isId ? 'Buat posting' : 'Create community post'}
              </h2>
              <button
                type="button"
                onClick={closeComposer}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)]"
                aria-label={isId ? 'Tutup composer' : 'Close composer'}
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              <label
                onDragOver={event => {
                  event.preventDefault();
                  setDraggingMedia(true);
                }}
                onDragLeave={() => setDraggingMedia(false)}
                onDrop={handleMediaDrop}
                className={cn(
                  'group relative block cursor-pointer overflow-hidden rounded-[20px] border-2 border-dashed p-4 text-center transition',
                  draggingMedia
                    ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)]'
                    : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] hover:border-[color:var(--app-accent-border)] hover:bg-white',
                )}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  multiple
                  className="sr-only"
                  onChange={event => {
                    void handleMediaUpload(event.target.files);
                    event.currentTarget.value = '';
                  }}
                />
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-[16px] bg-white text-[color:var(--app-accent)] shadow-sm ring-1 ring-[color:var(--app-border)]">
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                </span>
                <span className="mt-3 block text-sm font-black text-[color:var(--app-text)]">
                  {isId
                    ? 'Tarik foto/video ke sini atau pilih file'
                    : 'Drop photos/videos here or choose files'}
                </span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Media ada di atas dulu, baru isi judul dan cerita di bawah.'
                    : 'Add media first, then fill in the discussion below.'}
                </span>
                {mediaUrls.length > 0 ? (
                  <span className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {mediaUrls.map(url => {
                      const resolvedUrl = resolveCommunityMediaSrc(url);

                      return (
                        <span
                          key={url}
                          className="relative aspect-square overflow-hidden rounded-[14px] bg-white ring-1 ring-[color:var(--app-border)]"
                        >
                          {isVideoMedia(url) && resolvedUrl ? (
                            <CommunityVideoFrame
                              src={resolvedUrl}
                              alt="Video"
                              isId={isId}
                              variant="thumb"
                              className="h-full w-full"
                            />
                          ) : (
                            <CommunityImageFrame
                              src={url}
                              alt="Media"
                              className="h-full w-full"
                            />
                          )}
                          <button
                            type="button"
                            onClick={event => {
                              event.preventDefault();
                              setMediaUrls(current =>
                                current.filter(item => item !== url),
                              );
                            }}
                            className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/62 text-white backdrop-blur"
                            aria-label={isId ? 'Hapus media' : 'Remove media'}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      );
                    })}
                  </span>
                ) : null}
              </label>

              <div
                className={cn(
                  'grid gap-2',
                  lockedGroup && 'sm:grid-cols-[minmax(0,1fr)_190px]',
                )}
              >
                <input
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  placeholder={
                    isId ? 'Judul singkat diskusi' : 'Short discussion title'
                  }
                  className="min-h-11 rounded-[13px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-sm text-[color:var(--app-text)] outline-none focus:border-[color:var(--app-accent-border)]"
                />
                {lockedGroup ? (
                  <div className="flex min-h-11 items-center rounded-[13px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-sm font-bold text-[color:var(--app-text)]">
                    <span className="truncate">{lockedGroup.name}</span>
                  </div>
                ) : null}
              </div>
              {mode === 'feeling' ? (
                <select
                  value={feeling}
                  onChange={event => setFeeling(event.target.value)}
                  className="min-h-11 w-full rounded-[13px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-sm text-[color:var(--app-text)] outline-none focus:border-[color:var(--app-accent-border)]"
                >
                  {[
                    'Optimis',
                    'Butuh saran',
                    'Senang',
                    'Khawatir',
                    'Bangga',
                    'Lelah tapi jalan',
                  ].map(item => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              ) : null}
              <textarea
                value={body}
                onChange={event => setBody(event.target.value)}
                rows={3}
                placeholder={
                  mode === 'poll'
                    ? isId
                      ? 'Tulis pertanyaan polling dan opsi singkatnya...'
                      : 'Write your poll question and options...'
                    : isId
                      ? 'Tulis pertanyaan, info, atau peluang singkat...'
                      : 'Write a short question, update, or opportunity...'
                }
                className="w-full resize-none rounded-[15px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-sm leading-6 text-[color:var(--app-text)] outline-none focus:border-[color:var(--app-accent-border)]"
              />
              {mode === 'poll' ? (
                <div className="space-y-2 rounded-[15px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2">
                  {pollOptions.map((option, index) => (
                    <input
                      key={index}
                      value={option}
                      onChange={event =>
                        setPollOptions(current =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                      placeholder={
                        isId
                          ? `Opsi polling ${index + 1}`
                          : `Poll option ${index + 1}`
                      }
                      className="min-h-10 w-full rounded-[12px] border border-[color:var(--app-border)] bg-white px-3 text-xs outline-none focus:border-[color:var(--app-accent-border)]"
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setPollOptions(current =>
                        current.length >= 6 ? current : [...current, ''],
                      )
                    }
                    className="inline-flex min-h-[32px] items-center gap-2 rounded-full bg-white px-3 text-xs font-semibold text-[color:var(--app-accent)]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {isId ? 'Tambah opsi' : 'Add option'}
                  </button>
                </div>
              ) : null}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !body.trim()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[13px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isId ? 'Posting' : 'Post'}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

export function CommunityPostCard({
  item,
  isId,
  onOpenDetail,
}: {
  item: CommunityFeedItem;
  isId: boolean;
  onOpenDetail: (threadId: string) => void;
}) {
  const { isAuthenticated, authFetch } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { notify } = useToast();
  const [localVote, setLocalVote] = useState(item.viewerVote || 0);
  const [reactionCount, setReactionCount] = useState(item.stats.reactions);
  const loginHref = buildLoginHref(pathname, searchParams.toString());
  const poll = useMemo(
    () => parseCommunityPoll(item.title, item.body, item.tags),
    [item.body, item.tags, item.title],
  );
  const displayBody = poll ? poll.body : item.body;
  const feedMediaItems = getFeedMediaItems(item);
  const safeMedia = feedMediaItems[0] || null;

  const handleLike = async () => {
    if (item.kind !== 'discussion' || !item.threadId) return;
    if (!isAuthenticated) {
      router.push(loginHref);
      return;
    }

    const wasLiked = localVote === 1;
    setLocalVote(wasLiked ? 0 : 1);
    setReactionCount(current => Math.max(0, current + (wasLiked ? -1 : 1)));

    const response = await authFetch(
      `/api/forum/threads/${encodeURIComponent(item.threadId)}/vote`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 1 }),
      },
    );

    if (!response.ok) {
      setLocalVote(wasLiked ? 1 : 0);
      setReactionCount(current => Math.max(0, current + (wasLiked ? 1 : -1)));
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${item.href}`;
    try {
      await navigator.clipboard.writeText(url);
      notify({
        title: isId ? 'Link disalin' : 'Link copied',
        variant: 'success',
      });
    } catch {
      window.location.href = item.href;
    }
  };

  const openDetail = () => {
    if (item.kind === 'discussion' && item.threadId) {
      onOpenDetail(item.threadId);
    } else {
      router.push(item.href);
    }
  };

  return (
    <article className="overflow-hidden rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_82%,transparent)] bg-white shadow-[0_18px_36px_-32px_rgba(15,23,42,0.18)]">
      <div className="p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              alt={item.author.name}
              width={44}
              height={44}
              className="h-10 w-10 rounded-full object-cover"
              src={profileAvatarSrc(
                item.author.avatarUrl,
                readProfileAvatarStyle(item.author),
                item.author.name,
              )}
            />
            <div className="min-w-0">
              <button
                type="button"
                onClick={openDetail}
                className="block truncate text-left text-[0.95rem] font-bold leading-[1.08] tracking-[-0.02em] text-[color:var(--app-text)]"
              >
                {item.group?.name || item.communityName}
              </button>
              <p className="mt-[2px] flex items-center gap-1 text-xs leading-none text-[color:var(--app-text-soft)]">
                {item.author.name} · {timeAgo(item.createdAt, isId)}
                <Earth className="h-3.5 w-3.5" />
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={openDetail}
          className="block w-full text-left"
        >
          <h2 className="mt-3 line-clamp-2 text-[0.98rem] font-bold leading-5 text-[color:var(--app-text)]">
            {item.title}
          </h2>
          {displayBody ? (
            <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-[color:var(--app-text)]">
              {displayBody}
            </p>
          ) : null}
        </button>
        {item.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {item.tags.slice(0, 3).map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={openDetail}
                className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--app-text-soft)] ring-1 ring-[color:var(--app-border)] transition hover:bg-emerald-50 hover:text-[color:var(--app-accent)]"
              >
                #{tag.slug || tag.name}
              </button>
            ))}
            {item.tags.length > 3 ? (
              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[color:var(--app-text-muted)] ring-1 ring-[color:var(--app-border)]">
                +{item.tags.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}
        {poll && item.threadId ? (
          <CommunityPoll
            threadId={item.threadId}
            poll={poll}
            isId={isId}
            loginHref={loginHref}
          />
        ) : null}
      </div>

      {feedMediaItems.length > 0 ? (
        <CommunityMediaPreview
          media={safeMedia}
          mediaItems={feedMediaItems}
          title={item.title}
          isId={isId}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--app-border)] px-4 py-2.5 text-xs text-[color:var(--app-text-soft)]">
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-white">
            <ThumbsUp className="h-3.5 w-3.5" />
          </span>
          {compactNumber(reactionCount)}
        </span>
        <span>
          {compactNumber(item.stats.comments)} {isId ? 'komentar' : 'comments'}
        </span>
      </div>

      <div className="grid grid-cols-3 border-t border-[color:var(--app-border)] px-2 py-1.5 text-xs font-semibold text-[color:var(--app-text-soft)]">
        <button
          type="button"
          onClick={handleLike}
          className={cn(
            'inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[12px] hover:bg-slate-50',
            localVote === 1 && 'text-[color:var(--app-accent)]',
          )}
        >
          <ThumbsUp className="h-4 w-4" />
          {isId ? 'Suka' : 'Like'}
        </button>
        <button
          type="button"
          onClick={openDetail}
          className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[12px] hover:bg-slate-50"
        >
          <MessageCircle className="h-4 w-4" />
          {isId ? 'Komentar' : 'Comment'}
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[12px] hover:bg-slate-50"
        >
          <Share2 className="h-4 w-4" />
          {isId ? 'Bagikan' : 'Share'}
        </button>
      </div>
    </article>
  );
}

export function CommunityDetailModal({
  isId,
  threadId,
  onClose,
  onChanged,
}: {
  isId: boolean;
  threadId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { isAuthenticated, authFetch } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { notify } = useToast();
  const [thread, setThread] = useState<ForumThreadDetail | null>(null);
  const [posts, setPosts] = useState<ForumPostDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [replyTarget, setReplyTarget] = useState<ForumPostDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const loginHref = buildLoginHref(pathname, searchParams.toString());

  useEffect(() => {
    if (!threadId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, threadId]);

  useEffect(() => {
    if (!threadId) return;
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      setLoading(true);
      setComment('');
      setReplyTarget(null);
    });

    Promise.all([
      fetch(`/api/forum/threads/${encodeURIComponent(threadId)}`, {
        cache: 'no-store',
        credentials: 'include',
      }).then(response => response.json()),
      fetch(
        `/api/forum/threads/${encodeURIComponent(threadId)}/posts?page_size=80`,
        {
          cache: 'no-store',
          credentials: 'include',
        },
      ).then(response => response.json()),
    ])
      .then(
        ([threadPayload, postsPayload]: [
          ForumThreadDetail,
          ForumPostsResponse,
        ]) => {
          if (!alive) return;
          setThread(threadPayload?.id ? threadPayload : null);
          setPosts(postsPayload.data || []);
        },
      )
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [threadId]);

  if (!threadId) return null;

  const rootPost = posts.find(post => !post.replyToPostId) || posts[0] || null;
  const comments = posts.filter(post => post.id !== rootPost?.id);
  const repliesByParent = comments.reduce<Record<string, ForumPostDetail[]>>(
    (acc, post) => {
      if (post.replyToPostId && post.replyToPostId !== rootPost?.id) {
        acc[post.replyToPostId] = [...(acc[post.replyToPostId] || []), post];
      }
      return acc;
    },
    {},
  );
  const topLevelComments = comments.filter(
    post => !post.replyToPostId || post.replyToPostId === rootPost?.id,
  );
  const detailPoll =
    thread && rootPost
      ? parseCommunityPoll(thread.title, rootPost.content, thread.tags)
      : null;
  const rootPostBody = detailPoll ? detailPoll.body : rootPost?.content || '';
  const rootMediaUrls = [
    ...(thread?.imageUrls || []),
    ...(rootPost?.imageUrls || []),
  ]
    .map(url => resolveCommunityMediaSrc(url))
    .filter(
      (url, index, source) => Boolean(url) && source.indexOf(url) === index,
    );

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = comment.trim();
    if (!clean) return;
    if (!isAuthenticated) {
      router.push(loginHref);
      return;
    }

    setSaving(true);
    const response = await authFetch(
      `/api/forum/threads/${encodeURIComponent(threadId)}/posts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: clean,
          replyToPostId: replyTarget?.id || undefined,
        }),
      },
    );
    const payload = (await response
      .json()
      .catch(() => ({}))) as CreatedPostPayload;
    setSaving(false);

    if (!response.ok) {
      notify({
        title: isId ? 'Komentar gagal' : 'Comment failed',
        description: payload.error || '',
        variant: 'error',
      });
      return;
    }

    setComment('');
    setReplyTarget(null);
    if (payload.post) {
      setPosts(current => [
        ...current.filter(post => post.id !== payload.post?.id),
        payload.post as ForumPostDetail,
      ]);
    }
    onChanged();
    const postsResponse = await fetch(
      `/api/forum/threads/${encodeURIComponent(threadId)}/posts?page_size=80`,
      { cache: 'no-store', credentials: 'include' },
    );
    const postsPayload = (await postsResponse
      .json()
      .catch(() => ({}))) as ForumPostsResponse;
    setPosts(postsPayload.data || []);
  };

  const voteThread = async () => {
    if (!isAuthenticated) {
      router.push(loginHref);
      return;
    }

    const response = await authFetch(
      `/api/forum/threads/${encodeURIComponent(threadId)}/vote`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 1 }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.thread) {
      setThread(payload.thread);
      onChanged();
    }
  };

  const renderComment = (post: ForumPostDetail, nested = false) => (
    <article
      key={post.id}
      className={cn(
        'rounded-[18px] bg-slate-50 p-3',
        nested && 'ml-8 border border-[color:var(--app-border)] bg-white',
      )}
    >
      <div className="flex items-center gap-2.5">
        <Image
          alt={post.author?.name || 'Author'}
          src={profileAvatarSrc(
            post.author?.avatarUrl,
            readProfileAvatarStyle(post.author),
            post.author?.name,
          )}
          width={32}
          height={32}
          className="h-8 w-8 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-[color:var(--app-text)]">
            {post.author?.name || 'Community Member'}
          </p>
          <p className="text-[10px] text-[color:var(--app-text-soft)]">
            {timeAgo(post.createdAt, isId)}
          </p>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--app-text)]">
        {post.content}
      </p>
      {!nested ? (
        <button
          type="button"
          onClick={() => setReplyTarget(post)}
          className="mt-2 text-[11px] font-bold text-[color:var(--app-text-soft)] hover:text-[color:var(--app-accent)]"
        >
          {isId ? 'Balas' : 'Reply'}
        </button>
      ) : null}
      {(repliesByParent[post.id] || []).length ? (
        <div className="mt-2 space-y-2">
          {repliesByParent[post.id].map(reply => renderComment(reply, true))}
        </div>
      ) : null}
    </article>
  );

  return (
    <div
      className={COMMUNITY_MODAL_SHELL_CLASS}
      role="dialog"
      aria-modal="true"
      data-testid="community-detail-modal"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={cn(COMMUNITY_MODAL_SURFACE_CLASS, 'bg-white sm:max-w-2xl')}
        data-testid="community-detail-surface"
      >
        <header className="flex min-h-[58px] items-center justify-between gap-3 border-b border-[color:var(--app-border)] px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[color:var(--app-text)]">
              {thread?.category?.name ||
                (isId ? 'Detail komunitas' : 'Community detail')}
            </p>
            <p className="text-[11px] text-[color:var(--app-text-soft)]">
              {thread
                ? `${compactNumber(thread.views)} views · ${compactNumber(thread.replyCount)} comments`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-[color:var(--app-text)]"
            aria-label={isId ? 'Tutup' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
          data-auto-scrollbar
        >
          {loading ? (
            <CommunityFeedSkeleton />
          ) : thread ? (
            <div className="space-y-4">
              <article>
                <div className="flex items-center gap-3">
                  <Image
                    alt={thread.author?.name || 'Author'}
                    src={profileAvatarSrc(
                      thread.author?.avatarUrl,
                      readProfileAvatarStyle(thread.author),
                      thread.author?.name,
                    )}
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[color:var(--app-text)]">
                      {thread.author?.name || 'Community Member'}
                    </p>
                    <p className="text-xs text-[color:var(--app-text-soft)]">
                      {thread.author?.title || 'Member'} ·{' '}
                      {timeAgo(thread.createdAt, isId)}
                    </p>
                  </div>
                </div>
                <h1 className="mt-3 text-[1.2rem] font-black leading-tight tracking-[-0.035em] text-[color:var(--app-text)]">
                  {thread.title}
                </h1>
                {rootPostBody ? (
                  <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-[color:var(--app-text)]">
                    {rootPostBody}
                  </p>
                ) : null}
                {detailPoll ? (
                  <CommunityPoll
                    threadId={thread.id}
                    poll={detailPoll}
                    isId={isId}
                    loginHref={loginHref}
                  />
                ) : null}
                {rootMediaUrls.length ? (
                  <div className="mt-3">
                    <CommunityMediaGalleryPreview
                      mediaItems={rootMediaUrls}
                      title={thread.title}
                      isId={isId}
                      variant="detail"
                    />
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {thread.tags.map(tag => (
                    <span
                      key={tag.id}
                      className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)]"
                    >
                      #{tag.slug}
                    </span>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 border-y border-[color:var(--app-border)] py-1 text-xs font-semibold text-[color:var(--app-text-soft)]">
                  <button
                    type="button"
                    onClick={() => void voteThread()}
                    className={cn(
                      'inline-flex min-h-[38px] items-center justify-center gap-2 rounded-[12px] hover:bg-slate-50',
                      thread.viewerVote === 1 &&
                        'text-[color:var(--app-accent)]',
                    )}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    {isId ? 'Suka' : 'Like'}
                  </button>
                  <span className="inline-flex min-h-[38px] items-center justify-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    {compactNumber(comments.length)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(
                        `${window.location.origin}/community?thread=${threadId}`,
                      );
                      notify({
                        title: isId ? 'Link disalin' : 'Link copied',
                        variant: 'success',
                      });
                    }}
                    className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-[12px] hover:bg-slate-50"
                  >
                    <Share2 className="h-4 w-4" />
                    {isId ? 'Bagikan' : 'Share'}
                  </button>
                </div>
              </article>

              <section className="space-y-3">
                <h2 className="text-sm font-black text-[color:var(--app-text)]">
                  {isId ? 'Komentar' : 'Comments'}
                </h2>
                {comments.length === 0 ? (
                  <p className="rounded-[16px] bg-slate-50 px-4 py-5 text-center text-sm text-[color:var(--app-text-soft)]">
                    {isId
                      ? 'Belum ada komentar. Jadilah yang pertama.'
                      : 'No comments yet. Be the first.'}
                  </p>
                ) : null}
                {topLevelComments.map(post => renderComment(post))}
              </section>
            </div>
          ) : (
            <p className="rounded-[18px] bg-slate-50 px-4 py-6 text-center text-sm text-[color:var(--app-text-soft)]">
              {isId ? 'Konten tidak ditemukan.' : 'Content not found.'}
            </p>
          )}
        </div>

        <form
          onSubmit={submitComment}
          className="border-t border-[color:var(--app-border)] bg-white px-3 py-3"
        >
          {replyTarget ? (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-[14px] bg-slate-50 px-3 py-2 text-xs text-[color:var(--app-text-soft)]">
              <span className="min-w-0 truncate">
                {isId ? 'Membalas' : 'Replying to'}{' '}
                <strong className="text-[color:var(--app-text)]">
                  {replyTarget.author?.name || 'Community Member'}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white"
                aria-label={isId ? 'Batalkan balasan' : 'Cancel reply'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              value={comment}
              onChange={event => setComment(event.target.value)}
              placeholder={
                replyTarget
                  ? isId
                    ? 'Tulis balasan...'
                    : 'Write a reply...'
                  : isId
                    ? 'Tulis komentar...'
                    : 'Write a comment...'
              }
              className="min-h-[42px] flex-1 rounded-full bg-slate-50 px-4 text-sm text-[color:var(--app-text)] outline-none"
            />
            <button
              type="submit"
              disabled={saving || !comment.trim()}
              className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[color:var(--app-accent)] text-white disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function GroupCreateModal({
  isId,
  open,
  onClose,
  onCreated,
}: {
  isId: boolean;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { isAuthenticated, authFetch } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { notify } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private' | 'hidden'>(
    'public',
  );
  const [postingPermission, setPostingPermission] = useState<
    'public' | 'member' | 'moderator'
  >('member');
  const [membershipPermission, setMembershipPermission] = useState<
    'open' | 'approval' | 'invite'
  >('open');
  const [rules, setRules] = useState([
    isId
      ? 'Diskusi harus relevan dengan usaha.'
      : 'Discussions must be relevant to business.',
    isId
      ? 'No spam. No transaksi berisiko.'
      : 'No spam or risky off-platform transactions.',
  ]);
  const [saving, setSaving] = useState(false);
  const loginHref = buildLoginHref(pathname, searchParams.toString());

  if (!open) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated) {
      router.push(loginHref);
      return;
    }

    setSaving(true);
    const response = await authFetch('/api/community/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        privacy,
        postingPermission,
        membershipPermission,
        rules,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      notify({
        title: isId ? 'Grup gagal dibuat' : 'Group creation failed',
        description: payload.error || '',
        variant: 'error',
      });
      return;
    }

    notify({
      title: isId ? 'Grup dibuat' : 'Group created',
      variant: 'success',
    });
    setName('');
    setDescription('');
    setPrivacy('public');
    setPostingPermission('member');
    setMembershipPermission('open');
    onCreated();
    onClose();
  };

  return (
    <div
      className={COMMUNITY_MODAL_SHELL_CLASS}
      role="dialog"
      aria-modal="true"
      data-testid="community-group-create-modal"
    >
      <form
        onSubmit={submit}
        className={cn(COMMUNITY_MODAL_SURFACE_CLASS, 'bg-white sm:max-w-lg')}
        data-testid="community-group-create-surface"
      >
        <header className="flex min-h-[58px] items-center justify-between border-b border-[color:var(--app-border)] px-4">
          <h2 className="text-sm font-black text-[color:var(--app-text)]">
            {isId ? 'Buat Grup Komunitas' : 'Create Community Group'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <label className="block">
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              {isId ? 'Nama grup' : 'Group name'}
            </span>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              maxLength={72}
              className="mt-1 min-h-[42px] w-full rounded-[14px] bg-slate-50 px-3 text-sm outline-none"
              placeholder={
                isId
                  ? 'Contoh: Supplier Kemasan Bandung'
                  : 'Example: Bandung Packaging Suppliers'
              }
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              {isId ? 'Deskripsi' : 'Description'}
            </span>
            <textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              rows={5}
              maxLength={280}
              className="mt-1 w-full resize-none rounded-[14px] bg-slate-50 px-3 py-2 text-sm leading-6 outline-none"
              placeholder={
                isId
                  ? 'Fokus grup + aturan singkat.'
                  : 'Write the group focus and simple rules.'
              }
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-bold text-[color:var(--app-text)]">
                {isId ? 'Privasi' : 'Privacy'}
              </span>
              <select
                value={privacy}
                onChange={event =>
                  setPrivacy(event.target.value as typeof privacy)
                }
                className="mt-1 min-h-[40px] w-full rounded-[14px] bg-slate-50 px-3 text-xs outline-none"
              >
                <option value="public">{isId ? 'Publik' : 'Public'}</option>
                <option value="private">{isId ? 'Privat' : 'Private'}</option>
                <option value="hidden">
                  {isId ? 'Tersembunyi' : 'Hidden'}
                </option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-[color:var(--app-text)]">
                {isId ? 'Posting' : 'Posting'}
              </span>
              <select
                value={postingPermission}
                onChange={event =>
                  setPostingPermission(
                    event.target.value as typeof postingPermission,
                  )
                }
                className="mt-1 min-h-[40px] w-full rounded-[14px] bg-slate-50 px-3 text-xs outline-none"
              >
                <option value="public">
                  {isId ? 'Semua orang' : 'Everyone'}
                </option>
                <option value="member">{isId ? 'Member' : 'Members'}</option>
                <option value="moderator">
                  {isId ? 'Moderator' : 'Moderators'}
                </option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-[color:var(--app-text)]">
                {isId ? 'Join' : 'Join'}
              </span>
              <select
                value={membershipPermission}
                onChange={event =>
                  setMembershipPermission(
                    event.target.value as typeof membershipPermission,
                  )
                }
                className="mt-1 min-h-[40px] w-full rounded-[14px] bg-slate-50 px-3 text-xs outline-none"
              >
                <option value="open">{isId ? 'Langsung masuk' : 'Open'}</option>
                <option value="approval">
                  {isId ? 'Perlu approve' : 'Approval'}
                </option>
                <option value="invite">
                  {isId ? 'Undangan saja' : 'Invite only'}
                </option>
              </select>
            </label>
          </div>
          <div className="space-y-2 rounded-[16px] bg-slate-50 p-2">
            <p className="text-xs font-bold text-[color:var(--app-text)]">
              {isId ? 'Aturan grup' : 'Group rules'}
            </p>
            {rules.map((rule, index) => (
              <input
                key={index}
                value={rule}
                onChange={event =>
                  setRules(current =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  )
                }
                className="min-h-[36px] w-full rounded-[12px] bg-white px-3 text-xs outline-none"
              />
            ))}
            <button
              type="button"
              onClick={() =>
                setRules(current =>
                  current.length >= 8 ? current : [...current, ''],
                )
              }
              className="inline-flex min-h-[32px] items-center gap-2 rounded-full bg-white px-3 text-xs font-semibold text-[color:var(--app-accent)]"
            >
              <Plus className="h-3.5 w-3.5" />
              {isId ? 'Tambah aturan' : 'Add rule'}
            </button>
          </div>
        </div>
        <footer className="border-t border-[color:var(--app-border)] p-4">
          <button
            type="submit"
            disabled={saving || !name.trim() || !description.trim()}
            className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isId ? 'Buat grup' : 'Create group'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function MemberRoleBadge({
  role,
  isId,
}: {
  role: CommunityGroupMember['role'];
  isId: boolean;
}) {
  const Icon =
    role === 'owner' ? Crown : role === 'moderator' ? ShieldCheck : Users;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black',
        role === 'owner'
          ? 'bg-amber-50 text-amber-700'
          : role === 'moderator'
            ? 'bg-teal-50 text-teal-700'
            : 'bg-slate-100 text-[color:var(--app-text-soft)]',
      )}
    >
      <Icon className="h-3 w-3" />
      {groupRoleLabel(role, isId)}
    </span>
  );
}

function GroupLeadershipPreview({
  group,
  isId,
  onOpenMembers,
}: {
  group: CommunityGroup;
  isId: boolean;
  onOpenMembers: () => void;
}) {
  const [admins, setAdmins] = useState<CommunityGroupMember[]>([]);
  const [moderators, setModerators] = useState<CommunityGroupMember[]>([]);

  useEffect(() => {
    let alive = true;
    fetch(
      `/api/community/groups/${encodeURIComponent(group.id)}/members?limit=12`,
      {
        cache: 'no-store',
        credentials: 'include',
      },
    )
      .then(response => (response.ok ? response.json() : null))
      .then((payload: CommunityGroupMembersResponse | null) => {
        if (!alive || !payload) return;
        setAdmins(payload.admins || []);
        setModerators(payload.moderators || []);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [group.id]);

  const leaders = [...admins, ...moderators].slice(0, 6);

  return (
    <div className="rounded-[18px] bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black text-[color:var(--app-text)]">
          {isId ? 'Admin & moderator' : 'Admins & moderators'}
        </p>
        <button
          type="button"
          onClick={onOpenMembers}
          className="text-[11px] font-bold text-[color:var(--app-accent)]"
        >
          {isId ? 'Lihat semua' : 'See all'}
        </button>
      </div>
      {leaders.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {leaders.map(member => (
            <div
              key={member.userId}
              className="flex min-w-0 items-center gap-2 rounded-[14px] bg-white p-2"
            >
              <Image
                alt={member.name}
                src={profileAvatarSrc(
                  member.avatarUrl,
                  readProfileAvatarStyle(member),
                  member.name,
                )}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[color:var(--app-text)]">
                  {member.name}
                </p>
                <p className="truncate text-[10px] text-[color:var(--app-text-soft)]">
                  {member.title}
                </p>
              </div>
              <MemberRoleBadge role={member.role} isId={isId} />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
          {isId
            ? 'Admin group kelola. Moderator bisa ditambah.'
            : 'The group admin manages this directly. Moderators can be added from the member list.'}
        </p>
      )}
    </div>
  );
}

export function GroupMembersModal({
  group,
  isId,
  onClose,
  onChanged,
}: {
  group: CommunityGroup | null;
  isId: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { authFetch } = useAuth();
  const { notify } = useToast();
  const [members, setMembers] = useState<CommunityGroupMember[]>([]);
  const [admins, setAdmins] = useState<CommunityGroupMember[]>([]);
  const [moderators, setModerators] = useState<CommunityGroupMember[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<
    'all' | 'owner' | 'moderator' | 'member'
  >('all');
  const [loading, setLoading] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!group) return;
    let alive = true;
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (query.trim()) params.set('q', query.trim());
    if (roleFilter !== 'all') params.set('role', roleFilter);
    queueMicrotask(() => {
      if (alive) setLoading(true);
    });

    authFetch(
      `/api/community/groups/${encodeURIComponent(group.id)}/members?${params.toString()}`,
      {
        cache: 'no-store',
      },
    )
      .then(response =>
        response.ok ? response.json() : Promise.reject(response),
      )
      .then((payload: CommunityGroupMembersResponse) => {
        if (!alive) return;
        setMembers(payload.data || []);
        setAdmins(payload.admins || []);
        setModerators(payload.moderators || []);
        setTotal(payload.total || 0);
      })
      .catch(() => {
        if (!alive) return;
        setMembers([]);
        setAdmins([]);
        setModerators([]);
        setTotal(0);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [authFetch, group, query, roleFilter]);

  if (!group) return null;

  const canPromoteAdmin = group.viewerRole === 'owner';
  const roleOptions: Array<{
    value: CommunityGroupMember['role'];
    label: string;
  }> = [
    ...(canPromoteAdmin
      ? [{ value: 'owner' as const, label: isId ? 'Admin' : 'Admin' }]
      : []),
    { value: 'moderator', label: isId ? 'Moderator' : 'Moderator' },
    { value: 'member', label: isId ? 'Member' : 'Member' },
  ];

  const updateRole = async (
    member: CommunityGroupMember,
    role: CommunityGroupMember['role'],
  ) => {
    if (role === member.role) return;
    setUpdatingUserId(member.userId);
    const response = await authFetch(
      `/api/community/groups/${encodeURIComponent(group.id)}/members/${encodeURIComponent(member.userId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    setUpdatingUserId(null);

    if (!response.ok) {
      notify({
        title: isId ? 'Role gagal diubah' : 'Role update failed',
        description: payload.error || '',
        variant: 'error',
      });
      return;
    }

    const updated = payload.data as CommunityGroupMember | undefined;
    if (updated) {
      setMembers(current =>
        current.map(item => (item.userId === updated.userId ? updated : item)),
      );
      setAdmins(current => {
        const next = current.filter(item => item.userId !== updated.userId);
        return updated.role === 'owner' ? [...next, updated] : next;
      });
      setModerators(current => {
        const next = current.filter(item => item.userId !== updated.userId);
        return updated.role === 'moderator' ? [...next, updated] : next;
      });
    }
    notify({
      title: isId ? 'Role anggota diperbarui' : 'Member role updated',
      variant: 'success',
    });
    onChanged();
  };

  return (
    <div
      className={COMMUNITY_MODAL_SHELL_CLASS}
      role="dialog"
      aria-modal="true"
      data-testid="community-members-modal"
    >
      <section
        className={cn(COMMUNITY_MODAL_SURFACE_CLASS, 'bg-white sm:max-w-2xl')}
        data-testid="community-members-surface"
      >
        <header className="flex min-h-[62px] items-center justify-between gap-3 border-b border-[color:var(--app-border)] px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[color:var(--app-text)]">
              {group.name}
            </p>
            <p className="text-[11px] text-[color:var(--app-text-soft)]">
              {compactNumber(total || group.memberCount)}{' '}
              {isId ? 'anggota aktif' : 'active members'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-50"
            aria-label={isId ? 'Tutup' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="border-b border-[color:var(--app-border)] px-4 py-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px]">
            <div className="flex min-h-[40px] items-center gap-2 rounded-full bg-slate-50 px-3">
              <Search className="h-4 w-4 text-[color:var(--app-text-soft)]" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={isId ? 'Cari anggota...' : 'Search members...'}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <select
              value={roleFilter}
              onChange={event =>
                setRoleFilter(event.target.value as typeof roleFilter)
              }
              className="min-h-[40px] rounded-full bg-slate-50 px-3 text-xs font-bold text-[color:var(--app-text)] outline-none"
            >
              <option value="all">{isId ? 'Semua role' : 'All roles'}</option>
              <option value="owner">{isId ? 'Admin' : 'Admin'}</option>
              <option value="moderator">
                {isId ? 'Moderator' : 'Moderator'}
              </option>
              <option value="member">{isId ? 'Member' : 'Member'}</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {admins.slice(0, 4).map(member => (
              <span
                key={member.userId}
                className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800"
              >
                <Crown className="h-3.5 w-3.5" />
                {member.name}
              </span>
            ))}
            {moderators.slice(0, 4).map(member => (
              <span
                key={member.userId}
                className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-800"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {member.name}
              </span>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3" data-auto-scrollbar>
          {loading ? <CommunityFeedSkeleton /> : null}
          {!loading && members.length === 0 ? (
            <p className="rounded-[18px] bg-slate-50 px-4 py-6 text-center text-sm text-[color:var(--app-text-soft)]">
              {isId ? 'Belum ada anggota yang cocok.' : 'No matching members.'}
            </p>
          ) : null}
          <div className="space-y-2">
            {members.map(member => (
              <article
                key={member.userId}
                className="flex items-center gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-white p-3"
              >
                <Image
                  alt={member.name}
                  src={profileAvatarSrc(
                    member.avatarUrl,
                    readProfileAvatarStyle(member),
                    member.name,
                  )}
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold text-[color:var(--app-text)]">
                      {member.name}
                    </p>
                    <MemberRoleBadge role={member.role} isId={isId} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[color:var(--app-text-soft)]">
                    {member.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[color:var(--app-text-soft)]">
                    {isId ? 'Bergabung' : 'Joined'}{' '}
                    {timeAgo(member.joinedAt, isId)} ·{' '}
                    {compactNumber(member.reputation)} rep
                  </p>
                </div>
                {group.viewerCanManage && member.role !== 'owner' ? (
                  <select
                    value={member.role}
                    disabled={updatingUserId === member.userId}
                    onChange={event =>
                      void updateRole(
                        member,
                        event.target.value as CommunityGroupMember['role'],
                      )
                    }
                    className="min-h-[34px] rounded-full bg-slate-50 px-2 text-[11px] font-bold text-[color:var(--app-text)] outline-none disabled:opacity-60"
                  >
                    {roleOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function GroupDetailPanel({
  group,
  isId,
  onOpenMembers,
}: {
  group: CommunityGroup | null;
  isId: boolean;
  onOpenMembers: (group: CommunityGroup) => void;
}) {
  if (!group) return null;

  return (
    <section className="overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-white shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
      <div className="relative min-h-[132px] bg-[linear-gradient(135deg,#ecfdf5,#eff6ff)] p-4">
        {group.coverUrl ? (
          <Image
            src={group.coverUrl}
            alt={group.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute right-4 top-4 grid h-16 w-16 place-items-center rounded-[24px] bg-white/78 text-[color:var(--app-accent)] shadow-[0_20px_38px_-32px_rgba(15,23,42,0.35)]">
            <Users className="h-8 w-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(15,23,42,0.45))]" />
        <div className="relative z-[1] flex min-h-[104px] flex-col justify-end">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-black text-[color:var(--app-accent)]">
              {group.viewerMembershipStatus === 'active'
                ? isId
                  ? 'Kamu anggota'
                  : 'Joined'
                : groupJoinLabel(group, isId)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-black text-[color:var(--app-text)]">
              {group.privacy === 'public' ? (
                <Earth className="h-3.5 w-3.5" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              {groupPrivacyLabel(group, isId)}
            </span>
          </div>
          <h2 className="mt-2 max-w-[720px] text-[1.35rem] font-black leading-tight tracking-[-0.04em] text-white sm:text-[1.6rem]">
            {group.name}
          </h2>
        </div>
      </div>

      <div className="grid gap-3 p-3.5 sm:p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-3">
          <p className="text-sm leading-6 text-[color:var(--app-text)]">
            {group.description}
          </p>
          <GroupLeadershipPreview
            group={group}
            isId={isId}
            onOpenMembers={() => onOpenMembers(group)}
          />
          {group.rules.length ? (
            <div className="rounded-[18px] bg-slate-50 p-3">
              <p className="text-xs font-black text-[color:var(--app-text)]">
                {isId ? 'Aturan grup' : 'Group rules'}
              </p>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[color:var(--app-text-soft)]">
                {group.rules.slice(0, 4).map(rule => (
                  <li key={rule} className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--app-accent)]" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="space-y-2">
          <button
            type="button"
            onClick={() => onOpenMembers(group)}
            className="flex min-h-[58px] w-full items-center justify-between gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-white px-3 text-left shadow-[0_14px_24px_-26px_rgba(15,23,42,0.2)]"
          >
            <span>
              <span className="block text-[1.15rem] font-black text-[color:var(--app-text)]">
                {compactNumber(group.memberCount)}
              </span>
              <span className="block text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                {isId ? 'Anggota' : 'Members'}
              </span>
            </span>
            <Users className="h-5 w-5 text-[color:var(--app-accent)]" />
          </button>
          <div className="rounded-[18px] bg-slate-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
              {isId ? 'Permission' : 'Permissions'}
            </p>
            <div className="mt-2 space-y-2 text-xs text-[color:var(--app-text)]">
              <p className="flex items-center justify-between gap-2">
                <span>{isId ? 'Posting' : 'Posting'}</span>
                <strong>{groupPostLabel(group, isId)}</strong>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>{isId ? 'Join' : 'Join'}</span>
                <strong>{groupJoinLabel(group, isId)}</strong>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>{isId ? 'Role kamu' : 'Your role'}</span>
                <strong>{groupRoleLabel(group.viewerRole, isId)}</strong>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function GroupCard({
  group,
  isId,
  compact = false,
  onChanged,
  onOpenMembers,
}: {
  group: CommunityGroup;
  isId: boolean;
  compact?: boolean;
  onChanged: () => void;
  onOpenMembers: (group: CommunityGroup) => void;
}) {
  const { isAuthenticated, authFetch } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const loginHref = buildLoginHref(pathname, searchParams.toString());
  const joined = group.viewerMembershipStatus === 'active';
  const pending = group.viewerMembershipStatus === 'pending';
  const initial = group.name.trim().charAt(0).toUpperCase() || 'G';
  const highlightedRole =
    group.viewerRole === 'owner' || group.viewerRole === 'moderator'
      ? groupRoleLabel(group.viewerRole, isId)
      : null;

  const joinOrLeave = async () => {
    if (!isAuthenticated) {
      router.push(loginHref);
      return;
    }
    if (group.viewerRole === 'owner') {
      router.push(communityGroupHref(group));
      return;
    }

    setBusy(true);
    const response = await authFetch(
      `/api/community/groups/${encodeURIComponent(group.id)}/${joined ? 'leave' : 'join'}`,
      { method: 'POST' },
    );
    const payload = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      notify({
        title: isId ? 'Aksi grup gagal' : 'Group action failed',
        description: payload.error || '',
        variant: 'error',
      });
      return;
    }

    notify({
      title: joined
        ? isId
          ? 'Keluar dari grup'
          : 'Left group'
        : pending || group.membershipPermission === 'approval'
          ? isId
            ? 'Permintaan join dikirim'
            : 'Join request sent'
          : isId
            ? 'Berhasil join grup'
            : 'Joined group',
      variant: 'success',
    });
    onChanged();
  };

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_82%,transparent)] bg-white text-left shadow-[0_18px_34px_-32px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_22px_40px_-34px_rgba(15,23,42,0.28)]',
        compact && 'min-w-0',
      )}
    >
      <div className="relative h-24 overflow-hidden bg-[linear-gradient(135deg,#ecfdf5_0%,#eff6ff_52%,#fff7ed_100%)]">
        {group.coverUrl ? (
          <Image
            src={group.coverUrl}
            alt={group.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.28),transparent_32%),radial-gradient(circle_at_84%_12%,rgba(59,130,246,0.22),transparent_26%)]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(15,23,42,0.22))]" />
        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/92 px-2 py-1 text-[10px] font-black text-[color:var(--app-accent)] shadow-sm">
          {group.privacy === 'public' ? (
            <Earth className="h-3 w-3" />
          ) : (
            <Lock className="h-3 w-3" />
          )}
          {groupPrivacyLabel(group, isId)}
        </div>
      </div>

      <div className="relative flex flex-1 flex-col px-3 pb-3 pt-0">
        <Link
          href={communityGroupHref(group)}
          className="-mt-9 grid h-16 w-16 place-items-center rounded-[22px] border-[3px] border-white bg-[color:var(--app-accent-soft)] text-xl font-black text-[color:var(--app-accent)] shadow-[0_18px_28px_-24px_rgba(15,23,42,0.4)] transition group-hover:scale-[1.03]"
          aria-label={group.name}
        >
          {initial}
        </Link>

        <div className="mt-2 min-w-0">
          <Link
            href={communityGroupHref(group)}
            className="line-clamp-2 text-[0.98rem] font-black leading-5 tracking-[-0.02em] text-[color:var(--app-text)]"
          >
            {group.name}
          </Link>
          <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-[color:var(--app-text-soft)]">
            {group.description}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenMembers(group)}
            className="rounded-[16px] bg-slate-50 px-2 py-2 text-left transition hover:bg-emerald-50"
          >
            <span className="block text-sm font-black text-[color:var(--app-text)]">
              {compactNumber(group.memberCount)}
            </span>
            <span className="block truncate text-[10px] font-bold text-[color:var(--app-text-soft)]">
              {isId ? 'member' : 'members'}
            </span>
          </button>
          <div className="rounded-[16px] bg-slate-50 px-2 py-2 text-left">
            <span className="block text-sm font-black text-[color:var(--app-text)]">
              {compactNumber(group.postCount)}
            </span>
            <span className="block truncate text-[10px] font-bold text-[color:var(--app-text-soft)]">
              posts
            </span>
          </div>
        </div>

        {highlightedRole ? (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
              {group.viewerRole === 'owner' ? (
                <Crown className="h-3 w-3" />
              ) : (
                <UserCog className="h-3 w-3" />
              )}
              {highlightedRole}
            </span>
          </div>
        ) : null}

        <div className="mt-auto pt-3">
          <button
            type="button"
            onClick={joinOrLeave}
            disabled={busy || pending}
            className={cn(
              'inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[15px] px-2 text-center text-xs font-black leading-4 transition disabled:opacity-60',
              joined
                ? 'border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]'
                : 'bg-[color:var(--app-accent)] text-white shadow-[0_14px_24px_-18px_rgba(4,120,87,0.7)] hover:bg-[color:var(--app-accent-strong)]',
            )}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : joined ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {pending
              ? isId
                ? 'Menunggu approve'
                : 'Pending approval'
              : joined
                ? isId
                  ? 'Sudah join'
                  : 'Joined'
                : isId
                  ? 'Join grup'
                  : 'Join group'}
          </button>
        </div>
      </div>
    </article>
  );
}

function GroupStrip({
  isId,
  overview,
  onChanged,
  onCreateGroup,
  onOpenMembers,
}: {
  isId: boolean;
  overview: CommunityFeedOverview | null;
  onChanged: () => void;
  onCreateGroup: () => void;
  onOpenMembers: (group: CommunityGroup) => void;
}) {
  const groups = [
    ...(overview?.joinedGroups || []),
    ...(overview?.recommendedGroups || []),
    ...(overview?.groups || []),
  ]
    .filter(
      (group, index, source) =>
        source.findIndex(item => item.id === group.id) === index,
    )
    .slice(0, 8);

  return (
    <section className="rounded-[26px] border border-[color:color-mix(in_srgb,var(--app-border)_82%,transparent)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fffb_100%)] p-3.5 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.18)] sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[color:var(--app-accent)]">
            {isId ? 'Ruang diskusi' : 'Discussion rooms'}
          </p>
          <h2 className="mt-0.5 text-base font-black tracking-[-0.025em] text-[color:var(--app-text)] sm:text-lg">
            {isId ? 'Grup untuk kamu' : 'Groups for you'}
          </h2>
          <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
            {isId
              ? 'Pilih ruang yang paling nyambung dengan usaha kamu.'
              : 'Pick a room that matches your work.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateGroup}
          className="inline-flex min-h-[36px] shrink-0 items-center gap-2 rounded-full bg-[color:var(--app-accent-soft)] px-3 text-xs font-black text-[color:var(--app-accent)] transition hover:bg-[color:var(--app-accent)] hover:text-white"
        >
          <Plus className="h-4 w-4" />
          {isId ? 'Buat' : 'Create'}
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {groups.map(group => (
          <GroupCard
            key={group.id}
            group={group}
            isId={isId}
            compact
            onChanged={onChanged}
            onOpenMembers={onOpenMembers}
          />
        ))}
      </div>
    </section>
  );
}

function SearchFilterButton({
  tab,
  isId,
  active,
  count,
  onClick,
}: {
  tab: (typeof SEARCH_TABS)[number];
  isId: boolean;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  const Icon = tab.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[42px] shrink-0 items-center gap-2 rounded-[14px] px-3 text-left text-xs font-bold transition',
        active
          ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
          : 'bg-white text-[color:var(--app-text-soft)] hover:bg-slate-50',
      )}
    >
      <span
        className={cn(
          'grid h-8 w-8 place-items-center rounded-full',
          active ? 'bg-white' : 'bg-slate-50',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span>{isId ? tab.labelId : tab.labelEn}</span>
      {count ? (
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-[color:var(--app-text-soft)]">
          {compactNumber(count)}
        </span>
      ) : null}
    </button>
  );
}

function SearchSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-base font-black tracking-[-0.035em] text-[color:var(--app-text)]">
        {title}
      </h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function SearchGroupResult({
  group,
  isId,
  onOpenMembers,
  onChanged,
}: {
  group: CommunityGroup;
  isId: boolean;
  onOpenMembers: (group: CommunityGroup) => void;
  onChanged: () => void;
}) {
  const { isAuthenticated, authFetch } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const joined = group.viewerMembershipStatus === 'active';
  const pending = group.viewerMembershipStatus === 'pending';
  const loginHref = buildLoginHref(pathname, searchParams.toString());
  const initial = group.name.trim().charAt(0).toUpperCase() || 'G';

  const joinOrLeave = async () => {
    if (!isAuthenticated) {
      router.push(loginHref);
      return;
    }
    if (group.viewerRole === 'owner') {
      router.push(communityGroupHref(group));
      return;
    }

    setBusy(true);
    const response = await authFetch(
      `/api/community/groups/${encodeURIComponent(group.id)}/${joined ? 'leave' : 'join'}`,
      { method: 'POST' },
    );
    const payload = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      notify({
        title: isId ? 'Aksi grup gagal' : 'Group action failed',
        description: payload.error || '',
        variant: 'error',
      });
      return;
    }

    notify({
      title: joined
        ? isId
          ? 'Keluar dari grup'
          : 'Left group'
        : pending || group.membershipPermission === 'approval'
          ? isId
            ? 'Permintaan join dikirim'
            : 'Join request sent'
          : isId
            ? 'Berhasil join grup'
            : 'Joined group',
      variant: 'success',
    });
    onChanged();
  };

  return (
    <article className="overflow-hidden rounded-[22px] border border-[color:color-mix(in_srgb,var(--app-border)_78%,transparent)] bg-white shadow-[0_16px_34px_-32px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)]">
      <div className="flex gap-3">
        <div className="relative h-[112px] w-[96px] shrink-0 overflow-hidden bg-[linear-gradient(135deg,#dcfce7,#eff6ff)] sm:w-[112px]">
          {group.coverUrl ? (
            <Image
              src={group.coverUrl}
              alt={group.name}
              fill
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-2xl font-black text-[color:var(--app-accent)]">
              {initial}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 py-3 pr-3">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[color:var(--app-accent-soft)] px-2 py-0.5 text-[10px] font-black text-[color:var(--app-accent)]">
              {groupPrivacyLabel(group, isId)}
            </span>
            {joined ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-[color:var(--app-text-soft)]">
                {isId ? 'Sudah join' : 'Joined'}
              </span>
            ) : null}
          </div>
          <Link
            href={communityGroupHref(group)}
            className="line-clamp-1 text-sm font-black text-[color:var(--app-text)]"
          >
            {group.name}
          </Link>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
            {group.description}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-[color:var(--app-text-soft)]">
            <button
              type="button"
              onClick={() => onOpenMembers(group)}
              className="rounded-full bg-[color:var(--app-accent-soft)] px-2 py-1 text-[color:var(--app-accent)]"
            >
              {compactNumber(group.memberCount)} {isId ? 'member' : 'members'}
            </button>
            <span className="rounded-full bg-slate-50 px-2 py-1">
              {compactNumber(group.postCount)} posts
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-[color:var(--app-border)] p-3 pt-2.5">
        <Link
          href={communityGroupHref(group)}
          className="inline-flex min-h-[36px] flex-1 items-center justify-center rounded-[13px] border border-[color:var(--app-border)] text-xs font-bold text-[color:var(--app-text)]"
        >
          {isId ? 'Lihat grup' : 'View group'}
        </Link>
        <button
          type="button"
          onClick={joinOrLeave}
          disabled={busy || pending}
          className={cn(
            'inline-flex min-h-[36px] flex-1 items-center justify-center gap-2 rounded-[13px] text-xs font-bold disabled:opacity-60',
            joined
              ? 'border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)]'
              : 'bg-[color:var(--app-accent)] text-white',
          )}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {pending
            ? isId
              ? 'Pending'
              : 'Pending'
            : joined
              ? isId
                ? 'Sudah join'
                : 'Joined'
              : isId
                ? 'Gabung'
                : 'Join'}
        </button>
      </div>
    </article>
  );
}

function SearchPersonResult({
  person,
}: {
  person: CommunityFeedItem['author'];
}) {
  return (
    <article className="flex items-center gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-white p-3">
      <Image
        src={profileAvatarSrc(
          person.avatarUrl,
          readProfileAvatarStyle(person),
          person.name,
        )}
        alt={person.name}
        width={48}
        height={48}
        className="h-12 w-12 rounded-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <Link
          href={`/profile/${encodeURIComponent(person.id)}`}
          className="block truncate text-sm font-black text-[color:var(--app-text)]"
        >
          {person.name}
        </Link>
        <p className="mt-0.5 truncate text-xs text-[color:var(--app-text-soft)]">
          {person.title}
        </p>
      </div>
      <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-black text-[color:var(--app-text-soft)]">
        {compactNumber(person.reputation)} pts
      </span>
    </article>
  );
}

// Kept only for older payload experiments; community UI no longer renders this card.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacySearchVideoResult({
  item,
  isId,
}: {
  item: CommunityFeedItem;
  isId: boolean;
}) {
  return (
    <Link
      href={item.href}
      className="flex gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-white p-3 hover:border-[color:var(--app-accent-soft)]"
    >
      <div className="relative h-[104px] w-[78px] shrink-0 overflow-hidden rounded-[16px] bg-slate-950">
        {item.media ? (
          <MediaPreviewCarousel
            items={[
              {
                src:
                  item.media.type === 'video'
                    ? resolveCommunityMediaSrc(item.media.src)
                    : item.media.src,
                type: item.media.type,
                alt: item.media.alt,
              },
            ]}
            alt={item.media.alt || item.title}
            aspectClassName="h-full w-full"
            className="h-full w-full bg-slate-950"
            sizes="78px"
            controls={false}
            lightbox={false}
            showCounter={false}
            showDots={false}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-white">
            <PlayCircle className="h-7 w-7" />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-black text-white">
          Video
        </span>
      </div>
      <div className="min-w-0 flex-1 py-1">
        <h3 className="line-clamp-2 text-sm font-black text-[color:var(--app-text)]">
          {item.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
          {item.body}
        </p>
        <p className="mt-2 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
          {compactNumber(item.stats.reactions)} likes ·{' '}
          {compactNumber(item.stats.comments)} {isId ? 'komentar' : 'comments'}
        </p>
      </div>
    </Link>
  );
}

function SearchMarketplaceResult({
  query,
  isId,
}: {
  query: string;
  isId: boolean;
}) {
  return (
    <section className="rounded-[22px] border border-[color:var(--app-border)] bg-[linear-gradient(145deg,#ffffff,#fff7ed)] p-4 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.13)]">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-amber-100 text-amber-700">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black tracking-[-0.035em] text-[color:var(--app-text)]">
            Marketplace
          </h2>
          <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Cari supplier, produk, jasa, talent, dan lokasi dari backend marketplace dengan kata kunci yang sama.'
              : 'Search suppliers, products, services, talent, and locations from the marketplace backend with the same keyword.'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/search?q=${encodeURIComponent(query)}`}
          className="inline-flex min-h-[38px] flex-1 items-center justify-center rounded-[13px] bg-amber-500 px-3 text-xs font-black text-white"
        >
          {isId ? 'Cari di marketplace' : 'Search marketplace'}
        </Link>
        <Link
          href="/umkm"
          className="inline-flex min-h-[38px] flex-1 items-center justify-center rounded-[13px] border border-amber-200 bg-white px-3 text-xs font-black text-amber-700"
        >
          UMKM
        </Link>
      </div>
    </section>
  );
}

function CommunitySearchPanel({
  isId,
  query,
  kind,
  results,
  loading,
  onOpenThread,
  onOpenMembers,
  onRefresh,
}: {
  isId: boolean;
  query: string;
  kind: CommunitySearchKind;
  results: CommunitySearchResponse | null;
  loading: boolean;
  onOpenThread: (threadId: string) => void;
  onOpenMembers: (group: CommunityGroup) => void;
  onRefresh: () => void;
}) {
  const showGroups = kind === 'all' || kind === 'groups';
  const showPeople = kind === 'all' || kind === 'people';
  const showMarketplace = kind === 'marketplace';
  const showPosts = kind === 'all' || kind === 'posts';
  const hasAnyResult = Boolean(
    (results?.counts.all || 0) > 0 || showMarketplace,
  );
  const resultSummary = results?.counts
    ? [
        `${compactNumber(results.counts.posts)} ${isId ? 'postingan' : 'posts'}`,
        `${compactNumber(results.counts.groups)} ${isId ? 'grup' : 'groups'}`,
        `${compactNumber(results.counts.people)} ${isId ? 'orang' : 'people'}`,
      ].join(' - ')
    : isId
      ? 'Mencari diskusi, grup, dan orang.'
      : 'Searching discussions, groups, and people.';

  return (
    <div className="space-y-3">
      <section className="rounded-[24px] border border-emerald-100 bg-[linear-gradient(135deg,#ffffff_0%,#f0fdf4_56%,#eff6ff_100%)] p-3.5 shadow-[0_18px_36px_-32px_rgba(15,23,42,0.2)] sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[color:var(--app-accent)]">
              {isId ? 'Pencarian komunitas' : 'Community search'}
            </p>
            <h2 className="mt-1 text-base font-black tracking-[-0.035em] text-[color:var(--app-text)]">
              {isId ? 'Hasil pencarian' : 'Search results'}
            </h2>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
              {isId ? `Kata kunci: "${query}"` : `Keyword: "${query}"`}
            </p>
            <p className="mt-1 text-[11px] font-bold text-[color:var(--app-text-soft)]">
              {resultSummary}
            </p>
          </div>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[color:var(--app-accent)]" />
          ) : null}
        </div>
      </section>

      {loading ? <CommunityFeedSkeleton /> : null}

      {!loading && !hasAnyResult ? (
        <section className="rounded-[22px] border border-[color:var(--app-border)] bg-white p-6 text-center shadow-[0_16px_30px_-28px_rgba(15,23,42,0.13)]">
          <p className="text-sm font-semibold text-[color:var(--app-text)]">
            {isId ? 'Belum ada hasil yang cocok.' : 'No matching results yet.'}
          </p>
          <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
            {isId
              ? 'Coba kata lain atau buat posting.'
              : 'Try another keyword or create a new post.'}
          </p>
        </section>
      ) : null}

      {!loading && results && showGroups && results.groups.length ? (
        <SearchSection title={isId ? 'Grup' : 'Groups'}>
          {results.groups.map(group => (
            <SearchGroupResult
              key={group.id}
              group={group}
              isId={isId}
              onOpenMembers={onOpenMembers}
              onChanged={onRefresh}
            />
          ))}
        </SearchSection>
      ) : null}

      {!loading && results && showPeople && results.people.length ? (
        <SearchSection title={isId ? 'Orang' : 'People'}>
          <div className="grid gap-2 sm:grid-cols-2">
            {results.people.map(person => (
              <SearchPersonResult key={person.id} person={person} />
            ))}
          </div>
        </SearchSection>
      ) : null}

      {!loading && showMarketplace ? (
        <SearchMarketplaceResult query={query} isId={isId} />
      ) : null}

      {!loading && results && showPosts && results.posts.length ? (
        <SearchSection title={isId ? 'Postingan terbaru' : 'Recent posts'}>
          <div className="space-y-3">
            {results.posts.map(item => (
              <CommunityPostCard
                key={item.id}
                item={item}
                isId={isId}
                onOpenDetail={onOpenThread}
              />
            ))}
          </div>
        </SearchSection>
      ) : null}
    </div>
  );
}

function LeftRail({
  isId,
  activeTab,
  onTabChange,
  overview,
  onCreateGroup,
  searchMode,
  searchKind,
  searchCounts,
  onSearchKindChange,
}: {
  isId: boolean;
  activeTab: CommunityFeedTab;
  onTabChange: (tab: CommunityFeedTab) => void;
  overview: CommunityFeedOverview | null;
  onCreateGroup: () => void;
  searchMode: boolean;
  searchKind: CommunitySearchKind;
  searchCounts?: CommunitySearchResponse['counts'];
  onSearchKindChange: (kind: CommunitySearchKind) => void;
}) {
  return (
    <aside className="hidden lg:block lg:h-full lg:min-h-0 lg:overflow-hidden px-2">
      <div
        className="flex h-full max-h-full min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pb-6 pr-1"
        data-auto-scrollbar
      >
        <section className="shrink-0 rounded-[24px] border border-[color:var(--app-border)] bg-white p-3.5 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
          <h1 className="text-[1.1rem] font-black tracking-[-0.035em] text-[color:var(--app-text)]">
            {searchMode
              ? isId
                ? 'Hasil pencarian'
                : 'Search results'
              : isId
                ? 'Komunitas'
                : 'Community'}
          </h1>
          <div className="mt-3 space-y-1">
            {searchMode
              ? SEARCH_TABS.map(tab => (
                  <SearchFilterButton
                    key={tab.id}
                    tab={tab}
                    isId={isId}
                    active={searchKind === tab.id}
                    count={searchCountFor(searchCounts, tab.id)}
                    onClick={() => onSearchKindChange(tab.id)}
                  />
                ))
              : TABS.map(tab => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onTabChange(tab.id)}
                      className={cn(
                        'flex min-h-[52px] w-full items-center gap-2.5 rounded-[14px] px-3 text-left',
                        active
                          ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                          : 'text-[color:var(--app-text-soft)] hover:bg-slate-50',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">
                          {isId ? tab.labelId : tab.labelEn}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] font-semibold opacity-75">
                          {isId ? tab.captionId : tab.captionEn}
                        </span>
                      </span>
                    </button>
                  );
                })}
          </div>
        </section>

        <section className="shrink-0 rounded-[24px] border border-[color:var(--app-border)] bg-white p-3.5 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-[color:var(--app-text)]">
              {isId ? 'Grup aktif' : 'Active groups'}
            </p>
            <button
              type="button"
              onClick={onCreateGroup}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]"
              aria-label={isId ? 'Buat grup' : 'Create group'}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 space-y-1.5">
            {(overview?.groups || []).slice(0, 6).map(group => (
              <Link
                key={group.id}
                href={communityGroupHref(group)}
                className="flex min-h-[46px] items-center gap-2 rounded-[14px] px-2 text-xs font-semibold text-[color:var(--app-text-soft)] hover:bg-slate-50"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-slate-50 text-[color:var(--app-accent)]">
                  <Users className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[color:var(--app-text)]">
                    {group.name}
                  </span>
                  <span className="block truncate text-[10px] font-medium text-[color:var(--app-text-soft)]">
                    {compactNumber(group.memberCount)}{' '}
                    {isId ? 'member' : 'members'}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function RightRail({
  isId,
  overview,
}: {
  isId: boolean;
  overview: CommunityFeedOverview | null;
}) {
  const trendingTags = overview?.trendingTags || [];
  const recommendedGroups = overview?.recommendedGroups || [];

  return (
    <aside className="hidden xl:block xl:h-full xl:min-h-0 xl:overflow-hidden">
      <div
        className="flex h-full max-h-full min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pb-6 pl-1"
        data-auto-scrollbar
      >
        <section className="shrink-0 rounded-[24px] border border-[color:var(--app-border)] bg-white p-3.5 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[color:var(--app-accent)]" />
            <h2 className="text-sm font-black text-[color:var(--app-text)]">
              {isId ? 'Sedang ramai' : 'Trending'}
            </h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {trendingTags.length ? (
              trendingTags.slice(0, 10).map(tag => (
                <Link
                  key={tag.id}
                  href={`/community?tag=${encodeURIComponent(tag.slug)}`}
                  className="rounded-full border border-[color:var(--app-border)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]"
                >
                  #{tag.slug}
                </Link>
              ))
            ) : (
              <p className="rounded-[16px] bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Tag ramai akan muncul setelah komunitas mulai aktif.'
                  : 'Trending tags will appear once the community is active.'}
              </p>
            )}
          </div>
        </section>

        <section className="shrink-0 rounded-[24px] border border-[color:var(--app-border)] bg-white p-3.5 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
          <h2 className="text-sm font-black text-[color:var(--app-text)]">
            {isId ? 'Rekomendasi grup' : 'Recommended groups'}
          </h2>
          <div className="mt-3 space-y-2">
            {recommendedGroups.length ? (
              recommendedGroups.slice(0, 4).map(group => (
                <Link
                  key={group.id}
                  href={communityGroupHref(group)}
                  className="flex items-center gap-2 rounded-[14px] p-2 hover:bg-slate-50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                    <Users className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-[color:var(--app-text)]">
                      {group.name}
                    </span>
                    <span className="block truncate text-[10px] text-[color:var(--app-text-soft)]">
                      {compactNumber(group.memberCount)} member
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <p className="rounded-[16px] bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Rekomendasi grup akan muncul setelah ada aktivitas.'
                  : 'Recommended groups will appear after more activity.'}
              </p>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}

export default function CommunityFeedClient({
  isId,
}: CommunityFeedClientProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<CommunityFeedTab>(
    readCommunityFeedTab(searchParams.get('tab')),
  );
  const [items, setItems] = useState<CommunityFeedItem[]>([]);
  const [overview, setOverview] = useState<CommunityFeedOverview | null>(null);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [submittedQuery, setSubmittedQuery] = useState(
    searchParams.get('q') || '',
  );
  const [searchKind, setSearchKind] = useState<CommunitySearchKind>(
    readCommunitySearchKind(
      searchParams.get('kind') || searchParams.get('scope'),
    ),
  );
  const [searchResults, setSearchResults] =
    useState<CommunitySearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [membersModalGroup, setMembersModalGroup] =
    useState<CommunityGroup | null>(null);
  const [dismissedThreadId, setDismissedThreadId] = useState<string | null>(
    null,
  );

  const avatar = readCommunityAvatar(user);
  const threadParam = searchParams.get('thread');
  const selectedThreadId =
    threadParam && threadParam !== dismissedThreadId ? threadParam : null;
  const selectedGroupParam =
    searchParams.get('group') || searchParams.get('category');
  const isSearchMode = submittedQuery.trim().length > 0;
  const activeGroup = useMemo(() => {
    if (!overview || !selectedGroupParam) return null;
    return (
      overview.groups.find(
        group =>
          group.id === selectedGroupParam ||
          group.slug === selectedGroupParam ||
          group.categoryId === selectedGroupParam,
      ) || null
    );
  }, [overview, selectedGroupParam]);
  const activeFeedTab = TABS.find(tab => tab.id === activeTab) || TABS[0]!;
  const emptyFeedTitle =
    activeTab === 'community'
      ? isId
        ? 'Belum ada diskusi grup yang cocok.'
        : 'No matching group discussions yet.'
      : isId
        ? 'Belum ada diskusi yang cocok.'
        : 'No matching discussions yet.';
  const emptyFeedDescription =
    activeTab === 'community'
      ? isId
        ? 'Topik dari grup bisnis akan muncul di sini.'
        : 'Business group threads will appear here.'
      : isId
        ? 'Pertanyaan dan update usaha akan muncul di sini.'
        : 'Business questions and updates will appear here.';

  useEffect(() => {
    let alive = true;
    const nextQuery = searchParams.get('q') || '';
    const nextKind = readCommunitySearchKind(
      searchParams.get('kind') || searchParams.get('scope'),
    );
    const nextTab = readCommunityFeedTab(searchParams.get('tab'));
    queueMicrotask(() => {
      if (!alive) return;
      setQuery(nextQuery);
      setSubmittedQuery(nextQuery);
      setSearchKind(nextKind);
      setActiveTab(nextTab);
    });
    return () => {
      alive = false;
    };
  }, [searchParams]);

  const feedUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    params.set('limit', '10');
    params.set('cursor', '0');
    params.set('_', String(refreshKey));
    if (submittedQuery.trim()) params.set('q', submittedQuery.trim());
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
    const thread = searchParams.get('thread');
    if (category) params.set('category', category);
    if (tag) params.set('tag', tag);
    if (thread) params.set('thread', thread);
    return `/api/community/feed?${params.toString()}`;
  }, [activeTab, searchParams, submittedQuery, refreshKey]);

  const searchUrl = useMemo(() => {
    const cleanQuery = submittedQuery.trim();
    if (!cleanQuery) return null;
    const params = new URLSearchParams();
    params.set('q', cleanQuery);
    params.set('kind', searchKind);
    params.set('limit', searchKind === 'all' ? '4' : '12');
    params.set('_', String(refreshKey));
    return `/api/community/search?${params.toString()}`;
  }, [submittedQuery, searchKind, refreshKey]);

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (alive) setLoading(true);
    });

    fetch(feedUrl, { cache: 'no-store', credentials: 'include' })
      .then(response => response.json())
      .then((payload: CommunityFeedResponse) => {
        if (!alive) return;
        setItems(communityDiscussionItems(payload.items));
        setOverview(payload.overview || null);
        setNextCursor(payload.nextCursor);
        setHasMore(Boolean(payload.hasMore));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [feedUrl]);

  useEffect(() => {
    if (!searchUrl) {
      let alive = true;
      queueMicrotask(() => {
        if (!alive) return;
        setSearchResults(null);
        setSearchLoading(false);
      });
      return () => {
        alive = false;
      };
    }

    let alive = true;
    queueMicrotask(() => {
      if (alive) setSearchLoading(true);
    });

    fetch(searchUrl, { cache: 'no-store', credentials: 'include' })
      .then(response => response.json())
      .then((payload: CommunitySearchResponse) => {
        if (!alive) return;
        setSearchResults(sanitizeCommunitySearchResults(payload));
      })
      .catch(() => {
        if (alive) setSearchResults(null);
      })
      .finally(() => {
        if (alive) setSearchLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [searchUrl]);

  const loadMore = async () => {
    if (!hasMore || nextCursor == null || loadingMore) return;
    setLoadingMore(true);
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    params.set('limit', '10');
    params.set('cursor', String(nextCursor));
    if (submittedQuery.trim()) params.set('q', submittedQuery.trim());
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
    if (category) params.set('category', category);
    if (tag) params.set('tag', tag);
    const response = await fetch(`/api/community/feed?${params.toString()}`, {
      cache: 'no-store',
      credentials: 'include',
    });
    const payload = (await response
      .json()
      .catch(() => ({}))) as Partial<CommunityFeedResponse>;
    setItems(current => {
      const existing = new Set(current.map(item => item.id));
      return [
        ...current,
        ...communityDiscussionItems(payload.items).filter(
          item => !existing.has(item.id),
        ),
      ];
    });
    setNextCursor(payload.nextCursor ?? null);
    setHasMore(Boolean(payload.hasMore));
    setLoadingMore(false);
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanQuery = query.trim();
    setSubmittedQuery(cleanQuery);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('thread');
    params.delete('compose');
    params.delete('category');
    params.delete('group');
    params.delete('tag');
    if (cleanQuery) {
      params.set('q', cleanQuery);
      if (searchKind === 'all') {
        params.delete('kind');
      } else {
        params.set('kind', searchKind);
      }
    } else {
      params.delete('q');
      params.delete('kind');
    }
    const queryString = params.toString();
    router.push(queryString ? `/community?${queryString}` : '/community');
  };

  const handleSearchKindChange = (nextKind: CommunitySearchKind) => {
    setSearchKind(nextKind);
    if (!submittedQuery.trim()) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('q', submittedQuery.trim());
    params.delete('thread');
    if (nextKind === 'all') {
      params.delete('kind');
    } else {
      params.set('kind', nextKind);
    }
    router.push(`/community?${params.toString()}`);
  };

  const openThreadDetail = (threadId: string) => {
    setDismissedThreadId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set('thread', threadId);
    router.push(`/community?${params.toString()}`);
  };

  const handleComposerCreated = (createdItem?: CommunityFeedItem) => {
    if (!createdItem) {
      setRefreshKey(value => value + 1);
      return;
    }

    setItems(current => [
      createdItem,
      ...current.filter(item => item.id !== createdItem.id),
    ]);
    setOverview(current =>
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
  };

  const closeThreadDetail = () => {
    if (threadParam) setDismissedThreadId(threadParam);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('thread');
    const queryString = params.toString();
    const cleanPath =
      (pathname || '/community').replace(/^\/(id|en)(?=\/|$)/, '') ||
      '/community';
    router.replace(queryString ? `${cleanPath}?${queryString}` : cleanPath);
  };

  return (
    <main className="lajukan-home-compact min-h-screen bg-[radial-gradient(circle_at_top,#eef9f1_0%,#f8fbff_34%,#f8fafc_100%)] px-1 pb-6 pt-3 sm:px-2 lg:h-[calc(100svh-(60px+env(safe-area-inset-top)))] lg:min-h-0 lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0">
      <div className="lajukan-home-shell mx-auto flex h-full flex-col lg:overflow-hidden">
        <div className="lajukan-home-desktop-grid relative z-0 mx-auto grid min-h-0 w-full max-w-[1700px] flex-1 gap-4 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_320px] 2xl:grid-cols-[280px_minmax(0,1fr)_340px]">
          <LeftRail
            isId={isId}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            overview={overview}
            onCreateGroup={() => setGroupModalOpen(true)}
            searchMode={isSearchMode}
            searchKind={searchKind}
            searchCounts={searchResults?.counts}
            onSearchKindChange={handleSearchKindChange}
          />

          <section
            className="min-w-0 space-y-3 pt-2 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1"
            data-auto-scrollbar
          >
            <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-[linear-gradient(135deg,#ffffff_0%,#f0fdf4_48%,#eff6ff_100%)] p-3.5 shadow-[0_20px_44px_-36px_rgba(15,23,42,0.25)] sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="inline-flex rounded-full bg-white/82 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)] ring-1 ring-emerald-100">
                    {isId ? 'Forum Lajukan' : 'Lajukan Forum'}
                  </p>
                  <h1 className="mt-2 text-[1.28rem] font-black tracking-[-0.045em] text-[color:var(--app-text)] sm:text-[1.55rem]">
                    {isId ? 'Komunitas Usaha' : 'Business Community'}
                  </h1>
                  {!isSearchMode ? (
                    <p className="mt-1 max-w-xl text-sm font-semibold leading-6 text-[color:var(--app-text-soft)]">
                      {isId ? activeFeedTab.captionId : activeFeedTab.captionEn}
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:min-w-[260px]">
                  {[
                    {
                      label: isId ? 'Diskusi' : 'Threads',
                      value: overview?.stats.totalThreads,
                    },
                    {
                      label: isId ? 'Jawaban' : 'Replies',
                      value: overview?.stats.totalPosts,
                    },
                    {
                      label: isId ? 'Member' : 'Members',
                      value: overview?.stats.totalUsers,
                    },
                  ].map(item => (
                    <div
                      key={item.label}
                      className="rounded-[16px] bg-white/88 px-2.5 py-2 text-center ring-1 ring-emerald-100"
                    >
                      <span className="block text-sm font-black text-[color:var(--app-text)]">
                        {compactNumber(item.value)}
                      </span>
                      <span className="block truncate text-[10px] font-bold text-[color:var(--app-text-soft)]">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <form
                onSubmit={handleSearch}
                className="mt-3 flex min-h-[46px] items-center gap-2 rounded-full bg-white/90 px-3 ring-1 ring-emerald-100"
              >
                <Search className="h-4 w-4 text-[color:var(--app-text-soft)]" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={
                    isId
                      ? 'Cari diskusi atau grup...'
                      : 'Search discussions or groups...'
                  }
                  className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--app-text)] outline-none"
                />
                <button
                  type="submit"
                  className="rounded-full bg-[color:var(--app-accent)] px-3 py-1.5 text-[11px] font-bold text-white"
                >
                  {isId ? 'Cari' : 'Search'}
                </button>
              </form>

              {isSearchMode ? (
                <div
                  className="mt-3 flex gap-2 overflow-x-auto pb-1.5 lg:hidden"
                  data-auto-scrollbar
                >
                  {SEARCH_TABS.map(tab => (
                    <SearchFilterButton
                      key={tab.id}
                      tab={tab}
                      isId={isId}
                      active={searchKind === tab.id}
                      count={searchCountFor(searchResults?.counts, tab.id)}
                      onClick={() => handleSearchKindChange(tab.id)}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="mt-3 flex items-center gap-2 overflow-x-auto pb-1.5"
                  data-auto-scrollbar
                >
                  {TABS.map(tab => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          'relative flex min-h-[46px] min-w-[118px] shrink-0 flex-col justify-center rounded-[15px] border px-3 text-left transition',
                          active
                            ? 'border-[color:var(--app-accent)] bg-white text-[color:var(--app-accent)] shadow-[0_14px_26px_-24px_rgba(4,120,87,0.6)]'
                            : 'border-white/70 bg-white/72 text-[color:var(--app-text-soft)] hover:bg-white',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-1.5 text-xs font-black">
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {isId ? tab.labelId : tab.labelEn}
                          </span>
                        </span>
                        <span className="mt-0.5 line-clamp-1 text-[10px] font-semibold leading-3 opacity-75">
                          {isId ? tab.captionId : tab.captionEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {isSearchMode ? (
              <CommunitySearchPanel
                isId={isId}
                query={submittedQuery.trim()}
                kind={searchKind}
                results={searchResults}
                loading={searchLoading}
                onOpenThread={openThreadDetail}
                onOpenMembers={setMembersModalGroup}
                onRefresh={() => setRefreshKey(value => value + 1)}
              />
            ) : (
              <>
                <GroupStrip
                  isId={isId}
                  overview={overview}
                  onChanged={() => setRefreshKey(value => value + 1)}
                  onCreateGroup={() => setGroupModalOpen(true)}
                  onOpenMembers={setMembersModalGroup}
                />

                <GroupDetailPanel
                  group={activeGroup}
                  isId={isId}
                  onOpenMembers={setMembersModalGroup}
                />

                <CommunityComposer
                  isId={isId}
                  userAvatar={avatar}
                  isAuthenticated={isAuthenticated}
                  overview={overview}
                  onCreated={handleComposerCreated}
                />

                {loading ? <CommunityFeedSkeleton /> : null}
                {!loading && items.length === 0 ? (
                  <section className="overflow-hidden rounded-[24px] border border-emerald-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_54%,#eff6ff_100%)] p-5 text-center shadow-[0_20px_40px_-32px_rgba(15,23,42,0.22)]">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[color:var(--app-accent)] shadow-[0_16px_30px_-24px_rgba(15,23,42,0.3)] ring-1 ring-emerald-100">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-base font-black text-[color:var(--app-text)]">
                      {emptyFeedTitle}
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[color:var(--app-text-soft)]">
                      {emptyFeedDescription}
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push('/community?compose=post')}
                      className="mt-4 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-[color:var(--app-accent-strong)] px-4 text-sm font-black text-white shadow-[0_18px_30px_-22px_rgba(16,185,129,0.9)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_34px_-24px_rgba(16,185,129,0.95)]"
                    >
                      <Plus className="h-4 w-4" />
                      {isId ? 'Mulai diskusi' : 'Start a discussion'}
                    </button>
                  </section>
                ) : null}

                <div className="space-y-3">
                  {items.map(item => (
                    <CommunityPostCard
                      key={item.id}
                      item={item}
                      isId={isId}
                      onOpenDetail={openThreadDetail}
                    />
                  ))}
                </div>

                {hasMore ? (
                  <div className="flex justify-center py-2">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-[color:var(--app-border)] bg-white px-4 text-sm font-semibold text-[color:var(--app-text)] disabled:opacity-60"
                    >
                      {loadingMore ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {isId ? 'Muat lagi' : 'Load more'}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <RightRail isId={isId} overview={overview} />
        </div>
      </div>
      <CommunityDetailModal
        isId={isId}
        threadId={selectedThreadId}
        onClose={closeThreadDetail}
        onChanged={() => setRefreshKey(value => value + 1)}
      />
      <GroupCreateModal
        isId={isId}
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        onCreated={() => setRefreshKey(value => value + 1)}
      />
      <GroupMembersModal
        group={membersModalGroup}
        isId={isId}
        onClose={() => setMembersModalGroup(null)}
        onChanged={() => setRefreshKey(value => value + 1)}
      />
    </main>
  );
}
