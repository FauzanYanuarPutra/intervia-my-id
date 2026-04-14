import { NextResponse } from 'next/server';
import { getForumStore } from '@/lib/forum/store';
import { enrichThread, getTrendingTags, syncForumDerivedState } from '@/lib/forum/queries';

export async function GET() {
  const store = getForumStore();
  syncForumDerivedState(store);

  const totalThreads = store.threads.length;
  const totalPosts = store.posts.length;
  const totalUsers = store.users.length;

  const trendingTags = getTrendingTags(store, 8);

  const featuredThreads = [...store.threads]
    .sort((a, b) => {
      const scoreA = a.replyCount * 2 + a.views + a.likeCount * 8;
      const scoreB = b.replyCount * 2 + b.views + b.likeCount * 8;
      return scoreB - scoreA;
    })
    .slice(0, 6)
    .map(thread =>
      enrichThread(thread, store.users, store.categories, store.tags, store.votes),
    );

  const topContributors = [...store.users]
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 8);

  return NextResponse.json({
    stats: {
      totalThreads,
      totalPosts,
      totalUsers,
    },
    trendingTags,
    featuredThreads,
    topContributors,
  });
}

