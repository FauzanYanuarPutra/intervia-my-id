import type { LajukanReel } from '../../_data/reels';
import type { SocialUser } from '@/components/profile/profile-hub/types/profileSocial';

export type ReelsClientProps = {
  locale: string;
  initialIndex: number;
  initialItems: LajukanReel[];
  initialCursor: number | null;
  initialHasMore: boolean;
  initialSearchQuery: string;
  initialUploadOpen?: boolean;
};

export type ReelsSignal = 'watch' | 'share' | 'detail' | 'product' | 'store';
export type ReelUserAction = 'like' | 'save' | 'follow';

export type ReelActionState = {
  liked: boolean;
  saved: boolean;
  followed: boolean;
  loading?: ReelUserAction | null;
};

export type ReelComment = {
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

export type ReelCommentsBucket = {
  items: ReelComment[];
  cursor: number | null;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

export type ReelVisibility = 'public' | 'followers' | 'private';
export type ReelContentGoal =
  | 'discover'
  | 'product'
  | 'education'
  | 'promo'
  | 'process';

export type UploadReelForm = {
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

export type UploadReelStep = 'media' | 'edit' | 'post';

export type ReelStoreOption = {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  phone?: string | null;
};

export type ReelsFeedTab = 'fyp' | 'friends' | 'following';
export type ReelsStudioMode = 'gallery' | 'photo' | 'video' | 'link' | 'live';
export type ReelsStudioPanel =
  | 'filters'
  | 'effects'
  | 'music'
  | 'speed'
  | 'link'
  | null;
export type ReelsStudioFacingMode = 'environment' | 'user';

export type ShareSheetRecipient = SocialUser & {
  source: 'creator' | 'following' | 'suggested';
  linked: boolean;
};
