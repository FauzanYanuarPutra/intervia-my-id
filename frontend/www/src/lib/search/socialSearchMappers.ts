import type { GlobalSearchItem } from '@/lib/search/globalSearch';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function readString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = readString(value);
    if (text) return text;
  }
  return '';
}

function firstImage(item: JsonRecord): string | null {
  const media = asRecord(item.media);
  const group = asRecord(item.group);
  const direct = firstString(
    item.cover_image,
    item.coverUrl,
    item.image,
    item.image_url,
    item.imageUrl,
    item.thumbnail_url,
    item.thumbnailUrl,
    item.avatar_url,
    item.avatarUrl,
    media?.src,
    group?.coverUrl,
    group?.cover_url,
  );
  if (direct) return direct;

  for (const candidate of [item.image_urls, item.imageUrls, item.images]) {
    if (!Array.isArray(candidate)) continue;
    const image = candidate.map(readString).find(Boolean);
    if (image) return image;
  }

  return null;
}

export function mapCommunityGroup(item: JsonRecord): GlobalSearchItem | null {
  const id = readString(item.id);
  if (!id) return null;
  const slug = firstString(item.slug, id);

  return {
    id,
    kind: 'communities',
    title: firstString(item.name, item.title, 'Komunitas'),
    summary: firstString(item.description, item.body),
    href: `/community/groups/${encodeURIComponent(slug)}`,
    image: firstImage(item),
    label: firstString(item.privacy, 'Komunitas'),
    location: firstString(item.location),
    priceLabel: '',
    ownerName: '',
    verified: false,
    side: null,
    memberCount: readNumber(item.memberCount) ?? readNumber(item.member_count),
    viewCount: null,
    durationLabel: '',
    metadata: {
      entityType: 'group',
      privacy: firstString(item.privacy, 'public'),
      postCount: readNumber(item.postCount) ?? readNumber(item.post_count),
    },
  };
}

export function mapCommunityPost(item: JsonRecord): GlobalSearchItem | null {
  const id = firstString(item.id, item.threadId, item.thread_id);
  if (!id) return null;
  const author = asRecord(item.author);
  const group = asRecord(item.group);
  const stats = asRecord(item.stats);

  return {
    id,
    kind: 'communities',
    title: firstString(item.title, item.body, 'Diskusi komunitas'),
    summary: firstString(item.body),
    href: firstString(item.href, `/community?thread=${encodeURIComponent(id)}`),
    image: firstImage(item),
    label: firstString(
      item.communityName,
      item.community_name,
      group?.name,
      'Diskusi',
    ),
    location: '',
    priceLabel: '',
    ownerName: firstString(author?.name, author?.username),
    verified: false,
    side: null,
    memberCount: null,
    viewCount: readNumber(stats?.views) ?? readNumber(item.views),
    durationLabel: '',
    metadata: {
      entityType: 'discussion',
      privacy: firstString(group?.privacy, 'public'),
      createdAt: firstString(item.createdAt, item.created_at),
      comments:
        readNumber(stats?.comments) ??
        readNumber(item.replyCount) ??
        readNumber(item.reply_count),
    },
  };
}

export function mapVideo(item: JsonRecord): GlobalSearchItem | null {
  const id = firstString(item.id, item.reelId, item.reel_id);
  if (!id) return null;
  const author = asRecord(item.author) || asRecord(item.creator);
  const media = asRecord(item.media);

  return {
    id,
    kind: 'videos',
    title: firstString(item.title, item.caption, item.body, 'Video Lajukan'),
    summary: firstString(item.caption, item.body),
    href: firstString(item.href, `/reels?video=${encodeURIComponent(id)}`),
    image:
      firstString(
        item.thumbnail_url,
        item.thumbnailUrl,
        item.poster_url,
        item.posterUrl,
        item.media_url,
        item.mediaUrl,
        item.source_url,
        item.sourceUrl,
        item.video_src,
        item.videoSrc,
        media?.src,
        firstImage(item),
      ) || null,
    label: 'Video',
    location: '',
    priceLabel: '',
    ownerName: firstString(
      author?.name,
      author?.username,
      item.creatorName,
      item.creator,
    ),
    verified: false,
    side: null,
    memberCount: null,
    viewCount:
      readNumber(item.view_count) ??
      readNumber(item.viewCount) ??
      readNumber(asRecord(item.stats)?.views),
    durationLabel: firstString(
      item.duration_label,
      item.durationLabel,
      item.duration,
    ),
    metadata: {
      entityType: 'video',
      createdAt: firstString(item.createdAt, item.created_at),
    },
  };
}
