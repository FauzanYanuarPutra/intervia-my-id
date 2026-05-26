export type CommunityFeedTab = 'for-you' | 'following' | 'community' | 'reels';
export type CommunitySearchKind = 'all' | 'posts' | 'people' | 'reels' | 'marketplace' | 'groups';

export type CommunityFeedMedia = {
  type: 'image' | 'video';
  src: string;
  alt: string;
  sourceUrl?: string;
};

export type CommunityFeedAuthor = {
  id: string;
  name: string;
  title: string;
  avatarUrl: string;
  reputation?: number;
};

export type CommunityFeedCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  threadCount?: number;
  postCount?: number;
};

export type CommunityGroup = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  privacy: 'public' | 'private' | 'hidden';
  postingPermission: 'public' | 'member' | 'moderator';
  membershipPermission: 'open' | 'approval' | 'invite';
  coverUrl?: string | null;
  rules: string[];
  memberCount: number;
  postCount: number;
  viewerRole?: 'owner' | 'moderator' | 'member' | null;
  viewerMembershipStatus?: 'active' | 'pending' | 'blocked' | null;
  viewerCanPost: boolean;
  viewerCanManage: boolean;
};

export type CommunityGroupMember = {
  groupId: string;
  userId: string;
  role: 'owner' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'blocked';
  notificationsEnabled: boolean;
  joinedAt: string;
  updatedAt: string;
  username: string;
  name: string;
  avatarUrl: string;
  title: string;
  reputation: number;
  badges: string[];
};

export type CommunityGroupMembersResponse = {
  data: CommunityGroupMember[];
  total: number;
  admins: CommunityGroupMember[];
  moderators: CommunityGroupMember[];
};

export type CommunityFeedTag = {
  id: string;
  name: string;
  slug: string;
  usageCount?: number;
  color?: string;
};

export type CommunityFeedItem = {
  id: string;
  kind: 'discussion' | 'reel';
  threadId?: string;
  postId?: string;
  href: string;
  title: string;
  body: string;
  communityName: string;
  createdAt: string;
  author: CommunityFeedAuthor;
  category?: CommunityFeedCategory | null;
  group?: CommunityGroup | null;
  tags: CommunityFeedTag[];
  media?: CommunityFeedMedia | null;
  stats: {
    reactions: number;
    comments: number;
    shares: number;
    views?: number;
  };
  viewerVote?: -1 | 0 | 1;
  isPinned?: boolean;
  isSolved?: boolean;
};

export type CommunityFeedOverview = {
  stats: {
    totalThreads: number;
    totalPosts: number;
    totalUsers: number;
  };
  categories: CommunityFeedCategory[];
  groups: CommunityGroup[];
  recommendedGroups: CommunityGroup[];
  joinedGroups: CommunityGroup[];
  trendingTags: CommunityFeedTag[];
  topContributors: CommunityFeedAuthor[];
};

export type CommunityFeedResponse = {
  items: CommunityFeedItem[];
  overview: CommunityFeedOverview;
  nextCursor: number | null;
  hasMore: boolean;
};

export type CommunitySearchResponse = {
  query: string;
  kind: CommunitySearchKind;
  posts: CommunityFeedItem[];
  groups: CommunityGroup[];
  people: CommunityFeedAuthor[];
  reels: CommunityFeedItem[];
  counts: {
    all: number;
    posts: number;
    people: number;
    reels: number;
    marketplace: number;
    groups: number;
  };
};
