import type {
  CommunityFeedCategory,
  CommunityFeedItem,
  CommunityFeedTag,
} from '@/lib/community/types';

export type CommunityFeedClientProps = {
  isId: boolean;
};

export type ComposeMode = 'question' | 'post' | 'photo' | 'poll' | 'feeling';

export type ForumThreadDetail = {
  id: string;
  title: string;
  createdAt: string;
  views: number;
  replyCount: number;
  likeCount?: number;
  bookmarkCount?: number;
  voteScore?: number;
  viewerVote?: -1 | 0 | 1;
  author: CommunityFeedItem['author'] | null;
  category: CommunityFeedCategory | null;
  tags: CommunityFeedTag[];
  imageUrls?: string[];
  isPinned?: boolean;
  isSolved?: boolean;
  solutionPostId?: string | null;
};

export type ForumPostDetail = {
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
  isAnswer?: boolean;
};

export type ForumPostsResponse = {
  data?: ForumPostDetail[];
};

export type CreatedPostPayload = {
  post?: ForumPostDetail;
  error?: string;
};

export type CreatedThreadPayload = {
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

export type PollOptionVoteStat = {
  optionIndex: number;
  votes: number;
  viewerVoted?: boolean;
};

export type PollVoteResponse = {
  threadId: string;
  totalVotes: number;
  viewerOptionIndex?: number | null;
  options: PollOptionVoteStat[];
  error?: string;
};
