'use client';

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Clapperboard,
  Edit3,
  Eye,
  ExternalLink,
  Heart,
  ImageIcon,
  LayoutGrid,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Share2,
  Tag,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';

import { useToast } from '@/components/system/feedback/ToastProvider';
import { useAuth } from '@/context/AuthContext';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type ManageTab = 'community' | 'reels';
type ManageSocialMode = 'all' | ManageTab;

type ForumThread = {
  id: string;
  title: string;
  createdAt: string;
  lastActivityAt: string;
  replyCount: number;
  views: number;
  status: string;
  imageUrls?: string[];
  tags?: Array<{ slug: string; name: string }>;
};

type ForumPost = {
  id: string;
  content: string;
  imageUrls?: string[];
};

type ForumThreadsResponse = {
  data?: ForumThread[];
  total?: number;
};

type ForumPostsResponse = {
  data?: ForumPost[];
};

type ReelItem = {
  id: string;
  title: string;
  caption: string;
  tag: string;
  mediaType: 'image' | 'video';
  videoSrc: string;
  sourceUrl: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
};

type ReelsResponse = {
  items?: ReelItem[];
  data?: ReelItem[];
};

type EditingThread = {
  id: string;
  rootPostId: string | null;
  title: string;
  content: string;
  imageUrls: string[];
};

type EditingReel = {
  id: string;
  title: string;
  caption: string;
  tag: string;
};

type EditorState =
  | { kind: 'community'; value: EditingThread }
  | { kind: 'reel'; value: EditingReel }
  | null;

type SummaryItem = {
  id: string;
  label: string;
  value: number;
  icon: LucideIcon;
};

type ManageCopy = Record<
  | 'archive'
  | 'archived'
  | 'back'
  | 'cancel'
  | 'comments'
  | 'community'
  | 'createPost'
  | 'createReel'
  | 'delete'
  | 'deleted'
  | 'edit'
  | 'editPost'
  | 'editReel'
  | 'emptyCommunity'
  | 'emptyReels'
  | 'failed'
  | 'inactive'
  | 'likes'
  | 'listings'
  | 'live'
  | 'loadFailed'
  | 'noSearch'
  | 'open'
  | 'otherTools'
  | 'partialLoadFailed'
  | 'postContent'
  | 'posts'
  | 'postTitle'
  | 'reelCaption'
  | 'reels'
  | 'reelTag'
  | 'reelTitle'
  | 'refresh'
  | 'replies'
  | 'result'
  | 'review'
  | 'save'
  | 'saved'
  | 'searchPlaceholder'
  | 'signIn'
  | 'signInCta'
  | 'subtitle'
  | 'title'
  | 'views',
  string
