import {
  isPreviewableContentMediaUrl,
  normalizeContentMediaUrl,
} from '@/lib/content/catalog';
import type {
  CommunityFeedItem,
  CommunityFeedMedia,
  CommunityFeedTab,
  CommunityFeedTag,
  CommunityGroup,
  CommunityGroupMember,
  CommunitySearchKind,
  CommunitySearchResponse,
} from '@/lib/community/types';

export type ParsedPoll = {
  question: string;
  body: string;
  options: string[];
};

type CommunitySearchPayload = Omit<Partial<CommunitySearchResponse>, 'kind'> & {
  kind?: string | null;
};

export function resolveCommunityMediaSrc(value?: string | null): string {
  const clean = normalizeContentMediaUrl(String(value || '').trim());
  if (!clean) return '';
  if (isCommunityPlaceholderMedia(clean)) return '';
  if (!isPreviewableContentMediaUrl(clean)) return '';
  return clean;
}

export function readUploadedCommunityMediaUrl(payload: unknown): string {
  const data =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : {};
  const dataFile =
    data.data && typeof data.data === 'object'
      ? (data.data as Record<string, unknown>)
      : null;
  const files = Array.isArray(data.files) ? data.files : [];
  const urls = Array.isArray(data.urls) ? data.urls : [];
  const candidates = [
    urls[0],
    dataFile?.url,
    files[0] && typeof files[0] === 'object'
      ? (files[0] as Record<string, unknown>).url
      : null,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const resolved = resolveCommunityMediaSrc(candidate);
    if (resolved) return resolved;
  }

  return '';
}

export function isCommunityPlaceholderMedia(value?: string | null): boolean {
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

export function firstCommunityMediaUrl(
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

export function normalizeCommunityMediaItems(
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

export function getFeedMediaItems(item: CommunityFeedItem): CommunityFeedMedia[] {
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

export function readCommunitySearchKind(value: string | null): CommunitySearchKind {
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

export function readCommunityFeedTab(value: string | null): CommunityFeedTab {
  const next = (value || '').toLowerCase();
  if (next === 'community' || next === 'communities' || next === 'komunitas')
    return 'community';
  return 'for-you';
}

export function searchCountFor(
  counts: CommunitySearchResponse['counts'] | undefined,
  kind: CommunitySearchKind,
) {
  return counts?.[kind] || 0;
}

export function compactNumber(value: number | undefined) {
  const safe = Math.max(Number(value || 0), 0);
  if (safe >= 1_000_000)
    return `${(safe / 1_000_000).toFixed(safe >= 10_000_000 ? 0 : 1)}M`;
  if (safe >= 1_000)
    return `${(safe / 1_000).toFixed(safe >= 10_000 ? 0 : 1)}K`;
  return safe.toString();
}

export function communityDiscussionItems(items?: CommunityFeedItem[]) {
  return (items || []).filter(item => item.kind !== 'reel');
}

export function pollVoteUrl(threadId: string) {
  return `/api/forum/threads/${encodeURIComponent(threadId)}/poll-vote`;
}

export function parseCommunityPoll(
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

export function sanitizeCommunitySearchResults(
  payload: CommunitySearchPayload,
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

export function isVideoMedia(src: string) {
  return /\.(mp4|webm|mov|m4v|ogv|ogg|3gp)([?#].*)?$/i.test(src);
}

export function timeAgo(value: string, isId: boolean) {
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

export function groupRoleLabel(
  role: CommunityGroupMember['role'] | CommunityGroup['viewerRole'],
  isId: boolean,
) {
  if (role === 'owner') return isId ? 'Admin' : 'Admin';
  if (role === 'moderator') return isId ? 'Moderator' : 'Moderator';
  return isId ? 'Member' : 'Member';
}

export function groupPrivacyLabel(group: CommunityGroup, isId: boolean) {
  if (group.privacy === 'hidden') return isId ? 'Tersembunyi' : 'Hidden';
  if (group.privacy === 'private') return isId ? 'Privat' : 'Private';
  return isId ? 'Publik' : 'Public';
}

export function groupJoinLabel(group: CommunityGroup, isId: boolean) {
  if (group.membershipPermission === 'approval')
    return isId ? 'Perlu approval' : 'Approval required';
  if (group.membershipPermission === 'invite')
    return isId ? 'Undangan saja' : 'Invite only';
  return isId ? 'Langsung join' : 'Open join';
}

export function groupPostLabel(group: CommunityGroup, isId: boolean) {
  if (group.postingPermission === 'moderator')
    return isId ? 'Hanya admin/moderator' : 'Admins/moderators only';
  if (group.postingPermission === 'member')
    return isId ? 'Member aktif' : 'Active members';
  return isId ? 'Semua orang' : 'Everyone';
}

export function composeErrorMessage(error: unknown, isId: boolean) {
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

export function communityGroupHref(
  groupOrSlug: Pick<CommunityGroup, 'slug'> | string,
) {
  const slug = typeof groupOrSlug === 'string' ? groupOrSlug : groupOrSlug.slug;
  return `/community/groups/${encodeURIComponent(slug)}`;
}

export function buildLoginHref(pathname: string | null, search: string) {
  const current = `${pathname || '/community'}${search ? `?${search}` : ''}`;
  return `/login?callbackUrl=${encodeURIComponent(current)}`;
}

