import { NextRequest, NextResponse } from 'next/server';
import { getForumStore } from '@/lib/forum/store';
import { enrichPost, enrichThread, syncForumDerivedState } from '@/lib/forum/queries';

export async function GET(req: NextRequest) {
  const store = getForumStore();
  syncForumDerivedState(store);

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();

  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: 'q is required (min 2 chars)' },
      { status: 400 },
    );
  }

  const threads = store.threads
    .filter(thread => {
      const author = store.users.find(user => user.id === thread.authorId)?.name || '';
      const category = store.categories.find(item => item.id === thread.categoryId)?.name || '';
      const tags = thread.tags.join(' ');

      const rootPost = store.posts.find(
        post => post.threadId === thread.id && !post.replyToPostId,
      )?.content;

      const haystack = [thread.title, author, category, tags, rootPost || '']
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    })
    .slice(0, 20)
    .map(thread =>
      enrichThread(thread, store.users, store.categories, store.tags, store.votes),
    );

  const posts = store.posts
    .filter(post => post.content.toLowerCase().includes(q))
    .slice(0, 30)
    .map(post => enrichPost(post, store.users, store.votes));

  return NextResponse.json({
    threads,
    posts,
  });
}

