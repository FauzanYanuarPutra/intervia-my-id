'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { ArrowRight, MessageSquarePlus, Search, Send, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/system/feedback/ToastProvider';
import { isPreviewableContentMediaUrl, normalizeContentMediaUrl } from '@/lib/content/catalog';

type Cat = { id: string; name: string; slug: string; description: string; threadCount: number; postCount: number };
type Tag = { id: string; name: string; slug: string; usageCount: number; color?: string };
type User = { id: string; name: string; title: string; avatarUrl: string; reputation: number };
type Thread = {
  id: string; title: string; createdAt: string; lastActivityAt: string; replyCount: number; views: number;
  voteScore: number; status: string; isSolved: boolean; author: User | null; category: Cat | null; tags: Tag[];
};
type Post = { id: string; content: string; createdAt: string; replyToPostId?: string | null; isAnswer: boolean; author: User | null; imageUrls?: string[] };
type Overview = { stats: { totalThreads: number; totalPosts: number; totalUsers: number }; trendingTags: Tag[]; featuredThreads: Thread[] };

const fmtTime = (value: string, isId: boolean) => new Intl.DateTimeFormat(isId ? 'id-ID' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const plain = (value?: string | null) => (value || '').replace(/[#>*_`-]/g, '').trim();
const forumImageSrc = (value?: string | null) => {
  const normalized = normalizeContentMediaUrl(value || '');
  return isPreviewableContentMediaUrl(normalized) ? normalized : '';
};

export default function ForumHubClient({ isId }: { isId: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { authFetch, user } = useAuth();
  const { notify } = useToast();
  const search = searchParams.toString();
  const qParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const tagParam = searchParams.get('tag') || '';
  const threadParam = searchParams.get('thread') || '';
  const loginHref = `/login?callbackUrl=${encodeURIComponent(`${pathname}${search ? `?${search}` : ''}`)}`;
  const [query, setQuery] = useState(qParam);
  const [category, setCategory] = useState(categoryParam);
  const [sort, setSort] = useState(searchParams.get('sort') || 'hot');
  const [composerOpen, setComposerOpen] = useState(searchParams.get('compose') === '1');
  const [title, setTitle] = useState(searchParams.get('title') || '');
  const [body, setBody] = useState(searchParams.get('content') || '');
  const [composerCategory, setComposerCategory] = useState(categoryParam);
  const [composerTag, setComposerTag] = useState(tagParam);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState(threadParam);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingThread, setSavingThread] = useState(false);
  const [savingReply, setSavingReply] = useState(false);
  const [reply, setReply] = useState('');
  const storeHint = searchParams.get('store') || '';
  const activeThread = useMemo(() => threads.find(item => item.id === threadId) || null, [threadId, threads]);

  const replaceParams = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const openThread = (nextId: string) => {
    setDetailLoading(true);
    setPosts([]);
    setThreadId(nextId);
    replaceParams(params => params.set('thread', nextId));
  };

  useEffect(() => {
    void Promise.all([
      fetch('/api/forum/overview', { cache: 'no-store' }).then(res => res.json()),
      fetch('/api/forum/categories', { cache: 'no-store' }).then(res => res.json()),
      fetch('/api/forum/tags?popular=1', { cache: 'no-store' }).then(res => res.json()),
    ]).then(([overviewRes, categoryRes, tagRes]) => {
      setOverview(overviewRes);
      setCategories(categoryRes.data || []);
      setTags(tagRes.data || []);
    });
  }, []);


  useEffect(() => {
    let alive = true;

    const params = new URLSearchParams();
    if (qParam) params.set('q', qParam);
    if (categoryParam) params.set('category', categoryParam);
    if (tagParam) params.set('tag', tagParam);
    params.set('sort', sort || 'hot');
    params.set('page_size', '24');
    fetch(`/api/forum/threads?${params.toString()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(payload => {
        if (!alive) return;
        const nextThreads = payload.data || [];
        setThreads(nextThreads);
        const requested = threadParam;
        const fallback = requested && nextThreads.some((item: Thread) => item.id === requested)
          ? requested
          : nextThreads[0]?.id || '';
        setThreadId(current => (current && nextThreads.some((item: Thread) => item.id === current) ? current : fallback));
        if (!fallback) setPosts([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [categoryParam, qParam, search, sort, tagParam, threadParam]);

  useEffect(() => {
    if (!threadId) return;
    let alive = true;
    fetch(`/api/forum/threads/${encodeURIComponent(threadId)}/posts?page_size=60&sort=oldest`, { cache: 'no-store' })
      .then(res => res.json())
      .then(payload => {
        if (alive) setPosts(payload.data || []);
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [threadId]);

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setPosts([]);
    replaceParams(params => {
      if (query) { params.set('q', query); } else { params.delete('q'); }
      if (category) { params.set('category', category); } else { params.delete('category'); }
      if (sort) { params.set('sort', sort); } else { params.delete('sort'); }
      params.delete('thread');
    });
  };

  const submitThread = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return router.push(loginHref);
    setSavingThread(true);
    const res = await authFetch('/api/forum/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        content: body,
        category: composerCategory || categories[0]?.slug || '',
        tags: composerTag ? [composerTag] : [],
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setSavingThread(false);
    if (!res.ok) {
      notify({ title: isId ? 'Topik gagal diposting' : 'Failed to create topic', description: payload.error || '', variant: 'error' });
      return;
    }
    notify({ title: isId ? 'Topik berhasil diposting' : 'Topic published', variant: 'success' });
    setTitle('');
    setBody('');
    setComposerOpen(false);

    setPosts([]);
    replaceParams(params => {
      params.delete('compose');
      params.delete('title');
      params.delete('content');
      params.set('thread', payload.thread.id);
    });
    setThreads(current => [payload.thread, ...current]);
    setThreadId(payload.thread.id);
  };

  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!threadId) return;
    if (!user) return router.push(loginHref);
    setSavingReply(true);
    const res = await authFetch(`/api/forum/threads/${encodeURIComponent(threadId)}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: reply }),
    });
    const payload = await res.json().catch(() => ({}));
    setSavingReply(false);
    if (!res.ok) {
      notify({ title: isId ? 'Balasan gagal dikirim' : 'Reply failed', description: payload.error || '', variant: 'error' });
      return;
    }
    notify({ title: isId ? 'Balasan terkirim' : 'Reply posted', variant: 'success' });
    setReply('');
    setPosts(current => [...current, payload.post]);
    setThreads(current => current.map(item => item.id === threadId ? { ...item, replyCount: item.replyCount + 1, lastActivityAt: payload.post.createdAt } : item));
  };

  return (
    <main className="page-shell page-rhythm py-8">
      <section className="ui-panel ui-hero-panel rounded-3xl p-6">
        <p className="ui-kicker">
          <Sparkles className="h-3.5 w-3.5" />
          {isId ? 'Komunitas usaha UMKM' : 'UMKM business community'}
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-black tracking-tight text-[color:var(--app-text)]">
              {storeHint
                ? isId
                  ? `Komunitas bisnis untuk ${storeHint}`
                  : `Business community for ${storeHint}`
                : isId
                  ? 'Diskusi supplier, operasional, dan channel jual di sini'
                  : 'Discuss suppliers, operations, and sales channels here'}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Diskusi yang bikin usaha lebih rapi.'
                : 'Not a random timeline. This community is for practical questions that improve execution and revenue.'}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="ui-panel-muted rounded-2xl border border-[color:var(--app-border)] px-4 py-3 text-sm"><span className="block font-black text-[color:var(--app-text)]">{overview?.stats.totalThreads || 0}</span>{isId ? 'topik' : 'topics'}</div>
            <div className="ui-panel-muted rounded-2xl border border-[color:var(--app-border)] px-4 py-3 text-sm"><span className="block font-black text-[color:var(--app-text)]">{overview?.stats.totalPosts || 0}</span>{isId ? 'balasan' : 'posts'}</div>
            <div className="ui-panel-muted rounded-2xl border border-[color:var(--app-border)] px-4 py-3 text-sm"><span className="block font-black text-[color:var(--app-text)]">{overview?.stats.totalUsers || 0}</span>{isId ? 'kontributor' : 'contributors'}</div>
          </div>
        </div>
        {overview?.trendingTags?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {overview.trendingTags.slice(0, 8).map(tag => (
              <button key={tag.id} type="button" onClick={() => { setComposerTag(tag.slug); replaceParams(params => params.set('tag', tag.slug)); }} className="ui-inline-meta ui-border text-[11px]">
                #{tag.slug}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="space-y-4">
          <form onSubmit={submitFilters} className="ui-panel rounded-3xl p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_220px_150px_auto]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[color:var(--app-text-soft)]" />
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder={isId ? 'Cari supplier, SOP, channel jual...' : 'Search suppliers, SOPs, channels...'} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-white px-10 py-3 text-sm text-[color:var(--app-text)]" />
              </label>
              <select value={category} onChange={event => setCategory(event.target.value)} className="rounded-2xl border border-[color:var(--app-border)] bg-white px-3 py-3 text-sm text-[color:var(--app-text)]">
                <option value="">{isId ? 'Semua kategori' : 'All categories'}</option>
                {categories.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}
              </select>
              <select value={sort} onChange={event => setSort(event.target.value)} className="rounded-2xl border border-[color:var(--app-border)] bg-white px-3 py-3 text-sm text-[color:var(--app-text)]">
                <option value="hot">{isId ? 'Paling hangat' : 'Hot'}</option>
                <option value="active">{isId ? 'Paling aktif' : 'Active'}</option>
                <option value="new">{isId ? 'Terbaru' : 'Newest'}</option>
              </select>
              <button type="submit" className="ui-button-primary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold">
                <ArrowRight className="h-4 w-4" />
                {isId ? 'Terapkan' : 'Apply'}
              </button>
            </div>
          </form>

          <section className="ui-panel rounded-3xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[color:var(--app-text)]">{isId ? 'Topik aktif' : 'Active topics'}</h2>
                <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">{isId ? 'Buka topik, balas.' : 'Open a topic to read details and reply.'}</p>
              </div>
              <button type="button" onClick={() => setComposerOpen(value => !value)} className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold">
                <MessageSquarePlus className="h-4 w-4" />
                {composerOpen ? (isId ? 'Tutup composer' : 'Close composer') : (isId ? 'Buat topik' : 'New topic')}
              </button>
            </div>
            {composerOpen ? (
              <form onSubmit={submitThread} className="mt-4 space-y-3 rounded-3xl border border-[color:var(--app-border)] p-4">
                <input value={title} onChange={event => setTitle(event.target.value)} placeholder={isId ? 'Judul topik yang jelas' : 'Clear topic title'} className="w-full rounded-2xl border border-[color:var(--app-border)] px-3 py-3 text-sm text-[color:var(--app-text)]" />
                <div className="grid gap-3 md:grid-cols-2">
                  <select value={composerCategory} onChange={event => setComposerCategory(event.target.value)} className="rounded-2xl border border-[color:var(--app-border)] px-3 py-3 text-sm text-[color:var(--app-text)]">
                    {categories.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}
                  </select>
                  <select value={composerTag} onChange={event => setComposerTag(event.target.value)} className="rounded-2xl border border-[color:var(--app-border)] px-3 py-3 text-sm text-[color:var(--app-text)]">
                    <option value="">{isId ? 'Tanpa tag' : 'No tag'}</option>
                    {tags.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}
                  </select>
                </div>
                <textarea value={body} onChange={event => setBody(event.target.value)} rows={5} placeholder={isId ? 'Konteks, masalah, target hasil.' : 'Describe the business context, the problem, and the outcome you want.'} className="w-full rounded-2xl border border-[color:var(--app-border)] px-3 py-3 text-sm text-[color:var(--app-text)]" />
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--app-text-soft)]">
                  <span>{user ? (isId ? 'Posting dari akun ini.' : 'Posting with the current account.') : (isId ? 'Login dulu untuk posting.' : 'Log in to post.')}</span>
                  {user ? (
                    <button type="submit" disabled={savingThread} className="ui-button-primary inline-flex items-center justify-center px-4 text-sm font-semibold disabled:opacity-60">{savingThread ? (isId ? 'Menyimpan...' : 'Saving...') : (isId ? 'Posting topik' : 'Publish topic')}</button>
                  ) : (
                    <Link href={loginHref} className="ui-button-primary inline-flex items-center justify-center px-4 text-sm font-semibold">{isId ? 'Login dulu' : 'Log in to post'}</Link>
                  )}
                </div>
              </form>
            ) : null}
            <div className="mt-4 space-y-3">
              {loading ? <p className="text-sm text-[color:var(--app-text-soft)]">{isId ? 'Memuat topik...' : 'Loading topics...'}</p> : null}
              {!loading && threads.length === 0 ? <p className="text-sm text-[color:var(--app-text-soft)]">{isId ? 'Belum ada topik yang cocok dengan filter ini.' : 'No topics match the current filters.'}</p> : null}
              {threads.map(item => (
                <button key={item.id} type="button" onClick={() => openThread(item.id)} className={`w-full rounded-3xl border px-4 py-4 text-left transition ${threadId === item.id ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)]/20' : 'border-[color:var(--app-border)] bg-white hover:border-[color:var(--app-accent-border)]'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[color:var(--app-text)]">{item.title}</p>
                      <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">{item.category?.name || '-'} / {item.author?.name || '-'} / {fmtTime(item.lastActivityAt, isId)}</p>
                    </div>
                    <span className="ui-inline-meta ui-border text-[11px]">{item.replyCount} {isId ? 'balasan' : 'replies'}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.tags.map(tag => <span key={tag.id} className="ui-inline-meta ui-border text-[11px]">#{tag.slug}</span>)}
                    <span className="ui-inline-meta ui-border text-[11px]">{item.views} {isId ? 'view' : 'views'}</span>
                    {item.isSolved ? <span className="ui-inline-meta ui-border text-[11px]">{isId ? 'Solved' : 'Solved'}</span> : null}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="ui-panel rounded-3xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[color:var(--app-text)]">{activeThread?.title || (isId ? 'Pilih topik dulu' : 'Pick a topic')}</h2>
                <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">{activeThread ? `${activeThread.category?.name || '-'} / ${activeThread.author?.name || '-'} / ${fmtTime(activeThread.lastActivityAt, isId)}` : (isId ? 'Detail muncul di sini.' : 'Topic details will appear here.')}</p>
              </div>
              {overview?.featuredThreads?.length ? (
                <div className="flex flex-wrap gap-2">
                  {overview.featuredThreads.slice(0, 3).map(item => <button key={item.id} type="button" onClick={() => openThread(item.id)} className="ui-inline-meta ui-border text-[11px]">{plain(item.title)}</button>)}
                </div>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              {detailLoading ? <p className="text-sm text-[color:var(--app-text-soft)]">{isId ? 'Memuat isi diskusi...' : 'Loading discussion...'}</p> : null}
              {!detailLoading && !activeThread ? <p className="text-sm text-[color:var(--app-text-soft)]">{isId ? 'Belum ada topik yang dipilih.' : 'No topic selected yet.'}</p> : null}
              {posts.map(post => (
                <article key={post.id} className="rounded-3xl border border-[color:var(--app-border)] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[color:var(--app-text)]">{post.author?.name || '-'}</p>
                    <p className="text-xs text-[color:var(--app-text-soft)]">{fmtTime(post.createdAt, isId)}</p>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[color:var(--app-text-soft)]">{plain(post.content) || post.content}</p>
                  {post.imageUrls?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {post.imageUrls.map(src => {
                        const resolvedSrc = forumImageSrc(src);
                        if (!resolvedSrc) return null;

                        return (
                          <div key={resolvedSrc}>
                            <img
                              src={resolvedSrc}
                              alt="forum"
                              className="h-20 w-20 rounded-2xl object-cover"
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="ui-panel rounded-3xl p-5">
            <h2 className="text-base font-semibold text-[color:var(--app-text)]">{isId ? 'Balas diskusi' : 'Reply to topic'}</h2>
            <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">{isId ? 'Tulis jawaban yang bisa dipakai.' : 'Write a reply another operator can use immediately.'}</p>
            <form onSubmit={submitReply} className="mt-4 space-y-3">
              <textarea value={reply} onChange={event => setReply(event.target.value)} rows={5} disabled={!activeThread} placeholder={isId ? 'Contoh: supplier A stabil, SOP packing begini...' : 'Example: supplier A is stable for small batches, and this packing SOP works better...'} className="w-full rounded-2xl border border-[color:var(--app-border)] px-3 py-3 text-sm text-[color:var(--app-text)] disabled:opacity-60" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                {user ? <span className="text-sm text-[color:var(--app-text-soft)]">{isId ? 'Balasan dari akun ini.' : 'Replies will be sent from the current account.'}</span> : <Link href={loginHref} className="text-sm font-semibold ui-accent-text">{isId ? 'Login untuk membalas' : 'Log in to reply'}</Link>}
                <button type="submit" disabled={!activeThread || !reply.trim() || savingReply || !user} className="ui-button-primary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60">
                  <Send className="h-4 w-4" />
                  {savingReply ? (isId ? 'Mengirim...' : 'Sending...') : (isId ? 'Kirim balasan' : 'Send reply')}
                </button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