>;

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function metric(value: number | undefined) {
  return Math.max(Number(value || 0), 0).toLocaleString('id-ID');
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function extractReels(payload: ReelsResponse): ReelItem[] {
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase('id-ID');
}

export default function ManageCommunityClient({
  isId,
  mode = 'all',
}: {
  isId: boolean;
  mode?: ManageSocialMode;
}) {
  const locale = isId ? 'id-ID' : 'en-US';
  const { authFetch, isAuthenticated, loading: authLoading } = useAuth();
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState<ManageTab>(
    mode === 'reels' ? 'reels' : 'community',
  );
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [failedTabs, setFailedTabs] = useState<ManageTab[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);

  const copy = useMemo(
    () =>
      isId
        ? {
            title:
              mode === 'community'
                ? 'Postingan komunitas'
                : mode === 'reels'
                  ? 'Reels saya'
                  : 'Konten sosial',
            subtitle:
              mode === 'community'
                ? 'Lihat, cari, edit, atau hapus postingan komunitas milikmu.'
                : mode === 'reels'
                  ? 'Lihat, edit, atau arsipkan reels yang sudah kamu buat.'
                  : 'Kelola postingan komunitas dan reels dari satu tempat.',
            community: 'Komunitas',
            reels: 'Reels',
            refresh: 'Perbarui',
            createPost: 'Buat postingan',
            createReel: 'Buat reels',
            back: 'Pusat kelola',
            searchPlaceholder:
              activeTab === 'community'
                ? 'Cari judul atau tag...'
                : 'Cari judul, caption, atau tag...',
            loading: 'Memuat konten...',
            signIn: 'Masuk dulu untuk mengelola kontenmu.',
            signInCta: 'Masuk',
            emptyCommunity: 'Belum ada postingan komunitas.',
            emptyReels: 'Belum ada reels.',
            noSearch: 'Tidak ada konten yang cocok dengan pencarian.',
            edit: 'Edit',
            save: 'Simpan',
            cancel: 'Batal',
            delete: 'Hapus',
            archive: 'Arsipkan',
            open: 'Buka',
            failed: 'Aksi gagal. Coba lagi.',
            loadFailed: 'Konten belum bisa dimuat.',
            partialLoadFailed:
              'Sebagian data belum bisa dimuat. Konten lain tetap bisa dikelola.',
            saved: 'Perubahan disimpan.',
            deleted: 'Postingan dihapus.',
            archived: 'Reels diarsipkan.',
            posts: 'Postingan',
            views: 'Dilihat',
            replies: 'Balasan',
            likes: 'Suka',
            comments: 'Komentar',
            shares: 'Dibagikan',
            editPost: 'Edit postingan',
            editReel: 'Edit reels',
            postTitle: 'Judul postingan',
            postContent: 'Isi postingan',
            reelTitle: 'Judul reels',
            reelTag: 'Tag',
            reelCaption: 'Caption',
            live: 'Aktif',
            review: 'Ditinjau',
            inactive: 'Tidak aktif',
            result: 'konten',
            otherTools: 'Kelola lainnya',
            listings: 'Listing',
          }
        : {
            title:
              mode === 'community'
                ? 'Community posts'
                : mode === 'reels'
                  ? 'My reels'
                  : 'Social content',
            subtitle:
              mode === 'community'
                ? 'View, search, edit, or delete your community posts.'
                : mode === 'reels'
                  ? 'View, edit, or archive reels you have created.'
                  : 'Manage community posts and reels in one place.',
            community: 'Community',
            reels: 'Reels',
            refresh: 'Refresh',
            createPost: 'Create post',
            createReel: 'Create reel',
            back: 'Manage hub',
            searchPlaceholder:
              activeTab === 'community'
                ? 'Search title or tag...'
                : 'Search title, caption, or tag...',
            loading: 'Loading content...',
            signIn: 'Sign in to manage your content.',
            signInCta: 'Sign in',
            emptyCommunity: 'No community posts yet.',
            emptyReels: 'No reels yet.',
            noSearch: 'No content matches your search.',
            edit: 'Edit',
            save: 'Save',
            cancel: 'Cancel',
            delete: 'Delete',
            archive: 'Archive',
            open: 'Open',
            failed: 'Action failed. Try again.',
            loadFailed: 'Content could not be loaded.',
            partialLoadFailed:
              'Some data could not be loaded. Other content remains manageable.',
            saved: 'Changes saved.',
            deleted: 'Post deleted.',
            archived: 'Reel archived.',
            posts: 'Posts',
            views: 'Views',
            replies: 'Replies',
            likes: 'Likes',
            comments: 'Comments',
            shares: 'Shares',
            editPost: 'Edit post',
            editReel: 'Edit reel',
            postTitle: 'Post title',
            postContent: 'Post content',
            reelTitle: 'Reel title',
            reelTag: 'Tag',
            reelCaption: 'Caption',
            live: 'Active',
            review: 'In review',
            inactive: 'Inactive',
            result: 'items',
            otherTools: 'Manage more',
            listings: 'Listings',
          },
    [activeTab, isId, mode],
  );

  useEffect(() => {
    if (mode === 'reels') setActiveTab('reels');
    if (mode === 'community') setActiveTab('community');
  }, [mode]);

  useEffect(() => {
    setQuery('');
  }, [activeTab]);

  const loadContent = async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    setFailedTabs([]);

    const requests: Array<Promise<{ tab: ManageTab; items: unknown[] }>> = [];

    if (mode !== 'reels') {
      requests.push(
        authFetch('/api/forum/threads?mine=true&sort=new&page_size=50', {
          cache: 'no-store',
        }).then(async response => {
          if (!response.ok) throw new Error(`threads:${response.status}`);
          const payload = await readJson<ForumThreadsResponse>(response);
          return {
            tab: 'community',
            items: Array.isArray(payload.data) ? payload.data : [],
          };
        }),
      );
    }

    if (mode !== 'community') {
      requests.push(
        authFetch('/api/reels?mine=true&limit=50', {
          cache: 'no-store',
        }).then(async response => {
          if (!response.ok) throw new Error(`reels:${response.status}`);
          const payload = await readJson<ReelsResponse>(response);
          return { tab: 'reels', items: extractReels(payload) };
        }),
      );
    }

    const results = await Promise.allSettled(requests);
    const failures: ManageTab[] = [];

    results.forEach((result, index) => {
      const requestedTab: ManageTab =
        mode === 'community'
          ? 'community'
          : mode === 'reels'
            ? 'reels'
            : index === 0
              ? 'community'
              : 'reels';

      if (result.status === 'rejected') {
        failures.push(requestedTab);
        return;
      }

      if (result.value.tab === 'community') {
        setThreads(result.value.items as ForumThread[]);
      } else {
        setReels(result.value.items as ReelItem[]);
      }
    });

    setFailedTabs(failures);
    if (failures.length > 0) {
      setLoadError(
        failures.length === requests.length
          ? copy.loadFailed
          : copy.partialLoadFailed,
      );
      notify({ title: copy.failed, variant: 'error' });
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) void loadContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  const startThreadEdit = async (thread: ForumThread) => {
    setBusyId(thread.id);
    try {
      const response = await authFetch(
        `/api/forum/threads/${encodeURIComponent(thread.id)}/posts?page_size=1`,
        { cache: 'no-store' },
      );
      if (!response.ok) throw new Error('failed');

      const payload = await readJson<ForumPostsResponse>(response);
      const root = Array.isArray(payload.data) ? payload.data[0] : null;

      setEditor({
        kind: 'community',
        value: {
          id: thread.id,
          rootPostId: root?.id || null,
          title: thread.title,
          content: root?.content || '',
          imageUrls: root?.imageUrls || thread.imageUrls || [],
        },
      });
    } catch {
      notify({ title: copy.failed, variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const saveThread = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || editor.kind !== 'community') return;

    const current = editor.value;
    setBusyId(current.id);
    try {
      const response = await authFetch(
        `/api/forum/threads/${encodeURIComponent(current.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: current.title,
            content: current.content,
            imageUrls: current.imageUrls,
          }),
        },
      );
      if (!response.ok) throw new Error('failed');

      setEditor(null);
      notify({ title: copy.saved, variant: 'success' });
      await loadContent();
    } catch {
      notify({ title: copy.failed, variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const deleteThread = async (threadId: string) => {
    if (
      !window.confirm(
        isId ? 'Hapus postingan komunitas ini?' : 'Delete this community post?',
      )
    ) {
      return;
    }

    setBusyId(threadId);
    try {
      const response = await authFetch(
        `/api/forum/threads/${encodeURIComponent(threadId)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) throw new Error('failed');

      setThreads(current => current.filter(item => item.id !== threadId));
      notify({ title: copy.deleted, variant: 'success' });
    } catch {
      notify({ title: copy.failed, variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const saveReel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || editor.kind !== 'reel') return;

    const current = editor.value;
    setBusyId(current.id);
    try {
      const response = await authFetch(
        `/api/reels/${encodeURIComponent(current.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(current),
        },
      );
      if (!response.ok) throw new Error('failed');

      setEditor(null);
      notify({ title: copy.saved, variant: 'success' });
      await loadContent();
    } catch {
      notify({ title: copy.failed, variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const archiveReel = async (reelId: string) => {
    if (
      !window.confirm(
        isId
          ? 'Arsipkan reels ini? Reels tidak akan tampil di feed.'
          : 'Archive this reel? It will no longer appear in the feed.',
      )
    ) {
      return;
    }

    setBusyId(reelId);
    try {
      const response = await authFetch(
        `/api/reels/${encodeURIComponent(reelId)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) throw new Error('failed');

      setReels(current => current.filter(item => item.id !== reelId));
      notify({ title: copy.archived, variant: 'success' });
    } catch {
      notify({ title: copy.failed, variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const searchValue = normalizeSearch(query);

  const filteredThreads = useMemo(() => {
    if (!searchValue) return threads;
    return threads.filter(thread => {
      const haystack = [
        thread.title,
        ...(thread.tags || []).flatMap(item => [item.name, item.slug]),
      ]
        .join(' ')
        .toLocaleLowerCase('id-ID');
      return haystack.includes(searchValue);
    });
  }, [searchValue, threads]);

  const filteredReels = useMemo(() => {
    if (!searchValue) return reels;
    return reels.filter(reel =>
      [reel.title, reel.caption, reel.tag]
        .join(' ')
        .toLocaleLowerCase('id-ID')
        .includes(searchValue),
    );
  }, [reels, searchValue]);

  const summaryItems = useMemo<SummaryItem[]>(() => {
    if (activeTab === 'community') {
      return [
        {
          id: 'posts',
          label: copy.posts,
          value: threads.length,
          icon: MessageCircle,
        },
        {
          id: 'views',
          label: copy.views,
          value: threads.reduce((total, item) => total + item.views, 0),
          icon: Eye,
        },
        {
          id: 'replies',
          label: copy.replies,
          value: threads.reduce((total, item) => total + item.replyCount, 0),
          icon: MessageCircle,
        },
      ];
    }

    return [
      {
        id: 'reels',
        label: copy.reels,
        value: reels.length,
        icon: Clapperboard,
      },
      {
        id: 'likes',
        label: copy.likes,
        value: reels.reduce((total, item) => total + item.likesCount, 0),
        icon: Heart,
      },
      {
        id: 'comments',
        label: copy.comments,
        value: reels.reduce((total, item) => total + item.commentsCount, 0),
        icon: MessageCircle,
      },
    ];
  }, [activeTab, copy, reels, threads]);

  const activeTabFailed = failedTabs.includes(activeTab);
  const visibleCount =
    activeTab === 'community' ? filteredThreads.length : filteredReels.length;

  if (!authLoading && !isAuthenticated) {
    return (
      <main className="page-shell py-5 sm:py-7">
        <section className="mx-auto max-w-xl rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 sm:p-6">
          <AlertCircle className="h-6 w-6 text-amber-600" />
          <h1 className="mt-4 text-xl font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {copy.signIn}
          </h1>
          <Link
            href="/login"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
          >
            {copy.signInCta}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell min-w-0 max-w-full space-y-4 overflow-x-clip pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-3 sm:py-5">
      <header className="flex min-w-0 flex-col gap-3 border-b border-[color:var(--app-border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/manage"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-accent)] sm:text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {copy.back}
          </Link>
          <h1 className="mt-2 text-xl font-black tracking-[-0.03em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-2xl">
            {copy.title}
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[color:var(--app-text-soft)] sm:text-sm">
            {copy.subtitle}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void loadContent()}
            disabled={loading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)] disabled:opacity-60"
            aria-label={copy.refresh}
            title={copy.refresh}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>

          <Link
            href={
              activeTab === 'community'
                ? '/community?compose=post'
                : '/reels?upload=1'
            }
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[color:var(--app-accent-strong)] px-3.5 text-xs font-black text-white shadow-[0_10px_24px_-18px_rgba(4,120,87,0.9)] transition hover:-translate-y-0.5 hover:brightness-95 sm:min-h-11 sm:px-4 sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            {activeTab === 'community' ? copy.createPost : copy.createReel}
          </Link>
        </div>
      </header>

      {mode === 'all' ? (
        <div className="inline-flex w-full rounded-2xl bg-[color:var(--app-surface-muted)] p-1 sm:w-auto">
          <TabButton
            active={activeTab === 'community'}
            label={copy.community}
            count={threads.length}
            icon={MessageCircle}
            onClick={() => setActiveTab('community')}
          />
          <TabButton
            active={activeTab === 'reels'}
            label={copy.reels}
            count={reels.length}
            icon={Clapperboard}
            onClick={() => setActiveTab('reels')}
          />
        </div>
      ) : null}

      <section className="grid grid-cols-3 gap-2 sm:max-w-2xl sm:gap-3">
        {summaryItems.map(item => (
          <SummaryCard key={item.id} item={item} />
        ))}
      </section>

      {loadError ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900 dark:border-amber-800/70 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      ) : null}

      <section className="min-w-0">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] pl-9 pr-9 text-sm text-[color:var(--app-text)] outline-none transition placeholder:text-[color:var(--app-text-soft)] focus:border-[color:var(--app-accent-border)] focus:ring-2 focus:ring-[color:var(--app-accent-soft)]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <p className="text-[11px] font-bold text-[color:var(--app-text-soft)] sm:text-xs">
            {metric(visibleCount)} {copy.result}
          </p>
        </div>

        {loading ? (
          <ContentSkeleton />
        ) : !activeTabFailed && activeTab === 'community' ? (
          <div className="mt-3 space-y-2.5">
            {filteredThreads.length === 0 ? (
              <EmptyState
                text={query ? copy.noSearch : copy.emptyCommunity}
                href={query ? undefined : '/community?compose=post'}
                label={copy.createPost}
                  />
            ) : null}

            {filteredThreads.map(thread => (
              <CommunityRow
                key={thread.id}
                thread={thread}
                locale={locale}
                busy={busyId === thread.id}
                copy={copy}
                onEdit={() => void startThreadEdit(thread)}
                onDelete={() => void deleteThread(thread.id)}
              />
            ))}
          </div>
        ) : !activeTabFailed && activeTab === 'reels' ? (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredReels.length === 0 ? (
              <EmptyState
                text={query ? copy.noSearch : copy.emptyReels}
                href={query ? undefined : '/reels?upload=1'}
                label={copy.createReel}
                  />
            ) : null}

            {filteredReels.map(reel => (
              <ReelCard
                key={reel.id}
                reel={reel}
                isId={isId}
                busy={busyId === reel.id}
                copy={copy}
                onEdit={() =>
                  setEditor({
                    kind: 'reel',
                    value: {
                      id: reel.id,
                      title: reel.title,
                      caption: reel.caption,
                      tag: reel.tag,
                    },
                  })
                }
                onArchive={() => void archiveReel(reel.id)}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className="flex flex-wrap items-center gap-2 border-t border-[color:var(--app-border)] pt-3">
        <span className="mr-1 text-[11px] font-bold text-[color:var(--app-text-soft)]">
          {copy.otherTools}
        </span>
        <Link
          href="/my-listings"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-[11px] font-bold text-[color:var(--app-text-soft)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          {copy.listings}
        </Link>
        {mode !== 'community' ? null : (
          <Link
            href="/manage/reels"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-[11px] font-bold text-[color:var(--app-text-soft)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]"
          >
            <Clapperboard className="h-3.5 w-3.5" />
            {copy.reels}
          </Link>
        )}
      </section>

      <EditorModal
        editor={editor}
        busyId={busyId}
        copy={copy}
        onClose={() => setEditor(null)}
        onChange={setEditor}
        onSaveThread={saveThread}
        onSaveReel={saveReel}
      />
    </main>
  );
}

function TabButton({
  active,
  label,
  count,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition sm:flex-none',
        active
          ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)] shadow-sm ring-1 ring-[color:var(--app-accent-border)]'
          : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-strong)] hover:text-[color:var(--app-text)]',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] dark:bg-white/10">
        {metric(count)}
      </span>
    </button>
  );
}

function SummaryCard({ item }: { item: SummaryItem }) {
  const Icon = item.icon;

  return (
    <div className="min-w-0 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2.5 transition hover:border-[color:var(--app-accent-border)] sm:p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
          <Icon className="h-4 w-4" />
        </span>
        <strong className="truncate text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-xl">
          {metric(item.value)}
        </strong>
      </div>
      <p className="mt-2 truncate text-[10px] font-bold text-[color:var(--app-text-soft)] sm:text-xs">
        {item.label}
      </p>
    </div>
  );
}


function CommunityRow({
  thread,
  locale,
  busy,
  copy,
  onEdit,
  onDelete,
}: {
  thread: ForumThread;
  locale: string;
  busy: boolean;
  copy: ManageCopy;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const image = thread.imageUrls?.find(Boolean);
  const status = statusPresentation(thread.status, copy);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] transition hover:border-[color:var(--app-accent-border)] hover:shadow-[0_16px_30px_-28px_rgba(15,23,42,0.34)]">
      <div className="absolute inset-y-0 left-0 w-[3px] bg-[color:var(--app-accent)] opacity-70" />
      <div className="flex min-w-0 gap-3 p-3 pl-4 sm:items-center sm:p-3.5 sm:pl-4.5">
        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[color:var(--app-surface-muted)] sm:h-20 sm:w-28">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-[color:var(--app-accent)]">
              <MessageCircle className="h-6 w-6" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black', status.className)}>
              {status.label}
            </span>
            <time className="truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
              {formatDate(thread.createdAt, locale)}
            </time>
          </div>

          <h2 className="mt-1.5 line-clamp-2 text-[13px] font-black leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-sm">
            {thread.title}
          </h2>

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-[color:var(--app-text-soft)] sm:text-[11px]">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {metric(thread.views)} {copy.views.toLocaleLowerCase()}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {metric(thread.replyCount)} {copy.replies.toLocaleLowerCase()}
            </span>
            {thread.tags?.[0] ? (
              <span className="inline-flex max-w-[130px] items-center gap-1 truncate text-[color:var(--app-accent)]">
                <Tag className="h-3 w-3" />
                {thread.tags[0].name}
              </span>
            ) : null}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <Link
            href={`/community?thread=${encodeURIComponent(thread.id)}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] bg-white px-2.5 text-[11px] font-bold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] dark:bg-white/5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {copy.open}
          </Link>
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2.5 text-[11px] font-bold text-[color:var(--app-accent)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Edit3 className="h-3.5 w-3.5" />
            )}
            {copy.edit}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:hover:bg-rose-500/10"
            aria-label={`${copy.delete}: ${thread.title}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 border-t border-[color:var(--app-border)] p-2 sm:hidden">
        <Link
          href={`/community?thread=${encodeURIComponent(thread.id)}`}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold text-[color:var(--app-text)]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {copy.open}
        </Link>
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold text-[color:var(--app-accent)] disabled:opacity-60"
        >
          <Edit3 className="h-3.5 w-3.5" />
          {copy.edit}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold text-rose-600 disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {copy.delete}
        </button>
      </div>
    </article>
  );
}

function ReelCard({
  reel,
  isId,
  busy,
  copy,
  onEdit,
  onArchive,
}: {
  reel: ReelItem;
  isId: boolean;
  busy: boolean;
  copy: ManageCopy;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const source = reel.videoSrc || reel.sourceUrl;
  const isVideo = reel.mediaType !== 'image';

  return (
    <article className="group overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] transition hover:border-[color:var(--app-accent-border)] hover:shadow-[0_16px_30px_-28px_rgba(15,23,42,0.34)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-[color:var(--app-surface-muted)]">
        {source && !failed ? (
          isVideo ? (
            <video
              src={source}
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
              onError={() => setFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source}
              alt=""
              loading="lazy"
              onError={() => setFailed(true)}
              className="h-full w-full object-cover"
            />
          )
        ) : (
          <div className="grid h-full w-full place-items-center text-[color:var(--app-accent)]">
            {reel.mediaType === 'image' ? (
              <ImageIcon className="h-7 w-7" />
            ) : (
              <Clapperboard className="h-7 w-7" />
            )}
          </div>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-emerald-600 px-2 py-1 text-[9px] font-black text-white shadow-sm">
          {isId ? 'Tayang' : 'Published'}
        </span>
      </div>

      <div className="p-3.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="line-clamp-1 text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {reel.title || (isId ? 'Reels tanpa judul' : 'Untitled reel')}
            </h2>
            <p className="mt-1 line-clamp-1 text-[11px] text-[color:var(--app-text-soft)]">
              {reel.caption || (isId ? 'Belum ada caption.' : 'No caption yet.')}
            </p>
          </div>
          {reel.tag ? (
            <span className="max-w-[40%] truncate rounded-full bg-[color:var(--app-surface-muted)] px-2 py-1 text-[9px] font-bold text-[color:var(--app-text-soft)]">
              #{reel.tag.replace(/^#/, '')}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-3 text-[10px] font-bold text-[color:var(--app-text-soft)]">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" /> {metric(reel.likesCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />{' '}
            {metric(reel.commentsCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Share2 className="h-3.5 w-3.5" /> {metric(reel.sharesCount)}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-[color:var(--app-border)] pt-3">
          <Link
            href={`/reels?video=${encodeURIComponent(reel.id)}`}
            className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg text-[10px] font-bold text-[color:var(--app-text)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {copy.open}
          </Link>
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg text-[10px] font-bold text-[color:var(--app-accent)] disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Edit3 className="h-3.5 w-3.5" />
            )}
            {copy.edit}
          </button>
          <button
            type="button"
            onClick={onArchive}
            disabled={busy}
            className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg text-[10px] font-bold text-amber-700 disabled:opacity-60 dark:text-amber-300"
          >
            <Archive className="h-3.5 w-3.5" />
            {copy.archive}
          </button>
        </div>
      </div>
    </article>
  );
}

function EditorModal({
  editor,
  busyId,
  copy,
  onClose,
  onChange,
  onSaveThread,
  onSaveReel,
}: {
  editor: EditorState;
  busyId: string | null;
  copy: ManageCopy;
  onClose: () => void;
  onChange: (value: EditorState) => void;
  onSaveThread: (event: FormEvent<HTMLFormElement>) => void;
  onSaveReel: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!editor || typeof document === 'undefined') return null;

  const isCommunity = editor.kind === 'community';
  const busy = busyId === editor.value.id;

  return createPortal(
    <div className="fixed inset-0 z-[1600] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-2xl sm:max-h-[88dvh] sm:max-w-xl sm:rounded-[24px]">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
              {copy.edit}
            </p>
            <h2 className="truncate text-base font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {isCommunity ? copy.editPost : copy.editReel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)]"
            aria-label={copy.cancel}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isCommunity ? (
          <form onSubmit={onSaveThread} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <LabeledField label={copy.postTitle}>
                <input
                  value={editor.value.title}
                  onChange={event =>
                    onChange({
                      kind: 'community',
                      value: { ...editor.value, title: event.target.value },
                    })
                  }
                  required
                  className="min-h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--app-accent-border)] focus:ring-2 focus:ring-[color:var(--app-accent-soft)]"
                />
              </LabeledField>
              <LabeledField label={copy.postContent}>
                <textarea
                  value={editor.value.content}
                  onChange={event =>
                    onChange({
                      kind: 'community',
                      value: { ...editor.value, content: event.target.value },
                    })
                  }
                  rows={7}
                  className="w-full resize-y rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2.5 text-sm leading-6 outline-none focus:border-[color:var(--app-accent-border)] focus:ring-2 focus:ring-[color:var(--app-accent-soft)]"
                />
              </LabeledField>
            </div>
            <EditorFooter
              busy={busy}
              save={copy.save}
              cancel={copy.cancel}
                onCancel={onClose}
            />
          </form>
        ) : (
          <form onSubmit={onSaveReel} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <LabeledField label={copy.reelTitle}>
                <input
                  value={editor.value.title}
                  onChange={event =>
                    onChange({
                      kind: 'reel',
                      value: { ...editor.value, title: event.target.value },
                    })
                  }
                  required
                  className="min-h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm font-semibold outline-none focus:border-[color:var(--app-accent-border)] focus:ring-2 focus:ring-[color:var(--app-accent-soft)]"
                />
              </LabeledField>
              <LabeledField label={copy.reelTag}>
                <input
                  value={editor.value.tag}
                  onChange={event =>
                    onChange({
                      kind: 'reel',
                      value: { ...editor.value, tag: event.target.value },
                    })
                  }
                  className="min-h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm outline-none focus:border-[color:var(--app-accent-border)] focus:ring-2 focus:ring-[color:var(--app-accent-soft)]"
                />
              </LabeledField>
              <LabeledField label={copy.reelCaption}>
                <textarea
                  value={editor.value.caption}
                  onChange={event =>
                    onChange({
                      kind: 'reel',
                      value: { ...editor.value, caption: event.target.value },
                    })
                  }
                  rows={6}
                  className="w-full resize-y rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2.5 text-sm leading-6 outline-none focus:border-[color:var(--app-accent-border)] focus:ring-2 focus:ring-[color:var(--app-accent-soft)]"
                />
              </LabeledField>
            </div>
            <EditorFooter
              busy={busy}
              save={copy.save}
              cancel={copy.cancel}
                onCancel={onClose}
            />
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

function EditorFooter({
  busy,
  save,
  cancel,
  onCancel,
}: {
  busy: boolean;
  save: string;
  cancel: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[color:var(--app-border)] px-4 text-xs font-bold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)]"
      >
        {cancel}
      </button>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[color:var(--app-accent-strong)] px-4 text-xs font-black text-white transition hover:brightness-95 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {save}
      </button>
    </div>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-[color:var(--app-text-soft)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function statusPresentation(status: string, copy: ManageCopy) {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'pending' || normalized === 'review') {
    return {
      label: copy.review,
      className:
        'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    };
  }
  if (
    normalized === 'blocked' ||
    normalized === 'archived' ||
    normalized === 'inactive'
  ) {
    return {
      label: copy.inactive,
      className:
        'bg-slate-200 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
    };
  }
  return {
    label: copy.live,
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  };
}

function EmptyState({
  text,
  href,
  label,
}: {
  text: string;
  href?: string;
  label: string;
}) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-5 text-center">
      <p className="text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        {text}
      </p>
      {href ? (
        <Link
          href={href}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[color:var(--app-accent-strong)] px-4 text-xs font-black text-white transition hover:brightness-95"
        >
          <Plus className="h-4 w-4" />
          {label}
        </Link>
      ) : null}
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="mt-3 space-y-2.5" aria-busy="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex animate-pulse gap-3 rounded-2xl border border-[color:var(--app-border)] p-3"
        >
          <div className="h-20 w-24 shrink-0 rounded-xl bg-[color:var(--app-surface-muted)]" />
          <div className="min-w-0 flex-1 py-1">
            <div className="h-3 w-20 rounded-full bg-[color:var(--app-surface-muted)]" />
            <div className="mt-3 h-4 w-3/4 rounded-full bg-[color:var(--app-surface-muted)]" />
            <div className="mt-2 h-3 w-1/2 rounded-full bg-[color:var(--app-surface-muted)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
